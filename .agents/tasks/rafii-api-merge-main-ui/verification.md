# Verification: merge origin/main UI into rafii-api (iteration 1)

## Merge state
- `git merge origin/main --no-commit --no-ff` → CONFLICT in App.tsx, Header.tsx, ExpandedDetailContent.tsx, SlimSidebar.tsx (as planned).
- MERGE_HEAD = 432bdb1, HEAD still 100e4e3 (no commit). `git status`: "All conflicts fixed but you are still merging". No unmerged paths. `.agents/` is untracked and not staged.
- `git diff --check` is clean. A conflict-marker grep over `src` finds nothing.
- `git diff origin/main --stat -- src tests`: only `MapCanvas.tsx` (+245/-12) and `SlimSidebar.tsx` (+15) differ from origin/main. Every other file (App, Header, ExpandedDetailContent, CategoryFilterBar, etc.) is byte-identical to origin/main. `UrgentNeedsCard.tsx` is deleted (staged).

## What differs from origin/main
- SlimSidebar: the "Cuaca Lapangan" WeatherCard and the BmkgForecastPanel are back, below "Update Berita Terkini" (copied from a5c49e6).
- MapCanvas, restored from a5c49e6 by reverse-applying the relevant hunks of `a5c49e6..origin/main`:
  - BMKG earthquake markers (OSM effect + Google `AdvancedMarker`)
  - city-weather chips (`useCityWeather`, helpers, OSM layer + Google markers, `selectedCityId` popup handling)
- MapCanvas master switch:
  - `showApiLayers` (default `true`). `showBmkg/showFirms/showWeather/showMagma/showAsh` are now derived from it.
  - Fetch hooks always run: `useMagma(true)`, `useVaac(true)`, `useMagmaEruptions(true, …)`, `useCityWeather(true)`.
  - `toggleApiLayers` closes the API-layer popups and the MAGMA legend when switching OFF.
- New button `data-purpose="api-layers-toggle"`, placed right after `locate-me` in `map-zoom-controls`. It uses the same h-9 w-9 glass classes as its neighbors.
  - ON: emerald ring + `Layers` icon. OFF: slate + `EyeOff` icon.
  - `aria-pressed`, `aria-label="Tampilkan layer data API"`, dynamic `title` (Sembunyikan/Tampilkan layer data API), focus-visible outline.

## Commands
| Command | Result |
|---|---|
| `npm run lint` (tsc --noEmit) | PASS, 0 errors |
| `npm run build` | PASS (only the existing chunk-size / dynamic-import warnings) |
| `npx tsx --test tests/*.test.ts` | PASS, 10/10 (newsClassification + reportIntent) |

## Visual / DOM checks (headless Brave via CDP, http://localhost:3000)
Nothing was listening on :3000 at start, so I started `npm run dev` in the background (still running). The page rendered with the Google engine.

| Check | Desktop 1440×900 | Mobile 390×844 |
|---|---|---|
| Header has "Laporkan Bencana", no "Panel" button | yes | yes |
| "Buka Menu Sidebar" pill + search present, no KPI/status row | yes | yes |
| Toggle present, `aria-pressed="true"` by default | yes | yes |
| Toggle is the next sibling of locate-me, inside map-zoom-controls | yes (locate y=752, toggle y=796, 36×36) | yes (x=12; locate y=708, toggle y=752) |
| Toggle overlaps chat composer | no (composer x=1034) | no (composer x=114–332, toggle x=12–48) |
| Layers ON by default | 2 BMKG quake markers, 21 city-weather chips, MAGMA (i) button; screenshot shows FIRMS dots, MAGMA volcano triangles, VAAC/warning polygons | same counts |
| Click toggle → OFF | `aria-pressed="false"`, 0 BMKG, 0 city chips, MAGMA (i) gone; screenshot shows FIRMS/MAGMA/polygons gone, incident markers + callout kept, icon switches to EyeOff | same |
| Click again → ON | counts restored (2 / 21 / 1) | same |

- Comparison with origin/main: I built it in `/tmp/dw-main` (git archive) and served it with `vite preview` on :4317, then deleted it.
  - The chrome is identical: header, left category rail, search, "Buka Menu Sidebar", zoom column, compact chat composer bottom-right.
  - Differences: main has no toggle and no API layers on the map. On :4317 Google rejected the referer, so main fell back to OSM tiles there; the tile difference comes from that, not from the code.
- Not verified:
  - The OSM-engine rendering of the restored BMKG/city layers on this branch. Google loaded on :3000, so the OSM path was only checked by type-check/build.
  - The sidebar WeatherCard/Forecast cards. The sidebar was minimized by default in the headless run, so `mini-weather` count = 0.
  - Real keyboard focus (focusability comes from it being a native `<button>`).
- All temp screenshots, scripts and temp dirs were removed.
