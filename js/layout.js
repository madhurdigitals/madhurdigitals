/* =====================================================================
   layout.js — the shared page frame (redesign Phase 1)
   ---------------------------------------------------------------------
   One top bar, mobile menu and footer for every converted page, built
   from ONE menu list below, so all pages stay the same.

   A page opts in with:   <body class="md-app" data-md-layout>
   and loads, after protect.js / auth.js / api.js:
                           <link rel="stylesheet" href="css/app.css">
                           <script src="js/layout.js" defer></script>
   Optional places:        <div id="mdHeader"></div>  <div id="mdFooter"></div>
   (otherwise the top bar goes first in <body> and the footer last).

   What it does NOT change:
   - who may open a page: protect.js still decides;
   - menu items follow the same permission rules as protect.js and the
     dashboard tiles (data-permission: any one is enough; data-role);
   - school pages still open through the school chooser
     (showSchoolSelector on the dashboard), exactly as today;
   - vendor branding: the vendor's name, logo and colour (from the login,
     as applyBrand uses). applyBrand in api.js still does the footer.
   No element IDs or functions of the existing pages are used or replaced.
   ===================================================================== */
(function () {
  "use strict";

  /* Dark mode: built in, but the switch shows only once every page is converted. */
  var SHOW_THEME_SWITCH = false;
  /* help.html (release P1d) */
  var HELP_READY = true;

  /* ---- the menu: page, permission(s), role ----
     perm: one permission or "a|b" (any one is enough), as data-permission on the dashboard.
     pick: opens through the school chooser (the page needs a school), with that chooser mode. */
  var MENU = [
    { group: "Records", items: [
      { label: "Add records",  sub: "One by one, with photo",       page: "add_student.html",    perm: "add",    pick: "add" },
      { label: "Records",      sub: "Find, edit, Left / Re-admit",  page: "manage_student.html", perm: "manage", pick: "manage" },
      { label: "Photos",       sub: "Add or replace many at once",  page: "manage_photos.html",  perm: "manage", pick: "photos" },
      { label: "Bulk upload",  sub: "From an Excel sheet",          page: "bulk_upload.html",    perm: "bulk",   pick: "bulk" },
      { sep: true },
      { label: "Print cards",  page: "print_student.html",  perm: "print",  pick: "print" },
      { label: "Export",       page: "export_student.html", perm: "export", pick: "export" },
      { label: "School forms", page: "school_form.html",    perm: "form",   pick: "form" }
    ] },
    { group: "Schools", items: [
      { label: "Schools",          page: "school_management.html", perm: "schools|own_schools" },
      { label: "Add school",       page: "add_school.html",        perm: "schools" },
      { sep: true },
      { label: "New session",      sub: "Promote classes for the new year", page: "new_session.html", perm: "session" },
      { label: "Session pipeline", sub: "Where every school stands",        page: "pipeline.html",    perm: "session" },
      { sep: true },
      { label: "Card templates",   page: "template_builder.html", perm: "templates", pick: "templates" },
      { label: "Restore deleted",  page: "restore_students.html", perm: "restore" }
    ] },
    { group: "Admin", items: [
      { label: "Users",   page: "manage_users.html",   perm: "users|own_users" },
      { label: "Vendors", page: "manage_vendors.html", perm: "vendors", role: "admin" }
    ] }
  ];

  var ROLE_NAMES = { admin: "Admin", employee: "Staff", vendor: "Vendor", vendor_staff: "Vendor staff", school: "School" };

  /* ---------- small helpers ---------- */
  function store(k) { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function role() { return typeof getRole === "function" ? getRole() : store("role"); }
  function perms() {
    if (typeof getPermissions === "function") { try { return getPermissions() || []; } catch (e) { /* fall through */ } }
    try { return JSON.parse(store("permissions") || "[]"); } catch (e) { return []; }
  }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function currentPage() { var p = location.pathname.split("/").pop(); return (p || "index.html").toLowerCase(); }

  /* same rule as the dashboard tiles: role must match if given; then any one permission is enough */
  function allowed(item) {
    if (item.role && item.role !== role()) return false;
    if (!item.perm) return true;
    var mine = perms();
    return item.perm.split("|").some(function (p) { return mine.indexOf(p) !== -1; });
  }
  function visibleItems(items) {
    var out = [];
    items.forEach(function (it) {
      if (it.sep) { if (out.length && !out[out.length - 1].sep) out.push(it); return; }
      if (allowed(it)) out.push(it);
    });
    while (out.length && out[out.length - 1].sep) out.pop();
    return out;
  }

  /* ---------- vendor branding (colour, name, logo) ---------- */
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbToHex(r) { return "#" + r.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"); }).join(""); }
  function lum(rgb) { var a = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
  function contrastWithWhite(rgb) { return 1.05 / (lum(rgb) + 0.05); }
  function mix(rgb, toward, t) { return rgb.map(function (v, i) { return v + (toward[i] - v) * t; }); }
  function darkenUntil(rgb, ratio) { var c = rgb.slice(), k = 0; while (contrastWithWhite(c) < ratio && k++ < 40) c = mix(c, [0, 0, 0], 0.06); return c; }
  /* the vendor colour -> the same set of colours the design uses for orange.
     Buttons and links are darkened until white text reads on them (4.5:1). */
  function brandColours(hex) {
    var base = hexToRgb(hex), action = darkenUntil(base, 4.5);
    return {
      "--md-brand": rgbToHex(base),
      "--md-action": rgbToHex(action),
      "--md-action-hover": rgbToHex(mix(action, [0, 0, 0], 0.12)),
      "--md-tint": rgbToHex(mix(base, [255, 255, 255], 0.92)),
      "--md-tint-line": rgbToHex(mix(base, [255, 255, 255], 0.72)),
      "--md-chart": rgbToHex(darkenUntil(base, 3))
    };
  }
  function brand() { try { var b = JSON.parse(store("brand") || "null"); return b && b.name ? b : null; } catch (e) { return null; } }
  function safeColour(c) { return typeof brandSafeColor === "function" ? brandSafeColor(c) : (/^#[0-9a-fA-F]{6}$/.test(String(c || "")) ? String(c) : "#0d6efd"); }
  function safeLogo(u) { return typeof brandSafeLogo === "function" ? brandSafeLogo(u) : (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : ""); }

  function applyBrandColours() {
    var b = brand();
    if (!b) return;
    var vars = brandColours(safeColour(b.color)), root = document.documentElement.style;
    Object.keys(vars).forEach(function (k) { root.setProperty(k, vars[k]); });
  }

  /* ---------- theme ---------- */
  function savedTheme() { try { return localStorage.getItem("md-theme") === "dark" ? "dark" : "light"; } catch (e) { return "light"; } }
  function setTheme(t) {
    if (t === "dark") document.documentElement.setAttribute("data-md-theme", "dark");
    else document.documentElement.removeAttribute("data-md-theme");
    try { localStorage.setItem("md-theme", t); } catch (e) { /* private mode */ }
    var btn = document.getElementById("mdThemeBtn");
    if (btn) {
      btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.querySelector(".ic-moon").style.display = t === "dark" ? "none" : "";
      btn.querySelector(".ic-sun").style.display = t === "dark" ? "" : "none";
    }
  }
  if (SHOW_THEME_SWITCH && savedTheme() === "dark") document.documentElement.setAttribute("data-md-theme", "dark");

  /* ---------- markup ---------- */
  var LOGO = "assets/logo.svg";
  function brandBlock(b) {
    var name = b ? b.name : "Madhur Digitals", own = b ? safeLogo(b.logo) : "";
    /* a vendor without its own logo: its first letter on its own colour (not the Madhur logo) */
    var mark = b && !own
      ? '<span class="md-brand__mark" aria-hidden="true">' + esc((String(b.name).trim().charAt(0) || "?").toUpperCase()) + "</span>"
      : '<img src="' + esc(own || LOGO) + '" alt="" data-md-logo>';
    return mark +
      '<span><span class="md-brand__name">' + esc(name) + '</span><span class="md-brand__sub">School ID cards</span></span>';
  }
  function itemLink(it, here, cls) {
    var cur = it.page === here ? ' aria-current="page"' : "";
    return '<a href="' + esc(it.page) + '"' + (it.pick ? ' data-md-pick="' + esc(it.pick) + '"' : "") + cur + (cls ? ' class="' + cls + '"' : "") + ">" +
      esc(it.label) + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</a>";
  }

  function headerHtml(b, here) {
    var menu = '<li><a href="dashboard.html"' + (here === "dashboard.html" ? ' aria-current="page"' : "") + ">Dashboard</a></li>";
    var drawer = '<a href="dashboard.html"' + (here === "dashboard.html" ? ' aria-current="page"' : "") + ">Dashboard</a>";
    MENU.forEach(function (g, gi) {
      var items = visibleItems(g.items);
      if (!items.length) return;
      var id = "mdPop" + gi, inGroup = items.some(function (it) { return it.page === here; });
      menu += '<li class="md-popwrap"><button type="button" aria-haspopup="true" aria-expanded="false" data-md-pop="' + id + '"' + (inGroup ? ' aria-current="true"' : "") + ">" + esc(g.group) + ' <span aria-hidden="true">▾</span></button>' +
        '<div class="md-dropdown" id="' + id + '" hidden>' + items.map(function (it) { return it.sep ? "<hr>" : itemLink(it, here); }).join("") + "</div></li>";
      drawer += '<div class="md-drawer__group"><div class="md-drawer__title">' + esc(g.group) + "</div>" +
        items.filter(function (it) { return !it.sep; }).map(function (it) { return itemLink(it, here); }).join("") + "</div>";
    });
    if (HELP_READY) menu += '<li><a href="help.html"' + (here === "help.html" ? ' aria-current="page"' : "") + ">Help</a></li>";

    var user = store("username") || "User", r = role(), roleName = ROLE_NAMES[r] || (r ? r.charAt(0).toUpperCase() + r.slice(1) : "");
    var initials = user.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase() || "U";
    var org = b ? b.name : "Madhur Digitals";

    return '<a class="md-skip" href="#mdMain">Skip to content</a>' +
      '<header class="md-nav"><div class="md-nav__in">' +
        '<button type="button" class="md-iconbtn md-menubtn" id="mdMenuBtn" aria-label="Open menu" aria-controls="mdDrawer" aria-expanded="false">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>' +
        '<a class="md-brand" href="dashboard.html" aria-label="' + esc(org) + ', go to Dashboard">' + brandBlock(b) + "</a>" +
        '<div class="md-nav__main" role="navigation" aria-label="Main"><ul class="md-menu">' + menu + "</ul></div>" +
        '<div class="md-user">' +
          (SHOW_THEME_SWITCH ? '<button type="button" class="md-iconbtn" id="mdThemeBtn" aria-label="Switch to dark mode" title="Dark mode">' +
            '<svg class="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
            '<svg class="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="display:none"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>' : "") +
          '<div class="md-popwrap"><button type="button" class="md-userbtn" aria-haspopup="true" aria-expanded="false" data-md-pop="mdPopUser">' +
            '<span class="md-avatar" aria-hidden="true">' + esc(initials) + "</span>" +
            '<span class="md-user__text"><span class="md-user__name">' + esc(user) + '</span><span class="md-user__role">' + esc(roleName) + "</span></span></button>" +
            '<div class="md-dropdown md-dropdown--end" id="mdPopUser" hidden>' +
              '<div class="md-dropdown__head"><b>' + esc(user) + "</b><span>" + esc(roleName + (roleName ? " · " : "") + org) + "</span></div><hr>" +
              (HELP_READY ? '<a href="help.html">Help</a>' : "") +
              '<button type="button" class="md-dropdown__danger" data-md-logout>Log out</button></div></div>' +
        "</div>" +
      "</div></header>" +
      '<div class="md-scrim" id="mdScrim" hidden></div>' +
      '<aside class="md-drawer" id="mdDrawer" aria-label="Menu" aria-hidden="true">' +
        '<div class="md-drawer__head"><span class="md-brand">' + brandBlock(b) + "</span>" +
        '<button type="button" class="md-iconbtn" id="mdDrawerClose" aria-label="Close menu">✕</button></div>' +
        '<div class="md-drawer__body">' + drawer +
          '<div class="md-drawer__group">' + (HELP_READY ? '<a href="help.html">Help</a>' : "") + '<button type="button" class="md-drawer__logout" data-md-logout>Log out</button></div>' +
        "</div></aside>";
  }

  function footerHtml(b) {
    var year = new Date().getFullYear();
    /* A vendor's footer, the same as applyBrand (api.js) makes it: "© year Vendor | Powered by Madhur Digitals",
       or the vendor only for white-label. Built here so it is right whichever script runs first;
       if applyBrand runs afterwards it writes the same text again. */
    if (b) return '<footer class="md-footer"><div class="md-footer__in"><span data-md-brandfoot>© ' + year + " " + esc(b.name) + "</span></div></footer>";
    return '<footer class="md-footer"><div class="md-footer__in"><span>© ' + year + " Madhur Digitals · Ambedkar Nagar, U.P.</span>" +
      '<span><a class="md-link" href="mailto:madhurdigitals01@gmail.com">madhurdigitals01@gmail.com</a>' +
      (HELP_READY ? ' · <a class="md-link" href="help.html">Help</a>' : "") + "</span></div></footer>";
  }

  /* ---------- behaviour ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function closePops(except) {
    $$("[data-md-pop]").forEach(function (b) {
      if (b === except) return;
      b.setAttribute("aria-expanded", "false");
      var box = document.getElementById(b.getAttribute("data-md-pop"));
      if (box) box.hidden = true;
    });
  }
  var drawerFrom = null;
  function openDrawer() {
    drawerFrom = document.activeElement;
    $("#mdDrawer").classList.add("is-open"); $("#mdDrawer").setAttribute("aria-hidden", "false");
    $("#mdScrim").hidden = false; $("#mdMenuBtn").setAttribute("aria-expanded", "true");
    $("#mdDrawerClose").focus();
  }
  function closeDrawer() {
    var d = $("#mdDrawer"); if (!d || !d.classList.contains("is-open")) return;
    var tm = $("#mdTabMenu"); if (tm) tm.setAttribute("aria-expanded", "false");
    d.classList.remove("is-open"); d.setAttribute("aria-hidden", "true");
    $("#mdScrim").hidden = true; $("#mdMenuBtn").setAttribute("aria-expanded", "false");
    if (drawerFrom && drawerFrom.focus) drawerFrom.focus();
  }

  /* School pages need a school: use the page's own school chooser if it has one (the dashboard),
     keep the school already chosen in this tab (as the pages do today), otherwise ask on the dashboard. */
  function openPicked(mode, href) {
    if (typeof window.showSchoolSelector === "function") { closeDrawer(); closePops(); window.showSchoolSelector(mode); return; }
    if (mode !== "templates" && store("school_id") && store("school") && store("school") !== "*") { location.href = href; return; }
    location.href = "dashboard.html?pick=" + encodeURIComponent(mode);
  }

  function wire() {
    $$("[data-md-pop]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var box = document.getElementById(b.getAttribute("data-md-pop")), open = box.hidden;
        closePops(b);
        box.hidden = !open; b.setAttribute("aria-expanded", String(open));
        if (open) { var first = box.querySelector("a,button"); if (first) first.focus(); }
      });
    });
    document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest(".md-dropdown")) closePops(); });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var open = $$("[data-md-pop]").filter(function (b) { return b.getAttribute("aria-expanded") === "true"; })[0];
      closePops(); closeDrawer();
      if (open) open.focus();
    });
    $("#mdMenuBtn").addEventListener("click", openDrawer);
    $("#mdDrawerClose").addEventListener("click", closeDrawer);
    $("#mdScrim").addEventListener("click", closeDrawer);
    $$("[data-md-pick]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;   // new tab: let the page decide
        e.preventDefault(); openPicked(a.getAttribute("data-md-pick"), a.getAttribute("href"));
      });
    });
    $$("[data-md-logout]").forEach(function (b) {
      b.addEventListener("click", function () { if (typeof window.logout === "function") window.logout(); else location.href = "login.html"; });
    });
    var tb = $("#mdThemeBtn");
    if (tb) { tb.addEventListener("click", function () { setTheme(document.documentElement.getAttribute("data-md-theme") === "dark" ? "light" : "dark"); }); setTheme(savedTheme()); }
    /* a vendor logo that fails to load: the vendor's letter tile (the Madhur logo: back to itself) */
    var bb = brand();
    $$("img[data-md-logo]").forEach(function (img) {
      img.addEventListener("error", function () {
        if (img.getAttribute("src") === LOGO) return;
        if (bb) { var m = document.createElement("span"); m.className = "md-brand__mark"; m.setAttribute("aria-hidden", "true"); m.textContent = (String(bb.name).trim().charAt(0) || "?").toUpperCase(); img.replaceWith(m); }
        else img.src = LOGO;
      });
    });
  }

  /* ---------- P2c: phone bottom bar (Home · Add · Records · Photos · Menu) ---------- */
  var TAB_ICONS = {
    home:    '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    add:     '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2"/><path d="M18 14v6M15 17h6"/>',
    records: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
    photos:  '<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-8 8"/>',
    print:   '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    bulk:    '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v3h16v-3"/>',
    export:  '<path d="M12 15V3"/><path d="M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
    menu:    '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'
  };
  /* the four chosen buttons; one the user may not use is replaced by the next allowed spare */
  var TABS = [
    { label: "Home",    icon: "home",    page: "dashboard.html" },
    { label: "Add",     icon: "add",     page: "add_student.html",    perm: "add",    pick: "add" },
    { label: "Records", icon: "records", page: "manage_student.html", perm: "manage", pick: "manage" },
    { label: "Photos",  icon: "photos",  page: "manage_photos.html",  perm: "manage", pick: "photos" }
  ];
  var TAB_SPARES = [
    { label: "Print",  icon: "print",  page: "print_student.html",  perm: "print",  pick: "print" },
    { label: "Bulk",   icon: "bulk",   page: "bulk_upload.html",    perm: "bulk",   pick: "bulk" },
    { label: "Export", icon: "export", page: "export_student.html", perm: "export", pick: "export" }
  ];
  function tabItems() {
    var spares = TAB_SPARES.filter(allowed);
    return TABS.map(function (t) { return allowed(t) ? t : spares.shift(); }).filter(Boolean);
  }
  function tabSvg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TAB_ICONS[name] + "</svg>";
  }
  function tabbarHtml(here) {
    /* a div with role="navigation", not <nav>: old page stylesheets style every <nav> (height, top: 0, sticky) */
    return '<div class="md-tabbar" id="mdTabbar" role="navigation" aria-label="Quick menu">' +
      tabItems().map(function (t) {
        return '<a href="' + esc(t.page) + '"' + (t.pick ? ' data-md-pick="' + esc(t.pick) + '"' : "") + (t.page === here ? ' aria-current="page"' : "") + ">" +
          tabSvg(t.icon) + "<span>" + esc(t.label) + "</span></a>";
      }).join("") +
      '<button type="button" id="mdTabMenu" aria-controls="mdDrawer" aria-expanded="false">' + tabSvg("menu") + "<span>Menu</span></button></div>";
  }
  /* the bar steps aside while the phone keyboard is up (typing in a box) */
  function isTypingBox(el) {
    if (!el || !el.tagName) return false;
    if (el.tagName === "TEXTAREA" || el.isContentEditable) return true;
    if (el.tagName === "SELECT") return false;
    return el.tagName === "INPUT" && !/^(checkbox|radio|button|submit|reset|file|range|color|image)$/i.test(el.type || "");
  }
  function wireTabbar() {
    var bar = $("#mdTabbar"); if (!bar) return;
    document.body.classList.add("md-has-tabbar");
    var menu = $("#mdTabMenu");
    menu.addEventListener("click", function () { openDrawer(); menu.setAttribute("aria-expanded", "true"); });
    document.addEventListener("focusin", function (e) { if (isTypingBox(e.target)) document.body.classList.add("md-typing"); });
    document.addEventListener("focusout", function () {
      setTimeout(function () { if (!isTypingBox(document.activeElement)) document.body.classList.remove("md-typing"); }, 60);
    });
  }

  /* ---------- P2c: "Add to Home screen" (icon, name, colour; opens on the Dashboard) ---------- */
  function addHead(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    document.head.appendChild(el);
  }
  function installMeta() {
    if (!document.head) return;
    /* a page opened from the disk (file://) cannot load a manifest: the browser only logs a CORS error, so skip it there */
    if (location.protocol !== "file:" && !document.querySelector('link[rel="manifest"]')) addHead("link", { rel: "manifest", href: "manifest.webmanifest" });
    if (!document.querySelector('meta[name="theme-color"]')) addHead("meta", { name: "theme-color", content: "#ffffff" });
    if (!document.querySelector('meta[name="mobile-web-app-capable"]')) addHead("meta", { name: "mobile-web-app-capable", content: "yes" });
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) addHead("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) addHead("meta", { name: "apple-mobile-web-app-title", content: "Madhur Digitals" });
    if (!document.querySelector('link[rel="apple-touch-icon"]')) addHead("link", { rel: "apple-touch-icon", href: "assets/apple-touch-icon.png" });
  }
  installMeta();

  /* ---------- toast (short message at the bottom) ---------- */
  function toast(msg, kind) {
    var box = document.getElementById("mdToasts");
    if (!box) { box = document.createElement("div"); box.id = "mdToasts"; box.className = "md-toasts"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    var t = document.createElement("div");
    t.className = "md-toast" + (kind ? " md-toast--" + kind : "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, kind === "danger" ? 6000 : 3200);
  }

  function init() {
    var body = document.body;
    if (!body || !body.hasAttribute("data-md-layout") || document.getElementById("mdDrawer")) return;
    applyBrandColours();
    var b = brand(), here = currentPage();
    var head = document.getElementById("mdHeader");
    if (head) head.outerHTML = headerHtml(b, here); else body.insertAdjacentHTML("afterbegin", headerHtml(b, here));
    var main = document.getElementById("mdMain") || document.querySelector("main");
    if (main && !main.id) main.id = "mdMain";
    if (main && !main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    var foot = document.getElementById("mdFooter");
    if (foot) foot.outerHTML = footerHtml(b); else body.insertAdjacentHTML("beforeend", footerHtml(b));
    body.insertAdjacentHTML("beforeend", tabbarHtml(here));       // P2c: shown on phones only (CSS)
    var bf = document.querySelector("[data-md-brandfoot]");
    if (bf && b.white_label !== true) {
      bf.appendChild(document.createTextNode(" | "));
      if (typeof poweredByLink === "function") bf.appendChild(poweredByLink());
      else { var a = document.createElement("a"); a.href = "https://madhurdigitals.com/"; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Madhur Digitals"; bf.appendChild(document.createTextNode("Powered by ")); bf.appendChild(a); }
    }
    if (bf && typeof appendLegalLinks === "function") appendLegalLinks(bf);
    /* applyBrand adds a floating "Powered by" when a page has no footer yet; this footer already says it */
    if (bf) Array.prototype.forEach.call(document.querySelectorAll(".md-powered"), function (el) { el.remove(); });
    wire();
    wireTabbar();
  }

  window.mdLayout = { init: init, toast: toast, setTheme: setTheme, brandColours: brandColours, allowed: allowed, menu: MENU };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
