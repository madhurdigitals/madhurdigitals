let rawData = [];
let mappedData = [];
let headers = [];
let schoolFields = [];

document.addEventListener("DOMContentLoaded", async () => {

  const school = sessionStorage.getItem("school");

  if (!school) {
    alert("No school selected");
    return;
  }

  await loadSchoolsData();

  const currentSchool = schoolsData.find(s => s.school === school);

  if (!currentSchool) {
    alert("School config not found");
    return;
  }

  schoolFields = currentSchool.fields.split(",").map(f => f.trim());

  console.log("✅ School Fields Loaded:", schoolFields);
});

const FIELD_ALIASES = {
  name: ["name", "student_name", "student", "full_name"],

  father_s_name: [
    "father_name",
    "father",
    "father_s_name",
    "guardian_name",
    "Father's Name"
  ],

  class: ["class", "std", "standard", "grade"],

  section: ["section", "sec", "division"],

  dob: ["dob", "date_of_birth", "birth_date"],

  phone: ["phone", "mobile", "contact", "phone_number"],

  address: ["address", "addr", "location", "residence"]
};


function normalizeKey(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");
}
const school = sessionStorage.getItem("school");


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

  // ✅ handle ignore properly
  if (columnIndex === "") {
    delete columnMap[fieldKey];
  } else {
    columnIndex = Number(columnIndex);

    // remove duplicate mapping
    for (let key in columnMap) {
      if (columnMap[key] === columnIndex) {
        delete columnMap[key];
      }
    }

    columnMap[fieldKey] = columnIndex;
  }

  buildTable();
}

// BUILD TABLE
function buildTable() {

  mappedData = rawData.map((row, i) => {

    let existing = mappedData[i] || {};

    let obj = {};

    schoolFields.forEach(f => {
      const key = normalizeKey(f);
      const colIndex = columnMap[key];

      let value = colIndex !== undefined ? row[colIndex] : "";

      // ✅ Apply DOB formatting
      if (key === "dob") {
        value = formatDOB(value);
      }

      obj[key] = value;
    });

    // ✅ FIXED → boolean
    obj.valid = !!(
      obj.name?.toString().trim() &&
      obj.class?.toString().trim()
    );

    // ✅ FIXED → strict boolean
    obj.selected =
      existing.selected !== undefined
        ? existing.selected === true
        : obj.valid === true;

    obj.status = existing.status || "pending";
    obj.edited = existing.edited || false;

    return obj;
  });

  renderTable();
}

// RENDER TABLE
function renderTable() {

  // 🔥 dynamic headers
  const headersHtml = schoolFields.map(f => `<th>${f}</th>`).join("");
  
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

        // ✅ IGNORE UI FIX
        if (columnMap[key] === undefined) {
          return `<td>Ignored</td>`;
          // return `<td style="background:#eee; color:#999">Ignored</td>`;
        }

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
              ${r.selected === true ? 'checked' : ''}
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

  const validRows = mappedData.filter(r => r.valid && r.selected === true);

  if (validRows.length === 0) {
    alert("No valid rows selected");
    return;
  }

  // 🔥 STEP 2.1: Get existing students before upload
  const existingData = await getStudents(school);

  // Extract student IDs (assuming first column is student_id)
  const existingIds = new Set(
    existingData.slice(1).map(row => row[0]) // skip header row
  );

  const countBefore = existingIds.size;

  // 🔒 Disable button permanently
  const submitBtn = document.querySelector(".submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerText = "Uploading...";

  // 🔥 Build dynamic payload based on school fields
  const payload = validRows.map(r => {
    let obj = {};

    schoolFields.forEach(f => {
      const key = normalizeKey(f);

      if (columnMap[key] !== undefined) {
        obj[key] = r[key] || "";
      }
    });

    return obj;
  });

  // 🔥 Clean data
  payload.forEach(obj => {
    if (obj.phone) {
      obj.phone = obj.phone.toString().replace(/\n/g, "").trim();
    }
    if (obj.address) {
      obj.address = obj.address.replace(/\n/g, " ").trim();
    }
  });

  try {

    // 🚀 Send POST request (no-cors)
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "bulkUploadStudents",
        school: school,
        data: payload
      })
    });

    // ⛔ DO NOT mark uploaded yet (we'll verify in next step)
    // ⛔ DO NOT show success yet

    console.log("Upload request sent, waiting for verification...");
    // 🔥 STEP 2.3: Smart Polling
    const maxTime = 180000; // 3 minutes
    const interval = 5000;  // 5 seconds

    let elapsed = 0;
    let newStudents = [];
    let updatedData = [];

    while (elapsed < maxTime) {

      // wait 5 seconds
      await new Promise(resolve => setTimeout(resolve, interval));

      elapsed += interval;

      // fetch latest data
      updatedData = await getStudents(school);

      const updatedRows = updatedData.slice(1); // skip header

      // find new students using ID comparison
      newStudents = updatedRows.filter(row => !existingIds.has(row[0]));

      if (newStudents.length > 0) {
        console.log("New students detected:", newStudents.length);
        break;
      }

      console.log("Waiting for data...", elapsed / 1000, "sec");
    }

        // 🔥 Handle result after polling

    if (newStudents.length === 0) {
      alert("Upload is taking longer than expected. Please refresh later.");
      return;
    }

    const uploadedCount = newStudents.length;
    const selectedCount = validRows.length;

    // 🔥 Partial failure check
    if (uploadedCount < selectedCount) {
      alert(`Uploaded ${uploadedCount} students. Some records may have failed.`);
    } else {
      alert(`Uploaded ${uploadedCount} students successfully`);
    }
        // 🔥 SHOW ONLY NEWLY UPLOADED STUDENTS

    // Convert newStudents to rawData format
    // 🔥 STEP 1: Get headers dynamically
    const headers = updatedData[0]; // from polling fetch

    // 🔥 STEP 2: Convert rows → objects (like manage_student.js)
    const newStudentObjects = newStudents.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

    // 🔥 STEP 3: Convert to rawData based on schoolFields
    // 🔥 Normalize headers map
    const headerMap = {};
    headers.forEach(h => {
      headerMap[normalizeKey(h)] = h;
    });

    // 🔥 Map dynamically using normalized keys
    rawData = newStudentObjects.map(student => {
      // 🔥 Reset and rebuild mapping for reconstructed data
    // 🔥 Reset and rebuild mapping for reconstructed data
    columnMap = {};

    schoolFields.forEach((f, index) => {
      const key = normalizeKey(f);
      columnMap[key] = index;
    });  

      return schoolFields.map(f => {

        const key = normalizeKey(f);

        let actualHeader = "";

        // 🔥 STEP 1: Exact match (fast)
        for (let h of headers) {
          if (normalizeKey(h) === key) {
            actualHeader = h;
            break;
          }
        }

        // 🔥 STEP 2: Smart match using autoMapField (IMPORTANT FIX)
        if (!actualHeader) {
          for (let h of headers) {
            const mapped = autoMapField(h);  // ✅ ORIGINAL header used

            if (mapped === key) {
              actualHeader = h;
              break;
            }
          }
        }

        // 🔥 STEP 3: Debug (optional but very useful)
        if (!actualHeader) {
          console.warn("❌ Missing mapping for:", key);
        }

        return actualHeader ? (student[actualHeader] || "") : "";
      });

    });
  

    // 🔥 STEP 4: Rebuild table
    buildTable();

    // 🔥 Apply green highlight + border
    setTimeout(() => {
      const rows = document.querySelectorAll("#tableBody tr");

      rows.forEach(row => {
        row.style.background = "#ccffcc";
        row.style.border = "2px solid green";
      });
    }, 100);

  } catch (err) {
    console.error("Bulk Upload Error:", err);
    alert("Upload failed");
  }
}

// SAMPLE
function downloadSample() {

  if (!schoolFields || schoolFields.length === 0) {
    alert("School fields not loaded");
    return;
  }

  const school = sessionStorage.getItem("school") || "School";
  const today = new Date().toISOString().split("T")[0];

  // ✅ Header row (dynamic)
  const sample = [schoolFields];

  // ✅ Example row
  const exampleRow = schoolFields.map(f => {
    const key = normalizeKey(f);

    if (key.includes("name")) return "John Doe";
    if (key.includes("class")) return "1";
    if (key.includes("section")) return "A";
    if (key.includes("phone")) return "9999999999";
    if (key.includes("dob")) return "01/01/2010";
    if (key.includes("address")) return "City";
    return "Sample";
  });

  sample.push(exampleRow);

  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sample");

  const fileName = `${school}_${today}_sample.xlsx`;

  XLSX.writeFile(wb, fileName);
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

  const school = sessionStorage.getItem("school") || "School";
  const today = new Date().toISOString().split("T")[0];

  // ✅ Headers (dynamic)
  const headers = schoolFields;

  // =========================
  // ✅ Split Data
  // =========================
  const validRows = [];
  const invalidRows = [];

  mappedData.forEach(r => {

    let row = {};

    schoolFields.forEach(f => {
      const key = normalizeKey(f);
      row[f] = r[key] || "";
    });

    if (r.valid && r.selected === true) {
      validRows.push(row);
    } else {
      invalidRows.push(row);
    }
  });

  // =========================
  // 📄 Build Sheet Data
  // =========================
  let sheetData = [];

  // 🔹 Title: Valid Students
  sheetData.push(["Valid Students"]);
  sheetData.push(headers);

  validRows.forEach(r => {
    sheetData.push(headers.map(h => r[h]));
  });

  // 🔹 Space
  sheetData.push([]);
  sheetData.push([]);

  // 🔹 Title: Invalid Students
  const invalidStartRow = sheetData.length;

  sheetData.push(["Invalid Students"]);
  sheetData.push(headers);

  invalidRows.forEach(r => {
    sheetData.push(headers.map(h => r[h]));
  });

  // =========================
  // 📦 Create Sheet
  // =========================
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // =========================
  // 🎨 Apply Yellow Style (Invalid Rows)
  // =========================
  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let R = invalidStartRow + 2; R <= range.e.r; ++R) {
    for (let C = 0; C <= range.e.c; ++C) {

      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });

      if (!ws[cellAddress]) continue;

      ws[cellAddress].s = {
        fill: {
          patternType: "solid",
          fgColor: { rgb: "FFFF00" }   // Yellow
        }
      };
    }
  }

  // =========================
  // 📦 Workbook
  // =========================
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Student_data");

  const fileName = `${school}_${today}_bulk_upload.xlsx`;

  XLSX.writeFile(wb, fileName);
}


function autoMapField(header) {
  // ignore columns that are likely serial numbers
  // if (
  //   ["sr_no", "serial_no", "s_no", "sno"].includes(normalizedHeader)
  // ) {
  //   return "";
  // }
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

    if (normalizedHeader.startsWith(key) || key.startsWith(normalizedHeader)) {
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

function formatDOB(value) {
  if (!value) return "";

  // 🔥 Case 1: Excel numeric date (VERY COMMON)
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return "";

    const day = String(date.d).padStart(2, "0");
    const month = String(date.m).padStart(2, "0");
    const year = date.y;

    return `${day}/${month}/${year}`;
  }

  let str = value.toString().trim();

  // 🔥 Case 2: ISO format (2021-12-06T18:30:00.000Z)
  if (str.includes("T")) {
    const d = new Date(str);

    if (isNaN(d)) return "";

    return `${String(d.getDate()).padStart(2, "0")}/${
      String(d.getMonth() + 1).padStart(2, "0")
    }/${d.getFullYear()}`;
  }

  // 🔥 Case 3: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  }

  // 🔥 Case 4: DD/MM/YYYY or DD-MM-YYYY
  str = str.replace(/-/g, "/");
  let parts = str.split("/");

  if (parts.length !== 3) return str;

  let [day, month, year] = parts;

  if (day.length === 1) day = "0" + day;
  if (month.length === 1) month = "0" + month;

  return `${day}/${month}/${year}`;
}