/* ========================= */
/* protect.js — RBAC Guard   */
/* ========================= */

(function () {

  const publicPages = ["index.html", "login.html"];

  // Map each page to the permission key it requires
  const pagePermissions = {
    "add_student.html":       "add",
    "manage_student.html":    "manage",
    "print_student.html":     "print",
    "export_student.html":    "export",
    "bulk_upload.html":       "bulk",
    "school_form.html":       "form",
    "school_management.html": "schools",
    "add_school.html":        "schools",
    "restore_students.html":  "restore",
    "dashboard.html":         null   // any logged-in user can see dashboard
  };

  let path = window.location.pathname;
  let currentPage = path.substring(path.lastIndexOf("/") + 1);
  if (currentPage === "") currentPage = "index.html";

  const isLoggedIn    = sessionStorage.getItem("isLoggedIn") === "true";
  const token         = sessionStorage.getItem("token");

  // ── Public pages ──
  if (publicPages.includes(currentPage)) {
    if (isLoggedIn && token) {
      window.location.href = "dashboard.html";
    }
    return;
  }

  // ── Not logged in → redirect ──
  if (!isLoggedIn || !token) {
    window.location.href = "login.html";
    return;
  }

  // ── Check page-level permission ──
  const requiredPermission = pagePermissions[currentPage];

  if (requiredPermission) {
    let permissions = [];
    try {
      permissions = JSON.parse(sessionStorage.getItem("permissions") || "[]");
    } catch (e) {}

    if (!permissions.includes(requiredPermission)) {
      // No permission → send back to dashboard with a message
      sessionStorage.setItem("accessDenied", currentPage);
      window.location.href = "dashboard.html";
      return;
    }
  }

})();
