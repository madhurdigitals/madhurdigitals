let students = [];
let currentPage = 1;
let rowsPerPage = 20; // default
let headersGlobal = [];
let filteredData = [];
let selectedFilters = [];

document.addEventListener("DOMContentLoaded", function () {
let school = sessionStorage.getItem("school");
let school_name = sessionStorage.getItem("school_name");

const displayName = school_name || school;

document.getElementById("schoolName").innerText = displayName;
document.getElementById("schoolNameTop").innerText = displayName;


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

// RENDER TABLE
function renderTable(data, headers) {
  const table = document.getElementById("studentTable");
  const thead = document.getElementById("tableHead");

  thead.innerHTML = `
    <tr>
      ${headers.map(h => `<th>${h}</th>`).join("")}
      <th>Action</th>
    </tr>
  `;

  table.innerHTML = data.map(s => `
    <tr>
      ${headers.map(h => {

        // 🔥 PHOTO PREVIEW
        if (h === "Photo_Link" && s[h]) {
          return `<td>
            <img src="${s[h]}" width="40" height="40" style="border-radius:50%">
          </td>`;
        }

        return `<td>${s[h] || ""}</td>`;
      }).join("")}

      <td>
        <button onclick="openEdit(${s.student_ID})">Edit</button>
        <button onclick="deleteStudent(${s.student_ID})">Delete</button>
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

  // preserve filters
  const filters = {
    name: document.getElementById("searchName").value,
    class: document.getElementById("searchClass").value,
    section: document.getElementById("searchSection").value
  };

  const scrollPos = window.scrollY;

  const url = `${API_URL}?action=deleteStudent&school=${school}&student_id=${id}`;

  await fetch(url);

  alert("Student moved to deleted records");

  // reload
  await loadStudents();

  // restore filters
  document.getElementById("searchName").value = filters.name;
  document.getElementById("searchClass").value = filters.class;
  document.getElementById("searchSection").value = filters.section;

  applyFilter();

  // restore scroll
  window.scrollTo(0, scrollPos);
}

function openEdit(id) {
  const student = students.find(s => s.student_ID == id);

  const container = document.getElementById("editPopup");

  let html = `
    <div class="school-header">
      <h3>Edit Student</h3>
      <span class="close-btn" onclick="closeEdit()">✖</span>
    </div>
  `;

  headersGlobal.forEach(h => {

    if (h === "Timestamp") return;

    const label = h.replace(/_/g, " ");

    html += `<label style="display:block; margin-top:10px;">${label}</label>`;

    // 🔥 student_ID (disabled but NO id needed)
    if (h === "student_ID") {
      html += `<input value="${student[h]}" disabled>`;
      return;
    }

    // 🔥 ALL OTHER FIELDS MUST HAVE ID
    html += `<input id="edit_${h}" value="${student[h] || ""}" placeholder="Enter ${label}">`;

  });

  html += `
    <br><br>
    <button onclick="saveEditDynamic(${student.student_ID})">Save</button>
    <button onclick="closeEdit()">Cancel</button>
  `;

  container.innerHTML = html;
  container.style.display = "block";
}

function closeEdit() {
  document.getElementById("editPopup").style.display = "none";
}

async function saveEditDynamic(id) {

  const filters = {
    name: document.getElementById("searchName").value
  };

  const scrollPos = window.scrollY;

  let params = new URLSearchParams({
    action: "updateStudent",
    school: school,
    student_id: id
  });

  headersGlobal.forEach(h => {

    if (h === "student_ID" || h === "Timestamp") return;

    const el = document.getElementById(`edit_${h}`);

    // 🔥 SAFE CHECK (NO ERROR)
    if (!el) {
      console.warn(`Missing input for: ${h}`);
      return;
    }

    params.append(h.toLowerCase(), el.value || "");
  });

  const url = `${API_URL}?${params.toString()}`;

  try {
    await fetch(url);

    closeEdit();
    await loadStudents();

    document.getElementById("searchName").value = filters.name;
    applyFilter();

    window.scrollTo(0, scrollPos);

  } catch (err) {
    console.error("Dynamic Update Error:", err);
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
  const containerTop = document.getElementById("paginationTop");

  // hide if <=20
  if (filteredData.length <= 20) {
    container.innerHTML = "";
    containerTop.innerHTML = "";
    return;
  }

  let buttons = "";

  for (let i = 1; i <= totalPages; i++) {
    buttons += `
      <button 
        class="page-btn ${i === currentPage ? "active-page" : ""}"
        onclick="goToPage(${i})">
        ${i}
      </button>
    `;
  }

  const html = `
    <button class="page-btn" onclick="prevPage()">⬅</button>
    ${buttons}
    <button class="page-btn" onclick="nextPage()">➡</button>
  `;

  // ✅ SET BOTH
  container.innerHTML = html;
  containerTop.innerHTML = html;
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

  if (data.length <= rowsPerPage) {
    renderTable(data, headersGlobal);
    document.getElementById("pagination").innerHTML = "";
    document.getElementById("paginationTop").innerHTML = "";
    
  } else {
    const totalPages = Math.ceil(data.length / rowsPerPage);

    if (currentPage > totalPages) {
      currentPage = totalPages || 1;
    }

    const start = (currentPage - 1) * rowsPerPage;
    const end = Math.min(start + rowsPerPage, data.length);

    const pageData = data.slice(start, end);

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

function changeSchool() {
  document.getElementById("schoolBox").classList.add("active");
}

function hideSchoolSelector() {
  document.getElementById("schoolBox").classList.remove("active");
}

async function loadSchools() {
  const dropdown = document.getElementById("schoolSelect");

  const raw = await getSchools();   // from api.js

  const headers = raw[0];

  const schools = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  dropdown.innerHTML = '<option value="">Select School</option>';

  dropdown.innerHTML += schools.map(s => `
    <option value="${s.school}">${s.school_name}</option>
  `).join("");
}
loadSchools();

function applySchoolChange() {
  const dropdown = document.getElementById("schoolSelect");

  const school = dropdown.value;
  const school_name = dropdown.options[dropdown.selectedIndex].text;

  if (!school) {
    alert("Select school");
    return;
  }

  sessionStorage.setItem("school", school);
  sessionStorage.setItem("school_name", school_name);

  location.reload();   // reload page
}


document.getElementById("searchName").addEventListener("input", applyFilter);
});