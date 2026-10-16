// Visible Google-ecosystem roles. Compact "System Status" pill; details in popover.
import React, { useState } from 'react';
import { aiBackendStatus } from '../lib/firebase/ai';
import { firebaseStatus } from '../lib/firebase/config';
import { resolveMapProvider } from './map/mapTypes';
import { useI18n } from '../i18n';

export const ArchitectureBadge: React.FC<{ notice?: React.ReactNode }> = ({ notice }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const fb = firebaseStatus();
  const ai = aiBackendStatus();
  const map = resolveMapProvider();
  const pill = (live: boolean, liveTxt: string, mockTxt: string) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${live ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/40' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/40'}`}>
      {live ? liveTxt : mockTxt}
    </span>
  );
  const rows: Array<[string, string, boolean, string, string]> = [
    ['Cloud Firestore', 'reports / aid / disasters', fb.configured, 'LIVE', 'MOCK fallback'],
    ['Firebase Auth', 'anonymous session', fb.configured, 'LIVE', 'MOCK user'],
    ['Firebase AI Logic + Gemini', t('ekstraksi + asisten'), ai.available, 'GEMINI', t('HEURISTIK lokal')],
    ['Google Maps Platform', t('provider peta'), map === 'google', 'GOOGLE', 'LEAFLET/OSM'],
    ['Google Weather Platform', t('cuaca MetNet AI riil-time'), map === 'google', 'GOOGLE LIVE', 'MOCK fallback'],
    ['Google Air Quality Platform', t('AQI kota besar (UAQI)'), map === 'google', 'GOOGLE LIVE', t('TANPA BADGE AQI')],
    ['Firebase Hosting', 'deploy target (standard Hosting, Spark)', true, 'LIVE', t('BELUM DEPLOY')],
  ];
  const liveCount = rows.filter(([, , live]) => live).length;
  return (
    <div className="relative" data-purpose="arch-badge">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer active:scale-95"
        title="System status — click for service details"
        aria-expanded={open}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="uppercase tracking-wider">System Status · {liveCount}/{rows.length}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-2xl min-w-[280px] animate-fadeIn">
          {rows.map(([name, role, live, a, b]) => (
            <div key={name} title={role} className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <span>{name}</span>
              {pill(live, a, b)}
            </div>
          ))}
          {notice && (
            <div className="mt-1 px-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
              {notice}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
