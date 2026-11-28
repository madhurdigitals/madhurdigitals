/* =====================================================
   dashboard.js — Madhur Digitals Dashboard
   P1b (redesign): new look, same data. The data code (DS1 counts, the old-way fallback,
   the school popup) is DS1.1's, unchanged except: Refresh asks for a fresh school list,
   a one-school login never chooses a school, and a school login gets no "Other school".
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

// display settings (no data)
let dashMonths   = 6;
let dashShowAll  = false;
const dashTables = { month: false, class: false };
let dashUpdatedAt = null, dashFirstPaint = true;
const DASH_LIST_LIMIT = 8;
const REDUCE_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// class order for charts (the promotion ladder; any other class name comes after, A-Z)
const CLASS_LADDER = ["playway", "nursery", "lkg", "ukg", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

// ── INIT ──
document.addEventListener("DOMContentLoaded", async () => {
  renderWelcome();
  filterActionCards();
  wireDashboard();
  showSkeletons();
  await loadDashboardData();
  openPickedFromMenu();
  setInterval(renderLastUpdated, 30000);
});

function escHtml(t) {
  return String(t === undefined || t === null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const fmtNum = n => Number(n || 0).toLocaleString("en-IN");

// the one school of a one-school login (any role), else null
function oneSchool() {
  return Array.isArray(allSchoolsData) && allSchoolsData.length === 1 ? allSchoolsData[0] : null;
}

// ── WELCOME ──
function renderWelcome() {
  const el = document.getElementById("welcomeUser");
  const h = new Date().getHours();
  const hello = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  if (el) el.textContent = username ? `${hello}, ${username}` : hello;

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

// ── FILTER ACTION CARDS BY PERMISSION ── (same rules as before; panels with nothing left are hidden)
function filterActionCards() {
  document.querySelectorAll(".action-card[data-permission]").forEach(card => {
    const perms = card.getAttribute("data-permission").split("|");   // any one is enough
    if (!perms.some(p => userPermissions.includes(p))) {
      card.style.display = "none";
    }
  });

  // Cards for one role only (e.g. Manage Vendors = super admin), whatever permissions others have
  document.querySelectorAll(".action-card[data-role]").forEach(card => {
    if (card.getAttribute("data-role") !== userRole) {
      card.style.display = "none";
    }
  });

  // the Manage list hides a row with its card; a panel with no cards left is hidden
  document.querySelectorAll(".md-navlist .action-card").forEach(card => {
    if (card.style.display === "none" && card.parentElement) card.parentElement.style.display = "none";
  });
  const anyShown = sel => [...document.querySelectorAll(sel + " .action-card")].some(c => c.style.display !== "none");
  const qa = document.getElementById("qaPanel"), mg = document.getElementById("managePanel");
  if (qa && !anyShown("#qaPanel")) qa.style.display = "none";
  if (mg && !anyShown("#managePanel")) {
    mg.style.display = "none";
    const row = document.getElementById("dashRow2"); if (row) row.classList.add("is-full");
  }

  // Hide Top Data Operators for non-admins (the server sends those counts to admins only)
  const operatorsChart = document.getElementById("chartAddedByCard");
  if (operatorsChart && userRole !== "admin") {
    operatorsChart.style.display = "none";
    const row = document.getElementById("dashRow1"); if (row) row.classList.add("is-full");
  }
}

// ── DATA LOADING ──
async function loadDashboardData(fresh) {          // P1b: fresh = Refresh button (a new school list too)
  try {
    const raw     = await getSchools(fresh === true);
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

    // DS1: counts only - one small request, no student details. An older server: the old way (all in parallel).
    const stats = await loadDashboardStats();
    if (stats) {
      clearOldDashCache();
      visibleSchools.forEach(s => { allStudentsData[s.school] = studentsFromStats(stats[String(s.school)]); });
    } else {
      await Promise.all(visibleSchools.map(s => loadSchoolStudents(s.school)));
    }

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

/* ── DS1: DASHBOARD COUNTS ──
   The server sends counts only: per school the students in school, how many per class-section (in the order
   they appear), per month added, and - for admins - per "Added_By". studentsFromStats() turns them into one
   small placeholder per student carrying only Class / Section / Timestamp / Added_By, so every count and
   chart below works exactly as before. No names, phones or other details ever reach this page. */
async function loadDashboardStats() {
  const got = {};
  let start = 0, rounds = 0;
  while (start !== null && rounds < 50) {
    rounds++;
    const res = await apiGet({ action: "getDashboardStats", start: String(start) });
    if (!res || res.status !== "success" || !Array.isArray(res.schools)) return null;   // older server -> old way
    res.schools.forEach(s => { got[String(s.school)] = s; });
    const next = res.next_start === null || res.next_start === undefined ? null : Number(res.next_start);
    if (next !== null && !(next > start)) return null;                                 // no progress: old way
    start = next;
  }
  return start === null ? got : null;
}

function studentsFromStats(st) {
  if (!st) return [];
  const out = [];
  (st.cs || []).forEach(([cls, sec, n]) => { for (let i = 0; i < n; i++) out.push({ Class: cls, Section: sec, Timestamp: "", Added_By: "" }); });
  let k = 0;
  Object.keys(st.months || {}).forEach(key => {
    const [y, m] = key.split("-");
    for (let i = 0; i < st.months[key] && k < out.length; i++) out[k++].Timestamp = `1/${m}/${y} 00:00`;
  });
  k = 0;
  (st.by || []).forEach(([name, n]) => { for (let i = 0; i < n && k < out.length; i++) out[k++].Added_By = name; });
  return out;
}

// The old way kept every school's full student list here (up to the browser's ~5 MB) - no longer needed
function clearOldDashCache() {
  try {
    Object.keys(sessionStorage).filter(k => k.indexOf("dashCache_") === 0).forEach(k => sessionStorage.removeItem(k));
  } catch (err) { /* nothing to clear */ }
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
  dashUpdatedAt = new Date();
  renderLastUpdated();
  dashFirstPaint = false;
}

// Refresh: new numbers without reloading the page (the server forgets a school's counts whenever they change)
async function refreshDashboard() {
  const btn = document.getElementById("dashRefresh"), upd = document.getElementById("lastUpdated");
  if (!btn || btn.getAttribute("aria-busy") === "true") return;
  btn.setAttribute("aria-busy", "true"); btn.classList.add("is-loading"); btn.disabled = true;
  if (upd) upd.textContent = "Updating…";
  const keep = filteredSchool;
  allStudentsData = {};
  try {
    await loadDashboardData(true);
    const sel = document.getElementById("schoolFilterSelect");
    if (keep !== "all" && sel && [...sel.options].some(o => o.value === keep)) { sel.value = keep; filteredSchool = keep; renderDashboard(); }
  } finally {
    btn.removeAttribute("aria-busy"); btn.classList.remove("is-loading"); btn.disabled = false;
  }
}

// ── KPIs ──
function monthBuckets(students, n) {
  const now = new Date(), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ month: d.getMonth(), year: d.getFullYear(), count: 0,
               label: MONTH_NAMES[d.getMonth()] + (n > 6 || d.getMonth() === 0 ? " " + String(d.getFullYear()).slice(2) : ""),
               full: MONTH_NAMES[d.getMonth()] + " " + d.getFullYear() });
  }
  students.forEach(s => {
    const ts = s.Timestamp || s.timestamp || "";
    if (!ts) return;
    try {
      const [datePart] = ts.split(" ");
      const parts = datePart.split("/");
      const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      const bucket = out.find(m => m.month === d.getMonth() && m.year === d.getFullYear());
      if (bucket) bucket.count++;
    } catch {}
  });
  return out;
}

function classKey(c) {
  const k = String(c || "").trim().toLowerCase(), i = CLASS_LADDER.indexOf(k);
  return i === -1 ? [1, k] : [0, String(i).padStart(2, "0")];
}
function byClass(students) {
  const m = {};
  students.forEach(s => {
    const cls = (s.Class || "Unknown").toString().trim() || "Unknown", sec = (s.Section || "").toString().trim();
    if (!m[cls]) m[cls] = { n: 0, secs: {} };
    m[cls].n++; if (sec) m[cls].secs[sec] = (m[cls].secs[sec] || 0) + 1;
  });
  return Object.keys(m).sort((a, b) => { const x = classKey(a), y = classKey(b); return x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0); })
    .map(c => ({ cls: c, label: /^\d+$/.test(c) ? "Class " + c : c, n: m[c].n, secs: m[c].secs }));
}

function setNote(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html || "&nbsp;"; }

function renderKPIs() {
  const students = getCurrentStudents();
  const one = filteredSchool !== "all" || oneSchool();
  const visible = filteredSchool !== "all" ? allSchoolsData.filter(s => s.school === filteredSchool) : allSchoolsData;

  animateCount("kpiStudents", students.length);
  animateCount("kpiSchools",  allSchoolsData.length);
  animateCount("kpiThisMonth", getThisMonthCount(students));

  const uniqueClasses = new Set(
    students.map(s => (s.Class || "").toString().trim()).filter(Boolean)
  );
  animateCount("kpiClasses", uniqueClasses.size);

  // notes under the numbers
  const sections = new Set(students.map(s => (s.Class || "") + "\u0000" + (s.Section || ""))).size;
  setNote("kpiStudentsNote", one ? `<b>${fmtNum(sections)}</b> class-sections` : `In <b>${fmtNum(visible.length)}</b> ${visible.length === 1 ? "school" : "schools"}`);

  const m = monthBuckets(students, 6), cur = m[5].count, prev = m[4].count, prevName = m[4].full.split(" ")[0];
  let delta;
  if (prev > 0) {
    const p = Math.round((cur - prev) / prev * 100);
    delta = `<span class="md-delta ${p > 0 ? "md-delta--up" : p < 0 ? "md-delta--down" : ""}">${p > 0 ? "▲ " : p < 0 ? "▼ " : ""}${Math.abs(p)}%</span>vs ${prevName}`;
  } else delta = cur ? `None in ${prevName}` : "None yet this month";
  setNote("kpiThisMonthNote", delta);
  const spark = document.getElementById("kpiSpark");
  if (spark) spark.innerHTML = m.some(x => x.count) ? sparkSvg(m.map(x => x.count)) : "";

  // card 3: Schools (several) or Classes (one school); card 4: Average per school or Largest class
  const schoolCard = document.getElementById("kpiSchoolCard"), classCard = document.getElementById("kpiClassesCard");
  if (schoolCard) schoolCard.style.display = one ? "none" : "";
  if (classCard) classCard.style.display = one ? "" : "none";
  const empty = visible.filter(s => !(allStudentsData[s.school] || []).length).length;
  setNote("kpiSchoolsNote", empty ? `<b>${fmtNum(empty)}</b> with no records yet` : "All have records");
  const cls = byClass(students);
  setNote("kpiClassesNote", cls.length ? `${escHtml(cls[0].cls)} to ${escHtml(cls[cls.length - 1].cls)}` : "None yet");

  const label = document.getElementById("kpiFourthLabel"), four = document.getElementById("kpiFourth");
  if (one) {
    const cs = {}; students.forEach(s => { const k = `${(s.Class || "").toString().trim()}-${(s.Section || "").toString().trim()}`.replace(/-$/, ""); if (k) cs[k] = (cs[k] || 0) + 1; });
    const top = Object.entries(cs).sort((a, b) => b[1] - a[1])[0];
    if (label) label.textContent = "Largest class";
    if (four) { four.textContent = top ? top[0] : "–"; four.dataset.v = ""; }
    setNote("kpiFourthNote", top ? `<b>${fmtNum(top[1])}</b> students` : "No classes yet");
  } else {
    const filled = visible.length - empty;
    if (label) label.textContent = "Average per school";
    animateCount("kpiFourth", filled ? Math.round(students.length / filled) : 0);
    const big = visible.map(s => [s.school_name || s.school, (allStudentsData[s.school] || []).length]).sort((a, b) => b[1] - a[1])[0];
    setNote("kpiFourthNote", big && big[1] ? `Largest: <b>${escHtml(big[0])}</b>` : "No records yet");
  }
}

function sparkSvg(vals) {
  const max = Math.max(1, ...vals), w = 84, h = 30, step = w / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, h - 3 - (v / max) * (h - 6)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return `<svg class="md-stat__spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d} L${w} ${h} L0 ${h}Z" fill="currentColor" opacity=".12"/>` +
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="currentColor"/></svg>`;
}

// counts up from the number shown now (no animation for people who turned motion off)
function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.__mdTimer) cancelAnimationFrame(el.__mdTimer);
  const from = Number(el.dataset.v || 0);
  el.dataset.v = String(target);
  if (REDUCE_MOTION || from === target || typeof requestAnimationFrame !== "function") { el.innerText = fmtNum(target); return; }
  const t0 = Date.now(), dur = 700;
  const step = () => {
    const p = Math.min(1, (Date.now() - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.innerText = fmtNum(Math.round(from + (target - from) * e));
    if (p < 1) el.__mdTimer = requestAnimationFrame(step); else el.innerText = fmtNum(target);
  };
  step();
}

// ── CHARTS ──
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function hexA(hex, a) {
  const h = String(hex || "#F05A05").replace("#", ""), n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function chartBase() {
  const ink3 = cssVar("--md-ink-3") || "#5B6472", line = cssVar("--md-line") || "#E3E6EB";
  return {
    responsive: true, maintainAspectRatio: false,
    animation: REDUCE_MOTION ? false : { duration: 700, easing: "easeOutQuart" },
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: false },
      tooltip: { backgroundColor: cssVar("--md-ink") || "#1C2430", titleColor: cssVar("--md-surface") || "#fff", bodyColor: cssVar("--md-surface") || "#fff",
                 padding: 10, cornerRadius: 8, displayColors: false, titleFont: { weight: "600" }, bodyFont: { weight: "700", size: 13 } } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: ink3, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 8 } },
      y: { beginAtZero: true, grid: { color: line }, border: { display: false }, ticks: { color: ink3, font: { size: 11 }, precision: 0, maxTicksLimit: 5, padding: 8 } }   // DS1.1: whole numbers
    }
  };
}
const crosshairPlugin = { id: "mdCrosshair", afterDatasetsDraw(c) {
  const a = c.tooltip && c.tooltip.getActiveElements ? c.tooltip.getActiveElements() : [];
  if (!a || !a.length) return;
  const x = a[0].element.x, ctx = c.ctx; ctx.save(); ctx.strokeStyle = cssVar("--md-line-2") || "#C9CED6"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(x, c.chartArea.top); ctx.lineTo(x, c.chartArea.bottom); ctx.stroke(); ctx.restore(); } };

function smallTable(rows, head) {
  return `<div class="md-tablewrap"><table class="md-table"><thead><tr><th scope="col">${escHtml(head[0])}</th><th scope="col" class="md-num">${escHtml(head[1])}</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${escHtml(r[0])}</td><td class="md-num">${fmtNum(r[1])}</td></tr>`).join("") + "</tbody></table></div>";
}
function noChartsNote() { return '<div class="md-chart-note">Charts need an internet connection. The numbers are in the table.</div>'; }

function renderCharts() {
  const students = getCurrentStudents();
  renderSchoolBarChart();
  renderMonthlyLineChart(students);
  if (userRole === "admin") renderAddedByChart(students);
}

// Students per school (ranked list; click one to see only it) - or, for one school, students by class (chart)
function renderSchoolBarChart() {
  const bars = document.getElementById("schoolBars"), box = document.getElementById("boxSchoolBar"), tbl = document.getElementById("tableSchoolBar");
  const title = document.getElementById("chartSchoolBarTitle"), sub = document.getElementById("chartSchoolBarSub"), tbtn = document.getElementById("classTableBtn");
  if (!bars || !box) return;
  if (chartInstances.schoolBar) { chartInstances.schoolBar.destroy(); delete chartInstances.schoolBar; }

  if (filteredSchool === "all" && !oneSchool()) {
    if (title) title.innerText = "Students per school";
    if (sub) sub.textContent = "Click a school to see only its numbers";
    box.hidden = true; tbl.hidden = true; if (tbtn) tbtn.hidden = true; bars.hidden = false;
    const rows = allSchoolsData.map(s => ({ code: s.school, name: s.school_name || s.school, n: (allStudentsData[s.school] || []).length }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    const total = rows.reduce((a, r) => a + r.n, 0);
    if (!total) { bars.innerHTML = '<p class="md-empty-note">No students yet. Add records to see each school here.</p>'; return; }
    const shown = dashShowAll ? rows : rows.slice(0, DASH_LIST_LIMIT);
    bars.innerHTML = barListHtml(shown.map(r => ({ key: r.code, name: r.name, n: r.n })), total, true) +
      (rows.length > DASH_LIST_LIMIT ? `<div class="md-barlist__more"><button type="button" class="md-textbtn" id="schoolBarsMore">${dashShowAll ? "Show top " + DASH_LIST_LIMIT : "Show all " + rows.length + " schools"}</button></div>` : "");
    growBars(bars);
    return;
  }

  // one school: students by class
  const school = oneSchool() && filteredSchool === "all" ? oneSchool() : allSchoolsData.find(s => s.school === filteredSchool);
  const cls = byClass(getCurrentStudents());
  if (title) title.innerText = "Students by class";
  if (sub) sub.textContent = school ? (school.school_name || school.school) : "";
  bars.hidden = true; bars.innerHTML = "";
  if (!cls.length) { box.hidden = true; tbl.hidden = false; tbl.innerHTML = '<p class="md-empty-note">No students yet.</p>'; if (tbtn) tbtn.hidden = true; return; }
  const asTable = dashTables.class || typeof Chart !== "function";
  if (tbtn) tbtn.hidden = typeof Chart !== "function";
  tbl.hidden = !asTable; box.hidden = asTable;
  if (asTable) { tbl.innerHTML = smallTable(cls.map(c => [c.label + (Object.keys(c.secs).length > 1 ? " (" + Object.entries(c.secs).map(([k, v]) => k + " " + v).join(", ") + ")" : ""), c.n]), ["Class", "Students"]); return; }
  const canvas = document.getElementById("chartSchoolBar");
  const o = chartBase();
  o.plugins.tooltip.callbacks = {
    title: it => cls[it[0].dataIndex].label,
    label: it => ` ${fmtNum(it.parsed.y)} students`,
    afterBody: it => { const s = cls[it[0].dataIndex].secs, k = Object.keys(s); return k.length > 1 ? k.map(x => `Section ${x}: ${s[x]}`) : []; }
  };
  const brand = cssVar("--md-chart") || "#F05A05";
  chartInstances.schoolBar = new Chart(canvas, {
    type: "bar",
    data: { labels: cls.map(c => c.cls), datasets: [{ data: cls.map(c => c.n), backgroundColor: brand, hoverBackgroundColor: cssVar("--md-action") || brand,
            borderRadius: 4, borderSkipped: "start", maxBarThickness: 28, categoryPercentage: 0.7 }] },
    options: o
  });
}

// Students added per month (6 or 12 months), with a table view
function renderMonthlyLineChart(students) {
  const canvas = document.getElementById("chartMonthly"), box = document.getElementById("boxMonthly"), tbl = document.getElementById("tableMonthly");
  if (!canvas || !box) return;
  const months = monthBuckets(students, dashMonths), sum = months.reduce((a, m) => a + m.count, 0);
  const sub = document.getElementById("monthSub");
  if (sub) sub.textContent = `${fmtNum(sum)} in the last ${dashMonths} months`;
  const tbtn = document.querySelector('[data-table="month"]');
  if (chartInstances.monthly) { chartInstances.monthly.destroy(); delete chartInstances.monthly; }
  const note = box.querySelector(".md-chart-note"); if (note) note.remove();

  if (!sum) {
    if (tbtn) tbtn.hidden = true;
    tbl.hidden = true; box.hidden = false; canvas.hidden = true;
    box.insertAdjacentHTML("beforeend", `<div class="md-chart-note">No students added in the last ${dashMonths} months.<br>Added records show up here month by month.</div>`);
    return;
  }
  canvas.hidden = false;
  const noChart = typeof Chart !== "function";
  if (tbtn) tbtn.hidden = noChart;
  const asTable = dashTables.month || noChart;
  tbl.hidden = !asTable;
  if (asTable) tbl.innerHTML = smallTable(months.map(m => [m.full, m.count]), ["Month", "Students added"]);
  if (noChart) { box.hidden = false; canvas.hidden = true; box.insertAdjacentHTML("beforeend", noChartsNote()); return; }
  box.hidden = asTable;
  if (asTable) return;

  const brand = cssVar("--md-chart") || "#F05A05", surface = cssVar("--md-surface") || "#fff", o = chartBase();
  o.plugins.tooltip.callbacks = { title: it => months[it[0].dataIndex].full, label: it => ` ${fmtNum(it.parsed.y)} students added` };
  chartInstances.monthly = new Chart(canvas, {
    type: "line",
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: "Students Added",
        data: months.map(m => m.count),
        borderColor: brand, borderWidth: 2, cubicInterpolationMode: "monotone", fill: true,   // smooth, never dips below a real 0
        backgroundColor: c => { const a = c.chart && c.chart.chartArea; if (!a) return hexA(brand, 0.12); const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, hexA(brand, 0.22)); g.addColorStop(1, hexA(brand, 0)); return g; },
        pointRadius: months.map((m, i) => i === months.length - 1 ? 4 : 0), pointBackgroundColor: brand, pointBorderColor: surface, pointBorderWidth: 2,
        pointHoverRadius: 6, pointHoverBackgroundColor: brand, pointHoverBorderColor: surface, pointHoverBorderWidth: 2, pointHitRadius: 20
      }]
    },
    options: o,
    plugins: [crosshairPlugin]
  });
}

// Top Data Operators (admins only): a ranked list, top 8 and the rest as "Others"
function renderAddedByChart(students) {
  const box = document.getElementById("chartAddedBy");
  if (!box) return;
  const groups = {};
  students.forEach(s => {
    const by = (s.Added_By || "").trim();
    if (by) groups[by] = (groups[by] || 0) + 1;
  });
  const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!sorted.length) { box.innerHTML = '<p class="md-empty-note">No records added yet.</p>'; return; }
  const total = sorted.reduce((a, r) => a + r[1], 0);
  const top = sorted.slice(0, 8).map(([name, n]) => ({ key: "", name, n }));
  if (sorted.length > 8) top.push({ key: "", name: `Others (${sorted.length - 8})`, n: sorted.slice(8).reduce((a, r) => a + r[1], 0), others: true });
  box.innerHTML = barListHtml(top, total, false);
  growBars(box);
}

function barListHtml(rows, total, clickable) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return '<ol class="md-barlist">' + rows.map(r => {
    const pct = total ? Math.round(r.n / total * 100) : 0, w = r.n / max * 100, tag = clickable ? "button" : "div";
    const tip = `${r.name}: ${fmtNum(r.n)} students (${pct}%)${clickable ? ". Click to see only this school." : ""}`;
    return `<li><${tag} class="md-barlist__row"${clickable ? ` type="button" data-school="${escHtml(r.key)}"` : ""} data-name="${escHtml(r.name)}" data-v="${r.n}" title="${escHtml(tip)}">` +
      `<span class="md-barlist__name">${escHtml(r.name)}</span><span class="md-barlist__track" aria-hidden="true"><i style="--w:${dashFirstPaint && !REDUCE_MOTION ? 0 : w}%" data-w="${w}"></i></span>` +
      `<span class="md-barlist__val">${fmtNum(r.n)}</span></${tag}></li>`;
  }).join("") + "</ol>";
}
function growBars(root) {
  if (REDUCE_MOTION || typeof requestAnimationFrame !== "function") return;
  requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll(".md-barlist__track i").forEach(i => i.style.setProperty("--w", i.dataset.w + "%"))));
}

// ── SCHOOL FILTER ──
function populateSchoolFilter(schools) {
  const sel = document.getElementById("schoolFilterSelect");
  if (!sel) return;
  const wrap = document.getElementById("schoolFilterWrap");

  if (schools.length === 1) {
    // one school (school logins and anyone limited to one school): nothing to choose - its numbers, by class
    sel.innerHTML = `<option value="${escHtml(schools[0].school)}">${escHtml(schools[0].school_name || schools[0].school)}</option>`;
    filteredSchool = schools[0].school;
    if (wrap) wrap.style.display = "none";
  } else {
    const keep = sel.value;
    sel.innerHTML = `<option value="all">All schools (${schools.length})</option>` +
      schools.slice().sort((a, b) => String(a.school_name || a.school).localeCompare(String(b.school_name || b.school)))
        .map(s => `<option value="${escHtml(s.school)}">${escHtml(s.school_name || s.school)}</option>`).join("");
    if (keep && [...sel.options].some(o => o.value === keep)) sel.value = keep;
    if (wrap) wrap.style.display = "";
  }
  const sub = document.getElementById("dashSub");
  if (sub) sub.textContent = schools.length === 1 ? (schools[0].school_name || schools[0].school) : "";
  const qaSub = document.getElementById("qaSub");
  if (qaSub) qaSub.textContent = schools.length === 1 ? "" : "You choose the school next";

  if (!sel.__mdWired) {
    sel.__mdWired = true;
    sel.addEventListener("change", async () => {
      filteredSchool = sel.value;
      dashShowAll = false;
      showSkeletons();
      await new Promise(r => setTimeout(r, 80));
      renderDashboard();
    });
  }
}

// ── DASHBOARD CONTROLS ──
function wireDashboard() {
  document.addEventListener("click", e => {
    const row = e.target.closest && e.target.closest("#schoolBars [data-school]");
    if (row) {
      const sel = document.getElementById("schoolFilterSelect");
      if (sel && [...sel.options].some(o => o.value === row.dataset.school)) { sel.value = row.dataset.school; sel.dispatchEvent(new Event("change")); sel.focus(); }
      return;
    }
    if (e.target.id === "schoolBarsMore") { dashShowAll = !dashShowAll; renderSchoolBarChart(); return; }
    const m = e.target.closest && e.target.closest("[data-months]");
    if (m) {
      dashMonths = Number(m.dataset.months) || 6;
      document.querySelectorAll("[data-months]").forEach(b => b.setAttribute("aria-pressed", String(b === m)));
      renderMonthlyLineChart(getCurrentStudents());
      return;
    }
    const t = e.target.closest && e.target.closest("[data-table]");
    if (t) {
      const k = t.dataset.table; dashTables[k] = !dashTables[k];
      t.setAttribute("aria-pressed", String(dashTables[k])); t.textContent = dashTables[k] ? "Chart" : "Table";
      if (k === "month") renderMonthlyLineChart(getCurrentStudents()); else renderSchoolBarChart();
    }
  });
}

// A menu link from another page (layout.js): dashboard.html?pick=add opens the school chooser for it
async function openPickedFromMenu() {
  let pick = "";
  try { pick = new URLSearchParams(location.search).get("pick") || ""; } catch (err) { pick = ""; }
  if (!pick) return;
  // the page closes every popup when it finishes loading (window.onload / pageshow): open it after that
  if (document.readyState !== "complete") await new Promise(r => window.addEventListener("load", r, { once: true }));
  await new Promise(r => setTimeout(r, 0));
  try { history.replaceState(null, "", location.pathname); } catch (err) { /* file:// in some browsers */ }
  const card = [...document.querySelectorAll(".action-card[onclick]")].find(c => (c.getAttribute("onclick") || "") === `showSchoolSelector('${pick}')`);
  if (card && card.style.display !== "none") showSchoolSelector(pick);
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

  if (selectedMode === "form" && userRole !== "school") {     // P1b: a school login makes forms for its own school only
    dropdown.innerHTML += `<option value="__other__">Other School (Generate form for new school)</option>`;
  }

  if (selectedMode === "templates") {
    dropdown.innerHTML += `<option value="__none__">🎨 No specific school (library / all my schools)</option>`;
  }  

  dropdown.innerHTML += schools.map(s =>
    `<option value="${s.school}" data-id="${s.school_id}">${s.school_name}</option>`
  ).join("");

  if (schools.length === 1) dropdown.value = schools[0].school;
}

function showSchoolSelector(selectedMode) {
  // P1b: a login with one school never chooses - straight to the page (School forms: school logins only,
  // others keep "Other school"; Template Builder keeps its "No specific school" choice)
  const only = oneSchool();
  if (only && selectedMode !== "templates" && (selectedMode !== "form" || userRole === "school")) {
    mode = selectedMode;
    const dropdown = document.getElementById("schoolSelect");
    dropdown.innerHTML = `<option value="${escHtml(only.school)}" data-id="${escHtml(only.school_id)}" selected>${escHtml(only.school_name || only.school)}</option>`;
    continueAction();
    return;
  }
  mode = selectedMode;
  popupByUser = true;                                         // the page finishing loading must not close it
  document.getElementById("schoolSelect").innerHTML = `<option value="">Loading...</option>`;
  document.getElementById("schoolBox").style.display  = "block";
  document.getElementById("overlay").style.display    = "block";
  popupOpener = document.activeElement;                       // P1b: keyboard focus into the popup, back on close
  setTimeout(() => { const s = document.getElementById("schoolSelect"); if (s && s.focus) s.focus(); }, 0);
  loadSchoolsForPopup(selectedMode);
}

function continueAction() {
  const dropdown       = document.getElementById("schoolSelect");
  const selectedOption = dropdown.options[dropdown.selectedIndex];
  const selectedValue  = selectedOption.value;

  if (selectedValue === "__other__") { showCustomSchoolPopup(); return; }
  if (!selectedValue) { alert("Please select a school"); return; }
  
  if (mode === "templates") {
    window.location.href = selectedValue === "__none__"
      ? "template_builder.html"
      : "template_builder.html?school=" + encodeURIComponent(selectedValue);
    return;
  }  

  sessionStorage.setItem("school",      selectedValue);
  sessionStorage.setItem("school_id",   selectedOption.getAttribute("data-id"));
  sessionStorage.setItem("school_name", selectedOption.textContent.trim());

  const routes = {
    add: "add_student.html", manage: "manage_student.html",
    print: "print_student.html", bulk: "bulk_upload.html",
    form: "school_form.html", export: "export_student.html",
    photos: "manage_photos.html"
  };
  if (routes[mode]) window.location.href = routes[mode];
}

let popupOpener = null;
let popupByUser = false;   // a popup the person opened (clicked before the page had finished loading)
function hideAllPopups() {
  popupByUser = false;
  const wasOpen = document.getElementById("schoolBox").style.display === "block" || document.getElementById("customSchoolPopup").style.display === "block";
  if (wasOpen && popupOpener && popupOpener.focus && document.contains(popupOpener)) popupOpener.focus();
  popupOpener = null;
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
  if (e.target.closest("[data-md-pick]")) return;                 // P1b: a top-menu link that just opened this popup
  if (sb.style.display === "block" || cb.style.display === "block") hideAllPopups();
});

// Close leftover popups when the page comes back with the Back button (from memory),
// but never one the person just opened while the page was still loading (charts, fonts, logo).
function hideStalePopups(e) {
  if (e && e.persisted) { hideAllPopups(); return; }
  if (!popupByUser) hideAllPopups();
}
window.addEventListener("pageshow", hideStalePopups);
window.onload = hideStalePopups;
window.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.addEventListener("click", hideAllPopups);
});

function showCustomSchoolPopup() {
  popupByUser = true;
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
    el.innerHTML = `<span class="md-skel" style="width:72px;height:26px"></span>`;
    el.dataset.v = "0";
  });
}

function hideSkeletons() {
  // Values replaced by animateCount
}

function showError(msg) {
  const el = document.getElementById("accessNotice");
  if (el) {
    el.innerText = msg;
    el.className = "md-alert md-alert--danger";
    el.style.display = "block";
  }
}

function renderLastUpdated() {
  const el = document.getElementById("lastUpdated");
  if (!el || !dashUpdatedAt) return;
  const mins = Math.floor((Date.now() - dashUpdatedAt.getTime()) / 60000);
  el.innerText = `Updated ${dashUpdatedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` + (mins >= 1 ? ` (${mins} min ago)` : "");
}

// dark mode (when it is switched on): the charts take the new colours
if (typeof MutationObserver === "function") {
  new MutationObserver(() => { if (Object.keys(chartInstances).length) renderCharts(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-md-theme"] });
}
