/* =============================================
   template_visibility.js  (Phase 2.6 - school-first Template Builder)
   Adds to Template Builder (template_builder.html loads it with one <script> line):
     - "🎨 Designing for: <school>" - the school comes from the dashboard (template_builder.html?school=CODE)
       or "No specific school". The live preview switches to that school.
     - "📂 Templates for <school>": currently used / this school's / its vendor's / library / built-in,
       each with ✏️ Open, ⧉ Duplicate and ✓ Use for this school.
     - "Who can use it" next to Template Name, pre-filled for the school, with "Use for <school> now".
     - Admins: ⭐ Premium (custom library templates) and the ⭐ Premium built-in templates panel.
   Vendors' templates are always private and they only change their own (the server checks all of this).
   ============================================= */
(function () {
  // Read the login straight from this tab's session - no dependency on auth.js being loaded on the page
  const myRole  = String(sessionStorage.getItem("role") || "");
  let   myPerms = [];
  try { myPerms = JSON.parse(sessionStorage.getItem("permissions") || "[]") || []; } catch (err) { myPerms = []; }
  const myVendorId = String(sessionStorage.getItem("vendorId") || "1");
  const vendorMode = myVendorId !== "1" && myRole !== "admin";        // a vendor's own people
  const amAdmin    = myRole === "admin";
  const canSetSchoolTemplate = amAdmin || myPerms.includes("schools") || myPerms.includes("own_schools");

  const ctxCode = (new URLSearchParams(location.search).get("school") || "").trim();   // "" = no specific school
  let ctxSchool = null;           // the school row (name, template, vendor_id)
  let allSchools = [];
  let tvVendors = [];
  let builtinFlags = {};
  let loadedRow = null;

  const esc   = v => String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const toast = (msg, type) => { if (typeof showToast === "function") showToast(msg, type); else alert(msg); };
  const visOf = t => { const v = String((t && t.visibility) || "").toLowerCase(); return (v === "vendor" || v === "school") ? v : "everyone"; };
  const isPrem = t => String((t && t.premium) || "").toLowerCase() === "yes";
  const cache = () => (typeof tbTemplatesCache !== "undefined" ? tbTemplatesCache : []);
  const schoolName = code => { const s = allSchools.find(x => String(x.school).toLowerCase() === String(code).toLowerCase()); return s ? (s.school_name || s.school) : code; };
  const ctxVendor = () => ctxSchool ? (String(ctxSchool.vendor_id === undefined || ctxSchool.vendor_id === "" ? "1" : ctxSchool.vendor_id)) : (vendorMode ? myVendorId : "1");
  const vendorName = id => { const v = tvVendors.find(x => String(x.vendor_id) === String(id)); return v ? v.name : (vendorMode ? "my" : "vendor " + id); };

  async function api(params) {
    const res = await fetch(`${API_URL}?${new URLSearchParams(params).toString()}`);
    return res.json();
  }

  /* ── "Designing for" bar + templates panel ── */
  function buildTopArea() {
    const container = document.querySelector(".tb-container");
    if (!container || document.getElementById("tvContextBar")) return;
    const bar = document.createElement("div");
    bar.id = "tvContextBar";
    bar.className = "card";
    bar.style.cssText = "display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 16px; margin-bottom:12px;";
    bar.innerHTML = `
      <b style="font-size:15px;">🎨 Designing for:</b>
      <select id="tvCtxSelect" title="Choose the school you are designing for - the preview and the template list follow it"
              style="padding:7px 10px; border-radius:7px; border:1px solid #d1d5db; min-width:220px;">
        <option value="">No specific school (library / all my schools)</option>
      </select>
      <span id="tvCtxInfo" style="font-size:12px; color:#6b7280;"></span>`;
    container.insertBefore(bar, container.firstChild);
    document.getElementById("tvCtxSelect").addEventListener("change", e => {
      const v = e.target.value;
      location.search = v ? "?school=" + encodeURIComponent(v) : "";
    });

    const panel = document.createElement("div");
    panel.id = "tvPanel";
    panel.className = "card";
    panel.style.cssText = "padding:12px 16px; margin-bottom:12px;";
    panel.innerHTML = `<h3 id="tvPanelTitle" style="margin:0 0 8px;">📂 Templates</h3><div id="tvPanelBody" style="font-size:13px; color:#6b7280;">Loading…</div>`;
    container.insertBefore(panel, bar.nextSibling);
  }

  function fillContextSelect() {
    const sel = document.getElementById("tvCtxSelect");
    if (!sel) return;                      // page without the bar: nothing to fill
    sel.innerHTML = `<option value="">No specific school (library / all my schools)</option>` +
      allSchools.map(s => `<option value="${esc(s.school)}">${esc(s.school_name || s.school)}</option>`).join("");
    sel.value = ctxSchool ? ctxSchool.school : "";
    const info = document.getElementById("tvCtxInfo");
    if (ctxSchool) {
      const cur = ctxSchool.template || "";
      info.textContent = "Currently using: " + templateLabel(cur);
    } else {
      info.textContent = "Designs made here can be used by several schools.";
    }
  }

  function templateLabel(id) {
    if (!id) return "—";
    const c = cache().find(t => t.template_id === id);
    if (c) return c.template_name;
    const b = (typeof TEMPLATE_REGISTRY !== "undefined" ? TEMPLATE_REGISTRY : []).find(t => t.id === id);
    return b ? b.name : id;
  }

  function editableByMe(row) {
    if (!vendorMode || !row) return true;
    const vis = visOf(row);
    if (vis === "vendor") return String(row.vendor_id) === myVendorId;
    if (vis === "school") return allSchools.some(s => String(s.school).toLowerCase() === String(row.owner_school || "").toLowerCase());
    return false;
  }

  function renderPanel() {
    const body = document.getElementById("tvPanelBody");
    if (!body) return;
    const title = document.getElementById("tvPanelTitle");
    title.textContent = ctxSchool ? `📂 Templates for ${ctxSchool.school_name || ctxSchool.school}` : "📂 Templates";
    const list = cache();
    const cur = ctxSchool ? String(ctxSchool.template || "") : "";
    const vid = ctxVendor();

    const sections = [];
    if (ctxSchool) {
      sections.push(["🏫 This school's templates", list.filter(t => visOf(t) === "school" && String(t.owner_school || "").toLowerCase() === ctxSchool.school.toLowerCase())]);
      if (vid !== "1") sections.push([`🤝 For all ${vendorMode ? "my" : esc(vendorName(vid)) + "'s"} schools`, list.filter(t => visOf(t) === "vendor" && String(t.vendor_id) === vid)]);
    } else if (vendorMode) {
      sections.push(["🤝 My templates", list.filter(t => visOf(t) !== "everyone" && editableByMe(t))]);
    } else {
      sections.push(["🔒 Private templates", list.filter(t => visOf(t) !== "everyone")]);
    }
    sections.push(["📚 Library", list.filter(t => visOf(t) === "everyone")]);

    const row = (id, name, opts) => {
      const isCur = cur && id === cur;
      const premLocked = opts.premium && !amAdmin;
      const btns = [];
      if (opts.custom && opts.editable) btns.push(`<button type="button" data-act="open" data-id="${esc(id)}" title="Open it in the editor below">✏️ Open</button>`);
      if (opts.custom) btns.push(`<button type="button" data-act="dup" data-id="${esc(id)}" title="Make an independent copy - for this school, a vendor's schools or the library">⧉ Duplicate</button>`);
      if (ctxSchool && canSetSchoolTemplate && !isCur) {
        btns.push(premLocked
          ? `<button type="button" disabled title="Premium - please contact Madhur Digitals">⭐ Premium</button>`
          : `<button type="button" data-act="use" data-id="${esc(id)}" title="Make this the template ${esc(ctxSchool.school_name || ctxSchool.school)} prints with">✓ Use for this school</button>`);
      }
      return `<div class="tv-item" style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 8px; border-bottom:1px solid #f1f5f9; ${isCur ? "background:#f0fdf4;" : ""}">
        <span style="color:#111827;">${opts.premium ? "⭐ " : ""}${esc(name)}${isCur ? ` <b style="color:#16a34a;">✓ in use</b>` : ""}${opts.tag ? ` <span style="color:#9ca3af;font-size:11px;">${esc(opts.tag)}</span>` : ""}</span>
        <span class="tv-btns" style="display:flex; gap:4px; flex-wrap:wrap;">${btns.join("")}</span></div>`;
    };

    let html = "";
    sections.forEach(([label, items]) => {
      html += `<div style="margin:8px 0 2px; font-weight:700; color:#374151;">${label}</div>`;
      html += items.length ? items.map(t => row(t.template_id, t.template_name, {
        custom: true, editable: editableByMe(t), premium: isPrem(t),
        tag: visOf(t) === "school" && !ctxSchool ? "· " + schoolName(t.owner_school) : (visOf(t) === "vendor" && !ctxSchool && !vendorMode ? "· " + vendorName(t.vendor_id) : "")
      })).join("") : `<div style="padding:4px 8px; color:#9ca3af;">None yet</div>`;
    });
    const reg = typeof TEMPLATE_REGISTRY !== "undefined" ? TEMPLATE_REGISTRY : [];
    html += `<div style="margin:8px 0 2px; font-weight:700; color:#374151;" title="Fully dynamic code templates - choose them for a school; they can't be opened in the editor">🧩 Built-in templates (all schools)</div>`;
    html += reg.map(t => row(t.id, t.name, { custom: false, premium: !!(builtinFlags[t.id] && builtinFlags[t.id].premium) })).join("");
    body.innerHTML = html;
    body.querySelectorAll(".tv-btns button").forEach(b => {
      b.style.cssText = "padding:4px 9px; border-radius:6px; border:1px solid #d1d5db; background:#fff; font-size:12px; cursor:pointer;";
      if (b.disabled) b.style.cursor = "not-allowed";
    });
    body.onclick = onPanelClick;
  }

  async function onPanelClick(e) {
    const b = e.target.closest("button[data-act]");
    if (!b || b.disabled) return;
    const id = b.getAttribute("data-id");
    if (b.getAttribute("data-act") === "open") {
      document.getElementById("tbLoadSelect").value = id;
      window.handleLoadSelect();
      document.getElementById("tbName").scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (b.getAttribute("data-act") === "dup") {
      openDuplicateDialog(id);
    } else if (b.getAttribute("data-act") === "use") {
      const old = b.textContent; b.disabled = true; b.textContent = "⏳ Saving…";
      const res = await useForSchool(id);
      if (!res) { b.disabled = false; b.textContent = old; }
    }
  }

  async function useForSchool(id) {
    const res = await api({ action: "setSchoolTemplate", school: ctxSchool.school, template_id: id });
    if (res && res.error) { toast(res.error, "error"); return false; }
    ctxSchool.template = id;
    toast(`${ctxSchool.school_name || ctxSchool.school} now uses "${templateLabel(id)}" ✓`, "success");
    fillContextSelect(); renderPanel();
    return true;
  }

  /* ── ⧉ Duplicate dialog ── */
  function targetOptions() {
    const opts = [];
    if (ctxSchool) opts.push(["school", `🏫 Only ${ctxSchool.school_name || ctxSchool.school}`]);
    if (vendorMode) opts.push(["vendor", "🤝 All my schools"]);
    else if (amAdmin && myPerms.includes("vendors") && ctxVendor() !== "1") opts.push(["vendor", `🤝 All ${vendorName(ctxVendor())}'s schools`]);
    if (!vendorMode) opts.push(["everyone", "📚 Library (everyone)"]);
    return opts;
  }

  function openDuplicateDialog(id) {
    const src = cache().find(t => t.template_id === id);
    if (!src) return;
    const opts = targetOptions();
    const wrap = document.createElement("div");
    wrap.id = "tvDupBox";
    wrap.innerHTML = `
      <div style="position:fixed; inset:0; background:rgba(15,23,42,.5); z-index:3000; display:flex; align-items:center; justify-content:center;">
        <div style="background:#fff; border-radius:14px; padding:22px; width:400px; max-width:92%; box-shadow:0 10px 40px rgba(0,0,0,.2);">
          <h3 style="margin:0 0 6px;">⧉ Duplicate template</h3>
          <p style="font-size:12px; color:#6b7280; margin:0 0 12px;">An independent copy - changing it never changes "${esc(src.template_name)}".</p>
          <label style="font-size:12px; font-weight:600;">Name</label>
          <input id="tvDupName" style="width:100%; padding:8px; margin:4px 0 10px; border-radius:7px; border:1px solid #d1d5db; box-sizing:border-box;">
          <label style="font-size:12px; font-weight:600;">Who can use the copy</label>
          <select id="tvDupTarget" style="width:100%; padding:8px; margin:4px 0 10px; border-radius:7px; border:1px solid #d1d5db;">
            ${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}
          </select>
          <label id="tvDupUseWrap" style="display:${ctxSchool && canSetSchoolTemplate ? "flex" : "none"}; gap:6px; align-items:center; font-size:13px; margin-bottom:12px;">
            <input type="checkbox" id="tvDupUse" checked> Use it for ${esc(ctxSchool ? (ctxSchool.school_name || ctxSchool.school) : "")} now
          </label>
          <div style="display:flex; gap:8px;">
            <button type="button" id="tvDupOk" style="flex:1; padding:10px; border:none; border-radius:8px; background:#0d6efd; color:#fff; cursor:pointer;">Duplicate &amp; open</button>
            <button type="button" id="tvDupCancel" style="padding:10px 14px; border:1px solid #d1d5db; border-radius:8px; background:#fff; cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#tvDupName").value = src.template_name + (ctxSchool ? " – " + (ctxSchool.school_name || ctxSchool.school) : " (copy)");
    wrap.querySelector("#tvDupCancel").onclick = () => wrap.remove();
    wrap.querySelector("#tvDupOk").onclick = async () => {
      const ok = wrap.querySelector("#tvDupOk");
      ok.disabled = true; ok.textContent = "⏳ Duplicating…";
      const target = wrap.querySelector("#tvDupTarget").value;
      const params = { action: "duplicateTemplate", template_id: id, template_name: wrap.querySelector("#tvDupName").value.trim(), visibility: target };
      if (target === "school") params.owner_school = ctxSchool.school;
      if (target === "vendor" && !vendorMode) params.vendor_id = ctxVendor();
      const res = await api(params);
      if (res && res.error) { toast(res.error, "error"); ok.disabled = false; ok.textContent = "Duplicate & open"; return; }
      const useNow = ctxSchool && canSetSchoolTemplate && wrap.querySelector("#tvDupUse").checked;
      wrap.remove();
      await window.loadTemplateList();
      if (useNow) await useForSchool(res.template_id);
      document.getElementById("tbLoadSelect").value = res.template_id;
      window.handleLoadSelect();
      toast("Copy created - you can edit it now ✓", "success");
    };
  }

  /* ── "Who can use it" next to Template Name (used when saving) ── */
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
        <label id="tvUseNowWrap" style="display:none; font-size:12px; text-transform:none; color:#166534; gap:4px; align-items:center;"
               title="After saving, make this the template the school prints with">
          <input type="checkbox" id="tvUseNow" style="min-width:0;" checked> <span id="tvUseNowText">Use for this school now</span>
        </label>
      </div>
      <div id="tvNote" style="font-size:11px; color:#b45309; margin-top:3px; display:none;"></div>`;
    nameField.parentNode.insertBefore(wrap, nameField.nextSibling);
    document.getElementById("tvVisibility").addEventListener("change", showOwnerPicker);
    if (vendorMode) document.querySelector('#tvVisibility option[value="everyone"]').remove();   // the library belongs to Madhur Digitals
  }

  function showOwnerPicker() {
    const vis = document.getElementById("tvVisibility").value;
    document.getElementById("tvVendor").style.display = (vis === "vendor" && !vendorMode) ? "" : "none";
    document.getElementById("tvSchool").style.display = vis === "school" ? "" : "none";
    document.getElementById("tvPremiumWrap").style.display = (amAdmin && vis === "everyone") ? "flex" : "none";
    const useWrap = document.getElementById("tvUseNowWrap");
    useWrap.style.display = (ctxSchool && canSetSchoolTemplate) ? "flex" : "none";
    if (ctxSchool) document.getElementById("tvUseNowText").textContent = `Use for ${ctxSchool.school_name || ctxSchool.school} now`;
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
    sel.innerHTML = tvVendors.map(v => `<option value="${v.vendor_id}">${esc(v.name)}</option>`).join("");
    const canVendor = amAdmin && myPerms.includes("vendors") && tvVendors.length > 0;
    document.querySelector('#tvVisibility option[value="vendor"]').disabled = !canVendor;
    if (ctxSchool && ctxVendor() !== "1") sel.value = ctxVendor();
  }

  function fillSchools(keep) {
    const sel = document.getElementById("tvSchool");
    const want = keep !== undefined ? keep : (sel.value || (ctxSchool ? ctxSchool.school : ""));
    sel.innerHTML = allSchools.map(s => `<option value="${esc(s.school)}">${esc(s.school_name || s.school)}</option>`).join("");
    if (want && allSchools.some(s => String(s.school) === String(want))) sel.value = want;
  }

  function note(text) {
    const el = document.getElementById("tvNote");
    el.textContent = text || "";
    el.style.display = text ? "" : "none";
  }

  // New template: pre-filled for the school we're designing for
  function setControls(row) {
    loadedRow = row || null;
    const sel = document.getElementById("tvVisibility");
    if (!row) {
      sel.value = ctxSchool ? "school" : (vendorMode ? "vendor" : "everyone");
      fillSchools(ctxSchool ? ctxSchool.school : undefined);
      document.getElementById("tvPremium").checked = false;
      note("");
      showOwnerPicker();
      return;
    }
    const vis = visOf(row);
    if (vendorMode) sel.value = vis === "school" && editableByMe(row) ? "school" : "vendor";
    else {
      sel.value = vis;
      if (vis === "vendor") document.getElementById("tvVendor").value = String(row.vendor_id || "");
    }
    fillSchools(vis === "school" ? String(row.owner_school || "") : undefined);
    document.getElementById("tvPremium").checked = isPrem(row);
    showOwnerPicker();
    if (!editableByMe(row)) {
      tbEditingTemplateId = null;      // not mine: saving creates my own private copy
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

  /* ── send the choice whenever the builder saves; then "Use for this school now" ── */
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
        const useNow = ctxSchool && canSetSchoolTemplate && document.getElementById("tvUseNow").checked;
        const editingId = u.searchParams.get("template_id");
        return originalFetch.call(this, u.toString(), init).then(async res => {
          try {
            const j = await res.clone().json();
            const id = (j && j.template_id) || editingId;
            if (j && !j.error && useNow && id && String(ctxSchool.template) !== String(id)) await useForSchool(id);
          } catch (err) { /* the builder shows the save result itself */ }
          return res;
        });
      }
    } catch (err) { /* fall through */ }
    return originalFetch.apply(this, arguments);
  };

  /* ── follow the builder: loading, new template, template list ── */
  function hookBuilder() {
    if (typeof window.handleLoadSelect === "function" && !window.handleLoadSelect.__tv) {
      const originalLoad = window.handleLoadSelect;
      window.handleLoadSelect = function () {
        originalLoad.apply(this, arguments);
        const id = document.getElementById("tbLoadSelect").value;
        setControls(cache().find(r => r.template_id === id) || null);
      };
      window.handleLoadSelect.__tv = true;
    }
    if (typeof window.resetBuilder === "function" && !window.resetBuilder.__tv) {
      const originalReset = window.resetBuilder;
      window.resetBuilder = function () { originalReset.apply(this, arguments); setControls(null); };
      window.resetBuilder.__tv = true;
    }
    if (typeof window.loadTemplateList === "function" && !window.loadTemplateList.__tv) {
      const originalList = window.loadTemplateList;
      window.loadTemplateList = async function () {
        await originalList.apply(this, arguments);
        labelTemplateList();
        renderPanel();
        fillContextSelect();
      };
      window.loadTemplateList.__tv = true;
    }
  }

  function labelTemplateList() {
    document.querySelectorAll("#tbLoadSelect option").forEach(o => {
      const row = cache().find(r => r.template_id === o.value);
      if (!row) return;
      const tag = { vendor: "🤝 Vendor", school: "🏫 School", everyone: "📚 Library" }[visOf(row)];
      o.textContent = `${isPrem(row) ? "⭐ " : ""}${row.template_name}  ·  ${tag}`;
    });
  }

  /* ── admins: ⭐ Premium for the built-in (JS/CSS) templates ── */
  function buildBuiltinPanel() {
    if (!amAdmin || document.getElementById("tvBuiltinPanel") || typeof TEMPLATE_REGISTRY === "undefined") return;
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
      cb.type = "checkbox"; cb.value = t.id; cb.checked = !!(builtinFlags[t.id] && builtinFlags[t.id].premium);
      cb.addEventListener("change", async () => {
        cb.disabled = true;
        try {
          const res = await api({ action: "setTemplatePremium", template_id: t.id, premium: cb.checked ? "yes" : "no" });
          if (res && res.error) { cb.checked = !cb.checked; toast(res.error, "error"); }
          else {
            builtinFlags[t.id] = { premium: cb.checked };
            toast(`${t.name}: ${cb.checked ? "⭐ Premium" : "not Premium"}`, "success");
            renderPanel();
          }
        } finally { cb.disabled = false; }
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(t.name));
      list.appendChild(lab);
    });
  }

  async function loadRegistry() {
    if (typeof TEMPLATE_REGISTRY !== "undefined") return;
    await new Promise(resolve => {
      const sc = document.createElement("script");
      sc.src = "card_templates/template_registry.js";
      sc.onload = resolve; sc.onerror = resolve;
      document.head.appendChild(sc);
    });
  }

  // Point the builder's live preview at the school we're designing for
  async function previewContextSchool() {
    if (!ctxSchool) return;
    for (let i = 0; i < 40 && !(window._tbAllSchools && window._tbAllSchools.length); i++) await new Promise(r => setTimeout(r, 100));
    const sel = document.getElementById("tbSchoolSelect");
    if (!sel || !window._tbAllSchools) return;
    if (sel.value !== ctxSchool.school && [...sel.options].some(o => o.value === ctxSchool.school)) {
      sel.value = ctxSchool.school;
      if (typeof window.loadPreviewStudents === "function") await window.loadPreviewStudents();
    }
  }

  /* ── start: wait until the page (and the builder's own script) is fully loaded ── */
  async function start() {
    if (!document.getElementById("tbName")) { console.warn("template_visibility.js: Template Builder fields not found"); return; }
    hookBuilder();
    buildTopArea();
    buildControls();
    try {
      const raw = await getSchools();
      const h = raw[0];
      allSchools = raw.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; });
    } catch (err) { allSchools = []; }
    ctxSchool = ctxCode ? (allSchools.find(s => String(s.school).toLowerCase() === ctxCode.toLowerCase()) || null) : null;
    if (ctxCode && !ctxSchool) toast("That school isn't available to you - designing without a specific school.", "error");
    try { const f = await api({ action: "getTemplateFlags" }); builtinFlags = (f && f.flags) || {}; } catch (err) { builtinFlags = {}; }
    await loadRegistry();
    await loadVendors();
    buildBuiltinPanel();
    fillContextSelect();
    setControls(null);
    renderPanel();
    labelTemplateList();
    previewContextSchool();
    setTimeout(() => { labelTemplateList(); renderPanel(); fillContextSelect(); }, 1500);   // the builder's list may still be loading
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();