// Put the deployed Google Apps Script Web App URL here.
const API_URL = "/api/attendance";

const state = {
  name: "",
  pin: "",
  mode: ""
};

const REQUIRED_OJT_HOURS = 600;
let supervisorInterns = [];
let isRefreshingSupervisor = false;
let weeklyReportData = null;
let weeklyReportKey = "";

// Reference from the supplied example: October 12–17, 2026 is Week 6.
// Change these two values if WVAS uses a different official week numbering baseline.
const REPORT_WEEK_ANCHOR_DATE = "2026-10-12";
const REPORT_WEEK_ANCHOR_NUMBER = 6;

const $ = (id) => document.getElementById(id);

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 2800);
}

function callApi(params) {
  return new Promise(async (resolve, reject) => {
    try {
      const query = new URLSearchParams(params);
      const response = await fetch(`${API_URL}?${query.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Attendance server returned ${response.status}.`);
      }

      const data = await response.json();
      resolve(data);
    } catch (error) {
      reject(error);
    }
  });
}

async function loadNames() {
  try {
    const data = await callApi({ action: "config" });
    $("name").innerHTML = '<option value="">Select your name</option>';

    data.interns.forEach((intern) => {
      const option = document.createElement("option");
      option.value = intern;
      option.textContent = intern;
      $("name").appendChild(option);
    });
  } catch (error) {
    $("name").innerHTML = '<option value="">Backend not connected</option>';
    toast(error.message);
  }
}

async function login() {
  const name = $("name").value;
  const pin = $("pin").value.trim();

  if (!name || !pin) {
    toast("Select your name and enter your PIN.");
    return;
  }

  try {
    const data = await callApi({ action: "login", name, pin });

    if (!data.ok) throw new Error(data.message);

    state.name = name;
    state.pin = pin;
    state.mode = "intern";

    $("loginScreen").classList.add("hidden");
    $("internScreen").classList.remove("hidden");
    $("welcome").textContent = name;
    $("dateLabel").textContent = todayText();

    await refreshIntern();
  } catch (error) {
    toast(error.message);
  }
}

async function openSupervisor() {
  const pin = prompt("Enter supervisor PIN:");

  if (!pin) return;

  try {
    const data = await callApi({ action: "adminLogin", pin });

    if (!data.ok) throw new Error(data.message);

    state.mode = "supervisor";
    state.pin = pin;

    $("loginScreen").classList.add("hidden");
    $("supervisorScreen").classList.remove("hidden");
    $("adminDate").textContent = todayText();

    await refreshSupervisor();
  } catch (error) {
    toast(error.message);
  }
}

async function punch(action) {
  const button = action === "timeIn" ? $("timeInBtn") : $("timeOutBtn");
  button.disabled = true;

  try {
    const data = await callApi({
      action,
      name: state.name,
      pin: state.pin
    });

    if (!data.ok) throw new Error(data.message);

    toast(data.message);
    await refreshIntern();
  } catch (error) {
    button.disabled = false;
    toast(error.message);
  }
}

async function refreshIntern() {
  const data = await callApi({
    action: "summary",
    name: state.name,
    pin: state.pin
  });

  if (!data.ok) {
    toast(data.message);
    return;
  }

  $("totalHours").textContent = Number(data.totalHours).toFixed(2);
  $("days").textContent = data.days;
  $("remaining").textContent = Number(data.remainingHours).toFixed(2);

  $("timeIn").textContent = data.today.timeIn || "—";
  $("timeOut").textContent = data.today.timeOut || "—";
  $("todayHours").textContent = Number(data.today.creditedHours || 0).toFixed(2);

  const status = $("status");
  status.textContent = data.today.status || "Not Logged In";
  status.className = "pill " + statusClass(data.today.status);

  $("timeInBtn").disabled = Boolean(data.today.timeIn);
  $("timeOutBtn").disabled = !data.today.timeIn || Boolean(data.today.timeOut);
}

async function refreshSupervisor() {
  if (isRefreshingSupervisor) return;

  isRefreshingSupervisor = true;
  const refreshButton = $("refreshBtn");
  const table = $("teamTable");
  const originalButtonText = refreshButton.textContent;

  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing…";
  table.setAttribute("aria-busy", "true");

  if (supervisorInterns.length === 0) {
    table.innerHTML = '<div class="empty-state">Loading attendance records…</div>';
  }

  try {
    const data = await callApi({
      action: "adminSummary",
      pin: state.pin
    });

    if (!data.ok) throw new Error(data.message || "Unable to load attendance records.");

    supervisorInterns = Array.isArray(data.interns) ? data.interns : [];

    $("teamHours").textContent = formatHours(data.teamHours);
    $("teamPresent").textContent = `${Number(data.todayPresent || 0)}/${Number(data.internCount ?? supervisorInterns.length)}`;

    const reportSelect = $("reportIntern");
    const currentReportName = reportSelect.value;
    reportSelect.innerHTML = '<option value="">Select an intern</option>';

    supervisorInterns.forEach((intern) => {
      const option = document.createElement("option");
      option.value = String(intern.name || "");
      option.textContent = String(intern.name || "Unnamed intern");
      reportSelect.appendChild(option);
    });

    if (supervisorInterns.some((intern) => String(intern.name || "") === currentReportName)) {
      reportSelect.value = currentReportName;
    }

    updateStatusFilter(supervisorInterns);
    renderSupervisorTable();
    $("lastUpdated").textContent = `Last updated ${new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    })}`;
  } catch (error) {
    toast(error.message || "Couldn't refresh attendance. Please try again.");
    if (supervisorInterns.length === 0) {
      table.innerHTML = '<div class="empty-state"><strong>Attendance could not be loaded</strong>Check your connection and try refreshing again.</div>';
    }
  } finally {
    isRefreshingSupervisor = false;
    refreshButton.disabled = false;
    refreshButton.textContent = originalButtonText;
    table.setAttribute("aria-busy", "false");
  }
}

function updateStatusFilter(interns) {
  const select = $("statusFilter");
  const current = select.value;
  const statuses = [...new Set(interns.map((intern) => {
    return String(intern.status || "No Record").trim() || "No Record";
  }))].sort((a, b) => a.localeCompare(b));

  select.innerHTML = '<option value="all">All statuses</option>';
  statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    select.appendChild(option);
  });

  select.value = statuses.includes(current) ? current : "all";
}

function renderSupervisorTable() {
  const table = $("teamTable");
  const query = $("internSearch").value.trim().toLocaleLowerCase();
  const selectedStatus = $("statusFilter").value;

  if (supervisorInterns.length === 0) {
    table.innerHTML = '<div class="empty-state"><strong>No attendance records</strong>There are no intern records to display yet.</div>';
    return;
  }

  const filteredInterns = supervisorInterns.filter((intern) => {
    const name = String(intern.name || "").toLocaleLowerCase();
    const status = String(intern.status || "No Record").trim() || "No Record";
    const matchesName = name.includes(query);
    const matchesStatus = selectedStatus === "all" || status === selectedStatus;
    return matchesName && matchesStatus;
  });

  if (filteredInterns.length === 0) {
    table.innerHTML = '<div class="empty-state"><strong>No matching interns</strong>Try another name or choose “All statuses”.</div>';
    return;
  }

  const rows = filteredInterns.map((intern) => {
    const name = String(intern.name || "Unnamed intern");
    const totalHours = numericValue(intern.totalHours);
    const progress = Math.min(100, Math.max(0, (totalHours / REQUIRED_OJT_HOURS) * 100));
    const progressLabel = `${progress.toFixed(1)}%`;
    const status = String(intern.status || "No Record").trim() || "No Record";

    return `
      <tr>
        <td><strong>${safe(name)}</strong></td>
        <td>${safe(intern.timeIn || "—")}</td>
        <td>${safe(intern.timeOut || "—")}</td>
        <td>${formatHours(intern.todayHours)}</td>
        <td>${formatHours(intern.totalHours)}</td>
        <td class="progress-cell">
          <div class="progress-meta"><span>${progressLabel}</span><strong>${Math.min(REQUIRED_OJT_HOURS, Math.max(0, totalHours)).toFixed(1)}/${REQUIRED_OJT_HOURS}</strong></div>
          <div class="progress-track" role="progressbar" aria-label="${safe(name)} OJT hours completed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.toFixed(1)}">
            <span class="progress-fill" style="width: ${progress}%"></span>
          </div>
        </td>
        <td>${formatHours(intern.remainingHours)}</td>
        <td><span class="pill ${statusClass(status)}">${safe(status)}</span></td>
      </tr>
    `;
  }).join("");

  table.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Intern</th>
          <th>Time In</th>
          <th>Time Out</th>
          <th>Today</th>
          <th>Total Hours</th>
          <th>Completion</th>
          <th>Remaining</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatHours(value) {
  return numericValue(value).toFixed(2);
}

async function exportCsv() {
  try {
    const data = await callApi({
      action: "export",
      pin: state.pin
    });

    if (!data.ok) throw new Error(data.message);

    const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "WVAS_OJT_Accomplishment_Time_Report.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast(error.message);
  }
}

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayForIsoDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const weekdayFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekdayFromMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function reportWeekNumber(startDate) {
  const selectedMonday = mondayForIsoDate(startDate);
  const anchorMonday = mondayForIsoDate(REPORT_WEEK_ANCHOR_DATE);
  if (!selectedMonday || !anchorMonday) return REPORT_WEEK_ANCHOR_NUMBER;
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const deltaWeeks = Math.round((selectedMonday.getTime() - anchorMonday.getTime()) / oneWeekMs);
  return Math.max(1, REPORT_WEEK_ANCHOR_NUMBER + deltaWeeks);
}

function reportSurname(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const surname = parts.length ? parts[parts.length - 1] : "Intern";
  return surname.replace(/[^a-z0-9-]/gi, "") || "Intern";
}

function reportFileStem() {
  const name = $("reportIntern").value;
  const startDate = $("reportStartDate").value;
  if (!name || !startDate) return "W#_LastName";
  return `W${reportWeekNumber(startDate)}_${reportSurname(name)}`;
}

function currentWeeklyCriteriaKey() {
  return JSON.stringify({
    name: $("reportIntern").value,
    startDate: $("reportStartDate").value,
    endDate: $("reportEndDate").value
  });
}

function updateReportFilename() {
  $("reportFilename").textContent = reportFileStem();
}

function invalidateWeeklyPreview() {
  weeklyReportData = null;
  weeklyReportKey = "";
  $("downloadJpgBtn").disabled = true;
  $("downloadExcelBtn").disabled = true;
  $("weeklyPreviewTitle").textContent = "Preview needs to be refreshed";
  $("weeklyPreviewMeta").textContent = "Selection changed";
  $("weeklyPreview").innerHTML = '<div class="preview-placeholder">Your selection changed. Click <strong>Preview DTR</strong> to load the matching records.</div>';
  $("weeklyPreview").setAttribute("aria-busy", "false");
}

function initializeWeeklyReportControls() {
  const now = new Date();
  const monday = new Date(now);
  const daysSinceMonday = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - daysSinceMonday);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  $("reportStartDate").value = dateInputValue(monday);
  $("reportEndDate").value = dateInputValue(saturday);
  updateReportFilename();

  ["reportIntern", "reportStartDate", "reportEndDate"].forEach((id) => {
    $(id).addEventListener("change", () => {
      updateReportFilename();
      invalidateWeeklyPreview();
    });
  });
}

function prettyDateRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startDate} – ${endDate}`;
  const startText = start.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC"
  });
  const endText = end.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC"
  });
  return `${startText} – ${endText}`;
}

function printableCell(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value);
}

function renderWeeklyPreview(data) {
  const records = Array.isArray(data.records) ? data.records : [];
  const headerCells = (data.headers || []).map((header) => `<th scope="col">${safe(header)}</th>`).join("");
  const rows = records.map((record) => {
    const values = [
      record.date,
      record.timeIn,
      record.timeOut,
      record.actualHours,
      record.creditedHours,
      record.status,
      record.remarks,
      record.lastUpdated,
      record.overtime
    ];
    return `<tr>${values.map((value, index) => `<td class="dtr-col-${index + 1}">${safe(printableCell(value))}</td>`).join("")}</tr>`;
  }).join("");

  const table = `<div class="dtr-export-sheet"><table class="dtr-preview-table"><thead><tr>${headerCells}</tr></thead><tbody>${rows || `<tr><td colspan="${(data.headers || []).length || 9}" class="dtr-no-records">No attendance records found for this date range.</td></tr>`}</tbody></table></div>`;
  $("weeklyPreview").innerHTML = table;
  $("weeklyPreviewTitle").textContent = `${data.name} · ${prettyDateRange(data.startDate, data.endDate)}`;
  $("weeklyPreviewMeta").textContent = `${records.length} attendance ${records.length === 1 ? "record" : "records"} · ${reportFileStem()}`;
  const hasRecords = records.length > 0;
  $("downloadJpgBtn").disabled = !hasRecords;
  $("downloadExcelBtn").disabled = !hasRecords;
}

async function previewWeeklyReport() {
  const name = $("reportIntern").value;
  const startDate = $("reportStartDate").value;
  const endDate = $("reportEndDate").value;
  if (!name) {
    toast("Select an intern first.");
    return;
  }
  if (!startDate || !endDate) {
    toast("Choose both a start date and an end date.");
    return;
  }
  if (startDate > endDate) {
    toast("The start date must be before or equal to the end date.");
    return;
  }

  const button = $("previewReportBtn");
  const originalText = button.textContent;
  const criteriaKey = currentWeeklyCriteriaKey();
  button.disabled = true;
  button.textContent = "Loading preview…";
  $("weeklyPreview").setAttribute("aria-busy", "true");
  $("weeklyPreview").innerHTML = '<div class="preview-placeholder">Loading the selected intern\'s attendance records…</div>';

  try {
    const data = await callApi({
      action: "weeklyReport",
      pin: state.pin,
      name,
      startDate,
      endDate
    });
    if (!data.ok) throw new Error(data.message || "Unable to load the weekly report.");
    if (criteriaKey !== currentWeeklyCriteriaKey()) return;

    weeklyReportData = data;
    weeklyReportKey = criteriaKey;
    renderWeeklyPreview(data);
    toast(data.records && data.records.length ? "Weekly DTR preview is ready." : "No attendance records found for that range.");
  } catch (error) {
    weeklyReportData = null;
    weeklyReportKey = "";
    $("weeklyPreviewTitle").textContent = "Could not load preview";
    $("weeklyPreviewMeta").textContent = "Request failed";
    $("weeklyPreview").innerHTML = `<div class="preview-placeholder"><strong>Unable to load this report.</strong><br>${safe(error.message || "Check the connection and try again.")}</div>`;
    $("downloadJpgBtn").disabled = true;
    $("downloadExcelBtn").disabled = true;
    toast(error.message || "Unable to load the weekly report.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
    $("weeklyPreview").setAttribute("aria-busy", "false");
  }
}

function assertWeeklyReportIsCurrent() {
  if (!weeklyReportData || weeklyReportKey !== currentWeeklyCriteriaKey()) {
    toast("Preview the selected intern and date range first.");
    return false;
  }
  if (!Array.isArray(weeklyReportData.records) || weeklyReportData.records.length === 0) {
    toast("There are no attendance records to download.");
    return false;
  }
  return true;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function downloadWeeklyJpg() {
  if (!assertWeeklyReportIsCurrent()) return;
  if (typeof window.html2canvas !== "function") {
    toast("The JPG export library did not load. Check your internet connection and reload the page.");
    return;
  }

  const button = $("downloadJpgBtn");
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Preparing JPG…";
  try {
    const target = document.querySelector(".dtr-export-sheet");
    const canvas = await window.html2canvas(target, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(document.documentElement.clientWidth, target.scrollWidth)
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.96));
    if (!blob) throw new Error("The JPG image could not be created. Please try again.");
    downloadBlob(blob, `${reportFileStem()}.jpg`);
    toast(`Downloaded ${reportFileStem()}.jpg`);
  } catch (error) {
    toast(error.message || "Could not create the JPG file.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function downloadWeeklyExcel() {
  if (!assertWeeklyReportIsCurrent()) return;
  if (!window.XLSX) {
    toast("The Excel export library did not load. Check your internet connection and reload the page.");
    return;
  }

  const data = weeklyReportData;
  const records = data.records;
  const worksheetRows = [data.headers || ["Date", "Time In", "Time Out", "Actual Hours", "Credited Hours", "Status", "Remarks", "Last Updated", "Overtime"]];
  records.forEach((record) => {
    worksheetRows.push([
      record.date || "",
      record.timeIn || "",
      record.timeOut || "",
      record.actualHours === "" || record.actualHours === null ? "" : Number(record.actualHours),
      record.creditedHours === "" || record.creditedHours === null ? "" : Number(record.creditedHours),
      record.status || "",
      record.remarks || "",
      record.lastUpdated || "",
      record.overtime === "" || record.overtime === null ? "" : Number(record.overtime)
    ]);
  });

  const worksheet = window.XLSX.utils.aoa_to_sheet(worksheetRows);
  worksheet["!cols"] = [
    { wch: 13 }, { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 16 },
    { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 12 }
  ];
  if (worksheet["!ref"]) {
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    const range = window.XLSX.utils.decode_range(worksheet["!ref"]);
    for (let row = 1; row <= range.e.r; row++) {
      [3, 4, 8].forEach((columnIndex) => {
        const cellAddress = window.XLSX.utils.encode_cell({ r: row, c: columnIndex });
        const cell = worksheet[cellAddress];
        if (!cell || typeof cell.v !== "number") return;
        cell.z = columnIndex === 3 ? "0.#########" : "0.##";
      });
    }
  }
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly DTR");
  window.XLSX.writeFile(workbook, `${reportFileStem()}.xlsx`);
  toast(`Downloaded ${reportFileStem()}.xlsx`);
}

function statusClass(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "complete") return "success";
  if (normalized === "late") return "warning";
  if (normalized === "early out" || normalized === "incomplete" || normalized === "absent") return "danger";
  if (normalized === "in progress" || normalized === "present" || normalized === "on duty") return "info";
  return "";
}

function todayText() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function safe(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function logout() {
  state.name = "";
  state.pin = "";
  state.mode = "";
  supervisorInterns = [];
  isRefreshingSupervisor = false;
  if ($("internSearch")) $("internSearch").value = "";
  if ($("statusFilter")) $("statusFilter").innerHTML = '<option value="all">All statuses</option>';
  if ($("lastUpdated")) $("lastUpdated").textContent = "Not refreshed yet";
  weeklyReportData = null;
  weeklyReportKey = "";
  if ($("downloadJpgBtn")) $("downloadJpgBtn").disabled = true;
  if ($("downloadExcelBtn")) $("downloadExcelBtn").disabled = true;

  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.add("hidden");
  });

  $("loginScreen").classList.remove("hidden");
  $("pin").value = "";
}

$("loginBtn").addEventListener("click", login);
$("supervisorBtn").addEventListener("click", openSupervisor);
$("timeInBtn").addEventListener("click", () => punch("timeIn"));
$("timeOutBtn").addEventListener("click", () => punch("timeOut"));
$("logoutBtn").addEventListener("click", logout);
$("adminLogoutBtn").addEventListener("click", logout);
$("refreshBtn").addEventListener("click", refreshSupervisor);
$("internSearch").addEventListener("input", renderSupervisorTable);
$("statusFilter").addEventListener("change", renderSupervisorTable);
$("exportBtn").addEventListener("click", exportCsv);
$("previewReportBtn").addEventListener("click", previewWeeklyReport);
$("downloadJpgBtn").addEventListener("click", downloadWeeklyJpg);
$("downloadExcelBtn").addEventListener("click", downloadWeeklyExcel);

initializeWeeklyReportControls();
loadNames();
