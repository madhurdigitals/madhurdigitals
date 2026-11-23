/* =============================================
   session.js (SE1, SE2) - the academic session of the selected school
   - A "📅 Session" badge in the page heading, which is also the chooser.
   - Default: the school's ACTIVE session (from the server). The choice is kept for this browser tab.
   - Admins see every session from the school's first one; others the active + the previous one.
   - SE2: an earlier session can be opened when it was KEPT (frozen at a promotion), and only on the pages
     that can show it: Print, Export and Manage Records (view only: Edit / Delete are off). There the student list comes from the kept rows (classes as they
     were then); everything else always works in the active session.
   Pages that need the session wait for:  await mdSession.ready  ->  { session, long, active, row }
   ============================================= */
(function () {
  const PAST_PAGES = ["print_student.html", "export_student.html", "manage_student.html"];
  const PAGE = (location.pathname.split("/").pop() || "").toLowerCase();
  const PAST_OK = PAST_PAGES.includes(PAGE);

  const yearOf = l => Number(String(l || "").slice(0, 4));
  const isLabel = l => /^\d{4}-\d{2}$/.test(String(l || "")) && String((yearOf(l) + 1) % 100).padStart(2, "0") === String(l).slice(5);
  const labelFor = y => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  const longOf = l => isLabel(l) ? `${yearOf(l)}-${yearOf(l) + 1}` : "";
  const clean = v => String(v === undefined || v === null ? "" : v).replace(/^'/, "").trim();

  // display fallback only (the server decides the real active session)
  function calendarSession(startMonth) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "numeric" }).formatToParts(new Date());
    const y = Number(parts.find(p => p.type === "year").value), m = Number(parts.find(p => p.type === "month").value);
    const sm = Number(startMonth) >= 1 && Number(startMonth) <= 12 ? Number(startMonth) : 3;
    return labelFor(m >= sm ? y : y - 1);
  }

  function sessionsFor(row, isAdmin) {
    const active = isLabel(clean(row.active_session)) ? clean(row.active_session) : calendarSession(row.session_start_month);
    const first = isLabel(clean(row.first_session)) && yearOf(clean(row.first_session)) <= yearOf(active) ? clean(row.first_session) : active;
    const all = [];
    for (let y = yearOf(active); y >= yearOf(first); y--) all.push(labelFor(y));
    const kept = clean(row.frozen_sessions).split(",").map(s => s.trim()).filter(isLabel);
    return { active, kept, list: isAdmin ? all : all.slice(0, 2) };
  }
  // can this session be opened on this page?
  const openable = (l, info) => l === info.active || (PAST_OK && info.kept.includes(l));

  let resolveReady;
  const state = { session: "", long: "", active: "", row: null };
  window.mdSession = {
    ready: new Promise(r => { resolveReady = r; }),
    current: () => state.session,
    long: () => state.long,
    active: () => state.active,
    isActive: () => !!state.session && state.session === state.active
  };

  function render(info) {
    const host = document.querySelector(".heading-wrapper") || document.querySelector("nav");
    if (!host) return;
    let box = document.getElementById("mdSessionBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "mdSessionBox";
      box.style.cssText = "display:flex; justify-content:center; align-items:center; gap:6px; margin:6px auto 0; font-size:13px; flex-wrap:wrap;";
      host.parentNode.insertBefore(box, host.nextSibling);
    }
    const past = state.session !== state.active;
    const isAdmin = sessionStorage.getItem("role") === "admin";
    box.innerHTML = `<span style="font-weight:700; color:${past ? "#6b7280" : "#047857"};">📅 Session</span>
      <select id="mdSessionSelect" title="${past ? "An earlier session - view and reprint only" : "This school's current session"}"
        style="padding:4px 8px; border-radius:14px; border:2px solid ${past ? "#9ca3af" : "#10b981"}; background:${past ? "#f3f4f6" : "#ecfdf5"}; font-weight:700;">
        ${info.list.map(l => {
          const locked = !openable(l, info);
          const why = l === info.active ? " (current)"
                    : !info.kept.includes(l) ? " — no records kept"
                    : locked ? " — open it in Manage, Print or Export" : "";
          return `<option value="${l}" ${l === state.session ? "selected" : ""} ${locked ? "disabled" : ""}>${l}${why}</option>`;
        }).join("")}
      </select>
      ${past ? `<span id="mdSessionPastNote" style="flex-basis:100%; text-align:center; color:#92400e; background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:4px 10px; font-size:12px;">
        Viewing ${state.session}: classes as they were in that session (view only).${isAdmin ? "" : " Printing it needs an admin."}
        <a href="#" id="mdSessionBack" style="font-weight:700; margin-left:6px;">Back to ${state.active}</a></span>` : ""}`;
    const pick = value => {
      sessionStorage.setItem("session", value);
      sessionStorage.setItem("session_school", String(sessionStorage.getItem("school") || ""));
      location.reload();
    };
    box.querySelector("select").onchange = e => pick(e.target.value);
    const back = document.getElementById("mdSessionBack");
    if (back) back.onclick = e => { e.preventDefault(); pick(state.active); };
  }

  // Print / Export: in an earlier session the student list comes from the kept rows (same answer shape)
  function wrapGetStudents() {
    if (!PAST_OK || typeof window.getStudents !== "function" || window.getStudents.__mdSession) return;
    const original = window.getStudents;
    const wrapped = async function (school, ...rest) {
      await window.mdSession.ready;
      if (!state.session || state.session === state.active) return original(school, ...rest);
      try {
        // Manage Records also lists who LEFT during that session (tagged); Print / Export only who was in school
        const withLeft = PAGE === "manage_student.html" ? "&with_left=1" : "";
        const res = await fetch(`${API_URL}?action=getStudents&school=${encodeURIComponent(school)}&session=${encodeURIComponent(state.session)}${withLeft}`);
        const data = await res.json();
        if (!Array.isArray(data)) {
          if (data && data.error) alert(data.error);
          return [[]];
        }
        return data;
      } catch (err) {
        alert("Failed to fetch students");
        return [];
      }
    };
    wrapped.__mdSession = true;
    window.getStudents = wrapped;
  }
  wrapGetStudents();

  async function init() {
    wrapGetStudents();
    const code = sessionStorage.getItem("school");
    if (!code || typeof getSchools !== "function") { resolveReady({ ...state }); return; }
    let row = null;
    try {
      const raw = await getSchools(true);
      const h = raw[0] || [];
      row = raw.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; })
               .find(s => String(s.school).toLowerCase() === String(code).toLowerCase()) || null;
    } catch (err) { row = null; }
    if (!row) { resolveReady({ ...state }); return; }
    const isAdmin = sessionStorage.getItem("role") === "admin";
    const info = sessionsFor(row, isAdmin);
    const stored = sessionStorage.getItem("session_school") === String(code) ? sessionStorage.getItem("session") : "";
    const allowed = info.list.includes(stored) && openable(stored, info);
    state.session = allowed ? stored : info.active;
    state.long = longOf(state.session);
    state.active = info.active;
    state.row = row;
    sessionStorage.setItem("session", state.session);
    sessionStorage.setItem("session_school", String(code));
    render(info);
    resolveReady({ ...state });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
