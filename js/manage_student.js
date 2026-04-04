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
    roll: r[4]
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