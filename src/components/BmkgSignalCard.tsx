// Lightweight BMKG earthquake signal card (V1).
// Additive only — dashboard layout untouched. Neutral empty/unavailable states.
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { BMKG_SOURCE_URL, type BmkgStatus, type EarthquakeEvent } from '../services/bmkg';
import { useI18n, localeFor } from '../i18n';

interface Props {
  latest: EarthquakeEvent | null;
  count: number;
  status: BmkgStatus;
  refreshing: boolean;
  onRefresh: () => void;
}

function formatTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  try {
    return new Date(t).toLocaleString(localeFor(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export const BmkgSignalCard: React.FC<Props> = ({ latest, count, status, refreshing, onRefresh }) => {
  const { t } = useI18n();
  return (
    <div
      className="px-6 sm:px-8 pb-1"
      data-purpose="bmkg-signal"
      data-bmkg-state={status.state}
      data-bmkg-count={count}
    >
      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-cyan-200/70 bg-cyan-50/60 px-3.5 py-2 dark:border-cyan-900/60 dark:bg-cyan-950/30">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm" title="BMKG Earthquake">
          🌐
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
            BMKG Earthquake Signal{count > 0 ? ` • ${count} event` : ''}
          </div>
          {status.state === 'ready' && latest ? (
            <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
              Latest: M{latest.magnitude} • {latest.region} • {latest.depthKm} km • {formatTime(latest.eventTime)}
            </div>
          ) : status.state === 'loading' || status.state === 'idle' ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('Memuat data resmi BMKG…')}</div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">BMKG data temporarily unavailable</div>
          )}
          <div className="text-[10px] text-slate-400">
            Source: BMKG •{' '}
            <a
              href={BMKG_SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-cyan-600"
            >
              data.bmkg.go.id/gempabumi
            </a>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex shrink-0 items-center gap-1 rounded-full border border-cyan-300/60 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-cyan-700 transition-all hover:bg-white active:scale-95 disabled:opacity-50 dark:bg-slate-900/60 dark:text-cyan-300"
          title={t('Refresh data BMKG (manual)')}
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? t('Memuat…') : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
};
