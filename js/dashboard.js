/* =====================================================
   dashboard.js — Madhur Digitals Analytics Dashboard
   ===================================================== */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min cache

let allSchoolsData  = {};
let allStudentsData = {};
let filteredSchool  = "all";
let chartInstances  = {};

const userRole        = getRole();
const userPermissions = getPermissions();
const accessibleNames = getAccessibleSchoolNames();
const username        = sessionStorage.getItem("username") || "";

// ── INIT ──
document.addEventListener("DOMContentLoaded", async () => {
  renderWelcome();
  filterActionCards();
  showSkeletons();
  await loadDashboardData();
});

// ── WELCOME ──
function renderWelcome() {
  const el = document.getElementById("welcomeUser");
  if (el) el.innerHTML = `
    <span class="welcome-name">👤 ${username}</span>
    <span class="welcome-role">${userRole}</span>
  `;

  const denied = sessionStorage.getItem("accessDenied");
  if (denied) {
    const notice = document.getElementById("accessNotice");
    if (notice) {
      notice.innerText = `⚠️ You don't have permission to access: ${denied}`;
      notice.style.display = "block";
      sessionStorage.removeItem("accessDenied");
    }
  }
}

// ── FILTER ACTION CARDS BY PERMISSION ──
function filterActionCards() {
  document.querySelectorAll(".action-card[data-permission]").forEach(card => {
    const perm = card.getAttribute("data-permission");
    if (!userPermissions.includes(perm)) {
      card.style.display = "none";
    }
  });

  // Hide Top Data Operators chart for non-admins
  const operatorsChart = document.getElementById("chartAddedByCard");
  if (operatorsChart && userRole !== "admin") {
    operatorsChart.style.display = "none";
  }

  // Hide schools KPI for school users
  if (userRole === "school") {
    const schoolKpi = document.getElementById("kpiSchoolCard");
    if (schoolKpi) schoolKpi.style.display = "none";

    // Hide school filter
    const filterWrap = document.getElementById("schoolFilterWrap");
    if (filterWrap) filterWrap.style.display = "none";
  }
}

// ── DATA LOADING ──
async function loadDashboardData() {
  try {
    const raw     = await getSchools();
    const headers = raw[0];
    const schools = raw.slice(1).map(r => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    });

    // Filter by accessible schools
    let visibleSchools = schools;
    if (accessibleNames !== "*") {
      visibleSchools = schools.filter(s => accessibleNames.includes(s.school));
    }

    allSchoolsData = visibleSchools;

    populateSchoolFilter(visibleSchools);

    // Load all in parallel
    await Promise.all(visibleSchools.map(s => loadSchoolStudents(s.school)));

    renderDashboard();

  } catch (err) {
    console.error("Dashboard load error:", err);
    showError("Failed to load dashboard. Please refresh.");
  }
}

async function loadSchoolStudents(schoolCode) {
  const cacheKey = `dashCache_${schoolCode}`;
  const cached   = sessionStorage.getItem(cacheKey);

  if (cached) {
    try {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL_MS) {
        allStudentsData[schoolCode] = data;
        return;
      }
    } catch {}
  }

  try {
    const raw = await getStudents(schoolCode);
    if (!raw || raw.length < 2) { allStudentsData[schoolCode] = []; return; }

    const hdrs     = raw[0];
    const students = raw.slice(1).map(r => {
      let obj = {};
      hdrs.forEach((h, i) => obj[h] = r[i]);
      return obj;
    });

    allStudentsData[schoolCode] = students;
    sessionStorage.setItem(cacheKey, JSON.stringify({ data: students, ts: Date.now() }));

  } catch {
    allStudentsData[schoolCode] = [];
  }
}

function getCurrentStudents() {
  if (filteredSchool === "all") return Object.values(allStudentsData).flat();
  return allStudentsData[filteredSchool] || [];
}

// ── RENDER ──
function renderDashboard() {
  hideSkeletons();
  renderKPIs();
  renderCharts();
  renderLastUpdated();
}

// ── KPIs ──
function renderKPIs() {
  const students = getCurrentStudents();

  animateCount("kpiStudents", students.length);
  animateCount("kpiSchools",  allSchoolsData.length);
  animateCount("kpiThisMonth", getThisMonthCount(students));

  const uniqueClasses = new Set(
    students.map(s => (s.Class || "").toString().trim()).filter(Boolean)
  );
  animateCount("kpiClasses", uniqueClasses.size);
}

function getThisMonthCount(students) {
  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();

  return students.filter(s => {
    const ts = s.Timestamp || s.timestamp || "";
    if (!ts) return false;
    try {
      const [datePart] = ts.split(" ");
      const parts = datePart.split("/");
      const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      return d.getMonth() === month && d.getFullYear() === year;
    } catch { return false; }
  }).length;
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const steps = 40;
  const step  = Math.ceil(target / steps) || 1;
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.innerText = current.toLocaleString();
    if (current >= target) clearInterval(timer);
  }, 1000 / steps);
}

// ── CHARTS ──
function renderCharts() {
  const students = getCurrentStudents();
  renderSchoolBarChart();
  renderMonthlyLineChart(students);
  if (userRole === "admin") renderAddedByChart(students);
}

// Chart 1 — Students per School
function renderSchoolBarChart() {
  const canvas = document.getElementById("chartSchoolBar");
  if (!canvas) return;

  let labels, counts;

  if (filteredSchool !== "all") {
    // Single school — show class distribution
    const students = getCurrentStudents();
    const groups = {};
    students.forEach(s => {
      const cls = (s.Class || "Unknown").toString().trim();
      const sec = (s.Section || "").toString().trim();
      const key = sec ? `${cls}-${sec}` : cls;
      groups[key] = (groups[key] || 0) + 1;
    });
    const sorted = Object.entries(groups).sort((a, b) =>
      (parseInt(a[0]) || 999) - (parseInt(b[0]) || 999)
    );
    labels = sorted.map(([k]) => k);
    counts = sorted.map(([, v]) => v);
    document.getElementById("chartSchoolBarTitle").innerText = "Students by Class";
  } else {
    labels = allSchoolsData.map(s => s.school_name || s.school);
    counts = allSchoolsData.map(s => (allStudentsData[s.school] || []).length);
    document.getElementById("chartSchoolBarTitle").innerText = "Students per School";
  }

  const colors = generateColors(labels.length);

  if (chartInstances.schoolBar) chartInstances.schoolBar.destroy();

  chartInstances.schoolBar = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data:            counts,
        backgroundColor: colors.map(c => c + "cc"),
        borderColor:     colors,
        borderWidth:     2,
        borderRadius:    6,
        borderSkipped:   false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} students` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: "#f1f5f9" }, beginAtZero: true, ticks: { stepSize: 1 } }
      },
      animation: { duration: 900, easing: "easeOutQuart" }
    }
  });
}

// Chart 2 — Monthly Growth
function renderMonthlyLineChart(students) {
  const canvas = document.getElementById("chartMonthly");
  if (!canvas) return;

  const now    = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
      month: d.getMonth(),
      year:  d.getFullYear(),
      count: 0
    });
  }

  students.forEach(s => {
    const ts = s.Timestamp || s.timestamp || "";
    if (!ts) return;
    try {
      const [datePart] = ts.split(" ");
      const parts = datePart.split("/");
      const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      const bucket = months.find(m => m.month === d.getMonth() && m.year === d.getFullYear());
      if (bucket) bucket.count++;
    } catch {}
  });

  if (chartInstances.monthly) chartInstances.monthly.destroy();

  chartInstances.monthly = new Chart(canvas, {
    type: "line",
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label:                "Students Added",
        data:                 months.map(m => m.count),
        borderColor:          "#0d6efd",
        backgroundColor:      "rgba(13,110,253,0.08)",
        borderWidth:          2.5,
        pointBackgroundColor: "#0d6efd",
        pointBorderColor:     "#fff",
        pointBorderWidth:     2,
        pointRadius:          5,
        pointHoverRadius:     7,
        fill:                 true,
        tension:              0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} students added` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: "#f1f5f9" }, beginAtZero: true, ticks: { stepSize: 1 } }
      },
      animation: { duration: 1000 }
    }
  });
}

// Chart 3 — Top Data Operators (admin only, count inside bar)
function renderAddedByChart(students) {
  const canvas = document.getElementById("chartAddedBy");
  if (!canvas) return;

  const groups = {};
  students.forEach(s => {
    const by = (s.Added_By || "").trim();
    if (by) groups[by] = (groups[by] || 0) + 1;
  });

  if (!Object.keys(groups).length) {
    document.getElementById("chartAddedByCard").style.display = "none";
    return;
  }

  const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = sorted.map(([k]) => k);
  const counts = sorted.map(([, v]) => v);
  const colors = generateColors(labels.length);

  if (chartInstances.addedBy) chartInstances.addedBy.destroy();

  chartInstances.addedBy = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data:            counts,
        backgroundColor: colors.map(c => c + "cc"),
        borderColor:     colors,
        borderWidth:     2,
        borderRadius:    6,
        borderSkipped:   false
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        // Count label inside bar
        datalabels: false,
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} students` } }
      },
      scales: {
        x: {
          grid: { color: "#f1f5f9" },
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 11 } }
        },
        y: { grid: { display: false }, ticks: { font: { size: 12, weight: "600" } } }
      },
      animation: { duration: 900 },
      // Draw count inside bar using afterDraw plugin
      layout: { padding: { right: 10 } }
    },
    plugins: [{
      id: "barLabels",
      afterDraw(chart) {
        const ctx2 = chart.ctx;
        chart.data.datasets.forEach((dataset, i) => {
          const meta = chart.getDatasetMeta(i);
          meta.data.forEach((bar, idx) => {
            const value = dataset.data[idx];
            const { x, y } = bar.tooltipPosition();
            ctx2.save();
            ctx2.fillStyle   = "#fff";
            ctx2.font        = "bold 11px 'Plus Jakarta Sans', sans-serif";
            ctx2.textAlign   = "center";
            ctx2.textBaseline = "middle";
            // Only show if bar wide enough
            if (bar.width > 30) {
              ctx2.fillText(value, x - bar.width / 2 + 24, y);
            }
            ctx2.restore();
          });
        });
      }
    }]
  });
}

// ── SCHOOL FILTER ──
function populateSchoolFilter(schools) {
  const sel = document.getElementById("schoolFilterSelect");
  if (!sel) return;

  sel.innerHTML = `<option value="all">🏫 All Schools</option>`;
  schools.forEach(s => {
    sel.innerHTML += `<option value="${s.school}">${s.school_name || s.school}</option>`;
  });

  sel.addEventListener("change", async () => {
    filteredSchool = sel.value;
    showSkeletons();
    await new Promise(r => setTimeout(r, 80));
    renderDashboard();
  });
}

// ── SCHOOL SELECTOR POPUP ──
let mode = "";

async function loadSchoolsForPopup(selectedMode) {
  const raw     = await getSchools();
  const headers = raw[0];
  let schools   = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  if (accessibleNames !== "*") {
    schools = schools.filter(s => accessibleNames.includes(s.school));
  }

  const dropdown = document.getElementById("schoolSelect");
  dropdown.innerHTML = `<option value="">Select School</option>`;

  if (selectedMode === "form") {
    dropdown.innerHTML += `<option value="__other__">Other School (Generate form for new school)</option>`;
  }

  dropdown.innerHTML += schools.map(s =>
    `<option value="${s.school}" data-id="${s.school_id}">${s.school_name}</option>`
  ).join("");

  if (schools.length === 1) dropdown.value = schools[0].school;
}

function showSchoolSelector(selectedMode) {
  mode = selectedMode;
  document.getElementById("schoolSelect").innerHTML = `<option value="">Loading...</option>`;
  document.getElementById("schoolBox").style.display  = "block";
  document.getElementById("overlay").style.display    = "block";
  loadSchoolsForPopup(selectedMode);
}

function continueAction() {
  const dropdown       = document.getElementById("schoolSelect");
  const selectedOption = dropdown.options[dropdown.selectedIndex];
  const selectedValue  = selectedOption.value;

  if (selectedValue === "__other__") { showCustomSchoolPopup(); return; }
  if (!selectedValue) { alert("Please select a school"); return; }

  sessionStorage.setItem("school",      selectedValue);
  sessionStorage.setItem("school_id",   selectedOption.getAttribute("data-id"));
  sessionStorage.setItem("school_name", selectedOption.textContent.trim());

  const routes = {
    add: "add_student.html", manage: "manage_student.html",
    print: "print_student.html", bulk: "bulk_upload.html",
    form: "school_form.html", export: "export_student.html"
  };
  if (routes[mode]) window.location.href = routes[mode];
}

function hideAllPopups() {
  document.getElementById("schoolBox").style.display         = "none";
  document.getElementById("customSchoolPopup").style.display = "none";
  document.getElementById("overlay").style.display           = "none";
  mode = "";
}

document.addEventListener("keydown", e => { if (e.key === "Escape") hideAllPopups(); });
document.addEventListener("click", function(e) {
  const sb = document.getElementById("schoolBox");
  const cb = document.getElementById("customSchoolPopup");
  if (!sb || !cb) return;
  if (sb.contains(e.target) || cb.contains(e.target) || e.target.closest(".action-card")) return;
  if (sb.style.display === "block" || cb.style.display === "block") hideAllPopups();
});

window.addEventListener("pageshow", hideAllPopups);
window.onload = hideAllPopups;
window.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.addEventListener("click", hideAllPopups);
});

function showCustomSchoolPopup() {
  document.getElementById("schoolBox").style.display         = "none";
  document.getElementById("customSchoolPopup").style.display = "block";
  document.getElementById("overlay").style.display           = "block";
}

function handleTypeChange() {
  const type = document.getElementById("cs_type").value;
  document.getElementById("cs_custom_title").style.display = type === "other" ? "block" : "none";
}

function submitCustomSchool() {
  const name = document.getElementById("cs_name").value.trim();
  if (!name) { alert("School name is required"); return; }
  const type = document.getElementById("cs_type").value;
  let title  = "STUDENT ID CARD FORM";
  if (type === "teacher") title = "TEACHER ID CARD FORM";
  else if (type === "other") title = document.getElementById("cs_custom_title").value.trim() || "CUSTOM FORM";
  sessionStorage.setItem("custom_school", JSON.stringify({
    school_name: name, address: document.getElementById("cs_address").value.trim(),
    contact: document.getElementById("cs_contact").value.trim(),
    session: document.getElementById("cs_session").value.trim(),
    form_title: title, isCustom: true
  }));
  window.location.href = "school_form.html";
}

// ── SKELETON / ERROR ──
function showSkeletons() {
  document.querySelectorAll(".kpi-value").forEach(el => {
    el.innerHTML = `<span class="skeleton skeleton-text"></span>`;
  });
}

function hideSkeletons() {
  // Values replaced by animateCount
}

function showError(msg) {
  const el = document.getElementById("accessNotice");
  if (el) {
    el.innerText = msg;
    el.style.display = "block";
    el.style.background = "#fee2e2";
    el.style.borderColor = "#dc2626";
    el.style.color = "#991b1b";
  }
}

function renderLastUpdated() {
  const el = document.getElementById("lastUpdated");
  if (el) el.innerText = `Updated ${new Date().toLocaleTimeString()}`;
}

function generateColors(n) {
  const palette = [
    "#0d6efd","#10b981","#f59e0b","#ef4444","#8b5cf6",
    "#06b6d4","#f97316","#ec4899","#14b8a6","#6366f1",
    "#84cc16","#e11d48","#0891b2","#7c3aed","#059669"
  ];
  return Array.from({ length: n }, (_, i) => palette[i % palette.length]);
}
