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
  const raw = await getStudents(school);
  if (!raw || raw.length === 0) return;

  const headers = raw[0];
  students = raw.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  studentMap = {};
  students.forEach(s => { studentMap[String(s.Student_ID)] = s; });

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
      <div class="photo-card ${hasPhoto ? "" : "missing"}" onclick="openSinglePhotoPopup('${s.Student_ID}')">
        ${thumb}
        <div class="pc-name">${s.Name || ""}</div>
        <div class="pc-id">#${s.Student_ID}</div>
      </div>
    `;
  }).join("");
}

document.getElementById("searchPhotoName").addEventListener("input", renderPhotoGrid);

/* ── SINGLE PHOTO POPUP ── */
let singlePhotoStudentId = null;

function openSinglePhotoPopup(studentId) {
  singlePhotoStudentId = studentId;
  const student = studentMap[String(studentId)];
  if (!student) return;

  const classSection = student.Section ? `${student.Class}-${student.Section}` : (student.Class || "");
  const fatherName = student["Father's Name"] || student["Fathers_Name"] || student["Father_Name"] || "";

  document.getElementById("singlePhotoTitle").innerHTML = `
    ${student.Name} <span style="font-weight:400; color:#9ca3af; font-size:12px;">#${studentId}</span>
    <br><span style="font-size:12px; font-weight:400; color:#6b7280;">
      ${classSection ? `Class ${classSection}` : ""}${fatherName ? ` • S/D/O ${fatherName}` : ""}
    </span>
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

  const student = studentMap[String(singlePhotoStudentId)];
  const schoolId = sessionStorage.getItem("school_id");
  const oldLink = student["Photo_Link"] || "";

  try {
    if (oldLink) {
      const oldPublicId = oldLink.split("|")[0];
      await deleteCloudinaryPhoto(oldPublicId);
    }
    const publicId = await uploadPhotoToCloudinary(file, schoolId, singlePhotoStudentId);
    await savePhotoLink(school, singlePhotoStudentId, publicId);

    student["Photo_Link"] = publicId;   // update local cache
    showToast("Photo saved", "success");
    closeSinglePhotoPopup();
    updateStats();
    renderPhotoGrid();
  } catch (err) {
    console.error(err);
    showToast("Upload failed", "error");
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
    const student = studentMap[filenameId];

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
          <span>#${item.student.Student_ID}</span>
        </div>
      </div>
    `).join("");

  // CONFLICT
  const conflictBox = document.getElementById("stageConflict");
  conflictBox.innerHTML = `<h4>⚠️ Already has a photo (${stagedConflict.length}) — review each</h4>` +
    stagedConflict.map((item, i) => {
      const s = item.student;
      const classSection = s.Section ? `${s.Class}-${s.Section}` : (s.Class || "");
      const fatherName = s["Father's Name"] || s["Fathers_Name"] || s["Father_Name"] || "";

      return `
      <div class="stage-row">
        <div class="compare-thumbs">
          <img src="${getPhotoUrl(s['Photo_Link'], 'w_60,h_60,c_fill')}" title="Current">
          <span class="arrow">→</span>
          <img src="${URL.createObjectURL(item.file)}" title="New">
        </div>
        <div class="stage-info">
          <b>${s.Name}</b>
          <span>#${s.Student_ID}${classSection ? ` • Class ${classSection}` : ""}${fatherName ? ` • S/D/O ${fatherName}` : ""}</span>
        </div>
        <button class="zoom-btn" onclick="openZoom(${i})">🔍 Zoom to compare</button>
        <div class="toggle-group">
          <button class="toggle-btn skip ${item.decision === 'skip' ? 'active' : ''}" onclick="setConflictDecision(${i}, 'skip')">Skip</button>
          <button class="toggle-btn replace ${item.decision === 'replace' ? 'active' : ''}" onclick="setConflictDecision(${i}, 'replace')">Replace</button>
        </div>
      </div>
    `;
    }).join("");

  // UNMATCHED
  const unmatchedBox = document.getElementById("stageUnmatched");
  unmatchedBox.innerHTML = stagedUnmatched.length
    ? `<h4>❌ Unmatched (${stagedUnmatched.length}) — no student with this ID, will be skipped</h4>` +
      stagedUnmatched.map(item => `
        <div class="stage-row unmatched">
          <img src="${URL.createObjectURL(item.file)}">
          <div class="stage-info">
            <b>${item.filenameId}</b>
            <span>No matching Student ID</span>
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
  const classSection = s.Section ? `${s.Class}-${s.Section}` : (s.Class || "");
  const fatherName = s["Father's Name"] || s["Fathers_Name"] || s["Father_Name"] || "";
  const identity = `${s.Name} (#${s.Student_ID})${classSection ? ` — Class ${classSection}` : ""}${fatherName ? ` — S/D/O ${fatherName}` : ""}`;

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
  document.getElementById("progressWrap").style.display = "block";

  const schoolId = sessionStorage.getItem("school_id");
  let successCount = 0;
  let failCount = 0;
  let failedItems = [];

  for (let i = 0; i < toUpload.length; i++) {
    const item = toUpload[i];
    const studentId = item.student.Student_ID;

    document.getElementById("progressText").innerText = `Uploading ${i + 1} / ${toUpload.length}...`;
    document.getElementById("progressBar").style.width = `${((i + 1) / toUpload.length) * 100}%`;

    try {
      if (item.isReplace && item.student["Photo_Link"]) {
        const oldPublicId = item.student["Photo_Link"].split("|")[0];
        await deleteCloudinaryPhoto(oldPublicId);
      }
      const publicId = await uploadPhotoToCloudinary(item.file, schoolId, studentId);
      await savePhotoLink(school, studentId, publicId);

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