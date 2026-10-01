/**
 * Google Maps Platform — Weather API Service
 * Endpoint: https://weather.googleapis.com/v1/currentConditions:lookup
 * Forecast: https://weather.googleapis.com/v1/forecast/days:lookup
 * Powered by MetNet AI & Google Earth engine models.
 */

export interface WeatherForecastDay {
  date: string;
  dayName: string;
  conditionText: string;
  iconUrl: string;
  maxTemp: number;
  minTemp: number;
  rainProbability: number;
  windSpeed: number;
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  conditionText: string;
  conditionType: string;
  iconUrl: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  windGust?: number;
  rainProbability: number;
  thunderstormProbability?: number;
  uvIndex: number;
  cloudCover: number;
  airPressure?: number;
  isDaytime: boolean;
  timeZone?: string;
  forecast?: WeatherForecastDay[];
  source: 'google' | 'fallback';
}

// In-memory cache with 10-minute TTL to respect quotas and improve responsiveness
interface CacheEntry {
  data: WeatherData;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/**
 * Format Google Weather API date to Indonesian friendly day string
 */
function formatDayName(year: number, month: number, day: number, isToday: boolean): { date: string; dayName: string } {
  if (isToday) {
    return { date: `${day}/${month}`, dayName: 'Hari Ini' };
  }
  const dateObj = new Date(year, month - 1, day);
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return {
    date: `${day} ${months[month - 1]}`,
    dayName: days[dateObj.getDay()] || 'Hari',
  };
}

/**
 * Fallback weather generator when API key is missing or offline
 */
function getFallbackWeather(lat: number, lng: number, disasterCategory?: string): WeatherData {
  const isFire = disasterCategory === 'fire';
  const isFlood = disasterCategory === 'flood';
  
  return {
    temperature: isFire ? 34.5 : isFlood ? 26.2 : 29.8,
    feelsLike: isFire ? 39.0 : isFlood ? 28.0 : 33.0,
    conditionText: isFire ? 'Kering & Angin Kencang' : isFlood ? 'Hujan Deras Disertai Petir' : 'Berawan Sebagian',
    conditionType: isFire ? 'CLEAR' : isFlood ? 'HEAVY_RAIN' : 'PARTLY_CLOUDY',
    iconUrl: isFlood
      ? 'https://maps.gstatic.com/weather/v1/heavy_rain.svg'
      : isFire
      ? 'https://maps.gstatic.com/weather/v1/sunny.svg'
      : 'https://maps.gstatic.com/weather/v1/partly_cloudy.svg',
    humidity: isFire ? 38 : isFlood ? 92 : 72,
    windSpeed: isFire ? 26 : 14,
    windDirection: 'NORTH_EAST',
    windGust: isFire ? 42 : 22,
    rainProbability: isFlood ? 85 : isFire ? 10 : 35,
    thunderstormProbability: isFlood ? 65 : 5,
    uvIndex: isFire ? 9 : 4,
    cloudCover: isFlood ? 95 : isFire ? 15 : 45,
    airPressure: 1011,
    isDaytime: true,
    source: 'fallback',
    forecast: [
      {
        date: 'Hari Ini',
        dayName: 'Hari Ini',
        conditionText: isFlood ? 'Hujan Deras' : isFire ? 'Kering Terik' : 'Cerah Berawan',
        iconUrl: isFlood
          ? 'https://maps.gstatic.com/weather/v1/heavy_rain.svg'
          : 'https://maps.gstatic.com/weather/v1/sunny.svg',
        maxTemp: isFire ? 35 : 28,
        minTemp: 24,
        rainProbability: isFlood ? 85 : 10,
        windSpeed: isFire ? 28 : 12,
      },
      {
        date: 'Besok',
        dayName: 'Besok',
        conditionText: isFlood ? 'Hujan Sedang' : 'Cerah Berawan',
        iconUrl: 'https://maps.gstatic.com/weather/v1/partly_cloudy.svg',
        maxTemp: 31,
        minTemp: 23,
        rainProbability: isFlood ? 60 : 25,
        windSpeed: 10,
      },
      {
        date: 'Lusa',
        dayName: 'Lusa',
        conditionText: 'Berawan',
        iconUrl: 'https://maps.gstatic.com/weather/v1/cloudy.svg',
        maxTemp: 32,
        minTemp: 24,
        rainProbability: 30,
        windSpeed: 9,
      },
    ],
  };
}

/**
 * Fetch live weather from Google Maps Platform Weather API
 */
export async function fetchGoogleWeather(
  lat: number,
  lng: number,
  disasterCategory?: string
): Promise<WeatherData> {
  const cacheKey = getCacheKey(lat, lng);
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const apiKey = (import.meta as unknown as { env?: Record<string, string> })?.env?.['VITE_GOOGLE_MAPS_API_KEY'];

  if (!apiKey || apiKey.trim().length < 8) {
    const fallback = getFallbackWeather(lat, lng, disasterCategory);
    cache.set(cacheKey, { data: fallback, timestamp: now });
    return fallback;
  }

  try {
    // 1. Fetch Current Conditions
    const currentUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(
      apiKey
    )}&location.latitude=${lat}&location.longitude=${lng}&unitsSystem=METRIC&languageCode=id`;

    // 2. Fetch 3-Day Forecast concurrently
    const forecastUrl = `https://weather.googleapis.com/v1/forecast/days:lookup?key=${encodeURIComponent(
      apiKey
    )}&location.latitude=${lat}&location.longitude=${lng}&unitsSystem=METRIC&languageCode=id&days=3`;

    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl),
      fetch(forecastUrl).catch(() => null),
    ]);

    if (!currentRes.ok) {
      console.warn(`[GoogleWeather] currentConditions returned HTTP ${currentRes.status}`);
      const fallback = getFallbackWeather(lat, lng, disasterCategory);
      return fallback;
    }

    const currentJson = await currentRes.json();

    // Parse forecast if available
    let parsedForecast: WeatherForecastDay[] = [];
    if (forecastRes && forecastRes.ok) {
      const forecastJson = await forecastRes.json();
      if (Array.isArray(forecastJson.forecastDays)) {
        parsedForecast = forecastJson.forecastDays.slice(0, 3).map((item: any, idx: number) => {
          const displayDate = item.displayDate || {};
          const dayInfo = formatDayName(
            displayDate.year || 2026,
            displayDate.month || 10,
            displayDate.day || 1,
            idx === 0
          );
          const daytime = item.daytimeForecast || {};
          const cond = daytime.weatherCondition || {};
          const iconBase = cond.iconBaseUri || 'https://maps.gstatic.com/weather/v1/sunny';

          return {
            date: dayInfo.date,
            dayName: dayInfo.dayName,
            conditionText: cond.description?.text || 'Cerah',
            iconUrl: `${iconBase}.svg`,
            maxTemp: Math.round(item.maxTemperature?.degrees ?? 30),
            minTemp: Math.round(item.minTemperature?.degrees ?? 24),
            rainProbability: daytime.precipitation?.probability?.percent ?? 0,
            windSpeed: Math.round(daytime.wind?.speed?.value ?? 10),
          };
        });
      }
    }

    const cond = currentJson.weatherCondition || {};
    const iconBase = cond.iconBaseUri || 'https://maps.gstatic.com/weather/v1/sunny';

    const weatherData: WeatherData = {
      temperature: Math.round((currentJson.temperature?.degrees ?? 30) * 10) / 10,
      feelsLike: Math.round((currentJson.feelsLikeTemperature?.degrees ?? 32) * 10) / 10,
      conditionText: cond.description?.text || 'Kondisi Normal',
      conditionType: cond.type || 'UNKNOWN',
      iconUrl: `${iconBase}.svg`,
      humidity: currentJson.relativeHumidity ?? 60,
      windSpeed: Math.round(currentJson.wind?.speed?.value ?? 10),
      windDirection: currentJson.wind?.direction?.cardinal || 'UTARA',
      windGust: currentJson.wind?.gust?.value ? Math.round(currentJson.wind.gust.value) : undefined,
      rainProbability: currentJson.precipitation?.probability?.percent ?? 0,
      thunderstormProbability: currentJson.thunderstormProbability,
      uvIndex: currentJson.uvIndex ?? 5,
      cloudCover: currentJson.cloudCover ?? 40,
      airPressure: currentJson.airPressure?.meanSeaLevelMillibars
        ? Math.round(currentJson.airPressure.meanSeaLevelMillibars)
        : undefined,
      isDaytime: currentJson.isDaytime ?? true,
      timeZone: currentJson.timeZone?.id,
      forecast: parsedForecast.length > 0 ? parsedForecast : undefined,
      source: 'google',
    };

    cache.set(cacheKey, { data: weatherData, timestamp: now });
    return weatherData;
  } catch (error) {
    console.warn('[GoogleWeather] Error fetching live weather, using fallback:', error);
    const fallback = getFallbackWeather(lat, lng, disasterCategory);
    return fallback;
  }
}
