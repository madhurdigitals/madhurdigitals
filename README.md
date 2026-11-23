# Release SE3d: 🔁 Bulk promote (admins), on the Session Pipeline page

**2 files, no Code.gs change, no setup.**

## Why no server change
Bulk promote does exactly what you'd do by hand: for each school, the same 🔁 check and the same promotion as that school's own page, **one school at a time**. So every existing safeguard applies unchanged:
- the date lock;
- the class check;
- "changed since the preview";
- the frozen session;
- ↩ Undo per school.

## How it works (admins only)
1. **🧭 Session Pipeline** → each **⏳ Due** school has a tick box, and there's also "Select all ⏳ Due schools shown". You can use the search, vendor and stage filters first, then tick.
2. **🔁 Preview bulk promote (N)** checks the ticked schools, a few at a time, and splits them:
   - **✅ Ready:** the session has started, every class is recognised, and nothing is half done. Each school gets one line, e.g. "Old School (OLDS): 2026-27 → 2027-28 — 420 move up, 30 pass out, 0 stay", with **classes** to expand the full list ("5 → 6 (32), …").
   - **⚠ Needs a look:** an unrecognised class, a class above the last class, a half-done promotion, not started yet, or an error. These are **left out**, with the reason and a link to that school's 🔁 page.
3. Tick **"I have checked the schools and classes above"** → **🔁 Start N schools** → confirm.
   - Schools run **one after another**, each marked ✅ promoted or ❌ with the server's reason.
   - **One failing never stops the others.** If a student was added after the preview, that school is refused and the rest carry on.
   - **⏹ Stop after this school** stops the run part-way.
   - The page warns you if you try to leave while it's running.
4. When it finishes, the list reloads. Every promoted school is a normal promotion: **↩ Undo** works on its own page until the first change.

## Not included, on purpose
- **Early promotion:** before the start date no school is ⏳ Due, so early stays a deliberate one-school decision.
- **Non-admins with 🔁:** they promote one school at a time, as before.

## Apply
Upload `pipeline.html` and `js/pipeline.js`, then press Ctrl+F5.

## Test
1. Put 2 test schools in an older session: in `manage_school`, set active_session to '2025-26 so their next session (2026-27) has already started. Give one of them a student with class "Remedial".
2. 🧭 Pipeline → Select all ⏳ Due → Preview. Expected: one ✅ Ready (with its summary), and one ⚠ "class not recognised: Remedial" with a link.
3. Tick, then Start. Only the ready school is promoted. Check its classes in the sheet, and that ↩ Undo is offered on its 🔁 page.

## Tests
- 8 new page tests.
- **Mutation check:** I broke 5 things one at a time, and each was caught. They were: an unknown class not excluded, Stop ignored, a stale preview kept after changing the ticks, non-admins getting bulk, and non-Due schools tickable.
- **Full regression:**
  - Every suite that touches the session work passes.
  - The same old page tests (Add Records and the student page) fail on some runs and pass on others, because of the test harness's timing. They hit different tests each run, and they don't load the 2 changed files.
