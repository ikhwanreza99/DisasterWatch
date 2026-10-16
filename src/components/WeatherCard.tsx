import React, { useState, useEffect } from 'react';
import {
  CloudRain,
  Wind,
  Droplets,
  Sun,
  CloudLightning,
  RefreshCw,
  Gauge,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchGoogleWeather, WeatherData } from '../services/weather/googleWeather';
import { useI18n } from '../i18n';

interface WeatherCardProps {
  lat: number;
  lng: number;
  locationName: string;
  disasterCategory?: string;
  compact?: boolean;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  lat,
  lng,
  locationName,
  disasterCategory,
  compact = false,
}) => {
  const { t } = useI18n();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForecast, setShowForecast] = useState(false);

  const loadWeather = async (forceRefresh = false) => {
    if (forceRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchGoogleWeather(lat, lng, disasterCategory);
      setWeather(data);
    } catch {
      // Handled gracefully in service
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadWeather();
  }, [lat, lng, disasterCategory]);

  if (loading && !weather) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        </div>
        <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      </div>
    );
  }

  if (!weather) return null;

  // Operational risk indicators for disaster responders
  const isHighWind = weather.windSpeed > 20;
  const isHighRainRisk = weather.rainProbability >= 50;
  const isThunderstormRisk = (weather.thunderstormProbability ?? 0) >= 40;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-md text-xs">
        <img
          src={weather.iconUrl}
          alt={weather.conditionText}
          className="w-5 h-5 object-contain"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-800 dark:text-slate-100">
            {weather.temperature}°C
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[120px]">
            {weather.conditionText}
          </span>
        </div>
        {weather.rainProbability > 30 && (
          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <CloudRain className="w-2.5 h-2.5" />
            {weather.rainProbability}%
          </span>
        )}
      </div>
    );
  }

  return (
    <article
      className="bg-gradient-to-br from-slate-50 to-sky-50/40 dark:from-slate-900/80 dark:to-slate-800/60 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs"
      data-purpose="google-weather-card"
    >
      {/* Header with Title and Live MetNet AI Badge */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
          <h4 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
            {t('Cuaca Lapangan: {name}', { name: locationName })}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <Sparkles className="w-2.5 h-2.5" />
            {weather.source === 'google' ? 'Google MetNet' : t('Simulasi')}
          </span>
          <button
            onClick={() => loadWeather(true)}
            disabled={isRefreshing}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title={t('Segarkan cuaca terkini')}
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Temp & Condition */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-center p-1.5 shadow-xs shrink-0">
            <img
              src={weather.iconUrl}
              alt={weather.conditionText}
              className="w-9 h-9 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {weather.temperature}°C
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t('Terasa {temp}°C', { temp: weather.feelsLike })}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug">
              {weather.conditionText}
            </p>
          </div>
        </div>

        {/* Operational Risk Badge */}
        {(isHighWind || isHighRainRisk || isThunderstormRisk) && (
          <div className="text-right shrink-0">
            {isThunderstormRisk ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <CloudLightning className="w-3 h-3" />
                {t('Siaga Petir')}
              </span>
            ) : isHighRainRisk ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                <CloudRain className="w-3 h-3" />
                {t('Hujan Tinggi')}
              </span>
            ) : isHighWind ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                <Wind className="w-3 h-3" />
                {t('Angin Kencang')}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Weather Grid Metrics for Field Operations */}
      <div className="grid grid-cols-4 gap-1.5 text-center mb-2.5">
        <div className="bg-white/80 dark:bg-slate-800/60 rounded-xl p-2 border border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-medium mb-0.5">
            <CloudRain className="w-3 h-3 text-sky-500" />
            <span>{t('Hujan')}</span>
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {weather.rainProbability}%
          </span>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/60 rounded-xl p-2 border border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-medium mb-0.5">
            <Wind className="w-3 h-3 text-teal-500" />
            <span>{t('Angin')}</span>
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {weather.windSpeed} <span className="text-[9px] font-normal text-slate-400">km/h</span>
          </span>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/60 rounded-xl p-2 border border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-medium mb-0.5">
            <Droplets className="w-3 h-3 text-blue-500" />
            <span>{t('Lembab')}</span>
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {weather.humidity}%
          </span>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/60 rounded-xl p-2 border border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-medium mb-0.5">
            <Sun className="w-3 h-3 text-amber-500" />
            <span>UV</span>
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {weather.uvIndex} <span className="text-[9px] font-normal text-slate-400">/ 11</span>
          </span>
        </div>
      </div>

      {/* 3-Day Forecast Toggle */}
      {weather.forecast && weather.forecast.length > 0 && (
        <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
          <button
            onClick={() => setShowForecast(!showForecast)}
            className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-1 cursor-pointer transition-colors"
          >
            <span>{t('Prakiraan 3 Hari (Google Earth AI)')}</span>
            {showForecast ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showForecast && (
            <div className="grid grid-cols-3 gap-1.5 mt-2 animate-fadeIn">
              {weather.forecast.map((day, idx) => (
                <div
                  key={idx}
                  className="bg-white/90 dark:bg-slate-800/70 rounded-xl p-2 text-center border border-slate-200/60 dark:border-slate-800 text-[10px]"
                >
                  <span className="font-bold text-slate-700 dark:text-slate-200 block truncate">
                    {day.dayName}
                  </span>
                  <img
                    src={day.iconUrl}
                    alt={day.conditionText}
                    className="w-6 h-6 object-contain mx-auto my-1"
                  />
                  <div className="font-bold text-slate-900 dark:text-white">
                    {day.maxTemp}° <span className="text-slate-400 font-normal">{day.minTemp}°</span>
                  </div>
                  <span className="text-[9px] text-sky-600 dark:text-sky-400 font-medium block mt-0.5">
                    🌧️ {day.rainProbability}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
