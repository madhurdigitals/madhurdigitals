let school = sessionStorage.getItem("school");

document.getElementById("schoolName").innerText = school;
document.getElementById("schoolNameTop").innerText = school;

let students = [];

// LOAD DATA
async function loadStudents() {
  const raw = await getStudents(school);

  students = raw.slice(1).map(r => ({
  id: r[0],
  name: r[1],
  class: r[2],
  section: r[3],
  roll: r[4],
  phone: r[5],
  address: r[7]
}));

  renderTable(students);
}

loadStudents();

// RENDER TABLE
function renderTable(data) {
  const table = document.getElementById("studentTable");

  table.innerHTML = data.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.name}</td>
      <td>${s.class}</td>
      <td>${s.section}</td>
      <td>${s.roll}</td>
      <td>
        <button onclick="openEdit(${s.id})">Edit</button>
        <button onclick="deleteStudent(${s.id})">Delete</button>
      </td>
    </tr>
  `).join("");
}

// FILTER
document.getElementById("searchName").addEventListener("input", applyFilter);
document.getElementById("searchClass").addEventListener("input", applyFilter);
document.getElementById("searchSection").addEventListener("change", applyFilter);

function applyFilter() {
  const name = document.getElementById("searchName").value.toLowerCase();
  const cls = document.getElementById("searchClass").value;
  const sec = document.getElementById("searchSection").value;

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(name) &&
    (cls === "" || s.class == cls) &&
    (sec === "" || s.section === sec)
  );

  renderTable(filtered);
}

// DELETE
async function deleteStudent(id) {
  if (!confirm("Are you sure you want to delete this student?")) return;

  const url = `${API_URL}?action=deleteStudent&school=${school}&student_id=${id}`;

  await fetch(url);

  alert("Deleted");

  loadStudents();
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