# Main's UI merged into rafii-api, with the API map layers restored behind one master toggle

The in-progress merge of `origin/main` into `rafii-api` takes main's presentation code as-is. App, Header, ExpandedDetailContent, CategoryFilterBar, LoginModal, MapChatComposer, AIHelpdeskPanel and the news classification are byte-identical to `origin/main`. Only two files differ from main. `MapCanvas.tsx` gets back the BMKG earthquake markers and the Google Weather city chips that main deleted. It also gains a `showApiLayers` master state (default ON) that now drives BMKG quakes, BMKG warning polygons, city weather, FIRMS, MAGMA and VAAC. `SlimSidebar.tsx` gets back the "Cuaca Lapangan" and BMKG forecast cards. The new toggle sits directly under locate-me in `map-zoom-controls` and uses the same glass style. The merge is staged and uncommitted: HEAD is still 100e4e3 and MERGE_HEAD is 432bdb1.

Watch for: the toggle runs its popup-clearing side effects inside a state updater (confirmed, minor). The restored sidebar weather/forecast cards and the OSM-engine rendering of the restored layers were never seen at runtime (confirmed gap in the evidence).

**Verdict**: APPROVED

## High-level view

The look follows main. Every conflicted or presentation file was resolved to `origin/main`. The rafii-only UI is gone as the plan intended: the Panel toggle, `showPanels`/`showToolbar`/`compactTop`, UrgentNeedsCard, and the hidden-by-default KPI/signals rows. The verification run in headless Brave confirmed the header ("Laporkan Bencana", no Panel button), the search + "Buka Menu Sidebar" toolbar, and the compact chat composer bottom-right on both desktop and mobile. It also compared these against a build of main.

The API data is wired back by reverse-applying main's deletions in MapCanvas. App still runs the BMKG earthquake, BMKG warning and FIRMS hooks unchanged from main. Firestore incidents and news cards come from main's App and SlimSidebar. MAGMA, VAAC, eruptions and city weather now fetch on mount whatever the toggle says, so the toggle only hides layers and never refetches. FIRMS, MAGMA and VAAC are ON by default, where they were OFF on rafii-api. This is a deliberate reading of "semua api" that the plan records.

The toggle meets the accessibility spec. It is a native `<button>` with `aria-pressed`, a fixed `aria-label="Tampilkan layer data API"`, a state-dependent Indonesian `title`, and a focus-visible outline. A fixed label with a changing `aria-pressed` is the correct toggle-button pattern. The CDP run confirmed the ON → OFF → ON behavior: marker counts went 2/21/1 → 0 → back, and the icon switched between Layers and EyeOff. On mobile the toggle sits at x=12 and does not overlap the composer.

The hard constraints hold. Nothing is committed. `.env` is ignored and unmodified. Local `main` and the other branches are unchanged. The `.kilo/thorn-currency` worktree predates this task. `.agents/` is untracked.

<details>
<summary>Issues (3)</summary>

1. **Side effects inside the setState updater**: `toggleApiLayers` calls six `setSelected*` setters and `setShowMagmaLegend` from inside the `setShowApiLayers` updater (confirmed). Read `showApiLayers` directly in the callback, or clear the popups in an effect keyed on `showApiLayers`. This is non-blocking because the setters are idempotent.
2. **Restored sidebar cards not verified at runtime**: the `mini-weather` count was 0 because the sidebar was minimized in the headless run (confirmed gap). Open an incident sidebar once and confirm that the WeatherCard and BmkgForecastPanel render below "Update Berita Terkini".
3. **OSM path not exercised**: Google loaded on :3000, so the restored OSM BMKG marker effect and city-chip layer were only type-checked (confirmed gap). Force the OSM engine once and toggle.

</details>

<details><summary>Details</summary>

### One master switch replacing five per-layer states

The five `useState`s became derived constants (`const showBmkg = showApiLayers;` and so on), so the existing rendering branches for both engines stay unchanged. The handler looks like this:

```ts
setShowApiLayers((on) => {
  if (on) { setSelectedBmkgId(null); /* …5 more… */ setShowMagmaLegend(false); }
  return !on;
});
```

The handler queues other state updates from inside an updater, and React runs updaters twice in StrictMode (confirmed pattern). The result is correct today because every call is an idempotent null/false set. It is still the kind of code that breaks quietly if someone later adds a non-idempotent call there, such as analytics or a toast.

Turning the layers OFF also hides the MAGMA (i) legend button, because it is gated on `showMagma`. With the default ON, that button is now always visible under the new toggle. Main never showed it, since main had `showMagma` fixed at false. This makes the bottom-left column two buttons taller than on main. Verification measured it at 390×844 with no overlap. Shorter phones (around 667px tall) were not checked.

### Restored layers and fetch policy

The BMKG `AdvancedMarker` block, the OSM `bmkg-osm-marker` effect, `cityWeatherChipHtml`/`cityWeatherPopupHtml`, the `city` PopupKind and the `selectedCityId` single-popup handling were copied unchanged from a5c49e6. Popup copy in both is a mix of English ("EARTHQUAKE", "Magnitude", "Source") and Indonesian. That mix existed on a5c49e6/rafii-api, so it is not a regression.

Fetching MAGMA, VAAC, eruptions and 21 Google Weather cities on every page load costs more startup requests and Weather API quota than rafii-api did, where MAGMA and VAAC were off and lazy. The plan accepts this as a trade-off so the toggle never causes refetch flicker.

### Test coverage

The evidence covers lint, build, the 10 node:test cases, and CDP-driven DOM/screenshot checks of the toggle on both viewports. Not tested: the OSM engine rendering of the restored layers, the sidebar WeatherCard/BmkgForecastPanel, real keyboard Tab/Space activation of the toggle, and the column height on short mobile viewports.

</details>

<details>
<summary>File map</summary>

Everything else in the merge equals `origin/main` exactly (`git diff --cached origin/main --stat` shows only these two files).

- `src/components/MapCanvas.tsx`: restores the BMKG quake markers (Google + OSM) and the city-weather chips, adds the `showApiLayers` master state, makes the fetch hooks always on, and adds the `api-layers-toggle` button under locate-me.
- `src/components/SlimSidebar.tsx`: restores the "Cuaca Lapangan" WeatherCard and BmkgForecastPanel below "Update Berita Terkini".
- `src/components/UrgentNeedsCard.tsx`: deleted (deleted on main as well).

Full diff: `git -C /Users/960302/Downloads/DisasterWatch diff --cached origin/main`

</details>
