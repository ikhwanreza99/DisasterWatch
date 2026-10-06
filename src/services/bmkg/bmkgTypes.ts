// BMKG earthquake public-feed types (V1).
// Official source: https://data.bmkg.go.id/gempabumi/
// Free-tier: direct browser fetch, no backend, no persistence.

export const BMKG_SOURCE_URL = 'https://data.bmkg.go.id/gempabumi/';
export const BMKG_ORGANIZATION = 'BMKG';

export const BMKG_FEEDS = {
  latest: 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json',
  recentM5: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json',
  felt: 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json',
} as const;

export type BmkgFeedKind = keyof typeof BMKG_FEEDS;

/** Raw BMKG gempa record. All scalar fields arrive as strings. */
export interface BmkgRawGempa {
  Tanggal?: unknown;
  Jam?: unknown;
  DateTime?: unknown;
  Coordinates?: unknown;
  Lintang?: unknown;
  Bujur?: unknown;
  Magnitude?: unknown;
  Kedalaman?: unknown;
  Wilayah?: unknown;
  Potensi?: unknown;
  Dirasakan?: unknown;
  Shakemap?: unknown;
}

/**
 * Normalized internal seismic event.
 * Deliberately separate from DisasterWatch `Disaster`:
 * an EarthquakeEvent is an official seismic observation,
 * a Disaster is a humanitarian event tracked operationally.
 */
export interface EarthquakeEvent {
  id: string;
  source: 'BMKG';
  sourceUrl: string;
  /** Provenance — never "AI verified". */
  sourceType: 'OFFICIAL';
  sourceOrganization: 'BMKG';

  /** ISO-8601 event time (from BMKG DateTime). */
  eventTime: string;
  latitude: number;
  longitude: number;

  magnitude: number;
  depthKm: number;

  region: string;
  feltArea?: string;
  /** BMKG 'Potensi', e.g. tsunami potential. */
  potential?: string;
  /** BMKG Shakemap image filename when provided (autogempa only). */
  mmi?: string;

  sourceUpdatedAt?: string;
  retrievedAt: string;
}

/** Marker-ready projection for map layers (both Google + Leaflet). */
export interface BmkgMarkerData {
  id: string;
  lat: number;
  lng: number;
  title: string;
  magnitude: number;
  depthKm: number;
  region: string;
  eventTime: string;
  feltArea?: string;
  /** BMKG 'Potensi', e.g. tsunami potential. */
  potential?: string;
  mmi?: string;
  sourceUrl: string;
}

export type BmkgStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; count: number; updatedAt: string }
  | { state: 'unavailable'; reason: string };

// ---------------------------------------------------------------------------
// BMKG Weather Warning / Nowcast (V1).
// Official info page: https://data.bmkg.go.id/peringatan-dini-cuaca/
// Documented feeds (RSS active provincial warnings + CAP detail docs).
// Standard: Common Alerting Protocol (CAP) 1.2, XML.
// Rate limit: 60 requests/minute/IP. BMKG attribution mandatory.
// CORS note (verified 2026-10-01): RSS listing carries NO ACAO header
// (browser fetch blocked); CAP detail docs inconsistently carry ACAO:*
// (absent when an Origin header is sent). The adapter therefore treats
// feed failure as "unavailable" and never fabricates data.

export const BMKG_WEATHER_FEED_ID = 'https://www.bmkg.go.id/alerts/nowcast/id';
export const BMKG_WEATHER_FEED_EN = 'https://www.bmkg.go.id/alerts/nowcast/en';
export const BMKG_WEATHER_INFO_URL = 'https://data.bmkg.go.id/peringatan-dini-cuaca/';

/** Deterministic lifecycle from CAP effective/expires vs NOW. */
export type BmkgWarningStatus = 'UPCOMING' | 'ACTIVE' | 'EXPIRED';

export interface BmkgWeatherArea {
  name?: string;
  /** lat,lng pairs in CAP order. Empty when polygon parsing failed. */
  polygon: [number, number][];
}

/**
 * Normalized weather early-warning record.
 * Never converted into a flood prediction; never auto-sent to Gemini.
 */
export interface BmkgWeatherWarning {
  id: string;
  source: 'BMKG';
  provenance: 'OFFICIAL';
  event: string;
  headline: string;
  description: string;
  /** ISO-8601 from CAP effective/expires. */
  effective: string;
  expires: string;
  senderName: string;
  web?: string;
  areas: BmkgWeatherArea[];
  status: BmkgWarningStatus;
  fetchedAt: string;
  /** Official BMKG CAP detail document URL. */
  sourceUrl: string;
}
