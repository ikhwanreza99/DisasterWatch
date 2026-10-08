# Implementation Plan: merge origin/main UI into rafii-api, keep API layers, add master toggle

Repo: `/Users/960302/Downloads/DisasterWatch` (branch `rafii-api`, HEAD 100e4e3, working tree clean). No worktree. Use absolute paths, and run git as `git -C /Users/960302/Downloads/DisasterWatch ...`.

## Hard constraints (apply to every step)
- Do NOT commit and do NOT push. At the end the merge stays in progress: `MERGE_HEAD` exists, there are no conflict markers, and every resolved file is `git add`ed.
- Do NOT modify `.env*`. Do not touch other branches (`main` and the other local branches stay as they are), the `.kilo/` folder, or the sibling worktree `/Users/960302/Downloads/DisasterWatch-homepage`.
- Do NOT `git add` anything under `.agents/` (it is not gitignored). Stage files by explicit path only, and never use `git add -A` or `git add .`.
- UI text stays in Indonesian.
- Dev server: the step brief says a Vite server already runs on :3000, but at planning time `curl http://localhost:3000` returned 000 and nothing was listening. Check with `lsof -nP -iTCP:3000 -sTCP:LISTEN` and leave any running server alone. If nothing is listening, start one in the background with `npm run dev` (cwd = repo; this is the user's first request: "jalankan branch rafii-api ke localhost:3000"). Never start a second server on :3000. While conflict markers exist, HMR will briefly show errors. That is expected.

## Findings (from exploration; no need to re-derive them)
- Merge base a5c49e6. The two rafii-api commits are **UI-only** (Panel toggle and `showPanels`, `UrgentNeedsCard`). rafii-api's data fetching equals a5c49e6. "API data like rafii-api" therefore means: put back what origin/main removed relative to a5c49e6.
- `git merge-tree --write-tree --name-only rafii-api origin/main` → conflicts in `src/App.tsx`, `src/components/Header.tsx`, `src/components/ExpandedDetailContent.tsx` and `src/components/SlimSidebar.tsx`. `MapCanvas.tsx` and `CategoryFilterBar.tsx` auto-merge, but both carry rafii-only `showToolbar` / `compactTop` code that must be removed.
- API data and how each layer appears on rafii-api compared with origin/main:
  | Source | Hook / location | rafii-api (default) | origin/main |
  |---|---|---|---|
  | BMKG earthquakes | `useBmkgEarthquakes` (App) → `bmkgEvents` prop | cyan `M x.x` markers on both engines, ON | fetch kept, **marker rendering deleted** (OSM effect + Google `AdvancedMarker` block) |
  | BMKG weather warnings (CAP) | `useBmkgWeatherWarnings` (App) | polygons, ON | kept (ON, no toggle) |
  | Google Weather city chips | `useCityWeather(showWeather)` in MapCanvas | chips at zoom ≥ 6, ON | **deleted** (commit 09d39ec) |
  | NASA FIRMS hotspots | `useFirmsHotspots` (App), `GoogleFireOverlay` / canvas | OFF (toggle in Layer panel) | rendering kept, `showFirms=false` with **no toggle** |
  | MAGMA volcanoes/landslides + eruptions | `useMagma(showMagma)`, `useMagmaEruptions(showMagma, date)` | OFF (toggle) | rendering kept, permanently OFF |
  | Darwin VAAC ash | `useVaac(showAsh)` | OFF (toggle) | rendering kept, permanently OFF |
  | Layer panel / map-type selector / engine pill / weather pill / active-layer chips / bottom action pills | MapCanvas toolbar | toolbar hidden by default (`showPanels=false`) | **deleted** (main's toolbar is only `MapSearch` plus the "Buka Menu Sidebar" pill) |
  | Sidebar "Cuaca Lapangan" (`WeatherCard`) + `BmkgForecastPanel` | SlimSidebar | shown by default | **deleted** from SlimSidebar |
  | KPI bar (`IntelligenceSummaryBar`), `ArchitectureBadge`, `BmkgSignalsControl` status row | App | **hidden by default** (Panel toggle) | deleted |
- Bottom-left controls on origin/main (`data-purpose="map-zoom-controls"`, a vertical `flex flex-col gap-2`): zoom label → zoom group → reset → **locate-me** (`data-purpose="locate-me"`) → MAGMA legend (i) (only when `showMagma`). Button style: `flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-all hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer`. The column is the same on mobile: the bottom bar is `flex-row`, controls on the left and MapChatComposer on the right (from 3aba126).
- No test script in package.json. Tests are `node:test` files run via tsx: `npx tsx --test tests/newsClassification.test.ts tests/reportIntent.test.ts` (both come from origin/main).
- Commands: `npm run lint` (tsc --noEmit), `npm run build` (vite build). For screenshots there is no Chrome, but Brave exists: `"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"`.

## Design decisions
1. **Look = origin/main.** For every conflicted or presentation file, origin/main's version is the base. rafii-api UI additions are handled as follows:
   - DROP the header "Panel" toggle, `showPanels` state, `showToolbar` prop/wrapper and `compactTop` from 100e4e3. Main has no KPI or status rows to toggle, and main's toolbar (MapSearch) must stay visible.
   - DROP `UrgentNeedsCard` (6595a9c) from the SlimSidebar and from ExpandedDetailContent, and delete `src/components/UrgentNeedsCard.tsx`. Main replaced that card with "Kesenjangan Bantuan" + donation button. The donation CTA still exists.
   - DROP the KPI bar, ArchitectureBadge and BmkgSignalsControl row. They were hidden by default on rafii-api and main removed them, so they were never default-visible data.
   - DROP the Layer panel, map-type selector, engine pill, weather pill + WeatherDetailSidebar, active-layer chips and bottom action pills. Main removed this chrome, and the new master toggle replaces the per-layer toggles.
   - KEEP everything new on main: LoginModal/login-before-report, MapChatComposer, the new AIHelpdeskPanel, news cards/source links, the "Laporkan Bencana" header button, the removed dark-mode toggle, and the zoom label.
2. **Restore the API data main removed.**
   - BMKG earthquake markers (OSM + Google) and Google Weather city chips go back into MapCanvas, copied from a5c49e6 with their existing styling (small glass/cyan/sky chips that fit main's map).
   - The SlimSidebar "Cuaca Lapangan" WeatherCard and BmkgForecastPanel come back below "Update Berita Terkini". They already use main's sidebar card style (`rounded-[20px] border border-slate-200 bg-white p-4`, `text-[14px] font-bold` heading). This is the one deliberate visual addition beyond main, and it matches the user's "tetap munculkan default semua pembacaan data dari api".
3. **One master state `showApiLayers` (default `true`) drives every API map layer:** BMKG quakes, BMKG weather polygons, city weather chips, FIRMS, MAGMA (+ eruptions and the legend (i) button), and VAAC ash. Rationale: the user asked for "layer data semua api" shown by default and a single on/off control. FIRMS, MAGMA and ash are therefore ON by default (they were OFF on rafii-api), because "semua" means all of them. The per-layer `useState`s become derived constants (`const showBmkg = showApiLayers;` and so on), so the existing rendering code is unchanged.
4. **Fetching stays on regardless of the toggle.** `useMagma(true)`, `useVaac(true)`, `useMagmaEruptions(true, selectedDate)` and `useCityWeather(true)` all fetch on mount. Toggling only hides or shows the layers, with no refetch flicker. App-level BMKG/FIRMS hooks are already unconditional.
5. **Toggle control:** a new `h-9 w-9` button placed directly **below the locate-me button** and above the MAGMA (i) button, inside `data-purpose="map-zoom-controls"`.
   - Same glass classes as locate-me. ON state: `text-emerald-300 ring-1 ring-emerald-400/60`. OFF state: `text-slate-400`.
   - Icon: lucide `Layers` when ON, `EyeOff` when OFF (MapCanvas already imports `Layers`; add `EyeOff` to the existing lucide import).
   - Accessibility: `type="button"`, `aria-pressed={showApiLayers}`, `aria-label` = "Sembunyikan layer data API" / "Tampilkan layer data API", the same text as `title`, and `data-purpose="api-layers-toggle"`. It is natively keyboard-focusable, with a focus-visible ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400`.
   - Turning it OFF also clears the open layer popups (`setSelectedBmkgId(null)`, `setSelectedFire(null)`, `setSelectedWeatherId(null)`, `setSelectedMagma(null)`, `setSelectedAsh(null)`, `setSelectedCityId(null)`) and `setShowMagmaLegend(false)`.
   - Incident markers (Firestore/demo disasters), my-location and the searched place are NOT API layers and stay visible.

# Steps

- [ ] 1. Start the merge.
      Confirm a clean tree and the right branch (`git -C /Users/960302/Downloads/DisasterWatch status --short`, `git -C … branch --show-current` → `rafii-api`). Then run `git -C /Users/960302/Downloads/DisasterWatch merge origin/main --no-commit --no-ff`.
      Files: none edited yet.
      Verify: the command reports CONFLICT in exactly App.tsx, Header.tsx, ExpandedDetailContent.tsx and SlimSidebar.tsx, and `git -C … rev-parse -q --verify MERGE_HEAD` prints a sha.

- [ ] 2. Resolve the presentation-only files to origin/main and remove UrgentNeedsCard.
      Run `git -C /Users/960302/Downloads/DisasterWatch checkout origin/main -- src/App.tsx src/components/Header.tsx src/components/ExpandedDetailContent.tsx src/components/CategoryFilterBar.tsx`. This drops `showPanels` / Panel toggle / `compactTop` / UrgentNeedsCard usage. Then `git -C … rm src/components/UrgentNeedsCard.tsx`.
      App.tsx needs no further change: main's App still runs `useBmkgEarthquakes`, `useBmkgWeatherWarnings` and `useFirmsHotspots` and passes `bmkgEvents`, `firmsHotspots`, `bmkgWeather` etc. to `MapProvider`.
      Files: src/App.tsx, src/components/Header.tsx, src/components/ExpandedDetailContent.tsx, src/components/CategoryFilterBar.tsx, src/components/UrgentNeedsCard.tsx (deleted).
      Verify: `git -C … diff origin/main -- src/App.tsx src/components/Header.tsx src/components/ExpandedDetailContent.tsx src/components/CategoryFilterBar.tsx` is empty.

- [ ] 3. Resolve SlimSidebar as main + the restored weather/forecast cards.
      `git -C … checkout origin/main -- src/components/SlimSidebar.tsx`.
      Re-add the imports `import { WeatherCard } from './WeatherCard';`, `import { BmkgForecastPanel } from './BmkgForecastPanel';` and `import { resolveForecastAdm4 } from '../services/bmkg/bmkgWeatherForecast';`.
      Directly after the closing `</div>` of the "Update Berita Terkini" card, inside the scroll column and before the `<div className="pt-3">` "Tanya DisasterAI" button, re-insert the two blocks from `git -C … show a5c49e6:src/components/SlimSidebar.tsx` (the `data-purpose="mini-weather"` "Cuaca Lapangan" card with `<WeatherCard lat lng locationName disasterCategory />` and `<BmkgForecastPanel adm4={resolveForecastAdm4(disaster)} locationLabel={`${disaster.name}, ${disaster.province}`} />`). Do not add UrgentNeedsCard.
      Files: src/components/SlimSidebar.tsx
      Verify: `npm run lint` shows no errors from SlimSidebar.tsx (other files may still error until step 5).

- [ ] 4. Strip rafii-only toolbar gating from the auto-merged MapCanvas.
      In `src/components/MapCanvas.tsx`, remove the `showToolbar?: boolean` prop and its doc comment from `MapCanvasProps`, and remove the `showToolbar = true,` destructure. Remove the `{showToolbar ? (` wrapper and the `) : ( <div aria-hidden="true" /> )}` tail around the top-left overlay, and restore main's comment `{/* Top Left Header Overlay: Active Engine Pill & Layer Switcher */}`. Main's toolbar is always rendered.
      Files: src/components/MapCanvas.tsx
      Verify: `git -C … diff origin/main -- src/components/MapCanvas.tsx` is empty at this point. If it is not, the remaining hunks must be explained (expected: none).

- [ ] 5. Restore the BMKG earthquake markers and Google Weather city chips in MapCanvas (source: `git -C … show a5c49e6:src/components/MapCanvas.tsx`, base line numbers in brackets).
      - Import `useCityWeather, type CityWeather` from `'../services/weather/cityWeather'` [41].
      - Add `const CITY_WEATHER_MIN_ZOOM = 6;` [188] and update the declutter comment back to mention city weather.
      - Add the `cityWeatherChipHtml` / `cityWeatherPopupHtml` helpers after `escHtml` [220–241].
      - OSMMapRenderer: add the prop type `cityWeather?: CityWeather[];` and the default `cityWeather = [],` [551], the `cityWeatherLayerRef` ref [575] and its `L.layerGroup().addTo(map)` init [656], the "BMKG earthquake layer" `useEffect` [749–770] before the FIRMS effect, and the "Major-city weather chips" `useEffect` [820–835] before the MAGMA effect.
      - MapCanvas: add `const cityWx = useCityWeather(true);` (decision 4), `selectedCityId` state [1095], `'city'` in `PopupKind`, `if (keep !== 'city') setSelectedCityId(null);` in `closeOtherPopups`, and the `selectedCityId` effect [1112].
      - Google engine JSX: add the "BMKG Earthquake layer" `AdvancedMarker` block [1538–1595] right before the "BMKG weather warning polygons" block, and the "Major-city weather chips" block [1909–1963] right before "Selected weather warning callout".
      - Pass `cityWeather={cityWx.cities}` to `<OSMMapRenderer>` [2046].
      Do not restore the layer panel, `activeLayerChips` 'wx' entry, WeatherCard pill or WeatherDetailSidebar.
      Files: src/components/MapCanvas.tsx
      Verify: `npm run lint` passes with 0 errors.

- [ ] 6. Add the master `showApiLayers` state and the bottom-left toggle button.
      In MapCanvas, add `const [showApiLayers, setShowApiLayers] = useState(true);` and replace the five `useState`s with derived constants:
      - `const showBmkg = showApiLayers;`
      - `const showFirms = showApiLayers;`
      - `const showWeather = showApiLayers;`
      - `const showMagma = showApiLayers;`
      - `const showAsh = showApiLayers;`
      Change the fetch hooks to always-on:
      - `useMagma(true)`
      - `useVaac(true)`
      - `useMagmaEruptions(true, selectedDate)`
      Remove any now-orphaned `setShowX` calls. Main has none outside the deleted panel, so this is expected to need no changes.
      Add a `toggleApiLayers` `useCallback`. It flips the state and, when turning OFF, clears the selections listed in decision 5 and calls `setShowMagmaLegend(false)`.
      Insert the button (spec in decision 5) directly after the `data-purpose="locate-me"` button and before the `{showMagma && (` legend button. Add `EyeOff` to the lucide import.
      Files: src/components/MapCanvas.tsx
      Verify: `npm run lint` passes. Then `npm run build` succeeds.

- [ ] 7. Run the full checks and stage the resolution (no commit).
      Run:
      - `npm run lint`
      - `npm run build`
      - `npx tsx --test tests/newsClassification.test.ts tests/reportIntent.test.ts`
      Then confirm `git -C … diff --check` is clean and `git -C … grep -nE '^(<<<<<<<|>>>>>>>|=======$)' -- src` finds nothing. Stage by path: `git -C … add src/App.tsx src/components/Header.tsx src/components/ExpandedDetailContent.tsx src/components/SlimSidebar.tsx src/components/CategoryFilterBar.tsx src/components/MapCanvas.tsx`. The UrgentNeedsCard deletion is already staged by `git rm`. Remove the `dist/` output only if it was not there before (it is gitignored and already existed, so leave it).
      Files: none new.
      Verify:
      - lint passes, the build succeeds, and all 10 node:test tests pass (8 newsClassification + 2 reportIntent).
      - `git -C … status` shows "All conflicts fixed but you are still merging" and no unmerged paths.
      - `.agents/` is untracked and not staged.
      - `git -C … log -1 --format=%h` still shows `100e4e3` (no commit made).

- [ ] 8. Visual and DOM verification at http://localhost:3000.
      Make sure the dev server is serving (see the constraints above). Then:
      - `"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" --headless=new --disable-gpu --window-size=1440,900 --virtual-time-budget=15000 --screenshot=/tmp/dw-desktop.png http://localhost:3000/`, then view the PNG.
      - Repeat at `--window-size=390,844` → `/tmp/dw-mobile.png`.
      - `… --dump-dom http://localhost:3000/ > /tmp/dw.html`.
      Check:
      - (a) The header has "Laporkan Bencana" and no "Panel" or Light/Dark buttons. The map toolbar shows only search plus "Buka Menu Sidebar". There is no KPI/status row. The compact map chat composer is bottom-right. This matches origin/main's code.
      - (b) The DOM contains `data-purpose="api-layers-toggle"` with `aria-pressed="true"`, placed right after `data-purpose="locate-me"` inside `map-zoom-controls`.
      - (c) API layers render by default: BMKG quake markers (`data-purpose="bmkg-marker"` on Google, `.bmkg-osm-marker` on OSM), BMKG warning polygons and FIRMS points visible on the screenshot. This depends on the APIs; if a source is unavailable, record that rather than failing.
      - (d) On mobile the toggle sits under locate-me in the left column and does not overlap the chat composer.
      - (e) The toggle hides and shows layers. Either click it in the user's browser, or drive Brave with `--remote-debugging-port=9222` and a small Node (global `WebSocket`) CDP script that clicks `[data-purpose="api-layers-toggle"]` and checks that `aria-pressed` becomes `"false"` and the bmkg markers disappear. Optionally compare against origin/main by building it in a temp dir outside the repo (`git -C … worktree` is NOT allowed; use `git -C … archive origin/main | tar -x -C /tmp/dw-main`, symlink node_modules, `npx vite build`), then delete /tmp/dw-main.
      Delete the /tmp screenshots, the HTML dump and any temp dirs afterwards.
      Files: none.
      Verify: checks (a)–(e) are recorded in the step output with what was and wasn't confirmed.

## Gaps / assumptions
- Restoring the sidebar weather/forecast cards and the city-weather map chips goes beyond main's look on purpose: the user said to keep the rafii-api API data visible by default. Everything else follows main.
- With FIRMS, MAGMA and VAAC ON by default, startup makes more requests. Their hooks already handle `unavailable` states.
- The individual per-layer toggles are intentionally gone. The single master toggle is the only layer control, which matches main's simplified chrome.
