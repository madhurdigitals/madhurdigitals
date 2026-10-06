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
    panel.innerHTML = `<h3 id="tvPanelTitle" style="margin:0 0 10px;">🪪 Card designs</h3><div id="tvPanelBody" style="font-size:13px; color:#6b7280;">Loading…</div>`;
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
      info.textContent = "";
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

  /* ── TEMPLATE GALLERY (current design on top, gallery behind "Change design") ── */
  const GALLERY_CSS = `
    #tvPanel .tv-current { display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
    #tvPanel .tv-current .tv-thumb { width:120px; height:100px; }
    #tvPanel .tv-current-text { flex:1; min-width:180px; }
    #tvPanel .tv-current-text .k { font-size:12px; color:#6b7280; }
    #tvPanel .tv-current-text .v { font-size:16px; font-weight:700; color:#111827; margin-top:2px; }
    #tvPanel .tv-actions { display:flex; gap:8px; flex-wrap:wrap; }
    #tvPanel .tv-btn { padding:8px 14px; border-radius:8px; border:1px solid #d1d5db; background:#fff; font-size:13px; font-weight:600; cursor:pointer; color:#374151; }
    #tvPanel .tv-btn:hover { background:#f3f4f6; }
    #tvPanel .tv-btn.primary { background:#0d6efd; border-color:#0d6efd; color:#fff; }
    #tvPanel .tv-btn.primary:hover { background:#0b5ed7; }
    #tvPanel .tv-btn:disabled { opacity:.55; cursor:not-allowed; }
    #tvPanel .tv-undo { margin-top:10px; padding:8px 12px; background:#f0fdf4; border:1px solid #86efac; border-radius:8px; font-size:13px; color:#166534; display:none; }
    #tvPanel .tv-undo a { color:#166534; font-weight:700; margin-left:8px; cursor:pointer; text-decoration:underline; }
    #tvPanel .tv-gallery { margin-top:14px; border-top:1px solid #f1f5f9; padding-top:12px; }
    #tvPanel .tv-chips { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
    #tvPanel .tv-chip { padding:5px 12px; border-radius:16px; border:1px solid #d1d5db; background:#fff; font-size:12px; font-weight:600; cursor:pointer; color:#374151; }
    #tvPanel .tv-chip.on { background:#0d6efd; border-color:#0d6efd; color:#fff; }
    #tvPanel .tv-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:12px; }
    #tvPanel .tv-card { border:1px solid #e5e7eb; border-radius:10px; padding:8px; background:#fff; position:relative; display:flex; flex-direction:column; gap:6px; }
    #tvPanel .tv-card.cur { border:2px solid #16a34a; }
    #tvPanel .tv-ribbon { position:absolute; top:6px; left:6px; background:#16a34a; color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:8px; z-index:2; }
    #tvPanel .tv-thumb { height:110px; border-radius:6px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; }
    #tvPanel .tv-thumb img { max-width:100%; max-height:100%; object-fit:contain; }
    #tvPanel .tv-thumb .ph { font-size:28px; color:#94a3b8; }
    #tvPanel .tv-mini { position:absolute; top:50%; left:50%; transform-origin:center center; pointer-events:none; }
    #tvPanel .tv-name { font-size:13px; font-weight:600; color:#111827; line-height:1.3; word-break:break-word; }
    #tvPanel .tv-tags { font-size:11px; color:#6b7280; }
    #tvPanel .tv-card-actions { display:flex; gap:6px; margin-top:auto; }
    #tvPanel .tv-card-actions .tv-btn { padding:6px 10px; font-size:12px; flex:1; }
    #tvPanel .tv-more { flex:0 0 auto !important; }
    #tvPanel .tv-menu { position:absolute; right:8px; bottom:42px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.12); z-index:5; display:none; min-width:150px; }
    #tvPanel .tv-menu.open { display:block; }
    #tvPanel .tv-menu button { display:block; width:100%; text-align:left; padding:9px 12px; border:none; background:#fff; font-size:13px; cursor:pointer; }
    #tvPanel .tv-menu button:hover { background:#f3f4f6; }
    #tvPanel .tv-empty { color:#9ca3af; font-size:13px; padding:10px 0; }`;

  let galleryOpen = false;
  let galleryFilter = "all";
  let lastUndo = null;          // { from, to } after "Use this design"

  function scopeOf(t) {
    if (!t.custom) return "builtin";
    const vis = visOf(t.row);          // the visibility lives on the template's row
    if (vis === "everyone") return "library";
    if (vis === "school") return "school";
    return "vendor";
  }

  // Every design this school (or this person) could pick, built-in + custom, as one list
  function galleryItems() {
    const reg = typeof TEMPLATE_REGISTRY !== "undefined" ? TEMPLATE_REGISTRY : [];
    const vid = ctxVendor();
    const customs = cache().filter(t => {
      const vis = visOf(t);
      if (!ctxSchool) return vendorMode ? (vis === "everyone" || editableByMe(t)) : true;
      if (vis === "everyone") return true;
      if (vis === "school") return String(t.owner_school || "").toLowerCase() === ctxSchool.school.toLowerCase();
      return String(t.vendor_id) === vid;
    }).map(t => ({ id: t.template_id, name: t.template_name, custom: true, row: t, premium: isPrem(t), editable: editableByMe(t) }));
    const builtins = reg.map(t => ({ id: t.id, name: t.name, custom: false, premium: !!(builtinFlags[t.id] && builtinFlags[t.id].premium) }));
    return customs.concat(builtins).map(x => Object.assign(x, { scope: scopeOf(x) }));
  }

  const SCOPE_LABEL = { school: "🏫 This school", vendor: vendorMode ? "🤝 My schools" : "🤝 Vendor's schools", library: "📚 Library", builtin: "🧩 Built-in" };
  const SCOPE_TAG   = { school: "🏫 Only this school", vendor: vendorMode ? "🤝 All my schools" : "🤝 Vendor's schools", library: "📚 Library", builtin: "🧩 Built-in · all schools" };

  function thumbHtml(item) {
    if (item.custom) {
      const bg = String(item.row.front_bg_link || "").split("|")[0];
      return bg && typeof getPhotoUrl === "function"
        ? `<img src="${esc(getPhotoUrl(bg, "w_400"))}" alt="" loading="lazy">`
        : `<span class="ph">🖼️</span>`;
    }
    return `<span class="ph" data-mini="${esc(item.id)}">🪪</span>`;
  }

  // Built-in designs: a live mini card with this school's data (falls back to an icon)
  const loadedBuiltins = {};
  async function renderBuiltinMinis(root) {
    if (typeof getTemplatePaths !== "function") return;
    const sample = (typeof getPreviewStudent === "function") ? getPreviewStudent() : { Name: "Student Name", Class: "5", Section: "A" };
    const school = ctxSchool || { school_name: "Your School", address: "School Address", contact: "9999999999" };
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
        if (!tpl || typeof tpl.renderFront !== "function") continue;
        const holder = el.parentElement;
        const mini = document.createElement("div");
        mini.className = `tv-mini card-size-${id} t2-card-${id}`;
        mini.innerHTML = tpl.renderFront(sample, school, { schoolCode: school.school || "" });
        el.replaceWith(mini);
        const w = mini.offsetWidth || 204, h = mini.offsetHeight || 325;
        const scale = Math.min((holder.clientWidth || 130) / w, (holder.clientHeight || 110) / h) * 0.95;
        mini.style.transform = `translate(-50%, -50%) scale(${scale})`;
      } catch (err) { /* keep the icon */ }
    }
  }

  function renderPanel() {
    const body = document.getElementById("tvPanelBody");
    if (!body) return;
    if (!document.getElementById("tvGalleryCss")) {
      const st = document.createElement("style"); st.id = "tvGalleryCss"; st.textContent = GALLERY_CSS; document.head.appendChild(st);
    }
    const title = document.getElementById("tvPanelTitle");
    title.textContent = ctxSchool ? `🪪 Card design for ${ctxSchool.school_name || ctxSchool.school}` : "🪪 Card designs";

    const items = galleryItems();
    const cur = ctxSchool ? String(ctxSchool.template || "") : "";
    const curItem = items.find(x => x.id === cur);
    if (!ctxSchool) galleryOpen = true;

    let html = "";
    // 1. What the school prints with now
    if (ctxSchool) {
      const canEditCur = curItem && curItem.custom && curItem.editable;
      html += `<div class="tv-current">
        <div class="tv-thumb">${curItem ? thumbHtml(curItem) : `<span class="ph">🪪</span>`}</div>
        <div class="tv-current-text">
          <div class="k">${esc(ctxSchool.school_name || ctxSchool.school)} prints its ID cards with</div>
          <div class="v">${curItem ? (curItem.premium ? "⭐ " : "") + esc(curItem.name) : esc(templateLabel(cur))}</div>
        </div>
        <div class="tv-actions">
          ${canEditCur ? `<button type="button" class="tv-btn" data-act="open" data-id="${esc(cur)}" title="Change this design in the editor below">✏️ Edit design</button>` : ""}
          <button type="button" class="tv-btn primary" data-act="toggle" title="See other designs this school can use">${galleryOpen ? "Hide designs ▴" : "🔄 Change design ▾"}</button>
        </div>
      </div>
      <div class="tv-undo" id="tvUndo"></div>`;
    }

    // 2. The gallery (behind "Change design" when designing for a school)
    if (galleryOpen) {
      const counts = { all: items.length };
      ["school", "vendor", "library", "builtin"].forEach(k => { counts[k] = items.filter(x => x.scope === k).length; });
      if (!counts[galleryFilter]) galleryFilter = "all";
      const chip = (k, label) => counts[k] ? `<button type="button" class="tv-chip ${galleryFilter === k ? "on" : ""}" data-act="filter" data-id="${k}">${label} (${counts[k]})</button>` : "";
      const shown = items.filter(x => galleryFilter === "all" || x.scope === galleryFilter)
        .sort((a, b) => (a.id === cur ? -1 : b.id === cur ? 1 : 0));
      html += `<div class="tv-gallery">
        <div class="tv-chips">${chip("all", "All")}${chip("school", SCOPE_LABEL.school)}${chip("vendor", SCOPE_LABEL.vendor)}${chip("library", SCOPE_LABEL.library)}${chip("builtin", SCOPE_LABEL.builtin)}</div>
        <div class="tv-grid">${shown.length ? shown.map(x => cardHtml(x, cur)).join("") : `<div class="tv-empty">No designs here yet.</div>`}</div>
      </div>`;
    }
    body.innerHTML = html;
    body.onclick = onPanelClick;
    if (lastUndo && ctxSchool) showUndo();
    renderBuiltinMinis(body);
  }

  function cardHtml(x, cur) {
    const isCur = x.id === cur;
    const premLocked = x.premium && !amAdmin;
    let primary = "";
    if (ctxSchool && canSetSchoolTemplate) {
      primary = isCur ? `<button type="button" class="tv-btn" disabled>✓ In use</button>`
        : premLocked ? `<button type="button" class="tv-btn" disabled title="Premium - please contact Madhur Digitals">⭐ Premium</button>`
        : `<button type="button" class="tv-btn primary" data-act="use" data-id="${esc(x.id)}" title="${esc(ctxSchool.school_name || ctxSchool.school)} will print with this design">Use this design</button>`;
    } else if (x.custom) {
      primary = x.editable ? `<button type="button" class="tv-btn primary" data-act="open" data-id="${esc(x.id)}">✏️ Edit design</button>`
                           : `<button type="button" class="tv-btn primary" data-act="dup" data-id="${esc(x.id)}">⧉ Make a copy</button>`;
    }
    const menu = [];
    if (x.custom && x.editable && (ctxSchool && canSetSchoolTemplate)) menu.push(`<button type="button" data-act="open" data-id="${esc(x.id)}">✏️ Edit design</button>`);
    if (x.custom) menu.push(`<button type="button" data-act="dup" data-id="${esc(x.id)}">⧉ Make a copy</button>`);
    if (!x.custom) menu.push(`<button type="button" disabled title="Built-in designs are made in code and can't be edited here">🧩 Built-in — can't be edited</button>`);
    return `<div class="tv-card ${isCur ? "cur" : ""}">
      ${isCur ? `<span class="tv-ribbon">✓ In use</span>` : ""}
      <div class="tv-thumb">${thumbHtml(x)}</div>
      <div class="tv-name">${x.premium ? "⭐ " : ""}${esc(x.name)}</div>
      <div class="tv-tags">${SCOPE_TAG[x.scope]}${x.premium ? " · ⭐ Premium" : ""}</div>
      <div class="tv-card-actions">${primary}
        <button type="button" class="tv-btn tv-more" data-act="menu" title="More">⋯</button>
      </div>
      <div class="tv-menu">${menu.join("")}</div>
    </div>`;
  }

  function showUndo() {
    const el = document.getElementById("tvUndo");
    if (!el || !lastUndo) return;
    el.style.display = "block";
    el.innerHTML = `✓ Changed to <b>${esc(templateLabel(lastUndo.to))}</b> — new cards will print with it.<a data-act="undo">Undo</a>`;
  }

  async function onPanelClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    document.querySelectorAll("#tvPanel .tv-menu.open").forEach(m => { if (act !== "menu" || m !== b.closest(".tv-card").querySelector(".tv-menu")) m.classList.remove("open"); });
    if (act === "toggle") { galleryOpen = !galleryOpen; renderPanel(); return; }
    if (act === "filter") { galleryFilter = id; renderPanel(); return; }
    if (act === "menu")   { b.closest(".tv-card").querySelector(".tv-menu").classList.toggle("open"); return; }
    if (act === "open") {
      document.getElementById("tbLoadSelect").value = id;
      window.handleLoadSelect();
      document.getElementById("tbName").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (act === "dup")  { openDuplicateDialog(id); return; }
    if (act === "undo") {
      const back = lastUndo && lastUndo.from;
      lastUndo = null;
      if (back) await useForSchool(back, true);
      return;
    }
    if (act === "use") {
      const old = b.textContent; b.disabled = true; b.textContent = "⏳ Saving…";
      const ok = await useForSchool(id);
      if (!ok) { b.disabled = false; b.textContent = old; }
    }
  }

  async function useForSchool(id, isUndo) {
    const from = String(ctxSchool.template || "");
    const res = await api({ action: "setSchoolTemplate", school: ctxSchool.school, template_id: id });
    if (res && res.error) { toast(res.error, "error"); return false; }
    ctxSchool.template = id;
    lastUndo = isUndo ? null : { from: from, to: id };
    galleryOpen = false;
    if (isUndo) toast(`Back to "${templateLabel(id)}"`, "success");
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