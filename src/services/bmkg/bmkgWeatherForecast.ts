// Official BMKG Weather Forecast service (V1).
// Endpoint: https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode}
// Docs: https://data.bmkg.go.id/prakiraan-cuaca/ — JSON, no key, 3-day /
// 3-hourly, ~2 updates/day, 60 req/min/IP, BMKG attribution mandatory.
// CORS verified open (ACAO:*) 2026-10-01.
// FORECAST IS NOT A WARNING: nothing here may be labeled warning/alert/
// early-warning/disaster-prediction. Field names avoid those words.
import type { DisasterIncident } from '../../types';

export const BMKG_FORECAST_API = 'https://api.bmkg.go.id/publik/prakiraan-cuaca';
export const BMKG_FORECAST_INFO_URL = 'https://data.bmkg.go.id/prakiraan-cuaca/';
/** Client cache TTL: forecast updates ~2x/day; 12 min keeps us far under the limit. */
export const FORECAST_CACHE_TTL_MS = 12 * 60 * 1000;
export const FORECAST_TIMEOUT_MS = 15000;

export type BmkgForecastState =
  | 'LOADING'
  | 'READY'
  | 'NO_LOCATION'
  | 'INVALID_LOCATION'
  | 'NETWORK_ERROR'
  | 'HTTP_ERROR'
  | 'PARSE_ERROR';

export interface BmkgForecastSlot {
  datetime: string;
  localDatetime: string;
  temperatureC: number;
  humidityPct: number;
  weatherCode: number;
  weatherDesc: string;
  weatherDescEn: string;
  cloudCoverPct: number | null;
  precipitationMm: number | null;
  windSpeedMs: number | null;
  windDeg: number | null;
  windFrom: string;
  windTo: string;
  visibilityM: number | null;
  iconUrl: string;
  analysisDate: string;
}

export interface BmkgForecastDay {
  date: string;
  slots: BmkgForecastSlot[];
}

export interface BmkgForecast {
  kind: 'FORECAST';
  adm4: string;
  village: string;
  district: string;
  regency: string;
  province: string;
  latitude: number;
  longitude: number;
  timezone: string;
  days: BmkgForecastDay[];
  fetchedAt: string;
  source: 'BMKG';
  provenance: 'OFFICIAL';
  sourceUrl: string;
  isMock: false;
}

export interface BmkgForecastResult {
  state: Exclude<BmkgForecastState, 'LOADING'>;
  forecast: BmkgForecast | null;
  error?: string;
  fromCache?: boolean;
}

/**
 * Resolve a BMKG adm4 village code for a disaster, if the record carries one.
 * Current DisasterWatch records (name/province/coords only) do NOT include
 * adm4 — callers then show NO_LOCATION. Never guess a code from names.
 */
export function resolveForecastAdm4(disaster: DisasterIncident): string | null {
  const raw = (disaster as unknown as { adm4?: unknown }).adm4;
  if (typeof raw !== 'string') return null;
  const code = raw.trim();
  return /^[0-9]+(\.[0-9]+)*$/.test(code) ? code : null;
}

export function forecastUrl(adm4: string): string {
  return `${BMKG_FORECAST_API}?adm4=${encodeURIComponent(adm4)}`;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function parseSlot(s: unknown): BmkgForecastSlot | null {
  if (!s || typeof s !== 'object') return null;
  const r = s as Record<string, unknown>;
  const datetime = str(r.datetime);
  const t = num(r.t);
  const weatherDesc = str(r.weather_desc);
  if (!datetime || Number.isNaN(Date.parse(datetime)) || t === null || !weatherDesc) return null;
  return {
    datetime: new Date(Date.parse(datetime)).toISOString(),
    localDatetime: str(r.local_datetime),
    temperatureC: t,
    humidityPct: num(r.hu) ?? -1,
    weatherCode: num(r.weather) ?? -1,
    weatherDesc,
    weatherDescEn: str(r.weather_desc_en),
    cloudCoverPct: num(r.tcc),
    precipitationMm: num(r.tp),
    windSpeedMs: num(r.ws),
    windDeg: num(r.wd_deg),
    windFrom: str(r.wd),
    windTo: str(r.wd_to),
    visibilityM: num(r.vs),
    iconUrl: str(r.image),
    analysisDate: str(r.analysis_date),
  };
}

/** Normalize a raw BMKG forecast payload. Null when structurally unusable. */
export function normalizeForecast(payload: unknown, adm4: string, sourceUrl: string, fetchedAt: string): BmkgForecast | null {
  try {
    if (!payload || typeof payload !== 'object') return null;
    const root = payload as Record<string, unknown>;
    const loc = root.lokasi;
    if (!loc || typeof loc !== 'object') return null;
    const L = loc as Record<string, unknown>;
    if (str(L.adm4) !== adm4) return null;
    const data = (root as { data?: unknown }).data;
    if (!Array.isArray(data) || data.length === 0) return null;
    const days: BmkgForecastDay[] = [];
    for (const entry of data) {
      if (!entry || typeof entry !== 'object') continue;
      const cuaca = (entry as { cuaca?: unknown }).cuaca;
      if (!Array.isArray(cuaca)) continue;
      for (const daySlots of cuaca) {
        if (!Array.isArray(daySlots)) continue;
        const slots: BmkgForecastSlot[] = [];
        for (const s of daySlots) {
          const slot = parseSlot(s);
          if (slot) slots.push(slot);
        }
        if (slots.length > 0) {
          slots.sort((a, b) => (a.datetime < b.datetime ? -1 : 1));
          days.push({ date: slots[0]!.datetime.slice(0, 10), slots });
        }
      }
    }
    if (days.length === 0) return null;
    const lat = num(L.lat);
    const lng = num(L.lon);
    if (lat === null || lng === null) return null;
    return {
      kind: 'FORECAST',
      adm4,
      village: str(L.desa),
      district: str(L.kecamatan),
      regency: str(L.kotkab),
      province: str(L.provinsi),
      latitude: lat,
      longitude: lng,
      timezone: str(L.timezone),
      days,
      fetchedAt,
      source: 'BMKG',
      provenance: 'OFFICIAL',
      sourceUrl,
      isMock: false,
    };
  } catch {
    return null;
  }
}

// --- client cache (per adm4, TTL-bounded, concurrent-deduped) -----------------

const cache = new Map<string, { at: number; data: BmkgForecast }>();
const inflight = new Map<string, Promise<BmkgForecastResult>>();

export function clearForecastCache(): void {
  cache.clear();
  inflight.clear();
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

async function fetchJson(url: string, fetchImpl: FetchImpl): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FORECAST_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (res.status === 404) {
      const e = new Error('HTTP 404');
      (e as { forecastNotFound?: boolean }).forecastNotFound = true;
      throw e;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch + normalize + cache one adm4 forecast. Never throws; empty adm4
 * short-circuits to NO_LOCATION without any request. No Firestore, no backend.
 */
export function fetchForecast(
  adm4: string | null | undefined,
  options: { bypassCache?: boolean; fetchImpl?: FetchImpl; nowMs?: number } = {},
): Promise<BmkgForecastResult> {
  const code = typeof adm4 === 'string' ? adm4.trim() : '';
  if (!code) {
    return Promise.resolve({ state: 'NO_LOCATION', forecast: null });
  }
  if (!/^[0-9]+(\.[0-9]+)*$/.test(code)) {
    return Promise.resolve({ state: 'INVALID_LOCATION', forecast: null, error: 'Kode wilayah tidak valid.' });
  }
  const { bypassCache = false, fetchImpl = globalThis.fetch.bind(globalThis), nowMs = Date.now() } = options;
  if (!bypassCache) {
    const hit = cache.get(code);
    if (hit && nowMs - hit.at < FORECAST_CACHE_TTL_MS) {
      return Promise.resolve({ state: 'READY', forecast: hit.data, fromCache: true });
    }
    const ongoing = inflight.get(code);
    if (ongoing) return ongoing;
  }
  const url = forecastUrl(code);
  const task = (async (): Promise<BmkgForecastResult> => {
    try {
      const payload = await fetchJson(url, fetchImpl);
      const fetchedAt = new Date().toISOString();
      const forecast = normalizeForecast(payload, code, url, fetchedAt);
      if (!forecast) return { state: 'PARSE_ERROR', forecast: null, error: 'Respons BMKG tidak dapat diproses.' };
      cache.set(code, { at: nowMs, data: forecast });
      return { state: 'READY', forecast };
    } catch (e) {
      if (e instanceof Error && (e as { forecastNotFound?: boolean }).forecastNotFound) {
        return { state: 'INVALID_LOCATION', forecast: null, error: 'Kode wilayah tidak ditemukan di BMKG.' };
      }
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      if (/HTTP \d{3}/.test(msg)) return { state: 'HTTP_ERROR', forecast: null, error: 'BMKG mengembalikan galat HTTP.' };
      return { state: 'NETWORK_ERROR', forecast: null, error: 'Prakiraan BMKG sementara tidak dapat dimuat.' };
    } finally {
      inflight.delete(code);
    }
  })();
  if (!bypassCache) inflight.set(code, task);
  return task;
}
