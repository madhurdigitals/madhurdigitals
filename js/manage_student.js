let school = sessionStorage.getItem("school");
let school_name = sessionStorage.getItem("school_name");

const displayName = school_name || school;

document.getElementById("schoolName").innerText = displayName;
document.getElementById("schoolNameTop").innerText = displayName;
let students = [];
let currentPage = 1;
let rowsPerPage = 20; // default
let headersGlobal = [];
let filteredData = [];
let selectedFilters = [];
// let schoolsData = [];

function normalizeKey(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");
}

// LOAD DATA
async function loadStudents() {
  const raw = await getStudents(school);

  if (!raw || raw.length === 0) return;

  const headers = raw[0];

  // ✅ Remove Timestamp from UI
  headersGlobal = headers.filter(h => h !== "Timestamp");

  // ✅ Convert rows to objects (keep full data internally)
  students = raw.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  // ✅ Initial state = no filter
  filteredData = [...students];

  currentPage = 1;

  // ✅ Smart render (handles pagination automatically)
  renderSmartTable();
  renderPagination();
  populateClassSectionDropdown();
}

loadStudents();

function goHome() {
  window.location.href = "index.html";
}

function changeSchool() {
  document.getElementById("schoolBox").classList.add("active");
}

function hideSchoolSelector() {
  document.getElementById("schoolBox").classList.remove("active");
}

async function loadSchools() {
  const dropdown = document.getElementById("schoolSelect");

  dropdown.innerHTML = "<option>Loading...</option>";

  const raw = await getSchools();

  if (!raw || raw.length === 0) {
    dropdown.innerHTML = "<option>No Schools Found</option>";
    return;
  }

  const headers = raw[0];

  const schools = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  dropdown.innerHTML = '<option value="">Select School</option>';

  dropdown.innerHTML += schools.map(s => `
    <option value="${s.school}" data-id="${s.school_id}">
      ${s.school_name}
    </option>
  `).join("");

  if (school) {
    dropdown.value = school;
  }
}

function applySchoolChange() {
  const dropdown = document.getElementById("schoolSelect");
  const selected = dropdown.options[dropdown.selectedIndex];

  const newSchool = selected.value;
  const newName = selected.textContent.trim();
  const newId = selected.getAttribute("data-id");

  if (!newSchool) {
    alert("Please select a school");
    return;
  }

  // ✅ Update session
  sessionStorage.setItem("school", newSchool);
  sessionStorage.setItem("school_name", newName);
  sessionStorage.setItem("school_id", newId);

  // ✅ Update UI
  document.getElementById("schoolName").innerText = newName;
  document.getElementById("schoolNameTop").innerText = newName;

  school = newSchool;

  hideSchoolSelector();

  // ✅ Reload data (IMPORTANT)
  loadStudents();
}


// RENDER TABLE
function renderTable(data, headers) {

  const visibleHeaders = headers.filter(h => {
    const key = h.toLowerCase();
    return !key.includes("address") && !key.includes("photo");
  });

  const table = document.getElementById("studentTable");
  const thead = document.getElementById("tableHead");

  thead.innerHTML = `
    <tr>
      ${visibleHeaders.map(h => `<th>${h}</th>`).join("")}
      <th>Action</th>
    </tr>
  `;

  table.innerHTML = data.map(s => `
    <tr>
      ${visibleHeaders.map(h => `<td>${s[h] || ""}</td>`).join("")}

      <td>
        <button onclick="openEdit('${s["Student_ID"]}')">Edit</button>
        <button onclick="deleteStudent('${s["Student_ID"]}')">Delete</button>
      </td>
    </tr>
  `).join("");
}


function applyFilter() {
  const name = document.getElementById("searchName").value.toLowerCase();

  filteredData = students.filter(s => {

    const key = s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`;

    return (
      (s.Name || "").toLowerCase().includes(name) &&
      (selectedFilters.length === 0 || selectedFilters.includes(key))
    );
  });

  currentPage = 1;

  renderSmartTable();
  renderPagination();
}

// DELETE
async function deleteStudent(id) {

  if (!confirm("Are you sure you want to delete this student?")) return;

  // ✅ ONLY keep existing filters
  const filters = {
    name: document.getElementById("searchName").value
  };

  const scrollPos = window.scrollY;

  const url = `${API_URL}?action=deleteStudent&school=${school}&student_id=${id}`;

  await fetch(url);

  alert("Student moved to deleted records");

  // reload
  await loadStudents();

  // restore filters
  document.getElementById("searchName").value = filters.name;

  applyFilter();

  window.scrollTo(0, scrollPos);
}

async function openEdit(id) {

  const container = document.getElementById("editPopup");

  // ✅ STEP 1: show loading
  container.innerHTML = `
    <div class="school-header">
      <h3>Edit Student</h3>
      <span class="close-btn" onclick="closeEdit()">✖</span>
    </div>

    <p style="text-align:center; margin-top:20px;">
      ⏳ Loading student data...
    </p>
  `;
  container.style.display = "block";

  // ✅ STEP 2: ensure schools loaded
  if (!schoolsData || schoolsData.length === 0) {
    schoolsData = await getSchools();
  }

  // ✅ STEP 3: get student
  const student = students.find(s => s["Student_ID"] == id);
  if (!student) return;

  // ✅ STEP 4: get school config
  const headers = schoolsData[0];

  const schools = schoolsData.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  const currentSchool = schools.find(s => s.school === school);
  const fields = currentSchool.fields.split(",");

  // ✅ STEP 5: build UI
  let html = `
    <div class="school-header">
      <h3>Edit Student</h3>
      <span class="close-btn" onclick="closeEdit()">✖</span>
    </div>
  `;

  // 🔥 Student ID (non-editable)
  html += `
    <label>Student ID</label>
    <input value="${id}" disabled>
  `;

  fields.forEach(f => {
    const original = f.trim();
    const key = normalizeKey(original);

    let value = student[original] || "";

    // ✅ DOB format
    if (key === "dob") {
      value = formatDOB(value);
    }

    html += `<label>${original}</label>`;

    // ✅ CLASS dropdown
    if (key === "class") {
      html += `
        <select id="edit_${key}">
          ${CONFIG.classes.map(c =>
            `<option value="${c}" ${c == value ? "selected" : ""}>${c}</option>`
          ).join("")}
        </select>
      `;
    }

    // ✅ SECTION dropdown
    else if (key === "section") {
      html += `
        <select id="edit_${key}">
          ${CONFIG.sections.map(s =>
            `<option value="${s}" ${s == value ? "selected" : ""}>${s}</option>`
          ).join("")}
        </select>
      `;
    }

    // ✅ normal input
    else {
      html += `<input id="edit_${key}" value="${value}">`;
    }
  });

  html += `
    <br><br>
    <button onclick="saveEditDynamic(${id})">Save</button>
    <button onclick="closeEdit()">Cancel</button>
  `;

  container.innerHTML = html;

  // ✅ attach DOB helpers
  if (typeof attachDOBFormatterAll === "function") attachDOBFormatterAll();
  if (typeof attachDOBPickerAll === "function") attachDOBPickerAll();
}

function closeEdit() {
  document.getElementById("editPopup").style.display = "none";
}

async function saveEditDynamic(id) {

  let params = new URLSearchParams({
    action: "updateStudent",
    school: school,
    student_id: id
  });

  // ✅ ensure schools loaded
  if (!schoolsData || schoolsData.length === 0) {
    schoolsData = await getSchools();
  }

  const headers = schoolsData[0];

  const schools = schoolsData.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  const currentSchool = schools.find(s => s.school === school);
  const fields = currentSchool.fields.split(",");

  fields.forEach(f => {
    const key = normalizeKey(f.trim());
    const el = document.getElementById(`edit_${key}`);

    if (!el) return;

    let value = el.value || "";

    if (key === "dob") {
      value = formatDOB(value);
    }

    params.append(key, value);
  });

  const url = `${API_URL}?${params.toString()}`;

  console.log("UPDATE URL:", url); // 🔥 debug

  try {
    const res = await fetch(url);
    const data = await res.json();

    console.log("UPDATE RESPONSE:", data);

    closeEdit();
    await loadStudents();

  } catch (err) {
    console.error("Update Error:", err);
    alert("Failed to update student");
  }
}

async function saveEdit() {

  // preserve filters
  const filters = {
    name: document.getElementById("searchName").value,
    class: document.getElementById("searchClass").value,
    section: document.getElementById("searchSection").value
  };

  const scrollPos = window.scrollY;

  const data = {
    student_id: document.getElementById("editId").value,
    name: document.getElementById("editName").value,
    class: document.getElementById("editClass").value,
    section: document.getElementById("editSection").value,
    roll: document.getElementById("editRoll").value,
    phone: document.getElementById("editPhone").value,
    address: document.getElementById("editAddress").value
  };

  const url = `${API_URL}?action=updateStudent&school=${school}`
    + `&student_id=${data.student_id}`
    + `&name=${encodeURIComponent(data.name)}`
    + `&class=${data.class}`
    + `&section=${data.section}`
    + `&roll=${data.roll}`
    + `&phone=${data.phone}`
    + `&address=${encodeURIComponent(data.address)}`;

  try {
    await fetch(url);

    closeEdit();

    // reload data
    await loadStudents();

    // restore filters
    document.getElementById("searchName").value = filters.name;
    document.getElementById("searchClass").value = filters.class;
    document.getElementById("searchSection").value = filters.section;

    applyFilter();

    // restore scroll
    window.scrollTo(0, scrollPos);

  } catch (err) {
    console.error("Update Error:", err);
    alert("Failed to update student");
  }
}

function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const container = document.getElementById("pagination");

  // 🔥 hide if <=100
  if (filteredData.length <= 20) {
    container.innerHTML = "";
    return;
  }

  let buttons = "";

  for (let i = 1; i <= totalPages; i++) {
    buttons += `
      <button onclick="goToPage(${i})"
        ${i === currentPage ? "style='font-weight:bold'" : ""}>
        ${i}
      </button>
    `;
  }

  container.innerHTML = `
    <button onclick="prevPage()">⬅</button>
    ${buttons}
    <button onclick="nextPage()">➡</button>
  `;
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  if (page < 1 || page > totalPages) return;

  currentPage = page;
  renderSmartTable();
  renderPagination();
}

function jumpToPage() {
  const page = parseInt(document.getElementById("pageInput").value);
  goToPage(page);
}

function nextPage() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  if (currentPage < totalPages) {
    currentPage++;
    renderSmartTable();
    renderPagination();
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderSmartTable();
    renderPagination();
  }
}

function renderSmartTable() {
  const data = filteredData;

  if (data.length <= 20) {
    // ❌ NO PAGINATION
    renderTable(data, headersGlobal);
    document.getElementById("pagination").innerHTML = "";
  } else {
    // ✅ PAGINATION
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = data.slice(start, start + rowsPerPage);

    renderTable(pageData, headersGlobal);
  }
}

// function toggleDropdown(id) {
//   const el = document.getElementById(id);
//   el.style.display = el.style.display === "block" ? "none" : "block";
// }

document.addEventListener("click", function (e) {

  const dropdown = document.getElementById("classSectionDropdown");

  if (!dropdown) return;

  const container = dropdown.parentElement;

  // if click is outside dropdown container
  if (!container.contains(e.target)) {
    dropdown.style.display = "none";
  }

});

function populateDropdowns() {

  const classSet = new Set();
  const sectionSet = new Set();

  students.forEach(s => {
    classSet.add(s.Class);
    sectionSet.add(s.Section);
  });

  const classDropdown = document.getElementById("classDropdown");
  const sectionDropdown = document.getElementById("sectionDropdown");

  classDropdown.innerHTML = [...classSet].map(c => `
    <label>
      <input type="checkbox" value="${c}" onchange="applyFilter()"> ${c}
    </label>
  `).join("");

  sectionDropdown.innerHTML = [...sectionSet].map(s => `
    <label>
      <input type="checkbox" value="${s}" onchange="applyFilter()"> ${s}
    </label>
  `).join("");
}

function populateClassSectionDropdown() {
  console.log("Dropdown function running"); 
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

  const dropdown = document.getElementById("classSectionDropdown");

  dropdown.innerHTML = sorted.map(val => `
    <label>
      <input type="checkbox" value="${val}" onchange="handleFilterChange(this)">
      ${val}
    </label>
  `).join("");
}

function handleFilterChange(checkbox) {

  const value = checkbox.value;

  if (checkbox.checked) {
    if (!selectedFilters.includes(value)) {
      selectedFilters.push(value);
    }
  } else {
    selectedFilters = selectedFilters.filter(v => v !== value);
  }

  renderChips();
  applyFilter();
}

function renderChips() {
  const container = document.getElementById("selectedChips");

  container.innerHTML = selectedFilters.map(val => `
    <div style="
      background:#e0e0e0;
      padding:5px 10px;
      border-radius:15px;
      display:flex;
      align-items:center;
      gap:5px;
    ">
      ${val}
      <span style="cursor:pointer;" onclick="removeFilter('${val}')">✖</span>
    </div>
  `).join("");
}

function removeFilter(value) {

  selectedFilters = selectedFilters.filter(v => v !== value);

  // uncheck checkbox
  const checkboxes = document.querySelectorAll("#classSectionDropdown input");

  checkboxes.forEach(cb => {
    if (cb.value === value) cb.checked = false;
  });

  renderChips();
  applyFilter();
}

function toggleDropdown(id) {
  const el = document.getElementById(id);

  const isOpen = el.style.display === "block";

  document.querySelectorAll(".dropdown-content").forEach(d => d.style.display = "none");

  el.style.display = isOpen ? "none" : "block";
}


document.getElementById("searchName").addEventListener("input", applyFilter);

loadSchools();

async function initSchools() {
  const raw = await getSchools();
  schoolsData = raw;
}

initSchools();
