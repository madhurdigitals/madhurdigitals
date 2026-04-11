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
    <div class="field-row">

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

  const enabled = fieldConfig.filter(f => f.enabled);

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

  let html = `
    <div class="form-card">

      <div class="header">
        <h2>${schoolInfo.school_name}</h2>

        <div class="sub">
          <span>${schoolInfo.address}</span>
          <span>Contact: ${schoolInfo.contact}</span>
        </div>

        <div class="line-divider"></div>
      </div>
  `;

  let halfBuffer = [];

  fields.forEach(f => {

    if (f.key === "address") {
      html += `
        <div class="row">Address:</div>
        <div class="row"><span class="line long"></span></div>
        <div class="row"><span class="line long"></span></div>
      `;
      return;
    }

    if (f.key === "dob") {
      halfBuffer.push(`
        <div>Date of Birth:
          <span class="line dob">DD / MM / YYYY</span>
        </div>
      `);
    }

    else if (f.type === "half") {
      halfBuffer.push(`
        <div>${f.label}: <span class="line"></span></div>
      `);
    }

    else {

      if (halfBuffer.length) {
        html += renderHalfRow(halfBuffer);
        halfBuffer = [];
      }

      html += `
        <div class="row">
          ${f.label}: <span class="line long"></span>
        </div>
      `;
    }

    if (halfBuffer.length === 2) {
      html += renderHalfRow(halfBuffer);
      halfBuffer = [];
    }

  });

  if (halfBuffer.length) {
    html += `
      <div class="row">${halfBuffer[0]}</div>
    `;
  }

  html += `</div>`;

  return html;
}

/* HALF ROW */
function renderHalfRow(items) {
  return `
    <div class="row split">
      ${items.map(i => `<div>${i}</div>`).join("")}
    </div>
  `;
}