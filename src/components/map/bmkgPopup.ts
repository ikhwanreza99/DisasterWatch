// Shared BMKG popup content (Google + Leaflet use the same copy).
// Required attribution: "Source: BMKG" + link to official BMKG endpoints.
import { BMKG_SOURCE_URL, uniqueAreaNames, type EarthquakeEvent, type BmkgWeatherWarning } from '../../services/bmkg';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildBmkgPopupHtml(e: EarthquakeEvent): string {
  const felt = e.feltArea ? `<div style="margin-top:2px">Felt area: <b>${esc(e.feltArea)}</b></div>` : '';
  const mmi = e.mmi ? `<div>MMI: <b>${esc(e.mmi)}</b></div>` : '';
  return (
    `<div style="min-width:220px;max-width:280px;font-size:12px;line-height:1.5">` +
    `<div style="font-weight:800;letter-spacing:.04em">EARTHQUAKE</div>` +
    `<div>Source: <b>BMKG</b></div>` +
    `<div>Magnitude: <b>M${esc(String(e.magnitude))}</b></div>` +
    `<div>Depth: <b>${esc(String(e.depthKm))} km</b></div>` +
    `<div>Location: <b>${esc(e.region)}</b> (${e.latitude.toFixed(2)}, ${e.longitude.toFixed(2)})</div>` +
    `<div>Time: <b>${esc(e.eventTime)}</b></div>` +
    felt +
    mmi +
    `<div style="margin-top:4px"><a href="${BMKG_SOURCE_URL}" target="_blank" rel="noopener noreferrer">Source: BMKG — data.bmkg.go.id/gempabumi</a></div>` +
    `</div>`
  );
}

/** Popup for BMKG weather early warnings (polygons reference the same record). */
export function buildBmkgWeatherPopupHtml(w: BmkgWeatherWarning): string {
  const areaNames = uniqueAreaNames(w);
  const areaLine = areaNames.length > 0 ? areaNames.join(', ') : 'Indonesia';
  const link = w.web || w.sourceUrl;
  return (
    `<div style="min-width:220px;max-width:280px;font-size:12px;line-height:1.5">` +
    `<div style="font-weight:800;letter-spacing:.04em">BMKG WEATHER WARNING</div>` +
    `<div>Source: <b>BMKG</b> (official nowcast)</div>` +
    `<div>Event: <b>${esc(w.event)}</b></div>` +
    `<div style="margin-top:2px">${esc(w.headline)}</div>` +
    `<div style="margin-top:2px">Affected area: <b>${esc(areaLine)}</b></div>` +
    `<div>Effective: <b>${esc(w.effective)}</b></div>` +
    `<div>Expires: <b>${esc(w.expires)}</b></div>` +
    `<div style="margin-top:4px"><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Source: BMKG — nowcast detail</a></div>` +
    `</div>`
  );
}
