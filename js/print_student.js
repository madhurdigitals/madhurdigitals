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
  students.forEach(s => {
    selectedStudentIds.add(Number(s.Student_ID));
  });
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
        <input type="checkbox" class="rowCheck" value="${s.Student_ID}" checked>
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

        const id = Number(cb.value);

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

    const id = Number(cb.value);

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

    const dropdown = container.querySelector(".dropdown-content");

    if (dropdown && !container.contains(e.target)) {
      dropdown.style.display = "none";
    }

  });

});

// GENERATE CARDS
function generateCards() {

  const selected = filtered.filter(s =>
    selectedStudentIds.has(Number(s.Student_ID))
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
    s => s.school && school &&
         String(s.school).toLowerCase() === school.toLowerCase()
  ) || {};

    // 🔥 UPDATED — branch: custom (drag-and-drop) templates vs. built-in coded templates
  const rawTemplateValue = schoolInfo.template || "";

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
  if (!global) return;

  global.addEventListener("change", function () {

    if (this.checked) {
      students.forEach(s => {
        selectedStudentIds.add(Number(s.Student_ID));
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

  const cardClass = currentTemplateId.indexOf("custom_") === 0 ? "custom-card" : `t2-card-${currentTemplateId}`;

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

  const cardClass = currentTemplateId.indexOf("custom_") === 0 ? "custom-card" : `t2-card-${currentTemplateId}`;

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

  const cardClass = currentTemplateId.indexOf("custom_") === 0 ? "custom-card" : `t2-card-${currentTemplateId}`;
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

  const cardClass = currentTemplateId.indexOf("custom_") === 0 ? "custom-card" : `t2-card-${currentTemplateId}`;
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
    label.innerText = `Selected: ${count} student${count !== 1 ? "s" : ""}`;
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