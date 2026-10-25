# Release S4c — School Forms: Students | Staff

## What changes
- **School Forms** gets tabs **🎓 Students | 👩‍🏫 Staff** (same rule as everywhere: schools with staff cards
  switched on, people with 👩‍🏫 Staff data). Schools without staff: exactly as before.
- **Staff form**: title **STAFF ID CARD FORM**; fields **Name, Designation, Category** — printed as
  **☐ Staff ☐ Management** tick boxes — then the school's staff fields (Father's/Husband's Name, DOB, Phone,
  Address, Blood Group, Employee ID…). Reorder, Full/Half/Multiline and custom fields work as before.
- **"Other school" forms** (new school, not yet in the system): staff forms available too, with the default staff fields.
- The PDF file name says which form it is (…_student_form.pdf / …_staff_form.pdf).

## Apply (2 files)
**js/school_form.js** (527 lines) and **school_form.html** (118 lines — adds the tabs script) → publish → Ctrl+F5. No Apps Script change.

## Test (4 steps)
1. Forms → TV_Test → tabs; Students form as before.
2. 👩‍🏫 Staff → fields Name, Designation, Category (☐ Staff ☐ Management), then staff fields → Generate → "STAFF ID CARD FORM".
3. Download PDF → file …_staff_form.pdf.
4. A school without staff → no tabs.

## Rollback
GitHub → Revert the PR.
