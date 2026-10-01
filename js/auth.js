/* ========================= */
/* auth.js — RBAC Auth       */
/* ========================= */

async function login(username, password) {
  try {
    // POST: the password travels in the request body, not in the URL.
    // No Content-Type header on purpose - plain text avoids the browser's pre-check
    // (preflight), which Apps Script cannot answer. The server still reads it as JSON.
    const res  = await fetch(API_URL, {
      method: "POST",
      body:   JSON.stringify({ action: "login", username: username, password: password })
    });
    const data = await res.json();

    if (data.error) return { success: false, error: data.error };

    sessionStorage.setItem("token",       data.token);
    sessionStorage.setItem("username",    data.username);
    sessionStorage.setItem("role",        data.role);
    sessionStorage.setItem("schoolRaw",   data.school);
    sessionStorage.setItem("userSchools", JSON.stringify(data.schools));
    sessionStorage.setItem("permissions", JSON.stringify(data.permissions));
    sessionStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("isLoggedIn", "true");

    // Backward compat for single school
    if (data.schools !== "*" && Array.isArray(data.schools) && data.schools.length === 1) {
      sessionStorage.setItem("school", data.schools[0].name);
    } else {
      sessionStorage.setItem("school", "*");
    }

    // school: the single school name (or "*") - login.html reads result.school; it was missing before,
    // so school users ended up with the text "undefined" as their school.
    return { success: true, role: data.role, school: sessionStorage.getItem("school"),
             schools: data.schools, permissions: data.permissions };

  } catch (err) {
    return { success: false, error: "Network error. Please try again." };
  }
}

async function logout() {
  const token = sessionStorage.getItem("token");
  if (token) {
    fetch(API_URL, {
      method:    "POST",
      keepalive: true,   // lets the request finish even though the page is about to change
      body:      JSON.stringify({ action: "logout", token: token })
    }).catch(() => {});
  }
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = "index.html";
}

function getRole()        { return sessionStorage.getItem("role") || ""; }
function isAdmin()        { return getRole() === "admin"; }
function isSchoolUser()   { return getRole() === "school"; }
function getUserSchool()  { return sessionStorage.getItem("school") || "*"; }

function getPermissions() {
  try { return JSON.parse(sessionStorage.getItem("permissions") || "[]"); }
  catch { return []; }
}

function hasPermission(key) { return getPermissions().includes(key); }

// Returns "*" or array of {name, id}
function getUserSchools() {
  try {
    const s = sessionStorage.getItem("userSchools");
    if (!s) return "*";
    const p = JSON.parse(s);
    return p === "*" ? "*" : p;
  } catch { return "*"; }
}

// Returns array of school name strings or "*"
function getAccessibleSchoolNames() {
  const s = getUserSchools();
  if (s === "*") return "*";
  return s.map(x => x.name);
}