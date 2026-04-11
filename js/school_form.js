let school = sessionStorage.getItem("school");
let schoolInfo = null;

let fieldConfig = [];

/* LABELS */
const labelMap = {
  name: "Name",
  f_name: "Father Name",
  father_name: "Father Name",
  class: "Class",
  section: "Section",
  dob: "Date of Birth",
  phone: "Phone",
  address: "Address",
  transport: "Transport"
};

/* DEFAULT TYPES */
const defaultFieldTypes = {
  name: "full",
  f_name: "full",
  class: "half",
  section: "half",
  dob: "half",
  transport: "half",
  phone: "full",
  address: "multiline"
};

/* LOAD SCHOOL */
async function loadSchool() {

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
  );

  if (!schoolInfo) {
    alert("School not found");
    return;
  }

  buildFieldConfig();
}

loadSchool();

/* BUILD CONFIG */
function buildFieldConfig() {

  const schoolFields = schoolInfo.fields
    .split(",")
    .map(f => f.trim().toLowerCase());

  const defaultFields = [
    "name","f_name","class","section","dob","transport","phone","address"
  ];

  const merged = [...new Set([...defaultFields, ...schoolFields])];

  fieldConfig = merged.map(f => ({
    key: f,
    label: labelMap[f] || f,
    enabled: true,
    type: defaultFieldTypes[f] || "full"
  }));

  renderFieldSettings();
}

/* UI RENDER */
function renderFieldSettings() {

  const container = document.getElementById("fieldSettings");

  container.innerHTML = fieldConfig.map((f, i) => `
    <div class="field-row" data-index="${i}">

      <span class="drag">☰</span>

      <input type="checkbox"
        ${f.enabled ? "checked" : ""}
        onchange="toggleField(${i})">

      <span>${f.label}</span>

      <select onchange="changeType(${i}, this.value)">
        <option value="full" ${f.type==="full"?"selected":""}>Full</option>
        <option value="half" ${f.type==="half"?"selected":""}>Half</option>
        <option value="multiline" ${f.type==="multiline"?"selected":""}>Multiline</option>
      </select>

    </div>
  `).join("");
  new Sortable(document.getElementById("fieldSettings"), {
    animation: 150,
    onEnd: function () {
      updateFieldOrder();
    }
  });
}


function updateFieldOrder() {

  const rows = document.querySelectorAll("#fieldSettings .field-row");

  const newOrder = [];

  rows.forEach(row => {
    const index = row.getAttribute("data-index");
    newOrder.push(fieldConfig[index]);
  });

  fieldConfig = newOrder;

  renderFieldSettings();
}


/* HANDLERS */
function toggleField(i) {
  fieldConfig[i].enabled = !fieldConfig[i].enabled;
}

function changeType(i, type) {
  fieldConfig[i].type = type;
}

/* CUSTOM FIELD */
function addCustomField() {

  const input = document.getElementById("customFieldInput");
  const val = input.value.trim();

  if (!val) return;

  fieldConfig.push({
    key: val.toLowerCase().replace(/\s+/g, "_"),
    label: val,
    enabled: true,
    type: "full"
  });

  input.value = "";
  renderFieldSettings();
}

/* GENERATE */
function generateForms() {

  document.getElementById("formSection").style.display = "block";

  renderForms();
}

/* RENDER FORMS */
function renderForms() {

  const container = document.getElementById("formContainer");

  const enabled = fieldConfig
    .filter(f => f.enabled);

  let html = `
    <div class="page">
      ${generateForm(enabled)}
      ${generateForm(enabled)}
      ${generateForm(enabled)}
    </div>
  `;

  container.innerHTML = html;
}

/* SINGLE FORM */
function generateForm(fields) {

  if (fields.length > 12) {
    alert("Maximum 12 fields allowed");
    return "";
  }

  let html = `
    <div class="form-card">

      <!-- HEADER -->
      <div class="header">

        <div class="school-title">
          ${schoolInfo.school_name}
        </div>

        <div class="school-info">
          Address: ${schoolInfo.address} &nbsp;&nbsp; | &nbsp;&nbsp;
          Contact: ${schoolInfo.contact} &nbsp;&nbsp; | &nbsp;&nbsp;
          Session: 2026-27
        </div>

        <div class="divider"></div>

        <div class="form-title">
          STUDENT ADMISSION FORM
        </div>

      </div>

      <!-- MAIN BODY -->
      <div class="form-body">

        <!-- LEFT SIDE -->
        <div class="form-left">
  `;

  // ========================
  // FIXED FIELDS (IN ORDER)
  // ========================

  if (hasField(fields, "name")) {
    html += fieldRow("Name");
  }

  if (hasField(fields, "f_name")) {
    html += fieldRow("Father Name");
  }

  if (hasField(fields, "class") || hasField(fields, "section")) {
    html += splitRow("Class", "Section");
  }

  if (hasField(fields, "dob") || hasField(fields, "transport")) {
    html += splitRow("Date of Birth", "Transport", true);
  }

  if (hasField(fields, "phone")) {
    html += fieldRow("Phone");
  }

  if (hasField(fields, "address")) {
    html += `
      <div class="row address">
        
        <div class="address-first-line">
          <span>Address:</span>
          <div class="line"></div>
        </div>

        <div class="address-line"></div>

      </div>
    `;
  }

  // ========================
  // 🔥 CUSTOM FIELDS (IMPORTANT FIX)
  // ========================

  const fixedFields = [
    "name",
    "f_name",
    "class",
    "section",
    "dob",
    "transport",
    "phone",
    "address"
  ];

  fields.forEach(f => {
    if (!fixedFields.includes(f.key)) {
      html += fieldRow(f.label);
    }
  });

  // ========================

  html += `
        </div>

        <!-- RIGHT SIDE PHOTO -->
        <div class="form-right">
          <div class="photo-box">PHOTO</div>
        </div>

      </div>

    </div>
  `;

  return html;
}

/* HELPERS */

function fieldRow(label) {
  return `
    <div class="row field">
      <span>${label}:</span>
      <div class="line"></div>
    </div>
  `;
}

function splitRow(label1, label2, isDOB=false) {

  return `
    <div class="row split">

      <div class="field">
        <span>${label1}:</span>
        <div class="line ${isDOB ? 'dob' : ''}"></div>
      </div>

      <div class="field">
        <span>${label2}:</span>
        <div class="line"></div>
      </div>

    </div>
  `;
}

function hasField(fields, key) {
  return fields.some(f => f.key === key);
}

/* HALF ROW */
function renderHalfRow(items) {
  return `
    <div class="row split">
      ${items.map(i => `<div>${i}</div>`).join("")}
    </div>
  `;
}