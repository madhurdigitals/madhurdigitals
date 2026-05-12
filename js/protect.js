/* ========================= */
/* protect.js — RBAC Guard   */
/* ========================= */

(function () {

  const publicPages = ["index.html", "login.html"];

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
    "manage_users.html":      "users",
    "dashboard.html":         null
  };

  let path        = window.location.pathname;
  let currentPage = path.substring(path.lastIndexOf("/") + 1);
  if (currentPage === "") currentPage = "index.html";

  const isLoggedIn = sessionStorage.getItem("isLoggedIn") === "true";
  const token      = sessionStorage.getItem("token");

  if (publicPages.includes(currentPage)) {
    if (isLoggedIn && token) window.location.href = "dashboard.html";
    return;
  }

  if (!isLoggedIn || !token) {
    window.location.href = "login.html";
    return;
  }

  const requiredPermission = pagePermissions[currentPage];
  if (requiredPermission) {
    let permissions = [];
    try { permissions = JSON.parse(sessionStorage.getItem("permissions") || "[]"); } catch {}

    if (!permissions.includes(requiredPermission)) {
      sessionStorage.setItem("accessDenied", currentPage);
      window.location.href = "dashboard.html";
      return;
    }
  }

})();
