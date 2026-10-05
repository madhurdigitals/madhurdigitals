const API_URL = "https://script.google.com/macros/s/AKfycbytZo8tG54g4sAlcKSmL7VPEQ_I1uNILLcOB9tsUjRqHGNGqKxjv4w82-rcNU8W-H_xTg/exec";
let schoolsData = [];

/* Adds the login token to every request that goes to the backend (API_URL), so no page
   has to remember to send it. Other URLs (Cloudinary etc.) are left alone. */
(function () {
  if (window.__apiFetchWrapped) return;
  window.__apiFetchWrapped = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    let isApi = false;
    try {
      const url = (typeof input === "string") ? input : (input && input.url);
      isApi = !!(url && url.indexOf(API_URL) === 0);
      // This tab is still borrowing the login from another tab (it reloads in a moment) - send nothing.
      if (isApi && window.__mdSessionPending) return new Promise(() => {});
      if (isApi && url.indexOf("token=") === -1) {
        const token = sessionStorage.getItem("token");
        if (token) {
          const newUrl = url + (url.indexOf("?") === -1 ? "?" : "&") + "token=" + encodeURIComponent(token);
          input = (typeof input === "string") ? newUrl : new Request(newUrl, input);
        }
      }
    } catch (err) {
      // never block a request because of this helper
    }
    const answer = originalFetch(input, init);
    if (!isApi) return answer;

    // Peek at the backend's answer (on a copy - the page still reads the original).
    // If it says the session is over, offer to log in again right here.
    return answer.then(res => {
      try {
        if (res && res.type !== "opaque" && typeof res.clone === "function") {
          res.clone().json().then(d => {
            if (d && SESSION_ERRORS.indexOf(d.auth_error) !== -1) showSessionExpired();
          }).catch(() => {});
        }
      } catch (err) { /* never break the page because of this */ }
      return res;
    });
  };
})();

/* ========================= */
/* SESSION EXPIRED -> LOG IN AGAIN ON THE SAME PAGE            */
/* Nothing typed on the page is lost: the box sits on top, the  */
/* person enters their password, and carries on (e.g. Retry).   */
/* ========================= */
const SESSION_ERRORS = ["no_token", "invalid_token", "expired_token"];

// True when an answer means "the session is over" - the log-in box handles those, pages need not.
function isSessionError(res) {
  return !!(res && SESSION_ERRORS.indexOf(res.auth_error) !== -1);
}
let sessionBoxOpen = false;

function showSessionExpired() {
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (sessionBoxOpen || page === "login.html" || page === "index.html" || page === "") return;
  sessionBoxOpen = true;
  window.__mdSessionDead = true;   // this tab's login has ended - it won't be handed to other tabs

  // Another tab of this browser may already have logged in again: use that login, no box needed.
  if (typeof window.__mdFindWorkingSession === "function") {
    window.__mdFindWorkingSession(() => { /* mdsessionadopted handles the rest */ }, buildSessionBox);
    return;
  }
  buildSessionBox();
}

// A working login arrived from another tab (or was found there): close the box and carry on.
if (window.addEventListener) window.addEventListener("mdsessionadopted", () => {
  const b = document.getElementById("sessionExpiredBox");
  if (b) b.remove();
  sessionBoxOpen = false;
  window.__mdSessionDead = false;
  try { window.dispatchEvent(new Event("sessionrestored")); } catch (err) {}
  // A page opened in the last few seconds has nothing typed yet: simply load it again with the login.
  if (typeof performance !== "undefined" && performance.now() < 15000) location.reload();
});

function buildSessionBox() {
  if (document.getElementById("sessionExpiredBox")) return;

  const user = sessionStorage.getItem("username") || "";
  const box  = document.createElement("div");
  box.id = "sessionExpiredBox";
  box.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif;">
      <div style="background:#fff;border-radius:14px;padding:24px;width:360px;max-width:92%;box-shadow:0 10px 40px rgba(0,0,0,.25);">
        <h3 style="margin:0 0 6px;color:#b45309;">🔒 Session expired</h3>
        <p style="font-size:13px;color:#374151;margin:0 0 14px;line-height:1.5;">
          Please log in again to continue. Nothing on this page is lost.
        </p>
        <input id="seUser" placeholder="Username" autocomplete="username"
          style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:10px;border:1px solid #d1d5db;border-radius:7px;font-size:14px;">
        <input id="sePass" type="password" placeholder="Password" autocomplete="current-password"
          style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px;border:1px solid #d1d5db;border-radius:7px;font-size:14px;">
        <div id="seError" style="display:none;color:#b91c1c;font-size:13px;margin-bottom:8px;"></div>
        <button id="seLogin" type="button"
          style="width:100%;padding:11px;border:none;border-radius:8px;background:#0d6efd;color:#fff;font-size:14px;cursor:pointer;">Log in</button>
        <button id="seLeave" type="button"
          style="width:100%;padding:9px;margin-top:8px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;font-size:13px;cursor:pointer;">Go to the login page instead</button>
      </div>
    </div>`;
  document.body.appendChild(box);

  const userEl = document.getElementById("seUser");
  const passEl = document.getElementById("sePass");
  userEl.value = user;
  if (user) { userEl.readOnly = true; userEl.style.background = "#f3f4f6"; }
  (user ? passEl : userEl).focus();

  const errorEl = document.getElementById("seError");
  const btn     = document.getElementById("seLogin");

  async function relogin() {
    if (btn.disabled) return;
    if (typeof login !== "function") { leave(); return; }
    const u = userEl.value.trim(), p = passEl.value;
    if (!u || !p) { errorEl.textContent = "Enter your password"; errorEl.style.display = "block"; return; }
    btn.disabled = true; btn.textContent = "Logging in…";
    // login() resets the selected school; keep the page's school so the work continues where it was
    const keep = {};
    ["school", "school_id", "school_name", "custom_school"].forEach(k => { keep[k] = sessionStorage.getItem(k); });
    const r = await login(u, p);
    btn.disabled = false; btn.textContent = "Log in";
    if (!r || !r.success) {
      errorEl.textContent = (r && r.error) || "Login failed";
      errorEl.style.display = "block";
      return;
    }
    Object.keys(keep).forEach(k => { if (keep[k] !== null) sessionStorage.setItem(k, keep[k]); });
    passEl.value = "";
    box.remove();
    sessionBoxOpen = false;
    window.__mdSessionDead = false;
    // Pages can listen for this to reload what failed to load (e.g. a list)
    try { window.dispatchEvent(new Event("sessionrestored")); } catch (err) {}
  }
  function leave() {
    sessionStorage.clear();
    localStorage.removeItem("isLoggedIn");
    location.href = "login.html";
  }

  btn.onclick = relogin;
  passEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); relogin(); } });
  document.getElementById("seLeave").onclick = leave;
}
/**
 * ✅ ADD STUDENT (using GET to avoid CORS)
 */
async function addSchool(data) {
  try {
    const params = new URLSearchParams({
      action:      "addSchool",
      school:      data.school,
      school_name: data.school_name,
      school_id:   data.school_id || "",
      address:     data.address,
      contact:     data.contact,
      fields:      data.fields,
      template:    data.template,
      logo:        data.logo,
      card_color:  data.card_color,
      permissions: data.permissions || "add,manage,print,form",  // 🔥 new
      vendor_id:   data.vendor_id || "",  // blank = Madhur Digitals (vendor 1)
      new_login_password: data.new_login_password || ""   // "generate" = strong password, shown once
    });

    const url = `${API_URL}?${params.toString()}`;

    console.log("Add School URL:", url);

    const res    = await fetch(url);
    const result = await res.json();

    console.log("Add School Result:", result);

    // 🔥 Clear schools cache so dashboard reloads fresh
    sessionStorage.removeItem("schoolsCache");

    return result;

  } catch (error) {
    console.error("Add School Error:", error);
    alert("Failed to add school");
  }
}

/* ADD STUDENT */
async function addStudent(data) {
  try {
    const params = new URLSearchParams({
      action: "addStudent",
      ...data
    });

    const url = `${API_URL}?${params.toString()}`;
    console.log("Add URL:", url);

    const res    = await fetch(url);
    const result = await res.json();

    return result;

  } catch (error) {
    console.error("Add Student Error:", error);
    alert("Failed to add student");
  }
}

/**
 * ✅ GET STUDENTS (CORS SAFE)
 */
async function getStudents(school) {
  try {
    const url = `${API_URL}?action=getStudents&school=${encodeURIComponent(school)}`;

    console.log("Fetch URL:", url);

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    const data = await res.json();

    console.log("Students:", data);

    // Pages expect a list (header row + students). An error answer becomes an empty list,
    // so no page crashes; a session error has already opened the "log in again" box.
    if (!Array.isArray(data)) {
      console.error("getStudents error:", data && (data.error || data));
      return [[]];
    }

    return data;

  } catch (error) {
    console.error("Fetch Error:", error);
    alert("Failed to fetch students");
    return [];
  }
}

/* ========================= */
/* ===== SCHOOL APIs ======= */
/* ========================= */

/* GET SCHOOLS */

function getSchools(forceRefresh = false) {
  return new Promise((resolve, reject) => {
    if (window.__mdSessionPending) return;   // this tab reloads in a moment with the borrowed login

    const cached = sessionStorage.getItem("schoolsCache"); // 🔥 renamed

    if (cached && !forceRefresh) {
      console.log("Using session cached schools");
      resolve(JSON.parse(cached));
      return;
    }

    const callbackName = "jsonpCallback_" + Date.now();

    window[callbackName] = function(data) {
      console.log("Schools (API):", data);
      if (data && !Array.isArray(data) && (data.error || data.auth_error)) {
        // An error is never cached (it would break every page until logout).
        if (SESSION_ERRORS.indexOf(data.auth_error) !== -1) showSessionExpired();
        resolve([[]]);   // "no schools" shape, so pages don't crash
        delete window[callbackName];
        return;
      }
      // School codes can be numbers in the sheet (e.g. 224145) but pages compare them as text.
      // Turning the "school" column into text here fixes that for every page at once.
      try {
        const sIdx = Array.isArray(data[0]) ? data[0].indexOf("school") : -1;
        if (sIdx !== -1) {
          data.forEach((row, i) => {
            if (i > 0 && row[sIdx] !== null && row[sIdx] !== undefined && row[sIdx] !== "") row[sIdx] = String(row[sIdx]);
          });
        }
      } catch (err) { /* never block loading the schools */ }
      sessionStorage.setItem("schoolsCache", JSON.stringify(data)); // 🔥 renamed
      resolve(data);
      delete window[callbackName];
    };

    const script = document.createElement("script");
    const _token = sessionStorage.getItem("token");
    script.src = `${API_URL}?action=getSchools&callback=${callbackName}` +
                 (_token ? `&token=${encodeURIComponent(_token)}` : "");
    script.onerror = function() {
      reject("JSONP failed");
      delete window[callbackName];
    };
    document.body.appendChild(script);
  });
}

function attachDOBFormatterAll() {
  const inputs = document.querySelectorAll('input[id*="dob"]');

  inputs.forEach(input => {

    // ✅ Skip if already wired up (prevents duplicate listeners)
    if (input.dataset.dobBound === "1") return;
    input.dataset.dobBound = "1";

    // ✅ Allow only numbers (max 8)
    input.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 8);
      this.style.border = ""; // reset while typing
    });

    // 🔥 VALIDATION ON BLUR
    input.addEventListener("blur", function () {

      const value = this.value;

      // ❌ INVALID
      if (value.length !== 8) {
        this.style.border = "2px solid red";

        // optional toast (clean UX)
        if (value.length > 0) {
          showToast("Enter valid DOB (DDMMYYYY)");
        }

        return;
      }

      // ✅ VALID → FORMAT
      const day = value.substring(0, 2);
      const month = value.substring(2, 4);
      const year = value.substring(4, 8);

      this.value = `${day}/${month}/${year}`;
      this.style.border = "";
    });

  });
}

function attachPhoneValidation() {
  const inputs = document.querySelectorAll('input[id*="phone"], input[id*="contact"]');

  inputs.forEach(input => {

    // ✅ Skip if already wired up (prevents duplicate listeners)
    if (input.dataset.phoneBound === "1") return;
    input.dataset.phoneBound = "1";

    // ✅ Only digits, max 10
    input.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 10);
      this.style.border = ""; // reset while typing
    });

    // 🔥 VALIDATE ON BLUR
    input.addEventListener("blur", function () {
      const value = this.value;

      if (value.length !== 10) {
        this.style.border = "2px solid red";

        if (value.length > 0) {
          showToast("Enter valid 10-digit number");
        }
      } else {
        this.style.border = "";
      }
    });

  });
}

function attachAutoExpand() {
  const textareas = document.querySelectorAll("textarea");

  textareas.forEach(t => {
    t.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    });
  });
}

function attachEnterNavigation() {
  const inputs = document.querySelectorAll(
    "#dynamicForm input, #dynamicForm select, #dynamicForm textarea"
  );

  inputs.forEach((el, index) => {
    el.addEventListener("keydown", function (e) {

      // 🔥 ONLY handle Enter for INPUT fields (not textarea)
      if (e.key === "Enter" && el.tagName !== "TEXTAREA") {

        e.preventDefault();

        const next = inputs[index + 1];

        if (next) {
          next.focus();
        }
      }

    });
  });
}

/* ========================= */
/* PHOTO UPLOAD (Cloudinary) */
/* ========================= */

const CLOUDINARY_CLOUD_NAME = "ybh8palr";
const CLOUDINARY_UPLOAD_PRESET = "student_photos";

async function uploadPhotoToCloudinary(file, schoolId, studentId) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("public_id", `madhur_digitals/school_${schoolId}/${studentId}`);
  formData.append("folder", `madhur_digitals/school_${schoolId}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  const data = await res.json();
  if (data.public_id) return `${data.public_id}|${data.version}`;   // 🔥 store public_id + version together
  throw new Error((data.error && data.error.message) || "Photo upload failed");
}

function getPhotoUrl(photoLink, transform = "w_150,h_150,c_fill") {
  if (!photoLink) return "";
  const [publicId, version] = photoLink.split("|");
  const versionPart = version ? `v${version}/` : "";
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transform}/${versionPart}${publicId}.jpg`;
}

async function savePhotoLink(school, studentId, photoLink) {
  const params = new URLSearchParams({
    action: "updatePhoto",
    school: school,
    student_id: studentId,
    photo_link: photoLink
  });
  const res = await fetch(`${API_URL}?${params.toString()}`);
  return await res.json();
}

async function deleteCloudinaryPhoto(publicId) {
  const params = new URLSearchParams({
    action: "deletePhoto",
    public_id: publicId
  });
  const res = await fetch(`${API_URL}?${params.toString()}`);
  return await res.json();
}

/* ========================= */
/* USER MANAGEMENT APIs      */
/* Append these to api.js    */
/* ========================= */

async function getUsers() {
  try {
    const url = `${API_URL}?action=getUsers`;
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    console.error("getUsers error:", err);
    return { error: "Failed to fetch users" };
  }
}

// Sent by POST (plain text body, like login) so the password is never part of a URL.
async function postToApi(body) {
  const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(body) });
  return await res.json();
}

async function addUser(data) {
  try {
    return await postToApi({
      action:      "addUser",
      username:    data.username,
      password:    data.password,
      role:        data.role,
      school:      data.school,
      permissions: data.permissions,
      vendor_id:         data.vendor_id || "",          // vendor login / vendor staff (blank = Madhur Digitals)
      generate_password: data.generate_password ? "1" : "",
      override_limit:    data.override_limit ? "1" : ""
    });
  } catch (err) {
    console.error("addUser error:", err);
    return { error: "Failed to add user" };
  }
}

async function updateUser(data) {
  try {
    return await postToApi({
      action:          "updateUser",
      target_username: data.target_username,
      password:        data.password    || "",
      role:            data.role        || "",
      school:          data.school      || "",
      permissions:     data.permissions || "",
      vendor_id:       data.vendor_id   || "",
      override_limit:  data.override_limit ? "1" : ""
    });
  } catch (err) {
    console.error("updateUser error:", err);
    return { error: "Failed to update user" };
  }
}

async function toggleUser(username) {
  try {
    const params = new URLSearchParams({
      action:          "toggleUser",
      target_username: username
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    return await res.json();
  } catch (err) {
    console.error("toggleUser error:", err);
    return { error: "Failed to toggle user" };
  }
}

async function deleteUser(username) {
  try {
    const params = new URLSearchParams({
      action:          "deleteUser",
      target_username: username
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    return await res.json();
  } catch (err) {
    console.error("deleteUser error:", err);
    return { error: "Failed to delete user" };
  }
}

// Admin only: archive a user (can't log in, moved to Archived) / restore an archived user (as inactive)
async function archiveUser(username) {
  try {
    const params = new URLSearchParams({ action: "archiveUser", target_username: username });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    return await res.json();
  } catch (err) {
    console.error("archiveUser error:", err);
    return { error: "Failed to archive user" };
  }
}

async function unarchiveUser(username, overrideLimit, activate) {
  try {
    const params = new URLSearchParams({ action: "unarchiveUser", target_username: username,
                                         override_limit: overrideLimit ? "1" : "", activate: activate ? "1" : "" });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    return await res.json();
  } catch (err) {
    console.error("unarchiveUser error:", err);
    return { error: "Failed to restore user" };
  }
}

// password blank = the server generates one. The new password comes back ONCE in the answer.
async function resetUserPassword(username, password) {
  try {
    return await postToApi({ action: "resetUserPassword", target_username: username, password: password || "" });
  } catch (err) {
    console.error("resetUserPassword error:", err);
    return { error: "Failed to reset password" };
  }
}


/* ========================= */
/* TEMPLATE BUILDER ASSETS   */
/* ========================= */

async function uploadTemplateAsset(file, label) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("public_id", `madhur_digitals/template_assets/${label}_${Date.now()}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  const data = await res.json();
  if (data.public_id) return `${data.public_id}|${data.version}`;
  throw new Error((data.error && data.error.message) || "Background upload failed");
}


/* ========================= */
/* VENDOR APIs               */
/* ========================= */

// List of all vendors. Allowed for the super admin and users with the "schools" permission.
async function getVendors() {
  try {
    const res = await fetch(`${API_URL}?action=getVendors`);
    return await res.json();
  } catch (err) {
    console.error("getVendors error:", err);
    return { error: "Failed to fetch vendors" };
  }
}

// Super admin only. Blank slug = made from the name. Blank brand_color = default blue.
async function addVendor(data) {
  try {
    const params = new URLSearchParams({
      action:      "addVendor",
      name:        data.name        || "",
      contact:     data.contact     || "",
      phone:       data.phone       || "",
      email:       data.email       || "",
      slug:        data.slug        || "",
      logo:        data.logo        || "",
      brand_color: data.brand_color || "",
      max_users:   data.max_users   || "",
      white_label: data.white_label || ""
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    return await res.json();
  } catch (err) {
    console.error("addVendor error:", err);
    return { error: "Failed to add vendor" };
  }
}

// Super admin only. Sends ONLY the fields present in data, so anything left out stays unchanged.
async function updateVendor(data) {
  try {
    const params = new URLSearchParams({ action: "updateVendor", vendor_id: data.vendor_id });
    ["name", "contact", "phone", "email", "slug", "logo", "brand_color", "max_users", "white_label"].forEach(k => {
      if (data[k] !== undefined) params.append(k, data[k]);
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    return await res.json();
  } catch (err) {
    console.error("updateVendor error:", err);
    return { error: "Failed to update vendor" };
  }
}

// Super admin only. status = "active" or "suspended". Vendor 1 cannot be suspended.
async function setVendorStatus(vendorId, status) {
  try {
    const params = new URLSearchParams({ action: "setVendorStatus", vendor_id: vendorId, status: status });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    return await res.json();
  } catch (err) {
    console.error("setVendorStatus error:", err);
    return { error: "Failed to change vendor status" };
  }
}

// Super admin only. Moves all the vendor's schools to moveToId (blank = Unassigned Schools),
// deactivates its users, and marks it archived.
async function archiveVendor(vendorId, moveToId) {
  try {
    const params = new URLSearchParams({ action: "archiveVendor", vendor_id: vendorId, move_to: moveToId || "" });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    return await res.json();
  } catch (err) {
    console.error("archiveVendor error:", err);
    return { error: "Failed to archive vendor" };
  }
}

// Super admin only. schoolIds / usernames = the ones ticked to bring back (arrays, may be empty).
async function restoreVendor(vendorId, schoolIds, usernames) {
  try {
    const params = new URLSearchParams({
      action:     "restoreVendor",
      vendor_id:  vendorId,
      move_back:  (schoolIds || []).join(","),
      reactivate: (usernames || []).join(",")
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    return await res.json();
  } catch (err) {
    console.error("restoreVendor error:", err);
    return { error: "Failed to restore vendor" };
  }
}


/* ========================= */
/* VENDOR BRANDING           */
/* ========================= */
// Level A (after login): a vendor's people see the vendor's name, logo and colour instead of
// Madhur Digitals, with "Powered by Madhur Digitals" in the corner.
// Level B (before login): login.html?v=<web name> shows the same on the login page.

function brandSafeLogo(u) {
  const s = String(u || "").trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : "";      // only plain https image links
}
function brandSafeColor(c) {
  return /^#[0-9a-fA-F]{6}$/.test(String(c || "")) ? String(c) : "#0d6efd";
}

function applyBrand(brand) {
  if (!brand || !brand.name || document.getElementById("brandStyle")) return;
  const color = brandSafeColor(brand.color);

  const style = document.createElement("style");
  style.id = "brandStyle";
  style.textContent = `
    nav { border-top: 4px solid ${color} !important; }
    .title-text, .nav-title-main, .login-card h2, nav .logo { color: ${color} !important; }
    .login-btn { background: ${color} !important; }
    .md-powered { position: fixed; right: 10px; bottom: 8px; z-index: 50; font-size: 11px; color: #6b7280;
                  background: rgba(255,255,255,.92); padding: 3px 9px; border-radius: 10px;
                  box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .md-powered a { color: inherit; text-decoration: none; }`;
  document.head.appendChild(style);

  // the name, wherever the page shows "Madhur Digitals" as its title
  document.querySelectorAll(".title-text, .nav-title-main, .login-card h2, nav .logo").forEach(el => {
    if (el.children.length === 0 && el.textContent.trim() === "Madhur Digitals") el.textContent = brand.name;
  });
  document.title = document.title.replace("Madhur Digitals", brand.name);

  // the logo (only if the vendor has one; otherwise the usual icon stays)
  const logo = brandSafeLogo(brand.logo);
  if (logo) {
    document.querySelectorAll(".logo img, .nav-logo img").forEach(img => {
      const original = img.src;
      img.onerror = () => { img.onerror = null; img.src = original; };   // broken link -> usual icon
      img.src = logo;
      img.alt = brand.name;
    });
  }

  // footer: "© year Vendor | Powered by Madhur Digitals" (linked) - or only the vendor for white-label
  const whiteLabel = brand.white_label === true;
  let footerDone = false;
  document.querySelectorAll("footer").forEach(f => {
    if (f.textContent.includes("Madhur Digitals")) {
      f.textContent = "© " + new Date().getFullYear() + " " + brand.name;
      if (!whiteLabel) { f.appendChild(document.createTextNode(" | ")); f.appendChild(poweredByLink()); }
      appendLegalLinks(f);
      footerDone = true;
    }
  });
  if (!footerDone && !whiteLabel) {
    const powered = document.createElement("div");
    powered.className = "md-powered";
    powered.appendChild(poweredByLink());
    document.body.appendChild(powered);
  }

  // no way back to Madhur Digitals' own homepage from a vendor's pages
  const loggedIn = !!sessionStorage.getItem("token");
  document.querySelectorAll(".nav-brand, nav .logo").forEach(el => {
    el.onclick = loggedIn ? () => { location.href = "dashboard.html"; } : null;
    el.style.cursor = loggedIn ? "pointer" : "default";
  });
  document.querySelectorAll("nav .nav-btn").forEach(b => {
    if (b.textContent.trim() === "Home") b.style.display = "none";
  });

  revealBrandedPage();
}

// "Powered by Madhur Digitals" - attribution linking to the Madhur Digitals website (new tab)
const POWERED_BY_URL = "https://madhurdigitals.com/";
function poweredByLink() {
  const span = document.createElement("span");
  span.appendChild(document.createTextNode("Powered by "));
  const a = document.createElement("a");
  a.href = POWERED_BY_URL; a.target = "_blank"; a.rel = "noopener";
  a.textContent = "Madhur Digitals";
  a.style.color = "inherit"; a.style.fontWeight = "600";
  span.appendChild(a);
  return span;
}

// Privacy / Terms: add the pages here when they exist - they show even for white-label vendors,
// so schools always know who processes their data. e.g. [["Privacy", "https://madhurdigitals.com/privacy.html"]]
const LEGAL_LINKS = [];
function appendLegalLinks(el) {
  LEGAL_LINKS.forEach(([label, url]) => {
    el.appendChild(document.createTextNode(" · "));
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener"; a.textContent = label; a.style.color = "inherit";
    el.appendChild(a);
  });
}

// Login link (?v=...): keep the card hidden until we know whose page it is - no "Madhur Digitals" flash
function revealBrandedPage() {
  const st = document.getElementById("brandPending");
  if (st) st.remove();
}

async function initBranding() {
  // Level A: logged in as one of a vendor's people
  try {
    const saved = JSON.parse(sessionStorage.getItem("brand") || "null");
    if (saved && saved.name) { applyBrand(saved); return; }
  } catch (err) { /* no brand */ }

  // Level B: the login page opened with ?v=<web name>
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  const slug = new URLSearchParams(location.search).get("v");
  if (page !== "login.html" || !slug) { revealBrandedPage(); return; }

  const cacheKey = "brandCache_" + slug.toLowerCase();
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(cacheKey) || "null"); } catch (err) { cached = null; }
  if (cached && cached.name) applyBrand(cached);              // repeat visit: instant

  try {
    const res  = await fetch(`${API_URL}?action=getBranding&v=${encodeURIComponent(slug)}`);
    const data = await res.json();
    if (data && data.status === "success" && data.brand) {
      try { localStorage.setItem(cacheKey, JSON.stringify(data.brand)); } catch (err) {}
      if (!cached) applyBrand(data.brand);                    // a change shows on the next visit
    } else {
      try { localStorage.removeItem(cacheKey); } catch (err) {}
    }
  } catch (err) { /* offline: whatever we have */ }
  revealBrandedPage();                                        // no brand -> the normal page
}

// While a ?v= login page works out its brand, hide the parts that would say "Madhur Digitals".
(function hideUntilBranded() {
  try {
    if (typeof document === "undefined" || !document.head) return;
    const page = (location.pathname.split("/").pop() || "").toLowerCase();
    if (page !== "login.html" || !new URLSearchParams(location.search).get("v")) return;
    const st = document.createElement("style");
    st.id = "brandPending";
    st.textContent = ".login-card, nav .logo, nav .nav-btn, footer { visibility: hidden !important; }";
    document.head.appendChild(st);
    setTimeout(revealBrandedPage, 4000);                      // never leave the page hidden
  } catch (err) { /* show the page as it is */ }
})();

if (typeof document !== "undefined" && document.addEventListener) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBranding);
  else initBranding();
}