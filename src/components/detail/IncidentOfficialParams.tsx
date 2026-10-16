// Shared official-parameters section: authoritative revisions side by side, never merged.
// Renders nothing when the incident has no official parameters (same as other sections:
// no data → no fabricated block).
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import type { OfficialParam } from '../../domain/incidentDetail';

function fmt(iso: string | null, locale: string): string {
  if (!iso) return translate('Waktu tidak tersedia');
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return translate('Waktu tidak tersedia');
  return new Date(t).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

export const IncidentOfficialParams: React.FC<{ params: OfficialParam[] }> = ({ params }) => {
  const { t, locale } = useI18n();
  if (params.length === 0) return null;
  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 min-w-0" aria-label={t('Parameter resmi')} data-testid="official-params">
      <div className="border-b border-slate-100 pb-3">
        <h4 className="text-sm font-bold text-slate-900">{t('Parameter Resmi')}</h4>
        <p className="mt-1 text-[11px] text-slate-500">{t('Revisi resmi dipertahankan terpisah — tidak digabung menjadi satu angka.')}</p>
      </div>
      <div className="mt-3 space-y-2">
        {params.map((p, i) => (
          <div key={`${p.label}-${i}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3" data-testid="official-param">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-800">{p.label}</span>
              {p.revision && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{p.revision}</span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">{p.value}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              {p.sourceName ?? t('Sumber resmi')} · {fmt(p.reportedAt, locale)}
              {p.sourceUrl && (
                <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                  {t('Buka sumber')} <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
