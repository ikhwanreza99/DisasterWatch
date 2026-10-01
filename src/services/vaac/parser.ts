// Darwin VAAC advisory parser — pure TS (no React / browser APIs) so it also runs in Node
// (scripts/fetchVaacSnapshot.ts builds the production snapshot with it).

export const VAAC_SOURCE_URL = 'https://www.bom.gov.au/aviation/warnings/volcanic-ash/';

export type LatLng = [number, number];

export interface AshCloud {
  /** "OBS" (observed), "EST" (estimated), or forecast label like "+6 HR". */
  label: string;
  validAt: string | null; // e.g. "01/1010Z"
  levels: string | null; // e.g. "SFC/FL070"
  polygon: LatLng[];
  movement: string | null; // e.g. "MOV NE 10KT"
}

export interface AshAdvisory {
  id: string;
  volcano: string;
  area: string;
  summit: LatLng;
  summitElev: string | null;
  issuedAt: string; // ISO UTC from DTG
  advisoryNr: string | null;
  infoSource: string | null;
  eruptionDetails: string | null;
  current: AshCloud | null;
  forecasts: AshCloud[];
  remarks: string | null;
  nextAdvisory: string | null;
  terminated: boolean;
}

export type VaacStatus =
  | { state: 'idle' | 'loading' }
  | { state: 'ready'; updatedAt: string }
  | { state: 'unavailable'; reason: string };

/** "S0806" → -8.1, "E11255" → 112.9167 (degrees + minutes). */
export function parseCoord(token: string): number | null {
  const m = /^([NSEW])(\d{2,3})(\d{2})$/.exec(token.trim());
  if (!m) return null;
  const deg = Number(m[2]) + Number(m[3]) / 60;
  return m[1] === 'S' || m[1] === 'W' ? -deg : deg;
}

function parsePoint(lat: string, lng: string): LatLng | null {
  const a = parseCoord(lat);
  const b = parseCoord(lng);
  return a === null || b === null ? null : [a, b];
}

function parsePolygon(text: string): LatLng[] {
  const pts: LatLng[] = [];
  for (const m of text.matchAll(/([NS]\d{4})\s+([EW]\d{5})/g)) {
    const p = parsePoint(m[1]!, m[2]!);
    if (p) pts.push(p);
  }
  return pts;
}

const FIELD_KEYS = [
  'DTG', 'VAAC', 'VOLCANO', 'PSN', 'AREA', 'SOURCE ELEV', 'ADVISORY NR', 'INFO SOURCE', 'AVIATION COLOUR CODE',
  'ERUPTION DETAILS', 'OBS VA DTG', 'EST VA DTG', 'OBS VA CLD', 'EST VA CLD',
  'FCST VA CLD \\+6 ?HR', 'FCST VA CLD \\+12 ?HR', 'FCST VA CLD \\+18 ?HR', 'RMK', 'NXT ADVISORY',
];
const FIELD_RE = new RegExp(`(${FIELD_KEYS.join('|')}):`, 'g');

/** Split one "VA ADVISORY ..." block into its labelled fields. */
function fields(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const hits = [...block.matchAll(FIELD_RE)];
  hits.forEach((h, i) => {
    // Normalise "+6HR" / "+6 HR" → "+6 HR"
    const key = h[1]!.replace(/\s+/g, ' ').replace(/\+(\d+) ?HR/, '+$1 HR');
    const end = i + 1 < hits.length ? hits[i + 1]!.index! : block.length;
    // Keep the first occurrence only (later sections of the page may repeat labels).
    if (!(key in out)) out[key] = block.slice(h.index! + h[0].length, end).trim().replace(/=\s*$/, '');
  });
  return out;
}

function cloud(label: string, raw: string | undefined, validAt: string | null): AshCloud | null {
  if (!raw) return null;
  // Forecast fields start with their own valid time, e.g. "01/1610Z SFC/FL070 N0144 E12747 - ..."
  let rest = raw;
  let at = validAt;
  const t = /^(\d{2}\/\d{4}Z)\s+/.exec(rest);
  if (t) {
    at = t[1]!;
    rest = rest.slice(t[0].length);
  }
  const polygon = parsePolygon(rest);
  if (polygon.length < 3) return { label, validAt: at, levels: null, polygon: [], movement: null };
  const lv = /((?:SFC|FL\d{3})\/FL\d{3})/.exec(rest);
  const mv = /(MOV\s+[A-Z]+\s+\d+KT)/.exec(rest);
  return { label, validAt: at, levels: lv?.[1] ?? null, polygon, movement: mv?.[1] ?? null };
}

/** DTG "20261001/1030Z" → ISO "2026-10-01T10:30:00Z". */
function dtgToIso(dtg: string): string | null {
  const m = /(\d{4})(\d{2})(\d{2})\/(\d{2})(\d{2})Z/.exec(dtg);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z` : null;
}

/**
 * Parse the BOM volcanic-ash page. Only Darwin VAAC advisories are kept; for each volcano the
 * latest advisory wins. Terminated advisories ("NO FURTHER ADVISORIES") are kept but flagged.
 */
export function parseVaacPage(html: string): AshAdvisory[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

  const latest = new Map<string, AshAdvisory>();
  for (const block of text.split(/VA ADVISORY\s+/).slice(1)) {
    const f = fields(block);
    if (!/DARWIN/i.test(f['VAAC'] ?? '')) continue;
    const issuedAt = dtgToIso(f['DTG'] ?? '');
    const psn = /([NS]\d{4})\s+([EW]\d{5})/.exec(f['PSN'] ?? '');
    const summit = psn ? parsePoint(psn[1]!, psn[2]!) : null;
    if (!issuedAt || !summit) continue;

    const volcano = (f['VOLCANO'] ?? '').replace(/\s+\d{6}\s*$/, '').trim() || 'UNKNOWN';
    const obsAt = (f['OBS VA DTG'] ?? f['EST VA DTG'] ?? '').match(/\d{2}\/\d{4}Z/)?.[0] ?? null;
    const current = f['OBS VA CLD']
      ? cloud('OBS', f['OBS VA CLD'], obsAt)
      : cloud('EST', f['EST VA CLD'], obsAt);
    const forecasts = (['+6 HR', '+12 HR', '+18 HR'] as const)
      .map((k) => cloud(k, f[`FCST VA CLD ${k}`], null))
      .filter((c): c is AshCloud => !!c && c.polygon.length >= 3);
    const next = f['NXT ADVISORY'] ?? null;

    const adv: AshAdvisory = {
      id: `${volcano}-${f['DTG']}`,
      volcano,
      area: (f['AREA'] ?? '').trim(),
      summit,
      summitElev: f['SOURCE ELEV'] ?? null,
      issuedAt,
      advisoryNr: f['ADVISORY NR'] ?? null,
      infoSource: f['INFO SOURCE'] ?? null,
      eruptionDetails: f['ERUPTION DETAILS'] ?? null,
      current,
      forecasts,
      remarks: f['RMK'] ?? null,
      nextAdvisory: next,
      terminated: /NO FURTHER ADVISORIES/i.test(next ?? ''),
    };
    const prev = latest.get(volcano);
    if (!prev || prev.issuedAt < adv.issuedAt) latest.set(volcano, adv);
  }
  return [...latest.values()].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}
