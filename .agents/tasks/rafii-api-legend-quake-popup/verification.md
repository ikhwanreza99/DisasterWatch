# Verification: MAGMA legend move + clickable BMKG quake markers (iteration 1)

All commands were run from /Users/960302/Downloads/DisasterWatch. The repo is still mid-merge: MERGE_HEAD is present, nothing was committed, and source changes are staged with `git add`.

## Changes
- `src/components/MapCanvas.tsx`
  - Root cause of "BMKG magnitude markers can't be clicked":
    - The top and bottom overlay rows are full width and were `pointer-events-auto` at z-30. They swallowed clicks on the map strips underneath them.
    - Both rows are now `pointer-events-none`. Their interactive children opt back in with `pointer-events-auto`: the search wrapper, the restore pill, the legend, the locate toast, the zoom column wrapper, and a wrapper div around `MapChatComposer`.
  - Google BMKG marker:
    - It is now chip-only, with `title` and `aria-label` `Gempa BMKG M… — wilayah`.
    - `onClick` opens the popup and no longer toggles it.
    - zIndex is 40.
  - Google BMKG popup:
    - It is a separate `AdvancedMarker` with no onClick, `data-purpose="bmkg-popup"`, `role="dialog"` and an aria-label.
    - It has an X close button.
    - It is lifted with `anchorTop="calc(-100% - 36px)"` instead of a margin. With `mb-9`, the transparent margin area of the popup marker host sat over the chip and re-clicks fell through to the map. This was found at runtime and fixed.
  - Outside click closes the popup through `<Map onClick>`. A 50 ms guard ignores the marker click itself.
  - One popup at a time comes from the existing `closeOtherPopups('bmkg')` effect. Toggling layers OFF uses the existing `toggleApiLayers` reset, and the popup is also gated on `showBmkg`.
  - OSM BMKG marker: added `alt`, `keyboard: true`, `role="button"` and an `aria-label`.
  - MAGMA legend:
    - Positions: `left-[3.5rem] sm:left-[4.25rem] lg:left-[4.75rem]`, `bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_3.5rem)] sm:bottom-[5rem] md:bottom-6`.
    - Max widths: `max-w-[calc(100vw-4.25rem)] sm:max-w-[calc(100vw-5.5rem)]`.
    - Content and styling are unchanged.
  - Extra requirement from the user: `showApiLayers` now defaults to `false`. API layers are hidden on load, the toggle starts with `aria-pressed="false"`, and data hooks still fetch.
- `src/components/map/bmkgPopup.ts`
  - Added `formatQuakeTime` and `BMKG_SHAKEMAP_BASE`.
  - The OSM popup HTML now shows Magnitudo, Kedalaman, Wilayah, Waktu (local), Koordinat, Potensi, Dirasakan, a "Lihat shakemap" link and the BMKG source link.
  - Removed the wrong "MMI: <filename>" line.
- `src/services/bmkg/bmkgTypes.ts` and `src/services/bmkg/bmkgNormalizer.ts`: `potential` (BMKG `Potensi`) is normalized and passed through to marker data.
- `tests/bmkgNormalizer.test.ts` (new) has 2 tests:
  - Potensi and Shakemap are kept alongside the core fields.
  - With no Potensi, the record has no `potential` key.

## Static checks (final run, after all edits)
- `npm run lint` (tsc --noEmit): 0 errors.
- `npm run build`: ✓ built. The only warnings are the pre-existing chunk-size and INEFFECTIVE_DYNAMIC_IMPORT ones.
- `npx tsx --test tests/*.test.ts`: tests 12, pass 12, fail 0 (10 existing + 2 new).

## Runtime checks
Setup:
- Headless Brave over CDP against the already-running dev server at http://localhost:3000 (pid 36400, not restarted).
- Each run: load the page, press "Reset peta ke Indonesia", then switch API layers ON. They start OFF.
- Initial state at both sizes: `aria-pressed="false"`, 0 BMKG markers, no (i) legend toggle. After the toggle: `aria-pressed="true"`.

### Legend position (the (i) toggle is open)
Desktop 1440×900:
- Rects: legend {l76, t609, r300, b876}; zoom column {l32, t601, r70, b876}; composer {l988, t828, r1408, b876}; Google logo {l5, t874, r71, b900}.
- Gap from the zoom column is 6px. Bottom offset from the column is 0px (bottom-aligned).
- No overlap with the zoom column, composer, Google logo or `.gm-style-cc` attribution.
- The legend's right edge is within the viewport and its top is ≥ 60.
- The screenshot shows it beside the zoom column, in the area the user marked.

Mobile 390×844:
- Rects: legend {l56, t509, r280, b776}; zoom column {l12, t557, r50, b832}; composer {l68, t784, r378, b832}.
- Gap is 6px. The legend sits 8px above the composer.
- No overlap with the zoom column, composer, logo or attribution. It fits on screen.

At both sizes, the toggle OFF hides the legend.

### Overlay strips no longer block the map
`elementFromPoint` in the bottom strip and in the empty top strip returns `map-viewport` (the map), not the overlay div. At 390, the top-strip probe point landed on a header button, which is expected.

### BMKG quake popup, Google engine (1440 and 390)
- (a) Each on-screen marker (M4.4, M4.6) is hit-testable as `bmkg-marker`. A click opens the popup with the correct data, for example:
  - Magnitudo M4.4 • Kedalaman 21 km
  - Wilayah "Pusat gempa berada di laut 84 km Utara Ruteng"
  - Waktu "06 Okt 2026, 10.42 WIB"
  - Koordinat -7.86, 120.38
  - Potensi "Gempa ini dirasakan untuk diteruskan pada masyarakat"
  - Dirasakan "II - III Kab. Manggarai"
  - Lihat shakemap and the source link

  M4.6 shows no Potensi or shakemap because the feed has none for it.
- Re-clicking the open marker keeps the popup open across 2 consecutive clicks. Before the anchorTop fix, this toggled it closed.
- (b) Clicking inside the popup body leaves it open.
- (c) The X button (`aria-label="Tutup popup"`) closes it.
- (d) Clicking empty map closes it, at 1440 and at 390.
- (e) Clicking a volcano (G. Sinabung) closes the BMKG popup and opens the MAGMA popup, so only one popup is open at a time.
- (f) Layers toggle OFF: popup is null and markers drop to 0. Toggle ON: markers return (2) and no popup is shown.
- (g) The keyboard-focused marker host has tabindex=0, role=button and title "Gempa BMKG M4.4 — …". Pressing Enter opens the popup.

### BMKG quake popup, OSM engine (after `gmp-auth-failure`; 1440 and 390)
- Markers have role=button, tabindex=0 and aria-label "Gempa BMKG M4.4, … Buka detail".
- (h) Clicking each marker opens `.bmkg-popup` with the new fields (Magnitudo, Kedalaman, Wilayah, Waktu, Koordinat, Potensi, Dirasakan, shakemap, source).
- (i) Clicking empty map closes it, at 1440 and at 390.
- (j) Layers toggle OFF: popup is gone and markers drop to 0. Toggle ON: markers return (2).

## Notes
- The MAGMA popup still uses `mb-6`, so it can have the same "margin covers the marker" effect. It is not in this task's scope and was left unchanged.
- All temporary scripts, the browser profile and the screenshots in /tmp/dwcdp were deleted. `.agents/` stays untracked.
