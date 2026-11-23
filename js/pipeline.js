/* =============================================
   pipeline.js (SE3c) - 🧭 where every school stands in this year's session work
   Stages come from what already happens (no extra work):
     ⏳ Due        - its new session has started by date, but it isn't promoted yet
     📘 In session - not promoted this cycle (e.g. a new school)
     🔁 Promoted   - promoted into the current session (⚡ if early)
     📋 Checklist  - a checklist was printed for the current session
     🖨 Cards      - cards printed for the current session: "412 of 450"
   "Students counted" is the live counter (kept by every action, checked nightly); 🔄 recounts one school.
   Admins, and people an admin gave 🔁 Session & promotion; each sees only their own schools.
   ============================================= */
const PL_STAGES = {
  due:       { label: "⏳ Due",               order: 0, cls: "pl-due" },
  started:   { label: "📘 In session",        order: 1, cls: "pl-started" },
  promoted:  { label: "🔁 Promoted",          order: 2, cls: "pl-promoted" },
  checklist: { label: "📋 Checklist printed", order: 3, cls: "pl-checklist" },
  cards:     { label: "🖨 Cards printed",     order: 4, cls: "pl-cards" }
};
let plRows = [], plStage = "all";
// SE3d: bulk promote (admins)
const plAdmin = () => sessionStorage.getItem("role") === "admin";
let plPicked = new Set(), plPlan = null, plRunning = false, plStop = false;

const plEsc = v => String(v === undefined || v === null ? "" : v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plEl = id => document.getElementById(id);

function plMay() {
  if (sessionStorage.getItem("role") === "admin") return true;
  try { return JSON.parse(sessionStorage.getItem("permissions") || "[]").includes("session"); } catch (err) { return false; }
}
function plDate(v) {
  const d = new Date(v);
  return isNaN(d.getTime()) || !v ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function plAgo(v) {
  const d = new Date(v);
  if (!v || isNaN(d.getTime())) return "not counted yet";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "counted just now";
  if (min < 60) return `counted ${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `counted ${h} h ago`;
  return `counted ${Math.round(h / 24)} days ago`;
}

async function plInit() {
  if (!plMay()) { plEl("plNoAccess").style.display = "block"; return; }
  plEl("plMain").style.display = "block";
  plEl("plSearch").oninput = plRender;
  plEl("plVendor").onchange = plRender;
  plEl("plSort").onchange = plRender;
  plEl("plReload").onclick = plLoad;
  if (plAdmin()) {
    plEl("plBulkBar").style.display = "block";
    plEl("plPickAll").onchange = e => {
      plFiltered(false).filter(r => r.stage === "due").forEach(r => { if (e.target.checked) plPicked.add(r.school); else plPicked.delete(r.school); });
      plRender();
    };
    plEl("plBulkPreview").onclick = plBulkPreview;
    window.addEventListener("beforeunload", e => { if (plRunning) { e.preventDefault(); e.returnValue = ""; } });
  }
  await plLoad();
}

async function plLoad() {
  plEl("plMsg").style.display = "none";
  plEl("plBody").innerHTML = `<tr><td colspan="7">⏳ Loading…</td></tr>`;
  plEl("plList").style.display = "block";
  const res = await apiGet({ action: "getPipeline" });
  if (!res || res.status !== "ok") {
    plRows = [];
    plEl("plBody").innerHTML = "";
    plEl("plMsg").textContent = (res && (res.error || res.auth_error)) || "Could not load the pipeline.";
    plEl("plMsg").style.display = "block";
    return;
  }
  plRows = res.schools || [];
  plPicked = new Set([...plPicked].filter(c => plRows.some(r => r.school === c && r.stage === "due")));
  // vendor filter only when there is more than one vendor in the list
  const vendors = [...new Map(plRows.map(r => [r.vendor_id, r.vendor_name || ("Vendor " + r.vendor_id)])).entries()];
  const sel = plEl("plVendor"), keep = sel.value;
  sel.innerHTML = `<option value="">All vendors</option>` + vendors.map(([id, n]) => `<option value="${plEsc(id)}">${plEsc(n)}</option>`).join("");
  sel.value = vendors.some(([id]) => id === keep) ? keep : "";
  sel.style.display = vendors.length > 1 ? "" : "none";
  plRender();
}

function plFiltered(ignoreStage) {
  const q = plEl("plSearch").value.trim().toLowerCase(), v = plEl("plVendor").value;
  return plRows.filter(r =>
    (!q || String(r.school).toLowerCase().includes(q) || String(r.school_name).toLowerCase().includes(q)) &&
    (!v || r.vendor_id === v) &&
    (ignoreStage || plStage === "all" || r.stage === plStage));
}

function plRender() {
  // chips with counts (search / vendor applied, stage not)
  const base = plFiltered(true), counts = {};
  base.forEach(r => { counts[r.stage] = (counts[r.stage] || 0) + 1; });
  plEl("plChips").innerHTML = [`<span class="pl-chip ${plStage === "all" ? "on" : ""}" data-stage="all">All ${base.length}</span>`]
    .concat(Object.keys(PL_STAGES).filter(k => counts[k]).map(k =>
      `<span class="pl-chip ${plStage === k ? "on" : ""}" data-stage="${k}">${PL_STAGES[k].label} ${counts[k]}</span>`)).join("");
  plEl("plChips").querySelectorAll(".pl-chip").forEach(c => { c.onclick = () => { plStage = c.dataset.stage; plRender(); }; });

  const rows = plFiltered(false).slice().sort(plEl("plSort").value === "name"
    ? (a, b) => String(a.school_name || a.school).localeCompare(String(b.school_name || b.school))
    : (a, b) => PL_STAGES[a.stage].order - PL_STAGES[b.stage].order || String(a.school_name || a.school).localeCompare(String(b.school_name || b.school)));
  const admin = plAdmin();
  plEl("plPickHead").textContent = admin ? "🔁" : "";
  plEl("plBulkPreview").textContent = `🔁 Preview bulk promote (${plPicked.size})`;
  plEl("plBulkPreview").disabled = plRunning || !plPicked.size;
  if (!rows.length) { plEl("plBody").innerHTML = `<tr><td colspan="7" style="color:#6b7280;">No schools here.</td></tr>`; return; }
  plEl("plBody").innerHTML = rows.map(r => {
    const st = PL_STAGES[r.stage] || PL_STAGES.started;
    const total = r.active_students;
    const pct = total ? Math.min(100, Math.round(r.cards_printed * 100 / total)) : 0;
    const stageNote = r.stage === "due" ? `${plEsc(r.calendar)} has started — promote it`
      : r.stage === "promoted" ? `${r.early ? "⚡ early, " : ""}${plEsc(plDate(r.promoted_at))}${r.promoted_by ? " by " + plEsc(r.promoted_by) : ""}`
      : r.stage === "checklist" ? `${plEsc(r.checklists)} printed, last ${plEsc(plDate(r.last_checklist))}`
      : r.stage === "cards" ? `last ${plEsc(plDate(r.last_cards))}` : "";
    const pick = admin && r.stage === "due"
      ? `<input type="checkbox" class="plPick" data-school="${plEsc(r.school)}" ${plPicked.has(r.school) ? "checked" : ""} ${plRunning ? "disabled" : ""} style="width:auto;" title="Include in bulk promote">` : "";
    return `<tr data-school="${plEsc(r.school)}">
      <td>${pick}</td>
      <td><b>${plEsc(r.school_name || r.school)}</b><span class="pl-sub">${plEsc(r.school)}${r.vendor_name ? " · " + plEsc(r.vendor_name) : ""}</span></td>
      <td><b>${plEsc(r.active)}</b>${r.early ? " ⚡" : ""}${r.starts ? `<span class="pl-sub">starts ${plEsc(r.starts)}</span>` : ""}</td>
      <td><span class="pl-stage ${st.cls}">${st.label}</span>${stageNote ? `<span class="pl-sub">${stageNote}</span>` : ""}</td>
      <td class="pl-printed"><b>${plEsc(r.cards_printed)}</b>${total !== null && total !== undefined ? ` of ${plEsc(total)}` : ""}
        ${total ? `<div class="pl-bar-wrap" title="${pct}%"><div class="pl-bar-fill" style="width:${pct}%"></div></div>` : ""}</td>
      <td class="pl-count">${total === null || total === undefined ? "—" : plEsc(total)}<span class="pl-sub">${plEsc(plAgo(r.counted_at))}</span></td>
      <td>
        <button class="pl-btn" onclick="plRecount('${plEsc(r.school)}', this)" title="Count this school's students now">🔄 Recount</button>
        <button class="pl-btn" onclick="location.href='new_session.html?school=${encodeURIComponent(r.school)}'" title="Promote / undo for this school">🔁</button>
        <button class="pl-btn" onclick="plOpen('${plEsc(r.school)}', 'print_student.html')" title="Print cards or the checklist">🖨 Print</button>
      </td>
    </tr>`;
  }).join("");
  plEl("plBody").querySelectorAll(".plPick").forEach(c => {
    c.onchange = () => { if (c.checked) plPicked.add(c.dataset.school); else plPicked.delete(c.dataset.school); plPlan = null; plEl("plBulk").innerHTML = ""; plRender(); };
  });
}

/* ── SE3d: 🔁 bulk promote ──
   1. Preview: each picked school's normal promotion plan (the same check as its own 🔁 page), a few at a time.
      ✅ Ready = its session has started, every class is recognised, nothing above the last class, nothing half done.
      ⚠ Needs a look = anything else: left out, with a link to promote it on its own.
   2. Start: the ready schools ONE AT A TIME, each a normal promotion (the server checks everything again and
      refuses if anything changed since the preview). One failing never stops the others; each can be undone on its own. */
function plReadiness(info) {
  if (!info || info.status !== "ok") return (info && (info.error || info.auth_error)) || "could not be checked";
  if (info.unfinished) return "a promotion stopped half way — put it back on its own page";
  if (!info.can_promote) return info.promote_problem || "its new session hasn't started";
  const unknown = info.classes.filter(c => !c.next);
  if (unknown.length) return "class not recognised: " + unknown.map(c => c.class === "" ? "(no class)" : c.class).join(", ");
  const odd = info.classes.filter(c => c.note);
  if (odd.length) return odd.map(c => `${c.class}: ${c.note}`).join("; ");
  return "";
}
function plSummary(info) {
  let up = 0, out = 0, stay = 0;
  info.classes.forEach(c => { const n = Number(c.count) || 0; if (c.next === "__PASSED__") out += n; else if (c.next === "__SAME__" || c.next === String(c.class)) stay += n; else up += n; });
  return { up, out, stay };
}

async function plBulkPreview() {
  if (plRunning || !plPicked.size) return;
  const codes = [...plPicked], box = plEl("plBulk");
  plPlan = { ready: [], look: [] };
  box.innerHTML = `⏳ Checking ${codes.length} school${codes.length > 1 ? "s" : ""}… <span id="plBulkProg">0 / ${codes.length}</span>`;
  let doneN = 0, i = 0;
  const worker = async () => {
    while (i < codes.length) {
      const code = codes[i++];
      let info = null;
      try { info = await apiGet({ action: "getNewSessionInfo", school: code }); } catch (err) { info = null; }
      const why = plReadiness(info);
      if (why) plPlan.look.push({ school: code, why });
      else plPlan.ready.push({ school: code, name: info.school_name || code, info, sum: plSummary(info) });
      doneN++;
      const pg = plEl("plBulkProg"); if (pg) pg.textContent = `${doneN} / ${codes.length}`;
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const order = c => codes.indexOf(c.school);
  plPlan.ready.sort((a, b) => order(a) - order(b)); plPlan.look.sort((a, b) => order(a) - order(b));
  plShowPlan();
}

function plShowPlan() {
  const p = plPlan, box = plEl("plBulk");
  const classesOf = info => info.classes.map(c => `${plEsc(c.class === "" ? "(no class)" : c.class)} → ${c.next === "__PASSED__" ? "🎓 Passed out" : plEsc(c.next)} (${plEsc(c.count)})`).join(", ");
  box.innerHTML = `
    ${p.ready.length ? `<div style="padding:10px 12px; border-radius:8px; border:1px solid #86efac; background:#f0fdf4; margin-bottom:8px;">
      <b>✅ Ready (${p.ready.length})</b> — every class recognised:
      <ul id="plReadyList" style="margin:6px 0 0 18px; padding:0;">${p.ready.map(r => `<li data-school="${plEsc(r.school)}">
        <b>${plEsc(r.name)}</b> (${plEsc(r.school)}): ${plEsc(r.info.active)} → ${plEsc(r.info.next)} — ${r.sum.up} move up, ${r.sum.out} pass out, ${r.sum.stay} stay
        <details style="display:inline;"><summary style="display:inline; cursor:pointer; color:#0d6efd; font-size:12px;"> classes</summary>
          <div style="font-size:12px; color:#374151;">${classesOf(r.info) || "no students"}</div></details>
        <span class="plRes"></span></li>`).join("")}</ul></div>` : ""}
    ${p.look.length ? `<div style="padding:10px 12px; border-radius:8px; border:1px solid #fcd34d; background:#fffbeb; margin-bottom:8px;">
      <b>⚠ Needs a look (${p.look.length})</b> — left out; promote each on its own page:
      <ul style="margin:6px 0 0 18px; padding:0;">${p.look.map(l => `<li data-school="${plEsc(l.school)}"><b>${plEsc(l.school)}</b>: ${plEsc(l.why)}
        <a href="new_session.html?school=${encodeURIComponent(l.school)}">open 🔁</a></li>`).join("")}</ul></div>` : ""}
    ${p.ready.length ? `
      <label style="display:flex; gap:6px; align-items:center; font-size:14px; cursor:pointer; margin:8px 0;">
        <input type="checkbox" id="plBulkChecked" style="width:auto; margin:0;"> I have checked the schools and classes above
      </label>
      <button class="pl-btn" id="plBulkStart" disabled style="background:#047857; border-color:#047857; color:#fff; font-weight:700;">🔁 Start ${p.ready.length} school${p.ready.length > 1 ? "s" : ""}</button>
      <button class="pl-btn" id="plBulkStop" style="display:none;">⏹ Stop after this school</button>
      <span id="plBulkStatus" style="margin-left:8px; font-weight:600;"></span>` : ""}`;
  if (!p.ready.length) return;
  plEl("plBulkChecked").onchange = () => { plEl("plBulkStart").disabled = plRunning || !plEl("plBulkChecked").checked; };
  plEl("plBulkStart").onclick = plBulkStart;
  plEl("plBulkStop").onclick = () => { plStop = true; plEl("plBulkStop").disabled = true; plEl("plBulkStop").textContent = "⏹ Stopping…"; };
}

async function plBulkStart() {
  const p = plPlan;
  if (!p || !p.ready.length || plRunning) return;
  if (!confirm(`Promote ${p.ready.length} school${p.ready.length > 1 ? "s" : ""} to their next session, one at a time?\n\n` +
               `Each is a normal promotion: its current session is kept as it is now, and each can be undone on its own page ` +
               `until the first change.\n\nPlease keep this page open until it finishes.`)) return;
  plRunning = true; plStop = false;
  plEl("plBulkStart").disabled = true; plEl("plBulkChecked").disabled = true;
  plEl("plBulkStop").style.display = ""; plEl("plBulkStop").disabled = false;
  plRender();
  let okN = 0, badN = 0, n = 0;
  for (const r of p.ready) {
    if (plStop) break;
    n++;
    plEl("plBulkStatus").textContent = `⏳ ${n} of ${p.ready.length}: ${r.school}…`;
    const li = [...plEl("plReadyList").querySelectorAll("li")].find(x => x.dataset.school === r.school).querySelector(".plRes");
    let out = null;
    try {
      out = await postToApi({ action: "startNewSession", school: r.school, to: r.info.next, students: r.info.students,
                              mapping: Object.fromEntries(r.info.classes.map(c => [c.class, c.next])) });
    } catch (err) { out = { error: "no answer from the server — open its 🔁 page to see whether it was promoted" }; }
    if (out && out.status === "promoted") { okN++; li.innerHTML = ` — <b style="color:#166534;">✅ promoted to ${plEsc(out.to)}</b>`; }
    else { badN++; li.innerHTML = ` — <b style="color:#991b1b;">❌ ${plEsc((out && (out.error || out.auth_error)) || "not promoted")}</b>`; }
  }
  const left = p.ready.length - okN - badN;
  plRunning = false;
  plEl("plBulkStop").style.display = "none";
  plEl("plBulkStatus").textContent = `Done: ${okN} promoted` + (badN ? `, ${badN} not promoted (see ❌)` : "") + (left ? `, ${left} not started (stopped)` : "") + ".";
  plPicked.clear();
  sessionStorage.removeItem("schoolsCache");
  await plLoad();
}

async function plRecount(code, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "⏳"; }
  const res = await apiGet({ action: "recountSchool", school: code });
  if (btn) { btn.disabled = false; btn.textContent = "🔄 Recount"; }
  if (!res || res.status !== "ok") {
    plEl("plMsg").textContent = "Not recounted: " + ((res && (res.error || res.auth_error)) || "no answer from the server");
    plEl("plMsg").style.display = "block";
    return;
  }
  const r = plRows.find(x => x.school === code);
  if (r) { r.active_students = res.active_students; r.counted_at = res.counted_at; }
  plRender();
}

// open a school page the way the Dashboard does (the school is remembered for that page)
function plOpen(code, page) {
  const r = plRows.find(x => x.school === code);
  if (!r) return;
  sessionStorage.setItem("school", r.school);
  sessionStorage.setItem("school_id", r.school_id || "");
  sessionStorage.setItem("school_name", r.school_name || r.school);
  location.href = page;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", plInit);
else plInit();
