(function () {

  const publicPages = ["index.html", "login.html"];

  const pagePermissions = {
    "add_student.html":       "add",
    "manage_student.html":    "manage",
    "print_student.html":     "print",
    "export_student.html":    "export",
    "bulk_upload.html":       "bulk",
    "school_form.html":       "form",
    "school_management.html": ["schools", "own_schools"],   // vendors: Edit own schools
    "add_school.html":        "schools",
    "restore_students.html":  "restore",
    "manage_users.html":      ["users", "own_users"],       // vendors: Manage own users
    "manage_photos.html":     "manage",     // NEW: was ungated
    "template_builder.html":  "templates",  // 🎨 Template Builder permission (admins always have it)
    "manage_vendors.html":    "vendors",    // plus admin role (adminOnlyPages below)
    "dashboard.html":         null
  };

  // Pages only the super admin (role "admin") may open, whatever permissions a user has.
  // This only hides the page; the server refuses the actions themselves for anyone else.
  const adminOnlyPages = ["manage_vendors.html"];

  /* ── ONE LOGIN FOR ALL TABS OF THIS BROWSER ──
     The login stays in this tab's temporary storage (wiped when the browser closes). A new tab
     asks the other open tabs of the same browser for it, so it doesn't need a second login and
     doesn't count as another session. When every tab is closed, the next visit asks for the password. */
  const SHARED_KEYS  = ["token", "username", "role", "schoolRaw", "userSchools", "permissions", "isLoggedIn", "brand", "vendorId"];
  const STARTER_KEYS = ["school", "school_id", "school_name"];   // copied only if this tab has none yet
  let channel = null;
  try { channel = new BroadcastChannel("md-session"); } catch (err) { channel = null; }
  window.__mdSessionChannel = channel;   // keep it alive

  if (channel) {
    channel.addEventListener("message", ev => {
      const m = ev.data || {};
      if (m.type === "need-session" && !window.__mdSessionDead &&
          sessionStorage.getItem("token") && sessionStorage.getItem("isLoggedIn") === "true") {
        const data = {};
        SHARED_KEYS.concat(STARTER_KEYS).forEach(k => { data[k] = sessionStorage.getItem(k); });
        channel.postMessage({ type: "session", id: m.id, data: data });
      }
      // Another tab of this browser logged in: use that login here too (same person, one login per browser)
      if (m.type === "session-update" && m.data && m.data.token && !publicPages.includes(currentPage) &&
          m.data.token !== sessionStorage.getItem("token") &&
          (!sessionStorage.getItem("username") || sessionStorage.getItem("username") === m.data.username)) {
        adoptSession(m.data);
      }
      if (m.type === "logout" && sessionStorage.getItem("token")) {
        sessionStorage.clear();
        localStorage.removeItem("isLoggedIn");
        if (!publicPages.includes(currentPage)) window.location.replace("login.html");
      }
    });
  }

  // Ask the other tabs for their login. found(data) or none() is called once.
  function askOtherTabs(found, none, accept) {
    const id = Math.random().toString(36).slice(2);
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; none(); } }, 500);
    channel.addEventListener("message", ev => {
      const m = ev.data || {};
      if (!done && m.type === "session" && m.id === id && m.data && m.data.token && (!accept || accept(m.data))) {
        done = true; clearTimeout(timer); found(m.data);
      }
    });
    channel.postMessage({ type: "need-session", id: id });
  }

  // Switch this tab to a working login from another tab, then let the page carry on.
  function adoptSession(data) {
    SHARED_KEYS.forEach(k => { if (data[k] !== null && data[k] !== undefined) sessionStorage.setItem(k, data[k]); });
    localStorage.setItem("isLoggedIn", "true");
    window.__mdSessionDead = false;
    try { window.dispatchEvent(new Event("mdsessionadopted")); } catch (err) {}
  }

  // Used by api.js when this tab's login has ended: is there a WORKING login in another tab?
  if (channel) {
    window.__mdFindWorkingSession = function (onFound, onNone) {
      const mine = sessionStorage.getItem("token");
      askOtherTabs(data => { adoptSession(data); onFound(); }, onNone, data => data.token !== mine);
    };
  }

  function storeBorrowed(data) {
    SHARED_KEYS.forEach(k => { if (data[k] !== null && data[k] !== undefined) sessionStorage.setItem(k, data[k]); });
    STARTER_KEYS.forEach(k => {
      if (!sessionStorage.getItem(k) && data[k] !== null && data[k] !== undefined) sessionStorage.setItem(k, data[k]);
    });
    localStorage.setItem("isLoggedIn", "true");
  }

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

    // Login page only: logged in in another tab of this browser? Then skip the login form.
    // (The homepage stays visible - opening it should not jump to the dashboard.)
    if (currentPage === "login.html" && globalLogin && channel) {
      askOtherTabs(data => { storeBorrowed(data); window.location.replace("dashboard.html"); }, () => {});
    }

    return;
  }

  // ── PROTECTED PAGES ──

  // 🔥 Fix back button after logout — always revalidate
  // This runs every time page is shown (including from cache)
  window.addEventListener("pageshow", function(e) {
    if (window.__mdSessionPending) return;   // still borrowing the login from another tab
    const stillLoggedIn = sessionStorage.getItem("isLoggedIn") === "true"
                      && sessionStorage.getItem("token")
                      && localStorage.getItem("isLoggedIn") === "true";
    if (!stillLoggedIn) {
      window.location.replace("login.html");
    }
  });

  // Not logged in in this tab → borrow the login from another open tab, otherwise go to login
  if (!isLoggedIn) {
    if (channel) {
      window.__mdSessionPending = true;                       // api.js holds requests meanwhile
      document.documentElement.style.visibility = "hidden";   // no half-loaded page flash
      askOtherTabs(
        data => { storeBorrowed(data); window.location.reload(); },
        ()   => { window.location.replace("login.html"); }
      );
      return;
    }
    window.location.replace("login.html");
    return;
  }

  // ── ADMIN-ONLY PAGES ──
  if (adminOnlyPages.includes(currentPage) && sessionStorage.getItem("role") !== "admin") {
    sessionStorage.setItem("accessDenied", currentPage);
    window.location.replace("dashboard.html");
    return;
  }

  // ── PERMISSION CHECK ──
  const requiredPermission = pagePermissions[currentPage];
  if (requiredPermission) {
    let permissions = [];
    try { permissions = JSON.parse(sessionStorage.getItem("permissions") || "[]"); } catch {}

    const needed = [].concat(requiredPermission);   // one permission, or a list where ANY one is enough
    if (!needed.some(p => permissions.includes(p))) {
      sessionStorage.setItem("accessDenied", currentPage);
      window.location.replace("dashboard.html");
      return;
    }
  }

})();