// Compact BMKG weather early-warning card (V1).
// Additive only. Neutral empty/unavailable states; never mock data.
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { BMKG_WEATHER_FEED_ID, type BmkgStatus, type BmkgWeatherErrorType, type BmkgWeatherWarning } from '../services/bmkg';

interface Props {
  active: BmkgWeatherWarning[];
  upcoming: BmkgWeatherWarning[];
  status: BmkgStatus;
  /** Machine-readable fetch class; selects the accurate blocked-state copy. */
  errorType?: BmkgWeatherErrorType;
  refreshing: boolean;
  onRefresh: () => void;
}

function formatRange(effective: string, expires: string): string {
  try {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `${fmt(effective)} → ${fmt(expires)}`;
  } catch {
    return `${effective} → ${expires}`;
  }
}

export const BmkgWeatherWarningCard: React.FC<Props> = ({ active, upcoming, status, errorType = 'UNKNOWN', refreshing, onRefresh }) => {
  const top = active.slice(0, 3);
  const browserBlocked = errorType === 'RSS_CORS_BLOCKED' || errorType === 'CAP_CORS_BLOCKED';
  return (
    <div
      className="px-6 sm:px-8 pb-1"
      data-purpose="bmkg-weather"
      data-bmkg-weather-state={status.state}
      data-bmkg-weather-active={active.length}
      data-bmkg-weather-error={errorType}
    >
      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-amber-200/70 bg-amber-50/60 px-3.5 py-2 dark:border-amber-900/60 dark:bg-amber-950/30">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm" title="BMKG Weather Warning">
          ⛈
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            BMKG Weather Warning{status.state === 'ready' ? ` • ${active.length} aktif` : ''}
          </div>
          {status.state === 'ready' ? (
            active.length > 0 ? (
              <div className="min-w-0">
                {top.map((w) => (
                  <div key={w.id} className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {w.event} • {w.areas.map((a) => a.name).filter(Boolean).join(', ') || 'Indonesia'} •{' '}
                    {formatRange(w.effective, w.expires)}
                  </div>
                ))}
                {upcoming.length > 0 && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    +{upcoming.length} upcoming: {upcoming.slice(0, 2).map((w) => w.event).join('; ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">No active BMKG weather warnings</div>
            )
          ) : status.state === 'loading' || status.state === 'idle' ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">Memuat peringatan dini cuaca BMKG…</div>
          ) : browserBlocked ? (
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Official source detected</div>
              <div className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                Data peringatan dini tersedia di BMKG, tetapi endpoint resmi BMKG saat ini tidak mengizinkan akses
                langsung dari browser DisasterWatch.
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">BMKG weather data temporarily unavailable</div>
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span>
              Source: BMKG •{' '}
              <a href={BMKG_WEATHER_FEED_ID} target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-600">
                bmkg.go.id/alerts/nowcast
              </a>
            </span>
            {status.state !== 'loading' && status.state !== 'idle' && (
              <span
                className={`rounded-full border px-1.5 py-px text-[9px] font-bold ${
                  browserBlocked
                    ? 'border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                    : 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {browserBlocked ? 'BROWSER ACCESS BLOCKED' : status.state === 'ready' ? 'LIVE' : 'UNAVAILABLE'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300/60 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-amber-700 transition-all hover:bg-white active:scale-95 disabled:opacity-50 dark:bg-slate-900/60 dark:text-amber-300"
          title="Refresh peringatan cuaca BMKG (manual)"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Memuat…' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
};
