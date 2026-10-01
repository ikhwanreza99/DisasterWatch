// BMKG Weather Warning / Nowcast adapter (V1).
// Official feeds: https://www.bmkg.go.id/alerts/nowcast/id (+ /en, CAP details).
// Standard: CAP 1.2 XML. Flow: RSS listing → CAP detail docs → normalize.
// Constraints: no Gemini parsing, no Firestore, ≤60 req/min/IP, no mock data.
// XML is parsed with dependency-free string scanning so the exact same code
// runs in browsers (direct fetch) and in Node fixture tests (no DOMParser).
import { fnv1aHex } from './bmkgNormalizer';
import {
  BMKG_WEATHER_FEED_ID,
  type BmkgWarningStatus,
  type BmkgWeatherArea,
  type BmkgWeatherWarning,
} from './bmkgTypes';

export const FETCH_TIMEOUT_MS = 15000;
/** Upper bound on CAP detail docs per refresh (1 RSS + N CAP stays < 60 req/min). */
export const MAX_CAP_DETAILS = 20;

export interface BmkgRssItem {
  title: string;
  link: string;
  description: string;
  guid: string;
  pubDate: string;
}

export interface BmkgWeatherResult {
  warnings: BmkgWeatherWarning[];
  ok: boolean;
  error?: string;
  /** Machine-readable failure class for accurate UI states (never shown raw). */
  errorType: BmkgWeatherErrorType;
  fetchedAt: string;
  rssCount: number;
  capOk: number;
  capFail: number;
}

/**
 * Internal failure classification for weather-warning fetching.
 * OK = usable records. EMPTY = reachable feed, zero items (also ok).
 * *_CORS_BLOCKED = browser blocked before JS saw a response (TypeError).
 * *_HTTP_ERROR = server answered with an error status. *_PARSE_ERROR =
 * reachable but structurally unusable. UNKNOWN = anything else (e.g. timeout).
 */
export type BmkgWeatherErrorType =
  | 'OK'
  | 'RSS_CORS_BLOCKED'
  | 'RSS_HTTP_ERROR'
  | 'RSS_PARSE_ERROR'
  | 'CAP_CORS_BLOCKED'
  | 'CAP_HTTP_ERROR'
  | 'CAP_PARSE_ERROR'
  | 'EMPTY'
  | 'UNKNOWN';

type FetchFailureKind = 'CORS_BLOCKED' | 'HTTP_ERROR' | 'UNKNOWN';

/** Classify a fetch throw without ever treating generic errors as CORS. */
export function classifyFetchError(e: unknown): FetchFailureKind {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  if (/HTTP \d{3}/.test(msg)) return 'HTTP_ERROR';
  if (/failed to fetch|load failed|networkerror|network request failed|cors|blocked by.+policy/i.test(msg)) {
    return 'CORS_BLOCKED';
  }
  return 'UNKNOWN';
}

/** True when text looks like the BMKG RSS envelope (vs garbage/error pages). */
export function isRssDocument(xml: string): boolean {
  return xml.indexOf('<rss') >= 0 && xml.indexOf('<channel') >= 0;
}

// --- minimal XML block scanning -------------------------------------------

/** Inner texts of every <tag>…</tag> occurrence (attributes on open tag OK). */
export function extractTagBlocks(xml: string, tag: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const open = xml.indexOf(`<${tag}`, from);
    if (open < 0) break;
    const openEnd = xml.indexOf('>', open);
    if (openEnd < 0) break;
    // Skip self-closing <tag …/> (no inner text).
    if (xml[openEnd - 1] === '/') {
      from = openEnd + 1;
      continue;
    }
    const close = xml.indexOf(`</${tag}>`, openEnd);
    if (close < 0) break;
    out.push(xml.slice(openEnd + 1, close));
    from = close + tag.length + 3;
  }
  return out;
}

/** First inner text of <tag>…</tag> or ''. */
export function extractFirst(xml: string, tag: string): string {
  const blocks = extractTagBlocks(xml, tag);
  return blocks.length > 0 ? decodeEntities(blocks[0]!.trim()) : '';
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// --- RSS -------------------------------------------------------------------

/** Parse RSS listing into items. Malformed XML → [] (never throws). */
export function parseWeatherRss(xml: string): BmkgRssItem[] {
  try {
    if (!xml || xml.indexOf('<item>') < 0) return [];
    return extractTagBlocks(xml, 'item')
      .map((block) => ({
        title: extractFirst(block, 'title'),
        link: extractFirst(block, 'link'),
        description: extractFirst(block, 'description'),
        guid: extractFirst(block, 'guid'),
        pubDate: extractFirst(block, 'pubDate'),
      }))
      .filter((it) => it.link.length > 0);
  } catch {
    return [];
  }
}

// --- CAP -------------------------------------------------------------------

/**
 * Parse "lat,lon lat,lon …" CAP polygon into [lat,lng][].
 * Null when malformed, out of range, or fewer than 3 points.
 */
export function parseCapPolygon(raw: string): [number, number][] | null {
  try {
    const s = raw.trim();
    if (!s) return null;
    const pts: [number, number][] = [];
    for (const tok of s.split(/\s+/)) {
      const comma = tok.indexOf(',');
      if (comma < 0) return null;
      const lat = Number(tok.slice(0, comma));
      const lng = Number(tok.slice(comma + 1));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      pts.push([lat, lng]);
    }
    return pts.length >= 3 ? pts : null;
  } catch {
    return null;
  }
}

/**
 * Deterministic lifecycle. Malformed/undated effective/expires → EXPIRED
 * (safest: excluded from the primary map layer, never shown as ACTIVE).
 */
export function warningStatus(effectiveIso: string, expiresIso: string, nowMs: number = Date.now()): BmkgWarningStatus {
  const eff = Date.parse(effectiveIso);
  const exp = Date.parse(expiresIso);
  if (!Number.isFinite(eff) || !Number.isFinite(exp)) return 'EXPIRED';
  if (nowMs < eff) return 'UPCOMING';
  if (nowMs <= exp) return 'ACTIVE';
  return 'EXPIRED';
}

function parseIsoOr(original: string): string {
  const t = Date.parse(original);
  return Number.isFinite(t) ? new Date(t).toISOString() : original;
}

/**
 * Normalize one CAP detail doc. Returns null when required CAP fields
 * (event/headline/effective/expires/area) are missing. Areas with
 * unparseable polygons are RETAINED with polygon: [] (list-visible,
 * never drawn). Never throws for bad data.
 */
export function normalizeCapAlert(
  xml: string,
  detailUrl: string,
  fetchedAt: string,
  nowMs: number = Date.now(),
): BmkgWeatherWarning | null {
  try {
    if (!xml || xml.indexOf('<alert') < 0) return null;
    const infos = extractTagBlocks(xml, 'info');
    if (infos.length === 0) return null;
    const info = infos[0]!;
    const event = extractFirst(info, 'event');
    const headline = extractFirst(info, 'headline');
    const description = extractFirst(info, 'description');
    const effectiveRaw = extractFirst(info, 'effective');
    const expiresRaw = extractFirst(info, 'expires');
    const senderName = extractFirst(info, 'senderName');
    if (!event || !headline || !effectiveRaw || !expiresRaw) return null;

    const areas: BmkgWeatherArea[] = [];
    for (const areaBlock of extractTagBlocks(info, 'area')) {
      const name = extractFirst(areaBlock, 'areaDesc');
      const polygons = extractTagBlocks(areaBlock, 'polygon');
      if (polygons.length === 0) {
        areas.push({ ...(name ? { name } : {}), polygon: [] });
        continue;
      }
      for (const p of polygons) {
        const parsed = parseCapPolygon(p);
        areas.push({ ...(name ? { name } : {}), polygon: parsed ?? [] });
      }
    }
    if (areas.length === 0) return null;

    const effective = parseIsoOr(effectiveRaw);
    const expires = parseIsoOr(expiresRaw);
    const identifier = extractFirst(xml, 'identifier');
    const id = `bmkgwx-${fnv1aHex([identifier, detailUrl, event, effective].join('|'))}`;
    const web = extractFirst(info, 'web');
    return {
      id,
      source: 'BMKG',
      provenance: 'OFFICIAL',
      event,
      headline,
      description,
      effective,
      expires,
      senderName: senderName || 'BMKG',
      ...(web ? { web } : {}),
      areas,
      status: warningStatus(effective, expires, nowMs),
      fetchedAt,
      sourceUrl: detailUrl,
    };
  } catch {
    return null;
  }
}

/** Deduplicate by deterministic ID (first wins), newest-effective first. */
export function dedupeWeatherWarnings(warnings: BmkgWeatherWarning[]): BmkgWeatherWarning[] {
  const seen = new Map<string, BmkgWeatherWarning>();
  for (const w of warnings) {
    if (!seen.has(w.id)) seen.set(w.id, w);
  }
  return [...seen.values()].sort((a, b) => (a.effective < b.effective ? 1 : a.effective > b.effective ? -1 : 0));
}

// --- network (direct browser fetch; injectable for tests) ------------------

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

async function fetchText(url: string, fetchImpl: FetchImpl): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/xml, text/xml' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Full refresh: RSS listing → CAP details (concurrent, capped).
 * 1 + N requests per refresh stays under the 60 req/min/IP limit.
 * Never throws; failure → { ok:false, warnings:[] } (neutral UI state).
 */
export async function getBmkgWeatherWarnings(
  fetchImpl: FetchImpl = globalThis.fetch.bind(globalThis),
  nowMs: number = Date.now(),
): Promise<BmkgWeatherResult> {
  const fetchedAt = new Date().toISOString();
  let rssXml: string;
  try {
    rssXml = await fetchText(BMKG_WEATHER_FEED_ID, fetchImpl);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    const kind = classifyFetchError(e);
    return {
      warnings: [],
      ok: false,
      error: reason.slice(0, 200),
      errorType: kind === 'CORS_BLOCKED' ? 'RSS_CORS_BLOCKED' : kind === 'HTTP_ERROR' ? 'RSS_HTTP_ERROR' : 'UNKNOWN',
      fetchedAt,
      rssCount: 0,
      capOk: 0,
      capFail: 0,
    };
  }
  if (!isRssDocument(rssXml)) {
    return {
      warnings: [],
      ok: false,
      error: 'RSS payload is not a BMKG warning listing.',
      errorType: 'RSS_PARSE_ERROR',
      fetchedAt,
      rssCount: 0,
      capOk: 0,
      capFail: 0,
    };
  }
  const items = parseWeatherRss(rssXml).slice(0, MAX_CAP_DETAILS);
  if (items.length === 0) {
    return { warnings: [], ok: true, errorType: 'EMPTY', fetchedAt, rssCount: 0, capOk: 0, capFail: 0 };
  }
  const settled = await Promise.allSettled(items.map((it) => fetchText(it.link, fetchImpl)));
  const warnings: BmkgWeatherWarning[] = [];
  let capOk = 0;
  let capCors = 0;
  let capHttp = 0;
  let capParse = 0;
  settled.forEach((r, i) => {
    if (r.status !== 'fulfilled') {
      const kind = classifyFetchError(r.reason);
      if (kind === 'CORS_BLOCKED') capCors++;
      else if (kind === 'HTTP_ERROR') capHttp++;
      else capParse++;
      return;
    }
    const w = normalizeCapAlert(r.value, items[i]!.link, fetchedAt, nowMs);
    if (w) {
      capOk++;
      warnings.push(w);
    } else {
      capParse++;
    }
  });
  const merged = dedupeWeatherWarnings(warnings);
  if (merged.length > 0) {
    return { warnings: merged, ok: true, errorType: 'OK', fetchedAt, rssCount: items.length, capOk, capFail: capCors + capHttp + capParse };
  }
  // Reachable listing, zero usable details → dominant CAP failure class.
  const errorType: BmkgWeatherErrorType =
    capCors > 0 && capCors >= capHttp && capCors >= capParse
      ? 'CAP_CORS_BLOCKED'
      : capHttp > 0 && capHttp >= capParse
        ? 'CAP_HTTP_ERROR'
        : capParse > 0
          ? 'CAP_PARSE_ERROR'
          : 'UNKNOWN';
  return {
    warnings: [],
    ok: false,
    error: 'No usable CAP warning details.',
    errorType,
    fetchedAt,
    rssCount: items.length,
    capOk,
    capFail: capCors + capHttp + capParse,
  };
}

/** Area names without repeats (CAP alerts often list many polygons under the same province). */
export function uniqueAreaNames(w: Pick<BmkgWeatherWarning, 'areas'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of w.areas) {
    const name = a.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
