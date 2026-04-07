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

  // ❌ remove Timestamp from UI
  headersGlobal = headers.filter(h => h !== "Timestamp");

  students = raw.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  filteredData = [...students];

  currentPage = 1;

  renderSmartTable();
  renderPagination();
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
  const student = students.find(s => s.student_ID == id);

  const container = document.getElementById("editPopup");

  let html = `
    <div class="school-header">
      <h3>Edit Student</h3>
      <span class="close-btn" onclick="closeEdit()">✖</span>
    </div>
  `;

  headersGlobal.forEach(h => {
    if (h === "student_ID") {
      html += `<input value="${student[h]}" disabled>`;
    } 
    else if (h === "Photo_Link") {
      html += `<input value="${student[h] || ""}" placeholder="${h}">`;
    }
    else {
      html += `<input id="edit_${h}" value="${student[h] || ""}" placeholder="${h}">`;
    }
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

  // preserve filters
  const filters = {
    name: document.getElementById("searchName").value,
    class: document.getElementById("searchClass").value,
    section: document.getElementById("searchSection").value
  };

  const scrollPos = window.scrollY;

  let params = new URLSearchParams({
    action: "updateStudent",
    school: school,
    student_id: id
  });

  // 🔥 loop through dynamic headers
  headersGlobal.forEach(h => {

    if (h === "student_ID" || h === "Timestamp") return;

    const el = document.getElementById(`edit_${h}`);

    if (el) {
      params.append(h.toLowerCase(), el.value);
    }
  });

  const url = `${API_URL}?${params.toString()}`;

  try {
    await fetch(url);

    closeEdit();

    await loadStudents();

    // restore filters
    document.getElementById("searchName").value = filters.name;
    document.getElementById("searchClass").value = filters.class;
    document.getElementById("searchSection").value = filters.section;

    applyFilter();

    // restore scroll
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

  // 🔥 hide if <=100
  if (filteredData.length <= 100) {
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

  if (data.length <= 100) {
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