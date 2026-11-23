/* =============================================
   new_session.js (SE2) - 🔁 move one school to its next academic session
   1. Shows where the school is (current session, next one and when it starts).
   2. Proposes the next class for every class (the admin can change any line).
   3. Start: the server keeps the finished session as it is (frozen), then moves the classes up.
   4. ↩ Undo the latest promotion while nothing has happened in the new session yet.
   Admins, and people an admin gave 🔁 Session & promotion (SE3a). The server checks it too.
   ============================================= */
const NS_PASSED = "__PASSED__", NS_SAME = "__SAME__", NS_OTHER = "__OTHER__";
let nsInfo = null, nsBusy = false;

const nsEsc = v => String(v === undefined || v === null ? "" : v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nsEl = id => document.getElementById(id);

function nsBox(id, kind, html) {
  const b = nsEl(id);
  if (!b) return;
  b.className = "ns-box " + (kind || "");
  b.innerHTML = html || "";
  b.style.display = html ? "block" : "none";
}

function nsWhen(v) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function nsMayRunSessions() {
  if (sessionStorage.getItem("role") === "admin") return true;
  try { return JSON.parse(sessionStorage.getItem("permissions") || "[]").includes("session"); } catch (err) { return false; }
}

async function nsInit() {
  if (!nsMayRunSessions()) { nsEl("nsAdminOnly").style.display = "block"; return; }
  nsEl("nsMain").style.display = "block";
  const raw = await getSchools(true);
  const h = raw[0] || [];
  const schools = raw.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; })
    .filter(s => String(s.school || "").trim() !== "")
    .sort((a, b) => String(a.school_name || a.school).localeCompare(String(b.school_name || b.school)));
  const wanted = new URLSearchParams(location.search).get("school") || sessionStorage.getItem("school") || "";
  const sel = nsEl("nsSchool");
  sel.innerHTML = `<option value="">— choose a school —</option>` + schools.map(s =>
    `<option value="${nsEsc(s.school)}">${nsEsc(s.school_name || s.school)} (${nsEsc(s.school)})</option>`).join("");
  const match = schools.find(s => String(s.school).toLowerCase() === String(wanted).toLowerCase());
  if (match) sel.value = String(match.school);
  sel.onchange = () => nsLoad();
  nsEl("nsChecked").onchange = nsUpdateButton;
  nsEl("nsEarly").onchange = nsUpdateButton;
  nsEl("nsDeletePreview").onclick = nsDeletePreview;
  nsEl("nsStart").onclick = nsStart;
  await nsLoad();
}

async function nsLoad() {
  const school = nsEl("nsSchool").value;
  nsInfo = null;
  nsEl("nsPlan").style.display = "none";
  nsEl("nsFacts").innerHTML = "";
  nsBox("nsMsg", "", ""); nsBox("nsLast", "", "");
  if (!school) return;
  nsBox("nsMsg", "info", "Loading…");
  const res = await apiGet({ action: "getNewSessionInfo", school });
  if (!res || res.error || res.status !== "ok") {
    nsBox("nsMsg", "bad", nsEsc((res && (res.error || res.auth_error)) || "Could not load this school."));
    return;
  }
  nsInfo = res;
  nsEl("schoolNameTop").textContent = res.school_name || res.school;
  nsEl("nsFacts").innerHTML = [
    ["Current session", res.active + (res.active_started ? "" : ` (starts ${res.active_starts})`)],
    ["Next session", `${res.next}`],
    ["Next session starts", res.next_starts],
    ["Students in school", res.students],
    ["Last class", res.last_class || `${res.last_class_label} (default)`],
    ["Earlier sessions kept", res.frozen_sessions.length ? res.frozen_sessions.join(", ") : "none yet"]
  ].map(([k, v]) => `<div class="ns-fact"><small>${nsEsc(k)}</small><b>${nsEsc(v)}</b></div>`).join("");

  if (res.unfinished) {
    nsBox("nsMsg", "bad", `⚠ ${nsEsc(res.promote_problem)}
      <div style="margin-top:8px;"><button class="ns-btn" id="nsUndo">↩ Put back</button></div>`);
    nsEl("nsUndo").onclick = () => nsUndo(true);
  } else if (!res.can_promote) {
    nsBox("nsMsg", "warn", `🔒 ${nsEsc(res.promote_problem)}`);
  } else {
    nsBox("nsMsg", "", "");
  }

  const lp = res.last_promotion;
  if (lp && lp.to === res.active) {
    nsBox("nsLast", lp.can_undo ? "ok" : "info",
      `<b>Last promotion:</b> ${nsEsc(lp.from)} → ${nsEsc(lp.to)} by ${nsEsc(lp.by)} on ${nsEsc(nsWhen(lp.at))}
       (${nsEsc(lp.students)} students, ${nsEsc(lp.passed_out)} passed out).
       ${lp.can_undo
         ? `<div style="margin-top:8px;"><button class="ns-btn" id="nsUndo" title="Put every class back to ${nsEsc(lp.from)} and make ${nsEsc(lp.from)} the current session again">↩ Undo this promotion</button>
            <span style="font-size:12px; color:#6b7280; margin-left:6px;">Possible until the first change in ${nsEsc(lp.to)}.</span></div>`
         : `<div style="margin-top:6px; font-size:13px;">Undo is no longer possible: ${nsEsc(lp.undo_problem)}</div>`}`);
    if (lp.can_undo) nsEl("nsUndo").onclick = () => nsUndo(false);
  }

  nsRenderPlan();
}

function nsRenderPlan() {
  const res = nsInfo;
  if (!res) return;
  nsEl("nsPlan").style.display = "block";
  nsEl("nsPlanTitle").textContent = `Classes in ${res.next}`;
  nsEl("nsStart").textContent = `🔁 Start ${res.next}`;
  nsEl("nsChecked").checked = false;
  nsEl("nsEarly").checked = false;
  nsEl("nsEarlyRow").style.display = res.can_promote_early ? "flex" : "none";
  nsEl("nsEarlyText").textContent = `⚡ Promote early: I understand ${res.next} hasn't started yet (it starts ${res.next_starts})`;
  nsRenderDeleteCard();
  if (!res.classes.length) {
    nsEl("nsBody").innerHTML = `<tr><td colspan="4" style="color:#6b7280;">No students in school — only the session changes.</td></tr>`;
  } else {
    nsEl("nsBody").innerHTML = res.classes.map((c, i) => {
      const opts = res.choices.map(x => `<option value="${nsEsc(x)}" ${x === c.next ? "selected" : ""}>${nsEsc(x)}</option>`).join("");
      return `<tr data-i="${i}">
        <td><b>${c.class === "" ? "(no class)" : nsEsc(c.class)}</b></td>
        <td>${nsEsc(c.count)}</td>
        <td><select class="nsNext" data-class="${nsEsc(c.class)}" title="Where the students of ${nsEsc(c.class || "(no class)")} go in ${nsEsc(res.next)}">
          <option value="" ${c.next ? "" : "selected"}>— choose —</option>
          <option value="${NS_PASSED}" ${c.next === NS_PASSED ? "selected" : ""}>🎓 Passed out</option>
          <option value="${NS_SAME}" ${c.next === NS_SAME ? "selected" : ""}>Stay in the same class</option>
          ${opts}
          <option value="${NS_OTHER}">✏ Other… (type the class)</option>
        </select></td>
        <td class="ns-note">${nsEsc(c.note)}</td>
      </tr>`;
    }).join("");
    document.querySelectorAll(".nsNext").forEach(s => { s.dataset.prev = s.value; s.onchange = () => nsPicked(s); });
  }
  nsUpdateButton();
}

// "Other…": type a class that is not in the list (e.g. "XII Science")
function nsPicked(sel) {
  if (sel.value === NS_OTHER) {
    const typed = String(prompt(`Class in ${nsInfo.next} for the students now in ${sel.dataset.class || "(no class)"}:`) || "").trim().slice(0, 40);
    if (!typed) { sel.value = sel.dataset.prev || ""; nsUpdateButton(); return; }
    let opt = [...sel.options].find(o => o.value === typed);
    if (!opt) {
      opt = document.createElement("option");
      opt.value = typed; opt.textContent = typed;
      sel.insertBefore(opt, sel.querySelector(`option[value="${NS_OTHER}"]`));
    }
    sel.value = typed;
  }
  sel.dataset.prev = sel.value;
  nsUpdateButton();
}

function nsMapping() {
  const m = {};
  document.querySelectorAll(".nsNext").forEach(s => { m[s.dataset.class] = s.value; });
  return m;
}

function nsUpdateButton() {
  const res = nsInfo;
  if (!res) return;
  let up = 0, out = 0, stay = 0, missing = 0;
  document.querySelectorAll(".nsNext").forEach(s => {
    const c = res.classes[Number(s.closest("tr").dataset.i)], n = Number(c.count) || 0;
    s.closest("tr").classList.toggle("need", !s.value || s.value === NS_OTHER);
    s.closest("tr").classList.toggle("passed", s.value === NS_PASSED);
    if (!s.value || s.value === NS_OTHER) missing++;
    else if (s.value === NS_PASSED) out += n;
    else if (s.value === NS_SAME || s.value === String(c.class)) stay += n;
    else up += n;
  });
  nsEl("nsSummary").textContent = missing
    ? `Choose the next class for ${missing} class${missing > 1 ? "es" : ""} (marked red).`
    : `${up} will move up, ${out} will pass out, ${stay} will stay in their class.`;
  const early = !res.can_promote && res.can_promote_early && nsEl("nsEarly").checked;
  const allowed = res.can_promote || early;
  nsEl("nsStart").disabled = nsBusy || !allowed || !!missing || !nsEl("nsChecked").checked;
  // why Start is off, always in sight (the message box above may be showing a success message)
  const lock = nsEl("nsLockNote");
  if (lock) {
    const text = res.can_promote ? "" : early ? `⚡ Early promotion: until ${res.next_starts} only an admin can print ${res.next} cards (checklists are fine).`
               : "🔒 " + res.promote_problem + (res.can_promote_early ? " As an admin you can promote early — tick ⚡ above." : "");
    lock.textContent = text; lock.style.display = text ? "block" : "none";
  }
  nsEl("nsStart").title = !allowed ? res.promote_problem
    : missing ? "Choose the next class for every class first"
    : !nsEl("nsChecked").checked ? "Tick 'I have checked the classes above' first"
    : `Keep ${res.active} as it is now and move every class up`;
}

async function nsStart() {
  const res = nsInfo;
  if (!res || nsBusy) return;
  const sum = nsEl("nsSummary").textContent;
  const early = !res.can_promote && res.can_promote_early && nsEl("nsEarly").checked;
  if (!confirm(`Start ${res.next} for ${res.school_name || res.school}?` + (early ? ` (EARLY: ${res.next} starts on ${res.next_starts})` : "") +
               `\n\n${sum}\n\n${res.active} is kept exactly as it is now (view and reprint only).\nYou can undo this until the first change in ${res.next}.` +
               (early ? `\n\nUntil ${res.next_starts} only an admin can print ${res.next} cards.` : ""))) return;
  nsBusy = true; nsUpdateButton();
  nsEl("nsStart").textContent = "Starting…";
  let out = null;
  try {
    out = await postToApi({ action: "startNewSession", school: res.school, to: res.next, students: res.students, mapping: nsMapping(), early: early });
  } catch (err) { out = { error: "No answer from the server. Reload the page to see whether the session started." }; }
  nsBusy = false;
  if (!out || out.status !== "promoted") {
    nsBox("nsMsg", "bad", "Not started: " + nsEsc((out && (out.error || out.auth_error)) || "unknown error"));
    nsUpdateButton();
    nsEl("nsStart").textContent = `🔁 Start ${res.next}`;
    return;
  }
  sessionStorage.removeItem("schoolsCache");
  sessionStorage.removeItem("dashCache_" + res.school);   // Dashboard counts: no 5-minute-old numbers
  await nsLoad();
  nsBox("nsMsg", "ok", `✅ ${nsEsc(out.to)} has started: ${nsEsc(out.promoted)} moved up, ${nsEsc(out.passed_out)} passed out, ${nsEsc(out.kept)} stayed.
    ${nsEsc(out.from)} is kept and can be opened in Print and Export.`);
}

/* ── SE3b: 🗑 delete the current session (admins) ── */
let nsDel = null;
function nsRenderDeleteCard() {
  const res = nsInfo;
  nsDel = null;
  nsEl("nsDeleteBody").innerHTML = "";
  nsEl("nsDelete").style.display = res && res.can_delete ? "block" : "none";
  if (!res || !res.can_delete) return;
  nsEl("nsDeleteTitle").textContent = `🗑 Delete ${res.active}`;
  nsEl("nsDeleteIntro").textContent = `When Undo is no longer possible. Puts the school back into ${res.delete_back_to} exactly as it was kept ` +
    `(class, section, roll, status). Names, photos and other details stay; the print log stays. You can promote again afterwards.`;
}

async function nsDeletePreview() {
  const res = nsInfo;
  if (!res || nsBusy) return;
  const body = nsEl("nsDeleteBody");
  body.innerHTML = "⏳ Checking…";
  const p = await apiGet({ action: "getDeleteSessionPreview", school: res.school });
  if (!p || p.status !== "ok") { body.innerHTML = `<div class="ns-box bad" style="display:block;">${nsEsc((p && (p.error || p.auth_error)) || "Could not check.")}</div>`; return; }
  nsDel = p;
  const ch = p.changed || {};
  const list = (rows, extra) => rows.map(r => `<li>${nsEsc(r.id)} — ${nsEsc(r.name)} (class ${nsEsc(r.class)}${r.section ? "-" + nsEsc(r.section) : ""})${extra ? extra(r) : ""}</li>`).join("");
  body.innerHTML = `
    <div class="ns-box warn" style="display:block;">
      <b>Deleting ${nsEsc(p.session)} puts the school back into ${nsEsc(p.back_to)}:</b>
      <ul style="margin:6px 0 0 18px; padding:0;">
        <li>${nsEsc(p.restore)} students go back to their ${nsEsc(p.back_to)} class / section / roll / status
            (changed since: ${nsEsc(ch.cls || 0)} classes, ${nsEsc(ch.sec || 0)} sections, ${nsEsc(ch.roll || 0)} rolls, ${nsEsc(ch.status || 0)} statuses).</li>
        ${p.reverted.length ? `<li>${p.reverted.length} re-admitted in ${nsEsc(p.session)} go back to what they were before:<ul>${list(p.reverted, r => " → " + nsEsc(r.back_to))}</ul></li>` : ""}
        ${p.restore_page_fixes ? `<li>${nsEsc(p.restore_page_fixes)} deleted in ${nsEsc(p.session)} get their ${nsEsc(p.back_to)} class back on the Restore page.</li>` : ""}
        <li>${nsEsc(p.cards_printed)} cards printed in ${nsEsc(p.session)} stay in the print log.</li>
        <li>Everything as it is now is archived in the school's enrol sheet as "${nsEsc(p.session)} (deleted)".</li>
      </ul>
    </div>
    ${p.blocked ? `<div class="ns-box bad" style="display:block;">⛔ ${nsEsc(p.blocked)}<ul>${list(p.readmitted)}</ul></div>` : ""}
    ${p.admitted.length ? `<div class="ns-box info" style="display:block;">
        <b>${p.admitted.length} admitted in ${nsEsc(p.session)}</b> — they don't belong to ${nsEsc(p.back_to)}:
        <ul style="margin:6px 0 6px 18px; padding:0;">${list(p.admitted)}</ul>
        <label style="display:block; margin:4px 0;"><input type="radio" name="nsAdm" value="backup" checked style="width:auto;"> 📦 Keep a backup — on the Restore page; nothing comes back by itself</label>
        <label style="display:block; margin:4px 0;"><input type="radio" name="nsAdm" value="permanent" style="width:auto;"> 🗑 Delete permanently — with their photos; can't be undone</label>
      </div>` : ""}
    <label style="display:block; font-size:14px; margin:10px 0 4px;">Type the school code <b>${nsEsc(res.school)}</b> to confirm:</label>
    <input id="nsDeleteCode" autocomplete="off" style="padding:7px 10px; border-radius:8px; border:1px solid #d1d5db; min-width:200px;">
    <button class="ns-btn" id="nsDeleteGo" disabled style="background:#dc2626; border-color:#dc2626; color:#fff; margin-left:6px;">🗑 Delete ${nsEsc(p.session)}</button>`;
  const code = nsEl("nsDeleteCode"), go = nsEl("nsDeleteGo");
  const ready = () => { go.disabled = nsBusy || !!p.blocked || code.value.trim().toLowerCase() !== String(res.school).toLowerCase(); };
  code.oninput = ready;
  go.onclick = nsDeleteGo;
  ready();
}

async function nsDeleteGo() {
  const res = nsInfo, p = nsDel;
  if (!res || !p || nsBusy) return;
  const pick = document.querySelector('input[name="nsAdm"]:checked');
  const mode = pick ? pick.value : "backup";
  if (!confirm(`Delete ${p.session} for ${res.school_name || res.school}?\n\nThe school goes back to ${p.back_to}.` +
               (p.admitted.length ? `\n${p.admitted.length} admitted in ${p.session}: ${mode === "permanent" ? "DELETED PERMANENTLY" : "kept as a backup on the Restore page"}.` : ""))) return;
  nsBusy = true; nsEl("nsDeleteGo").disabled = true; nsEl("nsDeleteGo").textContent = "Deleting…";
  let out = null;
  try {
    out = await postToApi({ action: "deleteSession", school: res.school, session: p.session, confirm_code: nsEl("nsDeleteCode").value.trim(),
                            admitted: mode, admitted_count: p.admitted.length });
  } catch (err) { out = { error: "No answer from the server. Reload the page to see what happened." }; }
  nsBusy = false;
  if (!out || out.status !== "deleted") {
    nsEl("nsDeleteBody").insertAdjacentHTML("afterbegin", `<div class="ns-box bad" style="display:block;">Not deleted: ${nsEsc((out && (out.error || out.auth_error)) || "unknown error")}</div>`);
    nsEl("nsDeleteGo").textContent = `🗑 Delete ${p.session}`;
    return;
  }
  // permanently deleted admissions: their photos go too (best effort, like the Restore page)
  (out.photos || []).forEach(ph => { try { deleteCloudinaryPhoto(String(ph).split("|")[0]); } catch (err) { /* best effort */ } });
  sessionStorage.removeItem("schoolsCache");
  sessionStorage.removeItem("dashCache_" + res.school);
  await nsLoad();
  nsBox("nsMsg", "ok", `🗑 ${nsEsc(out.session)} deleted: ${nsEsc(out.active)} is the current session again (${nsEsc(out.restored)} students put back` +
    (out.reverted ? `, ${nsEsc(out.reverted)} re-admitted put back as before` : "") +
    (out.admitted ? `, ${nsEsc(out.admitted)} admitted ${out.admitted_mode === "permanent" ? "deleted permanently" : "kept on the Restore page"}` : "") + `).`);
}

async function nsUndo(repair) {
  const res = nsInfo;
  if (!res || nsBusy) return;
  const lp = res.last_promotion;
  const q = repair
    ? `Put back the unfinished promotion of ${res.school_name || res.school}?\n\nEvery class goes back to how it was in ${res.active}.`
    : `Undo the promotion to ${lp.to}?\n\nEvery class goes back to ${lp.from}, and ${lp.from} becomes the current session again.`;
  if (!confirm(q)) return;
  nsBusy = true;
  let out = null;
  try { out = await postToApi({ action: "undoNewSession", school: res.school }); }
  catch (err) { out = { error: "No answer from the server. Reload the page to see what happened." }; }
  nsBusy = false;
  if (!out || (out.status !== "undone" && out.status !== "repaired")) {
    nsBox("nsMsg", "bad", nsEsc((out && (out.error || out.auth_error)) || "Could not undo."));
    return;
  }
  sessionStorage.removeItem("schoolsCache");
  sessionStorage.removeItem("dashCache_" + res.school);   // Dashboard counts: no 5-minute-old numbers
  await nsLoad();
  nsBox("nsMsg", "ok", out.status === "repaired"
    ? `✅ Put back: ${nsEsc(out.students)} students are as they were in ${nsEsc(out.active)}. You can promote again.`
    : `↩ Undone: ${nsEsc(out.active)} is the current session again (${nsEsc(out.students)} students put back).`);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", nsInit);
else nsInit();
