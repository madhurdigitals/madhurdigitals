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
    <div class="field-row" data-key="${f.key}">

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
    const key = row.getAttribute("data-key");
    const item = fieldConfig.find(f => f.key === key);
    if (item) newOrder.push(item);
  });

  fieldConfig = newOrder;

  renderForms(); // 🔥 update preview live
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

  const key = val.toLowerCase().replace(/\s+/g, "_");

  // 🔥 prevent duplicate
  if (fieldConfig.some(f => f.key === key)) {
    alert("Field already exists");
    return;
  }

  fieldConfig.push({
    key: key,
    label: val,
    enabled: true,
    type: "full"
  });

  input.value = "";
  renderFieldSettings();
}

/* GENERATE */
function generateForms() {

  const color = document.getElementById("headerColor").value;
  document.getElementById("formSection").style.display = "block";

  renderForms(color);
}

/* RENDER FORMS */
function renderForms(color) {

  const container = document.getElementById("formContainer");

  const enabled = fieldConfig.filter(f => f.enabled);

  let html = `
    <div class="page">
      ${generateForm(enabled, color)}
      ${generateForm(enabled, color)}
      ${generateForm(enabled, color)}
    </div>
  `;

  container.innerHTML = html;
}

/* SINGLE FORM */
function generateForm(fields, color="light") {
  const fieldCount = fields.length;

  let spacingClass = "normal";

  if (fieldCount >= 9) spacingClass = "medium";
  if (fieldCount >= 11) spacingClass = "tight";

  if (fields.length > 12) {
    alert("Maximum 12 fields allowed");
    return "";
  }

  let html = `
    <div class="form-card ${spacingClass}">

      <!-- HEADER -->
      <div class="header ${color || 'light'}">

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
          STUDENT ID CARD FORM
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

  let halfBuffer = [];

fields.forEach(f => {

  // MULTILINE
  if (f.type === "multiline") {

    // flush half buffer first
    if (halfBuffer.length === 1) {
      html += fieldRow(halfBuffer[0].label);
      halfBuffer = [];
    }

    html += `
      <div class="row address">
        <div class="address-first-line">
          <span>${f.label}:</span>
          <div class="line"></div>
        </div>
        <div class="address-line"></div>
      </div>
    `;
  }

  // HALF
  else if (f.type === "half") {

    halfBuffer.push(f);

    if (halfBuffer.length === 2) {
      html += splitRow(
        halfBuffer[0].label,
        halfBuffer[1].label,
        halfBuffer[0].key === "dob" || halfBuffer[1].key === "dob"
      );
      halfBuffer = [];
    }
  }

  // FULL
  else {

    // flush half buffer first
    if (halfBuffer.length === 1) {
      html += fieldRow(halfBuffer[0].label);
      halfBuffer = [];
    }

    html += fieldRow(f.label);
  }

});

// leftover half
if (halfBuffer.length === 1) {
  html += fieldRow(halfBuffer[0].label);
}

  // ========================
  // 🔥 CUSTOM FIELDS (IMPORTANT FIX)
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

  const isDOB = label.toLowerCase().includes("birth");

  return `
    <div class="row field">
      <span>${label}:</span>
      <div class="line ${isDOB ? 'dob' : ''}"></div>
    </div>
  `;
}

function splitRow(label1, label2, isDOB=false) {

  return `
    <div class="row split">

      <div class="field">
        <span>${label1}:</span>
        <div class="line ${label1.toLowerCase().includes("birth") ? 'dob' : ''}"></div>
      </div>

      <div class="field">
        <span>${label2}:</span>
        <div class="line ${label2.toLowerCase().includes("birth") ? 'dob' : ''}"></div>
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

function resetFields() {

  // rebuild original config
  buildFieldConfig();

  // hide forms
  document.getElementById("formSection").style.display = "none";
}