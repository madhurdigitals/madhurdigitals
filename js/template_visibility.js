/* =============================================
   template_visibility.js - Template Builder: TEMPLATES vs SCHOOL DESIGNS
   Loaded by template_builder.html with one line: <script src="js/template_visibility.js"></script>

   Two clear ideas:
     📐 TEMPLATES   = starting points (library / a vendor's / built-in). Never printed directly.
     🪪 DESIGNS     = a school's own cards. Made FROM a template: picking one opens an UNSAVED copy in
                      the editor; 💾 Save creates the school's design. A school can have several designs;
                      one is ★ Default (what printing uses unless another is chosen on the print page).
   Opened for a school (template_builder.html?school=CODE)  -> that school's designs.
   Opened without a school                                  -> template mode (designers edit templates).
   ============================================= */
(function () {
  /* ── who is this (read straight from the session - no dependency on auth.js) ── */
  const myRole  = String(sessionStorage.getItem("role") || "");
  let   myPerms = [];
  try { myPerms = JSON.parse(sessionStorage.getItem("permissions") || "[]") || []; } catch (err) { myPerms = []; }
  const myVendorId = String(sessionStorage.getItem("vendorId") || "1");
  const vendorMode = myVendorId !== "1" && myRole !== "admin";
  const amAdmin    = myRole === "admin";
  const canSetDefault = amAdmin || myPerms.includes("schools") || myPerms.includes("own_schools");

  const ctxCode = (new URLSearchParams(location.search).get("school") || "").trim();
  let ctxSchool = null, allSchools = [], tvVendors = [], builtinFlags = {};
  let draftFrom = null;           // { id, name } when the editor holds an unsaved copy of a template

  const esc   = v => String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const toast = (msg, type) => { if (typeof showToast === "function") showToast(msg, type); else alert(msg); };
  const visOf = t => { const v = String((t && t.visibility) || "").toLowerCase(); return (v === "vendor" || v === "school") ? v : "everyone"; };
  const isPrem = t => String((t && t.premium) || "").toLowerCase() === "yes";
  const cache = () => (typeof tbTemplatesCache !== "undefined" ? tbTemplatesCache : []);
  const registry = () => (typeof TEMPLATE_REGISTRY !== "undefined" ? TEMPLATE_REGISTRY : []);
  const schoolLabel = s => s ? (s.school_name || s.school) : "";
  const ctxVendor = () => ctxSchool ? (String(ctxSchool.vendor_id === undefined || ctxSchool.vendor_id === "" ? "1" : ctxSchool.vendor_id)) : (vendorMode ? myVendorId : "1");
  const vendorName = id => { const v = tvVendors.find(x => String(x.vendor_id) === String(id)); return v ? v.name : "the vendor"; };
  const api = async params => (await fetch(`${API_URL}?${new URLSearchParams(params).toString()}`)).json();

  function nameOf(id) {
    if (!id) return "—";
    const c = cache().find(t => t.template_id === id);
    if (c) return c.template_name;
    const b = registry().find(t => t.id === id);
    return b ? b.name : id;
  }
  function editableByMe(row) {
    if (!vendorMode || !row) return true;
    if (visOf(row) === "vendor") return String(row.vendor_id) === myVendorId;
    if (visOf(row) === "school") return allSchools.some(s => String(s.school).toLowerCase() === String(row.owner_school || "").toLowerCase());
    return false;
  }
  const isDesignOf = (t, code) => visOf(t) === "school" && String(t.owner_school || "").toLowerCase() === String(code).toLowerCase();

  /* ── look ── */
  const CSS = `
    #tvPanel h3 { margin:0 0 4px; }
    #tvPanel .tv-sub { font-size:13px; color:#6b7280; margin-bottom:12px; }
    #tvPanel .tv-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:12px; }
    #tvPanel .tv-card { border:1px solid #e5e7eb; border-radius:10px; padding:8px; background:#fff; position:relative; display:flex; flex-direction:column; gap:6px; }
    #tvPanel .tv-card.def { border:2px solid #f59e0b; }
    #tvPanel .tv-card.new { border:2px dashed #93c5fd; background:#f8fbff; align-items:center; justify-content:center; cursor:pointer; min-height:200px; color:#1d4ed8; font-weight:700; text-align:center; }
    #tvPanel .tv-card.new:hover { background:#eff6ff; }
    #tvPanel .tv-ribbon { position:absolute; top:6px; left:6px; background:#f59e0b; color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:8px; z-index:2; }
    .tv-thumb { height:110px; border-radius:6px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; }
    .tv-thumb img { max-width:100%; max-height:100%; object-fit:contain; }
    .tv-thumb .ph { font-size:28px; color:#94a3b8; }
    .tv-mini { position:absolute; top:50%; left:50%; pointer-events:none; }
    .tv-name { font-size:13px; font-weight:600; color:#111827; line-height:1.3; word-break:break-word; }
    .tv-tags { font-size:11px; color:#6b7280; }
    .tv-btn { padding:7px 12px; border-radius:8px; border:1px solid #d1d5db; background:#fff; font-size:12px; font-weight:600; cursor:pointer; color:#374151; }
    .tv-btn:hover { background:#f3f4f6; }
    .tv-btn.primary { background:#0d6efd; border-color:#0d6efd; color:#fff; }
    .tv-btn.primary:hover { background:#0b5ed7; }
    .tv-btn:disabled { opacity:.55; cursor:not-allowed; }
    .tv-card-actions { display:flex; gap:6px; margin-top:auto; }
    .tv-card-actions .tv-btn { flex:1; }
    .tv-card-actions .tv-more { flex:0 0 auto; }
    .tv-menu { position:absolute; right:8px; bottom:44px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.12); z-index:5; display:none; min-width:170px; }
    .tv-menu.open { display:block; }
    .tv-menu button { display:block; width:100%; text-align:left; padding:9px 12px; border:none; background:#fff; font-size:13px; cursor:pointer; }
    .tv-menu button:hover { background:#f3f4f6; }
    .tv-menu button:disabled { color:#9ca3af; cursor:not-allowed; }
    .tv-note { margin:0 0 12px; padding:9px 12px; border-radius:8px; font-size:13px; }
    .tv-note.info  { background:#eff6ff; border:1px solid #bfdbfe; color:#1e3a8a; }
    .tv-note.draft { background:#fffbeb; border:1px solid #fcd34d; color:#92400e; }
    .tv-chips { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
    .tv-chip { padding:5px 12px; border-radius:16px; border:1px solid #d1d5db; background:#fff; font-size:12px; font-weight:600; cursor:pointer; color:#374151; }
    .tv-chip.on { background:#0d6efd; border-color:#0d6efd; color:#fff; }
    #tvPicker .tv-box { background:#fff; border-radius:14px; padding:18px; width:900px; max-width:94%; max-height:86vh; overflow:auto; box-shadow:0 10px 40px rgba(0,0,0,.25); }`;

  /* ── page areas: "Designing for" bar + panel ── */
  function buildTopArea() {
    const container = document.querySelector(".tb-container");
    if (!container || document.getElementById("tvContextBar")) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const bar = document.createElement("div");
    bar.id = "tvContextBar"; bar.className = "card";
    bar.style.cssText = "display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 16px; margin-bottom:12px;";
    bar.innerHTML = `<b style="font-size:15px;">🎨 Designing for:</b>
      <select id="tvCtxSelect" title="Choose a school to make its card designs - or 'Templates' to work on starting points"
              style="padding:7px 10px; border-radius:7px; border:1px solid #d1d5db; min-width:240px;">
        <option value="">📐 Templates (starting points for all schools)</option>
      </select>`;
    container.insertBefore(bar, container.firstChild);
    document.getElementById("tvCtxSelect").addEventListener("change", e => {
      location.search = e.target.value ? "?school=" + encodeURIComponent(e.target.value) : "";
    });
    const panel = document.createElement("div");
    panel.id = "tvPanel"; panel.className = "card";
    panel.style.cssText = "padding:14px 16px; margin-bottom:12px;";
    panel.innerHTML = `<div id="tvPanelBody" style="font-size:13px; color:#6b7280;">Loading…</div>`;
    container.insertBefore(panel, bar.nextSibling);
  }

  function fillContextSelect() {
    const sel = document.getElementById("tvCtxSelect");
    if (!sel) return;
    sel.innerHTML = `<option value="">📐 Templates (starting points for all schools)</option>` +
      allSchools.map(s => `<option value="${esc(s.school)}">🏫 ${esc(schoolLabel(s))}</option>`).join("");
    sel.value = ctxSchool ? ctxSchool.school : "";
  }

  /* ── pictures ── */
  function thumbHtml(row, builtinId) {
    const base = builtinId || (row && row.base_template);
    if (base) return `<span class="ph" data-mini="${esc(base)}">🪪</span>`;
    const bg = row ? String(row.front_bg_link || "").split("|")[0] : "";
    return bg && typeof getPhotoUrl === "function" ? `<img src="${esc(getPhotoUrl(bg, "w_400"))}" alt="" loading="lazy">` : `<span class="ph">🖼️</span>`;
  }
  const loadedBuiltins = {};
  async function renderMinis(root) {
    if (typeof getTemplatePaths !== "function") return;
    const sample = (typeof getPreviewStudent === "function") ? getPreviewStudent() : { Name: "Student Name", Class: "5", Section: "A" };
    const sch = ctxSchool || { school_name: "Your School", address: "School Address", contact: "9999999999" };
    for (const el of root.querySelectorAll("[data-mini]")) {
      const id = el.getAttribute("data-mini");
      try {
        if (!loadedBuiltins[id]) {
          loadedBuiltins[id] = new Promise(resolve => {
            const p = getTemplatePaths(id);
            const css = document.createElement("link"); css.rel = "stylesheet"; css.href = p.css; document.head.appendChild(css);
            const js = document.createElement("script"); js.src = p.js; js.onload = resolve; js.onerror = resolve; document.head.appendChild(js);
          });
        }
        await loadedBuiltins[id];
        const tpl = window.CARD_TEMPLATES && window.CARD_TEMPLATES[id];
        if (!tpl || typeof tpl.renderFront !== "function" || !el.isConnected) continue;
        const holder = el.parentElement;
        const mini = document.createElement("div");
        mini.className = `tv-mini card-size-${id} t2-card-${id}`;
        mini.innerHTML = tpl.renderFront(sample, sch, { schoolCode: sch.school || "" });
        el.replaceWith(mini);
        const w = mini.offsetWidth || 204, h = mini.offsetHeight || 325;
        const scale = Math.min((holder.clientWidth || 140) / w, (holder.clientHeight || 110) / h) * 0.95;
        mini.style.transform = `translate(-50%, -50%) scale(${scale})`;
      } catch (err) { /* keep the icon */ }
    }
  }

  /* ── PANEL ── */
  function renderPanel() {
    const body = document.getElementById("tvPanelBody");
    if (!body) return;
    body.innerHTML = ctxSchool ? schoolPanelHtml() : templatePanelHtml();
    body.onclick = onPanelClick;
    renderMinis(body);
  }

  // A school: its own designs (★ Default first) + ➕ New design
  function schoolPanelHtml() {
    const def = String(ctxSchool.template || "");
    const designs = cache().filter(t => isDesignOf(t, ctxSchool.school))
      .sort((a, b) => (a.template_id === def ? -1 : b.template_id === def ? 1 : 0));
    const defIsOwn = designs.some(d => d.template_id === def);
    let html = `<h3>🪪 Card designs of ${esc(schoolLabel(ctxSchool))}</h3>
      <div class="tv-sub">Each design is this school's own. ★ Default is used for printing unless another design is chosen on the print page.</div>`;
    if (def && !defIsOwn) {
      html += `<div class="tv-note info">Right now ${esc(schoolLabel(ctxSchool))} prints with <b>${esc(nameOf(def))}</b>, a shared template.
        ${canSetDefault ? `<button type="button" class="tv-btn primary" data-act="own" data-id="${esc(def)}" style="margin-left:8px;" title="Make an editable copy that belongs to this school">Make it our own design</button>` : ""}</div>`;
    }
    if (draftFrom) html += draftNoteHtml();
    html += `<div class="tv-grid">` + designs.map(d => designCardHtml(d, def)).join("") +
      `<div class="tv-card new" data-act="new" title="Start a new design from a template">➕<br>New design</div></div>`;
    return html;
  }

  function draftNoteHtml() {
    return `<div class="tv-note draft">📝 <b>New design, not saved yet</b>${draftFrom.name ? ` — started from “${esc(draftFrom.name)}”` : ""}.
      Adjust it below, give it a name, then press <b>💾 Save Template</b>.</div>`;
  }

  function designCardHtml(d, def) {
    const isDef = d.template_id === def;
    const builtinBased = !!d.base_template;
    const editable = !builtinBased && editableByMe(d);
    const menu = [];
    if (!isDef && canSetDefault) menu.push(`<button type="button" data-act="default" data-id="${esc(d.template_id)}">★ Make default</button>`);
    if (!builtinBased) menu.push(`<button type="button" data-act="copy" data-id="${esc(d.template_id)}">⧉ Duplicate as another design</button>`);
    if (amAdmin && !builtinBased) menu.push(`<button type="button" data-act="tolib" data-id="${esc(d.template_id)}" title="Add a copy to the library as a starting point for every school - this design stays as it is">📚 Copy to the library</button>`);
    menu.push(isDef ? `<button type="button" disabled title="Make another design the default first">🗑 Delete (it's the default)</button>`
                    : `<button type="button" data-act="delete" data-id="${esc(d.template_id)}">🗑 Delete</button>`);
    return `<div class="tv-card ${isDef ? "def" : ""}">
      ${isDef ? `<span class="tv-ribbon">★ Default</span>` : ""}
      <div class="tv-thumb">${thumbHtml(d)}</div>
      <div class="tv-name">${esc(d.template_name)}</div>
      <div class="tv-tags">${builtinBased ? "🧩 Based on " + esc(nameOf(d.base_template)) : (d.copied_from ? "From " + esc(nameOf(d.copied_from)) : "&nbsp;")}</div>
      <div class="tv-card-actions">
        ${editable ? `<button type="button" class="tv-btn primary" data-act="edit" data-id="${esc(d.template_id)}">✏️ Edit</button>`
                   : `<button type="button" class="tv-btn" disabled title="Built-in designs are made in code and can't be edited here">🧩 Built-in</button>`}
        <button type="button" class="tv-btn tv-more" data-act="menu" title="More">⋯</button>
      </div>
      <div class="tv-menu">${menu.join("")}</div>
    </div>`;
  }

  // No school: template mode (starting points). School designs aren't shown here.
  function templatePanelHtml() {
    const templates = cache().filter(t => visOf(t) !== "school")
      .filter(t => !vendorMode || visOf(t) === "everyone" || editableByMe(t));
    let html = `<h3>📐 Templates — starting points</h3>
      <div class="tv-sub">Templates are never printed directly: a school's design is made from one. To make a school's card, choose the school above.</div>`;
    if (draftFrom) html += `<div class="tv-note draft">📝 <b>New template, not saved yet</b>${draftFrom.name ? ` — copied from “${esc(draftFrom.name)}”` : ""}. Choose “Who can use it”, then <b>💾 Save Template</b>.</div>`;
    html += `<div class="tv-grid">` + templates.map(t => {
      const editable = editableByMe(t);
      const scope = visOf(t) === "everyone" ? "📚 Library" : (vendorMode ? "🤝 Mine" : "🤝 " + esc(vendorName(t.vendor_id)));
      return `<div class="tv-card">
        <div class="tv-thumb">${thumbHtml(t)}</div>
        <div class="tv-name">${isPrem(t) ? "⭐ " : ""}${esc(t.template_name)}</div>
        <div class="tv-tags">${scope}${isPrem(t) ? " · ⭐ Premium" : ""}</div>
        <div class="tv-card-actions">
          ${editable ? `<button type="button" class="tv-btn primary" data-act="edit" data-id="${esc(t.template_id)}">✏️ Edit</button>`
                     : `<button type="button" class="tv-btn primary" data-act="copytpl" data-id="${esc(t.template_id)}" title="Make your own template from this one">⧉ Use as a start</button>`}
        </div></div>`;
    }).join("") + registry().map(b => `<div class="tv-card">
        <div class="tv-thumb">${thumbHtml(null, b.id)}</div>
        <div class="tv-name">${builtinFlags[b.id] && builtinFlags[b.id].premium ? "⭐ " : ""}${esc(b.name)}</div>
        <div class="tv-tags">🧩 Built-in · all schools</div>
        <div class="tv-card-actions"><button type="button" class="tv-btn" disabled title="Built-in templates are made in code">🧩 Built-in</button></div>
      </div>`).join("") +
      `<div class="tv-card new" data-act="blank" title="Design a new template from a blank card">➕<br>New template</div></div>`;
    return html;
  }

  /* ── the template picker (for ➕ New design) ── */
  let pickerFilter = "all";
  function pickerItems() {
    const vid = ctxVendor();
    const customs = cache().filter(t => visOf(t) === "everyone" || (visOf(t) === "vendor" && String(t.vendor_id) === vid))
      .map(t => ({ id: t.template_id, name: t.template_name, row: t, premium: isPrem(t), scope: visOf(t) === "everyone" ? "library" : "vendor" }));
    const builtins = registry().map(b => ({ id: b.id, name: b.name, builtin: true, premium: !!(builtinFlags[b.id] && builtinFlags[b.id].premium), scope: "builtin" }));
    return customs.concat(builtins);
  }

  function openPicker() {
    closePicker();
    const wrap = document.createElement("div");
    wrap.id = "tvPicker";
    wrap.style.cssText = "position:fixed; inset:0; background:rgba(15,23,42,.5); z-index:3000; display:flex; align-items:center; justify-content:center;";
    wrap.innerHTML = `<div class="tv-box"><div id="tvPickerBody"></div></div>`;
    wrap.addEventListener("click", e => { if (e.target === wrap) closePicker(); });
    document.body.appendChild(wrap);
    renderPicker();
  }
  function closePicker() { const p = document.getElementById("tvPicker"); if (p) p.remove(); }

  function renderPicker() {
    const body = document.getElementById("tvPickerBody");
    if (!body) return;
    const items = pickerItems();
    const counts = { all: items.length, library: 0, vendor: 0, builtin: 0 };
    items.forEach(x => counts[x.scope]++);
    if (!counts[pickerFilter]) pickerFilter = "all";
    const chip = (k, l) => counts[k] ? `<button type="button" class="tv-chip ${pickerFilter === k ? "on" : ""}" data-act="pfilter" data-id="${k}">${l} (${counts[k]})</button>` : "";
    const shown = items.filter(x => pickerFilter === "all" || x.scope === pickerFilter);
    body.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <h3 style="margin:0;">➕ New design for ${esc(schoolLabel(ctxSchool))}</h3>
        <button type="button" class="tv-btn" data-act="pclose">✕ Close</button>
      </div>
      <div class="tv-sub" style="font-size:13px; color:#6b7280; margin-bottom:10px;">Pick a template to start from. It opens as an unsaved copy in the editor with ${esc(schoolLabel(ctxSchool))}'s details — nothing is saved until you press 💾 Save.</div>
      <div class="tv-chips">${chip("all", "All")}${chip("library", "📚 Library")}${chip("vendor", "🤝 " + (vendorMode ? "My templates" : esc(vendorName(ctxVendor())) + "'s"))}${chip("builtin", "🧩 Built-in")}</div>
      <div class="tv-grid">
        <div class="tv-card new" data-act="pblank" style="min-height:190px;">⬜<br>Blank design</div>
        ${shown.map(x => `<div class="tv-card">
          <div class="tv-thumb">${x.builtin ? thumbHtml(null, x.id) : thumbHtml(x.row)}</div>
          <div class="tv-name">${x.premium ? "⭐ " : ""}${esc(x.name)}</div>
          <div class="tv-tags">${x.scope === "library" ? "📚 Library" : x.scope === "vendor" ? "🤝 Vendor" : "🧩 Built-in · not editable"}</div>
          <div class="tv-card-actions">${x.premium && !amAdmin
            ? `<button type="button" class="tv-btn" disabled title="Premium - please contact Madhur Digitals">⭐ Premium</button>`
            : `<button type="button" class="tv-btn primary" data-act="pick" data-id="${esc(x.id)}">Start with this</button>`}</div>
        </div>`).join("")}
      </div>`;
    body.onclick = onPickerClick;
    renderMinis(body);
  }

  async function onPickerClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    if (act === "pclose") return closePicker();
    if (act === "pfilter") { pickerFilter = id; return renderPicker(); }
    if (act === "pblank") { closePicker(); startBlank(); return; }
    if (act === "pick") {
      const item = pickerItems().find(x => x.id === id);
      closePicker();
      if (item.builtin) await createBuiltinDesign(item);
      else startFromTemplate(item.row, `${schoolLabel(ctxSchool)} – ${item.name}`);
    }
  }

  function scrollToEditor() {
    const el = document.getElementById("tbName");
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ── starting points → the editor (unsaved until 💾 Save) ── */
  function startFromTemplate(row, suggestedName) {
    document.getElementById("tbLoadSelect").value = row.template_id;
    originalLoad.call(window);                          // the builder loads the design into the editor
    tbEditingTemplateId = null;                         // ...but as a NEW, unsaved design
    document.getElementById("tbLoadSelect").value = "";
    document.getElementById("tbName").value = suggestedName;
    draftFrom = { id: row.template_id, name: row.template_name };
    setControls(null);
    renderPanel();
    scrollToEditor();
    toast("Opened an unsaved copy — adjust it, then press 💾 Save", "success");
  }

  function startBlank() {
    originalReset.call(window);
    draftFrom = { id: "", name: "" };
    if (ctxSchool) document.getElementById("tbName").value = `${schoolLabel(ctxSchool)} – Student Card`;
    setControls(null);
    renderPanel();
    scrollToEditor();
  }

  // Built-in (code) templates can't be edited: the design points to the built-in template
  async function createBuiltinDesign(item) {
    const name = prompt(`Name for ${schoolLabel(ctxSchool)}'s new design (based on ${item.name}):`, `${schoolLabel(ctxSchool)} – ${item.name}`);
    if (name === null) return;
    const res = await api({ action: "saveCustomTemplate", template_name: name || item.name, base_template: item.id,
                            visibility: "school", owner_school: ctxSchool.school, layout_json: "{}", orientation: "" });
    if (res && res.error) { toast(res.error, "error"); return; }
    const hasOwn = cache().some(t => isDesignOf(t, ctxSchool.school));
    await window.loadTemplateList();
    if (canSetDefault && (!hasOwn || confirm(`Make “${name}” the default design for ${schoolLabel(ctxSchool)}?`))) await setDefault(res.template_id);
    toast("Design created ✓", "success");
  }

  async function setDefault(id) {
    const res = await api({ action: "setSchoolTemplate", school: ctxSchool.school, template_id: id });
    if (res && res.error) { toast(res.error, "error"); return false; }
    ctxSchool.template = id;
    renderPanel();
    toast(`★ “${nameOf(id)}” is now the default design`, "success");
    return true;
  }

  async function onPanelClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    document.querySelectorAll("#tvPanel .tv-menu.open").forEach(m => { if (act !== "menu" || m !== b.closest(".tv-card").querySelector(".tv-menu")) m.classList.remove("open"); });
    if (act === "menu") { b.closest(".tv-card").querySelector(".tv-menu").classList.toggle("open"); return; }
    if (act === "new") { openPicker(); return; }
    if (act === "blank") { startBlank(); return; }
    if (act === "edit") {
      draftFrom = null;
      document.getElementById("tbLoadSelect").value = id;
      window.handleLoadSelect();
      renderPanel();
      scrollToEditor();
      return;
    }
    if (act === "copytpl" || act === "copy") {
      const row = cache().find(t => t.template_id === id);
      if (row) startFromTemplate(row, act === "copy" ? `${row.template_name} (2)` : `${row.template_name} (my version)`);
      return;
    }
    if (act === "own") {
      const row = cache().find(t => t.template_id === id);
      if (row) { startFromTemplate(row, `${schoolLabel(ctxSchool)} – ${row.template_name}`); document.getElementById("tvUseNow").checked = true; }
      else { const b2 = registry().find(x => x.id === id); if (b2) await createBuiltinDesign({ id: b2.id, name: b2.name }); }
      return;
    }
    if (act === "default") { await setDefault(id); return; }
    if (act === "tolib") {
      const name = prompt("Name for the library template (remove the school's own name/logo from it afterwards if needed):", nameOf(id) + " (Library)");
      if (name === null) return;
      const res = await api({ action: "copyTemplateToLibrary", template_id: id, template_name: name });
      if (res && res.error) { toast(res.error, "error"); return; }
      await window.loadTemplateList();
      toast("📚 Added to the library as a starting point ✓", "success");
      return;
    }
    if (act === "delete") {
      if (!confirm(`Delete the design “${nameOf(id)}”? This can't be undone.`)) return;
      const res = await api({ action: "deleteCustomTemplate", template_id: id });
      if (res && res.error) { toast(res.error, "error"); return; }
      await window.loadTemplateList();
      toast("Design deleted", "success");
    }
  }

  /* ── controls next to Template Name ── */
  function buildControls() {
    const nameInput = document.getElementById("tbName");
    if (!nameInput || document.getElementById("tvVisibility")) return;
    const nameField = nameInput.closest(".tb-field");
    const wrap = document.createElement("div");
    wrap.className = "tb-field"; wrap.id = "tvWrap";
    wrap.innerHTML = `
      <label id="tvWrapLabel">Who can use it</label>
      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
        <select id="tvVisibility" title="Which schools may start from this template">
          <option value="everyone">📚 Library (everyone)</option>
          <option value="vendor">${vendorMode ? "🤝 All my schools" : "🤝 A vendor's schools"}</option>
          <option value="school">🏫 One school</option>
        </select>
        <select id="tvVendor" style="display:none;"></select>
        <select id="tvSchool" style="display:none;"></select>
        <label id="tvPremiumWrap" style="display:none; font-size:12px; text-transform:none; color:#92400e; gap:4px; align-items:center;" title="Premium: shown with ⭐ - only an admin can start a school's design from it">
          <input type="checkbox" id="tvPremium" style="min-width:0;"> ⭐ Premium</label>
        <label id="tvUseNowWrap" style="display:none; font-size:12px; text-transform:none; color:#92400e; gap:4px; align-items:center;" title="Printing uses the default design unless another is chosen on the print page">
          <input type="checkbox" id="tvUseNow" style="min-width:0;"> <span id="tvUseNowText">★ Make it the default design</span></label>
      </div>
      <div id="tvNote" style="font-size:11px; color:#b45309; margin-top:3px; display:none;"></div>`;
    nameField.parentNode.insertBefore(wrap, nameField.nextSibling);
    document.getElementById("tvVisibility").addEventListener("change", showOwnerPicker);
    if (vendorMode) document.querySelector('#tvVisibility option[value="everyone"]').remove();
    document.getElementById("tbName").placeholder = ctxSchool ? "e.g. Student Card 2026-27" : "e.g. Sunrise Blue";
  }

  function showOwnerPicker() {
    const sel = document.getElementById("tvVisibility");
    if (ctxSchool) {
      // A school's design: always this school's own - no visibility choice, only "★ default"
      document.getElementById("tvWrapLabel").textContent = "Design of " + schoolLabel(ctxSchool);
      sel.style.display = "none";
      document.getElementById("tvVendor").style.display = "none";
      document.getElementById("tvSchool").style.display = "none";
      document.getElementById("tvPremiumWrap").style.display = "none";
      document.getElementById("tvUseNowWrap").style.display = canSetDefault ? "flex" : "none";
      return;
    }
    const vis = sel.value;
    document.getElementById("tvVendor").style.display = (vis === "vendor" && !vendorMode) ? "" : "none";
    document.getElementById("tvSchool").style.display = vis === "school" ? "" : "none";
    document.getElementById("tvPremiumWrap").style.display = (amAdmin && vis === "everyone") ? "flex" : "none";
    document.getElementById("tvUseNowWrap").style.display = "none";
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
    document.querySelector('#tvVisibility option[value="vendor"]').disabled = !(amAdmin && myPerms.includes("vendors") && tvVendors.length);
  }

  function fillSchools(keep) {
    const sel = document.getElementById("tvSchool");
    const want = keep !== undefined ? keep : sel.value;
    sel.innerHTML = allSchools.map(s => `<option value="${esc(s.school)}">${esc(schoolLabel(s))}</option>`).join("");
    if (want && allSchools.some(s => String(s.school) === String(want))) sel.value = want;
  }

  function note(text) { const el = document.getElementById("tvNote"); el.textContent = text || ""; el.style.display = text ? "" : "none"; }

  function setControls(row) {
    const sel = document.getElementById("tvVisibility");
    if (!row) {
      sel.value = vendorMode ? "vendor" : "everyone";
      document.getElementById("tvPremium").checked = false;
      // a school's first own design becomes the default by default
      document.getElementById("tvUseNow").checked = !!ctxSchool && !cache().some(t => isDesignOf(t, ctxSchool.school));
      note("");
      showOwnerPicker();
      return;
    }
    if (vendorMode) sel.value = visOf(row) === "school" && editableByMe(row) ? "school" : "vendor";
    else {
      sel.value = visOf(row);
      if (visOf(row) === "vendor") document.getElementById("tvVendor").value = String(row.vendor_id || "");
    }
    fillSchools(visOf(row) === "school" ? String(row.owner_school || "") : undefined);
    document.getElementById("tvPremium").checked = isPrem(row);
    document.getElementById("tvUseNow").checked = false;
    showOwnerPicker();
    if (!editableByMe(row)) {
      tbEditingTemplateId = null;
      note("This isn't yours, so saving creates your own copy - the original stays as it is.");
    } else note("");
  }

  function currentChoice() {
    if (ctxSchool) return { visibility: "school", owner_school: ctxSchool.school, vendor_id: "" };
    const vis = document.getElementById("tvVisibility").value;
    const c = { visibility: vis,
                vendor_id: vis === "vendor" && !vendorMode ? document.getElementById("tvVendor").value : "",
                owner_school: vis === "school" ? document.getElementById("tvSchool").value : "" };
    if (amAdmin && vis === "everyone") c.premium = document.getElementById("tvPremium").checked ? "yes" : "no";
    return c;
  }

  /* ── when the builder saves: add who-can-use-it + where it started from; then ★ default ── */
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : (input && input.url);
      const m = url && url.indexOf(API_URL) === 0 && /[?&]action=(saveCustomTemplate|updateCustomTemplate)(&|$)/.exec(url);
      if (m && !/[?&]base_template=/.test(url)) {
        const u = new URL(url);
        const c = currentChoice();
        if (m[1] === "saveCustomTemplate") { delete c.premium; if (draftFrom && draftFrom.id) c.copied_from = draftFrom.id; }
        Object.keys(c).forEach(k => u.searchParams.set(k, c[k]));
        const makeDefault = ctxSchool && canSetDefault && document.getElementById("tvUseNow").checked;
        const editingId = u.searchParams.get("template_id");
        return originalFetch.call(this, u.toString(), init).then(async res => {
          try {
            const j = await res.clone().json();
            if (j && !j.error) {
              draftFrom = null;
              const id = j.template_id || editingId;
              if (makeDefault && id && String(ctxSchool.template) !== String(id)) await setDefault(id);
            }
          } catch (err) { /* the builder shows the save result itself */ }
          return res;
        });
      }
    } catch (err) { /* fall through */ }
    return originalFetch.apply(this, arguments);
  };

  /* ── follow the builder ── */
  let originalLoad = function () {}, originalReset = function () {};
  function hookBuilder() {
    if (typeof window.handleLoadSelect === "function" && !window.handleLoadSelect.__tv) {
      originalLoad = window.handleLoadSelect;
      window.handleLoadSelect = function () {
        originalLoad.apply(this, arguments);
        draftFrom = null;
        setControls(cache().find(r => r.template_id === document.getElementById("tbLoadSelect").value) || null);
        renderPanel();
      };
      window.handleLoadSelect.__tv = true;
    }
    if (typeof window.resetBuilder === "function" && !window.resetBuilder.__tv) {
      originalReset = window.resetBuilder;
      window.resetBuilder = function () { originalReset.apply(this, arguments); draftFrom = null; setControls(null); renderPanel(); };
      window.resetBuilder.__tv = true;
    }
    if (typeof window.loadTemplateList === "function" && !window.loadTemplateList.__tv) {
      const originalList = window.loadTemplateList;
      window.loadTemplateList = async function () {
        await originalList.apply(this, arguments);
        labelTemplateList();
        renderPanel();
      };
      window.loadTemplateList.__tv = true;
    }
  }

  function labelTemplateList() {
    document.querySelectorAll("#tbLoadSelect option").forEach(o => {
      const row = cache().find(r => r.template_id === o.value);
      if (!row) return;
      const tag = visOf(row) === "school" ? "🪪 " + (allSchools.find(s => String(s.school).toLowerCase() === String(row.owner_school).toLowerCase()) ? schoolLabel(allSchools.find(s => String(s.school).toLowerCase() === String(row.owner_school).toLowerCase())) : row.owner_school)
                : visOf(row) === "vendor" ? "📐 Vendor template" : "📐 Library template";
      o.textContent = `${isPrem(row) ? "⭐ " : ""}${row.template_name}  ·  ${tag}`;
    });
  }

  /* ── admins: ⭐ Premium for built-in (code) templates ── */
  function buildBuiltinPanel() {
    if (!amAdmin || ctxSchool || document.getElementById("tvBuiltinPanel") || typeof TEMPLATE_REGISTRY === "undefined") return;
    const anchor = document.getElementById("tvWrap");
    if (!anchor) return;
    const panel = document.createElement("div");
    panel.id = "tvBuiltinPanel";
    panel.style.cssText = "width:100%; margin-top:6px; padding:8px 10px; border:1px dashed #f59e0b; border-radius:8px; background:#fffbeb; font-size:12px;";
    panel.innerHTML = `<b>⭐ Premium built-in templates</b><span style="color:#92400e;"> — only an admin can start a school's design from a Premium one.</span>
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
          else { builtinFlags[t.id] = { premium: cb.checked }; toast(`${t.name}: ${cb.checked ? "⭐ Premium" : "not Premium"}`, "success"); renderPanel(); }
        } finally { cb.disabled = false; }
      });
      lab.appendChild(cb); lab.appendChild(document.createTextNode(t.name)); list.appendChild(lab);
    });
  }

  async function loadRegistry() {
    if (typeof TEMPLATE_REGISTRY !== "undefined") return;
    await new Promise(resolve => {
      const sc = document.createElement("script"); sc.src = "card_templates/template_registry.js";
      sc.onload = resolve; sc.onerror = resolve; document.head.appendChild(sc);
    });
  }

  async function previewContextSchool() {
    if (!ctxSchool) return;
    for (let i = 0; i < 40 && !(window._tbAllSchools && window._tbAllSchools.length); i++) await new Promise(r => setTimeout(r, 100));
    const sel = document.getElementById("tbSchoolSelect");
    if (!sel) return;
    if (sel.value !== ctxSchool.school && [...sel.options].some(o => o.value === ctxSchool.school)) {
      sel.value = ctxSchool.school;
      if (typeof window.loadPreviewStudents === "function") await window.loadPreviewStudents();
    }
  }

  /* ── start ── */
  async function start() {
    if (!document.getElementById("tbName")) { console.warn("template_visibility.js: Template Builder fields not found"); return; }
    hookBuilder();
    try {
      const raw = await getSchools();
      const h = raw[0];
      allSchools = raw.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; });
    } catch (err) { allSchools = []; }
    ctxSchool = ctxCode ? (allSchools.find(s => String(s.school).toLowerCase() === ctxCode.toLowerCase()) || null) : null;
    buildTopArea();
    buildControls();
    if (ctxCode && !ctxSchool) toast("That school isn't available to you - showing templates instead.", "error");
    try { const f = await api({ action: "getTemplateFlags" }); builtinFlags = (f && f.flags) || {}; } catch (err) { builtinFlags = {}; }
    await loadRegistry();
    await loadVendors();
    buildBuiltinPanel();
    fillContextSelect();
    setControls(null);
    renderPanel();
    labelTemplateList();
    previewContextSchool();
    setTimeout(() => { labelTemplateList(); renderPanel(); }, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();