/**
 * Google Maps Platform — Air Quality API
 * Endpoint: POST https://airquality.googleapis.com/v1/currentConditions:lookup
 *
 * Only current conditions are requested (one call per city, cached by the hook),
 * mirroring the CUACA layer. It reuses the public Maps browser key, so no new
 * secret is introduced.
 *
 * Unlike the weather layer there is NO fabricated fallback: air quality is a
 * health signal, so showing an invented AQI would be worse than showing none.
 * On any failure the caller gets `null` and the chip simply omits the badge.
 */

export interface AirQualityNow {
  /** Universal AQI value (uaqi) as a number. */
  aqi: number;
  /** Value exactly as the API formats it, e.g. "23". */
  aqiDisplay: string;
  /** Index code, e.g. "uaqi". */
  code: string;
  /** Localised category text, e.g. "Kualitas udara rendah". */
  category: string;
  /** Pollutant that dominates the index, e.g. "o3". Empty when not reported. */
  dominantPollutant: string;
  /** CSS colour for the value, derived from the API colour channels. */
  color: string;
}

export const AIR_QUALITY_ENDPOINT = 'https://airquality.googleapis.com/v1/currentConditions:lookup';

const FALLBACK_COLOR = '#0ea5e9';

/** Air quality indexes are UAQI by default; anything else is still usable. */
export const PREFERRED_INDEX = 'uaqi';

/**
 * The API returns colour channels as 0..1 floats. Clamp and scale so a missing
 * or out-of-range channel can never produce an invalid CSS colour.
 */
export function aqiColor(color: unknown, fallback = FALLBACK_COLOR): string {
  if (!color || typeof color !== 'object') return fallback;
  const c = color as { red?: unknown; green?: unknown; blue?: unknown };
  if (typeof c.red !== 'number' && typeof c.green !== 'number') return fallback;
  const channel = (value: unknown) => {
    const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return Math.max(0, Math.min(255, Math.round(n * 255)));
  };
  return `rgb(${channel(c.red)}, ${channel(c.green)}, ${channel(c.blue)})`;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Parse a `currentConditions:lookup` payload.
 * Returns null when there is no usable index, so callers never render a fake AQI.
 */
export function parseAirQuality(payload: unknown): AirQualityNow | null {
  if (!payload || typeof payload !== 'object') return null;
  const indexes = (payload as { indexes?: unknown }).indexes;
  if (!Array.isArray(indexes) || indexes.length === 0) return null;

  const candidates = indexes
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  if (candidates.length === 0) return null;

  const index = candidates.find((item) => item.code === PREFERRED_INDEX) ?? candidates[0]!;
  const aqi = index.aqi;
  if (typeof aqi !== 'number' || !Number.isFinite(aqi)) return null;

  return {
    aqi,
    aqiDisplay: text(index.aqiDisplay) || String(Math.round(aqi)),
    code: text(index.code) || PREFERRED_INDEX,
    category: text(index.category),
    dominantPollutant: text(index.dominantPollutant),
    color: aqiColor(index.color),
  };
}

/** Request body for current conditions at a point, localised. */
export function airQualityBody(lat: number, lng: number, languageCode: string) {
  return { location: { latitude: lat, longitude: lng }, languageCode };
}
