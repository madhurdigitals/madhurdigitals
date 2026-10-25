let students = [];
let filtered = [];
let headersGlobal = [];
let currentPage = 1;
let rowsPerPage = 20;
let schoolInfo = {};
let selectedStudentIds = new Set();
let cardPages = [];
let currentCardPage = 1;
let currentTemplateId = null;   // 🔥 UPDATED — no hardcoded default anymore
let currentOrientation = "landscape";   // 🔥 NEW — resolved per school's template
const templateOrientationCache = {};    // 🔥 NEW — avoids re-detecting every render

function isTemplateReady() {
  return !!(currentTemplateId && window.CARD_TEMPLATES && window.CARD_TEMPLATES[currentTemplateId]);
}

const school = sessionStorage.getItem("school");

/* ── WHICH CARDS? 🎓 Students · 👩‍🏫 Staff · 🏛 Management (S4b) ──
   Each type prints with its own ★ Default design. Staff cards need a Staff design (no fallback to the
   Student design); Management cards use the Staff design until a Management design exists. */
const P_TYPES = {
  student:    { icon: "🎓", label: "Students",   one: "student",      many: "students",      col: "template" },
  staff:      { icon: "👩‍🏫", label: "Staff",      one: "staff member", many: "staff members", col: "staff_template" },
  management: { icon: "🏛", label: "Management", one: "person",       many: "people",        col: "management_template" }
};
let printType = "student";
let pIdKey = "Student_ID";
let printDefault = "";          // the ★ Default design used for this type
let noDesign = false;           // staff/management: no design to print with yet
const idOf = s => String(s[pIdKey] === undefined || s[pIdKey] === null ? "" : s[pIdKey]);
function groupOf(s) {
  if (printType === "student") return s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`;
  return String(s.Designation || "");
}
function pCanStaff() {
  let perms = [];
  try { perms = JSON.parse(sessionStorage.getItem("permissions") || "[]") || []; } catch (err) { perms = []; }
  return sessionStorage.getItem("role") === "admin" || perms.includes("staff");
}

function setupPrintTypes() {
  const staffOn = String(schoolInfo.staff_enabled || "").toLowerCase() === "yes" && pCanStaff();
  const want = sessionStorage.getItem("printType");
  printType = staffOn && P_TYPES[want] ? want : "student";
  pIdKey = printType === "student" ? "Student_ID" : "Staff_ID";
  const bar = document.getElementById("printTypeTabs");
  if (bar) {
    bar.style.display = staffOn ? "flex" : "none";
    bar.innerHTML = Object.keys(P_TYPES).map(k => `<button type="button" data-type="${k}" class="${k === printType ? "on" : ""}"
        title="Print ${P_TYPES[k].label.toLowerCase()} cards">${P_TYPES[k].icon} ${P_TYPES[k].label}</button>`).join("");
    bar.onclick = e => {
      const b = e.target.closest("button[data-type]");
      if (!b || b.disabled || pLoading || b.dataset.type === printType) return;
      sessionStorage.setItem("printType", b.dataset.type);
      resetPrintPage();
      loadStudents();
    };
  }
  const t = P_TYPES[printType];
  const h = document.getElementById("printHeading"); if (h) h.textContent = `${t.icon} Print ${t.label}`;
  const g = document.getElementById("groupBtn"); if (g) g.textContent = printType === "student" ? "Select Class-Section" : "Select Designation";
}

function resetPrintPage() {
  students = []; filtered = []; selectedStudentIds = new Set(); cardPages = []; currentPage = 1;
  document.getElementById("cardSection").style.display = "none";
  const cl = document.getElementById("checklistSection"); if (cl) cl.style.display = "none";
  document.getElementById("searchName").value = "";
}

/* ── LOADING: tabs locked, a clear message in the table, buttons wait (no silent waiting, no double clicks) ── */
let pLoading = false;
function setPrintLoading(on, what) {
  pLoading = on;
  document.querySelectorAll("#printTypeTabs button").forEach(b => {
    b.disabled = on;
    b.style.cursor = on ? "wait" : "";
    b.style.opacity = on && !b.classList.contains("on") ? ".6" : "";
    const base = b.textContent.replace(/^⏳\s*/, "");
    b.textContent = on && b.classList.contains("on") ? "⏳ " + base : base;
  });
  ["generateBtn", "checklistBtn"].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = on || (id === "generateBtn" && noDesign); });
  if (on) {
    const tb = document.getElementById("studentTable");
    if (tb) tb.innerHTML = `<tr><td colspan="20" style="padding:24px; text-align:center; color:#6b7280; font-weight:600;">⏳ Loading ${what || "the list"}… please wait</td></tr>`;
    const head = document.querySelector("thead"); if (head) head.innerHTML = "";
  }
}

// LOAD DATA
async function loadStudents() {
  if (pLoading) return;
  setPrintLoading(true, "");
  try { await loadStudentsNow(); } finally { setPrintLoading(false); }
}

async function loadStudentsNow() {
  const rawSchools = await getSchools(true);
  const sh = rawSchools[0] || [];
  const allSchools = rawSchools.slice(1).map(row => { const o = {}; sh.forEach((h, i) => o[h] = row[i]); return o; });
  schoolInfo = allSchools.find(s => s.school !== "" && s.school !== undefined && school &&
                                    String(s.school).toLowerCase() === String(school).toLowerCase()) || {};
  setupPrintTypes();
  setPrintLoading(true, P_TYPES[printType].label.toLowerCase());

  const raw = printType === "student" ? await getStudents(school) : await getStaff(school);
  if (!Array.isArray(raw) || !raw.length) {
    students = []; filtered = []; headersGlobal = [];
    renderSmartTable(); renderPagination();
    alert((raw && raw.error) || "Could not load the list");
    return;
  }

  const headers = raw[0];
  const hidden = ["timestamp", "status", "deleted_at", "deleted_by", "restored_at", "restored_by"];
  headersGlobal = headers.filter(h => !hidden.includes(String(h).toLowerCase()));

  students = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
  if (printType !== "student") {           // Staff cards: Category Staff; Management cards: Category Management
    students = students.filter(s => (String(s.Category || "").toLowerCase() === "management") === (printType === "management"));
  }

  filtered = [...students];
  selectedStudentIds = new Set(students.map(idOf));
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

// 🔥 UPDATED — loads both JS and CSS for a template, using registry-derived folder paths
async function loadTemplateAssets(templateId) {
  if (window.CARD_TEMPLATES && window.CARD_TEMPLATES[templateId]) return;

  const paths = getTemplatePaths(templateId);

  // Load CSS (fire and forget — doesn't block rendering, but should be quick)
  const cssId = `template-css-${templateId}`;
  if (!document.getElementById(cssId)) {
    const link = document.createElement("link");
    link.id = cssId;
    link.rel = "stylesheet";
    link.href = `${paths.css}?v=${Date.now()}`;
    document.head.appendChild(link);
  }

  // Load JS — must complete before we can render
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${paths.js}?v=${Date.now()}`;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load template: ${templateId}`));
    document.head.appendChild(script);
  });
}


// 🔥 NEW — loads a custom (drag-and-drop) template's data and builds its CARD_TEMPLATES entry on the fly
async function loadCustomTemplateAssets(templateId) {
  if (window.CARD_TEMPLATES && window.CARD_TEMPLATES[templateId] && window.CARD_TEMPLATES[templateId].__isCustom) return;

  const params = new URLSearchParams({ action: "getCustomTemplates" });
  const res = await fetch(`${API_URL}?${params.toString()}`);
  const raw = await res.json();

  if (!raw || raw.length < 2) throw new Error("No custom templates found");

  const headers = raw[0];
  const rows = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  const row = rows.find(r => r.template_id === templateId);
  if (!row) throw new Error(`Custom template "${templateId}" not found`);

  // A school design based on a built-in (code) template: print it with that built-in template
  if (row.base_template) {
    await loadTemplateAssets(row.base_template);
    const base = window.CARD_TEMPLATES && window.CARD_TEMPLATES[row.base_template];
    if (!base) throw new Error(`Built-in template "${row.base_template}" not found`);
    window.CARD_TEMPLATES[templateId] = Object.assign({}, base, { __isCustom: true, __base: row.base_template });
    return;
  }

  let layout;
  try {
    layout = JSON.parse(row.layout_json || "{}");
  } catch (e) {
    throw new Error(`Invalid layout JSON for "${templateId}"`);
  }

  const frontBgUrl = row.front_bg_link ? getPhotoUrl(row.front_bg_link, "w_1000") : "";
  const backBgUrl  = row.back_bg_link  ? getPhotoUrl(row.back_bg_link, "w_1000")  : "";

  window.CARD_TEMPLATES = window.CARD_TEMPLATES || {};
  window.CARD_TEMPLATES[templateId] = {
    __isCustom: true,
    orientation: row.orientation || "landscape",
    renderFront: function(student, schoolInfo, options) {
      return renderCustomTemplateSide(layout.front, student, schoolInfo, frontBgUrl);
    },
    renderBack: layout.back ? function(schoolInfo) {
      return renderCustomTemplateSide(layout.back, {}, schoolInfo, backBgUrl);
    } : null
  };
}


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
        <input type="checkbox" class="rowCheck" value="${idOf(s)}" checked>
      </td>
      ${visibleHeaders.map(h => `<td>${s[h] || ""}</td>`).join("")}
    </tr>
  `).join("");

  attachCheckboxEvents();
  updateSelectionUI();
}

function generateFieldSelector() {

  const container = document.getElementById("fieldSelector");

  const excludeAlways = ["added_by", "added_via", "updated_by"];

  const fields = headersGlobal.filter(h => {
    const key = h.toLowerCase().replace(/[^a-z0-9]/g, "_");
    return !key.includes("photo") && !excludeAlways.includes(key);
  });

  // default = all remaining selected
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

    selectAll.checked = document.querySelectorAll(".rowCheck")
      .length === document.querySelectorAll(".rowCheck:checked").length;

    selectAll.addEventListener("change", function () {

      const checked = this.checked;

      document.querySelectorAll(".rowCheck").forEach(cb => {

        const id = cb.value;

        cb.checked = checked;

        if (checked) {
          selectedStudentIds.add(id);
        } else {
          selectedStudentIds.delete(id);
        }

      });
      updateSelectionUI();
    });
    

  }

  document.querySelectorAll(".rowCheck").forEach(cb => {

    const id = cb.value;

    // restore state when rendering
    cb.checked = selectedStudentIds.has(id);

    cb.addEventListener("change", () => {

      if (cb.checked) {
        selectedStudentIds.add(id);
      } else {
        selectedStudentIds.delete(id);
      }

      updateSelectAllState();
      updateSelectionUI();
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

    const cs = groupOf(s);

    return (
      (String(s.Name || "").toLowerCase().includes(name) || idOf(s).toLowerCase().includes(name)) &&
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

    const dropdown = container.querySelector(".dropdown-content");

    if (dropdown && !container.contains(e.target)) {
      dropdown.style.display = "none";
    }

  });

});

// GENERATE CARDS
function generateCards() {
  if (noDesign) { alert(`No ${P_TYPES[printType].label} design yet — create one in Template Builder first.`); return; }

  const selected = filtered.filter(s =>
    selectedStudentIds.has(idOf(s))
  );

  if (selected.length === 0) {
    alert("Select at least one student");
    return;
  }

  document.getElementById("cardSection").style.display = "block";

  // 🔥 CREATE PAGES (10 per page)
  cardPages = [];

  for (let i = 0; i < selected.length; i += 10) {
    cardPages.push(selected.slice(i, i + 10));
  }

  // reset page
  currentCardPage = 1;

  // render first page
  renderCardPage();
  renderCardPagination();
}

// 🔥 UPDATED — uses resolveTemplateId() from the registry, no hardcoded fallback
async function loadSchoolInfo() {

  const raw = await getSchools(true);

  const headers = raw[0];

  const schools = raw.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  schoolInfo = schools.find(
    s => s.school !== "" && s.school !== undefined && school &&
         String(s.school).toLowerCase() === String(school).toLowerCase()
  ) || {};

  // The school's ★ Default design for THIS card type; other designs of this type can be chosen on the page
  let tpl = String(schoolInfo[P_TYPES[printType].col] || "");
  let note = "";
  if (printType === "management" && !tpl) {
    tpl = String(schoolInfo.staff_template || "");
    if (tpl) note = "No Management design yet — printing with the ★ Staff design.";
  }
  showDesignMessage(printType !== "student" && !tpl, note);
  if (printType !== "student" && !tpl) return;          // nothing to print with
  printDefault = tpl;
  await activateTemplate(tpl);              // always the ★ Default of this card type (chosen in Template Builder)
}

// Staff / Management without a design: say so clearly, with a way to make one
function showDesignMessage(missing, note) {
  noDesign = !!missing;
  const box = document.getElementById("noDesignBox");
  if (box) {
    box.style.display = (missing || note) ? "block" : "none";
    box.style.background = missing ? "#fef2f2" : "#eff6ff";
    box.style.borderColor = missing ? "#fca5a5" : "#bfdbfe";
    box.innerHTML = missing
      ? `⚠ <b>No ${printType === "management" ? "Staff or Management" : "Staff"} design yet</b> — these cards can't be printed until one exists.
         <a href="template_builder.html?school=${encodeURIComponent(school)}" style="margin-left:8px; font-weight:700;">🎨 Create one in Template Builder</a>`
      : `ℹ ${note}`;
  }
  const gen = document.getElementById("generateBtn");
  if (gen) gen.disabled = !!missing;

}

// Loads one design / template and makes it the one cards are printed with
async function activateTemplate(rawTemplateValue) {

  if (rawTemplateValue.indexOf("custom_") === 0) {
    currentTemplateId = rawTemplateValue;
    try {
      await loadCustomTemplateAssets(currentTemplateId);
    } catch (err) {
      console.warn(`Custom template "${currentTemplateId}" failed to load, falling back:`, err);
      currentTemplateId = getFallbackTemplateId();
      await loadTemplateAssets(currentTemplateId);
    }
  } else {
    currentTemplateId = resolveTemplateId(rawTemplateValue);
    try {
      await loadTemplateAssets(currentTemplateId);
    } catch (err) {
      console.warn(`Template "${currentTemplateId}" failed to load, falling back:`, err);
      currentTemplateId = getFallbackTemplateId();
      await loadTemplateAssets(currentTemplateId);
    }
  }

  currentOrientation = await getTemplateOrientation(currentTemplateId);

  // Show/hide back-sheet buttons based on whether this template has a back design
  const template = window.CARD_TEMPLATES[currentTemplateId];
  const printBackBtn = document.getElementById("printBackBtn");
  const downloadBackBtn = document.getElementById("downloadBackBtn");
  const hasBack = !!(template && template.renderBack);
  if (printBackBtn) printBackBtn.style.display = hasBack ? "inline-block" : "none";
  if (downloadBackBtn) downloadBackBtn.style.display = hasBack ? "inline-block" : "none";

}

function attachGlobalSelect() {

  const global = document.getElementById("globalSelect");
  if (!global || global.dataset.bound) return;      // once - the list can reload (Students / Staff / Management)
  global.dataset.bound = "1";

  global.addEventListener("change", function () {

    if (this.checked) {
      students.forEach(s => {
        selectedStudentIds.add(idOf(s));
      });
    } else {
      selectedStudentIds.clear();
    }

    renderSmartTable(); // refresh checkboxes
    updateSelectionUI();
    updateGlobalCheckbox();
  });

}

function updateGlobalCheckbox() {

  const global = document.getElementById("globalSelect");
  if (!global) return;

  const total = students.length;
  const selected = selectedStudentIds.size;

  if (selected === 0) {
    global.checked = false;
    global.indeterminate = false;
  } 
  else if (selected === total) {
    global.checked = true;
    global.indeterminate = false;
  } 
  else {
    global.checked = false;
    global.indeterminate = true; // 🔥 important
  }

}

function updateSelectAllState() {
  const selectAll = document.getElementById("selectAll");

  if (!selectAll) return;

  const all = document.querySelectorAll(".rowCheck");
  const checked = document.querySelectorAll(".rowCheck:checked");

  selectAll.checked = all.length === checked.length;
}


// ADDRESS LIMIT
function truncate(text) {
  return text.length > 40 ? text.substring(0, 40) + "..." : text;
}

function generateClassSectionOptions() {

  const unique = [...new Set(students.map(groupOf).filter(Boolean))].sort((a, b) => {
    if (printType !== "student") return a.localeCompare(b);

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

  if (cardPages.length === 0) {
    alert("Generate cards first");
    return;
  }

  const overlay = document.getElementById("pdfLoadingOverlay");
  const loadingText = document.getElementById("pdfLoadingText");
  overlay.style.display = "flex";
  loadingText.innerText = "Rendering cards...";

  // render ALL pages first
  renderAllCardPages();

  // wait for every image in the rendered cards to finish loading
  loadingText.innerText = "Loading photos...";
  const allImages = document.querySelectorAll("#cardContainer img");
  await Promise.all([...allImages].map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));

  const pages = document.querySelectorAll(".page");

  const dims = getPdfPageDims(currentOrientation);
  const pdf = new jsPDF(dims.pdfOrientation, "mm", "a4");

  for (let i = 0; i < pages.length; i++) {

    loadingText.innerText = `Generating page ${i + 1} of ${pages.length}...`;

    const canvas = await html2canvas(pages[i], {
      scale: 2,
      useCORS: true
    });
    const img = canvas.toDataURL("image/png");

    if (i !== 0) pdf.addPage();

    pdf.addImage(img, "PNG", 0, 0, dims.width, dims.height);
  }

  loadingText.innerText = "Saving PDF...";
  pdf.save(`${school}_students.pdf`);

  overlay.style.display = "none";

  // restore UI view
  renderCardPage();
}

function renderCardPage() {
  if (!isTemplateReady()) {
    alert("Template is still loading, please try again in a moment.");
    return;
  }

  const container = document.getElementById("cardContainer");

  const pageData = cardPages[currentCardPage - 1] || [];

  const template = window.CARD_TEMPLATES[currentTemplateId];

  const cardClass = cardClassFor(currentTemplateId);

  container.innerHTML = `
    <div class="page ${currentOrientation === 'portrait' ? 'page-portrait' : ''}">
      ${pageData.map(s => `
        <div class="id-card ${cardClass}">
          ${template.renderFront(s, schoolInfo, { selectedFields, schoolCode: school })}
        </div>
      `).join("")}
    </div>
  `;
}

function renderCardPagination() {

  const container = document.getElementById("cardPagination");

  let buttons = "";

  for (let i = 1; i <= cardPages.length; i++) {
    buttons += `
      <button onclick="goToCardPage(${i})"
        ${i === currentCardPage ? "style='font-weight:bold'" : ""}>
        ${i}
      </button>
    `;
  }

  container.innerHTML = buttons;
}

function goToCardPage(page) {
  currentCardPage = page;
  renderCardPage();
}

function renderAllCardPages() {
  if (!isTemplateReady()) {
    alert("Template is still loading, please try again in a moment.");
    return;
  }

  const container = document.getElementById("cardContainer");
  const template = window.CARD_TEMPLATES[currentTemplateId];

  const cardClass = cardClassFor(currentTemplateId);

  container.innerHTML = cardPages.map(page => `
    <div class="page ${currentOrientation === 'portrait' ? 'page-portrait' : ''}">
      ${page.map(s => `
        <div class="id-card ${cardClass}">
          ${template.renderFront(s, schoolInfo, { selectedFields, schoolCode: school })}
        </div>
      `).join("")}
    </div>
  `).join("");
}

function printAllCards() {

  // render ALL pages
  renderAllCardPages();
  setPrintPageOrientation(currentOrientation);

  setTimeout(() => {
    window.print();

    // restore current page view after print
    setTimeout(() => {
      renderCardPage();
    }, 500);

  }, 200);
}

async function printBackSheet() {
  if (!isTemplateReady()) {
    alert("Template is still loading, please try again in a moment.");
    return;
  }
  const template = window.CARD_TEMPLATES[currentTemplateId];
  if (!template || !template.renderBack) {
    alert("This template does not have a back design.");
    return;
  }

  const cardClass = cardClassFor(currentTemplateId);
  const backCardHtml = `<div class="id-card ${cardClass}">${template.renderBack(schoolInfo)}</div>`;
  const container = document.getElementById("cardContainer");

  container.innerHTML = `<div class="page ${currentOrientation === 'portrait' ? 'page-portrait' : ''}">${Array(10).fill(backCardHtml).join("")}</div>`;
  setPrintPageOrientation(currentOrientation);
  setTimeout(() => {
    window.print();
    setTimeout(() => { renderCardPage(); }, 500);
  }, 200);
}

async function downloadBackSheetPDF() {
  if (!isTemplateReady()) {
    alert("Template is still loading, please try again in a moment.");
    return;
  }
  const template = window.CARD_TEMPLATES[currentTemplateId];
  if (!template || !template.renderBack) {
    alert("This template does not have a back design.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const overlay = document.getElementById("pdfLoadingOverlay");
  const loadingText = document.getElementById("pdfLoadingText");
  overlay.style.display = "flex";
  loadingText.innerText = "Rendering back sheet...";

  const cardClass = cardClassFor(currentTemplateId);
  const backCardHtml = `<div class="id-card ${cardClass}">${template.renderBack(schoolInfo)}</div>`;
  const container = document.getElementById("cardContainer");
  container.innerHTML = `<div class="page ${currentOrientation === 'portrait' ? 'page-portrait' : ''}">${Array(10).fill(backCardHtml).join("")}</div>`;

  const page = document.querySelector("#cardContainer .page");
  const canvas = await html2canvas(page, { scale: 2, useCORS: true });
  const img = canvas.toDataURL("image/png");

  const dims = getPdfPageDims(currentOrientation);
  const pdf = new jsPDF(dims.pdfOrientation, "mm", "a4");
  pdf.addImage(img, "PNG", 0, 0, dims.width, dims.height);
  pdf.save(`${school}_back_sheet.pdf`);

  overlay.style.display = "none";
  renderCardPage();
}

function updateSelectionUI() {
  const count = selectedStudentIds.size;

  const label = document.getElementById("selectionCount");
  const btn = document.getElementById("generateBtn");

  if (label) {
    label.innerText = `Selected: ${count} ${count === 1 ? P_TYPES[printType].one : P_TYPES[printType].many}`;
  }

  if (btn) {
    btn.innerText = `Generate Cards (${count})`;
  }

  updateGlobalCheckbox(); // 🔥 sync global checkbox
}

// 🔥 NEW — measures a template's own intrinsic card size to determine orientation
async function detectTemplateOrientation(templateId) {
  const probe = document.createElement("div");
  probe.className = `card-size-template_${templateId}`;
  probe.style.cssText = "position:absolute; visibility:hidden; left:-9999px; top:-9999px;";
  document.body.appendChild(probe);

  const rect = probe.getBoundingClientRect();
  document.body.removeChild(probe);

  if (rect.width === 0 && rect.height === 0) {
    console.warn(`No card-size-template_${templateId} CSS found — defaulting to landscape.`);
    return "landscape";
  }

  return rect.width >= rect.height ? "landscape" : "portrait";
}

// 🔥 NEW — explicit metadata first, auto-detection as fallback, cached either way
async function getTemplateOrientation(templateId) {
  if (templateOrientationCache[templateId]) return templateOrientationCache[templateId];

  const template = window.CARD_TEMPLATES[templateId];
  if (template && (template.orientation === "landscape" || template.orientation === "portrait")) {
    templateOrientationCache[templateId] = template.orientation;
    return template.orientation;
  }

  const detected = await detectTemplateOrientation(templateId);
  templateOrientationCache[templateId] = detected;
  return detected;
}

// 🔥 NEW — returns correct jsPDF orientation + page dimensions for a card orientation
function getPdfPageDims(orientation) {
  return orientation === "portrait"
    ? { pdfOrientation: "l", width: 297, height: 210 }
    : { pdfOrientation: "p", width: 210, height: 297 };
}

// 🔥 NEW — injects/updates a dynamic @page rule right before printing
function setPrintPageOrientation(orientation) {
  let styleEl = document.getElementById("dynamicPageOrientation");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "dynamicPageOrientation";
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = orientation === "portrait"
    ? "@page { size: A4 landscape; margin: 0; }"
    : "@page { size: A4; margin: 0; }";
}


// The CSS class a card needs: custom designs, designs based on a built-in template, built-in templates
function cardClassFor(templateId) {
  const t = window.CARD_TEMPLATES && window.CARD_TEMPLATES[templateId];
  if (t && t.__base) return `t2-card-${t.__base}`;
  return String(templateId).indexOf("custom_") === 0 ? "custom-card" : `t2-card-${templateId}`;
}

// ── CARD DESIGN CHOICE: a school can have several designs (★ Default first) ──
async function setupDesignChoice() {
  const wrap = document.getElementById("designChoiceWrap");
  const sel  = document.getElementById("designSelect");
  if (!wrap || !sel) return;
  let rows = [];
  try {
    const raw = await fetch(`${API_URL}?action=getCustomTemplates`).then(r => r.json());
    if (raw && raw.length > 1) {
      const h = raw[0];
      rows = raw.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; });
    }
  } catch (err) { rows = []; }
  const code = String(school || "").toLowerCase();
  const typeOf = r => { const v = String(r.card_type || "").toLowerCase(); return P_TYPES[v] ? v : "student"; };
  const wantType = printType === "management" && !schoolInfo.management_template ? "staff" : printType;
  const designs = rows.filter(r => String(r.visibility || "").toLowerCase() === "school" &&
                                   String(r.owner_school || "").toLowerCase() === code && typeOf(r) === wantType);
  const def = printDefault;
  const nameOf = id => {
    const c = rows.find(r => r.template_id === id);
    if (c) return c.template_name;
    const b = (typeof TEMPLATE_REGISTRY !== "undefined" ? TEMPLATE_REGISTRY : []).find(t => t.id === id);
    return b ? b.name : id;
  };
  const options = [{ id: def, name: nameOf(def) }].concat(designs.filter(d => d.template_id !== def).map(d => ({ id: d.template_id, name: d.template_name })));
  if (options.length <= 1) { wrap.style.display = "none"; return; }
  sel.innerHTML = options.map((o, i) => `<option value="${o.id}">${i === 0 ? "★ " : ""}${String(o.name).replace(/</g, "&lt;")}${i === 0 ? " (default)" : ""}</option>`).join("");
  sel.value = currentTemplateId === def ? def : sel.value;
  wrap.style.display = "";
}

async function switchDesign(templateId) {
  const sel = document.getElementById("designSelect");
  if (sel) sel.disabled = true;
  try {
    await activateTemplate(templateId);
    if (cardPages.length) { renderCardPage(); renderCardPagination(); }
  } finally {
    if (sel) sel.disabled = false;
  }
}


/* =============================================
   📋 VERIFICATION CHECKLIST (S4b) - plain black & white, for the school to check the data before printing
   Grouped by class-section (students) or designation (staff). Header: school, title, date, page X of Y.
   Footer: Checked by / Signature & stamp. Small greyscale photo per person.
   ============================================= */
const CL_ROWS_PER_PAGE = 12;
const clEsc = v => String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function clPick(s, re) {
  const k = Object.keys(s).find(k => re.test(String(k).toLowerCase().replace(/[^a-z0-9]/g, "_")));
  return k ? String(s[k] === undefined || s[k] === null ? "" : s[k]).replace(/^'/, "") : "";
}
function clDate(v) {
  if (v instanceof Date) return `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})T/.exec(String(v || ""));
  if (iso) { const d = new Date(v); if (!isNaN(d)) return clDate(d); }
  return String(v || "").replace(/^'/, "");
}
function checklistColumns() {
  if (printType === "student") return [
    ["Father's Name", s => clPick(s, /father/)],
    ["Class-Section", s => groupOf(s).replace(/-$/, "")],
    ["DOB",          s => clDate(clPick(s, /^dob$|birth/))],
    ["Phone",        s => clPick(s, /phone|mobile|contact/)]];
  return [
    ["Designation",             s => s.Designation || ""],
    ["Father's/Husband's Name", s => clPick(s, /father|husband/)],
    ["DOB",                     s => clDate(clPick(s, /^dob$|birth/))],
    ["Phone",                   s => clPick(s, /phone|mobile|contact/)]];
}

function buildChecklistPages() {
  const people = filtered.filter(s => selectedStudentIds.has(idOf(s)))
    .sort((a, b) => groupOf(a).localeCompare(groupOf(b), undefined, { numeric: true }) || String(a.Name || "").localeCompare(String(b.Name || "")));
  const cols = checklistColumns();
  // rows: group headings + people, cut into pages
  const rows = [];
  let lastGroup = null, n = 0;
  people.forEach(s => {
    const g = groupOf(s) || "—";
    if (g !== lastGroup) { rows.push({ group: g }); lastGroup = g; }
    rows.push({ s, n: ++n });
  });
  const pages = [];
  for (let i = 0; i < rows.length; i += CL_ROWS_PER_PAGE) pages.push(rows.slice(i, i + CL_ROWS_PER_PAGE));
  const today = clDate(new Date());
  const title = printType === "student" ? "Data verification checklist" : `Data verification checklist — ${P_TYPES[printType].label}`;
  const head = `<tr><th style="width:8mm;">No.</th><th style="width:14mm;">Photo</th><th>ID</th><th>Name</th>${cols.map(c => `<th>${clEsc(c[0])}</th>`).join("")}<th style="width:28mm;">✓ / Correction</th></tr>`;
  return pages.map((rowsOnPage, p) => `
    <div class="cl-page">
      <div class="cl-head">
        <div class="cl-school">${clEsc(schoolInfo.school_name || school)}</div>
        <div class="cl-title">${clEsc(title)}</div>
        <div class="cl-meta"><span>Date: ${today}</span><span>Page ${p + 1} of ${pages.length}</span></div>
      </div>
      <table class="cl-table"><thead>${head}</thead><tbody>
        ${rowsOnPage.map(r => r.group !== undefined
          ? `<tr class="cl-group"><td colspan="${cols.length + 5}">${printType === "student" ? "Class-Section" : "Designation"}: ${clEsc(r.group)}</td></tr>`
          : `<tr><td>${r.n}</td>
               <td>${r.s.Photo_Link && typeof getPhotoUrl === "function" ? `<img src="${getPhotoUrl(r.s.Photo_Link, "w_90,h_110,c_fill,e_grayscale")}" crossorigin="anonymous">` : `<div class="cl-nophoto">No photo</div>`}</td>
               <td>${clEsc(idOf(r.s))}</td><td><b>${clEsc(r.s.Name)}</b></td>
               ${cols.map(c => `<td>${clEsc(c[1](r.s))}</td>`).join("")}<td></td></tr>`).join("")}
      </tbody></table>
      <div class="cl-foot"><span>Checked by: ____________________</span><span>Signature &amp; stamp: ____________________</span></div>
    </div>`);
}

const CL_CSS = `
  .cl-page { width:210mm; min-height:297mm; padding:10mm; box-sizing:border-box; background:#fff; color:#000;
             font-family:Arial, sans-serif; font-size:9.5pt; display:flex; flex-direction:column; page-break-after:always; margin:0 auto 6mm; }
  .cl-head { text-align:center; border-bottom:1.5px solid #000; padding-bottom:3mm; margin-bottom:3mm; }
  .cl-school { font-size:15pt; font-weight:700; }
  .cl-title { font-size:11pt; margin-top:1mm; }
  .cl-meta { display:flex; justify-content:space-between; font-size:9pt; margin-top:2mm; }
  .cl-table { width:100%; border-collapse:collapse; }
  .cl-table th, .cl-table td { border:1px solid #000; padding:1.2mm 1.5mm; text-align:left; vertical-align:middle; }
  .cl-table th { background:#fff; font-weight:700; }
  .cl-table img { width:11mm; height:14mm; object-fit:cover; display:block; filter:grayscale(1); }
  .cl-nophoto { width:11mm; height:14mm; border:1px dashed #000; font-size:6pt; display:flex; align-items:center; justify-content:center; text-align:center; }
  .cl-group td { font-weight:700; background:#fff; border-top:2px solid #000; }
  .cl-foot { margin-top:auto; padding-top:8mm; display:flex; justify-content:space-between; font-size:10pt; }
  @media print { .cl-page { margin:0; } }`;

function showChecklist() {
  if (!filtered.some(s => selectedStudentIds.has(idOf(s)))) { alert(`Select at least one ${P_TYPES[printType].one}`); return; }
  const sec = document.getElementById("checklistSection"), box = document.getElementById("checklistContainer");
  if (!sec || !box) return;
  if (!document.getElementById("clCss")) { const st = document.createElement("style"); st.id = "clCss"; st.textContent = CL_CSS; document.head.appendChild(st); }
  box.innerHTML = buildChecklistPages().join("");
  sec.style.display = "block";
  if (sec.scrollIntoView) sec.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Print in its own window, so only the checklist is printed (black & white, A4)
function printChecklist() {
  const pages = buildChecklistPages();
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups for this site to print the checklist."); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>Data verification checklist</title><style>${CL_CSS} @page { size:A4; margin:0; } body { margin:0; }</style></head>
    <body>${pages.join("")}</body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

async function downloadChecklistPDF() {
  const box = document.getElementById("checklistContainer");
  if (!box || !box.querySelector(".cl-page")) showChecklist();
  const pages = document.querySelectorAll("#checklistContainer .cl-page");
  if (!pages.length) return;
  const overlay = document.getElementById("pdfLoadingOverlay"), text = document.getElementById("pdfLoadingText");
  if (overlay) overlay.style.display = "flex";
  try {
    await Promise.all([...box.querySelectorAll("img")].map(img => img.complete ? null : new Promise(r => { img.onload = r; img.onerror = r; })));
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    for (let i = 0; i < pages.length; i++) {
      if (text) text.innerText = `Creating page ${i + 1} of ${pages.length}...`;
      const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      if (i) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
    }
    pdf.save(`${schoolInfo.school_name || school}_${printType}_checklist.pdf`);
  } catch (err) {
    console.error(err);
    alert("The checklist PDF could not be created — please try again.");
  } finally {
    if (overlay) overlay.style.display = "none";
  }
}
