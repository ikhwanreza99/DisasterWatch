// Floating BMKG Official Signals control (map-first layout).
// Replaces the large in-flow BMKG cards: one compact button over the map,
// popover reveals earthquake summary + honest weather-restriction notice.
// Presentation only — data and fetching live in the bmkg hooks.
import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { BMKG_SOURCE_URL, BMKG_WEATHER_FEED_ID } from '../services/bmkg';
import { BMKG_FORECAST_INFO_URL } from '../services/bmkg/bmkgWeatherForecast';
import type { BmkgForecastState } from '../services/bmkg/bmkgWeatherForecast';

interface Props {
  quakeCount: number;
  quakeLatestText: string | null;
  quakeLive: boolean;
  quakeRefreshing: boolean;
  onRefreshQuake: () => void;
  weatherActiveCount: number;
  weatherBlocked: boolean;
  weatherReady: boolean;
  weatherRefreshing: boolean;
  onRefreshWeather: () => void;
  /** Forecast for the selected location (null adm4 → NO_LOCATION, neutral). */
  forecastState: BmkgForecastState;
  forecastSummary: string | null;
  forecastLocation: string | null;
  /** Render inside the header status row instead of floating over the map. */
  inline?: boolean;
}

export const BmkgSignalsControl: React.FC<Props> = ({
  quakeCount,
  quakeLatestText,
  quakeLive,
  quakeRefreshing,
  onRefreshQuake,
  weatherActiveCount,
  weatherBlocked,
  weatherReady,
  weatherRefreshing,
  onRefreshWeather,
  forecastState,
  forecastSummary,
  forecastLocation,
  inline = false,
}) => {
  const [open, setOpen] = useState(false);
  const forecastLive = forecastState === 'READY';
  return (
    <div className={inline ? 'relative' : 'absolute top-[3.75rem] left-1/2 -translate-x-1/2 z-30'} data-purpose="bmkg-signals">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 ${inline ? 'h-7 px-3 text-[10px]' : 'h-8 px-3.5 text-[11px]'} rounded-full bg-white/95 dark:bg-[#0b1329]/95 border border-slate-200/90 dark:border-slate-700/80 ${inline ? '' : 'shadow-md'} font-bold text-slate-800 dark:text-slate-100 cursor-pointer active:scale-95 backdrop-blur-md`}
        aria-expanded={open}
        title="BMKG Official Signals"
      >
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${quakeLive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
        <span>BMKG OFFICIAL SIGNALS</span>
        <span className="text-[9px] font-semibold text-slate-400">
          {quakeLive ? `· ${quakeCount}` : ''}{weatherBlocked ? ' · ⚠' : ''}
        </span>
      </button>

      {open && (
        <div className={`absolute ${inline ? 'right-0 sm:left-0 sm:right-auto' : 'left-1/2 -translate-x-1/2'} mt-2 w-[320px] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-3 z-50 animate-fadeIn`}>
          {/* Earthquake */}
          <div className="pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                BMKG Earthquake
              </span>
              <span
                className={`rounded-full border px-1.5 py-px text-[9px] font-bold ${
                  quakeLive
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'border-slate-300 bg-slate-100 text-slate-500'
                }`}
              >
                {quakeLive ? `LIVE · ${quakeCount}` : 'LOADING'}
              </span>
            </div>
            {quakeLatestText ? (
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{quakeLatestText}</div>
            ) : (
              <div className="text-xs text-slate-500">Memuat data resmi BMKG…</div>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <a
                href={BMKG_SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-400 underline hover:text-cyan-600"
              >
                Source: BMKG
              </a>
              <button
                onClick={onRefreshQuake}
                disabled={quakeRefreshing}
                className="flex items-center gap-1 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${quakeRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Weather forecast */}
          <div className="pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">
                BMKG Weather Forecast
              </span>
              <span
                className={`rounded-full border px-1.5 py-px text-[9px] font-bold ${
                  forecastLive
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {forecastLive ? 'LIVE' : forecastState.replace('_', ' ')}
              </span>
            </div>
            {forecastLive && forecastSummary ? (
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{forecastSummary}</div>
            ) : (
              <div className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {forecastState === 'NO_LOCATION'
                  ? 'Prakiraan BMKG belum tersedia untuk lokasi ini.'
                  : forecastState === 'LOADING'
                    ? 'Memuat prakiraan BMKG…'
                    : 'Prakiraan BMKG sementara tidak dapat dimuat.'}
              </div>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <a
                href={BMKG_FORECAST_INFO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-400 underline hover:text-sky-600"
              >
                Source: BMKG · Prakiraan Cuaca{forecastLocation ? ` · ${forecastLocation}` : ''}
              </a>
            </div>
          </div>

          {/* Weather warning */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                BMKG Weather Warning
              </span>
              <span
                className={`rounded-full border px-1.5 py-px text-[9px] font-bold ${
                  weatherReady && !weatherBlocked
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : weatherBlocked
                      ? 'border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                      : 'border-slate-300 bg-slate-100 text-slate-500'
                }`}
              >
                {weatherReady && !weatherBlocked
                  ? `LIVE · ${weatherActiveCount}`
                  : weatherBlocked
                    ? 'BROWSER ACCESS BLOCKED'
                    : 'LOADING'}
              </span>
            </div>
            {weatherBlocked ? (
              <>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Official source detected</div>
                <div className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  Data tersedia di BMKG, tetapi endpoint resmi tidak dapat diakses langsung dari browser.
                </div>
              </>
            ) : weatherReady ? (
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {weatherActiveCount > 0 ? `${weatherActiveCount} active warning(s)` : 'No active BMKG weather warnings'}
              </div>
            ) : (
              <div className="text-xs text-slate-500">Memuat peringatan dini cuaca BMKG…</div>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <a
                href={BMKG_WEATHER_FEED_ID}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-400 underline hover:text-amber-600"
              >
                Source: BMKG · bmkg.go.id/alerts/nowcast
              </a>
              <button
                onClick={onRefreshWeather}
                disabled={weatherRefreshing}
                className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${weatherRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
