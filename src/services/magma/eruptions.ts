// MAGMA "Informasi Letusan" (PVMBG eruption notices) — dated volcano warnings for the selected range.
// Source: https://magma.esdm.go.id/v1/gunung-api/informasi-letusan (public HTML timeline, CORS *,
// 15 notices per page, newest first). Pages are fetched until the range start is reached.
import { useEffect, useState } from 'react';
import { RANGE_LIMITS, resolveDateRange, type ResolvedRange } from '../../domain/dateRange';

export const MAGMA_ERUPTIONS_URL = 'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan';
/** Max pages read for one range (15 notices each; ~1–2 pages/day in active periods ≈ 3 months). */
const MAX_PAGES = 120;
const CONCURRENCY = 4;
const PAGE_TTL_MS = 10 * 60_000;

export interface EruptionNotice {
  id: string;
  volcano: string; // e.g. "Ibu", "Ili Lewotolok" (same names as markersGunungApi)
  at: string; // ISO UTC
  localTime: string; // e.g. "11:54 WIT"
  ashColumnM: number | null; // ash column height above summit (m), if reported
  text: string;
  detailUrl: string | null;
}

const MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};
const TZ_OFFSET: Record<string, number> = { WIB: 7, WITA: 8, WIT: 9 };

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&plusmn;/g, '±')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse one timeline page into notices (date headers apply to the items below them). */
export function parseEruptionPage(html: string): EruptionNotice[] {
  const out: EruptionNotice[] = [];
  let day: { y: number; m: number; d: number } | null = null;
  // Walk date headers and items in document order.
  const re =
    /timeline-date">([^<]*)<|timeline-time"><small>\s*(\d{1,2}):(\d{2})\s*(WIB|WITA|WIT)[\s\S]*?timeline-title"><a[^>]*>([^<]+)<\/a>[\s\S]*?timeline-text">([\s\S]*?)<\/p>([\s\S]*?)(?=timeline-item|$)/g;
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) {
      const dm = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(m[1]);
      const mon = dm ? MONTHS[dm[2]!.toLowerCase()] : undefined;
      day = dm && mon !== undefined ? { y: Number(dm[3]), m: mon, d: Number(dm[1]) } : null;
      continue;
    }
    if (!day) continue;
    const hh = Number(m[2]);
    const mm = Number(m[3]);
    const tz = m[4]!;
    const utc = Date.UTC(day.y, day.m, day.d, hh - TZ_OFFSET[tz]!, mm);
    const text = decode(m[6] ?? '');
    const col = /tinggi kolom abu teramati\s*±?\s*([\d.]+)\s*m di atas puncak/i.exec(text);
    const link = /href="(https:\/\/magma\.esdm\.go\.id\/v1\/gunung-api\/informasi-letusan\/[^"]+\/show)"/.exec(m[7] ?? '');
    out.push({
      id: link?.[1] ?? `${m[5]}-${utc}`,
      volcano: decode(m[5]!),
      at: new Date(utc).toISOString(),
      localTime: `${m[2]!.padStart(2, '0')}:${m[3]} ${tz}`,
      ashColumnM: col ? Number(col[1]!.replace(/\./g, '')) : null,
      text,
      detailUrl: link?.[1] ?? null,
    });
  }
  return out;
}

const pageCache = new Map<number, { at: number; items: EruptionNotice[] }>();
let lastPage = 0;

async function fetchPage(n: number, signal?: AbortSignal): Promise<EruptionNotice[]> {
  const hit = pageCache.get(n);
  if (hit && Date.now() - hit.at < PAGE_TTL_MS) return hit.items;
  const res = await fetch(`${MAGMA_ERUPTIONS_URL}?page=${n}`, { signal, headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`MAGMA letusan HTTP ${res.status}`);
  const html = await res.text();
  const items = parseEruptionPage(html);
  // Pagination links reveal the last page number (used by the binary search).
  for (const m of html.matchAll(/informasi-letusan\?page=(\d+)/g)) lastPage = Math.max(lastPage, Number(m[1]));
  pageCache.set(n, { at: Date.now(), items });
  return items;
}

function oldestOf(items: EruptionNotice[]): string {
  return items.reduce((min, x) => (x.at < min ? x.at : min), '9999');
}

export interface EruptionResult {
  notices: EruptionNotice[];
  /** True when the range had more pages than MAX_PAGES (only the newest part was loaded). */
  truncated: boolean;
}

/**
 * All notices with start <= at <= end. The archive is newest-first, so the first page touching
 * `end` is found by binary search (~11 requests even for 2018), then pages are read forward
 * until past `start` (capped at MAX_PAGES).
 */
export async function fetchEruptions(range: ResolvedRange, signal?: AbortSignal): Promise<EruptionResult> {
  const from = range.start.toISOString();
  const to = range.end.toISOString();

  const first = await fetchPage(1, signal);
  if (first.length === 0) throw new Error('MAGMA page format changed (no eruption notices)');

  // Smallest page whose oldest notice is <= `to` (pages beyond the end are empty → treated as old).
  let startPage = 1;
  if (oldestOf(first) > to) {
    let lo = 2;
    let hi = Math.max(lastPage, 2);
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const items = await fetchPage(mid, signal);
      if (items.length === 0 || oldestOf(items) <= to) hi = mid;
      else lo = mid + 1;
    }
    startPage = lo;
  }

  const all: EruptionNotice[] = [];
  let truncated = false;
  for (let page = startPage; ; page += CONCURRENCY) {
    if (page - startPage >= MAX_PAGES) {
      truncated = true;
      break;
    }
    const batch = await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => fetchPage(page + i, signal)));
    const items = batch.flat();
    all.push(...items);
    if (items.length === 0 || oldestOf(items) < from || (lastPage && page + CONCURRENCY > lastPage)) break;
  }
  const seen = new Set<string>();
  const notices = all
    .filter((x) => x.at >= from && x.at <= to && !seen.has(x.id) && (seen.add(x.id), true))
    .sort((a, b) => b.at.localeCompare(a.at));
  return { notices, truncated };
}

export type EruptionStatus =
  | { state: 'idle' | 'loading' }
  | { state: 'ready' }
  | { state: 'unavailable'; reason: string };

/** Eruption notices for the header date selection; fetched only while `enabled`. */
export function useMagmaEruptions(enabled: boolean, selectedDate: string) {
  const range = resolveDateRange(selectedDate, RANGE_LIMITS.magma);
  const [notices, setNotices] = useState<EruptionNotice[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState<EruptionStatus>({ state: 'idle' });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setStatus({ state: 'loading' });
    fetchEruptions(range, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setNotices(res.notices);
        setTruncated(res.truncated);
        setStatus({ state: 'ready' });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setNotices([]);
        setStatus({ state: 'unavailable', reason: e instanceof Error ? e.message : 'MAGMA letusan gagal dimuat' });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, range.id]);

  return { notices, truncated, status, range };
}
