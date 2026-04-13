let rawData = [];
let mappedData = [];
let headers = [];
let schoolFields = [];
function normalizeKey(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");
}
const school = sessionStorage.getItem("school");
// document.addEventListener("DOMContentLoaded", function () {
//   const fileInput = document.getElementById("fileInput");
//   const loadBtn = document.getElementById("loadBtn");

//   fileInput.addEventListener("change", function () {
//     if (fileInput.files.length > 0) {
//       loadBtn.style.display = "inline-block";
//     }
//   });
// });

function showLoadBtn() {
  const fileInput = document.getElementById("fileInput");
  const loadBtn = document.getElementById("loadBtn");

  if (fileInput.files.length > 0) {
    loadBtn.style.display = "inline-block";
  }
}

// READ FILE
// document.getElementById("fileInput").addEventListener("change", handleFile);

function handleFile(e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function(evt) {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    headers = json[0];
    rawData = json.slice(1).filter(r => r.some(cell => cell)); // skip blank

    renderMapping();
  };

  reader.readAsArrayBuffer(file);
}

// MAPPING UI
function renderMapping() {

  const fields = schoolFields.map(f => ({
    original: f,
    key: normalizeKey(f)
  }));

  document.getElementById("mappingBox").innerHTML =
    fields.map(f => {

      // 🔥 auto detect best column
      let autoIndex = "";

      headers.forEach((h, i) => {
        const mapped = autoMapField(h);
        if (mapped === f.key && autoIndex === "") {
          autoIndex = i;
        }
      });

      return `
        <div>
          ${f.original} →
          <select onchange="mapColumn('${f.key}', this.value)">
            <option value="">Ignore</option>
            ${headers.map((h, i) => `
              <option value="${i}" ${i == autoIndex ? "selected" : ""}>
                ${h}
              </option>
            `).join("")}
          </select>
        </div>
      `;
    }).join("");

  // 🔥 APPLY AUTO MAP TO columnMap
  columnMap = {}; // 🔥 RESET FIRST

  fields.forEach(f => {
    headers.forEach((h, i) => {
      const mapped = autoMapField(h);
      if (mapped === f.key && columnMap[f.key] === undefined) {
        columnMap[f.key] = i;
      }
    });
  });

  buildTable();
}

// STORE MAPPING
let columnMap = {};

function mapColumn(fieldKey, columnIndex) {

  columnIndex = Number(columnIndex); // 🔥 FIX (important)

  // remove duplicate mapping
  for (let key in columnMap) {
    if (columnMap[key] === columnIndex) {
      delete columnMap[key];
    }
  }

  if (columnIndex === "" || isNaN(columnIndex)) {
    delete columnMap[fieldKey];
  } else {
    columnMap[fieldKey] = columnIndex;
  }

  buildTable();
}

// BUILD TABLE
function buildTable() {

  mappedData = rawData.map(row => {

    let obj = {};

    schoolFields.forEach(f => {
      const key = normalizeKey(f);
      const colIndex = columnMap[key];

      obj[key] = colIndex !== undefined ? row[colIndex] : "";
    });

    // ✅ validation
    obj.valid = obj.name && obj.class;

    obj.selected = obj.valid;
    obj.status = "pending";

    return obj;
  });

  renderTable();
}

// RENDER TABLE
function renderTable() {

  // 🔥 dynamic headers
  const headersHtml = schoolFields.map(f => `<th>${f}</th>`).join("");
  if (columnMap[key] === undefined) {
    return `<td style="background:#eee; color:#999">IGNORED</td>`;
  }
  document.getElementById("tableHead").innerHTML = `
    <tr>
      <th><input type="checkbox" onclick="selectAll(this)"></th>
      ${headersHtml}
    </tr>
  `;

  document.getElementById("tableBody").innerHTML =
    mappedData.map((r, i) => {

      const cells = schoolFields.map(f => {
        const key = normalizeKey(f);

        return `
          <td contenteditable="true"
              oninput="editCell(${i}, '${key}', this.innerText, this)">
              ${r[key] || ''}
          </td>
        `;
      }).join("");

      return `
        <tr style="background: ${getRowColor(r)}">
          <td>
            <input type="checkbox"
              ${r.selected ? 'checked' : ''}
              onchange="toggleRow(${i}, this.checked)">
          </td>
          ${cells}
        </tr>
      `;
    }).join("");
}

// EDIT
function editCell(i, field, value, el) {

  // ✅ update data
  mappedData[i][field] = value;

  // ✅ validation
  mappedData[i].valid =
    mappedData[i].name?.toString().trim() &&
    mappedData[i].class?.toString().trim();

  // ✅ mark as edited
  mappedData[i].edited = true;

  // ✅ update row color dynamically
  const row = el.parentElement;
  row.style.background = getRowColor(mappedData[i]);

  // ✅ highlight edited row (blue border)
  row.style.outline = "2px solid #007bff";

  enableSubmit();
}

// SELECT
function toggleRow(i, checked) {
  mappedData[i].selected = checked;
  renderTable(); 
  enableSubmit(); 
}

function selectAll(el) {
  mappedData.forEach(r => {
    if (r.valid) r.selected = el.checked;
  });
  renderTable();
  enableSubmit(); 
}

// SUBMIT
async function submitData() {
  if (!validateMapping()) return;
  const validRows = mappedData.filter(r => r.valid && r.selected);

  if (validRows.length === 0) {
    alert("No valid rows selected");
    return;
  }

  // 🔥 Build dynamic payload based on school fields
  const payload = validRows.map(r => {
    let obj = {};

    schoolFields.forEach(f => {
      const key = normalizeKey(f);

      // ✅ ONLY include mapped fields
      if (columnMap[key] !== undefined) {
        obj[key] = r[key] || "";
      }
    });

    return obj;
  });

  try {

    const url = `${API_URL}?action=bulkUploadStudents&school=${school}&data=${encodeURIComponent(JSON.stringify(payload))}`;

    const res = await fetch(url);
    const result = await res.json();

    // ✅ Mark uploaded rows
    mappedData.forEach(r => {
      if (r.valid && r.selected) {
        r.status = "uploaded";
      }
    });

    renderTable();

    // ✅ Disable button after upload
    document.querySelector(".submit-btn").disabled = true;

    alert(`Uploaded: ${result.added}`);

  } catch (err) {
    console.error("Bulk Upload Error:", err);
    alert("Upload failed");
  }
}

  renderTable();

  // ✅ Disable button
  document.querySelector(".submit-btn").disabled = true;

 


// SAMPLE
function downloadSample() {
  const sample = [
    ["Name","Class","Section","Roll","Phone","Address"],
    ["Aditya","1","A","1","9999999999","City"]
  ];

  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sample");

  XLSX.writeFile(wb, "sample.xlsx");
}

async function loadData() {

  // 🔥 ensure schools loaded
  if (!schoolsData || schoolsData.length === 0) {
    await loadSchoolsData();
  }

  const file = document.getElementById("fileInput").files[0];

  if (!file) {
    alert("Please select file first");
    return;
  }

  const reader = new FileReader();

  reader.onload = function(evt) {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    headers = json[0];
    rawData = json.slice(1).filter(r => r.some(cell => cell));

    // 🔥 NOW SAFE
    const currentSchool = schoolsData.find(s => s.school === school);

    if (!currentSchool) {
      alert("School config not found");
      return;
    }

    schoolFields = currentSchool.fields.split(",").map(f => f.trim());

    renderMapping();
  };

  reader.readAsArrayBuffer(file);
}

async function loadSchoolsData() {
  const raw = await getSchools();

  const headers = raw[0];

  schoolsData = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}


function enableSubmit() {
  document.querySelector(".submit-btn").disabled = false;
}

// function showLoadBtn() {
//   document.getElementById("loadBtn").style.display = "inline-block";
// }

function getRowColor(r) {

  if (r.status === "uploaded") {
    return "#ccffcc";   // green
  }

  if (!r.valid) {
    return "#ffcccc";   // red
  }

  if (r.edited) {
    return "#e6f0ff";   // 🔵 light blue (edited)
  }

  if (!r.selected) {
    return "#fff3cd";   // yellow
  }

  return ""; // default
}

function downloadExcel() {

  if (!mappedData || mappedData.length === 0) {
    alert("No data to download");
    return;
  }

  // ✅ Get school name
  const school = sessionStorage.getItem("school") || "School";

  // ✅ Get today date
  const today = new Date().toISOString().split("T")[0];

  // =========================
  // 📄 Sheet 1 → Student_data
  // =========================
  const studentData = mappedData
    .filter(r => r.valid && r.selected)
    .map(r => ({
      Name: r.name || "",
      Class: r.class || "",
      Section: r.section || "",
      Roll: r.roll || "",
      Phone: r.phone || "",
      Address: r.address || ""
    }));

  // =========================
  // 📄 Sheet 2 → Error_data_logs
  // =========================
  const errorData = mappedData
    .filter(r => !r.valid || !r.selected)
    .map(r => ({
      Name: r.name || "",
      Class: r.class || "",
      Section: r.section || "",
      Roll: r.roll || "",
      Phone: r.phone || "",
      Address: r.address || "",
      Status: !r.valid ? "Invalid" : "Not Selected"
    }));

  // =========================
  // 📦 Create Workbook
  // =========================
  const wb = XLSX.utils.book_new();

  // Sheet 1
  const ws1 = XLSX.utils.json_to_sheet(studentData);
  XLSX.utils.book_append_sheet(wb, ws1, "Student_data");

  // Sheet 2
  const ws2 = XLSX.utils.json_to_sheet(errorData);
  XLSX.utils.book_append_sheet(wb, ws2, "Error_data_logs");

  // =========================
  // 📁 File Name
  // =========================
  const fileName = `${school}_${today}_bulk_upload_sheet.xlsx`;

  // Download
  XLSX.writeFile(wb, fileName);
}

const FIELD_ALIASES = {
  name: ["name", "student_name", "student", "full_name"],

  father_s_name: [
    "father_name",
    "father",
    "father_s_name",
    "guardian_name"
  ],

  class: ["class", "std", "standard", "grade"],

  section: ["section", "sec", "division"],

  dob: ["dob", "date_of_birth", "birth_date"],

  phone: ["phone", "mobile", "contact", "phone_number"],

  address: ["address", "addr", "location", "residence"]
};

function autoMapField(header) {

  const normalizedHeader = normalizeKey(header);

  // 🔥 1. Exact match with school fields
  for (let f of schoolFields) {
    const key = normalizeKey(f);
    if (normalizedHeader === key) return key;
  }

  // 🔥 2. Alias match
  for (let fieldKey in FIELD_ALIASES) {
    const aliases = FIELD_ALIASES[fieldKey];

    if (aliases.includes(normalizedHeader)) {
      return fieldKey;
    }
  }

  // 🔥 3. Fuzzy match (partial)
  for (let f of schoolFields) {
    const key = normalizeKey(f);

    if (
      normalizedHeader.includes(key) ||
      key.includes(normalizedHeader)
    ) {
      return key;
    }
  }

  // ❌ No match
  return "";
}

function validateMapping() {

  const required = ["name", "class"];

  for (let r of required) {
    if (columnMap[r] === undefined) {   // ✅ FIXED
      alert(`Missing required field mapping: ${r}`);
      return false;
    }
  }

  return true;
}