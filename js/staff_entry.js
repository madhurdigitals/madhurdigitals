/* =============================================
   staff_entry.js - the 👩‍🏫 Staff tab of Add Records (add_student.html)
   Same safety as students: "Saving…" -> the new Staff ID, or a red row with 🔁 Retry
   (a receipt stops a Retry from adding the person twice). Category stays selected for fast entry.
   ============================================= */
let staffEditPhotoLink = "";

function staffSchoolRow() { return rtSchoolRow(typeof schoolsData !== "undefined" ? schoolsData : null, school); }
function isStaffMode()    { return rtCurrentType(staffSchoolRow()) === "staff"; }
const staffEsc = v => String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/* ── page labels follow the tab: always clear which data is shown ── */
function applyRecordTypeUI() {
  const row = staffSchoolRow();
  const heading = document.querySelector(".heading-wrapper");
  if (heading) rtRenderTabs(heading, row, () => { renderDynamicForm(); loadData(); });
  const staff = rtCurrentType(row) === "staff";
  const cards = document.querySelectorAll(".container > .card");
  if (cards[0]) { const h = cards[0].querySelector("h3"); if (h) h.textContent = staff ? "👩‍🏫 Add Staff Member" : "🎓 Add Student"; }
  if (cards[1]) { const h = cards[1].querySelector("h3"); if (h) h.textContent = staff ? "Recent Staff Entries" : "Recent Student Entries"; }
  cards.forEach(c => { c.style.borderTop = staff ? "4px solid #059669" : ""; });
  const th = document.querySelectorAll("#recentTable")[0]?.closest("table")?.querySelectorAll("thead th");
  if (th && th.length >= 4) {
    const labels = staff ? ["Staff ID", "Name", "Category", "Designation"] : ["Student ID", "Name", "Class", "Section"];
    labels.forEach((l, i) => { th[i].textContent = l; });
  }
  const submit = document.querySelector(".container .submit-btn");
  if (submit) submit.textContent = staff ? "Add Staff Member" : "Submit";
}

/* ── the staff form ── */
function designationSelectHtml(id, value) {
  const list = (typeof CONFIG !== "undefined" && CONFIG.designations) ? CONFIG.designations : [];
  const known = list.some(d => d.toLowerCase() === String(value || "").toLowerCase());
  const other = value && !known;
  return `<select id="${id}_select" onchange="toggleDesignationOther('${id}')">
      <option value="">Select</option>
      ${list.map(d => `<option value="${staffEsc(d)}" ${known && d.toLowerCase() === String(value).toLowerCase() ? "selected" : ""}>${staffEsc(d)}</option>`).join("")}
      <option value="__other__" ${other ? "selected" : ""}>Other…</option>
    </select>
    <input id="${id}_other" placeholder="Type the designation" value="${other ? staffEsc(value) : ""}" style="display:${other ? "" : "none"}; margin-top:6px;">`;
}
function toggleDesignationOther(id) {
  const sel = document.getElementById(id + "_select");
  const other = document.getElementById(id + "_other");
  other.style.display = sel.value === "__other__" ? "" : "none";
  if (sel.value === "__other__") other.focus();
}
function designationValue(id) {
  const sel = document.getElementById(id + "_select");
  if (!sel) return "";
  return sel.value === "__other__" ? (document.getElementById(id + "_other").value || "").trim() : sel.value;
}
function categorySelectHtml(id, value) {
  const cats = (typeof CONFIG !== "undefined" && CONFIG.staffCategories) ? CONFIG.staffCategories : ["Staff", "Management"];
  const v = value || cats[0];
  return `<select id="${id}">${cats.map(c => `<option value="${staffEsc(c)}" ${c === v ? "selected" : ""}>${staffEsc(c)}</option>`).join("")}</select>`;
}

function staffFieldInput(label, id, value) {
  const key = normalizeKey(label);
  const v = staffEsc(value || "");
  if (key === "dob") return `<input id="${id}" type="text" inputmode="numeric" maxlength="10" placeholder="DDMMYYYY" value="${v}">`;
  if (key.includes("phone") || key.includes("contact") || key.includes("mobile")) return `<input id="${id}" inputmode="numeric" maxlength="10" value="${v}">`;
  if (key.includes("address")) return `<textarea id="${id}" rows="1">${v}</textarea>`;
  return `<input id="${id}" value="${v}">`;
}

function renderStaffForm() {
  const row = staffSchoolRow();
  const keepCat = document.getElementById("category")?.value || "";
  const container = document.getElementById("dynamicForm");
  let html = `
    <div class="form-row">
      <label>Photo :</label>
      <div class="photo-upload-wrap">
        <img id="photoPreview" src="" alt="" style="display:none;">
        <input type="file" id="studentPhoto" accept="image/*">
        <button type="button" class="camera-btn" onclick="openCamera()">📷 Take Photo</button>
      </div>
    </div>
    <div class="form-row"><label>Name *</label><input id="name"></div>
    <div class="form-row double">
      <div><label>Category *</label>${categorySelectHtml("category", keepCat)}</div>
      <div><label>Designation *</label>${designationSelectHtml("designation", "")}</div>
    </div>`;
  rtStaffFields(row).forEach(label => {
    html += `<div class="form-row"><label>${staffEsc(label)} :</label>${staffFieldInput(label, normalizeKey(label), "")}</div>`;
  });
  container.innerHTML = html;
  ["attachDOBFormatterAll", "attachPhoneValidation", "attachAutoExpand", "attachEnterNavigation", "attachPhotoPreview"]
    .forEach(fn => { if (typeof window[fn] === "function") window[fn](); });
}

/* ── submit ── */
let staffSubmitting = false;
async function submitStaff() {
  if (staffSubmitting) return;
  const row = staffSchoolRow();
  const name = (document.getElementById("name")?.value || "").trim();
  const category = document.getElementById("category")?.value || "";
  const designation = designationValue("designation");
  const mark = id => { const el = document.getElementById(id); if (el) { el.style.border = "2px solid red"; setTimeout(() => { el.style.border = ""; }, 2000); } };
  let valid = true;
  if (!name) { valid = false; mark("name"); }
  if (!designation) { valid = false; mark("designation_select"); mark("designation_other"); }

  const data = { school: school, school_id: sessionStorage.getItem("school_id"), name: name, category: category,
                 designation: designation, added_via: "manual" };
  rtStaffFields(row).forEach(label => {
    const key = normalizeKey(label);
    let value = (document.getElementById(key)?.value || "").trim();
    if (key === "dob" && value) {
      if (value.replace(/\D/g, "").length !== 8) { valid = false; mark(key); showToast("Enter valid DOB (DDMMYYYY)"); }
      value = formatDOB(value);
    }
    if ((key.includes("phone") || key.includes("contact") || key.includes("mobile")) && value && value.length !== 10) {
      valid = false; mark(key); showToast("Please enter a valid 10-digit number");
    }
    data[key] = value;
  });
  if (!valid) { showToast("Fill required fields"); return; }

  staffSubmitting = true;
  const photoFile = document.getElementById("studentPhoto")?.files[0] || null;
  data.entry_ref = makeEntryRef();
  data.check_duplicate = "1";            // the server asks before saving a possible duplicate
  const early = currentStaffEntryForCheck();
  if (rtEarlyAllowed(early.payload)) data.allow_duplicate = "1";     // already confirmed while typing
  rtEarlyReset();
  const tr = addStaffRecentRow({ staff_id: "", name: name, category: category, designation: designation });
  clearForm();
  const des = document.getElementById("designation_select"); if (des) des.value = "";
  const oth = document.getElementById("designation_other"); if (oth) { oth.value = ""; oth.style.display = "none"; }
  showToast("Saving…");
  staffSubmitting = false;
  saveNewStaff(data, tr, photoFile, sessionStorage.getItem("school_id"));
}

async function saveNewStaff(data, tr, photoFile, schoolIdForPhoto) {
  tr.dataset.state = "saving";
  let res = null;
  try { res = await addStaff(data); } catch (err) { res = null; }
  if (res && res.status === "possible_duplicate") { markStaffDuplicate(data, tr, photoFile, schoolIdForPhoto, res.duplicate); return; }
  if (!res || !res.staff_id) {
    tr.dataset.state = "failed";
    tr.style.background = "#fee2e2";
    tr.children[0].innerHTML = '<span style="color:#b91c1c;font-weight:600;">Not saved</span>';
    tr.children[4].innerHTML = '<button class="edit-btn">🔁 Retry</button>';
    tr.children[4].querySelector("button").onclick = function (ev) {
      if (ev) ev.stopPropagation();
      if (tr.dataset.state === "saving") return;
      this.disabled = true; this.innerText = "Saving…";
      tr.style.background = ""; tr.children[0].innerText = "";
      rtMoveToRecent(tr);
      saveNewStaff(data, tr, photoFile, schoolIdForPhoto);
    };
    rtMoveToPending(tr);
    showToast("NOT saved: " + ((res && res.error) || "no answer from the server") + " — press Retry");
    return;
  }
  tr.dataset.state = "saved";
  rtTrimRecent();
  tr.style.background = "#d1fae5";
  setTimeout(() => { if (tr.dataset.state === "saved") tr.style.background = ""; }, 1000);
  tr.children[0].innerText = res.staff_id;
  tr.children[4].innerHTML = staffRowButtons();
  showToast(res.already_saved ? "Already saved as " + res.staff_id + " — not added twice" : "Saved: " + res.staff_id);
  if (photoFile) {
    try {
      const publicId = await uploadPhotoToCloudinary(photoFile, schoolIdForPhoto, res.staff_id);
      await saveStaffPhotoLink(data.school, res.staff_id, publicId);
      showToast("Photo uploaded");
    } catch (err) {
      showToast("Staff member saved, but photo upload failed");
    }
  }
}

// The server found a staff member who looks the same: nothing is saved until the person decides.
// The row goes to "Waiting for your decision" and the comparison opens by itself (keystroke-safe).
function markStaffDuplicate(data, tr, photoFile, schoolIdForPhoto, dup) {
  tr.dataset.state = "duplicate";
  tr.style.background = "#fef3c7";
  tr.style.outline = "2px solid #dc2626";
  tr.children[0].innerHTML = `<span style="color:#92400e;font-weight:600;" title="${staffEsc(dup.reason)}">⚠ Possible duplicate of ${staffEsc(dup.id)}</span>`;
  tr.children[4].innerHTML = `<button class="edit-btn" title="Compare with the saved staff member">👁 View</button>
    <button class="edit-btn" title="A different person - save anyway">Save anyway</button>
    <button class="delete-btn" title="Same person - do not save">Discard</button>`;
  const [bView, bSave, bDiscard] = tr.children[4].querySelectorAll("button");
  const saveAnyway = () => {
    if (!tr.isConnected || tr.dataset.state !== "duplicate") return;
    data.allow_duplicate = "1";
    tr.style.background = ""; tr.style.outline = ""; tr.children[0].innerText = ""; tr.children[4].innerHTML = "";
    rtMoveToRecent(tr);
    saveNewStaff(data, tr, photoFile, schoolIdForPhoto);
  };
  const discard = () => { if (!tr.isConnected) return; tr.remove(); rtUpdatePendingBanner(); showToast("Not saved (same as " + dup.id + ")"); };
  const compareOpts = () => {
    const fields = ["Name", "Category", "Designation"].concat(rtStaffFields(staffSchoolRow()));
    return { school: data.school, type: "staff", id: dup.id, reason: dup.reason, record: dup.record,
      entry: fields.map(f => [f, data[normalizeKey(f)] || ""]),
      skipLabel: "Same person — don't save", allowLabel: "Different person — save anyway",
      onSkip: discard, onAllow: saveAnyway };
  };
  bSave.onclick = ev => { if (ev) ev.stopPropagation(); saveAnyway(); };
  bDiscard.onclick = ev => { if (ev) ev.stopPropagation(); discard(); };
  bView.onclick = ev => { if (ev) ev.stopPropagation(); rtShowCompare(compareOpts()); };
  rtMoveToPending(tr);
  rtAlertToast("⚠ Possible duplicate of " + dup.id + " (" + dup.reason + ") — NOT saved. Please decide.");
  rtQueueCompare(compareOpts());
}

// EARLY WARNING while typing (staff tab): what is in the form right now
function currentStaffEntryForCheck() {
  const row = staffSchoolRow();
  const payload = {
    name: (document.getElementById("name")?.value || "").trim(),
    category: document.getElementById("category")?.value || "",
    designation: designationValue("designation")
  };
  const entry = [["Name", payload.name], ["Category", payload.category], ["Designation", payload.designation]];
  rtStaffFields(row).forEach(label => {
    const k = normalizeKey(label);
    let v = (document.getElementById(k)?.value || "").trim();
    if (k === "dob" && v) v = formatDOB(v);
    payload[k] = v; entry.push([label, v]);
  });
  const others = Object.keys(payload).filter(k => !["name", "category"].includes(k) && payload[k]).length;
  return { type: "staff", school: school, payload, entry, ready: !!payload.name && others >= 1 };
}

/* ── recent entries ── */
function staffRowButtons() {
  return `<button class="edit-btn" onclick="editStaffRecent(this, event)" title="Change details or photo">Edit</button>
          <button class="delete-btn" onclick="deleteStaffRecent(this)" title="Remove from all lists, printing and exports">Delete</button>`;
}
function addStaffRecentRow(s) {
  const table = document.getElementById("recentTable");
  table.insertAdjacentHTML("afterbegin", `<tr data-type="staff">
      <td>${staffEsc(s.staff_id)}</td><td>${staffEsc(s.name)}</td><td>${staffEsc(s.category)}</td><td>${staffEsc(s.designation)}</td>
      <td>${staffRowButtons()}</td></tr>`);
  const tr = table.firstElementChild;
  rtTrimRecent();        // Recent Entries: the last 3 (problem rows live in "Waiting for your decision")
  return tr;
}

async function loadStaffRecent() {
  const raw = await getStaff(school);
  const table = document.getElementById("recentTable");
  if (!Array.isArray(raw)) { table.innerHTML = `<tr><td colspan="5" style="color:#b91c1c;">${staffEsc(raw.error)}</td></tr>`; return; }
  const h = raw[0] || [];
  const list = raw.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; });
  table.innerHTML = list.slice(-3).reverse().map(s => `<tr data-type="staff">
      <td>${staffEsc(s.Staff_ID)}</td><td>${staffEsc(s.Name)}</td><td>${staffEsc(s.Category)}</td><td>${staffEsc(s.Designation)}</td>
      <td>${staffRowButtons()}</td></tr>`).join("");
}

async function deleteStaffRecent(btn) {
  const tr = btn.closest("tr");
  const id = tr.children[0].innerText.trim();
  if (!id) { alert("Please wait... ID not generated yet"); return; }
  const delName = tr.children[1] ? tr.children[1].innerText.trim() : "";
  if (!confirm(`Delete staff member ${id}${delName ? " (" + delName + ")" : ""}?\n\nThey will be removed from all lists, printing and exports.`)) return;
  btn.disabled = true; btn.innerText = "⏳ Deleting…";
  const res = await deleteStaff(school, id);
  if (!res || res.error) { btn.disabled = false; btn.innerText = "Delete"; showToast("NOT deleted: " + ((res && res.error) || "no answer from the server")); return; }
  tr.remove();
  showToast("Deleted " + id + (delName ? " (" + delName + ")" : ""));
}

/* ── edit ── */
function editStaffRecent(btn, e) {
  if (e) e.stopPropagation();
  const id = btn.closest("tr").children[0].innerText.trim();
  if (!id) { alert("Please wait... ID not generated yet"); return; }
  openStaffEdit(id);
}

async function openStaffEdit(id) {
  const box = document.getElementById("editModalContent");
  box.innerHTML = `<div class="school-header"><h3>Edit Staff Member</h3><span class="close-btn" onclick="closeEditPopup()">✖</span></div>
    <p style="text-align:center; margin-top:20px;">⏳ Loading…</p>`;
  document.getElementById("editPopup").classList.add("active");
  const raw = await getStaff(school);
  if (!Array.isArray(raw)) { box.innerHTML += `<p style="color:#b91c1c;">${staffEsc(raw.error)}</p>`; return; }
  const h = raw[0];
  const s = raw.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; }).find(x => String(x.Staff_ID) === String(id));
  if (!s) { box.innerHTML += `<p>Not found.</p>`; return; }
  staffEditPhotoLink = s.Photo_Link || "";
  let html = `<div class="school-header"><h3>Edit Staff Member</h3><span class="close-btn" onclick="closeEditPopup()">✖</span></div>
    <div class="form-row"><label>Staff ID</label><input value="${staffEsc(id)}" disabled></div>
    <div class="form-row"><label>Photo</label><div class="photo-upload-wrap">
      ${staffEditPhotoLink ? `<img src="${getPhotoUrl(staffEditPhotoLink, "w_100,h_100,c_fill")}" alt="">` : `<span class="no-photo-label">No photo</span>`}
      <input type="file" id="edit_photo_file" accept="image/*"></div></div>
    <div class="form-row"><label>Name *</label><input id="edit_name" value="${staffEsc(s.Name)}"></div>
    <div class="form-row"><label>Category *</label>${categorySelectHtml("edit_category", s.Category)}</div>
    <div class="form-row"><label>Designation *</label><div style="flex:1;">${designationSelectHtml("edit_designation", s.Designation)}</div></div>`;
  rtStaffFields(staffSchoolRow()).forEach(label => {
    let v = s[label] || "";
    if (normalizeKey(label) === "dob") v = formatDOB(v);
    html += `<div class="form-row"><label>${staffEsc(label)} :</label>${staffFieldInput(label, "edit_" + normalizeKey(label), v)}</div>`;
  });
  html += `<br><button class="submit-btn" id="staffSaveBtn" onclick="saveStaffEdit('${staffEsc(id)}')">Save</button>
           <button class="clear-btn" onclick="closeEditPopup()">Cancel</button>`;
  box.innerHTML = html;
  if (typeof attachDOBFormatterAll === "function") attachDOBFormatterAll();
}

async function saveStaffEdit(id) {
  const name = (document.getElementById("edit_name").value || "").trim();
  const designation = designationValue("edit_designation");
  if (!name || !designation) { showToast("Name and Designation are required"); return; }
  const data = { school: school, staff_id: id, name: name, category: document.getElementById("edit_category").value, designation: designation };
  rtStaffFields(staffSchoolRow()).forEach(label => {
    const key = normalizeKey(label);
    let v = (document.getElementById("edit_" + key)?.value || "").trim();
    if (key === "dob") v = formatDOB(v);
    data[key] = v;
  });
  const newPhoto = document.getElementById("edit_photo_file")?.files[0] || null;
  const oldPhoto = staffEditPhotoLink;
  const btn = document.getElementById("staffSaveBtn");
  btn.disabled = true; btn.innerText = "⏳ Saving…";
  const res = await updateStaff(data);
  if (!res || res.error) { btn.disabled = false; btn.innerText = "Save"; showToast("NOT saved: " + ((res && res.error) || "no answer from the server")); return; }
  closeEditPopup();
  showToast("Updated: " + id);
  if (newPhoto) {
    try {
      await replacePhotoSafely(newPhoto, sessionStorage.getItem("school_id"), school, id, oldPhoto, true);
      showToast("Photo updated");
    } catch (err) { showToast("Details saved, but the photo was NOT changed: " + (err.message || "upload failed")); }
  }
  loadStaffRecent();
}
