// Current weather for major Indonesian cities (map "CUACA" layer).
// Source: Google Weather API currentConditions only (no forecast) → 1 request per city.
// Limited concurrency + retry on 429 so a burst never silently turns into "0 kota".
// Only fetched while the layer is ON; results cached 10 minutes.
import { useEffect, useState } from 'react';

export interface CityPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export const MAJOR_CITIES: CityPoint[] = [
  { id: 'banda-aceh', name: 'Banda Aceh', lat: 5.5483, lng: 95.3238 },
  { id: 'medan', name: 'Medan', lat: 3.5952, lng: 98.6722 },
  { id: 'padang', name: 'Padang', lat: -0.9471, lng: 100.4172 },
  { id: 'pekanbaru', name: 'Pekanbaru', lat: 0.5071, lng: 101.4478 },
  { id: 'palembang', name: 'Palembang', lat: -2.9761, lng: 104.7754 },
  { id: 'bandar-lampung', name: 'Bandar Lampung', lat: -5.3971, lng: 105.2668 },
  { id: 'jakarta', name: 'Jakarta', lat: -6.2088, lng: 106.8456 },
  { id: 'bandung', name: 'Bandung', lat: -6.9175, lng: 107.6191 },
  { id: 'semarang', name: 'Semarang', lat: -6.9667, lng: 110.4167 },
  { id: 'yogyakarta', name: 'Yogyakarta', lat: -7.7956, lng: 110.3695 },
  { id: 'surabaya', name: 'Surabaya', lat: -7.2575, lng: 112.7521 },
  { id: 'denpasar', name: 'Denpasar', lat: -8.6705, lng: 115.2126 },
  { id: 'mataram', name: 'Mataram', lat: -8.5833, lng: 116.1167 },
  { id: 'kupang', name: 'Kupang', lat: -10.1772, lng: 123.607 },
  { id: 'pontianak', name: 'Pontianak', lat: -0.0263, lng: 109.3425 },
  { id: 'banjarmasin', name: 'Banjarmasin', lat: -3.3194, lng: 114.5908 },
  { id: 'balikpapan', name: 'Balikpapan', lat: -1.2379, lng: 116.8529 },
  { id: 'makassar', name: 'Makassar', lat: -5.1477, lng: 119.4327 },
  { id: 'manado', name: 'Manado', lat: 1.4748, lng: 124.8421 },
  { id: 'ambon', name: 'Ambon', lat: -3.6954, lng: 128.1814 },
  { id: 'jayapura', name: 'Jayapura', lat: -2.5337, lng: 140.7181 },
];

export interface CityWeatherNow {
  temperature: number;
  feelsLike: number;
  conditionText: string;
  iconUrl: string;
  humidity: number;
  windSpeed: number;
  rainProbability: number;
}

export interface CityWeather extends CityPoint {
  weather: CityWeatherNow;
}

const CONCURRENCY = 4;
const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; data: CityWeatherNow }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCityNow(c: CityPoint, apiKey: string, signal: AbortSignal): Promise<CityWeatherNow> {
  const hit = cache.get(c.id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const url =
    `https://weather.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(apiKey)}` +
    `&location.latitude=${c.lat}&location.longitude=${c.lng}&unitsSystem=METRIC&languageCode=id`;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { signal });
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
    const j = await res.json();
    const cond = j.weatherCondition ?? {};
    const data: CityWeatherNow = {
      temperature: j.temperature?.degrees ?? NaN,
      feelsLike: j.feelsLikeTemperature?.degrees ?? NaN,
      conditionText: cond.description?.text ?? '—',
      iconUrl: `${cond.iconBaseUri || 'https://maps.gstatic.com/weather/v1/cloudy'}.svg`,
      humidity: j.relativeHumidity ?? 0,
      windSpeed: j.wind?.speed?.value ?? 0,
      rainProbability: j.precipitation?.probability?.percent ?? 0,
    };
    if (!Number.isFinite(data.temperature)) throw new Error('No temperature in response');
    cache.set(c.id, { at: Date.now(), data });
    return data;
  }
}

export function useCityWeather(enabled: boolean) {
  const [cities, setCities] = useState<CityWeather[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      setError('VITE_GOOGLE_MAPS_API_KEY belum diisi');
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      const out: CityWeather[] = [];
      const errors: string[] = [];
      let next = 0;
      const worker = async () => {
        while (next < MAJOR_CITIES.length && !ctrl.signal.aborted) {
          const c = MAJOR_CITIES[next++]!;
          try {
            out.push({ ...c, weather: await fetchCityNow(c, apiKey, ctrl.signal) });
          } catch (e) {
            if (ctrl.signal.aborted) return;
            errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      if (ctrl.signal.aborted) return;
      // Keep the declared city order for stable rendering.
      out.sort((a, b) => MAJOR_CITIES.findIndex((x) => x.id === a.id) - MAJOR_CITIES.findIndex((x) => x.id === b.id));
      setCities(out);
      if (errors.length > 0) {
        console.warn('[CityWeather] Google Weather failed for', errors.length, 'cities:', errors);
        setError(`${errors.length} kota gagal — ${errors[0]}`);
      }
      setLoading(false);
    })();

    return () => ctrl.abort();
  }, [enabled]);

  return { cities, loading, error };
}
