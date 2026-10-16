// Compact provenance pill: OFFICIAL / REPORTED / ESTIMATED / DEMO / UNAVAILABLE.
import React from 'react';
import { useI18n } from '../../i18n';
import type { MetricProvenance } from '../../domain/incidentDetail';

const STYLE: Record<MetricProvenance, { label: string; cls: string }> = {
  OFFICIAL: { label: 'Resmi', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REPORTED: { label: 'Dilaporkan', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ESTIMATED: { label: 'Estimasi', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  DEMO: { label: 'Demo', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  UNAVAILABLE: { label: 'Belum tersedia', cls: 'bg-slate-50 text-slate-400 border-slate-200' },
};

export const IncidentSourceBadge: React.FC<{ provenance: MetricProvenance; title?: string }> = ({ provenance, title }) => {
  const { t } = useI18n();
  const s = STYLE[provenance];
  return (
    <span title={title ?? `Provenance: ${provenance}`} className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${s.cls}`}>
      {t(s.label)}
    </span>
  );
};
