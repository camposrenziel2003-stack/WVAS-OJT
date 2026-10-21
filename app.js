// Put the deployed Google Apps Script Web App URL here.
const API_URL = "/api/attendance";

const state = {
  name: "",
  pin: "",
  mode: ""
};

// Weekly DTR export state. October 12–17, 2026 is the supplied Week 6 example.
const REPORT_WEEK_ANCHOR_DATE = "2026-10-12";
const REPORT_WEEK_ANCHOR_NUMBER = 6;
let weeklyReportData = null;
let weeklyReportKey = "";

const $ = (id) => document.getElementById(id);

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 2800);
}

async function callApi(params) {
  const query = new URLSearchParams(params);
  let response;

  try {
    response = await fetch(`${API_URL}?${query.toString()}`, {
      method: "GET",
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });
  } catch (_) {
    throw new Error("Cannot reach the attendance API. Check the existing Netlify /api/attendance connection.");
  }

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (_) {
    throw new Error("The attendance API did not return JSON. Check the existing backend connection and Apps Script deployment.");
  }

  if (!response.ok) {
    throw new Error(data.message || `Attendance server returned ${response.status}.`);
  }

  return data;
}

async function loadNames() {
  const nameSelect = $("name");
  nameSelect.innerHTML = '<option value="">Connecting to attendance backend…</option>';

  try {
    const data = await callApi({ action: "config" });
    if (!data.ok || !Array.isArray(data.interns)) {
      throw new Error(data.message || "The backend did not return the intern list.");
    }

    nameSelect.innerHTML = '<option value="">Select your name</option>';
    data.interns.forEach((intern) => {
      const option = document.createElement("option");
      option.value = intern;
      option.textContent = intern;
      nameSelect.appendChild(option);
    });
  } catch (error) {
    nameSelect.innerHTML = '<option value="">Unable to connect to backend</option>';
    toast(error.message || "Could not load interns.");
    console.error("Attendance backend connection failed:", error);
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
  $("teamTable").innerHTML = "<p class=\"small-note\">Loading attendance…</p>";
  const data = await callApi({
    action: "adminSummary",
    pin: state.pin
  });

  if (!data.ok) {
    toast(data.message);
    return;
  }

  $("teamHours").textContent = Number(data.teamHours).toFixed(2);
  $("teamPresent").textContent = `${data.todayPresent}/${data.internCount}`;

  const reportSelect = $("reportIntern");
  const currentReportName = reportSelect.value;
  reportSelect.innerHTML = '<option value="">Select an intern</option>';

  data.interns.forEach((intern) => {
    const option = document.createElement("option");
    option.value = intern.name;
    option.textContent = intern.name;
    reportSelect.appendChild(option);
  });

  if (data.interns.some((intern) => intern.name === currentReportName)) {
    reportSelect.value = currentReportName;
  }

  const rows = data.interns.map((intern) => `
    <tr>
      <td><strong>${safe(intern.name)}</strong></td>
      <td>${safe(intern.timeIn || "—")}</td>
      <td>${safe(intern.timeOut || "—")}</td>
      <td>${Number(intern.todayHours || 0).toFixed(2)}</td>
      <td>${Number(intern.totalHours || 0).toFixed(2)}</td>
      <td>${Number(intern.remainingHours || 0).toFixed(2)}</td>
      <td>${safe(intern.status || "No Record")}</td>
    </tr>
  `).join("");

  $("teamTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Intern</th>
          <th>Time In</th>
          <th>Time Out</th>
          <th>Today</th>
          <th>Total</th>
          <th>Remaining</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
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

async function exportIndividualReport() {
  const name = $("reportIntern").value;

  if (!name) {
    toast("Select an intern first.");
    return;
  }

  try {
    const data = await callApi({
      action: "individualReport",
      pin: state.pin,
      name
    });

    if (!data.ok) throw new Error(data.message);

    const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name.replace(/[^a-z0-9]+/gi, "_")}_Attendance_Report.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    toast(`Report generated for ${name}.`);
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
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const deltaWeeks = Math.round((selectedMonday.getTime() - anchorMonday.getTime()) / weekMs);
  return Math.max(1, REPORT_WEEK_ANCHOR_NUMBER + deltaWeeks);
}

function reportSurname(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts[parts.length - 1] : "LastName").replace(/[^a-z0-9-]/gi, "") || "LastName";
}

function reportFileStem() {
  const name = $("reportIntern").value;
  const startDate = $("reportStartDate").value;
  return name && startDate ? `W${reportWeekNumber(startDate)}_${reportSurname(name)}` : "W#_LastName";
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
  $("weeklyPreview").innerHTML = '<div class="weekly-dtr-placeholder">Your selection changed. Click <strong>Preview DTR</strong> to reload records.</div>';
  $("weeklyPreview").setAttribute("aria-busy", "false");
}

function initializeWeeklyReportControls() {
  // Default to the most recently completed Monday–Saturday work week.
  const today = new Date();
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const monday = new Date(thisMonday);
  monday.setDate(thisMonday.getDate() - 7);
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
  const opts = { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" };
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startDate} – ${endDate}`;
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

function renderWeeklyPreview(data) {
  const records = Array.isArray(data.records) ? data.records : [];
  const headers = Array.isArray(data.headers) ? data.headers : [
    "Date", "Time In", "Time Out", "Actual Hours", "Credited Hours", "Status", "Remarks", "Last Updated", "Overtime"
  ];
  const headerCells = headers.map((header) => `<th>${safe(header)}</th>`).join("");
  const rows = records.map((record) => {
    const values = [record.date, record.timeIn, record.timeOut, record.actualHours,
      record.creditedHours, record.status, record.remarks, record.lastUpdated, record.overtime];
    return `<tr>${values.map((value) => `<td>${safe(value == null ? "" : value)}</td>`).join("")}</tr>`;
  }).join("");
  const table = `<div class="weekly-dtr-sheet"><table class="weekly-dtr-table"><thead><tr>${headerCells}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="no-records">No attendance records found for this date range.</td></tr>`}</tbody></table></div>`;
  $("weeklyPreview").innerHTML = table;
  $("weeklyPreviewTitle").textContent = `${data.name} · ${prettyDateRange(data.startDate, data.endDate)}`;
  $("weeklyPreviewMeta").textContent = `${records.length} record${records.length === 1 ? "" : "s"} · ${reportFileStem()}`;
  $("downloadJpgBtn").disabled = records.length === 0;
  $("downloadExcelBtn").disabled = records.length === 0;
}

async function previewWeeklyReport() {
  const name = $("reportIntern").value;
  const startDate = $("reportStartDate").value;
  const endDate = $("reportEndDate").value;
  if (!name) return toast("Select an intern first.");
  if (!startDate || !endDate) return toast("Choose both a start date and end date.");
  if (startDate > endDate) return toast("The start date must be before or equal to the end date.");

  const button = $("previewReportBtn");
  const originalText = button.textContent;
  const criteriaKey = currentWeeklyCriteriaKey();
  button.disabled = true;
  button.textContent = "Loading preview…";
  $("weeklyPreview").setAttribute("aria-busy", "true");
  $("weeklyPreview").innerHTML = '<div class="weekly-dtr-placeholder">Loading attendance records…</div>';

  try {
    const data = await callApi({ action: "weeklyReport", pin: state.pin, name, startDate, endDate });
    if (!data.ok) throw new Error(data.message || "Unable to load the weekly DTR.");
    if (criteriaKey !== currentWeeklyCriteriaKey()) return;
    weeklyReportData = data;
    weeklyReportKey = criteriaKey;
    renderWeeklyPreview(data);
    toast(data.records && data.records.length ? "Weekly DTR preview is ready." : "No records found for that date range.");
  } catch (error) {
    weeklyReportData = null;
    weeklyReportKey = "";
    $("weeklyPreviewTitle").textContent = "Could not load preview";
    $("weeklyPreviewMeta").textContent = "Request failed";
    $("weeklyPreview").innerHTML = `<div class="weekly-dtr-placeholder"><strong>Unable to load this report.</strong><br>${safe(error.message || "Check the backend connection.")}</div>`;
    $("downloadJpgBtn").disabled = true;
    $("downloadExcelBtn").disabled = true;
    toast(error.message || "Unable to load weekly DTR.");
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
  if (typeof window.html2canvas !== "function") return toast("JPG library did not load. Reload the page and try again.");
  const button = $("downloadJpgBtn");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing JPG…";
  try {
    const target = document.querySelector(".weekly-dtr-sheet");
    const canvas = await window.html2canvas(target, {
      scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false,
      scrollX: 0, scrollY: 0,
      width: target.scrollWidth, height: target.scrollHeight,
      windowWidth: Math.max(document.documentElement.clientWidth, target.scrollWidth),
      windowHeight: Math.max(window.innerHeight, target.scrollHeight)
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.96));
    if (!blob) throw new Error("Could not create the JPG file.");
    downloadBlob(blob, `${reportFileStem()}.jpg`);
    toast(`Downloaded ${reportFileStem()}.jpg`);
  } catch (error) {
    toast(error.message || "Could not create JPG.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function downloadWeeklyExcel() {
  if (!assertWeeklyReportIsCurrent()) return;
  if (!window.XLSX) return toast("Excel library did not load. Reload the page and try again.");

  try {
    const data = weeklyReportData;
    const rows = [data.headers];
    data.records.forEach((r) => rows.push([
      r.date || "", r.timeIn || "", r.timeOut || "",
      r.actualHours === "" || r.actualHours == null ? "" : Number(r.actualHours),
      r.creditedHours === "" || r.creditedHours == null ? "" : Number(r.creditedHours),
      r.status || "", r.remarks || "", r.lastUpdated || "",
      r.overtime === "" || r.overtime == null ? "" : Number(r.overtime)
    ]));
    const worksheet = window.XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [{wch:13},{wch:17},{wch:17},{wch:16},{wch:16},{wch:14},{wch:24},{wch:22},{wch:12}];
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly DTR");
    window.XLSX.writeFile(workbook, `${reportFileStem()}.xlsx`);
    toast(`Downloaded ${reportFileStem()}.xlsx`);
  } catch (error) {
    toast(error.message || "Could not create the Excel file.");
  }
}

function statusClass(status) {
  if (status === "Complete") return "success";
  if (status === "Late") return "warning";
  if (status === "Early Out" || status === "Incomplete") return "danger";
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
$("exportBtn").addEventListener("click", exportCsv);
$("individualReportBtn").addEventListener("click", exportIndividualReport);
$("previewReportBtn").addEventListener("click", previewWeeklyReport);
$("downloadJpgBtn").addEventListener("click", downloadWeeklyJpg);
$("downloadExcelBtn").addEventListener("click", downloadWeeklyExcel);

initializeWeeklyReportControls();
loadNames();
