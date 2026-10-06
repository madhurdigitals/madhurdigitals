/* ========================= */
/* auth.js — RBAC Auth       */
/* ========================= */

async function login(username, password, force) {
  try {
    // POST: the password travels in the request body, not in the URL.
    // No Content-Type header on purpose - plain text avoids the browser's pre-check
    // (preflight), which Apps Script cannot answer. The server still reads it as JSON.
    const res  = await fetch(API_URL, {
      method: "POST",
      body:   JSON.stringify({ action: "login", username: username, password: password,
                               device: deviceLabel(), force: !!force })
    });
    const data = await res.json();

    // Already logged in on the maximum number of devices: ask before logging anyone out.
    if (data.status === "session_limit") {
      if (force) return { success: false, error: "Could not log out the other devices. Please try again." };
      const yes = await askToEndOtherSessions(data.sessions || [], data.max || 2);
      if (!yes) return { success: false, error: "Login cancelled — your other devices are still logged in." };
      return login(username, password, true);
    }

    if (data.error) return { success: false, error: data.error };

    sessionStorage.setItem("token",       data.token);
    sessionStorage.setItem("username",    data.username);
    sessionStorage.setItem("role",        data.role);
    sessionStorage.setItem("schoolRaw",   data.school);
    sessionStorage.setItem("userSchools", JSON.stringify(data.schools));
    sessionStorage.setItem("permissions", JSON.stringify(data.permissions));
    sessionStorage.setItem("isLoggedIn", "true");
    // Vendor's people see the vendor's name / logo / colour (Level A); everyone else: the normal look
    sessionStorage.setItem("vendorId", String(data.vendor_id || "1"));
    if (data.brand && data.brand.name) sessionStorage.setItem("brand", JSON.stringify(data.brand));
    else sessionStorage.removeItem("brand");
    localStorage.setItem("isLoggedIn", "true");

    // Backward compat for single school
    if (data.schools !== "*" && Array.isArray(data.schools) && data.schools.length === 1) {
      sessionStorage.setItem("school", data.schools[0].name);
    } else {
      sessionStorage.setItem("school", "*");
    }

    // Tell the other tabs of this browser: they switch to this login (one login per browser)
    try {
      const shared = {};
      ["token", "username", "role", "schoolRaw", "userSchools", "permissions", "isLoggedIn", "brand", "vendorId"]
        .forEach(k => { shared[k] = sessionStorage.getItem(k); });
      const ch = new BroadcastChannel("md-session");
      ch.postMessage({ type: "session-update", data: shared });
      ch.close();
    } catch (err) { /* older browsers / file:// pages: each tab logs in on its own */ }

    // school: the single school name (or "*") - login.html reads result.school; it was missing before,
    // so school users ended up with the text "undefined" as their school.
    return { success: true, role: data.role, school: sessionStorage.getItem("school"),
             schools: data.schools, permissions: data.permissions };

  } catch (err) {
    return { success: false, error: "Network error. Please try again." };
  }
}

async function logout() {
  // A vendor's people go back to THEIR vendor's login page; everyone else to the homepage
  let backTo = "index.html";
  try {
    const b = JSON.parse(sessionStorage.getItem("brand") || "null");
    if (b && b.slug) backTo = "login.html?v=" + encodeURIComponent(b.slug);
  } catch (err) { /* normal homepage */ }
  // Log out every tab of this browser, not just this one
  try { const ch = new BroadcastChannel("md-session"); ch.postMessage({ type: "logout" }); ch.close(); } catch (err) {}
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
  window.location.href = backTo;
}

// "Chrome on Windows", "Chrome on Android"... shown when someone has to choose which devices to log out.
function deviceLabel() {
  const ua = navigator.userAgent || "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
                : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iPhone-iPad"
           : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "device";
  return browser + " on " + os;
}

// Shows "already logged in on N devices" and resolves true (log them out) or false (cancel).
function askToEndOtherSessions(sessions, max) {
  return new Promise(resolve => {
    const fmtTime = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
    const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return isNaN(m) ? "" : (m < 1 ? "just now" : m + " min ago"); };
    const wrap = document.createElement("div");
    wrap.id = "sessionLimitBox";
    wrap.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100001;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif;">
        <div style="background:#fff;border-radius:14px;padding:24px;width:400px;max-width:92%;box-shadow:0 10px 40px rgba(0,0,0,.25);">
          <h3 style="margin:0 0 8px;color:#b45309;">🔐 Already logged in elsewhere</h3>
          <p style="font-size:13px;color:#374151;margin:0 0 10px;line-height:1.5;">
            This account is already logged in on <b>${sessions.length}</b> other device(s) (the limit is ${max}):
          </p>
          <ul id="slList" style="font-size:13px;color:#111827;margin:0 0 14px;padding-left:18px;line-height:1.7;"></ul>
          <button id="slYes" type="button" style="width:100%;padding:11px;border:none;border-radius:8px;background:#dc2626;color:#fff;font-size:14px;cursor:pointer;">Log out the other devices and continue</button>
          <button id="slNo" type="button" style="width:100%;padding:9px;margin-top:8px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;font-size:13px;cursor:pointer;">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const list = document.getElementById("slList");
    sessions.forEach(s => {
      const li = document.createElement("li");
      li.textContent = `${s.device || "Unknown device"} — since ${fmtTime(s.started)}, last active ${ago(s.last_active)}`;
      list.appendChild(li);
    });
    document.getElementById("slYes").onclick = () => { wrap.remove(); resolve(true); };
    document.getElementById("slNo").onclick  = () => { wrap.remove(); resolve(false); };
  });
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