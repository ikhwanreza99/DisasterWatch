// NASA FIRMS active-fire hotspots, fetched via backend proxy (MAP_KEY stays server-side, see vite.config.ts).
// Follows the app's date selector: Today / 24 jam / 7 hari / 30 hari / custom range (<=31 days).
// FIRMS area API allows max 5 days per request, so longer ranges are split into dated chunks.
import { useCallback, useEffect, useState } from 'react';
import { resolveDateRange, type ResolvedRange } from '../../domain/dateRange';

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

export interface FirmsProgress { completed: number; total: number; failed: number; }

export type FirmsStatus =
  | { state: 'idle' | 'loading' }
  | { state: 'ready'; count: number; updatedAt: string; failed?: number }
  | { state: 'unavailable'; reason: string };

export interface FirmsRange extends ResolvedRange {
  sources: FirmsSource[];
}

/** Map the header date selection (preset or custom range) to a FIRMS query plan. */
export function firmsRangeFromSelection(selected: string): FirmsRange {
  const r = resolveDateRange(selected);
  const all: FirmsSource[] = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'];
  // Many days x all satellites is tens of MB of CSV; use fewer sensors for longer ranges.
  const sources: FirmsSource[] =
    r.days <= 2 ? all : r.days <= 7 ? ['VIIRS_SNPP_NRT', 'VIIRS_NOAA21_NRT'] : ['VIIRS_SNPP_NRT'];
  return { ...r, sources };
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

const DAY_MS = 86_400_000;

/** Split the UTC calendar days touched by [start, end] into <=5-day chunks: [{days, startDate}]. */
function planChunks(start: Date, end: Date): { days: number; start: string }[] {
  const first = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const chunks: { days: number; start: string }[] = [];
  for (let t = first; t <= last; t += MAX_DAYS_PER_REQUEST * DAY_MS) {
    const len = Math.min(MAX_DAYS_PER_REQUEST, Math.round((last - t) / DAY_MS) + 1);
    chunks.push({ days: len, start: new Date(t).toISOString().slice(0, 10) });
  }
  return chunks;
}

// Dev: Vite proxy injects the server-side NASA_FIRMS_MAP_KEY (see vite.config.ts).
// Production (static Firebase Hosting, no server): call FIRMS directly (it sends CORS *)
// with VITE_NASA_FIRMS_MAP_KEY. NOTE: VITE_* is inlined into the public bundle.
const PROD_FIRMS_KEY = import.meta.env?.VITE_NASA_FIRMS_MAP_KEY || '';

function firmsUrl(source: FirmsSource, days: number, start: string): string {
  const path = `${source}/${INDONESIA_BBOX}/${days}/${start}`;
  if (import.meta.env?.DEV || !PROD_FIRMS_KEY) return `/api/firms/${path}`;
  return `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(PROD_FIRMS_KEY)}/${path}`;
}

async function fetchChunk(source: FirmsSource, days: number, start: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 45_000);
  try {
    const res = await fetch(firmsUrl(source, days, start), { signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
    if (!text.startsWith('latitude')) throw new Error('Respons FIRMS tidak valid');
    return parseFirmsCsv(text, SOURCE_LABEL[source]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
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

export async function fetchFirmsHotspots(
  range: FirmsRange,
  signal?: AbortSignal,
  onProgress?: (progress: FirmsProgress, hotspots: FireHotspot[]) => void,
): Promise<FireHotspot[]> {
  const hit = cache.get(range.id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    onProgress?.({ completed: 0, total: 0, failed: 0 }, hit.data);
    return hit.data;
  }
  const tasks = range.sources.flatMap(src => planChunks(range.start, range.end).map(chunk => ({ src, ...chunk })));
  const progress = { completed: 0, total: tasks.length, failed: 0 };
  const raw: FireHotspot[] = [];
  let list: FireHotspot[] = [];
  const from = range.start.toISOString(), to = range.end.toISOString();
  onProgress?.({ ...progress }, []);
  await Promise.all(tasks.map(async task => {
    try {
      const data = await fetchChunk(task.src, task.days, task.start, signal);
      if (signal?.aborted) return;
      for (const h of data) if (h.confidence !== 'low' && h.acquiredAt >= from && h.acquiredAt <= to) raw.push(h);
      list = raw.length > AGGREGATE_THRESHOLD ? aggregate(raw) : [...raw];
      list.sort((a, b) => b.frp - a.frp);
    } catch {
      progress.failed++;
    } finally {
      progress.completed++;
      if (!signal?.aborted) onProgress?.({ ...progress }, list);
    }
  }));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (progress.failed === tasks.length) throw new Error('FIRMS belum tersedia atau waktu tunggu habis.');
  // Incomplete responses must be retried, not cached as complete data.
  if (!progress.failed) cache.set(range.id, { at: Date.now(), data: list });
  return list;
}

export function useFirmsHotspots(selectedDate: string) {
  const range = firmsRangeFromSelection(selectedDate);
  const [hotspots, setHotspots] = useState<FireHotspot[]>([]);
  const [status, setStatus] = useState<FirmsStatus>({ state: 'idle' });
  const [progress, setProgress] = useState<FirmsProgress>({ completed: 0, total: 0, failed: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setRefreshing(true);
    setStatus({ state: 'loading' });
    setHotspots([]);
    setProgress({ completed: 0, total: 0, failed: 0 });
    let failed = 0;
    fetchFirmsHotspots(range, ctrl.signal, (next, partial) => {
      if (ctrl.signal.aborted) return;
      failed = next.failed;
      setProgress(next);
      setHotspots(partial);
    })
      .then((list) => {
        if (ctrl.signal.aborted) return;
        setHotspots(list);
        setStatus({ state: 'ready', failed, count: list.length, updatedAt: new Date().toISOString() });
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
  }, [range.id, nonce]);

  const refresh = useCallback(() => {
    cache.clear();
    setNonce((n) => n + 1);
  }, []);
  return { hotspots, status, progress, refreshing, refresh, range };
}
