/* =============================================
   manage_student.js
   - Original edit/delete logic preserved exactly
   - Date filter added
   - Stats + skeleton added
   - 📸 Photo column + upload/replace added
   ============================================= */

let school      = sessionStorage.getItem("school");
let school_name = sessionStorage.getItem("school_name");

const displayName = school_name || school;
document.getElementById("schoolName").innerText    = displayName;
document.getElementById("schoolNameTop").innerText = displayName;

let students        = [];
let currentPage     = 1;
let rowsPerPage     = 50;
let headersGlobal   = [];
let filteredData    = [];
let selectedFilters = [];
let currentEditPhotoLink = "";   // 📸 tracks the current student's photo public_id during edit

/* ── 🎓 Students | 👩‍🏫 Staff (staff S2) ── */
let recordType = "students";     // what this page shows right now
let idKey      = "Student_ID";   // "Staff_ID" on the Staff tab
const STATUS_KEYS = ["status", "deleted_at", "deleted_by", "restored_at", "restored_by", "student_status", "status_session", "joined_session"];
// SE3a: which students this page lists - "in" (in school), "left" or "passed_out" (current session, students only)
let msShow = "in";

/* ── P2b state: kept for this browser tab until the filters are removed or the school changes ── */
const MD_REC_KEY = "mdRecFilters";      // sessionStorage: filters, page, list
const MD_REC_VIEW_KEY = "mdRecView";    // localStorage: Table or Cards, remembered per device
function msNarrow() { return (window.innerWidth || 1024) < 700; }
function msViewKey() { return MD_REC_VIEW_KEY + (msNarrow() ? ":phone" : ""); }   // P2b.6: phone and laptop remember their own choice
let msMissing  = [];                    // ticked Missing / Needs fixing items, oldest tick first
let msColourOf = {};                    // item -> colour number, kept while it stays ticked
let msRules    = [{ field: "", text: "" }];   // "Any field contains" (up to 3, all must match)
let msPanelId  = null;                  // the student open in the panel
let msPanelBack = null;                 // P2b.5: the student in the list to go back to after "Go to ID" left it
let msFlashId  = null;                  // the row that was just saved (green for a moment)
let msStateUsed = false;                // the saved filters are read once, when the page opens
let msSort = null;                      // P2b.3: { key, dir } from a clicked heading (null = class → name)
let msSelecting = false;                // P2b.4: Select mode (tick boxes shown)
let msSel = new Set();                  // P2b.4: ticked IDs (kept across pages)
let msDupCache = null;                  // P2b.4: id -> [ids of possible duplicates]
let msDensity = (function () { try { return localStorage.getItem("mdRecDensity") === "compact" ? "compact" : "normal"; } catch (e) { return "normal"; } })();
let msView = (function () {
  try { const v = localStorage.getItem(msViewKey()); if (v === "table" || v === "cards") return v; } catch (e) { /* storage off */ }
  return (window.innerWidth || 1024) < 700 ? "cards" : "table";
})();

function msSetText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

// Always clear which data is on screen: heading, labels, colours follow the tab
function applyManageLabels(row) {
  const staff = recordType === "staff";
  const heading = document.querySelector(".heading-wrapper");
  if (heading && typeof rtRenderTabs === "function") rtRenderTabs(heading, row, () => { resetFiltersQuietly(); loadStudents(); });
  msSetText("recordHeadingLabel", staff ? "👩‍🏫 Manage Staff" : "🎓 Manage Students");
  msSetText("statTotalLbl", staff ? "Total staff" : "Total students");
  msSetText("lblName", "Search");
  const sBox = document.getElementById("searchName");
  if (sBox) sBox.placeholder = staff ? "Search name or staff ID" : "Search name or student ID";   // P2b: one box for name or ID
  msSetText("lblId", staff ? "Staff ID" : "Student ID");
  msSetText("lblGroup", staff ? "Category" : "Class — Section");
  msSetText("groupBtn", staff ? "Select Category ▾" : "Select Class-Section ▾");
  const idBox = document.getElementById("searchStudentId");
  if (idBox) idBox.placeholder = staff ? "e.g. S-60001" : "Enter ID...";
  const tc = document.querySelector(".table-card");
  if (tc) tc.style.borderTop = staff ? "4px solid #059669" : "";
}

function resetFiltersQuietly() {
  ["searchName", "searchStudentId", "filterAddedBy", "dateFrom", "dateTo"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  selectedFilters = [];
  msMissing = []; msColourOf = {}; msRules = [{ field: "", text: "" }];   // P2b
  msSort = null;                                                          // P2b.3
  try { sessionStorage.removeItem(MD_REC_KEY); } catch (e) { /* storage off */ }
  renderChips();
}

function normalizeKey(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
}

/* ── TOAST ── */
function showToast(msg, type) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText   = msg;
  t.className   = "toast" + (type ? " toast-" + type : "");
  t.style.display = "block";
  setTimeout(() => t.style.display = "none", 2800);
}

/* ── PARSE TIMESTAMP ──
   Format in sheet: "12/5/2026 14:22"  (DD/M/YYYY)
   Returns Date object or null
*/
function parseTimestamp(ts) {
  if (!ts) return null;
  try {
    const str      = String(ts).trim();
    const datePart = str.split(" ")[0];       // "12/5/2026"
    const parts    = datePart.split("/");     // ["12","5","2026"]
    if (parts.length !== 3) return null;
    const day   = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const year  = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

/* ── LOAD STUDENTS ── */
async function loadStudents(quiet) {
  if (quiet !== true) showSkeleton(true);   // P2b: a quiet reload (after a save) keeps the list on screen

  if (typeof schoolsData === "undefined" || !schoolsData || !schoolsData.length) schoolsData = await getSchools();
  const msRow = rtSchoolRow(schoolsData, school);
  recordType = rtCurrentType(msRow);
  idKey = recordType === "staff" ? "Staff_ID" : "Student_ID";
  applyManageLabels(msRow);

  if (window.mdSession) await window.mdSession.ready;
  if (!msStateUsed) {                                                  // P2b: back on the page: the same list as before
    const st = msReadState();
    if (st && ["in", "left", "passed_out"].includes(st.show)) msShow = st.show;
    if (st && st.show === "deleted" && msCanRestore()) msShow = "deleted";
  }
  if (recordType === "staff" || msPastSession()) msShow = "in";       // the Left / Passed out lists: students, current session
  msSetupShowFilter();

  // SE3c: staff come with the session they joined in (shown as a tag, never a column)
  const raw = recordType === "staff" ? await apiGet({ action: "getStaff", school, with_joined: "1" })
            : msShow === "deleted" ? msDeletedAsRows(await getDeletedStudentsRaw())          // P2b.4
            : msShow !== "in" ? await apiGet({ action: "getStudents", school, status: msShow })
            : await getStudents(school);

  showSkeleton(false);

  if (!Array.isArray(raw)) {
    students = []; filteredData = []; headersGlobal = [];
    renderSmartTable(); renderPagination();
    showToast((raw && raw.error) || "Could not load", "error");
    return;
  }
  if (!raw || raw.length === 0) return;
  msDupCache = null;                                                   // P2b.4: duplicates are worked out again

  const headers = raw[0];

  headersGlobal = headers.filter(h => {
    const key = h.toLowerCase();
    return key !== "timestamp" &&
           key !== "added_via" &&
           key !== "updated_by" &&
           !STATUS_KEYS.includes(key);
  });

  students = raw.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  filteredData = [...students];
  currentPage  = 1;

  populateClassSectionDropdown();
  populateAddedByDropdown();
  msBuildMore();                 // P2b: Missing / Needs fixing / Any field lists for this school
  msRestoreState();              // P2b: filters stay until they are removed or the school changes
  applyFilter(true);
}

loadStudents();

/* ── SE3a: 🚪 Left / ↩ Re-admit ── */
function msActiveSession() { return (window.mdSession && window.mdSession.active()) || "this session"; }
const msEsc = v => String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// "Show: In school / Left / Passed out" - students, current session only
function msSetupShowFilter() {
  const grid = document.querySelector(".filter-grid");
  if (!grid) return;
  let col = document.getElementById("msShowCol");
  if (!col) {
    col = document.createElement("div");
    col.className = "filter-col";
    col.id = "msShowCol";
    col.innerHTML = `<label class="filter-label">Show</label>
      <select id="msShowSelect" class="filter-input" title="Students in school, or those who left / passed out">
        <option value="in">🎓 In school</option>
        <option value="left">🚪 Left</option>
        <option value="passed_out">🎓 Passed out</option>
        ${msCanRestore() ? `<option value="deleted">🗑 Deleted</option>` : ""}
      </select>`;
    grid.insertBefore(col, grid.firstChild);
    col.querySelector("select").onchange = e => { msShow = e.target.value; resetFiltersQuietly(); msSelectDone(); loadStudents(); };
  }
  col.style.display = (recordType === "staff" || msPastSession()) ? "none" : "";
  col.querySelector("select").value = msShow;
}

function msJoinedBadge(s) {
  const j = String(s.Joined_Session || "").trim();
  return j ? `<span class="ms-joined" style="display:inline-block; margin:0 6px 4px 0; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; background:#ecfdf5; color:#047857;"
    title="The session this staff member was added in">Joined ${msEsc(j)}</span>` : "";
}

function msStatusBadge(s, past) {
  const st = String(s.Student_Status || "").trim(), ssn = String(s.Status_Session || "").trim();
  if (!st) return "";
  const text = past ? `🚪 Left during ${window.mdSession.current()}`
             : (st === "Left" ? "🚪 Left" : "🎓 " + st) + (ssn ? " in " + ssn : "");
  return `<span class="ms-status" style="display:inline-block; margin:0 6px 4px 0; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700;
    background:${st === "Left" ? "#fff7ed" : "#eef2ff"}; color:${st === "Left" ? "#9a3412" : "#3730a3"};">${msEsc(text)}</span>`;
}

async function msMarkLeft(id, btn) {
  if (msPastBlocked()) return;
  const who = students.find(s => String(s[idKey]) === String(id));
  const name = who && who.Name ? ` (${who.Name})` : "";
  if (!confirm(`Mark student ${id}${name} as Left?\n\nThey leave every list, print and export of ${msActiveSession()}. ` +
               `Nothing is deleted: they stay in ${msActiveSession()}'s history, and ↩ Re-admit brings them back with the same ID.`)) return;
  if (btn) { btn.disabled = true; btn.innerText = "⏳"; }
  let res = null;
  try { res = await postToApi({ action: "markStudentLeft", school, student_id: String(id) }); } catch (err) { res = null; }
  if (!res || res.status !== "left") {
    if (btn) { btn.disabled = false; btn.innerText = "🚪 Left"; }
    showToast("NOT marked: " + ((res && (res.error || res.auth_error)) || "no answer from the server"), "error");
    return;
  }
  students = students.filter(s => String(s[idKey]) !== String(id));
  filteredData = filteredData.filter(s => String(s[idKey]) !== String(id));
  renderSmartTable(); renderPagination(); updateStats();
  showToast(`${id}${name} marked Left in ${res.session}`, "success");
}

function msOpenReadmit(id) {
  if (msPastBlocked()) return;
  const s = students.find(x => String(x[idKey]) === String(id));
  if (!s) return;
  const classes = (typeof CONFIG !== "undefined" && Array.isArray(CONFIG.classes)) ? CONFIG.classes.map(String) : [];
  const oldClass = String(s.Class === undefined || s.Class === null ? "" : s.Class);
  const oldSection = String(s.Section === undefined || s.Section === null ? "" : s.Section);
  const opts = classes.includes(oldClass) ? classes : (oldClass ? [oldClass].concat(classes) : classes);
  const hasSection = headersGlobal.some(h => String(h).toLowerCase() === "section");
  const box = document.getElementById("editPopup");
  box.innerHTML = `
    <div class="school-header"><h3>↩ Re-admit ${msEsc(id)}</h3><span class="close-btn" onclick="closeEdit()">✖</span></div>
    <p style="margin:10px 0; font-size:14px;"><b>${msEsc(s.Name || "")}</b> — ${msEsc(s.Student_Status || "")}${s.Status_Session ? " in " + msEsc(s.Status_Session) : ""},
      last class <b>${msEsc(oldClass || "—")}${oldSection ? "-" + msEsc(oldSection) : ""}</b>.</p>
    <p style="margin:0 0 10px; font-size:13px; color:#92400e;">Choose the class they join now in <b>${msEsc(msActiveSession())}</b> — the saved one may be from an earlier year.</p>
    <label class="filter-label">Class</label>
    <select id="msReadmitClass" class="filter-input">
      <option value="">— choose —</option>
      ${opts.map(c => `<option value="${msEsc(c)}">${msEsc(c)}${c === oldClass ? " (last class)" : ""}</option>`).join("")}
    </select>
    ${hasSection ? `<label class="filter-label" style="margin-top:8px; display:block;">Section</label>
    <input id="msReadmitSection" class="filter-input" value="${msEsc(oldSection)}">` : ""}
    <div class="btn-group" style="margin-top:14px;">
      <button class="submit-btn" id="msReadmitSave" onclick="msSaveReadmit('${msEsc(id)}')">↩ Re-admit</button>
      <button class="clear-btn" onclick="closeEdit()">Cancel</button>
    </div>`;
  box.style.display = "block";
}

async function msSaveReadmit(id) {
  const cls = (document.getElementById("msReadmitClass").value || "").trim();
  const secEl = document.getElementById("msReadmitSection");
  const sec = secEl ? secEl.value.trim() : "";
  if (!cls) { showToast("Choose the class first", "error"); return; }
  const btn = document.getElementById("msReadmitSave");
  btn.disabled = true; btn.innerText = "⏳ Saving…";
  let res = null;
  try { res = await postToApi({ action: "readmitStudent", school, student_id: String(id), class: cls, section: sec }); } catch (err) { res = null; }
  if (!res || res.status !== "readmitted") {
    btn.disabled = false; btn.innerText = "↩ Re-admit";
    showToast("NOT re-admitted: " + ((res && (res.error || res.auth_error)) || "no answer from the server"), "error");
    return;
  }
  closeEdit();
  students = students.filter(s => String(s[idKey]) !== String(id));
  filteredData = filteredData.filter(s => String(s[idKey]) !== String(id));
  renderSmartTable(); renderPagination(); updateStats();
  showToast(`${id} re-admitted in ${res.session}, class ${res.class}${res.section ? "-" + res.section : ""}`, "success");
}

/* ── SKELETON ── */
function showSkeleton(show) {
  const sk = document.getElementById("skeletonRows");
  const tb = document.getElementById("tableWrapper");
  if (!sk || !tb) return;
  sk.style.display = show ? "block" : "none";
  tb.style.display = show ? "none"  : "block";
}

/* ── STATS ── */
function updateStats() {
  const totalEl    = document.getElementById("statTotal");
  const filteredEl = document.getElementById("statFiltered");
  const activeEl   = document.getElementById("statActive");
  const activeWrap = document.getElementById("statActiveWrap");

  if (totalEl)    totalEl.innerText    = students.length.toLocaleString();
  if (filteredEl) filteredEl.innerText = filteredData.length.toLocaleString();

  const activeCount = countActiveFilters();
  if (activeWrap) activeWrap.style.display = activeCount > 0 ? "flex" : "none";
  if (activeEl)   activeEl.innerText        = activeCount;
  msUpdateTotals();              // P2b: "Showing 1–50 of 86 · 1,149 in school"
}

function countActiveFilters() {
  let n = 0;
  if ((document.getElementById("searchName")?.value || "").trim())      n++;
  if ((document.getElementById("searchStudentId")?.value || "").trim()) n++;
  if ((document.getElementById("filterAddedBy")?.value || ""))          n++;
  if ((document.getElementById("dateFrom")?.value || ""))               n++;
  if ((document.getElementById("dateTo")?.value || ""))                 n++;
  if (selectedFilters.length > 0)                                       n++;
  n += msMissing.length + msActiveRules().length;                       // P2b
  return n;
}

/* ── RENDER TABLE (photo column added) ── */
/* ── SE2.1: an earlier session is view only (students; staff are not kept per session) ── */
function msPastSession() {
  return recordType !== "staff" && !!window.mdSession && !!window.mdSession.current() && !window.mdSession.isActive();
}
function msPastBlocked() {
  if (!msPastSession()) return false;
  showToast(`${window.mdSession.current()} is an earlier session — view only. Switch to ${window.mdSession.active()} to edit.`, "error");
  return true;
}

function renderTable(data, headers) {
  // P2b: Photo + Name first (pinned when the table scrolls sideways), then the ID, then the school's fields.
  // Every value is escaped; missing / wrong values are coloured when those filters are on.
  const visibleHeaders = msTableHeaders(headers);
  const thead = document.getElementById("tableHead");
  const tbody = document.getElementById("studentTable");
  const cards = document.getElementById("mdRecCards");
  const wrap  = document.getElementById("mdRecTableWrap");
  const empty = document.getElementById("mdRecEmpty");
  const asCards = msView === "cards";

  if (wrap)  wrap.hidden  = asCards || data.length === 0;
  if (cards) cards.hidden = !asCards || data.length === 0;
  if (empty) {
    empty.hidden = data.length !== 0;
    const idq = msIdQuery((document.getElementById("searchName")?.value || "").trim().toLowerCase());
    if (idq && data.length === 0) { empty.innerHTML = msIdNotFound(idq); }
    else empty.innerHTML = students.length === 0 ? `No ${recordType === "staff" ? "staff" : "students"} in this list yet.`
      : `No ${recordType === "staff" ? "staff" : "students"} match these filters. <button type="button" class="md-rec__link" onclick="clearAllFilters()">Clear all filters</button>`;
  }

  thead.innerHTML = `<tr><th class="md-rec__pin1">Photo</th>${visibleHeaders.map(h => msHeadCell(h)).join("")}<th>Action</th></tr>`;

  if (asCards) {
    tbody.innerHTML = "";
    if (cards) cards.innerHTML = data.map(s => msCardHtml(s, visibleHeaders)).join("");
    return;
  }
  if (cards) cards.innerHTML = "";
  tbody.innerHTML = data.map(s => {
    const marks = msMarks(s);
    const id = String(s[idKey]);
    const cls = [String(msPanelId) === id ? "is-current" : "", msFlashId === id ? "is-saved" : "", msSel.has(id) ? "is-selected" : ""].join(" ").trim();
    return `<tr data-id="${msEsc(id)}"${cls ? ` class="${cls}"` : ""}>
        <td class="md-rec__pin1 ${marks.Photo_Link ? "md-rec-p" + marks.Photo_Link.c : ""}">${msSelBox(s)}${msThumb(s, msDensity === "compact" ? 24 : 30, marks.Photo_Link)}</td>
        ${visibleHeaders.map(h => msCellHtml(s, h, marks[h])).join("")}
        <td class="md-rec__act">${msActionsHtml(s)}</td>
      </tr>`;
  }).join("");
}

/* ── APPLY FILTER ── */
function applyFilter(keepPage) {
  msDupCache = null;                                                          // P2b.4: values may have changed
  const q         = (document.getElementById("searchName").value || "").trim().toLowerCase();   // P2b: name OR ID
  const studentId = (document.getElementById("searchStudentId")?.value || "").trim();
  const addedBy   = (document.getElementById("filterAddedBy")?.value || "").trim().toLowerCase();
  const dateFrom  = document.getElementById("dateFrom")?.value  || "";
  const dateTo    = document.getElementById("dateTo")?.value    || "";
  const rules     = msActiveRules();

  const fromDate = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
  const toDate   = dateTo   ? new Date(dateTo   + "T23:59:59") : null;

  const idq = msIdQuery(q);                                                   // P2b.4: digits = an ID
  document.body.classList.toggle("md-rec--idsearch", !!idq);
  if (idq) {
    filteredData = students.filter(s => msIdMatch(s, idq)).sort(msBaseCompare);
    const pages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
    currentPage = keepPage === true ? Math.min(Math.max(1, currentPage), pages) : 1;
    renderChips(); renderSmartTable(); renderPagination(); updateStats(); msSaveState();
    if (msPanelId) msRenderPanel();
    return;
  }

  filteredData = students.filter(s => {
    const key = msGroupKey(s);

    if (q && !String(s.Name || "").toLowerCase().includes(q) && !String(s[idKey] || "").toLowerCase().includes(q)) return false;
    if (studentId && !String(s[idKey] || "").toLowerCase().includes(studentId.toLowerCase())) return false;
    if (addedBy   && !(s.Added_By || "").toLowerCase().includes(addedBy))      return false;
    if (selectedFilters.length > 0 && !selectedFilters.includes(key))         return false;
    for (const r of rules) if (!String(s[r.field] === undefined || s[r.field] === null ? "" : s[r.field]).toLowerCase().includes(r.text.toLowerCase())) return false;
    if (msMissing.length && !msProblemsOf(s).length) return false;           // P2b: missing ANY ticked item

    // Date filter
    if (fromDate || toDate) {
      const d = parseTimestamp(s.Timestamp || s.timestamp || "");
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
    }

    return true;
  });
  msSortRows(filteredData);                                                    // P2b: class → name; ticked problems on top
  if (msSort) msSortBy(filteredData);                                          // P2b.3: a clicked heading wins

  const pages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  currentPage = keepPage === true ? Math.min(Math.max(1, currentPage), pages) : 1;
  renderChips();
  renderSmartTable();
  renderPagination();
  updateStats();
  msSaveState();
  if (msPanelId) msRenderPanel();
}

document.getElementById("searchName").addEventListener("input", applyFilter);

/* ── CLEAR ALL FILTERS ── */
function clearAllFilters() {
  document.getElementById("searchName").value = "";
  if (document.getElementById("searchStudentId")) document.getElementById("searchStudentId").value = "";
  if (document.getElementById("filterAddedBy"))   document.getElementById("filterAddedBy").value   = "";
  if (document.getElementById("dateFrom"))        document.getElementById("dateFrom").value         = "";
  if (document.getElementById("dateTo"))          document.getElementById("dateTo").value           = "";

  selectedFilters = [];
  document.querySelectorAll("#classSectionDropdown input").forEach(cb => cb.checked = false);
  msMissing = []; msColourOf = {}; msRules = [{ field: "", text: "" }];      // P2b: everything, in one click
  msSort = null;                                                              // P2b.3: back to class → name
  msRenderMoreState();
  renderChips();
  applyFilter();
}

/* ── SMART TABLE ── */
function renderSmartTable() {
  const data = filteredData;
  if (data.length <= rowsPerPage) {
    renderTable(data, headersGlobal);
    document.getElementById("pagination").innerHTML = "";
  } else {
    const start    = (currentPage - 1) * rowsPerPage;
    const pageData = data.slice(start, start + rowsPerPage);
    renderTable(pageData, headersGlobal);
  }
  updateStats();
  if (msPanelId) msRenderPanel();   // P2b.1: the panel follows Left / Re-admit / Delete
}

function changeRowsPerPage(val) {
  rowsPerPage = Number(val) || 50;
  currentPage = 1;
  renderSmartTable();
  renderPagination();
  msSaveState();
}

/* ── PAGINATION (original) ── */
function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const container  = document.getElementById("pagination");

  if (filteredData.length <= rowsPerPage) { container.innerHTML = ""; return; }

  let buttons = "";
  for (let i = 1; i <= totalPages; i++) {
    buttons += `<button onclick="goToPage(${i})" ${i === currentPage ? "class='pg-active'" : ""}>${i}</button>`;
  }
  container.innerHTML = `<button onclick="prevPage()" aria-label="Previous page">⬅</button>${buttons}<button onclick="nextPage()" aria-label="Next page">➡</button>`;
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderSmartTable();
  renderPagination();
  msSaveState();
  const list = document.querySelector(".md-rec__list");
  if (list && list.scrollIntoView && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: "start" });
}

function jumpToPage() { goToPage(parseInt(document.getElementById("pageInput").value)); }
function nextPage()   { goToPage(currentPage + 1); }
function prevPage()   { goToPage(currentPage - 1); }

/* ── DELETE (original logic preserved) ── */
async function deleteStudent(id, btn) {
  if (msPastBlocked()) return;
  const staff = recordType === "staff";
  const who = students.find(s => String(s[idKey]) === String(id));
  const whoName = who && who.Name ? ` (${who.Name})` : "";
  if (!confirm(staff ? `Delete staff member ${id}${whoName}?\n\nThey will be removed from all lists, printing and exports.`
                     : `Delete student ${id}${whoName}?\n\nThey will be removed from all lists, printing and exports.`)) return;

  const filters = { name: document.getElementById("searchName").value };
  const scrollPos = window.scrollY;
  if (btn) { btn.disabled = true; btn.innerText = "⏳ Deleting…"; }

  let res = null;
  try {
    res = staff ? await deleteStaff(school, id)
                : await (await fetch(`${API_URL}?action=deleteStudent&school=${encodeURIComponent(school)}&student_id=${encodeURIComponent(id)}`)).json();
  } catch (err) { res = null; }
  if (!res || res.error) {
    if (btn) { btn.disabled = false; btn.innerText = "Delete"; }
    showToast("NOT deleted: " + ((res && res.error) || "no answer from the server"), "error");
    return;
  }

  showToast("Deleted " + id + whoName, "success");

  await loadStudents();

  document.getElementById("searchName").value = filters.name;
  applyFilter(true);             // P2b: stay on the same page
  window.scrollTo(0, scrollPos);
}

/* ── OPEN EDIT (photo row added) ── */
async function openEdit(id) {
  if (msPastBlocked()) return;
  if (recordType === "staff") return openStaffEditManage(id);
  const container = document.getElementById("editPopup");

  container.innerHTML = `
    <div class="school-header">
      <h3>Edit Student</h3>
      <span class="close-btn" onclick="closeEdit()">✖</span>
    </div>
    <p style="text-align:center; margin-top:20px;">⏳ Loading student data...</p>
  `;
  container.style.display = "block";

  if (!schoolsData || schoolsData.length === 0) {
    schoolsData = await getSchools();
  }

  const student = students.find(s => s["Student_ID"] == id);
  if (!student) return;

  const headers = schoolsData[0];
  const schools = schoolsData.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  const currentSchool = schools.find(s => s.school === school);
  if (!currentSchool) return;

  const fields = currentSchool.fields.split(",");

  let html = `
    <div class="school-header">
      <h3>Edit Student</h3>
      <span class="close-btn" onclick="closeEdit()">✖</span>
    </div>
    <div class="form-row">
      <label>Student ID</label>
      <input value="${id}" disabled>
    </div>
  `;

  // 📸 PHOTO ROW
  currentEditPhotoLink = student["Photo_Link"] || "";

  html += `
    <div class="form-row">
      <label>Photo</label>
      <div class="photo-upload-wrap">
        ${
          currentEditPhotoLink
            ? `<img src="${getPhotoUrl(currentEditPhotoLink, 'w_100,h_100,c_fill')}" alt="Current photo">`
            : `<span class="no-photo-label">No photo</span>`
        }
        <input type="file" id="edit_photo_file" accept="image/*">
      </div>
    </div>
  `;

  fields.forEach(f => {
    const original = f.trim();
    const key      = normalizeKey(original);
    let   value    = mdFieldValue(student, original);   // P2b.1: "Mobile No" finds Mobile_No

    if (key === "dob") value = formatDOB(value);

    html += `<div class="form-row"><label>${original}</label>`;

    if (key === "class") {
      html += `<select id="edit_${key}">${mdOptionsHtml(CONFIG.classes, value)}</select>`;   // P2a: a class not in the list is kept
    } else if (key === "section") {
      html += `<select id="edit_${key}">${mdOptionsHtml(CONFIG.sections, value)}</select>`;   // P2a: a section not in the list is kept
    } else if (key === "dob") {
      html += `<input id="edit_${key}" value="${mdEsc(value)}" placeholder="DD/MM/YYYY" inputmode="numeric">`;
    } else {
      html += `<input id="edit_${key}" value="${mdEsc(value)}">`;   // P2a: quotes in a value no longer cut it short
    }

    html += `</div>`;
  });

  html += `
    <div class="btn-group">
      <button class="submit-btn" onclick="saveEditDynamic('${id}')">Save</button>
      <button class="clear-btn"  onclick="closeEdit()">Cancel</button>
    </div>
  `;

  container.innerHTML = html;

  if (typeof attachDOBFormatterAll === "function") attachDOBFormatterAll();
  if (typeof attachPhoneValidation === "function") attachPhoneValidation();   // R1: phones were not checked here before
  if (typeof attachDOBPickerAll    === "function") attachDOBPickerAll();
}

function closeEdit() {
  document.getElementById("editPopup").style.display = "none";
}

/* ── SAVE EDIT (photo upload/replace wired in) ── */
async function saveEditDynamic(id) {
  // R1: DOB and phone rules - only values that were changed in this popup
  const editProblem = typeof mdFormProblem === "function" ? mdFormProblem(document.getElementById("editPopup")) : "";
  if (editProblem) { showToast(editProblem, "error"); return; }

  let params = new URLSearchParams({
    action:     "updateStudent",
    school:     school,
    student_id: id,
    updated_by: sessionStorage.getItem("username") || "unknown"
  });

  if (!schoolsData || schoolsData.length === 0) schoolsData = await getSchools();

  const headers = schoolsData[0];
  const schools = schoolsData.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  const currentSchool = schools.find(s => s.school === school);
  const fields        = currentSchool.fields.split(",");

  const visibleHeaders = headersGlobal.filter(h => {
    const key = h.toLowerCase();
    return !key.includes("address") && !key.includes("photo");
  });

  let updatedValues = {};

  fields.forEach(f => {
    const key = normalizeKey(f.trim());
    const el  = document.getElementById(`edit_${key}`);
    if (!el) return;
    let value = el.value || "";
    if (key === "dob") value = formatDOB(value);
    params.append(key, value);
    updatedValues[key] = value;
  });

  // 📸 Capture photo file + old link BEFORE closing the popup
  const newPhotoFile = document.getElementById("edit_photo_file")?.files[0] || null;
  const oldPhotoLink = currentEditPhotoLink;
  const editSchoolId = sessionStorage.getItem("school_id");

  // P2b: show the new values at once (the list, the open panel), at the same place in the list
  const target = students.find(s => String(s["Student_ID"]) === String(id));
  if (target) {
    headersGlobal.forEach(h => { const k = normalizeKey(h); if (updatedValues[k] !== undefined) target[h] = updatedValues[k]; });
    msFlash(id);
    applyFilter(true);
  }
  closeEdit();

  // Backend save - only report success when the server confirms it
  let editRes = null;
  try { editRes = await (await fetch(`${API_URL}?${params.toString()}`)).json(); } catch (err) { editRes = null; }
  if (!editRes || editRes.error) {
    showToast("NOT saved: " + ((editRes && editRes.error) || "no answer from the server"), "error");
    await loadStudents();      // show what is really stored
    return;
  }
  showToast("Saved", "success");

  // 📸 Handle photo replacement
  if (newPhotoFile) {
    try {
      // new photo first; the old one is removed only after the new one is saved
      await replacePhotoSafely(newPhotoFile, editSchoolId, school, id, oldPhotoLink, false);
      showToast("Photo updated", "success");
    } catch (err) {
      console.error("Photo update failed:", err);
      showToast("Details saved, but the photo was NOT changed: " + (err.message || "upload failed"), "error");
    }
  }

  // P2b: what the server really stored (and the new photo), without losing filters or the page
  await loadStudents(true);
  msFlash(id);
}

/* ── FORMAT DOB (original) ── */
function formatDOB(value) {
  if (!value) return "";
  let str    = value.toString().trim().replace(/-/g, "/");
  let digits = str.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.substring(0,2)}/${digits.substring(2,4)}/${digits.substring(4,8)}`;
  }
  const parts = str.split("/");
  if (parts.length === 3) {
    let [day, month, year] = parts;
    return `${String(day).padStart(2,"0")}/${String(month).padStart(2,"0")}/${year}`;
  }
  return str;
}

/* ── CLASS-SECTION DROPDOWN (original) ── */
function populateClassSectionDropdown() {
  const set = new Set();
  students.forEach(s => {
    const key = recordType === "staff" ? String(s.Category || "") : (s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`);
    if (key) set.add(key);
  });

  // P2b: in the school's class order (Nursery, LKG, UKG, 1 … 12), then by section
  const sorted = [...set].sort((a, b) => {
    const i = a.indexOf("-"), j = b.indexOf("-");
    const c1 = i < 0 ? a : a.slice(0, i), s1 = i < 0 ? "" : a.slice(i + 1);
    const c2 = j < 0 ? b : b.slice(0, j), s2 = j < 0 ? "" : b.slice(j + 1);
    return recordType === "staff" ? a.localeCompare(b) : (msClassCompare(c1, c2) || s1.localeCompare(s2));
  });

  document.getElementById("classSectionDropdown").innerHTML = sorted.map(val => `
    <label>
      <input type="checkbox" value="${msEsc(val)}" onchange="handleFilterChange(this)"${selectedFilters.includes(val) ? " checked" : ""}>
      ${msEsc(val)}
    </label>
  `).join("");
}

function handleFilterChange(checkbox) {
  if (checkbox.checked) {
    if (!selectedFilters.includes(checkbox.value)) selectedFilters.push(checkbox.value);
  } else {
    selectedFilters = selectedFilters.filter(v => v !== checkbox.value);
  }
  renderChips();
  applyFilter();
}

// P2b: one chip for every active filter; ✖ removes that one. "Clear all filters" removes everything.
function renderChips() {
  const box = document.getElementById("selectedChips");
  if (!box) return;
  const chip = (text, onclick, cls) => `<span class="chip${cls ? " " + cls : ""}">${msEsc(text)}<button type="button" class="md-rec__chipx" onclick="${onclick}" aria-label="Remove ${msEsc(text)}">✖</button></span>`;
  const js = v => msEsc(JSON.stringify(String(v)));
  let html = "";
  const q = (document.getElementById("searchName")?.value || "").trim();
  if (q) html += chip(`Search: ${q}`, `msClearInput('searchName')`);
  html += selectedFilters.map(val => chip(val, `removeFilter(${js(val)})`)).join("");
  html += msMissing.map(k => chip(msProblemLabel(k), `msToggleProblem(${js(k)}, false)`, "md-rec-p" + msColourOf[k])).join("");
  html += msActiveRules().map(r => chip(`${msLabel(r.field)}: ${r.text}`, `msRemoveRule(${msRules.indexOf(r)})`)).join("");
  const f = document.getElementById("dateFrom")?.value, t = document.getElementById("dateTo")?.value, by = document.getElementById("filterAddedBy")?.value;
  if (f) html += chip(`Added from ${msNiceDate(f)}`, `msClearInput('dateFrom')`);
  if (t) html += chip(`Added to ${msNiceDate(t)}`, `msClearInput('dateTo')`);
  if (by) html += chip(`Added by ${by}`, `msClearInput('filterAddedBy')`);
  if (msSort) html += chip(`Sorted by ${msLabel(msSort.key)} ${msSort.dir > 0 ? "▲" : "▼"}`, `msSortClear()`);
  box.innerHTML = html;
  msRenderBulk();
  msMeasureBar();
  const any = countActiveFilters() > 0 || !!msSort;
  const clr = document.getElementById("mdRecClearAll"); if (clr) clr.hidden = !any;
  const more = document.getElementById("mdRecMoreBtn");
  if (more) { const n = msMissing.length + msActiveRules().length + (f ? 1 : 0) + (t ? 1 : 0) + (by ? 1 : 0); more.textContent = n ? `More filters (${n})` : "More filters"; }
}

function removeFilter(value) {
  value = String(value);
  selectedFilters = selectedFilters.filter(v => v !== value);
  document.querySelectorAll("#classSectionDropdown input").forEach(cb => {
    if (cb.value === value) cb.checked = false;
  });
  renderChips();
  applyFilter();
}

function toggleDropdown(id) {
  const el     = document.getElementById(id);
  const isOpen = el.style.display === "block";
  document.querySelectorAll(".dropdown-content").forEach(d => d.style.display = "none");
  el.style.display = isOpen ? "none" : "block";
}

document.addEventListener("click", function(e) {
  const dropdown = document.getElementById("classSectionDropdown");
  if (!dropdown) return;
  if (!dropdown.parentElement.contains(e.target)) dropdown.style.display = "none";
});

/* ── ADDED BY DROPDOWN ── */
function populateAddedByDropdown() {
  const unique = [...new Set(
    students.map(s => (s.Added_By || "").trim()).filter(Boolean)
  )].sort();
  const dd = document.getElementById("filterAddedBy");
  if (!dd) return;
  const keep = dd.value;
  dd.innerHTML = `<option value="">All</option>` +
    unique.map(u => `<option value="${msEsc(u)}">${msEsc(u)}</option>`).join("");
  if (unique.includes(keep)) dd.value = keep;
}

/* ── SCHOOL CHANGE (original) ── */
function goHome()            { window.location.href = "index.html"; }
function changeSchool(ev)    { if (ev && ev.stopPropagation) ev.stopPropagation(); document.getElementById("schoolBox").classList.add("active"); }
function hideSchoolSelector(){ document.getElementById("schoolBox").classList.remove("active"); }

async function loadSchools() {
  const dropdown = document.getElementById("schoolSelect");
  dropdown.innerHTML = "<option>Loading...</option>";
  const raw = await getSchools();
  if (!raw || raw.length === 0) { dropdown.innerHTML = "<option>No Schools Found</option>"; return; }
  const headers = raw[0];
  const schools = raw.slice(1).map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
  dropdown.innerHTML = `<option value="">Select School</option>` +
    schools.map(s => `<option value="${s.school}" data-id="${s.school_id}">${s.school_name}</option>`).join("");
  if (school) dropdown.value = school;
}

function applySchoolChange() {
  const dropdown = document.getElementById("schoolSelect");
  const selected = dropdown.options[dropdown.selectedIndex];
  const newSchool = selected.value;
  const newName   = selected.textContent.trim();
  const newId     = selected.getAttribute("data-id");
  if (!newSchool) { alert("Please select a school"); return; }
  sessionStorage.setItem("school",      newSchool);
  sessionStorage.setItem("school_name", newName);
  sessionStorage.setItem("school_id",   newId);
  document.getElementById("schoolName").innerText    = newName;
  document.getElementById("schoolNameTop").innerText = newName;
  school = newSchool;
  hideSchoolSelector();
  resetFiltersQuietly();            // P2b: a new school starts with no filters
  msSelectDone();
  msClosePanel();
  loadStudents();
}

async function initSchools() { schoolsData = await getSchools(); }

loadSchools();
initSchools();


/* ── 👩‍🏫 EDIT STAFF (Manage Records, Staff tab) ── */
async function openStaffEditManage(id) {
  const box = document.getElementById("editPopup");
  const s = students.find(x => String(x.Staff_ID) === String(id));
  if (!s) return;
  const row = rtSchoolRow(schoolsData, school);
  staffEditPhotoLink = s.Photo_Link || "";
  let html = `<div class="school-header"><h3>Edit Staff Member</h3><span class="close-btn" onclick="closeEdit()">✖</span></div>
    <div class="form-row"><label>Staff ID</label><input value="${staffEsc(id)}" disabled></div>
    <div class="form-row"><label>Photo</label><div class="photo-upload-wrap">
      ${staffEditPhotoLink ? `<img src="${getPhotoUrl(staffEditPhotoLink, "w_100,h_100,c_fill")}" alt="">` : `<span class="no-photo-label">No photo</span>`}
      <input type="file" id="edit_photo_file" accept="image/*"></div></div>
    <div class="form-row"><label>Name *</label><input id="edit_name" value="${staffEsc(s.Name)}"></div>
    <div class="form-row"><label>Category *</label>${categorySelectHtml("edit_category", s.Category)}</div>
    <div class="form-row"><label>Designation *</label><div style="flex:1;">${designationSelectHtml("edit_designation", s.Designation)}</div></div>`;
  rtStaffFields(row).forEach(label => {
    let v = mdFieldValue(s, label);   // P2b.1
    if (normalizeKey(label) === "dob") v = formatDOB(v);
    html += `<div class="form-row"><label>${staffEsc(label)}</label>${staffFieldInput(label, "edit_" + normalizeKey(label), v)}</div>`;
  });
  html += `<div class="btn-group"><button class="submit-btn" id="staffSaveBtn" onclick="saveStaffEditManage('${staffEsc(id)}')">Save</button>
           <button class="clear-btn" onclick="closeEdit()">Cancel</button></div>`;
  box.innerHTML = html;
  box.style.display = "block";
  if (typeof attachDOBFormatterAll === "function") attachDOBFormatterAll();
  if (typeof attachPhoneValidation === "function") attachPhoneValidation();   // R1
}

async function saveStaffEditManage(id) {
  const name = (document.getElementById("edit_name").value || "").trim();
  const designation = designationValue("edit_designation");
  if (!name || !designation) { showToast("Name and Designation are required", "error"); return; }
  const editProblem = typeof mdFormProblem === "function" ? mdFormProblem(document.getElementById("editPopup")) : "";   // R1
  if (editProblem) { showToast(editProblem, "error"); return; }
  const data = { school: school, staff_id: id, name: name, category: document.getElementById("edit_category").value, designation: designation };
  rtStaffFields(rtSchoolRow(schoolsData, school)).forEach(label => {
    const key = normalizeKey(label);
    let v = (document.getElementById("edit_" + key)?.value || "").trim();
    if (key === "dob") v = formatDOB(v);
    data[key] = v;
  });
  const newPhoto = document.getElementById("edit_photo_file")?.files[0] || null;
  const oldPhoto = staffEditPhotoLink;
  const btn = document.getElementById("staffSaveBtn");
  btn.disabled = true; btn.innerText = "⏳ Saving…";
  const res = await updateStaff(data);
  if (!res || res.error) { btn.disabled = false; btn.innerText = "Save"; showToast("NOT saved: " + ((res && res.error) || "no answer from the server"), "error"); return; }
  closeEdit();
  showToast("Saved: " + id, "success");
  if (newPhoto) {
    try {
      await replacePhotoSafely(newPhoto, sessionStorage.getItem("school_id"), school, id, oldPhoto, true);
      showToast("Photo updated", "success");
    } catch (err) { showToast("Details saved, but the photo was NOT changed: " + (err.message || "upload failed"), "error"); }
  }
  await loadStudents();
}


/* =====================================================================
   P2b: Records — the filter bar helpers, Missing / Needs fixing, field rules,
   class → name order, Table / Cards, the student panel, kept filters
   ===================================================================== */
const MS_COLOURS = 6;

function msLabel(h) { return h === "Photo_Link" ? "Photo" : String(h || "").replace(/_/g, " "); }
function msVal(v) { return String(v === undefined || v === null ? "" : v).replace(/^'/, "").trim(); }
function msNiceDate(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; }
function msGroupKey(s) { return recordType === "staff" ? String(s.Category || "") : (s.Section ? `${s.Class}-${s.Section}` : `${s.Class}`); }
function msClearInput(id) { const el = document.getElementById(id); if (el) el.value = ""; applyFilter(); }

// Columns: Photo, Name, ID, then the school's fields (no address / photo link / who-added columns)
function msTableHeaders(headers, allColumns) {
  const rest = (headers || []).filter(h => {
    const key = String(h).toLowerCase();
    return !key.includes("address") && !key.includes("photo") && key !== "updated_by" && key !== "added_via" &&
           key !== "timestamp" && !STATUS_KEYS.includes(key) && h !== "Name" && h !== idKey;
  });
  const hidden = allColumns === true ? [] : msHiddenCols();                 // P2b.3: Columns chooser
  return [].concat((headers || []).includes("Name") ? ["Name"] : [], (headers || []).includes(idKey) ? [idKey] : [], rest)
    .filter(h => h === "Name" || !hidden.includes(h));
}

/* ── order: class (school's class list) → name; staff by name ── */
function msClassCompare(a, b) {
  const list = (typeof CONFIG !== "undefined" && Array.isArray(CONFIG.classes) ? CONFIG.classes : []).map(c => String(c).toLowerCase());
  const ca = msVal(a), cb = msVal(b);
  const ia = ca === "" ? list.length + 2 : (list.indexOf(ca.toLowerCase()) + 1 || list.length + 1);
  const ib = cb === "" ? list.length + 2 : (list.indexOf(cb.toLowerCase()) + 1 || list.length + 1);
  return ia - ib || ca.localeCompare(cb, undefined, { numeric: true, sensitivity: "base" });
}
function msBaseCompare(a, b) {
  const byClass = recordType === "staff" ? 0 : msClassCompare(a.Class, b.Class);
  return byClass || msVal(a.Name).localeCompare(msVal(b.Name), undefined, { sensitivity: "base" }) ||
         msVal(a[idKey]).localeCompare(msVal(b[idKey]), undefined, { numeric: true });
}
// With Missing / Needs fixing ticked: most problems first; among equal counts, the most recently ticked first.
function msSortRows(rows) {
  if (!msMissing.length) return rows.sort(msBaseCompare);
  const rankOf = s => msProblemsOf(s).map(k => msMissing.indexOf(k)).sort((x, y) => y - x);
  const ranks = new Map(rows.map(s => [s, rankOf(s)]));
  return rows.sort((a, b) => {
    const ra = ranks.get(a), rb = ranks.get(b);
    if (ra.length !== rb.length) return rb.length - ra.length;
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return rb[i] - ra[i];
    return msBaseCompare(a, b);
  });
}

/* ── Missing / Needs fixing ── */
// The items this school can have: Photo, each field (missing), wrong DOB, wrong phone
function msProblemItems() {
  const items = [{ key: "miss:Photo_Link", field: "Photo_Link", label: "Photo" }];
  headersGlobal.forEach(h => {
    const k = String(h).toLowerCase();
    if (h === idKey || h === "Photo_Link" || k === "added_by" || k === "joined_session" || k.includes("photo")) return;
    if (k === "name" || k === "class") return;          // P2b.2: required for every record, never missing
    items.push({ key: "miss:" + h, field: h, label: msLabel(h) });
  });
  return items;
}
function msDobHeader() { return headersGlobal.find(h => normalizeKey(String(h)) === "dob") || ""; }
function msPhoneHeaders() { return headersGlobal.filter(h => typeof mdIsPhoneKey === "function" && mdIsPhoneKey(normalizeKey(String(h)))); }
function msWrongDob(s) {
  const h = msDobHeader(); const v = h ? msVal(s[h]) : "";
  return !!v && typeof mdDobProblem === "function" && !!mdDobProblem(v, recordType === "staff" ? "staff" : "student");
}
function msWrongPhones(s) {
  return msPhoneHeaders().filter(h => { const v = msVal(s[h]); return !!v && typeof mdPhoneProblem === "function" && !!mdPhoneProblem(v, msLabel(h)); });
}
function msProblemTest(key, s) {
  if (key === "fix:dob") return msWrongDob(s);
  if (key === "fix:phone") return msWrongPhones(s).length > 0;
  if (key === "fix:dup") return msDupsOf(s).length > 0;
  if (key.startsWith("miss:")) return msVal(s[key.slice(5)]) === "";
  return false;
}
function msProblemLabel(key) {
  if (key === "fix:dob") return "Wrong DOB";
  if (key === "fix:phone") return "Wrong phone";
  if (key === "fix:dup") return "Possible duplicates";
  return key === "miss:Photo_Link" ? "No photo" : "No " + msLabel(key.slice(5));
}
function msProblemsOf(s) { return msMissing.filter(k => msProblemTest(k, s)); }
// which cells to colour for one student: { header: { c: colour, t: "No DOB" } }
function msMarks(s) {
  const out = {};
  msProblemsOf(s).forEach(k => {
    const c = msColourOf[k];
    if (k === "fix:dob") out[msDobHeader()] = { c, t: "Wrong" };
    else if (k === "fix:phone") msWrongPhones(s).forEach(h => { out[h] = { c, t: "Wrong" }; });
    else if (k === "fix:dup") out[idKey] = { c, t: "Duplicate of " + msDupsOf(s).join(", ") };
    else out[k.slice(5)] = { c, t: k === "miss:Photo_Link" ? "No photo" : "Missing" };
  });
  return out;
}
function msToggleProblem(key, on) {
  key = String(key);
  const has = msMissing.includes(key);
  if (on && !has) {
    msMissing.push(key);
    const used = Object.values(msColourOf);
    let c = 0; while (used.includes(c) && c < MS_COLOURS - 1) c++;
    msColourOf[key] = c;
  } else if (!on && has) {
    msMissing = msMissing.filter(k => k !== key);
    delete msColourOf[key];
  }
  msRenderMoreState();
  applyFilter();
}

/* ── More filters panel ── */
function msToggleMore(force) {
  const box = document.getElementById("mdRecMore"), btn = document.getElementById("mdRecMoreBtn");
  if (!box) return;
  const open = typeof force === "boolean" ? force : box.hidden;
  box.hidden = !open;
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
}
function msBuildMore() {
  const miss = document.getElementById("mdRecMissing"), fix = document.getElementById("mdRecFix");
  if (!miss || !fix) return;
  const tick = (key, label, count) => `<label class="md-rec__tick"><input type="checkbox" data-key="${msEsc(key)}" onchange="msToggleProblem(this.dataset.key, this.checked)"> <span>${msEsc(label)}</span> <span class="md-rec__count">(${count.toLocaleString()})</span></label>`;
  const items = msProblemItems();
  miss.innerHTML = items.map(it => tick(it.key, it.label, students.filter(s => msVal(s[it.field]) === "").length)).join("");
  const fixes = [];
  if (msDobHeader()) fixes.push(tick("fix:dob", "Wrong DOB", students.filter(msWrongDob).length));
  if (msPhoneHeaders().length) fixes.push(tick("fix:phone", "Wrong phone", students.filter(s => msWrongPhones(s).length).length));
  msDupCache = null;
  fixes.push(tick("fix:dup", "Possible duplicates", students.filter(s => msDupsOf(s).length).length));   // P2b.4
  fix.innerHTML = fixes.join("");
  // forget ticks and rules for fields this list does not have
  const keys = items.map(i => i.key).concat(msDobHeader() ? ["fix:dob"] : [], msPhoneHeaders().length ? ["fix:phone"] : [], ["fix:dup"]);
  msMissing = msMissing.filter(k => keys.includes(k));
  Object.keys(msColourOf).forEach(k => { if (!msMissing.includes(k)) delete msColourOf[k]; });
  msRules = msRules.filter(r => !r.field || headersGlobal.includes(r.field));
  if (!msRules.length) msRules = [{ field: "", text: "" }];
  msRenderMoreState();
}
// ticks, colours and rule rows follow the state
function msRenderMoreState() {
  document.querySelectorAll("#mdRecMore input[data-key]").forEach(cb => {
    const k = cb.dataset.key; cb.checked = msMissing.includes(k);
    const lab = cb.closest(".md-rec__tick");
    if (lab) lab.className = "md-rec__tick" + (cb.checked ? " is-on md-rec-p" + msColourOf[k] : "");
  });
  msRenderRules();
}

/* ── Any field contains (up to 3 rules, all must match) ── */
function msActiveRules() { return msRules.filter(r => r.field && String(r.text || "").trim()); }
function msRuleFields() { return headersGlobal.filter(h => !STATUS_KEYS.includes(String(h).toLowerCase()) && h !== "Photo_Link" && String(h).toLowerCase() !== "timestamp"); }
function msRenderRules() {
  const box = document.getElementById("mdRecRules");
  if (!box) return;
  const fields = msRuleFields();
  box.innerHTML = msRules.map((r, i) => `<div class="md-rec__rule">
      <select aria-label="Field" onchange="msSetRule(${i}, 'field', this.value)">
        <option value="">Choose field</option>
        ${fields.map(h => `<option value="${msEsc(h)}"${h === r.field ? " selected" : ""}>${msEsc(msLabel(h))}</option>`).join("")}
      </select>
      <input type="search" aria-label="Contains" placeholder="contains…" value="${msEsc(r.text)}" oninput="msSetRule(${i}, 'text', this.value)">
      ${msRules.length > 1 ? `<button type="button" class="md-rec__chipx" aria-label="Remove rule" onclick="msRemoveRule(${i})">✖</button>` : ""}
    </div>`).join("");
  const add = document.getElementById("mdRecAddRule");
  if (add) add.hidden = msRules.length >= 3;
}
function msSetRule(i, part, value) {
  if (!msRules[i]) return;
  msRules[i][part] = value;
  if (part === "field") msRenderRules();          // the text box keeps its value
  applyFilter();
}
function msAddRule() { if (msRules.length < 3) { msRules.push({ field: "", text: "" }); msRenderRules(); } }
function msRemoveRule(i) {
  msRules.splice(i, 1);
  if (!msRules.length) msRules = [{ field: "", text: "" }];
  msRenderRules();
  applyFilter();
}

/* ── totals line ── */
function msUpdateTotals() {
  const el = document.getElementById("mdRecTotals");
  if (!el) return;
  const who = recordType === "staff" ? "staff" : msShow === "left" ? "left" : msShow === "passed_out" ? "passed out" : msShow === "deleted" ? "deleted" : "in school";
  const total = students.length.toLocaleString(), n = filteredData.length;
  if (!n) { el.textContent = `Showing 0 of ${total} ${who}`; return; }
  const from = (currentPage - 1) * rowsPerPage + 1, to = Math.min(currentPage * rowsPerPage, n);
  el.textContent = n === students.length ? `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total} ${who}`
                                         : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${n.toLocaleString()} · ${total} ${who}`;
}

/* ── shared pieces of a row, a card and the panel ── */
function msThumb(s, size, mark, zoom) {
  const link = s["Photo_Link"] || "";
  const img = link ? `<img src="${msEsc(getPhotoUrl(link, `w_${size * 2},h_${size * 2},c_fill`))}" alt="" class="md-rec__thumb" style="width:${size}px;height:${size}px;">` : "";
  if (link && zoom) return `<button type="button" class="md-rec__zoombtn" onclick="msZoom(${msEsc(JSON.stringify(String(s[idKey])))})" aria-label="Open the photo large" title="Open the photo large">${img}</button>`;
  if (link) return img;
  return `<span class="md-rec__nophoto${mark ? " md-rec-p" + mark.c : ""}" style="width:${size}px;height:${size}px;">No photo</span>`;
}
function msCellHtml(s, h, mark) {
  const v = msVal(s[h]);
  const pin = h === "Name" ? " md-rec__pin2" : "";
  if (h === "Name") return `<td class="md-rec__namecell${pin}"><button type="button" class="md-rec__name" onclick="msOpenPanel(${msEsc(JSON.stringify(String(s[idKey])))})" title="Open ${msEsc(v)}">${msEsc(v || "(no name)")}</button></td>`;
  if (mark) return `<td class="md-rec-p${mark.c}" title="${msEsc(mark.t)}">${v ? msEsc(v) : ""}<span class="md-rec__flag">${msEsc(v ? mark.t : mark.t)}</span></td>`;
  return `<td>${msEsc(v)}</td>`;
}
function msActionsHtml(s) {
  const past = msPastSession();
  const pastTip = past ? `${window.mdSession.current()} is an earlier session — view only. Switch to ${window.mdSession.active()} to edit.` : "";
  const students_ = recordType !== "staff";
  const id = msEsc(String(s[idKey]).replace(/'/g, "\\'"));
  if (msShow === "deleted") {
    return `<span class="md-rec__delon">Deleted ${msEsc(msVal(s.Deleted_On))}</span>
    <button type="button" class="btn-edit md-rec__restore" onclick="msRestore(['${id}'])" title="Back into the school's list, with the same ID">↩ Restore</button>`;
  }
  return `${students_ ? msStatusBadge(s, past) : msJoinedBadge(s)}
    ${past
      ? `<button class="btn-edit" disabled style="opacity:.45; cursor:not-allowed;" title="${msEsc(pastTip)}">Edit</button>
    <button class="btn-delete" disabled style="opacity:.45; cursor:not-allowed;" title="${msEsc(pastTip)}">Delete</button>`
      : students_ && msShow !== "in"
      ? `<button class="btn-edit ms-readmit" onclick="msOpenReadmit('${id}')" title="Back in school with the same ID, in ${msEsc(msActiveSession())}">↩ Re-admit</button>`
      : `<button class="btn-edit"   onclick="openEdit('${id}')" title="Change details or photo">Edit</button>
    <button class="btn-delete" onclick="deleteStudent('${id}', this)" title="Remove from all lists, printing and exports">Delete</button>
    <button type="button" class="md-rec__menubtn${students_ ? "" : " md-rec__menubtn--phone"}" data-id="${msEsc(String(s[idKey]))}" onclick="msOpenRowMenu(this)"
       aria-haspopup="menu" aria-expanded="false" aria-label="More actions" title="More actions">⋮</button>`}`;
}
function msMetaLine(s) {
  const id = msEsc(msVal(s[idKey]));
  if (recordType === "staff") return [msVal(s.Category), msVal(s.Designation)].filter(Boolean).map(msEsc).join(" · ") + (id ? ` · ID ${id}` : "");
  const g = msVal(s.Class) ? msEsc(msVal(s.Class) + (msVal(s.Section) ? "-" + msVal(s.Section) : "")) : "No class";
  return `${g} · ID ${id}`;
}
// the fields shown on a card / in the panel (all of them in the panel)
function msDetailRows(s, headers, marks) {
  return headers.filter(h => h !== "Name" && h !== idKey).map(h => {
    const v = msVal(s[h]), m = marks[h];
    return `<div class="md-rec__kv${m ? " md-rec-p" + m.c : ""}"><dt>${msEsc(msLabel(h))}</dt><dd>${v ? msEsc(v) : `<span class="md-rec__dash">—</span>`}${m ? `<span class="md-rec__flag">${msEsc(m.t)}</span>` : ""}</dd></div>`;
  }).join("");
}
function msCardHtml(s, visibleHeaders) {
  const marks = msMarks(s), id = String(s[idKey]);
  const shown = visibleHeaders.filter(h => !["Class", "Section", "Category", "Designation"].includes(h));
  return `<article class="md-rec__card${String(msPanelId) === id ? " is-current" : ""}${msFlashId === id ? " is-saved" : ""}${msSel.has(id) ? " is-selected" : ""}" data-id="${msEsc(id)}">
    <div class="md-rec__cardtop">${msSelBox(s)}
      ${msThumb(s, 56, marks.Photo_Link, true)}
      <div class="md-rec__cardname">
        <button type="button" class="md-rec__name" onclick="msOpenPanel(${msEsc(JSON.stringify(id))})">${msEsc(msVal(s.Name) || "(no name)")}</button>
        <div class="md-rec__meta">${msMetaLine(s)}</div>
      </div>
    </div>
    <dl class="md-rec__kvs">${msDetailRows(s, shown, marks)}</dl>
    <div class="md-rec__act">${msActionsHtml(s)}</div>
  </article>`;
}

/* ── the student panel: name link → details, Prev / Next through the filtered list ── */
function msOpenPanel(id) {
  msPanelId = String(id);
  const p = document.getElementById("mdRecPanel");
  if (!p) return;
  p.hidden = false;
  msRenderPanel();
  document.body.classList.add("md-rec--panel");
  const close = p.querySelector(".md-rec__pclose");
  if (close && close.focus) close.focus();
}
function msClosePanel() {
  msZoomClose();
  msPanelBack = null;
  const was = msPanelId;
  msPanelId = null;
  const p = document.getElementById("mdRecPanel");
  if (p) { p.hidden = true; p.innerHTML = ""; }
  document.body.classList.remove("md-rec--panel");
  document.querySelectorAll("#studentTable tr.is-current, .md-rec__card.is-current").forEach(r => r.classList.remove("is-current"));
  const back = was && document.querySelector(`[data-id="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(was) : was}"] .md-rec__name`);
  if (back && back.focus) back.focus();
}
function msRenderPanel() {
  const p = document.getElementById("mdRecPanel");
  if (!p || !msPanelId) return;
  let i = filteredData.findIndex(s => String(s[idKey]) === msPanelId);
  const outside = i < 0;
  const s = outside ? students.find(x => String(x[idKey]) === msPanelId) : filteredData[i];
  if (!s) { msClosePanel(); return; }
  if (!p.querySelector(".md-rec__pcontent")) {          // the shell is built once, so "Go to ID" keeps what is typed
    p.innerHTML = `<div class="md-rec__phead">
        <div class="md-rec__goto">
          <input type="search" id="mdRecGoto" autocomplete="off" inputmode="numeric" placeholder="Go to ID…" aria-label="Go to ID: type the last digits"
                 role="combobox" aria-expanded="false" aria-controls="mdRecGotoList" oninput="msGotoList(this.value)" onkeydown="msGotoKey(event)">
          <div id="mdRecGotoList" class="md-rec__gotolist" role="listbox" hidden></div>
        </div>
        <button type="button" class="md-rec__pnav" data-step="-1" onclick="msPanelStep(-1)" aria-label="Previous student" title="Previous (←)">‹</button>
        <span class="md-rec__ppos"></span>
        <button type="button" class="md-rec__pnav" data-step="1" onclick="msPanelStep(1)" aria-label="Next student" title="Next (→)">›</button>
        <button type="button" class="md-rec__pclose" onclick="msClosePanel()" aria-label="Close" title="Close (Esc)">✖</button>
      </div>
      <div class="md-rec__pcontent"></div>`;
  }
  const n = filteredData.length;
  p.querySelector(".md-rec__ppos").textContent = outside ? "—" : `${(i + 1).toLocaleString()} / ${n.toLocaleString()}`;
  p.querySelector('[data-step="-1"]').disabled = outside || i === 0;
  p.querySelector('[data-step="1"]').disabled = outside || i === n - 1;
  const z = document.getElementById("mdRecZoom"); if (z && !z.textContent.includes(msVal(s[idKey]))) msZoomClose();
  const marks = msMarks(s);
  const back = outside && msPanelBack ? filteredData.find(x => String(x[idKey]) === msPanelBack) : null;
  p.querySelector(".md-rec__pcontent").innerHTML = `<div class="md-rec__pbody">
      ${outside ? `<div class="md-rec__pnote">Not in your filtered list, so Prev / Next are off.
        ${back ? `<button type="button" class="md-rec__link" onclick="msPanelGoBack()">↩ Back to ${msEsc(msVal(back.Name) || msVal(back[idKey]))}</button>` : ""}</div>` : ""}
      <div class="md-rec__ptop">
        <div class="md-rec__pphoto">${msThumb(s, 96, marks.Photo_Link, true)}${msPhotoMenuButton(s)}</div>
        <div><h2 class="md-rec__pname" id="mdRecPanelName">${msEsc(msVal(s.Name) || "(no name)")}</h2><div class="md-rec__meta">${msMetaLine(s)}</div></div>
      </div>
      <dl class="md-rec__kvs md-rec__kvs--panel">${msDetailRows(s, msPanelHeaders(), marks)}</dl>
    </div>
    <div class="md-rec__pfoot md-rec__act">${msActionsHtml(s)}</div>`;
  document.querySelectorAll("#studentTable tr, .md-rec__card").forEach(r => r.classList.toggle("is-current", r.dataset.id === msPanelId));
}
function msPanelHeaders() {
  return headersGlobal.filter(h => { const k = String(h).toLowerCase(); return !k.includes("photo") && k !== "updated_by" && k !== "added_via" && k !== "timestamp" && !STATUS_KEYS.includes(k); });
}
function msPanelStep(d) {
  const i = filteredData.findIndex(s => String(s[idKey]) === msPanelId);
  const j = i + d;
  if (i < 0 || j < 0 || j >= filteredData.length) return;
  msPanelId = String(filteredData[j][idKey]);
  const page = Math.floor(j / rowsPerPage) + 1;          // the list follows the panel
  if (page !== currentPage) { currentPage = page; renderSmartTable(); renderPagination(); msSaveState(); }
  msRenderPanel();
  const row = document.querySelector(`#studentTable tr.is-current, .md-rec__card.is-current`);
  if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
}
// P2b.1: the school chooser closes with Esc or a click outside it (it used to need the ✖)
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const box = document.getElementById("schoolBox");
  if (box && box.classList.contains("active")) { e.stopImmediatePropagation(); hideSchoolSelector(); return; }
  const dd = document.getElementById("classSectionDropdown");
  if (dd && dd.style.display === "block") { e.stopImmediatePropagation(); dd.style.display = "none"; }
}, true);
document.addEventListener("click", e => {
  const box = document.getElementById("schoolBox");
  if (!box || !box.classList.contains("active")) return;
  if (box.contains(e.target) || (e.target.closest && e.target.closest("[onclick*='changeSchool']"))) return;
  hideSchoolSelector();
});

document.addEventListener("keydown", e => {
  if (!msPanelId) return;
  const popupOpen = document.getElementById("editPopup")?.style.display === "block" || document.getElementById("schoolBox")?.classList.contains("active");
  if (popupOpen) return;
  const typing = e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
  if (e.key === "Escape") { msClosePanel(); return; }
  if (typing) return;
  if (e.key === "ArrowRight") { e.preventDefault(); msPanelStep(1); }
  if (e.key === "ArrowLeft")  { e.preventDefault(); msPanelStep(-1); }
});

/* ── Table / Cards ── */
function msSetView(v) {
  msView = v === "cards" ? "cards" : "table";
  try { localStorage.setItem(msViewKey(), msView); } catch (e) { /* storage off */ }
  msViewButtons();
  renderSmartTable();
}
function msViewButtons() {
  const t = document.getElementById("mdRecViewTable"), c = document.getElementById("mdRecViewCards");
  if (t) t.setAttribute("aria-pressed", msView === "table" ? "true" : "false");
  if (c) c.setAttribute("aria-pressed", msView === "cards" ? "true" : "false");
}
msViewButtons();

/* ── a saved row shows green for a moment ── */
function msFlash(id) {
  msFlashId = String(id);
  document.querySelectorAll(`[data-id]`).forEach(r => r.classList.toggle("is-saved", r.dataset.id === msFlashId));
  setTimeout(() => { if (msFlashId === String(id)) { msFlashId = null; document.querySelectorAll(".is-saved").forEach(r => r.classList.remove("is-saved")); } }, 1500);
}

/* ── kept filters (this browser tab; cleared by "Clear all filters" or a school change) ── */
function msReadState() {
  try {
    const st = JSON.parse(sessionStorage.getItem(MD_REC_KEY) || "null");
    return st && st.school === school ? st : null;
  } catch (e) { return null; }
}
function msSaveState() {
  if (!msStateUsed) return;               // nothing is saved before the saved filters were read back
  try {
    sessionStorage.setItem(MD_REC_KEY, JSON.stringify({
      school: school, type: recordType, show: msShow,
      q: document.getElementById("searchName")?.value || "",
      groups: selectedFilters, rows: rowsPerPage, page: currentPage,
      from: document.getElementById("dateFrom")?.value || "", to: document.getElementById("dateTo")?.value || "",
      by: document.getElementById("filterAddedBy")?.value || "",
      missing: msMissing, colours: msColourOf, rules: msRules, sort: msSort
    }));
  } catch (e) { /* storage full or off: filters just are not kept */ }
}
function msRestoreState() {
  if (msStateUsed) return;
  msStateUsed = true;
  const st = msReadState();
  if (!st || st.type !== recordType) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el && typeof v === "string") el.value = v; };
  set("searchName", st.q); set("dateFrom", st.from); set("dateTo", st.to);
  const by = document.getElementById("filterAddedBy");
  if (by && st.by && [...by.options].some(o => o.value === st.by)) by.value = st.by;
  const groups = [...document.querySelectorAll("#classSectionDropdown input")].map(cb => cb.value);
  selectedFilters = (st.groups || []).filter(g => groups.includes(g));
  document.querySelectorAll("#classSectionDropdown input").forEach(cb => { cb.checked = selectedFilters.includes(cb.value); });
  if ([20, 50, 100].includes(Number(st.rows))) { rowsPerPage = Number(st.rows); set("rowsPerPageSelect", String(rowsPerPage)); }
  msMissing = Array.isArray(st.missing) ? st.missing.slice() : [];
  msColourOf = st.colours && typeof st.colours === "object" ? Object.assign({}, st.colours) : {};
  msRules = Array.isArray(st.rules) && st.rules.length ? st.rules.slice(0, 3).map(r => ({ field: String(r.field || ""), text: String(r.text || "") })) : [{ field: "", text: "" }];
  currentPage = Number(st.page) || 1;
  msSort = st.sort && typeof st.sort.key === "string" && headersGlobal.includes(st.sort.key) ? { key: st.sort.key, dir: st.sort.dir < 0 ? -1 : 1 } : null;
  msBuildMore();                           // drops anything this school's fields no longer have
}

// P2b: "?" tips in the edit popup (Photo, DOB, phone / mobile), same as Add records
if (typeof mdTipsInit === "function") mdTipsInit(["editPopup"]);

/* ── P2b.2: ⋮ more actions on a student (today: 🚪 Left; room for more later) ── */
function msRowMenuItems(id, btn) {
  const items = [];
  // P2b.6: on a phone's table the Delete button sits in ⋮ (saves room)
  const inTableRow = btn && btn.closest && btn.closest("#studentTable");
  if (inTableRow && msNarrow() && !msPastSession() && msShow === "in") {
    items.push({ cls: "md-rec__menuitem--danger", text: "Delete", title: "Remove from all lists, printing and exports", run: () => deleteStudent(id, null) });
  }
  if (recordType !== "staff" && msShow === "in" && !msPastSession()) {
    items.push({ cls: "ms-left", text: "🚪 Left", title: "The student has left the school: out of every list, print and export. Nothing is deleted; ↩ Re-admit brings them back",
                 run: () => msMarkLeft(id, null) });
  }
  return items;
}
function msCloseRowMenu() {
  const m = document.getElementById("mdRecMenu");
  if (m) m.remove();
  document.querySelectorAll(".md-rec__menubtn[aria-expanded='true'], .md-rec__photobtn[aria-expanded='true']").forEach(b => b.setAttribute("aria-expanded", "false"));
}
function msOpenRowMenu(btn) {
  const already = btn.getAttribute("aria-expanded") === "true";
  msCloseRowMenu();
  if (already) return;
  const id = btn.dataset.id, items = msRowMenuItems(id, btn);
  if (!items.length) return;
  const m = document.createElement("div");
  m.id = "mdRecMenu"; m.className = "md-rec__menu"; m.setAttribute("role", "menu");
  items.forEach(it => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "md-rec__menuitem " + it.cls; b.setAttribute("role", "menuitem");
    b.textContent = it.text; b.title = it.title;
    b.onclick = e => { e.stopPropagation(); msCloseRowMenu(); it.run(); };
    m.appendChild(b);
  });
  document.body.appendChild(m);
  btn.setAttribute("aria-expanded", "true");
  const r = btn.getBoundingClientRect(), mw = m.offsetWidth || 160, mh = m.offsetHeight || 44;
  const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
  m.style.left = Math.max(8, Math.min(r.right - mw, vw - mw - 8)) + "px";
  m.style.top  = (r.bottom + mh + 8 > vh ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + "px";
  const first = m.querySelector("button"); if (first && first.focus) first.focus();
}

/* ── P2b.2: More filters fold away after use (a click outside it, or Esc); chips keep showing what is on ── */
document.addEventListener("click", e => {
  const t = e.target;
  if (!(t.closest && t.closest("#mdRecMenu, .md-rec__menubtn, .md-rec__photobtn"))) msCloseRowMenu();
  const box = document.getElementById("mdRecMore");
  if (!box || box.hidden) return;
  if (!t.isConnected) return;                         // the clicked thing was just redrawn (a rule row, a tick)
  if (t.closest && t.closest("#mdRecMore, #mdRecMoreBtn")) return;
  msToggleMore(false);
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (document.getElementById("schoolBox")?.classList.contains("active")) return;
  if (document.getElementById("mdRecMenu")) { e.stopImmediatePropagation(); msCloseRowMenu(); return; }   // one thing closes per Esc
  const box = document.getElementById("mdRecMore");
  if (box && !box.hidden) { e.stopImmediatePropagation(); msToggleMore(false); document.getElementById("mdRecMoreBtn")?.focus(); }
}, true);
window.addEventListener("scroll", msCloseRowMenu, true);
window.addEventListener("resize", msCloseRowMenu);

/* ── P2b.3: Columns chooser (remembered per device, per school and list) and Compact rows ── */
function msColsKey() { return `mdRecCols:${school}:${recordType}`; }
function msHiddenCols() {
  try { const v = JSON.parse(localStorage.getItem(msColsKey()) || "[]"); return Array.isArray(v) ? v.map(String) : []; } catch (e) { return []; }
}
function msSetHiddenCols(list) {
  try { localStorage.setItem(msColsKey(), JSON.stringify(list)); } catch (e) { /* storage off: just for now */ }
}
function msToggleCols(force) {
  const box = document.getElementById("mdRecCols"), btn = document.getElementById("mdRecColsBtn");
  if (!box) return;
  const open = typeof force === "boolean" ? force : box.hidden;
  if (open) msBuildCols();
  box.hidden = !open;
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
}
function msBuildCols() {
  const box = document.getElementById("mdRecCols");
  if (!box) return;
  const hidden = msHiddenCols();
  const all = msTableHeadersAll();
  box.innerHTML = `<label class="md-rec__colitem md-rec__colitem--density"><input type="checkbox" ${msDensity === "compact" ? "checked" : ""} onchange="msSetDensity(this.checked ? 'compact' : 'normal')"> Compact rows</label>
    <div class="md-rec__colsep">Columns</div>
    <label class="md-rec__colitem is-fixed"><input type="checkbox" checked disabled> Photo</label>
    <label class="md-rec__colitem is-fixed"><input type="checkbox" checked disabled> Name</label>
    ${all.filter(h => h !== "Name").map(h => `<label class="md-rec__colitem"><input type="checkbox" data-col="${msEsc(h)}" ${hidden.includes(h) ? "" : "checked"} onchange="msSetCol(this.dataset.col, this.checked)"> ${msEsc(msLabel(h))}</label>`).join("")}
    <button type="button" class="md-rec__link" onclick="msShowAllCols()">Show all columns</button>`;
}
// every column the table could show (before hiding)
function msTableHeadersAll() { return msTableHeaders(headersGlobal, true); }
function msSetCol(h, on) {
  let hidden = msHiddenCols().filter(x => x !== h);
  if (!on) hidden.push(h);
  msSetHiddenCols(hidden);
  renderSmartTable();
}
function msShowAllCols() { msSetHiddenCols([]); msBuildCols(); renderSmartTable(); }
function msSetDensity(v) {
  msDensity = v === "compact" ? "compact" : "normal";
  try { localStorage.setItem("mdRecDensity", msDensity); } catch (e) { /* storage off */ }
  document.body.classList.toggle("md-rec--compact", msDensity === "compact");
  renderSmartTable();
}
document.body.classList.toggle("md-rec--compact", msDensity === "compact");

/* ── P2b.3: sort by a column heading: ▲, then ▼, then back to class → name ── */
function msHeadCell(h) {
  const on = msSort && msSort.key === h;
  const arrow = on ? (msSort.dir > 0 ? " ▲" : " ▼") : "";
  const sortAttr = on ? (msSort.dir > 0 ? "ascending" : "descending") : "none";
  return `<th class="${h === "Name" ? "md-rec__pin2" : ""}" aria-sort="${sortAttr}"><button type="button" class="md-rec__sort${on ? " is-on" : ""}" onclick="msSortClick(${msEsc(JSON.stringify(h))})" title="Sort by ${msEsc(msLabel(h))}">${msEsc(msLabel(h))}<span class="md-rec__arrow">${arrow}</span></button></th>`;
}
function msSortClick(h) {
  if (!msSort || msSort.key !== h) msSort = { key: h, dir: 1 };
  else if (msSort.dir > 0) msSort = { key: h, dir: -1 };
  else msSort = null;
  applyFilter(true);
}
function msSortClear() { msSort = null; applyFilter(true); }
function msSortValue(s, h) {
  const v = msVal(s[h]);
  if (v === "") return null;
  if (normalizeKey(String(h)) === "dob") {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
    return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : v;
  }
  return v;
}
function msSortBy(rows) {
  const { key, dir } = msSort;
  return rows.sort((a, b) => {
    const x = msSortValue(a, key), y = msSortValue(b, key);
    if (x === null || y === null) return x === y ? msBaseCompare(a, b) : (x === null ? 1 : -1);   // empty always last
    let c;
    if (key === "Class") c = msClassCompare(x, y);
    else if (typeof x === "number" && typeof y === "number") c = x - y;
    else c = String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
    return c * dir || msBaseCompare(a, b);
  });
}

/* ── P2b.3: the filter bar stays on top while the table scrolls; the table fills the rest of the screen ── */
function msMeasureBar() {
  const card = document.querySelector(".md-rec__filters");
  if (card && document.body.style) document.body.style.setProperty("--md-rec-bar", card.offsetHeight + "px");
}
window.addEventListener("resize", msMeasureBar);
if (typeof ResizeObserver === "function") {
  const card = document.querySelector(".md-rec__filters");
  if (card) new ResizeObserver(msMeasureBar).observe(card);
}

// the Columns list closes like More filters: a click outside or Esc
document.addEventListener("click", e => {
  const box = document.getElementById("mdRecCols");
  if (!box || box.hidden || !e.target.isConnected) return;
  if (e.target.closest && e.target.closest("#mdRecCols, #mdRecColsBtn")) return;
  msToggleCols(false);
});
document.addEventListener("keydown", e => {
  const box = document.getElementById("mdRecCols");
  if (e.key === "Escape" && box && !box.hidden) { e.stopImmediatePropagation(); msToggleCols(false); document.getElementById("mdRecColsBtn")?.focus(); }
}, true);

/* =====================================================================
   P2b.4: Deleted list, ID search, Go to ID, Select + bulk actions,
   photo zoom / Photo ▾, possible duplicates
   ===================================================================== */
function msCanRestore() {
  let role = "", perms = [];
  try { role = typeof getRole === "function" ? getRole() : (sessionStorage.getItem("role") || ""); } catch (e) { /* no role */ }
  try { perms = typeof getPermissions === "function" ? (getPermissions() || []) : JSON.parse(sessionStorage.getItem("permissions") || "[]"); } catch (e) { perms = []; }
  return role === "admin" || (Array.isArray(perms) && perms.includes("restore"));
}

/* ── the Deleted list: this school's deleted students, read-only, with ↩ Restore ── */
function msDeletedAsRows(raw) {
  if (!Array.isArray(raw)) return raw;
  const mine = raw.slice(1).filter(r => String(r[1]).trim().toLowerCase() === String(school).trim().toLowerCase());
  const headers = [];
  const objs = mine.map(r => {
    let hs = [], row = [];
    try { hs = JSON.parse(r[4] || "[]"); row = JSON.parse(r[5] || "[]"); } catch (err) { /* very old entry: only the ID */ }
    const o = { Student_ID: r[0] };
    hs.forEach((h, i) => { if (!headers.includes(h)) headers.push(h); o[h] = row[i]; });
    o.Student_ID = r[0];
    o.Deleted_On = msVal(r[3]);
    return o;
  });
  const cols = ["Student_ID"].concat(headers.filter(h => h !== "Student_ID"), ["Deleted_On"]);
  return [cols].concat(objs.map(o => cols.map(h => o[h] === undefined ? "" : o[h])));
}
async function msRestore(ids) {
  ids = (ids || []).map(String).filter(Boolean);
  if (!ids.length) return;
  const names = ids.map(id => { const s = students.find(x => String(x[idKey]) === id); return s && s.Name ? `${id} ${s.Name}` : id; });
  if (!confirm(`Restore ${ids.length === 1 ? "this student" : ids.length + " students"} back into the school's list?\n\n${names.slice(0, 8).join("\n")}${names.length > 8 ? "\n…and " + (names.length - 8) + " more" : ""}`)) return;
  const res = await restoreStudentsMany(ids);
  if (!res || res.error) { showToast("NOT restored: " + ((res && res.error) || "no answer from the server"), "error"); return; }
  showToast(ids.length === 1 ? `Restored ${names[0]}` : `Restored ${ids.length} students`, "success");
  ids.forEach(id => msSel.delete(id));
  await loadStudents(true);
}

/* ── ID search: digits find IDs that end with them (or are them), in the whole selected list ── */
function msIdQuery(q) {
  const v = String(q || "").trim().toLowerCase();
  if (recordType === "staff") { const m = /^(?:s-?)?(\d+)$/.exec(v); return m ? m[1] : ""; }
  return /^\d+$/.test(v) ? v : "";
}
function msIdMatch(s, digits) {
  const num = String(s[idKey] === undefined || s[idKey] === null ? "" : s[idKey]).replace(/\D/g, "");
  return !!num && num.endsWith(digits);
}
function msListName(v) { return v === "left" ? "Left" : v === "passed_out" ? "Passed out" : v === "deleted" ? "Deleted" : "In school"; }
function msIdNotFound(digits) {
  const what = recordType === "staff" ? "staff" : "student";
  const here = recordType === "staff" ? "this school's staff" : msListName(msShow);
  if (recordType === "staff" || msPastSession()) return `No ${what} with an ID ending in <b>${msEsc(digits)}</b> in ${msEsc(here)}. They may have been deleted.`;
  const others = ["in", "left", "passed_out"].concat(msCanRestore() ? ["deleted"] : []).filter(v => v !== msShow);
  return `No ${what} with an ID ending in <b>${msEsc(digits)}</b> in ${msEsc(here)}. Check: ` +
    others.map(v => `<button type="button" class="md-rec__link" onclick="msSwitchShow('${v}')">${msListName(v)}</button>`).join(" · ") +
    (msCanRestore() ? "" : ". If none has them, they were deleted.");
}
// switch to another list but keep what is typed in the search
function msSwitchShow(v) {
  const q = document.getElementById("searchName")?.value || "";
  msShow = v;
  const sel = document.getElementById("msShowSelect"); if (sel) sel.value = v;
  resetFiltersQuietly();
  msSelectDone();
  const box = document.getElementById("searchName"); if (box) box.value = q;
  loadStudents();
}

/* ── Go to ID (panel): a list to click; nothing moves until a student is clicked ── */
let msGotoActive = -1;
function msGotoList(value) {
  const list = document.getElementById("mdRecGotoList");
  if (!list) return;
  msGotoActive = -1;
  const input = document.getElementById("mdRecGoto");
  const digits = msIdQuery(value);
  if (!String(value || "").trim()) { list.hidden = true; list.innerHTML = ""; if (input) input.setAttribute("aria-expanded", "false"); return; }
  if (input) input.setAttribute("aria-expanded", "true");
  if (!digits) { list.hidden = false; list.innerHTML = `<div class="md-rec__gotonote">Type digits of the ID.</div>`; return; }
  const hits = students.filter(s => msIdMatch(s, digits)).sort(msBaseCompare);
  list.hidden = false;
  if (!hits.length) {
    list.innerHTML = `<div class="md-rec__gotonote">No ID ending in ${msEsc(digits)} in ${msEsc(recordType === "staff" ? "this school's staff" : msListName(msShow))}.</div>`;
    return;
  }
  list.innerHTML = hits.slice(0, 8).map((s, k) => `<button type="button" role="option" id="mdRecGotoOpt${k}" tabindex="-1" class="md-rec__gotoitem" onmousedown="event.preventDefault()" onclick="msGotoPick(${msEsc(JSON.stringify(String(s[idKey])))})">
      <b>${msEsc(msVal(s[idKey]))}</b> ${msEsc(msVal(s.Name))} <span>${msEsc(recordType === "staff" ? msVal(s.Category) : msVal(s.Class) + (msVal(s.Section) ? "-" + msVal(s.Section) : ""))}</span></button>`).join("") +
    (hits.length > 8 ? `<div class="md-rec__gotonote">${hits.length - 8} more: type more digits.</div>` : "");
}
// ↑ / ↓ move through the list, Enter opens the marked student, Esc closes the list
function msGotoKey(e) {
  const list = document.getElementById("mdRecGotoList");
  const items = list && !list.hidden ? [...list.querySelectorAll(".md-rec__gotoitem")] : [];
  if (e.key === "Escape" && list && !list.hidden) { e.preventDefault(); e.stopPropagation(); list.hidden = true; e.target.setAttribute("aria-expanded", "false"); return; }
  if (!items.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); e.stopPropagation();
    msGotoActive = e.key === "ArrowDown" ? (msGotoActive + 1) % items.length : (msGotoActive <= 0 ? items.length - 1 : msGotoActive - 1);
    items.forEach((it, k) => { it.classList.toggle("is-active", k === msGotoActive); it.setAttribute("aria-selected", k === msGotoActive ? "true" : "false"); });
    e.target.setAttribute("aria-activedescendant", items[msGotoActive].id);
    if (items[msGotoActive].scrollIntoView) items[msGotoActive].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    e.preventDefault();
    const pick = items[msGotoActive >= 0 ? msGotoActive : (items.length === 1 ? 0 : -1)];
    if (pick) pick.click();
  }
}
function msGotoPick(id) {
  const wasIn = msPanelId && filteredData.some(s => String(s[idKey]) === msPanelId);
  if (wasIn) msPanelBack = msPanelId;                   // where "↩ Back" returns to
  msPanelId = String(id);
  const list = document.getElementById("mdRecGotoList"); if (list) { list.hidden = true; list.innerHTML = ""; }
  const box = document.getElementById("mdRecGoto"); if (box) { box.setAttribute("aria-expanded", "false"); box.removeAttribute("aria-activedescendant"); }   // the typed ID stays in the box
  const i = filteredData.findIndex(s => String(s[idKey]) === msPanelId);
  if (i >= 0) {
    const page = Math.floor(i / rowsPerPage) + 1;
    if (page !== currentPage) { currentPage = page; renderSmartTable(); renderPagination(); msSaveState(); }
  }
  if (i >= 0) msPanelBack = null;
  msRenderPanel();
}
function msPanelGoBack() {
  if (!msPanelBack) return;
  const id = msPanelBack; msPanelBack = null;
  msGotoPick(id);
}

/* ── Select + bulk actions (no extra column: tick boxes appear in the photo cell only while selecting) ── */
function msCanSelect() { return !msPastSession() && (msShow === "in" || msShow === "deleted"); }
function msSelBox(s) {
  if (!msSelecting) return "";
  const id = String(s[idKey]);
  return `<input type="checkbox" class="md-rec__selbox" aria-label="Select ${msEsc(msVal(s.Name))}" ${msSel.has(id) ? "checked" : ""} onclick="event.stopPropagation()" onchange="msToggleSel(${msEsc(JSON.stringify(id))}, this.checked)">`;
}
function msSelectStart() {
  if (!msCanSelect()) return;
  msSelecting = true; msSel = new Set();
  document.body.classList.add("md-rec--selecting");
  renderSmartTable(); msRenderBulk();
}
function msSelectDone() {
  msSelecting = false; msSel = new Set();
  document.body.classList.remove("md-rec--selecting");
  if (typeof renderSmartTable === "function" && document.getElementById("studentTable")) renderSmartTable();
  msRenderBulk();
}
function msToggleSel(id, on) {
  if (on) msSel.add(String(id)); else msSel.delete(String(id));
  document.querySelectorAll(`[data-id]`).forEach(r => { if (r.dataset.id === String(id)) r.classList.toggle("is-selected", !!on); });
  msRenderBulk();
}
function msSelectAllMatching() { filteredData.forEach(s => msSel.add(String(s[idKey]))); renderSmartTable(); msRenderBulk(); }
function msSelectClear() { msSel = new Set(); renderSmartTable(); msRenderBulk(); }
function msRenderBulk() {
  const bar = document.getElementById("mdRecBulk"), btn = document.getElementById("mdRecSelectBtn");
  if (btn) btn.hidden = msSelecting || !msCanSelect() || !filteredData.length;
  if (!bar) return;
  bar.hidden = !msSelecting;
  if (!msSelecting) { bar.innerHTML = ""; return; }
  const n = msSel.size, all = filteredData.length;
  const deleted = msShow === "deleted";
  bar.innerHTML = `<span class="md-rec__bulkcount"><b>${n.toLocaleString()}</b> selected</span>
    ${n < all ? `<button type="button" class="md-rec__link" onclick="msSelectAllMatching()">Select all ${all.toLocaleString()} matching</button>` : ""}
    ${n ? `<button type="button" class="md-rec__link" onclick="msSelectClear()">Clear</button>` : ""}
    <span class="md-rec__bulkacts">
      ${deleted ? `<button type="button" class="btn-edit" ${n ? "" : "disabled"} onclick="msRestore([...msSel])">↩ Restore</button>`
                : `${recordType !== "staff" ? `<button type="button" class="btn-delete ms-left" ${n ? "" : "disabled"} onclick="msBulkLeft()">🚪 Left</button>` : ""}
                   <button type="button" class="btn-delete" ${n ? "" : "disabled"} onclick="msBulkDelete()">Delete</button>`}
      <button type="button" class="md-rec__donebtn" onclick="msSelectDone()">Done</button>
    </span>`;
  msMeasureBar();
}
function msSelNames() {
  return [...msSel].map(id => { const s = students.find(x => String(x[idKey]) === id); return s && s.Name ? `${id} ${s.Name}` : id; });
}
async function msBulkRun(label, ids, one) {
  let ok = 0; const failed = [];
  for (let i = 0; i < ids.length; i++) {
    showToast(`${label} ${i + 1} of ${ids.length}…`, "info");
    let r = null; try { r = await one(ids[i]); } catch (e) { r = null; }
    if (r) ok++; else failed.push(ids[i]);
  }
  return { ok, failed };
}
async function msBulkLeft() {
  if (msPastBlocked() || !msSel.size) return;
  const ids = [...msSel], names = msSelNames();
  if (!confirm(`Mark ${ids.length} student${ids.length > 1 ? "s" : ""} as Left?\n\n${names.slice(0, 8).join("\n")}${names.length > 8 ? "\n…and " + (names.length - 8) + " more" : ""}\n\nNothing is deleted: ↩ Re-admit brings them back with the same ID.`)) return;
  const res = await msBulkRun("Marking Left", ids, async id => { const r = await postToApi({ action: "markStudentLeft", school, student_id: id }); return r && r.status === "left"; });
  showToast(res.failed.length ? `${res.ok} marked Left; NOT done: ${res.failed.join(", ")}` : `${res.ok} marked Left`, res.failed.length ? "error" : "success");
  msSel = new Set(res.failed);
  await loadStudents(true);
  msRenderBulk();
}
async function msBulkDelete() {
  if (msPastBlocked() || !msSel.size) return;
  const ids = [...msSel], names = msSelNames(), staff = recordType === "staff";
  if (!confirm(`Delete ${ids.length} ${staff ? "staff" : "student" + (ids.length > 1 ? "s" : "")}?\n\n${names.slice(0, 8).join("\n")}${names.length > 8 ? "\n…and " + (names.length - 8) + " more" : ""}\n\nThey are removed from all lists, printing and exports (they can be restored from Deleted).`)) return;
  const res = await msBulkRun("Deleting", ids, async id => {
    const r = staff ? await deleteStaff(school, id)
                    : await (await fetch(`${API_URL}?action=deleteStudent&school=${encodeURIComponent(school)}&student_id=${encodeURIComponent(id)}`)).json();
    return r && !r.error;
  });
  showToast(res.failed.length ? `${res.ok} deleted; NOT deleted: ${res.failed.join(", ")}` : `${res.ok} deleted`, res.failed.length ? "error" : "success");
  msSel = new Set(res.failed);
  await loadStudents(true);
  msRenderBulk();
}

/* ── photo: open large (cards, panel); Photo ▾ in the panel: Upload / Take photo / Remove ── */
function msZoom(id) {
  const s = students.find(x => String(x[idKey]) === String(id));
  if (!s || !s.Photo_Link) return;
  if (msPanelId !== String(id) || document.getElementById("mdRecPanel")?.hidden) msOpenPanel(id);   // the large photo lives in the panel
  const p = document.getElementById("mdRecPanel");
  if (!p) return;
  msZoomClose();
  const z = document.createElement("div");
  z.id = "mdRecZoom"; z.className = "md-rec__pzoom"; z.setAttribute("role", "dialog"); z.setAttribute("aria-label", "Photo of " + msVal(s.Name));
  z.innerHTML = `<button type="button" class="md-rec__pclose" onclick="msZoomClose()" aria-label="Close the photo">✖</button>
    <img src="${msEsc(getPhotoUrl(s.Photo_Link, "w_800,h_1000,c_limit"))}" alt="Photo of ${msEsc(msVal(s.Name))}">
    <div class="md-rec__pzoomcap">${msEsc(msVal(s.Name))} · ${msEsc(msVal(s[idKey]))}</div>`;
  z.addEventListener("click", e => { if (e.target === z || e.target.tagName === "IMG") msZoomClose(); });
  p.appendChild(z);
  z.querySelector("button").focus();
}
function msZoomClose() { const z = document.getElementById("mdRecZoom"); if (z) z.remove(); }
function msPhotoMenuButton(s) {
  if (msShow !== "in" || msPastSession()) return "";
  return `<button type="button" class="md-rec__photobtn" onclick="msOpenPhotoMenu(this, ${msEsc(JSON.stringify(String(s[idKey])))})" aria-haspopup="menu" aria-expanded="false">Photo ▾</button>`;
}
function msOpenPhotoMenu(btn, id) {
  const already = btn.getAttribute("aria-expanded") === "true";
  msCloseRowMenu();
  if (already) return;
  const s = students.find(x => String(x[idKey]) === String(id));
  const m = document.createElement("div");
  m.id = "mdRecMenu"; m.className = "md-rec__menu"; m.setAttribute("role", "menu");
  msPhotoFor = String(id);
  m.innerHTML = `<button type="button" class="md-rec__menuitem" role="menuitem" onclick="msPhotoPick('mdRecPhotoUp')">⬆ Upload photo</button>
    <button type="button" class="md-rec__menuitem" role="menuitem" onclick="msPhotoPick('mdRecPhotoCam')">📷 Take photo</button>
    ${s && s.Photo_Link ? `<button type="button" class="md-rec__menuitem md-rec__menuitem--danger" role="menuitem" onclick="msPhotoRemove(${msEsc(JSON.stringify(String(id)))})">🗑 Remove photo</button>` : ""}`;
  m.addEventListener("click", e => e.stopPropagation());
  document.body.appendChild(m);
  btn.setAttribute("aria-expanded", "true");
  const r = btn.getBoundingClientRect();
  m.style.left = Math.max(8, r.left) + "px";
  m.style.top = (r.bottom + 4) + "px";
}
// the file boxes live outside the menu, so closing the menu never loses the chosen file
let msPhotoFor = null;
function msPhotoPick(inputId) {
  let inp = document.getElementById(inputId);
  if (!inp) {
    inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.id = inputId; inp.hidden = true;
    if (inputId === "mdRecPhotoCam") inp.setAttribute("capture", "user");
    inp.onchange = () => { const f = inp.files && inp.files[0]; const id = msPhotoFor; inp.value = ""; if (f && id) msPhotoChosen(id, f); };
    document.body.appendChild(inp);
  }
  msCloseRowMenu();
  inp.click();
}
async function msPhotoChosen(id, file) {
  if (!file) return;
  const s = students.find(x => String(x[idKey]) === String(id));
  showToast("Uploading photo…", "info");
  try {
    await replacePhotoSafely(file, sessionStorage.getItem("school_id"), school, id, s ? s.Photo_Link || "" : "", recordType === "staff");
    showToast("Photo saved", "success");
  } catch (err) {
    showToast("Photo NOT saved: " + (err.message || "upload failed"), "error");
    return;
  }
  await loadStudents(true);
  msFlash(id);
}
async function msPhotoRemove(id) {
  msCloseRowMenu();
  const s = students.find(x => String(x[idKey]) === String(id));
  if (!s || !s.Photo_Link) return;
  if (!confirm(`Remove the photo of ${id} ${msVal(s.Name)}?\n\nThe photo file is deleted too.`)) return;
  const old = String(s.Photo_Link);
  let r = null;
  try { r = recordType === "staff" ? await saveStaffPhotoLink(school, id, "") : await savePhotoLink(school, id, ""); } catch (e) { r = null; }
  if (!r || r.error) { showToast("Photo NOT removed: " + ((r && r.error) || "no answer from the server"), "error"); return; }
  const pid = old.split("|")[0];
  if (pid) { try { await deleteCloudinaryPhoto(pid); } catch (e) { /* the file stays: harmless */ } }
  showToast("Photo removed", "success");
  await loadStudents(true);
}

/* ── possible duplicates: same name + class + father's name (or DOB when there is no father field) ── */
function msDupsOf(s) {
  if (!msDupCache) {
    msDupCache = new Map();
    const father = headersGlobal.find(h => /father/i.test(String(h)));
    const third = father || msDobHeader();
    const norm = v => msVal(v).toLowerCase().replace(/[^a-z0-9]/g, "");
    const groups = new Map();
    students.forEach(x => {
      const n = norm(x.Name);
      if (!n) return;
      const k = n + "|" + (recordType === "staff" ? norm(x.Designation) : norm(x.Class)) + "|" + (third ? norm(x[third]) : "");
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(String(x[idKey]));
    });
    groups.forEach(ids => { if (ids.length > 1) ids.forEach(id => msDupCache.set(id, ids.filter(o => o !== id))); });
  }
  return msDupCache.get(String(s[idKey])) || [];
}

// Esc closes the large photo first
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.getElementById("mdRecZoom")) { e.stopImmediatePropagation(); msZoomClose(); }
}, true);

/* P2b.6: a photo chosen in the edit popup shows at once in its small picture (before Save) */
document.addEventListener("change", e => {
  const inp = e.target;
  if (!inp || inp.id !== "edit_photo_file" || !inp.files || !inp.files[0]) return;
  const wrap = inp.closest(".photo-upload-wrap");
  if (!wrap || typeof URL === "undefined" || !URL.createObjectURL) return;
  let img = wrap.querySelector("img");
  if (!img) {
    img = document.createElement("img"); img.alt = "New photo";
    const none = wrap.querySelector(".no-photo-label"); if (none) none.replaceWith(img); else wrap.insertBefore(img, inp);
  }
  img.src = URL.createObjectURL(inp.files[0]);
  img.title = inp.files[0].name;
});

