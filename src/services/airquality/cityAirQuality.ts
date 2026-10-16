// Current air quality (UAQI) for major Indonesian cities — merged into the CUACA chip.
// One request per city, limited concurrency + retry on 429 so a burst never
// silently turns into "0 kota". Only fetched while the layer is ON.
// TTL is 30 minutes on purpose: air quality changes far more slowly than weather,
// which keeps Air Quality API usage about a third of the weather layer's.
import { useEffect, useState } from 'react';
import { getLang } from '../../i18n';
import { MAJOR_CITIES, type CityPoint } from '../weather/cityWeather';
import { parseAirQuality, type AirQualityNow } from './googleAirQuality';

export interface CityAirQuality extends CityPoint {
  air: AirQualityNow;
}

const CONCURRENCY = 4;
const CACHE_TTL_MS = 30 * 60_000;
const cache = new Map<string, { at: number; data: AirQualityNow }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCityAir(
  c: CityPoint,
  apiKey: string,
  languageCode: string,
  signal: AbortSignal,
): Promise<AirQualityNow> {
  const hit = cache.get(c.id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: { latitude: c.lat, longitude: c.lng }, languageCode }),
      signal,
    });
    if (res.status === 429 && attempt < 2) {
      await sleep(1000 * (attempt + 1)); // back off on rate limit
      continue;
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error?.message) msg += `: ${String(j.error.message).slice(0, 120)}`;
      } catch {
        /* non-JSON body */
      }
      throw new Error(msg);
    }
    const parsed = parseAirQuality(await res.json());
    if (!parsed) throw new Error('No AQI in response');
    cache.set(c.id, { at: Date.now(), data: parsed });
    return parsed;
  }
}

export function useCityAirQuality(enabled: boolean) {
  const [cities, setCities] = useState<CityAirQuality[]>([]);
  const [error, setError] = useState<string | null>(null);
  const languageCode = getLang() === 'en' ? 'en' : 'id';

  useEffect(() => {
    if (!enabled) return;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) return; // The chip just omits the AQI badge.
    const ctrl = new AbortController();
    setError(null);

    (async () => {
      const out: CityAirQuality[] = [];
      const errors: string[] = [];
      let next = 0;
      const worker = async () => {
        while (next < MAJOR_CITIES.length && !ctrl.signal.aborted) {
          const c = MAJOR_CITIES[next++]!;
          try {
            out.push({ ...c, air: await fetchCityAir(c, apiKey, languageCode, ctrl.signal) });
          } catch (e) {
            if (ctrl.signal.aborted) return;
            errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      if (ctrl.signal.aborted) return;
      // Keep the declared city order for stable rendering.
      out.sort(
        (a, b) =>
          MAJOR_CITIES.findIndex((x) => x.id === a.id) - MAJOR_CITIES.findIndex((x) => x.id === b.id),
      );
      setCities(out);
      if (errors.length > 0) {
        console.warn('[CityAirQuality] Google Air Quality failed for', errors.length, 'cities:', errors);
        setError(`${errors.length} kota gagal — ${errors[0]}`);
      }
    })();

    return () => ctrl.abort();
  }, [enabled, languageCode]);

  return { cities, error };
}
