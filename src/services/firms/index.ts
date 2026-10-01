// NASA FIRMS active-fire hotspots, fetched via backend proxy (MAP_KEY stays server-side, see vite.config.ts).
// Follows the app's date selector: Today / 24 jam / 7 hari / 30 hari.
// FIRMS area API allows max 5 days per request, so longer ranges are split into dated chunks.
import { useCallback, useEffect, useState } from 'react';

export const FIRMS_SOURCE_URL = 'https://firms.modaps.eosdis.nasa.gov/map/';
const INDONESIA_BBOX = '92,-13.5,143,9'; // west,south,east,north
const MAX_DAYS_PER_REQUEST = 5;
const CACHE_TTL_MS = 10 * 60_000;
// Above this many detections, merge nearby points into ~1 km cells to keep download→render responsive.
const AGGREGATE_THRESHOLD = 12_000;
const GRID_DEG = 0.01;

type FirmsSource = 'VIIRS_SNPP_NRT' | 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT' | 'MODIS_NRT';

const SOURCE_LABEL: Record<FirmsSource, string> = {
  VIIRS_SNPP_NRT: 'VIIRS S-NPP',
  VIIRS_NOAA20_NRT: 'VIIRS NOAA-20',
  VIIRS_NOAA21_NRT: 'VIIRS NOAA-21',
  MODIS_NRT: 'MODIS',
};

export interface FireHotspot {
  id: string;
  latitude: number;
  longitude: number;
  frp: number; // fire radiative power (MW); max within cell when aggregated
  confidence: 'low' | 'nominal' | 'high';
  acquiredAt: string; // ISO UTC; latest within cell when aggregated
  sensor: string;
  daynight: 'D' | 'N';
  /** Number of raw detections merged into this point (1 = not aggregated). */
  count: number;
}

export type FirmsStatus =
  | { state: 'idle' | 'loading' }
  | { state: 'ready'; count: number; updatedAt: string }
  | { state: 'unavailable'; reason: string };

export interface FirmsRange {
  key: 'today' | '24h' | '7d' | '30d';
  label: string; // short label for UI
  days: number;
  sources: FirmsSource[];
}

/** Map the header date selector label to a FIRMS query plan. */
export function firmsRangeFromSelection(selected: string): FirmsRange {
  const s = selected.toLowerCase();
  if (s.startsWith('30')) {
    // 30 days × all satellites would be ~60 MB of CSV; S-NPP alone keeps it usable.
    return { key: '30d', label: '30 hari', days: 30, sources: ['VIIRS_SNPP_NRT'] };
  }
  if (s.startsWith('7')) {
    return { key: '7d', label: '7 hari', days: 7, sources: ['VIIRS_SNPP_NRT', 'VIIRS_NOAA21_NRT'] };
  }
  const all: FirmsSource[] = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'];
  if (s.includes('24')) return { key: '24h', label: '24 jam', days: 2, sources: all };
  return { key: 'today', label: 'hari ini', days: 1, sources: all };
}

export function firmsSensorsLabel(range: FirmsRange): string {
  return range.sources.map((s) => SOURCE_LABEL[s]).join(', ');
}

const CONF: Record<string, FireHotspot['confidence']> = { l: 'low', n: 'nominal', h: 'high' };

function normConfidence(raw: string | undefined): FireHotspot['confidence'] {
  const v = (raw ?? '').trim().toLowerCase();
  if (CONF[v]) return CONF[v];
  const n = Number(v); // MODIS uses 0–100
  if (Number.isFinite(n)) return n >= 80 ? 'high' : n >= 30 ? 'nominal' : 'low';
  return 'nominal';
}

export function parseFirmsCsv(csv: string, sensor: string): FireHotspot[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(',');
  const col = (n: string) => head.indexOf(n);
  const iLat = col('latitude'), iLng = col('longitude'), iFrp = col('frp');
  const iConf = col('confidence'), iDate = col('acq_date'), iTime = col('acq_time'), iDn = col('daynight');
  if (iLat < 0 || iLng < 0) throw new Error('Unexpected FIRMS CSV format');

  const out: FireHotspot[] = [];
  for (let k = 1; k < lines.length; k++) {
    const c = lines[k].split(',');
    const lat = Number(c[iLat]);
    const lng = Number(c[iLng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const t = (c[iTime] ?? '0').padStart(4, '0');
    out.push({
      id: `${sensor}-${c[iDate]}-${t}-${lat}-${lng}`,
      latitude: lat,
      longitude: lng,
      frp: Number(c[iFrp]) || 0,
      confidence: normConfidence(c[iConf]),
      acquiredAt: `${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`,
      sensor,
      daynight: c[iDn]?.trim() === 'N' ? 'N' : 'D',
      count: 1,
    });
  }
  return out;
}

function utcDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Split "last N days ending today" into ≤5-day chunks: [{days, startDate}]. */
function planChunks(days: number): { days: number; start: string }[] {
  const chunks: { days: number; start: string }[] = [];
  let startOffset = -(days - 1);
  while (startOffset <= 0) {
    const len = Math.min(MAX_DAYS_PER_REQUEST, 1 - startOffset);
    chunks.push({ days: len, start: utcDate(startOffset) });
    startOffset += len;
  }
  return chunks;
}

async function fetchChunk(source: FirmsSource, days: number, start: string, signal?: AbortSignal) {
  const res = await fetch(`/api/firms/${source}/${INDONESIA_BBOX}/${days}/${start}`, { signal });
  const text = await res.text();
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
  if (!text.startsWith('latitude')) throw new Error(text.slice(0, 120) || 'FIRMS proxy unavailable');
  return parseFirmsCsv(text, SOURCE_LABEL[source]);
}

function aggregate(list: FireHotspot[]): FireHotspot[] {
  const cells = new Map<string, FireHotspot>();
  for (const h of list) {
    const gx = Math.round(h.longitude / GRID_DEG);
    const gy = Math.round(h.latitude / GRID_DEG);
    const key = `${gx}:${gy}`;
    const cur = cells.get(key);
    if (!cur) {
      cells.set(key, { ...h, id: `cell-${key}`, latitude: gy * GRID_DEG, longitude: gx * GRID_DEG });
      continue;
    }
    cur.count += h.count;
    if (h.frp > cur.frp) {
      cur.frp = h.frp;
      cur.confidence = h.confidence;
    }
    if (h.acquiredAt > cur.acquiredAt) {
      cur.acquiredAt = h.acquiredAt;
      cur.daynight = h.daynight;
    }
    if (!cur.sensor.includes(h.sensor)) cur.sensor += `, ${h.sensor}`;
  }
  return [...cells.values()];
}

const cache = new Map<string, { at: number; data: FireHotspot[] }>();

export async function fetchFirmsHotspots(range: FirmsRange, signal?: AbortSignal): Promise<FireHotspot[]> {
  const hit = cache.get(range.key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const jobs = range.sources.flatMap((src) => planChunks(range.days).map((c) => fetchChunk(src, c.days, c.start, signal)));
  const settled = await Promise.allSettled(jobs);
  const ok = settled.filter((r): r is PromiseFulfilledResult<FireHotspot[]> => r.status === 'fulfilled');
  if (ok.length === 0) {
    const first = settled[0];
    throw first && first.status === 'rejected' ? first.reason : new Error('FIRMS unavailable');
  }

  const cutoff = range.key === '24h' ? new Date(Date.now() - 24 * 3600_000).toISOString() : '';
  let list = ok.flatMap((r) => r.value).filter((h) => h.confidence !== 'low' && h.acquiredAt >= cutoff);
  if (list.length > AGGREGATE_THRESHOLD) list = aggregate(list);
  list.sort((a, b) => b.frp - a.frp); // strongest first

  cache.set(range.key, { at: Date.now(), data: list });
  return list;
}

export function useFirmsHotspots(selectedDate: string) {
  const range = firmsRangeFromSelection(selectedDate);
  const [hotspots, setHotspots] = useState<FireHotspot[]>([]);
  const [status, setStatus] = useState<FirmsStatus>({ state: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setRefreshing(true);
    setStatus({ state: 'loading' });
    fetchFirmsHotspots(range, ctrl.signal)
      .then((list) => {
        if (ctrl.signal.aborted) return;
        setHotspots(list);
        setStatus({ state: 'ready', count: list.length, updatedAt: new Date().toISOString() });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setHotspots([]);
        setStatus({ state: 'unavailable', reason: e instanceof Error ? e.message : 'FIRMS fetch failed' });
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setRefreshing(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.key, nonce]);

  const refresh = useCallback(() => {
    cache.clear();
    setNonce((n) => n + 1);
  }, []);
  return { hotspots, status, refreshing, refresh, range };
}
