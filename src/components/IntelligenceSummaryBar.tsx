// Compact command-center summary answering 5 questions: where, severity, affected, needs, gaps.
import React, { useMemo } from 'react';
import type { DisasterIncident } from '../types';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import { estimateImpact } from '../services/intelligence/impactEngine';
import { summarizeGaps } from '../services/intelligence/aidGapEngine';
import { rankDisasters } from '../services/intelligence/priorityEngine';

interface Props {
  disasters: Record<string, DisasterIncident>;
  reports: IntelligenceReport[];
  aid: AidRecord[];
  /** Extra content rendered right after the last stat box (e.g. BMKG signal). */
  children?: React.ReactNode;
}

export const IntelligenceSummaryBar: React.FC<Props> = ({ disasters, reports, aid, children }) => {
  const stats = useMemo(() => {
    const list = Object.values(disasters);
    const ranking = rankDisasters(disasters, reports, aid);
    const top = ranking[0];
    let pop = 0;
    let gapItems = 0;
    list.forEach((d) => {
      const mine = reports.filter((r) => !r.disasterId || r.disasterId === d.id);
      const imp = estimateImpact(mine);
      pop = Math.max(pop, imp.affectedPopulation);
      gapItems += summarizeGaps(d.id, mine, aid.filter((a) => a.disasterId === d.id)).reduce((s, g) => s + g.gap, 0);
    });
    // Fallback to legacy impact text when no structured reports yet
    const legacyPop = list.reduce((s, d) => {
      const m = d.impact.match(/([\d.,]+)\s*(KK|jiwa|keluarga)/i);
      if (!m) return s;
      const n = parseInt(m[1].replace(/[.,]/g, ''), 10);
      return s + (Number.isFinite(n) ? (m[2].toLowerCase() === 'kk' || /keluarga/i.test(m[2]) ? n * 4 : n) : 0);
    }, 0);
    return {
      active: list.length,
      affected: pop > 0 ? pop : legacyPop,
      critical: top,
      criticalName: top ? disasters[top.disasterId]?.name ?? top.disasterId : '-',
      gapItems: Math.round(gapItems),
      unverified: reports.filter((r) => r.verificationStatus === 'UNVERIFIED' || r.verificationStatus === 'AI_REVIEWED').length,
    };
  }, [disasters, reports, aid]);

  const items = [
    { label: 'Insiden Aktif', value: String(stats.active), sub: 'terpantau peta' },
    { label: 'Terdampak (est.)', value: stats.affected > 0 ? stats.affected.toLocaleString('id-ID') + ' jiwa' : '—', sub: 'deterministik' },
    { label: 'Prioritas', value: stats.criticalName.split(',')[0], sub: `skor ${stats.critical?.score ?? 0}` },
    { label: 'Total Gap', value: stats.gapItems.toLocaleString('id-ID'), sub: 'unit kebutuhan' },
    { label: 'Perlu Verifikasi', value: String(stats.unverified), sub: 'laporan AI' },
  ];

  return (
    <div className="px-6 sm:px-8 pt-7 pb-1 flex items-stretch gap-2 overflow-x-auto" data-purpose="intel-summary">
      {items.map((it) => (
        <div key={it.label} className="min-w-[150px] flex-1 px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{it.label}</div>
          <div className="text-sm font-black text-slate-900 dark:text-white truncate">{it.value}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{it.sub}</div>
        </div>
      ))}
      {children}
      <div className="hidden xl:block text-[10px] text-slate-400 font-medium px-2 whitespace-nowrap">
        MOCK + AI-PROCESSSED — bukan feed resmi BNPB/BMKG
      </div>
    </div>
  );
};
