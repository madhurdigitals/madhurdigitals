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
   plus a "Build New Template" option. Requires api.js to be loaded (for API_URL). */
async function populateTemplateDropdownWithCustom(selectEl, selectedValue, requireSelection) {
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

  let optionsHtml = "";

  if (requireSelection) {
    optionsHtml += `<option value="" disabled ${!selectedValue ? "selected" : ""}>— Select Template —</option>`;
  }

  optionsHtml += `<optgroup label="Built-in Templates">`;
  optionsHtml += TEMPLATE_REGISTRY.map(t =>
    `<option value="${t.id}" ${t.id === selectedValue ? "selected" : ""}>${t.name}</option>`
  ).join("");
  optionsHtml += `</optgroup>`;

  if (customTemplates.length > 0) {
    optionsHtml += `<optgroup label="Custom Templates">`;
    optionsHtml += customTemplates.map(t =>
      `<option value="${t.template_id}" ${t.template_id === selectedValue ? "selected" : ""}>${t.template_name}</option>`
    ).join("");
    optionsHtml += `</optgroup>`;
  }

  optionsHtml += `<option value="__build_new__">➕ Build New Template...</option>`;

  selectEl.innerHTML = optionsHtml;
}