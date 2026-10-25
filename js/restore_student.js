/* =============================================
   restore_student.js - Restore Records
   🎓 Students (deleted_students sheet) | 👩‍🏫 Staff (Status = Deleted in each staff sheet)
   Restore one / selected. Admins: delete permanently (type DELETE to confirm). Honest results.
   ============================================= */
const RS_IS_ADMIN = sessionStorage.getItem("role") === "admin";
let rsPerms = [];
try { rsPerms = JSON.parse(sessionStorage.getItem("permissions") || "[]") || []; } catch (err) { rsPerms = []; }
const RS_CAN_STAFF = RS_IS_ADMIN || rsPerms.includes("staff");

let rsType = (sessionStorage.getItem("restoreType") === "staff" && RS_CAN_STAFF) ? "staff" : "students";
let rsItems = [];             // { key, id, name, g1, g2, school, schoolName, deletedOn, deletedBy, photo }
let rsSelected = new Set();
let rsSchoolNames = {};
let rsBusy = false;

const rsEsc = v => String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function showToast(msg, type) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.className = "toast" + (type ? " toast-" + type : "");
  t.style.display = "block";
  clearTimeout(t._h);
  t._h = setTimeout(() => t.style.display = "none", 3500);
}

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── LOAD ── */
async function rsLoad() {
  document.getElementById("rsBody").innerHTML = `<tr><td class="rs-empty">⏳ Loading…</td></tr>`;
  rsSelected.clear();
  if (!Object.keys(rsSchoolNames).length) {
    try {
      const raw = await getSchools();
      const h = raw[0];
      raw.slice(1).forEach(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); rsSchoolNames[String(o.school).toLowerCase()] = o.school_name || o.school; });
    } catch (err) { /* names fall back to codes */ }
  }
  const nameOf = code => rsSchoolNames[String(code).toLowerCase()] || code;

  if (rsType === "staff") {
    const res = await getDeletedStaffList();
    if (!res || res.error) { rsShowLoadError(res); return; }
    rsItems = (res.staff || []).map(s => ({
      key: s.school + "|" + s.staff_id, id: s.staff_id, name: s.name, g1: s.category, g2: s.designation,
      school: s.school, schoolName: s.school_name || nameOf(s.school), deletedOn: s.deleted_at, deletedBy: s.deleted_by, photo: s.photo_link }));
  } else {
    const raw = await getDeletedStudentsRaw();
    if (!Array.isArray(raw)) { rsShowLoadError(raw); return; }
    rsItems = raw.slice(1).map(r => {
      let hs = [], row = [];
      try { hs = JSON.parse(r[4] || "[]"); row = JSON.parse(r[5] || "[]"); } catch (err) { /* old rows */ }
      const o = {};
      hs.forEach((h, i) => { o[String(h).toLowerCase()] = row[i]; });
      return { key: String(r[0]), id: String(r[0]), name: o.name || "", g1: o.class || "", g2: o.section || "",
               school: String(r[1]), schoolName: nameOf(r[1]), deletedOn: r[3], deletedBy: "", photo: o.photo_link || "" };
    });
  }
  rsFillFilters();
  rsRender();
}

function rsShowLoadError(res) {
  rsItems = [];
  document.getElementById("rsBody").innerHTML = `<tr><td class="rs-empty" style="color:#b91c1c;">Could not load: ${rsEsc((res && res.error) || "no answer from the server")}</td></tr>`;
}

/* ── LABELS + FILTERS ── */
function rsApplyLabels() {
  const staff = rsType === "staff";
  document.getElementById("rsHeading").textContent = staff ? "♻️ Restore Staff" : "♻️ Restore Students";
  document.getElementById("rsHeading").style.background = staff ? "#d1fae5" : "";
  document.querySelectorAll("#rsTabs button").forEach(b => b.classList.toggle("on", b.dataset.type === rsType));
  document.getElementById("btnPurgeSel").style.display = RS_IS_ADMIN ? "" : "none";
  document.getElementById("filterGroup1").title = staff ? "Only this category" : "Only this class";
  document.getElementById("filterGroup2").title = staff ? "Only this designation" : "Only this section";
}

function rsFillFilters() {
  const uniq = arr => [...new Set(arr.filter(v => v !== "" && v !== undefined && v !== null).map(String))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const staff = rsType === "staff";
  const fill = (id, label, values) => {
    const el = document.getElementById(id), keep = el.value;
    el.innerHTML = `<option value="">${label}</option>` + values.map(v => `<option value="${rsEsc(v)}">${rsEsc(v)}</option>`).join("");
    if (values.includes(keep)) el.value = keep;
  };
  const schools = uniq(rsItems.map(x => x.school));
  const sel = document.getElementById("filterSchool"), keepS = sel.value;
  sel.innerHTML = `<option value="">All schools</option>` + schools.map(c => `<option value="${rsEsc(c)}">${rsEsc((rsItems.find(x => x.school === c) || {}).schoolName || c)}</option>`).join("");
  if (schools.includes(keepS)) sel.value = keepS;
  fill("filterGroup1", staff ? "All categories" : "All classes", uniq(rsItems.map(x => x.g1)));
  fill("filterGroup2", staff ? "All designations" : "All sections", uniq(rsItems.map(x => x.g2)));
}

function rsShown() {
  const q  = (document.getElementById("searchName").value || "").trim().toLowerCase();
  const sc = document.getElementById("filterSchool").value;
  const g1 = document.getElementById("filterGroup1").value;
  const g2 = document.getElementById("filterGroup2").value;
  return rsItems.filter(x =>
    (!q || String(x.name).toLowerCase().includes(q) || String(x.id).toLowerCase().includes(q)) &&
    (!sc || x.school === sc) && (!g1 || String(x.g1) === g1) && (!g2 || String(x.g2) === g2));
}

/* ── TABLE ── */
function rsRender() {
  rsApplyLabels();
  const staff = rsType === "staff";
  document.getElementById("rsHead").innerHTML = `<tr><th></th><th>${staff ? "Staff ID" : "Student ID"}</th><th>Name</th>
    <th>${staff ? "Category" : "Class"}</th><th>${staff ? "Designation" : "Section"}</th><th>School</th><th>Deleted on</th>
    ${staff ? "<th>Deleted by</th>" : ""}<th>Action</th></tr>`;
  const list = rsShown();
  const body = document.getElementById("rsBody");
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="9" class="rs-empty">${rsItems.length ? "No records match the filters." : (staff ? "No deleted staff." : "No deleted students.")}</td></tr>`;
  } else {
    body.innerHTML = list.map(x => `<tr data-key="${rsEsc(x.key)}">
      <td><input type="checkbox" class="rsCheck" ${rsSelected.has(x.key) ? "checked" : ""} title="Select"></td>
      <td>${rsEsc(x.id)}</td><td>${rsEsc(x.name)}</td><td>${rsEsc(x.g1)}</td><td>${rsEsc(x.g2)}</td>
      <td>${rsEsc(x.schoolName)}</td><td>${rsEsc(fmtDate(x.deletedOn))}</td>${staff ? `<td>${rsEsc(x.deletedBy)}</td>` : ""}
      <td style="white-space:nowrap;">
        <button type="button" class="rs-row-btn restore" data-act="restore" title="Put this record back where it was">↩ Restore</button>
        ${RS_IS_ADMIN ? `<button type="button" class="rs-row-btn purge" data-act="purge" title="Remove this record for good">🗑 Delete permanently</button>` : ""}
      </td></tr>`).join("");
  }
  rsUpdateCount();
}

function rsUpdateCount() {
  const shownKeys = rsShown().map(x => x.key);
  [...rsSelected].forEach(k => { if (!rsItems.some(x => x.key === k)) rsSelected.delete(k); });
  document.getElementById("rsCount").textContent = `Selected: ${rsSelected.size}`;
  const all = document.getElementById("selectAllShown");
  all.checked = shownKeys.length > 0 && shownKeys.every(k => rsSelected.has(k));
  all.indeterminate = !all.checked && shownKeys.some(k => rsSelected.has(k));
  document.getElementById("btnRestoreSel").disabled = rsBusy || !rsSelected.size;
  document.getElementById("btnPurgeSel").disabled = rsBusy || !rsSelected.size;
}

/* ── ACTIONS (chunks of 25, honest per-record results) ── */
async function rsRun(keys, purge) {
  if (rsBusy || !keys.length) return;
  rsBusy = true; rsUpdateCount();
  const staff = rsType === "staff";
  const prog = document.getElementById("rsProgress"), result = document.getElementById("rsResult");
  result.style.display = "none"; prog.style.display = "block";
  const ok = [], failed = [];
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    prog.textContent = `⏳ ${purge ? "Deleting" : "Restoring"} ${Math.min(i + chunk.length, keys.length)} of ${keys.length}…`;
    const ids = chunk.map(k => staff ? k : k);
    let res;
    if (staff) res = purge ? await purgeStaffMany(ids) : await restoreStaffMany(ids);
    else       res = purge ? await purgeStudentsMany(ids) : await restoreStudentsMany(ids);
    if (!res || res.error || !Array.isArray(res.results)) {
      chunk.forEach(k => failed.push({ k, why: (res && res.error) || "no answer from the server" }));
      continue;
    }
    res.results.forEach((r, j) => {
      const k = chunk[j];
      if (r.ok) {
        ok.push(k);
        if (purge && r.photo_link) { try { deleteCloudinaryPhoto(String(r.photo_link).split("|")[0]); } catch (err) { /* best effort */ } }
      } else failed.push({ k, why: r.error || "failed" });
    });
  }
  prog.style.display = "none";
  rsBusy = false;
  const label = k => { const x = rsItems.find(y => y.key === k); return x ? `${x.id} ${x.name}` : k; };
  const verb = purge ? "Deleted permanently" : "Restored";
  result.className = "rs-result " + (failed.length ? "bad" : "ok");
  result.innerHTML = `✓ ${verb}: <b>${ok.length}</b>` + (failed.length
    ? ` · ❌ Not done: <b>${failed.length}</b><br>` + failed.map(f => `${rsEsc(label(f.k))} — ${rsEsc(f.why)}`).join("<br>") : "");
  result.style.display = "block";
  showToast(`${verb}: ${ok.length}` + (failed.length ? ` · ${failed.length} not done` : ""), failed.length ? "error" : "success");
  ok.forEach(k => rsSelected.delete(k));
  await rsLoad();
}

function rsConfirmPurge(keys) {
  if (!RS_IS_ADMIN || !keys.length) return;
  const list = keys.map(k => rsItems.find(x => x.key === k)).filter(Boolean);
  document.getElementById("rsConfirmText").textContent =
    `You are about to delete ${list.length} ${rsType === "staff" ? "staff record(s)" : "student record(s)"} permanently:`;
  document.getElementById("rsConfirmList").innerHTML = list.slice(0, 15).map(x => `<li>${rsEsc(x.id)} — ${rsEsc(x.name)} (${rsEsc(x.schoolName)})</li>`).join("")
    + (list.length > 15 ? `<li>… and ${list.length - 15} more</li>` : "");
  const input = document.getElementById("rsConfirmInput"), go = document.getElementById("rsConfirmGo");
  input.value = ""; go.disabled = true;
  input.oninput = () => { go.disabled = input.value.trim() !== "DELETE"; };
  go.onclick = () => { document.getElementById("rsConfirm").style.display = "none"; rsRun(keys, true); };
  document.getElementById("rsConfirmCancel").onclick = () => { document.getElementById("rsConfirm").style.display = "none"; };
  document.getElementById("rsConfirm").style.display = "flex";
  input.focus();
}

/* ── EVENTS ── */
document.getElementById("rsBody").addEventListener("click", e => {
  const tr = e.target.closest("tr[data-key]");
  if (!tr) return;
  const key = tr.getAttribute("data-key");
  if (e.target.classList.contains("rsCheck")) {
    e.target.checked ? rsSelected.add(key) : rsSelected.delete(key);
    rsUpdateCount();
    return;
  }
  const b = e.target.closest("button[data-act]");
  if (!b || rsBusy) return;
  const x = rsItems.find(y => y.key === key);
  if (b.dataset.act === "restore") {
    if (!confirm(`Restore ${x.id} — ${x.name}?`)) return;
    rsRun([key], false);
  } else if (b.dataset.act === "purge") {
    rsConfirmPurge([key]);
  }
});
document.getElementById("selectAllShown").addEventListener("change", e => {
  rsShown().forEach(x => e.target.checked ? rsSelected.add(x.key) : rsSelected.delete(x.key));
  rsRender();
});
document.getElementById("btnRestoreSel").addEventListener("click", () => {
  const keys = [...rsSelected];
  if (!keys.length) return;
  if (!confirm(`Restore ${keys.length} selected record(s)?`)) return;
  rsRun(keys, false);
});
document.getElementById("btnPurgeSel").addEventListener("click", () => rsConfirmPurge([...rsSelected]));
["searchName"].forEach(id => document.getElementById(id).addEventListener("input", rsRender));
["filterSchool", "filterGroup1", "filterGroup2"].forEach(id => document.getElementById(id).addEventListener("change", rsRender));
document.getElementById("rsTabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-type]");
  if (!b || b.dataset.type === rsType || rsBusy) return;
  rsType = b.dataset.type;
  sessionStorage.setItem("restoreType", rsType);
  ["searchName", "filterSchool", "filterGroup1", "filterGroup2"].forEach(id => { document.getElementById(id).value = ""; });
  document.getElementById("rsResult").style.display = "none";
  rsLoad();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") document.getElementById("rsConfirm").style.display = "none"; });

document.getElementById("rsTabs").style.display = RS_CAN_STAFF ? "flex" : "none";
rsApplyLabels();
rsLoad();
