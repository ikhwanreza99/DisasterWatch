// Reusable deterministic aid-gap table. Used inside ExpandedDetailContent (sidebar detail).
import React, { useMemo } from 'react';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import { needLabel } from '../domain/intelligence';
import { summarizeGaps } from '../services/intelligence/aidGapEngine';

interface Props {
  disasterId: string;
  reports: IntelligenceReport[];
  aid: AidRecord[];
}

export const AidGapCard: React.FC<Props> = ({ disasterId, reports, aid }) => {
  const gaps = useMemo(() => {
    const mine = reports.filter((r) => !r.disasterId || r.disasterId === disasterId);
    return summarizeGaps(disasterId, mine, aid.filter((a) => a.disasterId === disasterId));
  }, [disasterId, reports, aid]);


  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
      <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Aid Gap (Deterministik)</span>
        <span className="text-[10px] text-slate-400">butuh − terima = kurang</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {gaps.length === 0 && ['clean_water', 'food', 'medicine', 'shelter', 'boat'].map(category => (
          <div key={category} className="px-3.5 py-2.5 text-[11px]">
            <div className="flex flex-wrap justify-between gap-2 font-bold text-slate-800"><span>{needLabel(category)}</span><span className="text-slate-400">Belum tersedia</span></div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-slate-500"><span>Butuh: belum tersedia</span><span>Terima: belum tersedia</span></div>
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-100" />
          </div>
        ))}
        {gaps.map((g) => (
          <div key={g.category} className="px-3.5 py-2.5 text-[11px]">
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
              <span>{needLabel(g.category)}</span>
              <span className={g.gap > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {g.gap > 0 ? `Kurang ${g.gap.toLocaleString('id-ID')}${g.unit ? ' ' + g.unit : ''} (${g.gapPct}%)` : 'Terpenuhi'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mt-0.5">
              <span>Butuh {g.estimated.toLocaleString('id-ID')}{g.unit ? ' ' + g.unit : ''}</span>
              <span>•</span>
              <span>Terima {g.received.toLocaleString('id-ID')}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500" style={{ width: `${Math.min(100, g.gapPct)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="px-3.5 py-1.5 text-[10px] text-slate-400 bg-slate-50/60 dark:bg-slate-900/40">
        Dihitung oleh kode aplikasi — bukan oleh LLM.
      </div>
    </div>
  );
};
