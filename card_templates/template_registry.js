/* =============================================
   template_registry.js
   - Lightweight metadata only — no render code here.
   - Actual render logic lives in each template's own folder,
     loaded on demand by print_student.js.
   ============================================= */

const TEMPLATE_REGISTRY = [
  { id: "template_1", name: "Template 1" },
  { id: "template_2", name: "Template 2" },
  { id: "template_3", name: "Template 3" },
  { id: "template_4", name: "Template 4" },
  { id: "template_5", name: "Template 5" }
  // 🔥 Future templates just get added here — one line each.
  // No other file needs to change when a new template is added,
  // as long as its files live at card_templates/{id}/{id}.js and {id}.css
];

/* Builds the folder-based path for a template's JS/CSS files.
   Always derived from the id — no hardcoded exceptions. */
function getTemplatePaths(templateId) {
  return {
    js:  `card_templates/${templateId}/${templateId}.js`,
    css: `card_templates/${templateId}/${templateId}.css`
  };
}

/* Returns the id of the first template in the registry.
   Used as the dynamic fallback — never a hardcoded template name. */
function getFallbackTemplateId() {
  return TEMPLATE_REGISTRY.length > 0 ? TEMPLATE_REGISTRY[0].id : null;
}

/* Resolves whichever template a school should actually use:
   - if the school has a valid, registered template → use it
   - otherwise → fall back to the first entry in the registry */
function resolveTemplateId(schoolTemplateValue) {
  const exists = TEMPLATE_REGISTRY.some(t => t.id === schoolTemplateValue);
  return exists ? schoolTemplateValue : getFallbackTemplateId();
}

/* Populates a <select> dropdown with all registered templates.
   If requireSelection is true, adds a blank placeholder option
   and does NOT auto-select anything (used for Add School).
   If false, pre-selects the resolved/current value (used for Edit School). */
function populateTemplateDropdown(selectEl, selectedValue, requireSelection) {
  let optionsHtml = "";

  if (requireSelection) {
    optionsHtml += `<option value="" disabled ${!selectedValue ? "selected" : ""}>— Select Template —</option>`;
  }

  optionsHtml += TEMPLATE_REGISTRY.map(t =>
    `<option value="${t.id}" ${t.id === selectedValue ? "selected" : ""}>${t.name}</option>`
  ).join("");

  selectEl.innerHTML = optionsHtml;
}

/* Populates a dropdown with BOTH built-in templates AND custom templates,
   plus a "Build New Template" option. Requires api.js to be loaded (for API_URL).
   forSchool (optional): { school: "code", vendorId: "3" } - then only the custom templates that
   school may use are offered: the library (everyone), its vendor's private ones and its own private
   ones. The currently selected template is always kept. Without forSchool: every template (as before). */
async function populateTemplateDropdownWithCustom(selectEl, selectedValue, requireSelection, forSchool) {
  let customTemplates = [];

  try {
    const params = new URLSearchParams({ action: "getCustomTemplates" });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    const raw = await res.json();
    if (raw && raw.length > 1) {
      const headers = raw[0];
      customTemplates = raw.slice(1).map(r => {
        let obj = {};
        headers.forEach((h, i) => obj[h] = r[i]);
        return obj;
      });
    }
  } catch (err) {
    console.warn("Could not load custom templates:", err);
  }

  // Which built-in templates are Premium (marked by an admin)
  let builtinFlags = {};
  try {
    const fr = await fetch(`${API_URL}?${new URLSearchParams({ action: "getTemplateFlags" }).toString()}`);
    const fj = await fr.json();
    if (fj && fj.flags) builtinFlags = fj.flags;
  } catch (err) { /* no flags: nothing premium */ }
  const amAdminB = (typeof getRole === "function") && getRole() === "admin";

  let optionsHtml = "";

  if (requireSelection) {
    optionsHtml += `<option value="" disabled ${!selectedValue ? "selected" : ""}>— Select Template —</option>`;
  }

  optionsHtml += `<optgroup label="Built-in Templates (all schools)">`;
  optionsHtml += TEMPLATE_REGISTRY.map(t => {
    const prem   = !!(builtinFlags[t.id] && builtinFlags[t.id].premium);
    const locked = prem && !amAdminB && t.id !== selectedValue;
    const label  = (prem ? "⭐ " : "") + t.name + (locked ? "  (Premium — contact Madhur Digitals)" : "");
    return `<option value="${t.id}" ${t.id === selectedValue ? "selected" : ""} ${locked ? "disabled" : ""}>${label}</option>`;
  }).join("");
  optionsHtml += `</optgroup>`;

  const esc  = v => String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const vis  = t => { const v = String(t.visibility || "").toLowerCase(); return (v === "vendor" || v === "school") ? v : "everyone"; };
  const amAdmin   = (typeof getRole === "function") && getRole() === "admin";
  const isPremium = t => String(t.premium || "").toLowerCase() === "yes";
  const opt  = t => {
    const locked = isPremium(t) && !amAdmin && t.template_id !== selectedValue;
    const label  = (isPremium(t) ? "⭐ " : "") + t.template_name + (locked ? "  (Premium — contact Madhur Digitals)" : "");
    return `<option value="${esc(t.template_id)}" ${t.template_id === selectedValue ? "selected" : ""} ${locked ? "disabled" : ""}>${esc(label)}</option>`;
  };
  const fits = t => {
    if (!forSchool) return true;
    if (vis(t) === "everyone") return true;
    if (vis(t) === "vendor") return String(t.vendor_id || "").trim() === String(forSchool.vendorId || "1");
    return String(t.owner_school || "").trim().toLowerCase() === String(forSchool.school || "").trim().toLowerCase();
  };
  const groups = [
    [forSchool ? "📚 Template Library"        : "📚 Template Library",     customTemplates.filter(t => vis(t) === "everyone" && fits(t))],
    [forSchool ? "🤝 This vendor's templates" : "🤝 Private to a vendor",  customTemplates.filter(t => vis(t) === "vendor"   && fits(t))],
    [forSchool ? "🏫 This school's templates" : "🏫 Private to a school",  customTemplates.filter(t => vis(t) === "school"   && fits(t))]
  ];
  groups.forEach(([label, list]) => {
    if (list.length) optionsHtml += `<optgroup label="${label}">` + list.map(opt).join("") + `</optgroup>`;
  });
  // The school keeps its current template even if it would not normally be offered
  const current = customTemplates.find(t => t.template_id === selectedValue);
  if (current && !fits(current)) {
    optionsHtml += `<optgroup label="Current template">` + opt(current) + `</optgroup>`;
  }

  optionsHtml += `<option value="__build_new__">➕ Build New Template...</option>`;

  selectEl.innerHTML = optionsHtml;
}