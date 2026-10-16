// Shared BMKG popup content (Google + Leaflet use the same copy).
// Required attribution: "Source: BMKG" + link to official BMKG endpoints.
import { BMKG_SOURCE_URL, uniqueAreaNames, type EarthquakeEvent, type BmkgWeatherWarning } from '../../services/bmkg';
import { translate, localeFor } from '../../i18n';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Base URL of BMKG Shakemap images (the `Shakemap` field is a filename). */
export const BMKG_SHAKEMAP_BASE = 'https://data.bmkg.go.id/DataMKG/TEWS/';

/** Local, readable quake time (falls back to the raw string). */
export function formatQuakeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString(localeFor(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function buildBmkgPopupHtml(e: EarthquakeEvent): string {
  const potential = e.potential ? `<div>${translate('Potensi')}: <b>${esc(e.potential)}</b></div>` : '';
  const felt = e.feltArea ? `<div>${translate('Dirasakan')}: <b>${esc(e.feltArea)}</b></div>` : '';
  const shakemap = e.mmi
    ? `<div><a href="${BMKG_SHAKEMAP_BASE}${esc(encodeURIComponent(e.mmi))}" target="_blank" rel="noopener noreferrer">${translate('Lihat shakemap')}</a></div>`
    : '';
  return (
    `<div style="min-width:220px;max-width:280px;font-size:12px;line-height:1.5">` +
    `<div style="font-weight:800;letter-spacing:.04em">${translate('GEMPA BUMI · BMKG')}</div>` +
    `<div>${translate('Magnitudo')}: <b>M${esc(e.magnitude.toFixed(1))}</b></div>` +
    `<div>${translate('Kedalaman')}: <b>${esc(String(e.depthKm))} km</b></div>` +
    `<div>${translate('Wilayah')}: <b>${esc(e.region)}</b></div>` +
    `<div>${translate('Waktu')}: <b>${esc(formatQuakeTime(e.eventTime))}</b></div>` +
    `<div>${translate('Koordinat')}: <b>${e.latitude.toFixed(2)}, ${e.longitude.toFixed(2)}</b></div>` +
    potential +
    felt +
    shakemap +
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
