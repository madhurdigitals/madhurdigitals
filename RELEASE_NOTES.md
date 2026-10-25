# Madhur Digitals — Phase 2 Release

Everything since Phase 0/1 is in this one bundle: vendor logins and staff, Max users, permissions,
deleted-users bin, suspension, branding (3 levels), templates (visibility, Premium, Template Builder
permission), school designs (★ Default, several per school) and the print-page design choice.

All files are **complete replacements**. Applying them is safe even if you already applied some earlier —
you end up with exactly the tested combination (390 automated tests passing on these exact files).

---

## 0. Before you start (5 minutes) — your way back

1. **GitHub** (PowerShell, in the project folder):
   ```
   git switch main
   git pull
   git tag prod-before-phase2
   git push origin prod-before-phase2
   ```
2. **Apps Script** → Deploy → Manage deployments → write down the **current version number**.
3. **Google Sheet** → File → Version history → **Name current version** → `Before Phase 2`.

## 1. Strongly recommended: try it on a copy first (staging)

1. Google Sheet → File → **Make a copy** ("Madhur STAGING").
2. Apps Script → Overview → **Make a copy** of the project. In the copy, change only `SHEET_ID`
   (top of Code.gs) to the copy's ID (the long code in its URL). Paste this release's Code.gs first, then change SHEET_ID.
3. In the copy: **Deploy → New deployment → Web app** → copy its URL.
4. On your computer, in a **separate copy of the site folder**, apply section 3 below and set
   `API_URL` in `js/api.js` to the staging URL. Open the pages locally and run the checklist (section 5).
5. Only when everything passes → do it for real (sections 2–4). Never commit the staging API_URL.

## 2. Server (Apps Script — the real one)

1. Paste **apps_script/Code.gs** (4385 lines; line 173 `var AUTH_MODE = "enforce";`). Save.
2. Run **setupPhase2** once from the editor (safe to run again — it only adds missing columns).
3. **Deploy → Manage deployments → ✏️ → New version → Deploy.**
   The new server keeps working with the old pages, so the site doesn't break while you do step 3.

## 3. Pages — replace these files

| File | Lines | Check (Ctrl+F) |
|---|---|---|
| js/api.js | 867 | `const POWERED_BY_URL` |
| js/auth.js | 157 | `vendorId` |
| js/protect.js | 173 | `"template_builder.html":  "templates"` |
| js/template_visibility.js **(new)** | 703 | `function hookSave` |
| js/print_student.js | 869 | `function setupDesignChoice` |
| card_templates/template_registry.js | 140 | `Built-in Templates (all schools)` |
| dashboard.html | 234 | `showSchoolSelector('templates')` |
| manage_users.html | 1148 | `templatesPermBox` |
| manage_vendors.html | 1004 | `id="pv_branding"` |
| add_school.html | 487 | `function refreshTemplateChoices` |
| school_management.html | 533 | `vendor-mode` |

### Small edits in your own files (skip any you already did — use Ctrl+F to check)

**a) login.html** — `protect.js` must load first. In the `<head>`:
```html
  <script src="js/protect.js"></script>
  <script src="js/api.js"></script>
  <script src="js/auth.js"></script>
```

**b) template_builder.html** — two lines:
- near the top, the renderer path: `<script src="js/custom_template_renderer.js"></script>`
  (was `custom_template_renderer.js` without `js/`)
- at the very end, between `</script>` and `</body>`:
  ```html
  <script src="js/template_visibility.js"></script>
  ```

**c) print_student.html** — directly below `<input id="searchName" placeholder="Search Name">`:
```html

    <!-- CARD DESIGN (only shown when the school has more than one design) -->
    <div id="designChoiceWrap" style="display:none; margin-top:12px;">
      <b>Card design:</b>
      <select id="designSelect" onchange="switchDesign(this.value)" style="margin-left:6px; padding:6px 10px; border-radius:6px;"></select>
    </div>
```

**d) js/dashboard.js** — three places:
1. In `filterActionCards`, replace
   ```javascript
       const perm = card.getAttribute("data-permission");
       if (!userPermissions.includes(perm)) {
   ```
   with
   ```javascript
       const perms = card.getAttribute("data-permission").split("|");   // any one is enough
       if (!perms.some(p => userPermissions.includes(p))) {
   ```
2. In `loadSchoolsForPopup`, directly below the `if (selectedMode === "form") { … }` block:
   ```javascript
     if (selectedMode === "templates") {
       dropdown.innerHTML += `<option value="__none__">🎨 No specific school (library / all my schools)</option>`;
     }
   ```
3. In `continueAction`, directly below `if (!selectedValue) { alert("Please select a school"); return; }`:
   ```javascript
     if (mode === "templates") {
       window.location.href = selectedValue === "__none__"
         ? "template_builder.html"
         : "template_builder.html?school=" + encodeURIComponent(selectedValue);
       return;
     }
   ```

**e) js/restore_student.js** (numeric school codes like 224145) — the filter line:
`(sch === "" || String(s.school) === String(sch))`

**f) js/school_form.js** (numeric school codes) — the school lookup:
```javascript
  schoolInfo = schools.find(
    s => s.school !== "" && s.school !== null && s.school !== undefined && school &&
         String(s.school).toLowerCase() === String(school).toLowerCase()
  );
```

## 4. Publish

```
git switch release/phase2
git add -A
git commit -m "Phase 2 release bundle"
git push
```
GitHub → Pull request → **Merge** → wait for the green ✅ in Actions.

Then: **everyone logs out, logs in again and presses Ctrl+F5** (new permissions + vendor number load at login).
Tick **🎨 Template Builder** on Manage Users for any **employee** who designs templates (admins have it automatically).

## 5. Test checklist

**Admin**
- [ ] Login, dashboard loads; cards: Manage Schools, Manage Users, Manage Vendors, 🎨 Template Builder
- [ ] Manage Users: tabs + search; Activate/Deactivate shows ⏳; 🗑 Delete → Deleted tab → Restore (choose active/inactive)
- [ ] Manage Vendors: Users "x / max", Branding dropdown, 👤 Logins, 🔗 Link (branded vendors only)
- [ ] School Management → Edit: template list grouped; ⭐ Premium shown
- [ ] Template Builder → choose a school → "Card designs of …" → ➕ New design → Start with this → 💾 Save shows ⏳ then "✓ Saved"
- [ ] Print page for: a school with a built-in template, a custom design, and one with 2 designs (dropdown)
- [ ] Add a student; Restore a deleted student

**Employee** (your staff) — dashboard shows only allowed cards; all schools visible; add/print works

**Vendor login** (tv_owner) — only its schools; Manage own users (limit message); Edit own schools; branded look if set

**School login** (tv_test) — only its school; add/print; no admin cards

**Branded link** — `login.html?v=test-vendor` (if Test Vendor is branded): no Madhur flash, vendor name/colour

## 6. If something goes wrong — rollback (minutes)

1. **Apps Script** → Manage deployments → ✏️ → choose the **old version number** (section 0) → Deploy.
2. **GitHub** → the merged Pull Request → **Revert** → merge the revert PR.
3. The Sheet needs nothing: new columns/sheets are only additions; old code ignores them.
   (If ever needed: File → Version history → `Before Phase 2`.)

## 7. First days after release

- Watch **audit_log** for `auth_denied` rows (someone missing a permission) and anything unexpected.
- Next release (separately, same process): **staff data** (staff sheet per school, Students | Staff tabs, staff IDs S-…).
