# Release P2c: phone bottom bar + home-screen app icon

Apply after P2b.5. **No Apps Script change.**

## What changed

| Part | Now |
|---|---|
| **Bottom bar (phones only, up to 600 px wide)** | Home · Add · Records · Photos · Menu. The current page is orange. Add / Records / Photos go through the school chooser like the top menu. **Menu** opens the full menu. |
| Permissions | A button the user may not use is replaced by the next allowed one (Print, Bulk, Export). With none allowed: Home and Menu only. |
| While typing | The bar slides away while the phone keyboard is up (text boxes), and comes back after. Tick boxes and lists do not hide it. |
| Space | Pages get room at the bottom so nothing sits under the bar; messages (toasts) appear above it. |
| Where | Pages already redesigned: Dashboard, Help, Add records, Records. Each later page gets it when it is redesigned. Laptops and tablets never show it. |
| **Add to Home screen** | New manifest.webmanifest + icons: name "Madhur Digitals" (short "Madhur"), the orange M icon (a round-safe version for Android), white top. Opening the icon goes **straight to the Dashboard, full screen** (no browser bar). Added to every page that uses layout.js, including Login. |
| No offline worker | On purpose: no files are stored on the phone, so every release reaches everyone at once. |

## Files

| File | Lines | Base |
|---|---|---|
| js/layout.js | 401 | P1d |
| css/app.css | 1126 | P2b.5 |
| manifest.webmanifest | new | — |
| assets/icon-192.png, assets/icon-512.png, assets/icon-maskable-512.png | new | — |

Put **manifest.webmanifest in the site's top folder** (next to dashboard.html) and the 3 icons in **assets/**.

## Apply
Copy the files and hard-refresh (Ctrl+Shift+R).

## Tests on TV_Test

| # | Do | Expect |
|---|---|---|
| 1 | Phone: open Dashboard | Bar at the bottom: Home · Add · Records · Photos · Menu; Home orange |
| 2 | Tap Records | School chooser (or straight in if the school is already chosen); Records orange |
| 3 | Tap Menu | Full menu slides in |
| 4 | Add records → tap the Name box | Bar slides away while typing; comes back after |
| 5 | Log in as a user without Records permission | That button replaced (e.g. Print) |
| 6 | Laptop | No bottom bar |
| 7 | **Android Chrome**: ⋮ → Add to Home screen / Install app | Orange M icon "Madhur"; opens on Dashboard full screen |
| 8 | **iPhone Safari**: Share → Add to Home Screen | Same icon; opens full screen |
| 9 | From the installed app: Print cards and Export | Print / download still work (check once on your phones) |

## Tested
- New test_p2c (8); full kit **863 passed, 0 failed**; 7 mutations, all caught.
- Laptop screenshots of Dashboard, Help, Login, Add records with old vs new files: identical. Phones: the only change is the bar (and the 56 px room for it).
- Real Chrome 390 px: bar at the bottom on Dashboard, Add records, Records; slides away while typing; Records panel opens above it; no page errors.
- Found and fixed while testing: old page stylesheets style every <nav> (sticky at the top), which pulled the bar to the top on Records. The bar is now a div with role="navigation", so they can't reach it.
