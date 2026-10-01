// Pure BMKG normalization / validation / deduplication (V1).
// No network, no React, no Firestore — fully unit-testable.
import {
  BMKG_ORGANIZATION,
  BMKG_SOURCE_URL,
  type BmkgMarkerData,
  type BmkgRawGempa,
  type EarthquakeEvent,
} from './bmkgTypes';

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Parse "lat,lng" coordinate pair. Returns null when malformed/out of range. */
export function parseCoordinates(raw: unknown): { lat: number; lng: number } | null {
  const s = asString(raw);
  if (!s) return null;
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Fallback parser for Indonesian lat/lng strings, e.g. "10.04 LS" / "123.61 BT".
 * LS (Lintang Selatan) = negative, LU = positive; BB (Bujur Barat) = negative, BT = positive.
 */
export function parseLintangBujur(lintang: unknown, bujur: unknown): { lat: number; lng: number } | null {
  const latS = asString(lintang);
  const lngS = asString(bujur);
  if (!latS || !lngS) return null;
  const latM = latS.match(/^(-?\d+(?:\.\d+)?)\s*(LU|LS|U|S)?/i);
  const lngM = lngS.match(/^(-?\d+(?:\.\d+)?)\s*(BT|BB|T|B|E|W)?/i);
  if (!latM || !lngM) return null;
  let lat = Number(latM[1]);
  let lng = Number(lngM[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const latH = (latM[2] ?? '').toUpperCase();
  const lngH = (lngM[2] ?? '').toUpperCase();
  if (latH === 'LS' || latH === 'S') lat = -Math.abs(lat);
  if (latH === 'LU' || latH === 'U') lat = Math.abs(lat);
  if (lngH === 'BB' || lngH === 'B' || lngH === 'W') lng = -Math.abs(lng);
  if (lngH === 'BT' || lngH === 'T' || lngH === 'E') lng = Math.abs(lng);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Validate magnitude. BMKG range guard: (0, 10]. */
export function parseMagnitude(raw: unknown): number | null {
  const s = asString(raw);
  if (!s) return null;
  const m = Number(s.replace(',', '.'));
  if (!Number.isFinite(m) || m <= 0 || m > 10) return null;
  return Math.round(m * 10) / 10;
}

/** Parse "6 km" / "10 km" depth strings. Guard: 0..1000 km. */
export function parseDepthKm(raw: unknown): number | null {
  const s = asString(raw);
  if (!s) return null;
  const m = s.replace(',', '.').match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const d = Number(m[1]);
  if (!Number.isFinite(d) || d < 0 || d >= 1000) return null;
  return Math.round(d * 10) / 10;
}

/** Validate region string (non-empty, bounded length). */
export function parseRegion(raw: unknown): string | null {
  const s = asString(raw);
  if (!s || s.length > 500) return null;
  return s;
}

/** Validate BMKG DateTime ISO string. Returns canonical ISO or null. */
export function parseEventTime(raw: unknown): string | null {
  const s = asString(raw);
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/** FNV-1a 32-bit hash → 8 hex chars. Deterministic, dependency-free. */
export function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Deterministic event ID from stable BMKG fields.
 * Rounded to tolerate float re-serialization across fetches.
 */
export function buildEarthquakeId(eventTimeIso: string, lat: number, lng: number, magnitude: number): string {
  const key = [eventTimeIso, lat.toFixed(3), lng.toFixed(3), magnitude.toFixed(1)].join('|');
  return `bmkg-${fnv1aHex(key)}`;
}

/**
 * Normalize one raw BMKG record. Returns null for malformed records
 * (caller counts rejections; never throws for bad data).
 */
export function normalizeBmkgGempa(raw: unknown, retrievedAt: string): EarthquakeEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as BmkgRawGempa;

  const eventTime = parseEventTime(r.DateTime);
  const coords = parseCoordinates(r.Coordinates) ?? parseLintangBujur(r.Lintang, r.Bujur);
  const magnitude = parseMagnitude(r.Magnitude);
  const depthKm = parseDepthKm(r.Kedalaman);
  const region = parseRegion(r.Wilayah);
  if (!eventTime || !coords || magnitude === null || depthKm === null || !region) return null;

  const feltArea = asString(r.Dirasakan);
  const mmi = asString(r.Shakemap);
  return {
    id: buildEarthquakeId(eventTime, coords.lat, coords.lng, magnitude),
    source: 'BMKG',
    sourceUrl: BMKG_SOURCE_URL,
    sourceType: 'OFFICIAL',
    sourceOrganization: BMKG_ORGANIZATION,
    eventTime,
    latitude: coords.lat,
    longitude: coords.lng,
    magnitude,
    depthKm,
    region,
    ...(feltArea ? { feltArea } : {}),
    ...(mmi ? { mmi } : {}),
    retrievedAt,
  };
}

/** Normalize a raw payload that may be a single object (autogempa) or array. */
export function normalizeBmkgPayload(payload: unknown, retrievedAt: string): { events: EarthquakeEvent[]; rejected: number } {
  const gempa = (payload as { Infogempa?: { gempa?: unknown } } | null)?.Infogempa?.gempa;
  const list = Array.isArray(gempa) ? gempa : gempa && typeof gempa === 'object' ? [gempa] : [];
  const events: EarthquakeEvent[] = [];
  let rejected = 0;
  for (const item of list) {
    const e = normalizeBmkgGempa(item, retrievedAt);
    if (e) events.push(e);
    else rejected++;
  }
  return { events, rejected };
}

/** Deduplicate by deterministic ID (first occurrence wins), sorted newest-first. */
export function dedupeEarthquakes(events: EarthquakeEvent[]): EarthquakeEvent[] {
  const seen = new Map<string, EarthquakeEvent>();
  for (const e of events) {
    if (!seen.has(e.id)) seen.set(e.id, e);
  }
  return [...seen.values()].sort((a, b) => (a.eventTime < b.eventTime ? 1 : a.eventTime > b.eventTime ? -1 : 0));
}

/** Project an event to map-marker data (Google + Leaflet share this shape). */
export function toBmkgMarkerData(e: EarthquakeEvent): BmkgMarkerData {
  return {
    id: e.id,
    lat: e.latitude,
    lng: e.longitude,
    title: `M${e.magnitude} — ${e.region}`,
    magnitude: e.magnitude,
    depthKm: e.depthKm,
    region: e.region,
    eventTime: e.eventTime,
    ...(e.feltArea ? { feltArea: e.feltArea } : {}),
    ...(e.mmi ? { mmi: e.mmi } : {}),
    sourceUrl: e.sourceUrl,
  };
}

/**
 * Explicit-prompt formatter for Gemini workflows.
 * Only call when the user asks about a quake — never bulk-send feeds.
 */
export function formatEarthquakeForPrompt(e: EarthquakeEvent): string {
  const felt = e.feltArea ? `\nDirasakan: ${e.feltArea}` : '';
  return (
    `[Sumber resmi BMKG — ${BMKG_SOURCE_URL}]\n` +
    `Magnitudo M${e.magnitude}, kedalaman ${e.depthKm} km\n` +
    `Lokasi: ${e.region} (${e.latitude}, ${e.longitude})\n` +
    `Waktu: ${e.eventTime}${felt}`
  );
}
