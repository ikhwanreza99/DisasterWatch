# Implementation Plan: move MAGMA legend + make BMKG quake markers clickable

Repo: /Users/960302/Downloads/DisasterWatch (branch `rafii-api`, merge in progress: MERGE_HEAD present, changes staged).
Do NOT commit, push, abort the merge or reset. Edit files only. Use absolute paths.

Commands (from package.json / prior verification.md):
- Type-check: `npm run lint` (tsc --noEmit). Expect 0 errors.
- Build: `npm run build`. Only the existing chunk-size / dynamic-import warnings are expected.
- Tests: `npx tsx --test tests/*.test.ts`. Uses node:test + node:assert/strict (see tests/reportIntent.test.ts).
- Dev server: `npm run dev` is already running on :3000 (pid 36400, cwd = this repo, Vite HMR). Do not restart it. Start it in the background only if :3000 is down.
- Runtime checks: headless Brave (`/Applications/Brave Browser.app`) over CDP, using `ws` from node_modules. Put scripts in /tmp and delete them afterwards. Forcing OSM: `window.dispatchEvent(new Event('gmp-auth-failure'))`. MapCanvas listens for it and switches `mapEngine` to 'osm'.

## Findings (from the code and a runtime probe, headless Brave 1920×1080, Google engine)

### Request 2: root cause of "BMKG magnitude markers can't be clicked"

The Google `AdvancedMarker` for BMKG already has `onClick`. vis.gl sets `gmpClickable=true` and `pointer-events: all` on its content. The OSM marker already has `bindPopup(buildBmkgPopupHtml(e))`. So handlers exist, but the probe showed this:

- Marker M4.4 at (1846, 580): `elementFromPoint` hits the marker span. Clicking it opens the popup.
- Marker M4.6 at (1717, 751–813): `elementFromPoint` hits the bottom controls bar instead. That element is `div.relative.z-30.flex.flex-row.items-end.justify-between ... pointer-events-auto` in MapCanvas.tsx around line 2105, with rect 0,781,1920,299. Clicking does nothing.

ROOT CAUSE: the bottom overlay row is full width and as tall as the zoom column (~300px). It is `pointer-events-auto` and stacked above the map (z-30). It swallows every click, drag and wheel on the bottom ~300px strip of the map, on both the Google and OSM engines.

- The top overlay row has the same problem (`relative z-30 pt-3 ... pointer-events-auto flex justify-between`, ~line 2083). It is a thinner strip under the search and restore pill.
- origin/main has the same class, so this bug is inherited.
- In the user's screenshot, the M4.6 quake near Lombok sits inside that strip.

Secondary issues found on the Google path:
1. The popup is rendered INSIDE the marker's content. Any click inside the popup (text, the source link) is dispatched as the marker's `gmp-click`, which runs `setSelectedBmkgId(isSel ? null : e.id)`. So clicking the popup body closes it. React `stopPropagation` on the inner div cannot stop the native gmp-click.
   - MAGMA, FIRMS and ash avoid this by rendering the popup as a separate AdvancedMarker without onClick (e.g. `selectedMagma` ~line 1769). Follow that pattern.
2. Outside click does not close the Google BMKG popup. `<Map>` has no onClick; only GoogleFireOverlay listens for map clicks, and it only touches `selectedFire`.
3. The content is incomplete or wrong:
   - `mmi` is actually BMKG's `Shakemap` filename, rendered as "MMI: 20261006104245.mmi.jpg".
   - Time is a raw ISO string.
   - Coordinates are missing.
   - `Potensi` (tsunami potential) exists in `BmkgRawGempa` but is never normalized.

### Request 1: legend position

The `#magma-legend` div (MapCanvas.tsx ~line 2108) is `absolute left-3 sm:left-6 lg:left-8 bottom-full mb-2`, inside the bottom bar. That places it above the zoom column.

Zoom column geometry:
- Width: `w-9` = 2.25rem.
- Left edge: the bar's padding (`px-3 sm:px-6 lg:px-8`).
- Bottom edge: the bar's bottom padding (`pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-6`).

The compact chat composer is right-aligned with `w-[min(420px,calc(100vw-5rem))]` and `h-11` plus 2px ring (~48px).
- Below md it overlaps horizontally with a 224px legend placed beside the column. On 390px the composer spans x=114–332; the legend would span x=56–280.
- At md+ (≥768px) it does not overlap.

## Decisions

- **Legend placement.** Keep the legend inside the bottom bar and position it absolutely.
  - Horizontal: left = bar padding + 2.25rem column + 0.5rem gap.
  - md+: bottom = the bar's bottom padding, so it is bottom-aligned with the column.
  - Below md: lift it above the composer row (bar padding + ~3rem composer + 0.5rem gap) so it never covers the composer.
  - Rationale: no JS measuring, and it follows the existing absolute-in-bar pattern. The Google logo (bottom-left, ~66px wide) stays under or left of the zoom column, so there is no overlap.
- **Click-blocking fix.** Make both overlay rows `pointer-events-none` and give their interactive children `pointer-events-auto`.
  - Visual output is unchanged, which keeps the "follow main's layout exactly" requirement.
  - This is the real root cause for request 2, and it also restores map dragging in those strips.
- **Google popup.** Move the BMKG popup out of the marker into its own AdvancedMarker, like MAGMA. Close on outside click with `<Map onClick>`.
- **Popup content.** Show the following fields, using the existing dark glass callout style (cyan border):
  - magnitude
  - depth
  - wilayah
  - formatted local time
  - coordinates
  - potensi
  - dirasakan
  - shakemap link

  Add `potential` to `EarthquakeEvent`. Treat `mmi` as a shakemap image link to `https://data.bmkg.go.id/DataMKG/TEWS/<file>`, which is the BMKG Shakemap convention.
- **Out of scope.** No auto-pan when a popup is clipped at the viewport edge; the other API popups don't do it either. No change to the OSM chip offset.

## Steps

- [ ] 1. Stop the overlay rows from eating map clicks (root cause of request 2).
      In MapCanvas.tsx:
      - Top overlay row (`relative z-30 pt-3 sm:pt-4 px-3 sm:px-6 pointer-events-auto flex items-center justify-between gap-2`, ~line 2083): change `pointer-events-auto` to `pointer-events-none`. Add `pointer-events-auto` to its inner search wrapper div (`flex items-center gap-2 min-w-0 overflow-x-auto ...`) and to the "Buka Menu Sidebar" restore button.
      - Bottom bar (`relative z-30 flex flex-row items-end justify-between ... pointer-events-auto`, ~line 2105): change it to `pointer-events-none`. Add `pointer-events-auto` to the `#magma-legend` div, the `locateError` status div, and the `flex items-end gap-3 sm:gap-4` wrapper of the zoom column.
      - Wrap `<MapChatComposer onSend={onStartAIChat} />` as `<div className="pointer-events-auto"><MapChatComposer .../></div>`. Alternatively add `pointer-events-auto` to the composer's root div in src/components/MapChatComposer.tsx; prefer the wrapper so the shared component stays untouched.
      - Check that the zoom wrapper itself is no wider than the column. It is a `flex items-end` holding only the column, so a 36px-wide hit area is fine.
      Files: src/components/MapCanvas.tsx
      Verify:
      - `npm run lint` passes and `npm run build` passes.
      - Runtime (Google, 1920×1080, then 390×844): `elementFromPoint` at a point in the empty bottom strip (e.g. x=900, y=950) and in the top strip between search and pill returns a map element, not the overlay div.
      - Clicking the BMKG marker that sits in the bottom strip (M4.6 near Lombok at the default camera) opens its popup.
      - Zoom buttons, locate-me, the api-layers toggle, the (i) button, search, the restore pill and the composer input all still respond to clicks.

- [ ] 2. Normalize BMKG `Potensi` and add unit tests.
      - In src/services/bmkg/bmkgTypes.ts, add `potential?: string` (doc: "BMKG 'Potensi', e.g. tsunami potential") to `EarthquakeEvent` and `BmkgMarkerData`.
      - In src/services/bmkg/bmkgNormalizer.ts `normalizeBmkgGempa`, add `const potential = asString(r.Potensi);` and spread `...(potential ? { potential } : {})`. Also pass it through in the marker-data projection near line 175, where `mmi` is passed.
      - Update the `mmi` doc comment to say it is the Shakemap image filename. Keep the field name so callers don't churn.
      - Create tests/bmkgNormalizer.test.ts in the node:test style of tests/reportIntent.test.ts. Cover:
        - a raw record with `Potensi: 'Tidak berpotensi tsunami'` and `Shakemap: 'x.mmi.jpg'` gives `potential`/`mmi` set and correct magnitude/depth/region/coords. Read parseCoordinates/parseDepthKm for the accepted raw formats, e.g. `Coordinates: '-8.10,120.50'`, `Kedalaman: '21 km'`, `DateTime: '2026-10-06T03:42:45+00:00'`.
        - a record without Potensi gives no `potential` key.
      Files: src/services/bmkg/bmkgTypes.ts, src/services/bmkg/bmkgNormalizer.ts, tests/bmkgNormalizer.test.ts
      Verify: `npx tsx --test tests/*.test.ts` passes, with the existing 10 tests plus the new ones. `npm run lint` passes.

- [ ] 3. Shared quake formatting and richer OSM popup HTML (depends on 2).
      - In src/components/map/bmkgPopup.ts, export a `formatQuakeTime(iso)` helper: `toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZoneName:'short' })`, falling back to the raw string. Also export `BMKG_SHAKEMAP_BASE = 'https://data.bmkg.go.id/DataMKG/TEWS/'`.
      - Update `buildBmkgPopupHtml(e)` to show, in order:
        - title "GEMPA BUMI · BMKG"
        - Magnitudo **M{mag.toFixed(1)}**
        - Kedalaman **{depth} km**
        - Wilayah **{region}**
        - Waktu **{formatQuakeTime}**
        - Koordinat **{lat.toFixed(2)}, {lng.toFixed(2)}**
        - Potensi **{potential}** (only if present)
        - Dirasakan **{feltArea}** (only if present)
        - a "Lihat shakemap" link to `BMKG_SHAKEMAP_BASE + encodeURIComponent(mmi)` (only if mmi is present; `target=_blank rel="noopener noreferrer"`)
        - the existing "Source: BMKG" attribution link

        Escape every interpolated string with the existing `esc`. Remove the wrong "MMI:" line. The Leaflet marker already binds this HTML with `className: 'bmkg-popup'`, which is styled in src/index.css, so no MapCanvas change is needed for the OSM content.
      - In the OSM BMKG effect (MapCanvas.tsx ~line 750), make the marker keyboard-accessible: `keyboard: true` (Leaflet default; keep it), `alt`/`title` `BMKG M{mag} — {region}`. After `m.on('add', ...)`, set `m.getElement()?.setAttribute('aria-label', \`Gempa BMKG M${mag}, ${e.region}. Buka detail\`)` and `role="button"`. Leaflet markers are focusable (tabindex=0) and open their bound popup on Enter.
      Files: src/components/map/bmkgPopup.ts, src/components/MapCanvas.tsx
      Verify: `npm run lint` and `npm run build` pass. Runtime check is in step 6.

- [ ] 4. Google engine: separate, accessible BMKG popup that closes correctly (depends on 3).
      In MapCanvas.tsx, BMKG block ~lines 1556–1612:
      - Marker:
        - Reduce the AdvancedMarker children to the chip only: `<div data-purpose="bmkg-marker" data-bmkg-id ...><span ...>M{e.magnitude.toFixed(1)}</span></div>`.
        - Change `onClick` to `() => setSelectedBmkgId(e.id)` (open only; re-clicking the same marker keeps it open, and closing is done via X or outside click).
        - Set `zIndex={isSel ? 10004 : 40}`. 40 is above incidents (20) and the old 30.
        - Add `aria-label` support: AdvancedMarker forwards `title`, and gmpClickable markers are focusable and fire gmp-click on Enter/Space. Set `title={\`Gempa BMKG M${e.magnitude.toFixed(1)} — ${e.region}\`}`, and add `aria-label` with the same text on the inner chip `div`.
      - Popup:
        - Add a new sibling block `{showBmkg && selectedBmkg && (<AdvancedMarker position={...} zIndex={10004}> ... </AdvancedMarker>)}`. No onClick, so the content is non-clickable and won't toggle. Derive `const selectedBmkg = useMemo(() => bmkgEvents.find(e => e.id === selectedBmkgId) ?? null, [bmkgEvents, selectedBmkgId])` next to the `selectedBmkgId` state (~line 1051).
        - Copy the structure and classes of the MAGMA popup (~line 1776): `pointer-events-auto mb-9 min-w-[250px] max-w-[290px] rounded-2xl p-3 shadow-2xl border border-cyan-300/40 bg-slate-900/95 text-white`, plus `data-purpose="bmkg-popup"`, `role="dialog"`, `aria-label="Detail gempa BMKG"` and `onClick={(ev) => ev.stopPropagation()}`. `mb-9` lifts it above the 28px chip.
        - Header: "🌐 GEMPA BUMI · BMKG" and the existing X close button (`aria-label="Tutup popup"`, calls `setSelectedBmkgId(null)`).
        - Body: the same fields as step 3, in `text-[11px]` rows. Use `formatQuakeTime` and `BMKG_SHAKEMAP_BASE` imported from ./map/bmkgPopup. Use the cyan source link `text-cyan-300 underline`, and the existing `https://data.bmkg.go.id/gempabumi/` link (or `BMKG_SOURCE_URL`).
      - Outside click: add `onClick={() => setSelectedBmkgId(null)}` to `<Map ...>` (~line 1380). Then verify at runtime that clicking a BMKG marker does NOT also trigger the map click, i.e. the popup stays open. If it does, record `lastMarkerClickRef.current = Date.now()` in the marker onClick and ignore map clicks within 50ms. Do not add closing of other popup kinds to the map click; that is out of scope.
      - Keep the existing `closeOtherPopups('bmkg')` effect and the `toggleApiLayers` reset of `selectedBmkgId`. They already give one-popup-at-a-time and close-on-toggle-OFF. `showBmkg &&` on the popup block also hides it when layers are off.
      Files: src/components/MapCanvas.tsx
      Verify: `npm run lint`, `npm run build`. Runtime check is in step 6.

- [ ] 5. Move the MAGMA legend next to the zoom column (request 1).
      - On the `#magma-legend` div (~line 2108), replace `left-3 sm:left-6 lg:left-8 bottom-full mb-2` with:
        `left-[3.5rem] sm:left-[4.25rem] lg:left-[4.75rem] bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_3.5rem)] sm:bottom-[5rem] md:bottom-6`
        - Mobile: 0.75 + 2.25 + 0.5 rem = 3.5rem left. The bottom offset sits above the composer row (48px + 8px gap).
        - sm: 1.5 + 2.25 + 0.5 = 4.25rem left, bottom 1.5rem + 3.5rem = 5rem.
        - md+: bottom-6, aligned with the column bottom.
        - lg: 2 + 2.25 + 0.5 = 4.75rem left.
      - Replace `max-w-[calc(100vw-1.5rem)]` with `max-w-[calc(100vw-4.25rem)] sm:max-w-[calc(100vw-5.5rem)]` so it never runs off the right edge.
      - Keep `w-56`, `max-h-[38vh] overflow-y-auto` and all inner content and styling unchanged. Update the JSX comment to "MAGMA legend — right of the zoom column, bottom-aligned".
      - Leave the `locateError` toast where it is.
      Files: src/components/MapCanvas.tsx
      Verify:
      - `npm run lint`, `npm run build`.
      - Runtime at 1440×900 and 390×844, sidebar minimized so the composer shows. Click `[data-purpose=magma-legend-toggle]` and check the legend rect:
        - `legend.left ≥ zoomCol.right + 4`
        - on desktop: `|legend.bottom − zoomCol.bottom| ≤ 2`
        - no intersection with `[data-purpose=map-ai-composer]`, `[data-purpose=map-zoom-controls]`, or the Google logo/attribution (`a[href*="maps.google"]`, `.gm-style-cc`)
        - `legend.right ≤ innerWidth` and `legend.top ≥ 60` (below the header)
      - The toggle OFF→ON still hides and shows the legend.

- [ ] 6. End-to-end runtime verification (both engines) and cleanup.
      Use headless Brave CDP at 1920×1080 and 390×844 on http://localhost:3000.
      Google engine:
      - (a) Click each `[data-purpose=bmkg-marker]` (including the one in the bottom strip) and confirm `[data-purpose=bmkg-popup]` appears with magnitude, depth, wilayah, time, coordinates, and potensi when present.
      - (b) Click inside the popup body; it stays open.
      - (c) Click the X; it closes.
      - (d) Reopen it, click empty map; it closes.
      - (e) Reopen it, then click a MAGMA volcano or city chip; the BMKG popup closes (one at a time).
      - (f) Reopen it, click `[data-purpose=api-layers-toggle]`; the popup and markers disappear. Toggle back ON; markers return and no popup is shown.
      - (g) Keyboard: Tab focuses a BMKG marker and Enter opens the popup.
      OSM engine (dispatch `gmp-auth-failure`):
      - (h) Click a `.bmkg-osm-marker` (including one in the bottom strip) and confirm `.bmkg-popup .leaflet-popup-content` shows the new fields.
      - (i) Click empty map; it closes.
      - (j) Toggle api layers OFF; the popup and markers are gone.
      Then re-run `npm run lint`, `npm run build` and `npx tsx --test tests/*.test.ts`. Record the results in /Users/960302/Downloads/DisasterWatch/.agents/tasks/rafii-api-legend-quake-popup/verification.md. Delete all /tmp scripts, profiles and screenshots. Confirm `git status` still shows the merge in progress and that `.agents/` is untracked and not staged.
      Files: .agents/tasks/rafii-api-legend-quake-popup/verification.md
      Verify: every check (a)–(j) passes, along with lint, build and tests.

## Gaps / assumptions
- "Potensi" is only present on BMKG feeds that include it (autogempa/gempaterkini). The row is conditional.
- The shakemap URL convention (`https://data.bmkg.go.id/DataMKG/TEWS/<Shakemap>`) is assumed from BMKG's public docs. If it 404s at runtime, drop the link rather than show a broken one.
- Re-clicking an open marker no longer toggles it closed. X, outside click, another popup, or the layers toggle close it, which matches MAGMA/ash behavior.
