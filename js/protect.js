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

  const isLoggedIn = sessionStorage.getItem("isLoggedIn") === "true"
                  && sessionStorage.getItem("token");

  // ── PUBLIC PAGES ──
  if (publicPages.includes(currentPage)) {

    // 🔥 If already logged in (any tab) → redirect to dashboard
    const globalLogin = localStorage.getItem("isLoggedIn") === "true";
    if (globalLogin && sessionStorage.getItem("token")) {
      window.location.replace("dashboard.html");
      return;
    }

    return;
  }

  // ── PROTECTED PAGES ──

  // 🔥 Fix back button after logout — always revalidate
  // This runs every time page is shown (including from cache)
  window.addEventListener("pageshow", function(e) {
    const stillLoggedIn = sessionStorage.getItem("isLoggedIn") === "true"
                      && sessionStorage.getItem("token")
                      && localStorage.getItem("isLoggedIn") === "true";
    if (!stillLoggedIn) {
      window.location.replace("login.html");
    }
  });

  // Not logged in → redirect
  if (!isLoggedIn) {
    window.location.replace("login.html");
    return;
  }

  // ── PERMISSION CHECK ──
  const requiredPermission = pagePermissions[currentPage];
  if (requiredPermission) {
    let permissions = [];
    try { permissions = JSON.parse(sessionStorage.getItem("permissions") || "[]"); } catch {}

    if (!permissions.includes(requiredPermission)) {
      sessionStorage.setItem("accessDenied", currentPage);
      window.location.replace("dashboard.html");
      return;
    }
  }

})();