// Shared claims section: extracted claims grouped by verification status.
// Conflicting claims stay visible side by side — never merged, never promoted to fact.
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { ClaimRef } from '../../domain/incidentDetail';

const VERIF: Record<ClaimRef['verificationStatus'], string> = {
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  AI_REVIEWED: 'bg-amber-50 text-amber-700 border-amber-200',
  UNVERIFIED: 'bg-slate-100 text-slate-600 border-slate-200',
  CONFLICTING: 'bg-rose-50 text-rose-700 border-rose-200',
};

const GROUPS: Array<{ key: ClaimRef['verificationStatus']; title: string }> = [
  { key: 'VERIFIED', title: 'Terverifikasi' },
  { key: 'CONFLICTING', title: 'Konflik — perlu rekonsiliasi' },
  { key: 'AI_REVIEWED', title: 'Ditinjau AI — belum terverifikasi' },
  { key: 'UNVERIFIED', title: 'Belum diverifikasi' },
];

export const IncidentClaimsPanel: React.FC<{ claims: ClaimRef[] }> = ({ claims }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (claims.length === 0) {
    return (
      <section className="rounded-[20px] border border-slate-200 bg-white p-4 min-w-0" aria-label={t('Klaim')} data-testid="claims">
        <h4 className="text-sm font-bold text-slate-900">{t('Klaim & Verifikasi')}</h4>
        <p role="status" className="mt-2 text-xs text-slate-500" data-testid="claims-empty">
          {t('Belum ada klaim terstruktur untuk insiden ini.')}
        </p>
      </section>
    );
  }
  const conflicting = claims.filter((c) => c.verificationStatus === 'CONFLICTING');
  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 min-w-0" aria-label={t('Klaim')} data-testid="claims">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h4 className="text-sm font-bold text-slate-900">{t('Klaim & Verifikasi')} ({claims.length})</h4>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-blue-600 shrink-0">
          {open ? t('Ringkas') : t('Rincian klaim')}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        {t('Klaim dilaporkan apa adanya — klaim media bukan fakta resmi.')}{conflicting.length > 0 ? ` ${t('{count} klaim konflik dipertahankan berdampingan.', { count: conflicting.length })}` : ''}
      </p>
      {open && (
        <div className="mt-3 space-y-3">
          {GROUPS.map(({ key, title }) => {
            const list = claims.filter((c) => c.verificationStatus === key);
            if (list.length === 0) return null;
            return (
              <div key={key}>
                <p className="text-[11px] font-bold text-slate-700">{t(title)} ({list.length})</p>
                <div className="mt-1.5 space-y-2">
                  {list.map((c) => (
                    <div key={c.claimId} className="rounded-xl border border-slate-100 bg-slate-50 p-3" data-testid="claim-card" data-claim-status={c.verificationStatus}>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${VERIF[c.verificationStatus]}`}>{c.verificationStatus}</span>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">{c.claimText}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {c.claimType}{c.location ? ` · ${c.location}` : ''} · {c.sourceName ?? t('sumber tidak diketahui')}
                        {c.sourceUrl && (
                          <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                            {t('Buka sumber')} <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
