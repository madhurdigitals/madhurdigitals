/* =============================================
   bulk_upload.js - Bulk Upload (🎓 Students | 👩‍🏫 Staff)
   - Column matching (auto-detect + aliases) as before
   - The server answers ROW BY ROW: each row's new ID, or why it was not saved
   - A batch receipt: pressing Submit again (double click, dropped connection) never saves a row twice
   ============================================= */
let rawData = [];
let mappedData = [];
let headers = [];
let schoolFields = [];
let columnMap = {};
let buType = "students";
let buSchoolRow = null;
let buSchoolsRaw = null;
let pendingBatch = null;          // { ref, rows: "1,2,5" } - re-used if the same rows are submitted again
let buBusy = false;
let dupTimer = null, dupSeq = 0;   // possible-duplicate check (runs on the server, only matches come back)

const school = sessionStorage.getItem("school");
const buEsc = v => String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function showToast(msg, type) {
  const t = document.getElementById("toast");
  if (!t) { return; }
  t.innerText = msg;
  t.className = "toast" + (type ? " toast-" + type : "");
  t.style.display = "block";
  clearTimeout(t._h);
  t._h = setTimeout(() => t.style.display = "none", 3500);
}

const FIELD_ALIASES = {
  name: ["name", "student_name", "student", "full_name", "staff_name", "employee_name"],
  father_s_name: ["father_name", "father", "father_s_name", "guardian_name", "Father's Name"],
  father_s_husband_s_name: ["father_name", "father", "father_s_name", "husband_name", "husband", "father_s_husband_s_name", "guardian_name"],
  class: ["class", "std", "standard", "grade"],
  section: ["section", "sec", "division"],
  dob: ["dob", "date_of_birth", "birth_date"],
  phone: ["phone", "mobile", "contact", "phone_number", "mobile_no", "mobile_number"],
  address: ["address", "addr", "location", "residence"],
  category: ["category", "type", "staff_type", "cat"],
  designation: ["designation", "post", "role", "position", "job_title"],
  employee_id: ["employee_id", "emp_id", "emp_no", "employee_no", "staff_no"],
  blood_group: ["blood_group", "blood", "bloodgroup"]
};

function normalizeKey(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
}

/* ── SETUP: which school, which tab, which fields ── */
async function setupPage() {
  if (!school) { alert("No school selected"); return; }
  if (!buSchoolsRaw) buSchoolsRaw = await getSchools();
  buSchoolRow = rtSchoolRow(buSchoolsRaw, school);
  if (!buSchoolRow) { alert("School config not found"); return; }
  buType = rtCurrentType(buSchoolRow);
  rtRenderTabs(document.querySelector(".heading-wrapper"), buSchoolRow, () => { resetPage(); setupPage(); });
  schoolFields = buType === "staff"
    ? ["Name", "Category", "Designation"].concat(rtStaffFields(buSchoolRow))
    : String(buSchoolRow.fields || "").split(",").map(f => f.trim()).filter(Boolean);
  const staff = buType === "staff";
  document.getElementById("buHeading").textContent = staff ? "📤 Bulk Upload Staff" : "📤 Bulk Upload Students";
  document.getElementById("buHint").innerHTML = staff
    ? "Columns: <b>" + schoolFields.map(buEsc).join(", ") + "</b>. Required: <b>Name</b> and <b>Designation</b>. <b>Category</b>: Staff or Management — left empty, it is saved as <b>Staff</b>."
    : "Columns: <b>" + schoolFields.map(buEsc).join(", ") + "</b>. Required: <b>Name</b> and <b>Class</b>.";
  document.querySelectorAll(".container > .card").forEach(c => { c.style.borderTop = staff ? "4px solid #059669" : ""; });
  const bar = document.getElementById("bulkSetBar");
  if (bar) bar.style.display = staff ? "flex" : "none";
}

function resetPage() {
  rawData = []; mappedData = []; headers = []; columnMap = {}; pendingBatch = null;
  document.getElementById("mappingBox").innerHTML = "";
  document.getElementById("tableHead").innerHTML = "";
  document.getElementById("tableBody").innerHTML = "";
  document.getElementById("buResult").style.display = "none";
  const f = document.getElementById("fileInput"); if (f) f.value = "";
  document.getElementById("loadBtn").style.display = "none";
}

document.addEventListener("DOMContentLoaded", setupPage);

function showLoadBtn() {
  if (document.getElementById("fileInput").files.length > 0) document.getElementById("loadBtn").style.display = "inline-block";
}

/* ── READ FILE ── */
async function loadData() {
  if (!schoolFields.length) await setupPage();
  const file = document.getElementById("fileInput").files[0];
  if (!file) { alert("Please select file first"); return; }
  const reader = new FileReader();
  reader.onload = function (evt) {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    loadRows(json);
  };
  reader.readAsArrayBuffer(file);
}

// rows[0] = the file's header row
function loadRows(json) {
  headers = (json[0] || []).map(h => String(h === undefined ? "" : h));
  rawData = json.slice(1).filter(r => r.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ""));
  mappedData = []; pendingBatch = null;
  document.getElementById("buResult").style.display = "none";
  renderMapping();
  showToast(`${rawData.length} row(s) read from the file`, "success");
}

/* ── COLUMN MATCHING ── */
function renderMapping() {
  const fields = schoolFields.map(f => ({ original: f, key: normalizeKey(f) }));
  columnMap = {};
  fields.forEach(f => {
    headers.forEach((h, i) => { if (autoMapField(h) === f.key && columnMap[f.key] === undefined) columnMap[f.key] = i; });
  });
  document.getElementById("mappingBox").innerHTML = `<b title="Which column of your file goes into which field">Match the columns of your file:</b>` +
    fields.map(f => `
      <div>${buEsc(f.original)} →
        <select onchange="mapColumn('${f.key}', this.value)" title="Column of your file for ${buEsc(f.original)}">
          <option value="">Ignore</option>
          ${headers.map((h, i) => `<option value="${i}" ${columnMap[f.key] === i ? "selected" : ""}>${buEsc(h)}</option>`).join("")}
        </select>
      </div>`).join("");
  buildTable();
}

function mapColumn(fieldKey, columnIndex) {
  if (columnIndex === "") delete columnMap[fieldKey];
  else {
    columnIndex = Number(columnIndex);
    for (const key in columnMap) if (columnMap[key] === columnIndex) delete columnMap[key];
    columnMap[fieldKey] = columnIndex;
  }
  buildTable();
}

function autoMapField(header) {
  const h = normalizeKey(header);
  for (const f of schoolFields) if (h === normalizeKey(f)) return normalizeKey(f);
  for (const fieldKey in FIELD_ALIASES) {
    if (FIELD_ALIASES[fieldKey].map(normalizeKey).includes(h) && schoolFields.some(f => normalizeKey(f) === fieldKey)) return fieldKey;
  }
  for (const f of schoolFields) {
    const key = normalizeKey(f);
    if (h && (h.startsWith(key) || key.startsWith(h))) return key;
  }
  return "";
}

/* ── ROWS ── */
function rowProblem(obj) {
  if (!String(obj.name || "").trim()) return "Name is empty";
  if (buType === "staff") {
    const c = String(obj.category || "").trim().toLowerCase();
    if (c && c !== "staff" && c !== "management") return "Category must be Staff or Management";
    if (!String(obj.designation || "").trim()) return "Designation is empty";
  } else if (schoolFields.some(f => normalizeKey(f) === "class") && !String(obj.class || "").trim()) {
    return "Class is empty";
  }
  return "";
}

function buildTable() {
  mappedData = rawData.map((row, i) => {
    const existing = mappedData[i] || {};
    const obj = {};
    schoolFields.forEach(f => {
      const key = normalizeKey(f);
      const colIndex = columnMap[key];
      let value = colIndex !== undefined ? row[colIndex] : "";
      if (key === "dob") value = formatDOB(value);
      obj[key] = value === undefined || value === null ? "" : value;
    });
    if (buType === "staff" && !String(obj.category || "").trim()) obj.category = "Staff";   // blank -> Staff
    if (existing.edited) schoolFields.forEach(f => { const k = normalizeKey(f); if (existing[k] !== undefined) obj[k] = existing[k]; });
    obj.problem = rowProblem(obj);
    obj.valid = !obj.problem;
    obj.selected = existing.selected !== undefined ? existing.selected === true : obj.valid;
    obj.status = existing.status || "pending";
    obj.newId = existing.newId || "";
    obj.error = existing.error || "";
    obj.edited = existing.edited || false;
    obj.dup = existing.dup || null;
    obj.allowDup = existing.allowDup || false;
    return obj;
  });
  renderTable();
  scheduleDupCheck();
}

/* ── POSSIBLE DUPLICATES ── */
function scheduleDupCheck() {
  clearTimeout(dupTimer);
  dupTimer = setTimeout(runDupCheck, 400);
}

async function runDupCheck() {
  const idx = mappedData.map((r, i) => i).filter(i => mappedData[i].status !== "uploaded" && String(mappedData[i].name || "").trim());
  if (!idx.length) return;
  const seq = ++dupSeq;
  let res = null;
  try { res = await postToApi({ action: "checkDuplicates", school: school, type: buType, rows: idx.map(buildPayloadRow) }); } catch (err) { res = null; }
  if (seq !== dupSeq || !res || !Array.isArray(res.results)) return;      // a newer check is running, or no answer
  const found = {};
  res.results.forEach(x => { found[idx[x.row]] = x; });
  idx.forEach(i => {
    const r = mappedData[i], f = found[i] || null;
    const was = r.dup ? (r.dup.id || "row" + r.dup.same_as_row) : "", now = f ? (f.id || "row" + idx[f.same_as_row]) : "";
    if (f && f.same_as_row !== undefined) f.same_as_row = idx[f.same_as_row];
    r.dup = f;
    if (f && was !== now && !r.allowDup) r.selected = false;               // a new warning: unticked until confirmed
    if (!f) r.allowDup = false;
  });
  renderTable();
  const n = Object.keys(found).length;
  if (n) showToast(`${n} row(s) look like people who already exist — review the ⚠ rows`, "error");
}

function viewDup(i) {
  const r = mappedData[i];
  if (!r || !r.dup || !r.dup.id) return;
  rtShowCompare({ school: school, type: buType, id: r.dup.id, reason: r.dup.reason, record: r.dup.record,
    entry: schoolFields.map(f => [f, r[normalizeKey(f)] === undefined ? "" : r[normalizeKey(f)]]),
    skipLabel: "Same person — skip this row", allowLabel: "Different person — upload anyway",
    onSkip: () => { r.selected = false; r.allowDup = false; renderTable(); },
    onAllow: () => { r.selected = true; r.allowDup = true; renderTable(); } });
}

function statusCell(r) {
  if (r.status === "uploaded") return `<span class="bu-status" style="color:#166534;" title="Saved">✓ ${buEsc(r.newId)}</span>`;
  if (r.status === "failed")   return `<span class="bu-status" style="color:#991b1b;" title="${buEsc(r.error)}">❌ ${buEsc(r.error)}</span>`;
  if (!r.valid)                return `<span class="bu-status" style="color:#b45309;" title="${buEsc(r.problem)}">⚠ ${buEsc(r.problem)}</span>`;
  if (r.dup) {
    const i = mappedData.indexOf(r);
    if (r.allowDup) return `<span class="bu-status" style="color:#92400e;" title="You confirmed this is a different person">✔ Different person — will be added</span>`;
    if (r.dup.id) return `<button type="button" class="bu-btn" style="padding:3px 10px; font-size:12px;" onclick="viewDup(${i})" title="Compare with the saved record and decide">👁 View</button>
      <div class="bu-status" style="color:#b45309; cursor:pointer; margin-top:3px;" onclick="viewDup(${i})" title="Click to compare">⚠ Possible duplicate of ${buEsc(r.dup.id)}<br><span style="font-weight:400;">${buEsc(r.dup.reason)}</span></div>`;
    return `<span class="bu-status" style="color:#b45309;" title="${buEsc(r.dup.reason)}">⚠ Same person as row ${r.dup.same_as_row + 1} of this file</span>`;
  }
  return "";
}

function renderTable() {
  document.getElementById("tableHead").innerHTML = `<tr>
      <th><input type="checkbox" onclick="selectAll(this)" title="Tick / untick every valid row"></th>
      <th>${buType === "staff" ? "Staff ID / result" : "Student ID / result"}</th>
      ${schoolFields.map(f => `<th>${buEsc(f)}</th>`).join("")}
    </tr>`;
  document.getElementById("tableBody").innerHTML = mappedData.map((r, i) => {
    const locked = r.status === "uploaded";
    const cells = schoolFields.map(f => {
      const key = normalizeKey(f);
      if (columnMap[key] === undefined) {
        if (buType === "staff" && key === "category") return r.status === "uploaded" ? `<td>${buEsc(r.category)}</td>` : `<td>${categoryCellHtml(i, r)}</td>`;
        return `<td style="color:#9ca3af;">Ignored</td>`;
      }
      if (!locked && buType === "staff" && key === "category") return `<td>${categoryCellHtml(i, r)}</td>`;
      if (!locked && buType === "staff" && key === "designation") return `<td>${designationCellHtml(i, r)}</td>`;
      return locked ? `<td>${buEsc(r[key])}</td>`
                    : `<td contenteditable="true" title="Click to correct" oninput="editCell(${i}, '${key}', this.innerText, this)">${buEsc(r[key])}</td>`;
    }).join("");
    return `<tr style="background:${getRowColor(r)}">
        <td><input type="checkbox" ${r.selected === true && !locked ? "checked" : ""} ${locked || !r.valid ? "disabled" : ""} onchange="toggleRow(${i}, this.checked)"></td>
        <td style="white-space:normal; max-width:none; min-width:200px; overflow:visible; text-align:left;">${statusCell(r)}</td>${cells}</tr>`;
  }).join("");
}

function editCell(i, field, value, el) {
  const r = mappedData[i];
  r[field] = value; r.edited = true;
  r.problem = rowProblem(r); r.valid = !r.problem;
  if (r.status === "failed") { r.status = "pending"; r.error = ""; }
  const row = el.parentElement;
  row.style.background = getRowColor(r);
  row.style.outline = "2px solid #007bff";
  row.children[1].innerHTML = statusCell(r);
  const cb = row.querySelector("input[type=checkbox]");
  if (cb) { cb.disabled = !r.valid; if (r.valid && !r.dup && !r.selected) { r.selected = true; cb.checked = true; } }
  scheduleDupCheck();
}

function toggleRow(i, checked) {
  const r = mappedData[i];
  r.selected = checked;
  if (r.dup) r.allowDup = checked;          // ticking a ⚠ row = "different person, add anyway"
  renderTable();
}

/* ── Category / Designation dropdowns (staff) ── */
function categoryCellHtml(i, r) {
  const v = String(r.category || "").trim().toLowerCase();
  const ok = v === "staff" || v === "management";
  return `<select onchange="setCell(${i}, 'category', this.value)" title="Staff or Management"
            style="padding:4px; border-radius:6px; ${ok ? "" : "border:2px solid #dc2626;"}">
      ${ok ? "" : (v ? `<option value="${buEsc(r.category)}" selected>${buEsc(r.category)} — not valid</option>`
                     : `<option value="" selected>Choose…</option>`)}
      <option value="Staff" ${v === "staff" ? "selected" : ""}>Staff</option>
      <option value="Management" ${v === "management" ? "selected" : ""}>Management</option>
    </select>`;
}

function designationCellHtml(i, r) {
  // Your config list. A designation from the file that is not in the list is kept (marked "from file")
  // and saved as written; it can be changed later in Manage Records.
  const list = (typeof CONFIG !== "undefined" && CONFIG.designations) ? CONFIG.designations : [];
  const v = String(r.designation || "").trim();
  const known = list.find(d => d.toLowerCase() === v.toLowerCase());
  return `<select onchange="setCell(${i}, 'designation', this.value)" title="Designation printed on the card" style="padding:4px; border-radius:6px; ${v ? "" : "border:2px solid #dc2626;"}">
      ${v ? "" : `<option value="" selected>Choose…</option>`}
      ${list.map(d => `<option value="${buEsc(d)}" ${known === d ? "selected" : ""}>${buEsc(d)}</option>`).join("")}
      ${v && !known ? `<option value="${buEsc(v)}" selected>${buEsc(v)} (from file)</option>` : ""}
    </select>`;
}

// keepFocus: update the row without redrawing the table
function setCell(i, key, value, keepFocus) {
  const r = mappedData[i];
  r[key] = value; r.edited = true;
  r.problem = rowProblem(r); r.valid = !r.problem;
  if (r.status === "failed") { r.status = "pending"; r.error = ""; }
  if (r.valid && !r.dup && !r.selected) r.selected = true;
  if (keepFocus) {
    const tr = document.querySelectorAll("#tableBody tr")[i];
    if (tr) { tr.style.background = getRowColor(r); tr.children[1].innerHTML = statusCell(r);
              const cb = tr.querySelector("input[type=checkbox]"); if (cb) { cb.disabled = !r.valid; cb.checked = r.selected; } }
  } else renderTable();
  scheduleDupCheck();
}

function applyCategoryToTicked() {
  const v = document.getElementById("bulkCategory").value;
  let n = 0;
  mappedData.forEach(r => { if (r.selected && r.status !== "uploaded") { r.category = v; r.edited = true; r.problem = rowProblem(r); r.valid = !r.problem; n++; } });
  renderTable(); scheduleDupCheck();
  showToast(n ? `Category set to ${v} for ${n} row(s)` : "Tick the rows first", n ? "success" : "error");
}
function selectAll(el) { mappedData.forEach(r => { if (r.valid && r.status !== "uploaded") r.selected = el.checked; }); renderTable(); }

function getRowColor(r) {
  if (r.status === "uploaded") return "#ccffcc";
  if (r.status === "failed")   return "#fee2e2";
  if (!r.valid)                return "#ffcccc";
  if (r.edited)                return "#e6f0ff";
  if (!r.selected)             return "#fff3cd";
  return "";
}

function validateMapping() {
  // staff: Category may be left out of the file - everyone is then saved as Staff
  const required = buType === "staff" ? ["name", "designation"] : ["name", "class"].filter(k => schoolFields.some(f => normalizeKey(f) === k));
  for (const r of required) {
    if (columnMap[r] === undefined) { alert(`Please match a column for "${schoolFields.find(f => normalizeKey(f) === r) || r}"`); return false; }
  }
  return true;
}

/* ── SUBMIT: the server answers row by row; the receipt prevents saving twice ── */
async function submitData() {
  if (buBusy) return;
  if (!mappedData.length) { alert("Load a file first"); return; }
  if (!validateMapping()) return;
  const rowsIdx = mappedData.map((r, i) => i).filter(i => mappedData[i].valid && mappedData[i].selected === true && mappedData[i].status !== "uploaded");
  if (!rowsIdx.length) { alert("No valid rows selected (rows already saved are skipped)"); return; }
  if (rowsIdx.length > 2000) { alert("Too many rows in one upload (max 2000). Please split the file."); return; }

  const key = rowsIdx.join(",");
  if (!pendingBatch || pendingBatch.rows !== key) pendingBatch = { ref: makeBatchRef(), rows: key };

  const payload = rowsIdx.map(i => {
    const obj = buildPayloadRow(i);
    if (mappedData[i].allowDup) obj._allow_duplicate = "1";    // confirmed: a different person
    return obj;
  });

  const btn = document.getElementById("submitBtn");
  buBusy = true; btn.disabled = true; btn.innerText = `⏳ Uploading ${rowsIdx.length} row(s)…`;
  let res = null;
  try {
    res = await postToApi({ action: buType === "staff" ? "bulkUploadStaff" : "bulkUploadStudents", school: school,
                            data: payload, batch_ref: pendingBatch.ref, added_by: sessionStorage.getItem("username") || "unknown" });
  } catch (err) { res = null; }
  buBusy = false; btn.disabled = false; btn.innerText = "Submit Selected";

  const box = document.getElementById("buResult");
  if (!res || res.error || !Array.isArray(res.results)) {
    box.className = "bu-result bad";
    box.innerHTML = res && res.error
      ? `❌ Not uploaded: ${buEsc(res.error)}`
      : `❌ No answer from the server. Nothing is marked as uploaded yet. Press <b>Submit Selected</b> again — rows that were already saved are never saved twice.`;
    box.style.display = "block";
    showToast(res && res.error ? "Not uploaded: " + res.error : "No answer from the server — press Submit again", "error");
    return;
  }
  let ok = 0, bad = 0;
  res.results.forEach((r, j) => {
    const row = mappedData[rowsIdx[j]];
    if (!row || !r) return;
    if (r.id) { row.status = "uploaded"; row.newId = String(r.id); row.error = ""; row.selected = false; ok++; }
    else { row.status = "failed"; row.error = r.error || "not saved"; bad++; }
  });
  pendingBatch = null;
  renderTable();
  box.className = "bu-result " + (bad ? "bad" : "ok");
  box.innerHTML = `✓ Uploaded: <b>${ok}</b>` + (bad ? ` · ❌ Not uploaded: <b>${bad}</b> — see the red rows, correct them and press Submit again.` : "")
    + (res.already_saved ? `<br><small>These rows had already been saved — nothing was added twice.</small>` : "");
  box.style.display = "block";
  showToast(`Uploaded: ${ok}` + (bad ? ` · Not uploaded: ${bad}` : ""), bad ? "error" : "success");
}

function buildPayloadRow(i) {
  const r = mappedData[i], obj = {};
  schoolFields.forEach(f => {
    const k = normalizeKey(f);
    if (columnMap[k] === undefined && !(buType === "staff" && k === "category")) return;
    let v = r[k] === undefined || r[k] === null ? "" : String(r[k]);
    if (k.includes("phone") || k.includes("mobile") || k.includes("contact")) v = v.replace(/\n/g, "").trim();
    if (k.includes("address")) v = v.replace(/\n/g, " ").trim();
    obj[k] = v.trim();
  });
  return obj;
}

function makeBatchRef() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}

/* ── SAMPLE + DOWNLOAD ── */
function downloadSample() {
  if (!schoolFields.length) { alert("School fields not loaded"); return; }
  const today = new Date().toISOString().split("T")[0];
  // Realistic examples (never "Sample": placeholder words in ID columns look like the same person to the
  // duplicate check). Columns without an obvious example stay empty.
  const staff = buType === "staff";
  const example = schoolFields.map(f => {
    const key = normalizeKey(f);
    if (key === "category") return "Staff";
    if (key === "designation") return "Teacher";
    if (key === "name") return staff ? "Ramesh Kumar" : "Aarav Sharma";
    if (key.includes("father") || key.includes("husband")) return staff ? "Suresh Kumar" : "Rajesh Sharma";
    if (key.includes("mother")) return "Sunita Sharma";
    if (key === "class") return "5";
    if (key === "section") return "A";
    if (key.includes("phone") || key.includes("mobile") || key.includes("contact")) return "9876543210";
    if (key === "dob" || key.includes("birth")) return staff ? "12/03/1985" : "15/08/2014";
    if (key.includes("address")) return "12, Main Road, City";
    if (key.includes("blood")) return "B+";
    if (key.includes("employee") || key === "emp_id") return "EMP001";
    if (key.includes("roll")) return "1";
    if (key.includes("admission")) return "ADM001";
    return "";
  });
  const ws = XLSX.utils.aoa_to_sheet([schoolFields, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sample");
  XLSX.writeFile(wb, `${school}_${buType}_${today}_sample.xlsx`);
}

function downloadExcel() {
  if (!mappedData.length) { alert("No data to download"); return; }
  const today = new Date().toISOString().split("T")[0];
  const head = [buType === "staff" ? "Staff ID" : "Student ID", "Result"].concat(schoolFields);
  const rows = mappedData.map(r => [r.newId || "",
    r.status === "uploaded" ? "Uploaded" : r.status === "failed" ? "Not uploaded: " + r.error : (!r.valid ? r.problem : (r.selected ? "Not submitted yet" : "Not selected"))]
    .concat(schoolFields.map(f => r[normalizeKey(f)] || "")));
  const ws = XLSX.utils.aoa_to_sheet([head].concat(rows));
  ws["!cols"] = head.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, buType === "staff" ? "Staff" : "Students");
  XLSX.writeFile(wb, `${school}_${buType}_${today}_bulk_upload.xlsx`);
}

function formatDOB(value) {
  if (!value) return "";
  if (typeof value === "number" && typeof XLSX !== "undefined") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return "";
    return `${String(date.d).padStart(2, "0")}/${String(date.m).padStart(2, "0")}/${date.y}`;
  }
  let str = value.toString().trim();
  if (str.includes("T")) {
    const d = new Date(str);
    if (isNaN(d)) return "";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) { const [y, m, d] = str.split("-"); return `${d}/${m}/${y}`; }
  str = str.replace(/-/g, "/");
  const parts = str.split("/");
  if (parts.length !== 3) return str;
  let [day, month, year] = parts;
  if (day.length === 1) day = "0" + day;
  if (month.length === 1) month = "0" + month;
  return `${day}/${month}/${year}`;
}
