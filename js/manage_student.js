/* =============================================
   manage_student.js
   - Original edit/delete logic preserved exactly
   - Date filter added
   - Stats + skeleton added
   ============================================= */

let school      = sessionStorage.getItem("school");
let school_name = sessionStorage.getItem("school_name");

const displayName = school_name || school;
document.getElementById("schoolName").innerText    = displayName;
document.getElementById("schoolNameTop").innerText = displayName;

let students        = [];
let currentPage     = 1;
let rowsPerPage     = 50;
let headersGlobal   = [];
let filteredData    = [];
let selectedFilters = [];

function normalizeKey(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
}

/* ── TOAST ── */
function showToast(msg, type) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText   = msg;
  t.className   = "toast" + (type ? " toast-" + type : "");
  t.style.display = "block";
  setTimeout(() => t.style.display = "none", 2800);
}

/* ── PARSE TIMESTAMP ──
   Format in sheet: "12/5/2026 14:22"  (DD/M/YYYY)
   Returns Date object or null
*/
function parseTimestamp(ts) {
  if (!ts) return null;
  try {
    const str      = String(ts).trim();
    const datePart = str.split(" ")[0];       // "12/5/2026"
    const parts    = datePart.split("/");     // ["12","5","2026"]
    if (parts.length !== 3) return null;
    const day   = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const year  = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

/* ── LOAD STUDENTS ── */
async function loadStudents() {
  showSkeleton(true);

  const raw = await getStudents(school);

  showSkeleton(false);

  if (!raw || raw.length === 0) return;

  const headers = raw[0];

  headersGlobal = headers.filter(h => {
    const key = h.toLowerCase();
    return key !== "timestamp" &&
           key !== "added_via" &&
           key !== "updated_by";
  });

  students = raw.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  filteredData = [...students];
  currentPage  = 1;

  renderSmartTable();
  renderPagination();
  updateStats();
  populateClassSectionDropdown();
  populateAddedByDropdown();
}

loadStudents();

/* ── SKELETON ── */
function showSkeleton(show) {
  const sk = document.getElementById("skeletonRows");
  const tb = document.getElementById("tableWrapper");
  if (!sk || !tb) return;
  sk.style.display = show ? "block" : "none";
  tb.style.display = show ? "none"  : "block";
}

/* ── STATS ── */
function updateStats() {
  const totalEl    = document.getElementById("statTotal");
  const filteredEl = document.getElementById("statFiltered");
  const activeEl   = document.getElementById("statActive");
  const activeWrap = document.getElementById("statActiveWrap");

  if (totalEl)    totalEl.innerText    = students.length.toLocaleString();
  if (filteredEl) filteredEl.innerText = filteredData.length.toLocaleString();

  const activeCount = countActiveFilters();
  if (activeWrap) activeWrap.style.display = activeCount > 0 ? "flex" : "none";
  if (activeEl)   activeEl.innerText        = activeCount;
}

function countActiveFilters() {
  let n = 0;
  if ((document.getElementById("searchName")?.value || "").trim())      n++;
  if ((document.getElementById("searchStudentId")?.value || "").trim()) n++;
  if ((document.getElementById("filterAddedBy")?.value || ""))          n++;
  if ((document.getElementById("dateFrom")?.value || ""))               n++;
  if ((document.getElementById("dateTo")?.value || ""))                 n++;
  if (selectedFilters.length > 0)                                       n++;
  return n;
}

/* ── RENDER TABLE (original logic) ── */
function renderTable(data, headers) {
  const visibleHeaders = headers.filter(h => {
    const key = h.toLowerCase();
    return !key.includes("address") &&
           !key.includes("photo")   &&
           key !== "updated_by"     &&
           key !== "added_via"      &&
           key !== "timestamp";
  });

  const thead = document.getElementById("tableHead");
  const tbody = document.getElementById("studentTable");

  thead.innerHTML = `
    <tr>
      ${visibleHeaders.map(h => `<th>${h}</th>`).join("")}
      <th>Action</th>
    </tr>
  `;

  tbody.innerHTML = data.map(s => `
    <tr>
      ${visibleHeaders.map(h => `<td>${s[h] || ""}</td>`).join("")}
      <td>
        <button class="btn-edit"   onclick="openEdit('${s["Student_ID"]}')">Edit</button>
        <button class="btn-delete" onclick="deleteStudent('${s["Student_ID"]}')">Delete</button>
      </td>
    </tr>
  `).join("");
}

/* ── APPLY FILTER ── */
function applyFilter() {
  const name      = document.getElementById("searchName").value.toLowerCase();
  const studentId = (document.getElementById("searchStudentId")?.value || "").trim();
  const addedBy   = (document.getElementById("filterAddedBy")?.value || "").trim().toLowerCase();
  const dateFrom  = document.getElementById("dateFrom")?.value  || "";
  const dateTo    = document.getElementById("dateTo")?.value    || "";

  const fromDate = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
  const toDate   = dateTo   ? new Date(dateTo   + "T23:59:59") : null;

  filteredData = students.filter(s => {
    const key = s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`;

    if (!(s.Name || "").toLowerCase().includes(name))                          return false;
    if (studentId && !String(s.Student_ID || "").includes(studentId))          return false;
    if (addedBy   && !(s.Added_By || "").toLowerCase().includes(addedBy))      return false;
    if (selectedFilters.length > 0 && !selectedFilters.includes(key))         return false;

    // Date filter
    if (fromDate || toDate) {
      const d = parseTimestamp(s.Timestamp || s.timestamp || "");
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
    }

    return true;
  });

  currentPage = 1;
  renderSmartTable();
  renderPagination();
  updateStats();
}

document.getElementById("searchName").addEventListener("input", applyFilter);

/* ── CLEAR ALL FILTERS ── */
function clearAllFilters() {
  document.getElementById("searchName").value = "";
  if (document.getElementById("searchStudentId")) document.getElementById("searchStudentId").value = "";
  if (document.getElementById("filterAddedBy"))   document.getElementById("filterAddedBy").value   = "";
  if (document.getElementById("dateFrom"))        document.getElementById("dateFrom").value         = "";
  if (document.getElementById("dateTo"))          document.getElementById("dateTo").value           = "";

  selectedFilters = [];
  document.querySelectorAll("#classSectionDropdown input").forEach(cb => cb.checked = false);
  renderChips();
  applyFilter();
}

/* ── SMART TABLE ── */
function renderSmartTable() {
  const data = filteredData;
  if (data.length <= rowsPerPage) {
    renderTable(data, headersGlobal);
    document.getElementById("pagination").innerHTML = "";
  } else {
    const start    = (currentPage - 1) * rowsPerPage;
    const pageData = data.slice(start, start + rowsPerPage);
    renderTable(pageData, headersGlobal);
  }
  updateStats();
}

function changeRowsPerPage(val) {
  rowsPerPage = Number(val);
  currentPage = 1;
  renderSmartTable();
  renderPagination();
}

/* ── PAGINATION (original) ── */
function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const container  = document.getElementById("pagination");

  if (filteredData.length <= rowsPerPage) { container.innerHTML = ""; return; }

  let buttons = "";
  for (let i = 1; i <= totalPages; i++) {
    buttons += `<button onclick="goToPage(${i})" ${i === currentPage ? "class='pg-active'" : ""}>${i}</button>`;
  }
  container.innerHTML = `<button onclick="prevPage()">⬅</button>${buttons}<button onclick="nextPage()">➡</button>`;
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderSmartTable();
  renderPagination();
}

function jumpToPage() { goToPage(parseInt(document.getElementById("pageInput").value)); }
function nextPage()   { goToPage(currentPage + 1); }
function prevPage()   { goToPage(currentPage - 1); }

/* ── DELETE (original logic preserved) ── */
async function deleteStudent(id) {
  if (!confirm("Are you sure you want to delete this student?")) return;

  const filters = { name: document.getElementById("searchName").value };
  const scrollPos = window.scrollY;

  await fetch(`${API_URL}?action=deleteStudent&school=${school}&student_id=${id}`);

  alert("Student moved to deleted records");

  await loadStudents();

  document.getElementById("searchName").value = filters.name;
  applyFilter();
  window.scrollTo(0, scrollPos);
}

/* ── OPEN EDIT (original logic preserved exactly) ── */
async function openEdit(id) {
  const container = document.getElementById("editPopup");

  container.innerHTML = `
    <div class="school-header">
      <h3>Edit Student</h3>
      <span class="close-btn" onclick="closeEdit()">✖</span>
    </div>
    <p style="text-align:center; margin-top:20px;">⏳ Loading student data...</p>
  `;
  container.style.display = "block";

  if (!schoolsData || schoolsData.length === 0) {
    schoolsData = await getSchools();
  }

  const student = students.find(s => s["Student_ID"] == id);
  if (!student) return;

  const headers = schoolsData[0];
  const schools = schoolsData.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  const currentSchool = schools.find(s => s.school === school);
  if (!currentSchool) return;

  const fields = currentSchool.fields.split(",");

  let html = `
    <div class="school-header">
      <h3>Edit Student</h3>
      <span class="close-btn" onclick="closeEdit()">✖</span>
    </div>
    <div class="form-row">
      <label>Student ID</label>
      <input value="${id}" disabled>
    </div>
  `;

  fields.forEach(f => {
    const original = f.trim();
    const key      = normalizeKey(original);
    let   value    = student[original] || "";

    if (key === "dob") value = formatDOB(value);

    html += `<div class="form-row"><label>${original}</label>`;

    if (key === "class") {
      html += `<select id="edit_${key}">
        <option value="" ${value === "" ? "selected" : ""}>— Select —</option>
        ${CONFIG.classes.map(c => `<option value="${c}" ${c == value ? "selected" : ""}>${c}</option>`).join("")}
      </select>`;
    } else if (key === "section") {
      html += `<select id="edit_${key}">
        <option value="" ${value === "" ? "selected" : ""}>— Select —</option>
        ${CONFIG.sections.map(s => `<option value="${s}" ${s == value ? "selected" : ""}>${s}</option>`).join("")}
      </select>`;
    } else if (key === "dob") {
      html += `<input id="edit_${key}" value="${value}" placeholder="DD/MM/YYYY" inputmode="numeric">`;
    } else {
      html += `<input id="edit_${key}" value="${value}">`;
    }

    html += `</div>`;
  });

  html += `
    <div class="btn-group">
      <button class="submit-btn" onclick="saveEditDynamic(${id})">Save</button>
      <button class="clear-btn"  onclick="closeEdit()">Cancel</button>
    </div>
  `;

  container.innerHTML = html;

  if (typeof attachDOBFormatterAll === "function") attachDOBFormatterAll();
  if (typeof attachDOBPickerAll    === "function") attachDOBPickerAll();
}

function closeEdit() {
  document.getElementById("editPopup").style.display = "none";
}

/* ── SAVE EDIT (original logic preserved exactly) ── */
async function saveEditDynamic(id) {
  let params = new URLSearchParams({
    action:     "updateStudent",
    school:     school,
    student_id: id,
    updated_by: sessionStorage.getItem("username") || "unknown"
  });

  if (!schoolsData || schoolsData.length === 0) schoolsData = await getSchools();

  const headers = schoolsData[0];
  const schools = schoolsData.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  const currentSchool = schools.find(s => s.school === school);
  const fields        = currentSchool.fields.split(",");

  const visibleHeaders = headersGlobal.filter(h => {
    const key = h.toLowerCase();
    return !key.includes("address") && !key.includes("photo");
  });

  let updatedValues = {};

  fields.forEach(f => {
    const key = normalizeKey(f.trim());
    const el  = document.getElementById(`edit_${key}`);
    if (!el) return;
    let value = el.value || "";
    if (key === "dob") value = formatDOB(value);
    params.append(key, value);
    updatedValues[key] = value;
  });

  // Find target row
  const rows = document.querySelectorAll("#studentTable tr");
  let targetRow = null;
  rows.forEach(row => { if (row.innerHTML.includes(id)) targetRow = row; });

  // Instant UI update
  if (targetRow) {
    const cells = targetRow.querySelectorAll("td");
    visibleHeaders.forEach((h, index) => {
      const key = normalizeKey(h);
      if (updatedValues[key] !== undefined && cells[index]) {
        cells[index].innerText = updatedValues[key];
      }
    });
  }

  closeEdit();

  // Backend save
  await fetch(`${API_URL}?${params.toString()}`);

  // Patch from backend
  const raw  = await getStudents(school);
  const hdrs = raw[0];
  const studentsList = raw.slice(1).map(r => {
    let obj = {};
    hdrs.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  const updated = studentsList.find(s => s["Student_ID"] == id);

  if (updated && targetRow) {
    const cells = targetRow.querySelectorAll("td");
    visibleHeaders.forEach((h, index) => {
      if (cells[index]) cells[index].innerText = updated[h] || "";
    });
    targetRow.style.background = "#d1fae5";
    setTimeout(() => { targetRow.style.background = ""; }, 1000);
  }
}

/* ── FORMAT DOB (original) ── */
function formatDOB(value) {
  if (!value) return "";
  let str    = value.toString().trim().replace(/-/g, "/");
  let digits = str.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.substring(0,2)}/${digits.substring(2,4)}/${digits.substring(4,8)}`;
  }
  const parts = str.split("/");
  if (parts.length === 3) {
    let [day, month, year] = parts;
    return `${String(day).padStart(2,"0")}/${String(month).padStart(2,"0")}/${year}`;
  }
  return str;
}

/* ── CLASS-SECTION DROPDOWN (original) ── */
function populateClassSectionDropdown() {
  const set = new Set();
  students.forEach(s => {
    const key = s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`;
    set.add(key);
  });

  const sorted = [...set].sort((a, b) => {
    const [c1, s1] = a.split("-");
    const [c2, s2] = b.split("-");
    if (c1 != c2) return c1 - c2;
    return (s1 || "").localeCompare(s2 || "");
  });

  document.getElementById("classSectionDropdown").innerHTML = sorted.map(val => `
    <label>
      <input type="checkbox" value="${val}" onchange="handleFilterChange(this)">
      ${val}
    </label>
  `).join("");
}

function handleFilterChange(checkbox) {
  if (checkbox.checked) {
    if (!selectedFilters.includes(checkbox.value)) selectedFilters.push(checkbox.value);
  } else {
    selectedFilters = selectedFilters.filter(v => v !== checkbox.value);
  }
  renderChips();
  applyFilter();
}

function renderChips() {
  document.getElementById("selectedChips").innerHTML = selectedFilters.map(val => `
    <span class="chip">
      ${val}
      <span onclick="removeFilter('${val}')" style="cursor:pointer; margin-left:4px;">✖</span>
    </span>
  `).join("");
}

function removeFilter(value) {
  selectedFilters = selectedFilters.filter(v => v !== value);
  document.querySelectorAll("#classSectionDropdown input").forEach(cb => {
    if (cb.value === value) cb.checked = false;
  });
  renderChips();
  applyFilter();
}

function toggleDropdown(id) {
  const el     = document.getElementById(id);
  const isOpen = el.style.display === "block";
  document.querySelectorAll(".dropdown-content").forEach(d => d.style.display = "none");
  el.style.display = isOpen ? "none" : "block";
}

document.addEventListener("click", function(e) {
  const dropdown = document.getElementById("classSectionDropdown");
  if (!dropdown) return;
  if (!dropdown.parentElement.contains(e.target)) dropdown.style.display = "none";
});

/* ── ADDED BY DROPDOWN ── */
function populateAddedByDropdown() {
  const unique = [...new Set(
    students.map(s => (s.Added_By || "").trim()).filter(Boolean)
  )].sort();
  const dd = document.getElementById("filterAddedBy");
  if (!dd) return;
  dd.innerHTML = `<option value="">All</option>` +
    unique.map(u => `<option value="${u}">${u}</option>`).join("");
}

/* ── SCHOOL CHANGE (original) ── */
function goHome()            { window.location.href = "index.html"; }
function changeSchool()      { document.getElementById("schoolBox").classList.add("active"); }
function hideSchoolSelector(){ document.getElementById("schoolBox").classList.remove("active"); }

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
  sessionStorage.setItem("school",      newSchool);
  sessionStorage.setItem("school_name", newName);
  sessionStorage.setItem("school_id",   newId);
  document.getElementById("schoolName").innerText    = newName;
  document.getElementById("schoolNameTop").innerText = newName;
  school = newSchool;
  hideSchoolSelector();
  loadStudents();
}

async function initSchools() { schoolsData = await getSchools(); }

loadSchools();
initSchools();
