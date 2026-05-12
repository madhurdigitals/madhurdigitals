/* ========================= */
/* auth.js — RBAC Auth       */
/* ========================= */

/* LOGIN — calls Apps Script */
async function login(username, password) {
  try {
    const url = `${API_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (data.error) return { success: false, error: data.error };

    // Store everything in sessionStorage
    sessionStorage.setItem("token",       data.token);
    sessionStorage.setItem("username",    data.username);
    sessionStorage.setItem("role",        data.role);
    sessionStorage.setItem("school",      data.school);     // "*" for admin/employee
    sessionStorage.setItem("permissions", JSON.stringify(data.permissions));
    sessionStorage.setItem("isLoggedIn",  "true");

    return { success: true, role: data.role, school: data.school, permissions: data.permissions };

  } catch (err) {
    console.error("Login error:", err);
    return { success: false, error: "Network error. Please try again." };
  }
}

/* LOGOUT */
async function logout() {
  const token = sessionStorage.getItem("token");

  // Invalidate token on server (fire and forget)
  if (token) {
    fetch(`${API_URL}?action=logout&token=${encodeURIComponent(token)}`).catch(() => {});
  }

  localStorage.clear();
  sessionStorage.clear();
  window.location.href = "index.html";
}

/* HELPERS — use anywhere in the app */

function getRole() {
  return sessionStorage.getItem("role") || "";
}

function getPermissions() {
  try {
    return JSON.parse(sessionStorage.getItem("permissions") || "[]");
  } catch {
    return [];
  }
}

function hasPermission(key) {
  const permissions = getPermissions();
  return permissions.includes(key);
}

function isAdmin() {
  return getRole() === "admin";
}

function isSchoolUser() {
  return getRole() === "school";
}

// Returns the school this user is locked to ("*" means all schools)
function getUserSchool() {
  return sessionStorage.getItem("school") || "*";
}
