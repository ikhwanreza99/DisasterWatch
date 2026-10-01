// Current weather for major Indonesian cities (map "CUACA" layer).
// Uses fetchGoogleWeather (10-min cache). Only fetched while the layer is ON.
import { useEffect, useState } from 'react';
import { fetchGoogleWeather, type WeatherData } from './googleWeather';

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

export interface CityWeather extends CityPoint {
  weather: WeatherData;
}

export function useCityWeather(enabled: boolean) {
  const [cities, setCities] = useState<CityWeather[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled(MAJOR_CITIES.map((c) => fetchGoogleWeather(c.lat, c.lng)))
      .then((res) => {
        if (cancelled) return;
        setCities(
          // Only real Google Weather results; drop the synthetic fallback so "Source: Google Weather" stays true.
          res.flatMap((r, i) =>
            r.status === 'fulfilled' && r.value.source === 'google' ? [{ ...MAJOR_CITIES[i]!, weather: r.value }] : [],
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { cities, loading };
}
