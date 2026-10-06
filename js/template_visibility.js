/* =============================================
   template_visibility.js  (Phase 2.6)
   Adds to Template Builder:
     - "Who can use it":  📚 Library (everyone) / 🤝 Private to a vendor / 🏫 Private to one school
       A vendor's people: their templates are always private (to their vendor or one of their schools)
       and they can only change their own - opening a library template and saving makes their own copy.
     - Admins: ⭐ Premium switch and 📚 Copy to library.
   Load it in template_builder.html AFTER the page's own script:
     <script src="js/template_visibility.js"></script>
   ============================================= */
(function () {
  // Read the login straight from this tab's session - no dependency on auth.js being loaded on the page
  const myRole  = String(sessionStorage.getItem("role") || "");
  let   myPerms = [];
  try { myPerms = JSON.parse(sessionStorage.getItem("permissions") || "[]") || []; } catch (err) { myPerms = []; }

  const VIS_LABELS = { everyone: "📚 Library", vendor: "🤝 Vendor", school: "🏫 School" };
  const myVendorId = String(sessionStorage.getItem("vendorId") || "1");
  const vendorMode = myVendorId !== "1" && myRole !== "admin";        // a vendor's own people
  const amAdmin    = myRole === "admin";
  let tvVendors = [];
  let loadedRow = null;

  const toast = (msg, type) => { if (typeof showToast === "function") showToast(msg, type); else alert(msg); };

  /* ── controls ── */
  function buildControls() {
    const nameInput = document.getElementById("tbName");
    if (!nameInput || document.getElementById("tvVisibility")) return;
    const nameField = nameInput.closest(".tb-field");
    const wrap = document.createElement("div");
    wrap.className = "tb-field";
    wrap.id = "tvWrap";
    wrap.innerHTML = `
      <label>Who can use it</label>
      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
        <select id="tvVisibility" title="Which schools may be given this template">
          <option value="everyone" title="Offered for every school - part of your design library">📚 Library (everyone)</option>
          <option value="vendor"   title="Offered only for this vendor's schools">${vendorMode ? "🤝 All my schools" : "🤝 Private to a vendor"}</option>
          <option value="school"   title="Offered only for this one school">${vendorMode ? "🏫 One of my schools" : "🏫 Private to one school"}</option>
        </select>
        <select id="tvVendor" style="display:none;" title="The vendor this template belongs to"></select>
        <select id="tvSchool" style="display:none;" title="The school this template belongs to"></select>
        <label id="tvPremiumWrap" style="display:none; font-size:12px; text-transform:none; color:#92400e; gap:4px; align-items:center;"
               title="Premium: shown with ⭐ - for now only an admin can give it to a school">
          <input type="checkbox" id="tvPremium" style="min-width:0;"> ⭐ Premium
        </label>
        <button type="button" id="tvCopyBtn" style="display:none; padding:7px 10px; border-radius:7px; border:1px solid #16a34a; background:#f0fdf4; color:#166534; font-size:12px; cursor:pointer;"
                title="Add a copy of this template to your library - the original stays as it is">📚 Copy to library</button>
      </div>
      <div id="tvNote" style="font-size:11px; color:#b45309; margin-top:3px; display:none;"></div>`;
    nameField.parentNode.insertBefore(wrap, nameField.nextSibling);
    document.getElementById("tvVisibility").addEventListener("change", showOwnerPicker);
    document.getElementById("tvCopyBtn").addEventListener("click", copyToLibrary);
    if (vendorMode) {
      document.querySelector('#tvVisibility option[value="everyone"]').remove();   // the library belongs to Madhur Digitals
      document.getElementById("tvVisibility").value = "vendor";
    }
  }

  function showOwnerPicker() {
    const vis = document.getElementById("tvVisibility").value;
    document.getElementById("tvVendor").style.display = (vis === "vendor" && !vendorMode) ? "" : "none";
    document.getElementById("tvSchool").style.display = vis === "school" ? "" : "none";
    document.getElementById("tvPremiumWrap").style.display = (amAdmin && vis === "everyone") ? "flex" : "none";
    if (vis === "school") fillSchools();
  }

  async function loadVendors() {
    if (vendorMode) return;
    try {
      const res = await getVendors();
      tvVendors = (res && !res.error && Array.isArray(res.vendors)) ? res.vendors.filter(v =>
        String(v.vendor_id) !== "1" && !["platform", "holding"].includes(String(v.kind || "").toLowerCase()) &&
        String(v.status || "").toLowerCase() !== "archived") : [];
    } catch (err) { tvVendors = []; }
    const sel = document.getElementById("tvVendor");
    sel.innerHTML = tvVendors.map(v => `<option value="${v.vendor_id}">${String(v.name).replace(/</g, "&lt;")}</option>`).join("");
    // Only someone with Manage Vendors can make a template private to a vendor
    const canVendor = amAdmin && myPerms.includes("vendors") && tvVendors.length > 0;
    document.querySelector('#tvVisibility option[value="vendor"]').disabled = !canVendor;
  }

  function fillSchools(keep) {
    const sel = document.getElementById("tvSchool");
    const schools = window._tbAllSchools || [];
    const want = keep !== undefined ? keep : sel.value;
    sel.innerHTML = schools.map(s => `<option value="${String(s.school).replace(/"/g, "&quot;")}">${String(s.school_name || s.school).replace(/</g, "&lt;")}</option>`).join("");
    if (want && schools.some(s => String(s.school) === String(want))) sel.value = want;
  }

  // A vendor may change only its own templates (the server checks this too)
  function editableByMe(row) {
    if (!vendorMode || !row) return true;
    const vis = String(row.visibility || "").toLowerCase();
    if (vis === "vendor") return String(row.vendor_id) === myVendorId;
    if (vis === "school") return (window._tbAllSchools || []).some(s => String(s.school).toLowerCase() === String(row.owner_school || "").toLowerCase());
    return false;
  }

  function note(text) {
    const el = document.getElementById("tvNote");
    el.textContent = text || "";
    el.style.display = text ? "" : "none";
  }

  function setControls(row) {
    loadedRow = row || null;
    const vis = String((row && row.visibility) || "").toLowerCase();
    const sel = document.getElementById("tvVisibility");
    if (vendorMode) {
      sel.value = vis === "school" && editableByMe(row) ? "school" : "vendor";
    } else {
      sel.value = (vis === "vendor" || vis === "school") ? vis : "everyone";
      if (vis === "vendor") document.getElementById("tvVendor").value = String(row.vendor_id || "");
    }
    fillSchools(vis === "school" ? String(row.owner_school || "") : undefined);
    document.getElementById("tvPremium").checked = !!(row && String(row.premium || "").toLowerCase() === "yes");
    document.getElementById("tvCopyBtn").style.display = (amAdmin && row && vis !== "everyone" && vis !== "") ? "" : "none";
    showOwnerPicker();

    // Not mine (e.g. a library template): saving creates my own private copy instead of changing it
    if (row && !editableByMe(row)) {
      tbEditingTemplateId = null;
      note("This template isn't yours, so saving creates your own private copy - the original stays as it is.");
    } else {
      note("");
    }
  }

  function currentChoice() {
    const vis = document.getElementById("tvVisibility").value;
    const c = {
      visibility:   vis,
      vendor_id:    vis === "vendor" && !vendorMode ? document.getElementById("tvVendor").value : "",
      owner_school: vis === "school" ? document.getElementById("tvSchool").value : ""
    };
    if (amAdmin && vis === "everyone") c.premium = document.getElementById("tvPremium").checked ? "yes" : "no";
    return c;
  }

  async function copyToLibrary() {
    if (!loadedRow) return;
    const name = prompt("Name for the library copy:", (loadedRow.template_name || "Template") + " (Library)");
    if (name === null) return;
    const btn = document.getElementById("tvCopyBtn");
    btn.disabled = true; btn.textContent = "⏳ Copying…";
    try {
      const params = new URLSearchParams({ action: "copyTemplateToLibrary", template_id: loadedRow.template_id, template_name: name });
      const res = await fetch(`${API_URL}?${params.toString()}`).then(r => r.json());
      if (res && res.error) { toast(res.error, "error"); return; }
      toast("Copied to the library ✓", "success");
      await window.loadTemplateList();
    } finally {
      btn.disabled = false; btn.textContent = "📚 Copy to library";
    }
  }

  /* ── send the choice whenever the builder saves ── */
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : (input && input.url);
      const m = url && url.indexOf(API_URL) === 0 && /[?&]action=(saveCustomTemplate|updateCustomTemplate)(&|$)/.exec(url);
      if (m) {
        const u = new URL(url);
        const c = currentChoice();
        if (m[1] === "saveCustomTemplate") delete c.premium;          // premium is set on an existing template
        Object.keys(c).forEach(k => u.searchParams.set(k, c[k]));
        return originalFetch.call(this, u.toString(), init);
      }
    } catch (err) { /* fall through */ }
    return originalFetch.apply(this, arguments);
  };

  /* ── follow the builder: loading, new template, template list labels ── */
  // (hooked in start(), once the builder's own script has defined these functions)
  function hookBuilder() {
    if (typeof window.handleLoadSelect === "function" && !window.handleLoadSelect.__tv) {
      const originalLoad = window.handleLoadSelect;
      window.handleLoadSelect = function () {
        originalLoad.apply(this, arguments);
        const id = document.getElementById("tbLoadSelect").value;
        const row = (typeof tbTemplatesCache !== "undefined" ? tbTemplatesCache : []).find(r => r.template_id === id);
        setControls(row || null);
      };
      window.handleLoadSelect.__tv = true;
    }
    if (typeof window.resetBuilder === "function" && !window.resetBuilder.__tv) {
      const originalReset = window.resetBuilder;
      window.resetBuilder = function () {
        originalReset.apply(this, arguments);
        setControls(null);
      };
      window.resetBuilder.__tv = true;
    }
    if (typeof window.loadTemplateList === "function" && !window.loadTemplateList.__tv) {
      const originalList = window.loadTemplateList;
      window.loadTemplateList = async function () {
        await originalList.apply(this, arguments);
        labelTemplateList();
      };
      window.loadTemplateList.__tv = true;
    }
  }

  function labelTemplateList() {
    const list = typeof tbTemplatesCache !== "undefined" ? tbTemplatesCache : [];
    document.querySelectorAll("#tbLoadSelect option").forEach(o => {
      const row = list.find(r => r.template_id === o.value);
      if (!row) return;
      const vis = String(row.visibility || "").toLowerCase();
      const tag = vis === "vendor" ? VIS_LABELS.vendor : vis === "school" ? VIS_LABELS.school : VIS_LABELS.everyone;
      const star = String(row.premium || "").toLowerCase() === "yes" ? "⭐ " : "";
      o.textContent = `${star}${row.template_name}  ·  ${tag}`;
    });
  }

  /* ── admins: ⭐ Premium for the built-in (JS/CSS) templates ── */
  async function buildBuiltinPanel() {
    if (!amAdmin || document.getElementById("tvBuiltinPanel")) return;
    if (typeof TEMPLATE_REGISTRY === "undefined") {            // the builder doesn't load the registry itself
      await new Promise(resolve => {
        const sc = document.createElement("script");
        sc.src = "card_templates/template_registry.js";
        sc.onload = resolve; sc.onerror = resolve;
        document.head.appendChild(sc);
      });
    }
    if (typeof TEMPLATE_REGISTRY === "undefined") return;
    let flags = {};
    try {
      const res = await fetch(`${API_URL}?action=getTemplateFlags`).then(r => r.json());
      flags = (res && res.flags) || {};
    } catch (err) { flags = {}; }
    const anchor = document.getElementById("tvWrap");
    if (!anchor) return;
    const panel = document.createElement("div");
    panel.id = "tvBuiltinPanel";
    panel.style.cssText = "width:100%; margin-top:6px; padding:8px 10px; border:1px dashed #f59e0b; border-radius:8px; background:#fffbeb; font-size:12px;";
    panel.innerHTML = `<b title="Built-in templates are fully dynamic and offered for every school. Premium ones can only be given to a school by an admin.">⭐ Premium built-in templates</b>
      <span style="color:#92400e;"> — offered for every school; only an admin can give a Premium one to a school.</span>
      <div id="tvBuiltinList" style="display:flex; gap:12px; flex-wrap:wrap; margin-top:6px;"></div>`;
    anchor.parentNode.parentNode.insertBefore(panel, anchor.parentNode.nextSibling);
    const list = document.getElementById("tvBuiltinList");
    TEMPLATE_REGISTRY.forEach(t => {
      const lab = document.createElement("label");
      lab.style.cssText = "display:flex; gap:4px; align-items:center; cursor:pointer;";
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.value = t.id; cb.checked = !!(flags[t.id] && flags[t.id].premium);
      cb.addEventListener("change", async () => {
        cb.disabled = true;
        try {
          const params = new URLSearchParams({ action: "setTemplatePremium", template_id: t.id, premium: cb.checked ? "yes" : "no" });
          const res = await fetch(`${API_URL}?${params.toString()}`).then(r => r.json());
          if (res && res.error) { cb.checked = !cb.checked; toast(res.error, "error"); }
          else toast(`${t.name}: ${cb.checked ? "⭐ Premium" : "not Premium"}`, "success");
        } finally { cb.disabled = false; }
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(t.name));
      list.appendChild(lab);
    });
  }

  /* ── start: wait until the page (and the builder's own script) is fully loaded ── */
  function start() {
    if (!document.getElementById("tbName")) { console.warn("template_visibility.js: Template Builder fields not found"); return; }
    hookBuilder();
    buildControls();
    buildBuiltinPanel();
    loadVendors();
    showOwnerPicker();
    // the builder already started loading its template list - label it once it's there
    setTimeout(labelTemplateList, 1500);
    setTimeout(() => fillSchools(), 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();