// BMKG direct browser-fetch adapter (V1).
// Official source: https://data.bmkg.go.id/gempabumi/
// CORS: `access-control-allow-origin: *` verified 2026-10-01 → direct fetch works.
// Constraints: never throws to UI, never persists to Firestore, never calls Gemini.
import { BMKG_FEEDS, type BmkgFeedKind, type EarthquakeEvent } from './bmkgTypes';
import { dedupeEarthquakes, normalizeBmkgPayload } from './bmkgNormalizer';

export interface BmkgFeedResult {
  feed: BmkgFeedKind;
  events: EarthquakeEvent[];
  rejected: number;
  ok: boolean;
  error?: string;
  retrievedAt: string;
}

export interface BmkgCombinedResult {
  events: EarthquakeEvent[];
  rejected: number;
  perFeed: Record<BmkgFeedKind, { ok: boolean; count: number; error?: string }>;
  retrievedAt: string;
  /** True when at least one feed succeeded. */
  anyOk: boolean;
}

const FETCH_TIMEOUT_MS = 15000;

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeed(feed: BmkgFeedKind): Promise<BmkgFeedResult> {
  const retrievedAt = new Date().toISOString();
  try {
    const payload = await fetchJson(BMKG_FEEDS[feed]);
    const { events, rejected } = normalizeBmkgPayload(payload, retrievedAt);
    return { feed, events, rejected, ok: true, retrievedAt };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { feed, events: [], rejected: 0, ok: false, error: reason.slice(0, 300), retrievedAt };
  }
}

/** Latest auto-detected earthquake (single-record feed → 0..1 events). */
export async function getLatestEarthquake(): Promise<BmkgFeedResult> {
  return fetchFeed('latest');
}

/** Latest M5+ earthquakes (array feed). */
export async function getRecentEarthquakes(): Promise<BmkgFeedResult> {
  return fetchFeed('recentM5');
}

/** Felt earthquakes (array feed with Dirasakan areas). */
export async function getFeltEarthquakes(): Promise<BmkgFeedResult> {
  return fetchFeed('felt');
}

/** Fetch all feeds, merge + dedupe (shared auto/felt record collapses to one ID). */
export async function getAllBmkgEarthquakes(): Promise<BmkgCombinedResult> {
  const retrievedAt = new Date().toISOString();
  const [latest, recentM5, felt] = await Promise.all([
    getLatestEarthquake(),
    getRecentEarthquakes(),
    getFeltEarthquakes(),
  ]);
  const merged = dedupeEarthquakes([...latest.events, ...recentM5.events, ...felt.events]);
  const rejected = latest.rejected + recentM5.rejected + felt.rejected;
  return {
    events: merged,
    rejected,
    perFeed: {
      latest: { ok: latest.ok, count: latest.events.length, ...(latest.error ? { error: latest.error } : {}) },
      recentM5: { ok: recentM5.ok, count: recentM5.events.length, ...(recentM5.error ? { error: recentM5.error } : {}) },
      felt: { ok: felt.ok, count: felt.events.length, ...(felt.error ? { error: felt.error } : {}) },
    },
    retrievedAt,
    anyOk: latest.ok || recentM5.ok || felt.ok,
  };
}
