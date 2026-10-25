/* =============================================
   record_types.js - 🎓 Students | 👩‍🏫 Staff tabs (Add Records / Manage Records)
   Tabs appear only when the school has staff cards switched on AND the user has 👩‍🏫 Staff data.
   The chosen tab is remembered for this browser tab.
   ============================================= */
function rtPermissions() {
  try { return JSON.parse(sessionStorage.getItem("permissions") || "[]") || []; } catch (err) { return []; }
}
function rtCanSeeStaff() {
  return sessionStorage.getItem("role") === "admin" || rtPermissions().includes("staff");
}
function rtSchoolRow(schoolsRaw, code) {
  if (!schoolsRaw || !schoolsRaw.length) return null;
  const h = schoolsRaw[0];
  const rows = schoolsRaw.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; });
  return rows.find(s => String(s.school).toLowerCase() === String(code || "").toLowerCase()) || null;
}
function rtSchoolHasStaff(row) {
  return !!row && String(row.staff_enabled || "").toLowerCase() === "yes";
}
// "students" | "staff" for this school right now
function rtCurrentType(row) {
  if (!rtSchoolHasStaff(row) || !rtCanSeeStaff()) return "students";
  return sessionStorage.getItem("recordType") === "staff" ? "staff" : "students";
}
function rtSetType(type) { sessionStorage.setItem("recordType", type === "staff" ? "staff" : "students"); }

// The school's staff fields (always without the fixed Name / Category / Designation)
function rtStaffFields(row) {
  const fixed = ["name", "category", "designation"];
  return String((row && row.staff_fields) || "").split(",").map(f => f.trim()).filter(f => f && !fixed.includes(f.toLowerCase()));
}

// Draws the tab bar after `anchor`. onChange(type) is called when the user switches.
function rtRenderTabs(anchor, row, onChange) {
  let bar = document.getElementById("recordTabs");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "recordTabs";
    bar.style.cssText = "display:flex; justify-content:center; gap:8px; margin:10px auto 4px; flex-wrap:wrap;";
    anchor.parentNode.insertBefore(bar, anchor.nextSibling);
    const st = document.createElement("style");
    st.textContent = `
      #recordTabs button { padding:9px 18px; border-radius:22px; border:2px solid #d1d5db; background:#fff; font-size:14px; font-weight:700; cursor:pointer; color:#374151; }
      #recordTabs button.on.students { background:#0d6efd; border-color:#0d6efd; color:#fff; }
      #recordTabs button.on.staff    { background:#059669; border-color:#059669; color:#fff; }`;
    document.head.appendChild(st);
  }
  if (!rtSchoolHasStaff(row) || !rtCanSeeStaff()) { bar.style.display = "none"; return; }
  bar.style.display = "flex";
  const cur = rtCurrentType(row);
  bar.innerHTML = `<button type="button" class="students ${cur === "students" ? "on" : ""}" data-type="students" title="Students of this school">🎓 Students</button>
                   <button type="button" class="staff ${cur === "staff" ? "on" : ""}" data-type="staff" title="Teachers, drivers, office staff and management">👩‍🏫 Staff</button>`;
  bar.onclick = e => {
    const b = e.target.closest("button[data-type]");
    if (!b || b.classList.contains("on")) return;
    rtSetType(b.getAttribute("data-type"));
    rtRenderTabs(anchor, row, onChange);
    onChange(b.getAttribute("data-type"));
  };
}

/* ── 👁 POSSIBLE DUPLICATE: side-by-side comparison (Bulk Upload + Add Records) ──
   Loads ONE saved record only when asked, shows it next to the new entry, and lets the person decide.
   opts: { school, type: "students"|"staff", id, reason, entry: [[label, value], ...],
           skipLabel, allowLabel, onSkip(), onAllow() } */
function rtNiceValue(v) {
  const s = String(v === undefined || v === null ? "" : v).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})T/.exec(s);                 // 2012-12-31T18:30:00.000Z -> 31/12/2012 (local date)
  if (iso) { const d = new Date(s); if (!isNaN(d)) return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; }
  return s.replace(/^'/, "");
}

async function rtShowCompare(opts) {
  const esc = v => String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
  const who = opts.type === "staff" ? "staff member" : "student";
  let box = document.getElementById("rtCompare");
  if (!box) {
    box = document.createElement("div");
    box.id = "rtCompare";
    box.style.cssText = "position:fixed; inset:0; background:rgba(15,23,42,.55); z-index:4000; display:flex; align-items:center; justify-content:center;";
    document.body.appendChild(box);
  }
  const shell = inner => `<div style="background:#fff; border-radius:14px; padding:22px; width:640px; max-width:94%; max-height:90vh; overflow:auto; box-shadow:0 10px 40px rgba(0,0,0,.25); font-size:14px; position:relative;">
      <span id="rtCmpClose" title="Close (decide later)" style="position:absolute; top:12px; right:16px; cursor:pointer; font-size:18px; color:#6b7280;">✕</span>
${inner}</div>`;
  const title = () => `<h3 style="margin:0 0 4px; color:#b45309; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">⚠ Possible duplicate
      <span id="rtCmpCounter" style="${opts.counter ? "" : "display:none;"} background:#b45309; color:#fff; border-radius:12px; padding:2px 10px; font-size:13px;">${esc(opts.counter || "")}</span></h3>`;
  box.innerHTML = shell(`${title()}<p style="color:#6b7280;">⏳ Loading ${esc(opts.id)}…</p>`);
  box.style.display = "flex";
  const closeLater = () => { box.style.display = "none"; if (opts.onClose) opts.onClose(); };
  box.querySelector("#rtCmpClose").onclick = closeLater;

  let rec = Array.isArray(opts.record) ? opts.record : null, err = "";
  if (!rec) {                                    // older answers without the record: fetch it once
    try {
      const res = await (await fetch(`${API_URL}?${new URLSearchParams({ action: "getRecordForCompare", school: opts.school, type: opts.type, id: opts.id })}`)).json();
      if (res && res.record) rec = res.record; else err = (res && res.error) || "Could not load the saved record";
    } catch (e) { err = "No answer from the server"; }
  }

  const saved = {};
  (rec || []).forEach(([k, v]) => { saved[norm(k)] = { label: k, value: rtNiceValue(v) }; });
  const used = {};
  const lines = [];
  (opts.entry || []).forEach(([label, value]) => {
    const k = norm(label); used[k] = true;
    lines.push({ label, mine: rtNiceValue(value), theirs: saved[k] ? saved[k].value : "" });
  });
  Object.keys(saved).forEach(k => {           // fields only the saved record has (shown after the entry's own fields)
    if (used[k] || ["photo_link", "timestamp", "added_by", "student_id", "staff_id"].includes(k)) return;
    lines.push({ label: saved[k].label, mine: "", theirs: saved[k].value });
  });
  const shown = lines.filter(l => l.mine || l.theirs);
  const matched = shown.filter(l => l.mine && l.mine.toLowerCase() === l.theirs.toLowerCase());
  const row = l => {
    const same = l.mine && l.mine.toLowerCase() === l.theirs.toLowerCase();
    const bg = same ? "#ecfdf5" : "";
    const cell = v => v ? esc(v) : `<span style="color:#9ca3af;">—</span>`;
    return `<tr style="background:${bg};">
      <td style="padding:7px 8px; color:${same ? "#047857" : "#374151"}; font-weight:600; white-space:nowrap;">${same ? "✓ " : ""}${esc(l.label)}</td>
      <td style="padding:7px 8px;">${cell(l.mine)}</td>
      <td style="padding:7px 8px;">${cell(l.theirs)}</td></tr>`;
  };
  const photo = saved.photo_link && saved.photo_link.value && typeof getPhotoUrl === "function"
    ? `<img src="${getPhotoUrl(saved.photo_link.value, "w_160,h_160,c_fill")}" style="width:96px; height:96px; border-radius:10px; object-fit:cover; border:1px solid #e5e7eb;">`
    : `<div style="width:96px; height:96px; border-radius:10px; background:#f1f5f9; color:#9ca3af; display:flex; align-items:center; justify-content:center; font-size:12px;">No photo</div>`;
  const added = saved.added_by ? `Added${saved.timestamp ? " " + esc(saved.timestamp.value) : ""}<br>by ${esc(saved.added_by.value)}` : "";

  box.innerHTML = shell(`
    ${title()}
    <p style="margin:0 0 10px; color:#374151;">This looks like a ${who} who is already saved as <b>${esc(opts.id)}</b>.</p>
    ${matched.length ? `<div style="margin:0 0 12px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <span style="font-size:12px; color:#6b7280;">Matched on:</span>
        ${matched.map(m => `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; border-radius:12px; padding:2px 10px; font-size:12px; font-weight:600;">${esc(m.label)}</span>`).join("")}
      </div>` : ""}
    ${err ? `<p style="color:#b91c1c;">${esc(err)}</p>` : `
    <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">
      <table style="border-collapse:collapse; flex:1; min-width:300px;">
        <tr style="border-bottom:2px solid #e5e7eb;"><th></th>
          <th style="text-align:left; padding:6px 8px; color:#1d4ed8;">You are adding</th>
          <th style="text-align:left; padding:6px 8px; color:#92400e;">Already saved (${esc(opts.id)})</th></tr>
        ${shown.map(row).join("")}
      </table>
      <div style="text-align:center; font-size:12px; color:#6b7280; width:110px;">${photo}<div style="margin-top:6px;">${added}</div></div>
    </div>`}
    <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
      <div style="flex:1; min-width:200px;">
        <button type="button" id="rtCmpSkip" style="width:100%; padding:11px; border-radius:8px; border:1px solid #9ca3af; background:#f9fafb; cursor:pointer; font-weight:600;">
          ✋ ${esc(opts.skipLabel || "Same person — don't add")}</button>
        <div style="font-size:11px; color:#6b7280; margin-top:4px; text-align:center;">Nothing is added. ${esc(opts.id)} stays as it is.</div>
      </div>
      <div style="flex:1; min-width:200px;">
        <button type="button" id="rtCmpAllow" style="width:100%; padding:11px; border-radius:8px; border:none; background:#d97706; color:#fff; cursor:pointer; font-weight:600;">
          ➕ ${esc(opts.allowLabel || "Different person — add anyway")}</button>
        <div style="font-size:11px; color:#6b7280; margin-top:4px; text-align:center;">They only look alike: added with a new ID.</div>
      </div>
    </div>
    <button type="button" id="rtCmpLater" style="width:100%; margin-top:10px; padding:9px; border-radius:8px; border:1px dashed #9ca3af; background:#fff; color:#374151; cursor:pointer; font-weight:600;"
      title="${opts.safe ? "Keep it in 'Waiting for your decision' and decide later" : "Close without deciding"}">${opts.safe ? "⏸ Decide later — keep it waiting" : "Close"}</button>`);
  box.querySelector("#rtCmpClose").onclick = closeLater;
  const later = box.querySelector("#rtCmpLater");
  if (later) {
    later.onclick = ev => { ev.preventDefault(); closeLater(); };
    if (opts.safe) { later.tabIndex = -1; later.addEventListener("keydown", ev => { ev.preventDefault(); ev.stopPropagation(); }); }
  }
  const bSkip = box.querySelector("#rtCmpSkip"), bAllow = box.querySelector("#rtCmpAllow");
  bSkip.onclick = () => { box.style.display = "none"; if (opts.onSkip) opts.onSkip(); };
  bAllow.onclick = () => { box.style.display = "none"; if (opts.onAllow) opts.onAllow(); };
  // Keystroke-safe (opened by itself while someone may be typing): the buttons never take the keyboard,
  // ignore Enter/Space, and only accept a mouse click after one second.
  if (opts.safe) {
    [bSkip, bAllow].forEach(b => {
      b.tabIndex = -1;
      b.style.pointerEvents = "none"; b.style.opacity = ".6";
      b.addEventListener("keydown", ev => { ev.preventDefault(); ev.stopPropagation(); });
      setTimeout(() => { b.style.pointerEvents = ""; b.style.opacity = ""; }, 1000);
    });
  }
  box.onclick = e => { if (e.target === box) closeLater(); };
}

/* ── Duplicates found at Submit open by themselves, one at a time ("1 of 3") ── */
const rtCompareQueue = [];
let rtCompareOpen = false;
function rtQueueCompare(opts) {
  rtCompareQueue.push(opts);
  if (!rtCompareOpen) { rtShowNextCompare(); return; }
  const c = document.getElementById("rtCmpCounter");           // one is open: "Duplicate 1 of N" grows as more arrive
  if (c) { c.textContent = `Duplicate 1 of ${rtCompareQueue.length + 1}`; c.style.display = ""; }
}
function rtShowNextCompare() {
  const next = rtCompareQueue.shift();
  if (!next) { rtCompareOpen = false; return; }
  rtCompareOpen = true;
  const total = rtCompareQueue.length + 1;
  const done = fn => () => { if (fn) fn(); setTimeout(rtShowNextCompare, 50); };
  rtShowCompare(Object.assign({}, next, { safe: true, counter: total > 1 ? `Duplicate 1 of ${total}` : "",
    onSkip: done(next.onSkip), onAllow: done(next.onAllow), onClose: done(next.onClose) }));
}

/* ── ADD RECORDS: "⚠ Waiting for your decision" list + "Recent Entries" (last 3 saved) ── */
function rtEnsurePendingCard() {
  let card = document.getElementById("rtPendingCard");
  const recent = document.getElementById("recentTable");
  if (card || !recent) return card;
  const recentCard = recent.closest(".card");
  // Its own styles, so the page's stylesheet (fixed-width cells, table-specific button colours) can never
  // hide the buttons or cut the warning text.
  if (!document.getElementById("rtPendingCss")) {
    const st = document.createElement("style");
    st.id = "rtPendingCss";
    st.textContent = `
      #rtPendingCard table { width:100%; border-collapse:collapse; table-layout:auto; }
      #rtPendingCard th, #rtPendingCard td { white-space:normal !important; overflow:visible !important; text-overflow:clip !important;
        max-width:none !important; vertical-align:middle; padding:8px; }
      #rtPendingCard td:last-child { min-width:250px; }
      #rtPendingCard td:first-child { min-width:150px; }
      #rtPendingCard button { display:inline-block !important; visibility:visible !important; opacity:1 !important;
        margin:3px 4px 3px 0; padding:6px 12px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer;
        border:1px solid #d1d5db; background:#fff; color:#1f2937; position:static; }
      #rtPendingCard button:hover { background:#f3f4f6; }
      #rtPendingCard button.delete-btn { border-color:#dc2626; background:#fef2f2; color:#991b1b; }
      #rtPendingCard button.delete-btn:hover { background:#fee2e2; }
      #rtPendingCard button[title^="A different"] { border-color:#d97706; background:#d97706; color:#fff; }
      #rtPendingCard button:disabled { opacity:.6 !important; cursor:not-allowed; }
      #rtEarlyWarn button { display:inline-block !important; visibility:visible !important; opacity:1 !important;
        padding:5px 12px; border-radius:6px; border:1px solid #ca8a04; background:#fff; color:#854d0e; font-weight:600; cursor:pointer; }
      #rtEarlyWarn button:hover { background:#fef3c7; }`;
    document.head.appendChild(st);
  }
  card = document.createElement("div");
  card.className = "card";
  card.id = "rtPendingCard";
  card.style.cssText = "display:none; border:2px solid #dc2626;";
  const head = recent.closest("table").querySelector("thead");
  card.innerHTML = `<h3 style="color:#991b1b; margin-top:0;">⚠ Waiting for your decision</h3>
    <p style="margin:-6px 0 10px; font-size:13px; color:#6b7280;">These entries are <b>NOT saved yet</b>. Decide for each one (possible duplicate) or press Retry (not saved).</p>
    <div class="table-wrapper"><table><thead>${head ? head.innerHTML : ""}</thead><tbody id="pendingTable"></tbody></table></div>`;
  recentCard.parentNode.insertBefore(card, recentCard);
  return card;
}
function rtMoveToPending(tr) {
  const card = rtEnsurePendingCard();
  const body = document.getElementById("pendingTable");
  if (!card || !body) return;
  const head = document.getElementById("recentTable").closest("table").querySelector("thead");
  card.querySelector("thead").innerHTML = head ? head.innerHTML : "";      // the same columns as Recent Entries
  body.appendChild(tr);
  card.style.display = "";
  rtUpdatePendingBanner();
}
function rtMoveToRecent(tr) {
  const recent = document.getElementById("recentTable");
  if (!recent) return;
  recent.insertBefore(tr, recent.firstChild);
  rtTrimRecent();
  rtUpdatePendingBanner();
}
// Recent Entries keeps the last 3 saved; a row that is still saving is never removed
function rtTrimRecent() {
  const recent = document.getElementById("recentTable");
  if (!recent) return;
  let rows = [...recent.querySelectorAll(":scope > tr")];
  while (rows.length > 3) {
    const victim = rows.slice().reverse().find(r => r.dataset.state !== "saving");
    if (!victim) break;
    victim.remove();
    rows = [...recent.querySelectorAll(":scope > tr")];
  }
}
function rtPendingCount() {
  const b = document.getElementById("pendingTable");
  return b ? b.querySelectorAll(":scope > tr").length : 0;
}
function rtHasUnsaved() {
  return rtPendingCount() > 0 || [...document.querySelectorAll("#recentTable > tr")].some(r => r.dataset.state === "saving");
}
function rtUpdatePendingBanner() {
  const n = rtPendingCount();
  const card = document.getElementById("rtPendingCard");
  if (card) card.style.display = n ? "" : "none";
  let b = document.getElementById("rtPendingBanner");
  const form = document.getElementById("dynamicForm");
  if (!b && form) {
    b = document.createElement("div");
    b.id = "rtPendingBanner";
    b.style.cssText = "display:none; margin:0 0 12px; padding:10px 12px; border-radius:8px; background:#fef2f2; border:2px solid #dc2626; color:#991b1b; font-weight:600; cursor:pointer;";
    b.title = "Show the entries waiting for a decision";
    b.onclick = () => { const c = document.getElementById("rtPendingCard"); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: "smooth", block: "center" }); };
    form.parentNode.insertBefore(b, form);
  }
  if (!b) return;
  b.style.display = n ? "block" : "none";
  b.textContent = n ? `⚠ ${n} ${n === 1 ? "entry is" : "entries are"} waiting for your decision — NOT saved yet. Click to review.` : "";
}

/* ── EARLY WARNING while typing (Add Records): a quiet background check, a yellow line under the form ──
   getEntry() -> { type, school, payload: {normalised keys}, entry: [[label, value]], ready: bool }
   The page reads rtEarlyAllowed() at Submit: true = the person already said "different person". */
let rtEarlyTimer = null, rtEarlySeq = 0, rtEarlyAck = "";
function rtSetupEarlyWarning(getEntry, onSamePerson) {
  const form = document.getElementById("dynamicForm");
  if (!form || form.dataset.rtEarly) return;
  form.dataset.rtEarly = "1";
  const run = async () => {
    const e = getEntry();
    if (!e || !e.ready) { rtHideEarly(); return; }
    const sig = JSON.stringify(e.payload);
    if (rtEarlyAck && rtEarlyAck !== sig) rtEarlyAck = "";                // the entry changed: ask again
    const seq = ++rtEarlySeq;
    let res = null;
    try { res = await postToApi({ action: "checkDuplicates", school: e.school, type: e.type, rows: [e.payload] }); } catch (err) { res = null; }
    if (seq !== rtEarlySeq || !res || !Array.isArray(res.results)) return;
    const hit = res.results.find(x => x.id);
    if (!hit || rtEarlyAck === sig) { rtHideEarly(); return; }
    rtShowEarly(hit, e, sig, onSamePerson);
  };
  const schedule = () => { clearTimeout(rtEarlyTimer); rtEarlyTimer = setTimeout(run, 700); };
  form.addEventListener("input", schedule);
  form.addEventListener("change", schedule);
}
function rtShowEarly(hit, e, sig, onSamePerson) {
  rtEnsurePendingCard();          // also installs the protective styles used by the warning's button
  const esc = v => String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let w = document.getElementById("rtEarlyWarn");
  const form = document.getElementById("dynamicForm");
  if (!w) {
    w = document.createElement("div");
    w.id = "rtEarlyWarn";
    w.style.cssText = "margin:10px 0 0; padding:10px 12px; border-radius:8px; background:#fef9c3; border:1px solid #facc15; color:#854d0e; font-size:14px;";
    form.parentNode.insertBefore(w, form.nextSibling);
  }
  w.innerHTML = `⚠ Looks like <b>${esc(hit.id)}</b> — ${esc(hit.name)} <span style="color:#a16207;">(${esc(hit.reason)})</span>
    <button type="button" id="rtEarlyView" class="edit-btn" style="margin-left:8px;" title="Compare before saving">👁 View</button>`;
  w.style.display = "block";
  w.querySelector("#rtEarlyView").onclick = ev => {
    if (ev) ev.preventDefault();
    rtShowCompare({ school: e.school, type: e.type, id: hit.id, reason: hit.reason, entry: e.entry, record: hit.record,
      skipLabel: "Same person — clear the form", allowLabel: "Different person — continue",
      onSkip: () => { rtHideEarly(); if (onSamePerson) onSamePerson(); },
      onAllow: () => { rtEarlyAck = sig; rtHideEarly(); } });
  };
}
function rtHideEarly() { const w = document.getElementById("rtEarlyWarn"); if (w) w.style.display = "none"; }
function rtEarlyAllowed(payload) { return !!rtEarlyAck && rtEarlyAck === JSON.stringify(payload); }
function rtEarlyReset() { rtEarlyAck = ""; rtEarlySeq++; rtHideEarly(); }

// A red message that is hard to miss (pages keep their own toast; this one overrides the colours briefly)
function rtAlertToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.style.display = "block";
  t.style.background = "#dc2626"; t.style.color = "#fff";
  clearTimeout(t._rt);
  t._rt = setTimeout(() => { t.style.display = "none"; t.style.background = ""; t.style.color = ""; }, 5000);
}
