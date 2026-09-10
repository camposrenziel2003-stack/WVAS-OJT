// Put the deployed Google Apps Script Web App URL here.
const API_URL = "/api/attendance";

const state = {
  name: "",
  pin: "",
  mode: ""
};

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

loadNames();
