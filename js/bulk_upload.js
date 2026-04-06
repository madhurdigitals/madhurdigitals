let rawData = [];
let mappedData = [];
let headers = [];

const school = sessionStorage.getItem("school");

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
  const fields = ["name","class","section","roll","phone","address"];

  document.getElementById("mappingBox").innerHTML =
    headers.map((h, i) => `
      <div>
        ${h} →
        <select onchange="mapColumn(${i}, this.value)">
          <option value="">Ignore</option>
          ${fields.map(f => `<option value="${f}">${f}</option>`).join("")}
        </select>
      </div>
    `).join("");
}

// STORE MAPPING
let columnMap = {};

function mapColumn(index, field) {
  columnMap[index] = field;
  buildTable();
}

// BUILD TABLE
function buildTable() {

  mappedData = rawData.map(row => {

    let obj = {};

    Object.keys(columnMap).forEach(i => {
      const field = columnMap[i];
      if (field) obj[field] = row[i];
    });

    obj.valid = obj.name && obj.class;
    obj.selected = obj.valid;
    obj.status = "pending";

    return obj;
  });

  renderTable();
}

// RENDER TABLE
function renderTable() {

  document.getElementById("tableHead").innerHTML = `
    <tr>
      <th><input type="checkbox" onclick="selectAll(this)"></th>
      <th>Name</th><th>Class</th><th>Section</th>
      <th>Roll</th><th>Phone</th><th>Address</th>
    </tr>
  `;

  document.getElementById("tableBody").innerHTML =
    mappedData.map((r, i) => `
      <tr style="  background:    ${r.status === 'uploaded'      ? '#ccffcc'      : !r.valid      ? '#ffcccc'      : !r.selected      ? '#fff3cd'      : ''}
">
        <td><input type="checkbox" ${r.selected ? 'checked' : ''} onchange="toggleRow(${i}, this.checked)"></td>
        <td contenteditable="true" oninput="editCell(${i}, 'name', this.innerText)">${r.name || ''}</td>
        <td contenteditable="true" oninput="editCell(${i}, 'class', this.innerText)">${r.class || ''}</td>
        <td contenteditable="true" oninput="editCell(${i}, 'section', this.innerText)">${r.section || ''}</td>
        <td contenteditable="true" oninput="editCell(${i}, 'roll', this.innerText)">${r.roll || ''}</td>
        <td contenteditable="true" oninput="editCell(${i}, 'phone', this.innerText)">${r.phone || ''}</td>
        <td contenteditable="true" oninput="editCell(${i}, 'address', this.innerText)">${r.address || ''}</td>
      </tr>
    `).join("");
}

// EDIT
function editCell(i, field, value) {
  mappedData[i][field] = value;
  mappedData[i].valid = mappedData[i].name && mappedData[i].class;
  enableSubmit(); 
}

// SELECT
function toggleRow(i, checked) {
  mappedData[i].selected = checked;
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

  const validRows = mappedData.filter(r => r.valid && r.selected);

  if (validRows.length === 0) {
    alert("No valid rows selected");
    return;
  }

  const url = `${API_URL}?action=bulkUploadStudents&school=${school}&data=${encodeURIComponent(JSON.stringify(validRows))}`;

  const res = await fetch(url);
  const result = await res.json();

  // ✅ Mark uploaded rows
  mappedData.forEach(r => {
    if (r.valid && r.selected) {
      r.status = "uploaded";
    }
  });

  renderTable();

  // ✅ Disable button
  document.querySelector(".submit-btn").disabled = true;

  alert(`Uploaded: ${result.added}`);
}

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

function loadData() {
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

    renderMapping();
  };

  reader.readAsArrayBuffer(file);
}

function enableSubmit() {
  document.querySelector(".submit-btn").disabled = false;
}

function showLoadBtn() {
  document.getElementById("loadBtn").style.display = "inline-block";
}