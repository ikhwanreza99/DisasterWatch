// Visible Google-ecosystem roles. Each entry shows live vs mock so demo stays honest.
import React from 'react';
import { aiBackendStatus } from '../lib/firebase/ai';
import { firebaseStatus } from '../lib/firebase/config';
import { resolveMapProvider } from './map/mapTypes';

export const ArchitectureBadge: React.FC = () => {
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
    ['Firebase AI Logic + Gemini', 'ekstraksi + asisten', ai.available, 'GEMINI', 'HEURISTIK lokal'],
    ['Google Maps Platform', 'provider peta', map === 'google', 'GOOGLE', 'LEAFLET/OSM'],
    ['Google Weather Platform', 'cuaca MetNet AI riil-time', map === 'google', 'GOOGLE LIVE', 'MOCK fallback'],
    ['Firebase Hosting', 'deploy target (standard Hosting, Spark)', true, 'LIVE', 'BELUM DEPLOY'],
  ];
  return (
    <div className="px-6 sm:px-8 pb-2 flex items-center gap-1.5 flex-wrap" data-purpose="arch-badge">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">Arsitektur:</span>
      {rows.map(([name, role, live, a, b]) => (
        <span key={name} title={role} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
          {name} {pill(live, a, b)}
        </span>
      ))}
    </div>
  );
};
