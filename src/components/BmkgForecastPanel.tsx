// Compact BMKG weather forecast panel for the intelligence drawer.
// Contextual: renders for the selected disaster when an adm4 code exists,
// otherwise an honest NO_LOCATION state. Forecast is never labeled warning.
import React, { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { BMKG_FORECAST_INFO_URL } from '../services/bmkg/bmkgWeatherForecast';
import { useBmkgWeatherForecast } from '../services/bmkg/useBmkgWeatherForecast';
import type { BmkgForecast } from '../services/bmkg/bmkgWeatherForecast';
import { useI18n, localeFor } from '../i18n';

interface Props {
  adm4: string | null;
  locationLabel: string;
}

function hourLabel(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '--:--';
  return new Date(t).toLocaleString(localeFor(), { hour: '2-digit', minute: '2-digit', hour12: false });
}

function pickCurrent(f: BmkgForecast, nowMs: number): { day: number; slot: number } {
  const all = f.days.flatMap((d, day) => d.slots.map((s, slot) => ({ day, slot, t: Date.parse(s.datetime) })));
  const upcoming = all.find((s) => Number.isFinite(s.t) && s.t >= nowMs - 3 * 3600 * 1000);
  return upcoming ? { day: upcoming.day, slot: upcoming.slot } : { day: 0, slot: 0 };
}

export const BmkgForecastPanel: React.FC<Props> = ({ adm4, locationLabel }) => {
  const { t } = useI18n();
  const { state, forecast, error, refresh, refreshing } = useBmkgWeatherForecast(adm4);
  const current = useMemo(
    () => (forecast ? pickCurrent(forecast, Date.now()) : null),
    [forecast],
  );
  const cur = forecast && current ? forecast.days[current.day]?.slots[current.slot] : undefined;
  const hours = forecast && current ? forecast.days[current.day]?.slots.slice(current.slot, current.slot + 8) ?? [] : [];

  return (
    <article
      className="bg-white dark:bg-slate-900/70 rounded-2xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-2.5"
      data-purpose="bmkg-forecast"
      data-forecast-state={state}
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">
          BMKG Weather Forecast
        </h4>
        <button
          onClick={refresh}
          disabled={refreshing || !adm4}
          className="flex items-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-300 cursor-pointer disabled:opacity-40"
          title={t('Refresh prakiraan (manual)')}
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {state === 'LOADING' && <p className="text-[11px] text-slate-500">{t('Memuat prakiraan BMKG…')}</p>}

      {state === 'NO_LOCATION' && (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {t('Prakiraan BMKG belum tersedia untuk lokasi ini.')}{' '}<span className="text-slate-400">(Forecast location code not available)</span>
        </p>
      )}

      {(state === 'INVALID_LOCATION' || state === 'NETWORK_ERROR' || state === 'HTTP_ERROR' || state === 'PARSE_ERROR') && (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {state === 'INVALID_LOCATION'
            ? t('Kode wilayah tidak ditemukan di BMKG.')
            : t('Prakiraan BMKG sementara tidak dapat dimuat.')}{' '}
          {error ? <span className="text-slate-400">{t(error)}</span> : null}
        </p>
      )}

      {state === 'READY' && forecast && cur && (
        <div className="space-y-2">
          <div className="text-[11px] text-slate-500 font-semibold">{locationLabel}</div>
          <div className="flex items-center gap-3">
            {cur.iconUrl ? (
              <img src={cur.iconUrl} alt={cur.weatherDesc} className="h-11 w-11 object-contain" loading="lazy" />
            ) : (
              <span className="text-2xl">☁️</span>
            )}
            <div>
              <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{cur.temperatureC}°C</div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{cur.weatherDesc}</div>
              <div className="text-[10px] text-slate-400">RH {cur.humidityPct}% • {hourLabel(cur.datetime)}</div>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {hours.map((s) => (
              <div
                key={s.datetime}
                className="flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 px-1.5 py-1.5"
              >
                <span className="text-[9px] font-bold text-slate-400 tabular-nums">{hourLabel(s.datetime)}</span>
                {s.iconUrl ? (
                  <img src={s.iconUrl} alt={s.weatherDesc} className="h-6 w-6 object-contain" loading="lazy" />
                ) : (
                  <span className="text-sm">☁️</span>
                )}
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 tabular-nums">{s.temperatureC}°</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>
              Source: BMKG ·{' '}
              <a href={BMKG_FORECAST_INFO_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-sky-600">
                {t('Prakiraan Cuaca')}
              </a>
            </span>
            {forecast.days[0]?.slots[0]?.analysisDate ? <span>Updated: {forecast.days[0].slots[0].analysisDate}</span> : null}
          </div>
        </div>
      )}
    </article>
  );
};
