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
}

export const IntelligenceSummaryBar: React.FC<Props> = ({ disasters, reports, aid }) => {
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
    { label: 'Insiden Aktif', value: String(stats.active), accent: false },
    { label: 'Terdampak', value: stats.affected > 0 ? stats.affected.toLocaleString('id-ID') : '—', accent: false },
    { label: 'Prioritas', value: `${stats.criticalName.split(',')[0]} · ${stats.critical?.score ?? 0}`, accent: true },
    { label: 'Gap', value: stats.gapItems.toLocaleString('id-ID'), accent: false },
    { label: 'Perlu Verifikasi', value: String(stats.unverified), accent: false },
  ];

  return (
    <div className="px-4 sm:px-6 pt-1.5 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap" data-purpose="intel-summary">
      {items.map((it) => (
        <div
          key={it.label}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shrink-0"
        >
          <span className={`text-sm font-black tabular-nums ${it.accent ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-white'}`}>
            {it.value}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{it.label}</span>
        </div>
      ))}
      <span
        title="MOCK + AI-PROCESSED — bukan feed resmi BNPB/BMKG"
        className="inline-flex items-center gap-1 h-9 px-2.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-[9px] font-bold uppercase tracking-wider text-slate-400 shrink-0"
      >
        Demo data · AI-processed · Not official BNPB/BMKG
      </span>
    </div>
  );
};
