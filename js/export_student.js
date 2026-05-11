let students = [];
let filtered = [];
let headersGlobal = [];
let selectedFields = [];
let currentPage = 1;
let rowsPerPage = 20;
let schoolInfo = {};
let selectedStudentIds = new Set();
let cardPages = [];

const school = sessionStorage.getItem("school");

// ========================
// LOAD DATA
// ========================
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

  // Select all by default
  students.forEach(s => selectedStudentIds.add(Number(s.Student_ID)));

  renderSmartTable();
  renderPagination();
  generateClassSectionOptions();
  generateFieldSelector();
  await loadSchoolInfo();
  updateSelectionUI();
  attachGlobalSelect();
  updateGlobalCheckbox();
}

loadStudents();

// ========================
// SCHOOL INFO
// ========================
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

// ========================
// RENDER TABLE
// ========================
function renderTable(data, headers) {
  const visibleHeaders = headers.filter(h => {
    const key = h.toLowerCase();
    return !key.includes("address") && !key.includes("photo");
  });

  const thead = document.querySelector("thead");
  const tbody = document.getElementById("studentTable");

  thead.innerHTML = `
    <tr>
      <th><input type="checkbox" id="selectAll" checked></th>
      ${visibleHeaders.map(h => `<th>${h}</th>`).join("")}
    </tr>
  `;

  tbody.innerHTML = data.map(s => `
    <tr>
      <td>
        <input type="checkbox" class="rowCheck" value="${s.Student_ID}" checked>
      </td>
      ${visibleHeaders.map(h => `<td>${s[h] || ""}</td>`).join("")}
    </tr>
  `).join("");

  attachCheckboxEvents();
  updateSelectionUI();
}

function renderSmartTable() {
  if (filtered.length <= rowsPerPage) {
    renderTable(filtered, headersGlobal);
    document.getElementById("pagination").innerHTML = "";
  } else {
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filtered.slice(start, start + rowsPerPage);
    renderTable(pageData, headersGlobal);
  }
}

// ========================
// PAGINATION
// ========================
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
        ${i === currentPage ? "style='font-weight:bold'" : ""}>${i}</button>
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
  if (currentPage < totalPages) { currentPage++; renderSmartTable(); renderPagination(); }
}

function prevPage() {
  if (currentPage > 1) { currentPage--; renderSmartTable(); renderPagination(); }
}

// ========================
// FIELD SELECTOR
// ========================
function generateFieldSelector() {
  const container = document.getElementById("fieldSelector");

  const fields = headersGlobal.filter(h => !h.toLowerCase().includes("photo"));
  selectedFields = [...fields];

  container.innerHTML = fields.map(f => `
    <label>
      <input type="checkbox" value="${f}" checked> ${f}
    </label>
  `).join("");

  container.querySelectorAll("input").forEach(cb => {
    cb.addEventListener("change", () => {
      selectedFields = [...container.querySelectorAll("input:checked")].map(i => i.value);
    });
  });
}

// ========================
// CLASS-SECTION FILTER
// ========================
function generateClassSectionOptions() {
  const unique = [...new Set(
    students.map(s => s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`)
  )].sort((a, b) => {
    const [c1, s1] = a.split("-");
    const [c2, s2] = b.split("-");
    if (c1 != c2) return Number(c1) - Number(c2);
    return (s1 || "").localeCompare(s2 || "");
  });

  const container = document.getElementById("classSectionOptions");
  container.innerHTML = unique.map(cs => `
    <label><input type="checkbox" class="csCheck" value="${cs}"> ${cs}</label>
  `).join("");

  document.querySelectorAll(".csCheck").forEach(cb => {
    cb.addEventListener("change", applyFilter);
  });
}

// ========================
// FILTER
// ========================
document.getElementById("searchName").addEventListener("input", applyFilter);

function applyFilter() {
  const name = document.getElementById("searchName").value.toLowerCase();
  const selectedCS = [...document.querySelectorAll(".csCheck:checked")].map(cb => cb.value);

  filtered = students.filter(s => {
    const cs = s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`;
    return (
      (s.Name || "").toLowerCase().includes(name) &&
      (selectedCS.length === 0 || selectedCS.includes(cs))
    );
  });

  currentPage = 1;
  renderSmartTable();
  renderPagination();
}

// ========================
// DROPDOWN
// ========================
function toggleDropdown(id, event) {
  event.stopPropagation();
  const el = document.getElementById(id);
  const isOpen = el.style.display === "block";
  document.querySelectorAll(".dropdown-content").forEach(d => d.style.display = "none");
  el.style.display = isOpen ? "none" : "block";
}

document.addEventListener("click", function (e) {
  document.querySelectorAll(".dropdown").forEach(container => {
    const dropdown = container.querySelector(".dropdown-content");
    if (dropdown && !container.contains(e.target)) {
      dropdown.style.display = "none";
    }
  });
});

// ========================
// CHECKBOXES
// ========================
function attachCheckboxEvents() {
  const selectAll = document.getElementById("selectAll");

  if (selectAll) {
    selectAll.checked = document.querySelectorAll(".rowCheck").length ===
                        document.querySelectorAll(".rowCheck:checked").length;

    selectAll.addEventListener("change", function () {
      document.querySelectorAll(".rowCheck").forEach(cb => {
        const id = Number(cb.value);
        cb.checked = this.checked;
        this.checked ? selectedStudentIds.add(id) : selectedStudentIds.delete(id);
      });
      updateSelectionUI();
    });
  }

  document.querySelectorAll(".rowCheck").forEach(cb => {
    const id = Number(cb.value);
    cb.checked = selectedStudentIds.has(id);

    cb.addEventListener("change", () => {
      cb.checked ? selectedStudentIds.add(id) : selectedStudentIds.delete(id);
      updateSelectAllState();
      updateSelectionUI();
    });
  });
}

function attachGlobalSelect() {
  const global = document.getElementById("globalSelect");
  if (!global) return;

  global.addEventListener("change", function () {
    if (this.checked) {
      students.forEach(s => selectedStudentIds.add(Number(s.Student_ID)));
    } else {
      selectedStudentIds.clear();
    }
    renderSmartTable();
    updateSelectionUI();
    updateGlobalCheckbox();
  });
}

function updateSelectAllState() {
  const selectAll = document.getElementById("selectAll");
  if (!selectAll) return;
  const all = document.querySelectorAll(".rowCheck");
  const checked = document.querySelectorAll(".rowCheck:checked");
  selectAll.checked = all.length === checked.length;
}

function updateGlobalCheckbox() {
  const global = document.getElementById("globalSelect");
  if (!global) return;
  const total = students.length;
  const selected = selectedStudentIds.size;

  if (selected === 0) {
    global.checked = false;
    global.indeterminate = false;
  } else if (selected === total) {
    global.checked = true;
    global.indeterminate = false;
  } else {
    global.checked = false;
    global.indeterminate = true;
  }
}

function updateSelectionUI() {
  const count = selectedStudentIds.size;

  const label = document.getElementById("selectionCount");
  const cardsBtn = document.getElementById("exportCardsBtn");
  const excelBtn = document.getElementById("exportExcelBtn");

  if (label) label.innerText = `Selected: ${count} student${count !== 1 ? "s" : ""}`;
  if (cardsBtn) cardsBtn.innerText = `📄 Export Cards PDF (${count})`;
  if (excelBtn) excelBtn.innerText = `📊 Export Excel (${count})`;

  updateGlobalCheckbox();
}

// ========================
// CARD RENDER HELPERS
// ========================
function buildCardHTML(pageData) {
  return `
    <div class="page">
      ${pageData.map(s => `
        <div class="id-card">
          <div class="card-header">
            <div class="school-name">${schoolInfo.school_name || school}</div>
            <div class="school-meta">${schoolInfo.address || ""}</div>
            <div class="school-meta">${schoolInfo.contact || ""}</div>
          </div>
          <div class="card-body">
            <div class="left">
              <div class="photo-box"></div>
            </div>
            <div class="right">
              ${selectedFields.map((f, i) => {
                if (i === 0) return `<div class="name">${s[f] || ""}</div>`;
                if (f === "Class" && selectedFields.includes("Section")) {
                  const val = [s.Class, s.Section].filter(Boolean).join(" - ");
                  return `<div class="line"><span>Class:</span> ${val}</div>`;
                }
                if (f === "Section" && selectedFields.includes("Class")) return "";
                return `<div class="line"><span>${f}:</span> ${s[f] || ""}</div>`;
              }).join("")}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// ========================
// EXPORT CARDS PDF
// ========================
async function exportCardsPDF() {
  const selected = filtered.filter(s => selectedStudentIds.has(Number(s.Student_ID)));

  if (selected.length === 0) {
    alert("Select at least one student");
    return;
  }

  const btn = document.getElementById("exportCardsBtn");
  btn.innerText = "⏳ Generating PDF...";
  btn.disabled = true;

  // Split into pages of 10
  const pages = [];
  for (let i = 0; i < selected.length; i += 10) {
    pages.push(selected.slice(i, i + 10));
  }

  // Render all pages into hidden container
  const container = document.getElementById("cardContainer");
  container.innerHTML = pages.map(p => buildCardHTML(p)).join("");

  const cardSection = document.getElementById("cardSection");
  cardSection.style.display = "block";

  // Wait for DOM
  await new Promise(r => setTimeout(r, 300));

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  const pageEls = container.querySelectorAll(".page");

  for (let i = 0; i < pageEls.length; i++) {
    const canvas = await html2canvas(pageEls[i], { scale: 2 });
    const img = canvas.toDataURL("image/png");
    if (i !== 0) pdf.addPage();
    pdf.addImage(img, "PNG", 0, 0, 210, 297);
  }

  const schoolLabel = schoolInfo.school_name || school || "students";
  pdf.save(`${schoolLabel}_cards.pdf`);

  // Cleanup
  cardSection.style.display = "none";
  container.innerHTML = "";

  btn.disabled = false;
  updateSelectionUI();
}

// ========================
// EXPORT EXCEL
// ========================
function exportExcel() {
  const selected = filtered.filter(s => selectedStudentIds.has(Number(s.Student_ID)));

  if (selected.length === 0) {
    alert("Select at least one student");
    return;
  }

  if (selectedFields.length === 0) {
    alert("Select at least one field");
    return;
  }

  // Build rows using only selectedFields
  const rows = selected.map(s => {
    let row = {};
    selectedFields.forEach(f => {
      row[f] = s[f] || "";
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: selectedFields });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");

  // Column widths
  ws["!cols"] = selectedFields.map(() => ({ wch: 20 }));

  const schoolLabel = schoolInfo.school_name || school || "students";
  XLSX.writeFile(wb, `${schoolLabel}_students.xlsx`);
}