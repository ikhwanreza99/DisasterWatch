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
  /** MMI shakemap filename when provided (autogempa only). */
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
  mmi?: string;
  sourceUrl: string;
}

export type BmkgStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; count: number; updatedAt: string }
  | { state: 'unavailable'; reason: string };
