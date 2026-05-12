/* ========================= */
/* auth.js — RBAC Auth       */
/* ========================= */

async function login(username, password) {
  try {
    const url  = `${API_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (data.error) return { success: false, error: data.error };

    sessionStorage.setItem("token",       data.token);
    sessionStorage.setItem("username",    data.username);
    sessionStorage.setItem("role",        data.role);
    sessionStorage.setItem("schoolRaw",   data.school);
    sessionStorage.setItem("userSchools", JSON.stringify(data.schools));
    sessionStorage.setItem("permissions", JSON.stringify(data.permissions));
    sessionStorage.setItem("isLoggedIn",  "true");

    // Backward compat for single school
    if (data.schools !== "*" && Array.isArray(data.schools) && data.schools.length === 1) {
      sessionStorage.setItem("school", data.schools[0].name);
    } else {
      sessionStorage.setItem("school", "*");
    }

    return { success: true, role: data.role, schools: data.schools, permissions: data.permissions };

  } catch (err) {
    return { success: false, error: "Network error. Please try again." };
  }
}

async function logout() {
  const token = sessionStorage.getItem("token");
  if (token) fetch(`${API_URL}?action=logout&token=${encodeURIComponent(token)}`).catch(() => {});
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
