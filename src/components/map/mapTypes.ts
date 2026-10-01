// Map provider abstraction — Leaflet stays default, Google Maps opt-in.
// Goal: decouple App from Leaflet so migration is safe and demo never breaks.

export type MapProviderKind = 'leaflet' | 'google';

export function resolveMapProvider(): MapProviderKind {
  try {
    const key = (import.meta as unknown as { env?: Record<string, string> })?.env?.['VITE_GOOGLE_MAPS_API_KEY'];
    if (typeof key === 'string' && key.trim().length > 8) return 'google';
  } catch {
    // ignore
  }
  return 'leaflet';
}

export function mapProviderLabel(kind: MapProviderKind): string {
  return kind === 'google' ? 'Google Maps (live)' : 'Leaflet + OSM (fallback)';
}
