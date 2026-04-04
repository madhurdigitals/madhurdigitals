let students = [];

// LOAD DATA
async function loadDeleted() {
  const url = `${API_URL}?action=getDeletedStudents`;
  const res = await fetch(url);
  const raw = await res.json();

  students = raw.slice(1).map(r => ({
    id: r[0],
    name: r[1],
    class: r[2],
    section: r[3],
    school: r[10]
  }));

  populateSchoolFilter();
  renderTable(students);
}

loadDeleted();

// RENDER
function renderTable(data) {
  document.getElementById("studentTable").innerHTML =
    data.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.name}</td>
        <td>${s.class}</td>
        <td>${s.section}</td>
        <td>${s.school}</td>
        <td>
          <button onclick="restore(${s.id})">Restore</button>
        </td>
      </tr>
    `).join("");
}

// FILTER
function applyFilter() {
  const name = document.getElementById("searchName").value.toLowerCase();
  const cls = document.getElementById("searchClass").value;
  const sec = document.getElementById("searchSection").value;
  const sch = document.getElementById("searchSchool").value;

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(name) &&
    (cls === "" || s.class == cls) &&
    (sec === "" || s.section === sec) &&
    (sch === "" || s.school === sch)
  );

  renderTable(filtered);
}

// EVENTS
document.getElementById("searchName").addEventListener("input", applyFilter);
document.getElementById("searchClass").addEventListener("input", applyFilter);
document.getElementById("searchSection").addEventListener("change", applyFilter);
document.getElementById("searchSchool").addEventListener("change", applyFilter);

// SCHOOL FILTER
function populateSchoolFilter() {
  const schools = [...new Set(students.map(s => s.school))];

  const dropdown = document.getElementById("searchSchool");

  dropdown.innerHTML += schools.map(s =>
    `<option value="${s}">${s}</option>`
  ).join("");
}

// RESTORE
async function restore(id) {

  if (!confirm("Restore this student?")) return;

  const filters = {
    name: searchName.value,
    class: searchClass.value,
    section: searchSection.value,
    school: searchSchool.value
  };

  const scrollPos = window.scrollY;

  const url = `${API_URL}?action=restoreStudent&student_id=${id}`;

  await fetch(url);

  await loadDeleted();

  // restore filters
  searchName.value = filters.name;
  searchClass.value = filters.class;
  searchSection.value = filters.section;
  searchSchool.value = filters.school;

  applyFilter();

  window.scrollTo(0, scrollPos);
}