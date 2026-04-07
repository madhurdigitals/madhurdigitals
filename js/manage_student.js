let school = sessionStorage.getItem("school");

document.getElementById("schoolName").innerText = school;
document.getElementById("schoolNameTop").innerText = school;

let students = [];
let currentPage = 1;
let rowsPerPage = 100; // default
let headersGlobal = [];
let filteredData = [];

// LOAD DATA
async function loadStudents() {
  const raw = await getStudents(school);

  const headers = raw[0];
  headersGlobal = headers; // 🔥 store globally

  students = raw.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  filteredData = [...students]; // 🔥 initially same

  currentPage = 1;

  renderSmartTable();   // 🔥 NEW

  renderTablePaginated();   // ✅ NEW
  renderPagination();       // ✅ NEW
}

loadStudents();

// RENDER TABLE
function renderTable(data, headers) {
  const table = document.getElementById("studentTable");
  const thead = document.getElementById("tableHead");

  // 🔥 create headers dynamically
  thead.innerHTML = `
    <tr>
      ${headers.map(h => `<th>${h}</th>`).join("")}
      <th>Action</th>
    </tr>
  `;

  // 🔥 create rows dynamically
  table.innerHTML = data.map(s => `
    <tr>
      ${headers.map(h => `<td>${s[h] || ""}</td>`).join("")}
      <td>
        <button onclick="openEdit(${s.student_ID})">Edit</button>
        <button onclick="deleteStudent(${s.student_ID})">Delete</button>
      </td>
    </tr>
  `).join("");
}

function applyFilter() {
  const name = document.getElementById("searchName").value.toLowerCase();
  const cls = document.getElementById("searchClass").value;
  const sec = document.getElementById("searchSection").value;

  filteredData = students.filter(s =>
    (s.Name || "").toLowerCase().includes(name) &&
    (cls === "" || s.Class == cls) &&
    (sec === "" || s.Section === sec)
  );

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
  const student = students.find(s => s.id == id);

  document.getElementById("editId").value = student.id;
  document.getElementById("editName").value = student.name;
  document.getElementById("editClass").value = student.class;
  document.getElementById("editSection").value = student.section;
  document.getElementById("editRoll").value = student.roll;
  document.getElementById("editPhone").value = student.phone || "";
  document.getElementById("editAddress").value = student.address || "";

  document.getElementById("editPopup").style.display = "block";
}

function closeEdit() {
  document.getElementById("editPopup").style.display = "none";
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

  await fetch(url);

  closeEdit();

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

function renderTablePaginated() {
  const start = (currentPage - 1) * rowsPerPage;
  const pageData = students.slice(start, start + rowsPerPage);

  renderTable(pageData, headersGlobal);
}

function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const container = document.getElementById("pagination");

  // 🔥 HIDE pagination if small data
  if (filteredData.length <= 150) {
    container.innerHTML = "";
    return;
  }

  let buttons = "";

  for (let i = 1; i <= totalPages; i++) {
    buttons += `
      <button onclick="goToPage(${i})" ${i === currentPage ? "style='font-weight:bold'" : ""}>
        ${i}
      </button>
    `;
  }

  container.innerHTML = `
    <button onclick="prevPage()">Prev</button>
    ${buttons}
    <button onclick="nextPage()">Next</button>
  `;
}

function goToPage(page) {
  currentPage = page;
  renderSmartTable();
  renderPagination();
}

function nextPage() {
  const totalPages = Math.ceil(students.length / rowsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderTablePaginated();
    renderPagination();
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTablePaginated();
    renderPagination();
  }
}

function renderSmartTable() {
  const data = filteredData;

  // 🔥 SMART LOGIC
  if (data.length <= 150) {
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