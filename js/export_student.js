/* =============================================
   export_student.js - Export (🎓 Students | 👩‍🏫 Staff)
   Excel with the chosen fields, or simple cards as PDF. Deleted staff are never included.
   IDs are handled as text (students 50001, staff S-50001).
   ============================================= */
let students = [];
let filtered = [];
let headersGlobal = [];
let allHeaders = [];          // full column list from the sheet (status columns of staff excluded)
let selectedFields = [];
let currentPage = 1;
let rowsPerPage = 20;
let schoolInfo = {};
let selectedStudentIds = new Set();   // IDs as text
let cardPages = [];
let exType = "students";
let exIdKey = "Student_ID";

const school = sessionStorage.getItem("school");
const EX_HIDDEN = ["status", "deleted_at", "deleted_by", "restored_at", "restored_by"];
const exId = s => String(s[exIdKey] === undefined || s[exIdKey] === null ? "" : s[exIdKey]);
const exWord = n => exType === "staff" ? `staff member${n !== 1 ? "s" : ""}` : `student${n !== 1 ? "s" : ""}`;

function showToast(msg, type) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.className = "toast" + (type ? " toast-" + type : "");
  t.style.display = "block";
  clearTimeout(t._h);
  t._h = setTimeout(() => t.style.display = "none", 3500);
}

// ========================
// LOAD DATA
// ========================
async function loadStudents() {
  const rawSchools = await getSchools(true);
  const row = typeof rtSchoolRow === "function" ? rtSchoolRow(rawSchools, school) : null;
  exType = typeof rtCurrentType === "function" ? rtCurrentType(row) : "students";
  exIdKey = exType === "staff" ? "Staff_ID" : "Student_ID";
  applyExportLabels(row);

  const raw = exType === "staff" ? await getStaff(school) : await getStudents(school);
  if (!Array.isArray(raw) || !raw.length) {
    students = []; filtered = []; allHeaders = []; headersGlobal = [];
    renderSmartTable(); renderPagination();
    showToast((raw && raw.error) || "Nothing to export", "error");
    return;
  }

  const headers = raw[0];
  allHeaders = headers.filter(h => !EX_HIDDEN.includes(String(h).toLowerCase()));

  headersGlobal = allHeaders.filter(h => {
    const key = String(h).toLowerCase();
    return key !== "timestamp" && key !== "added_via" && key !== "updated_by" && key !== "photo_link";
  });

  students = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  filtered = [...students];
  selectedStudentIds = new Set(students.map(exId));   // all selected by default
  currentPage = 1;

  renderSmartTable();
  renderPagination();
  generateClassSectionOptions();
  generateFieldSelector();
  loadSchoolInfo(rawSchools);
  updateSelectionUI();
  updateGlobalCheckbox();
}

function applyExportLabels(row) {
  const staff = exType === "staff";
  const heading = document.querySelector(".heading-wrapper");
  if (heading && typeof rtRenderTabs === "function") {
    rtRenderTabs(heading, row, () => {
      document.getElementById("searchName").value = "";
      loadStudents();
    });
  }
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set("exHeading", staff ? "💾 Export Staff" : "💾 Export Students");
  set("groupBtn", staff ? "Select Category" : "Select Class-Section");
  document.querySelectorAll(".container > .card").forEach(c => { c.style.borderTop = staff ? "4px solid #059669" : ""; });
}

loadStudents();
attachGlobalSelect();

// ========================
// SCHOOL INFO
// ========================
function loadSchoolInfo(raw) {
  const headers = raw[0];
  const schools = raw.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  schoolInfo = schools.find(s => s.school !== "" && s.school !== undefined && school &&
                                 String(s.school).toLowerCase() === String(school).toLowerCase()) || {};
}

// ========================
// RENDER TABLE
// ========================
function renderTable(data, headers) {
  const visibleHeaders = headers.filter(h => {
    const key = String(h).toLowerCase();
    return !key.includes("address") && !key.includes("photo");
  });

  const thead = document.querySelector("thead");
  const tbody = document.getElementById("studentTable");

  thead.innerHTML = `
    <tr>
      <th><input type="checkbox" id="selectAll" checked title="Tick / untick everyone on this page"></th>
      ${visibleHeaders.map(h => `<th>${h}</th>`).join("")}
    </tr>
  `;

  tbody.innerHTML = data.map(s => `
    <tr>
      <td>
        <input type="checkbox" class="rowCheck" value="${exId(s)}" checked>
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

  // Only these are unticked by default — everything else (including custom fields) is checked
  const defaultUnchecked = ["timestamp", "added_via", "updated_by", "photo_link"];

  const fields = allHeaders;

  selectedFields = fields.filter(f => !defaultUnchecked.includes(String(f).toLowerCase()));

  container.innerHTML = fields.map(f => {
    const checked = !defaultUnchecked.includes(String(f).toLowerCase());
    return `
      <label class="field-chip ${checked ? "active" : ""}" title="Include this field in the export">
        <input type="checkbox" value="${f}" ${checked ? "checked" : ""}>
        <span>${f}</span>
      </label>
    `;
  }).join("");

  container.querySelectorAll("input").forEach(cb => {
    cb.addEventListener("change", () => {
      cb.closest(".field-chip").classList.toggle("active", cb.checked);
      selectedFields = [...container.querySelectorAll("input:checked")].map(i => i.value);
    });
  });
}

function selectAllFields() {
  document.querySelectorAll("#fieldSelector input").forEach(cb => {
    cb.checked = true;
    cb.closest(".field-chip").classList.add("active");
  });
  selectedFields = [...document.querySelectorAll("#fieldSelector input:checked")].map(i => i.value);
}

function clearAllFields() {
  document.querySelectorAll("#fieldSelector input").forEach(cb => {
    cb.checked = false;
    cb.closest(".field-chip").classList.remove("active");
  });
  selectedFields = [];
}

// ========================
// CLASS-SECTION (students) / CATEGORY (staff) FILTER
// ========================
function groupKey(s) {
  if (exType === "staff") return String(s.Category || "");
  return s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`;
}

function generateClassSectionOptions() {
  const unique = [...new Set(students.map(groupKey).filter(Boolean))].sort((a, b) => {
    if (exType === "staff") return a.localeCompare(b);
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

  filtered = students.filter(s =>
    (String(s.Name || "").toLowerCase().includes(name) || exId(s).toLowerCase().includes(name)) &&
    (selectedCS.length === 0 || selectedCS.includes(groupKey(s))));

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
// CHECKBOXES (IDs as text)
// ========================
function attachCheckboxEvents() {
  const selectAll = document.getElementById("selectAll");

  if (selectAll) {
    selectAll.checked = document.querySelectorAll(".rowCheck").length ===
                        document.querySelectorAll(".rowCheck:checked").length;

    selectAll.addEventListener("change", function () {
      document.querySelectorAll(".rowCheck").forEach(cb => {
        cb.checked = this.checked;
        this.checked ? selectedStudentIds.add(cb.value) : selectedStudentIds.delete(cb.value);
      });
      updateSelectionUI();
    });
  }

  document.querySelectorAll(".rowCheck").forEach(cb => {
    cb.checked = selectedStudentIds.has(cb.value);

    cb.addEventListener("change", () => {
      cb.checked ? selectedStudentIds.add(cb.value) : selectedStudentIds.delete(cb.value);
      updateSelectAllState();
      updateSelectionUI();
    });
  });
}

function attachGlobalSelect() {
  const global = document.getElementById("globalSelect");
  if (!global) return;

  global.addEventListener("change", function () {
    if (this.checked) students.forEach(s => selectedStudentIds.add(exId(s)));
    else selectedStudentIds.clear();
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

  if (label) label.innerText = `Selected: ${count} ${exWord(count)}`;
  if (cardsBtn && !cardsBtn.disabled) cardsBtn.innerText = `📄 Export Cards PDF (${count})`;
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

function selectedPeople() {
  return filtered.filter(s => selectedStudentIds.has(exId(s)));
}

// ========================
// EXPORT CARDS PDF
// ========================
async function exportCardsPDF() {
  const selected = selectedPeople();

  if (selected.length === 0) {
    alert(`Select at least one ${exWord(1)}`);
    return;
  }

  const btn = document.getElementById("exportCardsBtn");
  btn.innerText = "⏳ Generating PDF...";
  btn.disabled = true;

  const cardSection = document.getElementById("cardSection");
  const container = document.getElementById("cardContainer");
  try {
    const pages = [];
    for (let i = 0; i < selected.length; i += 10) pages.push(selected.slice(i, i + 10));

    container.innerHTML = pages.map(p => buildCardHTML(p)).join("");
    cardSection.style.display = "block";
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
    const schoolLabel = schoolInfo.school_name || school || "export";
    pdf.save(`${schoolLabel}_${exType}_cards.pdf`);
    showToast(`PDF ready: ${selected.length} ${exWord(selected.length)}`, "success");
  } catch (err) {
    console.error(err);
    showToast("PDF could not be created — please try again", "error");
  } finally {
    cardSection.style.display = "none";
    container.innerHTML = "";
    btn.disabled = false;
    updateSelectionUI();
  }
}

// ========================
// EXPORT EXCEL - recorded first (no record, no file); the file says who exported it and when
// ========================
function portalName() {
  try { const b = JSON.parse(sessionStorage.getItem("brand") || "null"); if (b && b.name) return b.name; } catch (err) { /* default */ }
  return "Madhur Digitals";
}

let exExporting = false;
async function exportExcel() {
  if (exExporting) return;
  const selected = selectedPeople();

  if (selected.length === 0) {
    alert(`Select at least one ${exWord(1)}`);
    return;
  }

  if (selectedFields.length === 0) {
    alert("Select at least one field");
    return;
  }

  const btn = document.getElementById("exportExcelBtn");
  exExporting = true;
  if (btn) { btn.disabled = true; btn.innerText = "⏳ Preparing Excel…"; }
  try {
    const log = await apiGet({ action: "logExport", school: school, type: exType, count: String(selected.length),
                               fields: selectedFields.join(","), format: "excel" });
    if (!log || log.error || log.auth_error || log.status !== "logged") {
      showToast("Excel NOT created: " + ((log && (log.error || log.message || log.auth_error)) || "no answer from the server"), "error");
      return;
    }
    const rows = selected.map(s => {
      let row = {};
      selectedFields.forEach(f => { row[f] = s[f] || ""; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: selectedFields });
    XLSX.utils.sheet_add_aoa(ws, [[], [`Exported from ${portalName()} by ${log.by} on ${log.at}`]], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, exType === "staff" ? "Staff" : "Students");
    ws["!cols"] = selectedFields.map(() => ({ wch: 20 }));

    const schoolLabel = schoolInfo.school_name || school || "export";
    XLSX.writeFile(wb, `${schoolLabel}_${exType}.xlsx`);
    showToast(`Excel ready: ${selected.length} ${exWord(selected.length)} (this export is recorded)`, "success");
  } finally {
    exExporting = false;
    if (btn) btn.disabled = false;
    updateSelectionUI();
  }
}
