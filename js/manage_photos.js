/* =============================================
   manage_photos.js
   ============================================= */

let school      = sessionStorage.getItem("school");
let school_name = sessionStorage.getItem("school_name");
const displayName = school_name || school;
document.getElementById("schoolName").innerText    = displayName;
document.getElementById("schoolNameTop").innerText = displayName;

let students   = [];
let studentMap = {};   // Student_ID -> student object, for fast lookup
let stagedNew       = [];   // { file, student }
let stagedConflict  = [];   // { file, student, decision: "skip"|"replace" }
let stagedUnmatched = [];   // { file, filenameId }

/* ── 🎓 Students | 👩‍🏫 Staff (staff S3a) ── */
let photoType = "students";
let pIdKey    = "Student_ID";
const pKey = id => String(id === undefined || id === null ? "" : id).trim().toLowerCase();   // S-60001 = s-60001

function applyPhotoLabels(row) {
  const staff = photoType === "staff";
  const heading = document.querySelector(".heading-wrapper");
  if (heading && typeof rtRenderTabs === "function") rtRenderTabs(heading, row, () => { cancelStaging(); loadStudents(); });
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set("statTotalLbl", staff ? "Total Staff" : "Total Students");
  set("gridTitle", staff ? "👩‍🏫 Staff" : "🎓 Students");
  set("bulkHint", staff ? "Select or drop photo files named exactly by Staff ID (e.g. <code>S-60001.jpg</code>)."
                        : "Select or drop photo files named exactly by Student ID (e.g. <code>80205.jpg</code>).");
  document.querySelectorAll(".container > .card").forEach(c => { c.style.borderTop = staff ? "4px solid #059669" : ""; });
}

// Line under a name: class + father for students, designation + category for staff
function personLine(s) {
  if (photoType === "staff") return [s.Designation, s.Category].filter(Boolean).join(" • ");
  const classSection = s.Section ? `${s.Class}-${s.Section}` : (s.Class || "");
  const fatherName = s["Father's Name"] || s["Fathers_Name"] || s["Father_Name"] || "";
  return `${classSection ? `Class ${classSection}` : ""}${fatherName ? ` • S/D/O ${fatherName}` : ""}`;
}

function showToast(msg, type) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.className = "toast" + (type ? " toast-" + type : "");
  t.style.display = "block";
  setTimeout(() => t.style.display = "none", 2800);
}

/* ── LOAD ── */
async function loadStudents() {
  if (typeof schoolsData === "undefined" || !schoolsData || !schoolsData.length) schoolsData = await getSchools();
  const row = typeof rtSchoolRow === "function" ? rtSchoolRow(schoolsData, school) : null;
  photoType = typeof rtCurrentType === "function" ? rtCurrentType(row) : "students";
  pIdKey = photoType === "staff" ? "Staff_ID" : "Student_ID";
  applyPhotoLabels(row);

  const raw = photoType === "staff" ? await getStaff(school) : await getStudents(school);
  if (!Array.isArray(raw)) { students = []; studentMap = {}; updateStats(); renderPhotoGrid(); showToast((raw && raw.error) || "Could not load", "error"); return; }
  if (!raw || raw.length === 0) return;

  const headers = raw[0];
  students = raw.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  studentMap = {};
  students.forEach(s => { studentMap[pKey(s[pIdKey])] = s; });

  updateStats();
  renderPhotoGrid();
}

loadStudents();

function updateStats() {
  const total   = students.length;
  const withPic = students.filter(s => s["Photo_Link"]).length;
  document.getElementById("statTotal").innerText      = total;
  document.getElementById("statWithPhoto").innerText   = withPic;
  document.getElementById("statMissing").innerText     = total - withPic;
}

/* ── PHOTO GRID ── */
function renderPhotoGrid() {
  const search       = (document.getElementById("searchPhotoName").value || "").toLowerCase();
  const missingOnly  = document.getElementById("missingOnlyToggle").checked;

  let list = students.filter(s => (s.Name || "").toLowerCase().includes(search));
  if (missingOnly) list = list.filter(s => !s["Photo_Link"]);

  const grid = document.getElementById("photoGrid");
  grid.innerHTML = list.map(s => {
    const hasPhoto = !!s["Photo_Link"];
    const thumb = hasPhoto
      ? `<img src="${getPhotoUrl(s["Photo_Link"], 'w_150,h_150,c_fill')}">`
      : `<div class="no-photo-box">No Photo</div>`;

    return `
      <div class="photo-card ${hasPhoto ? "" : "missing"}" onclick="openSinglePhotoPopup('${s[pIdKey]}')" title="${hasPhoto ? "Click to replace the photo" : "Click to add a photo"}">
        ${thumb}
        <div class="pc-name">${s.Name || ""}</div>
        <div class="pc-id">#${s[pIdKey]}</div>
      </div>
    `;
  }).join("");
}

document.getElementById("searchPhotoName").addEventListener("input", renderPhotoGrid);

/* ── SINGLE PHOTO POPUP ── */
let singlePhotoStudentId = null;

function openSinglePhotoPopup(studentId) {
  singlePhotoStudentId = studentId;
  const student = studentMap[pKey(studentId)];
  if (!student) return;

  document.getElementById("singlePhotoTitle").innerHTML = `
    ${student.Name} <span style="font-weight:400; color:#9ca3af; font-size:12px;">#${studentId}</span>
    <br><span style="font-size:12px; font-weight:400; color:#6b7280;">${personLine(student)}</span>
  `;

  const preview = document.getElementById("singlePhotoPreview");
  preview.src = student["Photo_Link"] ? getPhotoUrl(student["Photo_Link"], "w_300,h_300,c_fill") : "";

  document.getElementById("singlePhotoFile").value = "";
  document.getElementById("singlePhotoPopup").classList.add("active");
}

function closeSinglePhotoPopup() {
  document.getElementById("singlePhotoPopup").classList.remove("active");
  singlePhotoStudentId = null;
}

async function uploadSinglePhoto() {
  const file = document.getElementById("singlePhotoFile").files[0];
  if (!file) { showToast("Select a photo first", "error"); return; }

  const student = studentMap[pKey(singlePhotoStudentId)];
  const schoolId = sessionStorage.getItem("school_id");
  const oldLink = student["Photo_Link"] || "";
  const btn = document.getElementById("singleUploadBtn");
  if (btn) { btn.disabled = true; btn.innerText = "⏳ Saving…"; }

  try {
    // new photo first; the old one is removed only after the new one is saved
    const publicId = await replacePhotoSafely(file, schoolId, school, student[pIdKey], oldLink, photoType === "staff");
    student["Photo_Link"] = publicId;   // update local cache
    showToast(`Photo saved for ${student.Name}`, "success");
    closeSinglePhotoPopup();
    updateStats();
    renderPhotoGrid();
  } catch (err) {
    console.error(err);
    showToast("Photo NOT saved: " + (err.message || "upload failed") + (oldLink ? " — the current photo is kept" : ""), "error");
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = "Upload / Replace"; }
  }
}

/* ── BULK UPLOAD — DROPZONE ── */
const dropzone = document.getElementById("dropzone");
const bulkFileInput = document.getElementById("bulkFileInput");

dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", e => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});
bulkFileInput.addEventListener("change", () => handleFiles(bulkFileInput.files));

function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith("image/"));
  if (files.length === 0) return;

  stagedNew = [];
  stagedConflict = [];
  stagedUnmatched = [];

  files.forEach(file => {
    const filenameId = file.name.replace(/\.[^/.]+$/, "").trim();  // strip extension
    const student = studentMap[pKey(filenameId)];

    if (!student) {
      stagedUnmatched.push({ file, filenameId });
    } else if (student["Photo_Link"]) {
      stagedConflict.push({ file, student, decision: "skip" });
    } else {
      stagedNew.push({ file, student });
    }
  });

  renderStaging();
}

function renderStaging() {
  document.getElementById("stagingArea").style.display = "block";
  document.getElementById("resultSummary").style.display = "none";

  // NEW
  const newBox = document.getElementById("stageNew");
  newBox.innerHTML = `<h4>✅ New (${stagedNew.length}) — will upload directly</h4>` +
    stagedNew.map((item, i) => `
      <div class="stage-row">
        <img src="${URL.createObjectURL(item.file)}">
        <div class="stage-info">
          <b>${item.student.Name}</b>
          <span>#${item.student[pIdKey]}</span>
        </div>
      </div>
    `).join("");

  // CONFLICT
  const conflictBox = document.getElementById("stageConflict");
  conflictBox.innerHTML = `<h4>⚠️ Already has a photo (${stagedConflict.length}) — review each</h4>` +
    stagedConflict.map((item, i) => {
      const s = item.student;
      const line = personLine(s);

      return `
      <div class="stage-row">
        <div class="compare-thumbs">
          <img src="${getPhotoUrl(s['Photo_Link'], 'w_60,h_60,c_fill')}" title="Current">
          <span class="arrow">→</span>
          <img src="${URL.createObjectURL(item.file)}" title="New">
        </div>
        <div class="stage-info">
          <b>${s.Name}</b>
          <span>#${s[pIdKey]}${line ? ` • ${line}` : ""}</span>
        </div>
        <button class="zoom-btn" onclick="openZoom(${i})">🔍 Zoom to compare</button>
        <div class="toggle-group">
          <button class="toggle-btn skip ${item.decision === 'skip' ? 'active' : ''}" onclick="setConflictDecision(${i}, 'skip')" title="Keep the current photo">Skip</button>
          <button class="toggle-btn replace ${item.decision === 'replace' ? 'active' : ''}" onclick="setConflictDecision(${i}, 'replace')" title="Use the new photo instead">Replace</button>
        </div>
      </div>
    `;
    }).join("");

  // UNMATCHED
  const unmatchedBox = document.getElementById("stageUnmatched");
  unmatchedBox.innerHTML = stagedUnmatched.length
    ? `<h4>❌ Unmatched (${stagedUnmatched.length}) — no ${photoType === "staff" ? "staff member" : "student"} with this ID, will be skipped</h4>` +
      stagedUnmatched.map(item => `
        <div class="stage-row unmatched">
          <img src="${URL.createObjectURL(item.file)}">
          <div class="stage-info">
            <b>${item.filenameId}</b>
            <span>No matching ${photoType === "staff" ? "Staff ID" : "Student ID"}</span>
          </div>
        </div>
      `).join("")
    : "";
}

function setConflictDecision(index, decision) {
  stagedConflict[index].decision = decision;
  renderStaging();
}

function openZoom(index) {
  const item = stagedConflict[index];
  const s = item.student;
  const line = personLine(s);
  const identity = `${s.Name} (#${s[pIdKey]})${line ? ` — ${line}` : ""}`;

  const overlay = document.getElementById("zoomOverlay");
  document.getElementById("zoomImages").innerHTML = `
    <div style="width:100%; text-align:center; margin-bottom:10px; font-weight:600; color:#374151;">
      ${identity}
    </div>
    <div>
      <img src="${getPhotoUrl(s['Photo_Link'], 'w_500,h_500,c_limit')}">
      <p>Current Photo</p>
    </div>
    <div>
      <img src="${URL.createObjectURL(item.file)}">
      <p>New Photo</p>
    </div>
  `;
  overlay.classList.add("active");
}

function closeZoom() {
  document.getElementById("zoomOverlay").classList.remove("active");
}

function cancelStaging() {
  stagedNew = [];
  stagedConflict = [];
  stagedUnmatched = [];
  document.getElementById("stagingArea").style.display = "none";
  bulkFileInput.value = "";
}

/* ── CONFIRM & UPLOAD ── */
async function confirmBulkUpload() {
  const toUpload = [
    ...stagedNew.map(item => ({ ...item, isReplace: false })),
    ...stagedConflict.filter(item => item.decision === "replace").map(item => ({ ...item, isReplace: true }))
  ];

  if (toUpload.length === 0) {
    showToast("Nothing selected to upload", "error");
    return;
  }

  document.getElementById("confirmUploadBtn").disabled = true;
  document.getElementById("confirmUploadBtn").innerText = "⏳ Uploading…";
  document.getElementById("progressWrap").style.display = "block";

  const schoolId = sessionStorage.getItem("school_id");
  let successCount = 0;
  let failCount = 0;
  let failedItems = [];

  for (let i = 0; i < toUpload.length; i++) {
    const item = toUpload[i];
    const studentId = item.student[pIdKey];

    document.getElementById("progressText").innerText = `Uploading ${i + 1} / ${toUpload.length}...`;
    document.getElementById("progressBar").style.width = `${((i + 1) / toUpload.length) * 100}%`;

    try {
      // new photo first; the old one is removed only after the new one is saved
      const oldLink = item.isReplace ? (item.student["Photo_Link"] || "") : "";
      const publicId = await replacePhotoSafely(item.file, schoolId, school, studentId, oldLink, photoType === "staff");

      item.student["Photo_Link"] = publicId;   // update local cache
      successCount++;
    } catch (err) {
      console.error(`Upload failed for ${studentId}:`, err);
      failCount++;
      failedItems.push(item.student.Name || studentId);
    }
  }

  document.getElementById("progressWrap").style.display = "none";
  document.getElementById("confirmUploadBtn").disabled = false;
  document.getElementById("confirmUploadBtn").innerText = "✅ Confirm & Upload";
  document.getElementById("stagingArea").style.display = "none";

  const summary = document.getElementById("resultSummary");
  summary.style.display = "flex";
  summary.innerHTML = `
    <div class="result-pill ok">✅ ${successCount} uploaded</div>
    ${failCount > 0 ? `<div class="result-pill fail">❌ ${failCount} failed: ${failedItems.join(", ")}</div>` : ""}
  `;

  bulkFileInput.value = "";
  cancelStaging();
  updateStats();
  renderPhotoGrid();

  showToast(`Bulk upload complete: ${successCount} uploaded, ${failCount} failed`, failCount > 0 ? "error" : "success");
}

/* ── SCHOOL SELECTOR (same pattern as your other pages) ── */
function changeSchool() { document.getElementById("schoolBox").classList.add("active"); }
function hideSchoolSelector() { document.getElementById("schoolBox").classList.remove("active"); }

async function loadSchools() {
  const dropdown = document.getElementById("schoolSelect");
  dropdown.innerHTML = "<option>Loading...</option>";
  const raw = await getSchools();
  if (!raw || raw.length === 0) { dropdown.innerHTML = "<option>No Schools Found</option>"; return; }
  const headers = raw[0];
  const schools = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
  dropdown.innerHTML = `<option value="">Select School</option>` +
    schools.map(s => `<option value="${s.school}" data-id="${s.school_id}">${s.school_name}</option>`).join("");
  if (school) dropdown.value = school;
}

function applySchoolChange() {
  const dropdown = document.getElementById("schoolSelect");
  const selected = dropdown.options[dropdown.selectedIndex];
  const newSchool = selected.value;
  const newName   = selected.textContent.trim();
  const newId     = selected.getAttribute("data-id");
  if (!newSchool) { alert("Please select a school"); return; }
  sessionStorage.setItem("school", newSchool);
  sessionStorage.setItem("school_name", newName);
  sessionStorage.setItem("school_id", newId);
  document.getElementById("schoolName").innerText    = newName;
  document.getElementById("schoolNameTop").innerText = newName;
  school = newSchool;
  hideSchoolSelector();
  loadStudents();
}

loadSchools();

// ── ESC TO CLOSE POPUPS ──
document.addEventListener("keydown", function(e) {
  if (e.key !== "Escape") return;

  const zoomOverlay = document.getElementById("zoomOverlay");
  if (zoomOverlay && zoomOverlay.classList.contains("active")) {
    closeZoom();
    return;
  }

  const singlePopup = document.getElementById("singlePhotoPopup");
  if (singlePopup && singlePopup.classList.contains("active")) {
    closeSinglePhotoPopup();
    return;
  }

  const schoolBox = document.getElementById("schoolBox");
  if (schoolBox && schoolBox.classList.contains("active")) {
    hideSchoolSelector();
    return;
  }
});
