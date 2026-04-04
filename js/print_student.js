let students = [];
let filtered = [];

const school = sessionStorage.getItem("school");

// LOAD DATA
async function loadStudents() {
  const raw = await getStudents(school);

  const headers = raw[0];

  students = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  filtered = students;
  renderTable(filtered);
  generateClassSectionOptions();
}

loadStudents();

// RENDER TABLE
function renderTable(data) {
  document.getElementById("studentTable").innerHTML =
    data.map(s => `
      <tr>
        <td><input type="checkbox" class="rowCheck" value="${s.student_ID}"></td>
        <td>${s.student_ID}</td>
        <td>${s.Name}</td>
        <td>${s.Class}</td>
        <td>${s.Section}</td>
        <td>${s.Roll}</td>
      </tr>
    `).join("");
}

// FILTER
function applyFilter() {

  const name = searchName.value.toLowerCase();

  const selectedCS = [...document.querySelectorAll(".csCheck:checked")]
    .map(cb => cb.value);

  filtered = students.filter(s => {

    const cs = `${s.Class}-${s.Section}`;

    return (
      s.Name.toLowerCase().includes(name) &&
      (selectedCS.length === 0 || selectedCS.includes(cs))
    );
  });

  renderTable(filtered);
}

// EVENTS
searchName.addEventListener("input", applyFilter);
searchClass.addEventListener("input", applyFilter);
searchSection.addEventListener("change", applyFilter);

// SELECT ALL
document.getElementById("selectAll").addEventListener("change", function() {
  const checked = this.checked;
  document.querySelectorAll(".rowCheck").forEach(cb => {
    cb.checked = checked;
  });
});

// GENERATE CARDS
function generateCards() {

  const selectedIds = [...document.querySelectorAll(".rowCheck:checked")]
    .map(cb => Number(cb.value));

  if (selectedIds.length === 0) {
    alert("Select at least one student");
    return;
  }

  const selected = filtered.filter(s =>
    selectedIds.includes(Number(s.student_ID))
  );

  document.getElementById("cardSection").style.display = "block";

  renderCards(selected);
}

// RENDER CARDS
function renderCards(data) {

  const container = document.getElementById("cardContainer");

  let pages = [];

  for (let i = 0; i < data.length; i += 10) {
    pages.push(data.slice(i, i + 10));
  }

  container.innerHTML = pages.map(page => `
    <div class="page">

      ${page.map(s => `
        <div class="card">

          <div class="school">
            ${school} Public School<br>
            Address Line<br>
            Contact: 9999999999
          </div>

          <img src="https://via.placeholder.com/80" class="photo">

          <div class="info">
            <b>${s.Name}</b><br>
            Class: ${s.Class}-${s.Section}<br>
            ID: ${s.student_ID}<br>
            Phone: ${s.Phone || ""}<br>
            Address: ${truncate(s.Address || "")}
          </div>

        </div>
      `).join("")}

    </div>
  `).join("");
}

// ADDRESS LIMIT
function truncate(text) {
  return text.length > 40 ? text.substring(0, 40) + "..." : text;
}

function generateClassSectionOptions() {

  const unique = [...new Set(
    students.map(s => `${s.Class}-${s.Section}`)
  )];

  const container = document.getElementById("classSectionOptions");

  container.innerHTML = unique.map(cs => `
    <label>
      <input type="checkbox" class="csCheck" value="${cs}">
      ${cs}
    </label>
  `).join("");

  document.querySelectorAll(".csCheck").forEach(cb => {
    cb.addEventListener("change", applyFilter);
  });
}