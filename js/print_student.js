let students = [];
let filtered = [];
let headersGlobal = [];
let currentPage = 1;
let rowsPerPage = 20;
let schoolInfo = {};

const school = sessionStorage.getItem("school");

// LOAD DATA
async function loadStudents() {
  const raw = await getStudents(school);

  const headers = raw[0];

  headersGlobal = headers.filter(h => h !== "Timestamp");

  students = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  filtered = [...students];

  renderSmartTable();
  renderPagination();
  generateClassSectionOptions();
  generateFieldSelector();
  await loadSchoolInfo();
}

loadStudents();

// RENDER TABLE
function renderTable(data, headers) {

  const visibleHeaders = headers.filter(h => {
    const key = h.toLowerCase();
    return !key.includes("address") && !key.includes("photo");
  });

  const thead = document.querySelector("thead");
  const tbody = document.getElementById("studentTable");

  // HEADER
  thead.innerHTML = `
    <tr>
      <th><input type="checkbox" id="selectAll" checked></th>
      ${visibleHeaders.map(h => `<th>${h}</th>`).join("")}
    </tr>
  `;

  // BODY
  tbody.innerHTML = data.map(s => `
    <tr>
      <td>
        <input type="checkbox" class="rowCheck" value="${s.Student_ID}" checked>
      </td>
      ${visibleHeaders.map(h => `<td>${s[h] || ""}</td>`).join("")}
    </tr>
  `).join("");

  attachCheckboxEvents();
}

function generateFieldSelector() {

  const container = document.getElementById("fieldSelector");

  const fields = headersGlobal.filter(h => {
    const key = h.toLowerCase();
    return !key.includes("photo");
  });

  // default = all selected
  selectedFields = [...fields];

  container.innerHTML = fields.map(f => `
    <label>
      <input type="checkbox" value="${f}" checked>
      ${f}
    </label>
  `).join("");

  container.querySelectorAll("input").forEach(cb => {
    cb.addEventListener("change", () => {
      selectedFields = [...container.querySelectorAll("input:checked")]
        .map(i => i.value);
    });
  });

}


function renderSmartTable() {
  const data = filtered;

  if (data.length <= rowsPerPage) {
    renderTable(data, headersGlobal);
    document.getElementById("pagination").innerHTML = "";
  } else {
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = data.slice(start, start + rowsPerPage);

    renderTable(pageData, headersGlobal);
  }
}

function renderPagination() {
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const container = document.getElementById("pagination");

  if (filtered.length <= rowsPerPage) {
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
  currentPage = page;
  renderSmartTable();
  renderPagination();
}

function nextPage() {
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
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

function attachCheckboxEvents() {

  const selectAll = document.getElementById("selectAll");

  if (selectAll) {
    selectAll.addEventListener("change", function () {
      const checked = this.checked;

      document.querySelectorAll(".rowCheck").forEach(cb => {
        cb.checked = checked;
      });
    });
  }

  document.querySelectorAll(".rowCheck").forEach(cb => {
    cb.addEventListener("change", () => {

      const all = document.querySelectorAll(".rowCheck");
      const checked = document.querySelectorAll(".rowCheck:checked");

      selectAll.checked = all.length === checked.length;
    });
  });
}

// EVENTS
document.getElementById("searchName")
  .addEventListener("input", applyFilter);


function applyFilter() {

  const name = document.getElementById("searchName").value.toLowerCase();

  const selectedCS = [...document.querySelectorAll(".csCheck:checked")]
    .map(cb => cb.value);

  filtered = students.filter(s => {

    const cs = s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`;

    return (
      (s.Name || "").toLowerCase().includes(name) &&
      (selectedCS.length === 0 || selectedCS.includes(cs))
    );
  });

  currentPage = 1; // 🔥 VERY IMPORTANT

  renderSmartTable();   
  renderPagination();  
}

function toggleDropdown(id, event) {

  event.stopPropagation(); // 🔥 important

  const el = document.getElementById(id);

  const isOpen = el.style.display === "block";

  document.querySelectorAll(".dropdown-content")
    .forEach(d => d.style.display = "none");

  el.style.display = isOpen ? "none" : "block";
}

document.addEventListener("click", function (e) {

  const dropdowns = document.querySelectorAll(".dropdown");

  dropdowns.forEach(container => {

    if (dropdown && !container.contains(e.target)) {
      dropdown.style.display = "none";
    }

    if (!container.contains(e.target)) {
      dropdown.style.display = "none";
    }

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
    selectedIds.includes(Number(s.Student_ID))
  );

  document.getElementById("cardSection").style.display = "block";

  renderCards(selected);
}

async function loadSchoolInfo() {

  const raw = await getSchools(true);

  const headers = raw[0];

  const schools = raw.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  schoolInfo = schools.find(
    s => s.school && school &&
         s.school.toLowerCase() === school.toLowerCase()
  ) || {};

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

        <div class="id-card">

          <div class="card-header">

            <div class="school-name">
              ${schoolInfo.school_name || school}
            </div>

            <div class="school-meta">
              ${schoolInfo.address || ""}
            </div>

            <div class="school-meta">
              ${schoolInfo.contact || ""}
            </div>

          </div>

          <div class="card-body">

            <div class="left">
              <div class="photo-box"></div>
            </div>

            <div class="right">

              ${selectedFields.map((f, i) => {

                if (i === 0) {
                  return `<div class="name">${s[f] || ""}</div>`;
                }

                return `
                  <div class="line">
                    <span>${f}:</span> ${s[f] || ""}
                  </div>
                `;

              }).join("")}

            </div>

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
    students.map(s => s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`)
  )].sort((a, b) => {

    const [c1, s1] = a.split("-");
    const [c2, s2] = b.split("-");

    // sort by class (numeric)
    if (c1 != c2) return Number(c1) - Number(c2);

    // then by section (A, B, C...)
    return (s1 || "").localeCompare(s2 || "");
  });

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

async function downloadCardsPDF() {

  const { jsPDF } = window.jspdf;

  const pages = document.querySelectorAll(".page");

  if (pages.length === 0) {
    alert("Generate cards first");
    return;
  }

  const pdf = new jsPDF("p", "mm", "a4");

  for (let i = 0; i < pages.length; i++) {

    const canvas = await html2canvas(pages[i], { scale: 2 });
    const img = canvas.toDataURL("image/png");

    if (i !== 0) pdf.addPage();

    pdf.addImage(img, "PNG", 0, 0, 210, 297);
  }

  pdf.save(`${school}_students.pdf`);
}