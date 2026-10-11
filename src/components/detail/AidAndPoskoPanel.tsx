// Aid + posko panel: reported distribution EVENTS (not inventory) + posko list.
// Empty state is honest; every card links its supporting source.
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { AidEventRecord, PoskoRecord } from '../../domain/incidentDetail';

const STATUS_LABEL: Record<AidEventRecord['distributionStatus'], string> = {
  REPORTED_DISTRIBUTED: 'Dilaporkan disalurkan',
  REPORTED_RECEIVED: 'Dilaporkan diterima',
  REPORTED_DISPATCHED: 'Dilaporkan dikirim',
  REPORTED_NEEDED: 'Dilaporkan dibutuhkan',
  UNKNOWN: 'Status tidak diketahui',
};

type Filter = 'ALL' | 'AID' | 'POSKO' | 'LOGISTICS' | 'OFFICIAL';

interface Props {
  aid: AidEventRecord[];
  posko: PoskoRecord[];
}

export const AidAndPoskoPanel: React.FC<Props> = ({ aid, posko }) => {
  const [filter, setFilter] = useState<Filter>('ALL');
  const aidShown = aid.filter((a) => {
    if (filter === 'POSKO') return false;
    if (filter === 'OFFICIAL') return a.verificationStatus === 'VERIFIED' || a.sourceName === 'BNPB' || a.sourceName === 'BPBD';
    if (filter === 'LOGISTICS') return /logistik|material|peralatan|perahu/i.test(a.aidType);
    return true;
  });
  const poskoShown = filter === 'AID' || filter === 'LOGISTICS' ? [] : posko;
  const empty = aidShown.length === 0 && poskoShown.length === 0;

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 min-w-0" aria-label="Bantuan dan posko" data-testid="aid-posko">
      <h4 className="text-sm font-bold text-slate-900">Bantuan & Posko</h4>
      <p className="mt-1 text-[11px] text-slate-500">
        Peristiwa distribusi yang dilaporkan — bukan inventaris saat ini. Riwayat tidak dikurangkan otomatis dari kebutuhan.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        {(['ALL', 'AID', 'POSKO', 'LOGISTICS', 'OFFICIAL'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            aria-pressed={filter === v}
            className={`rounded-full border px-2.5 py-1 font-semibold ${filter === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
          >
            {v === 'ALL' ? 'Semua' : v === 'AID' ? 'Distribusi' : v === 'POSKO' ? 'Posko / evakuasi' : v === 'LOGISTICS' ? 'Logistik' : 'Resmi'}
          </button>
        ))}
      </div>
      {empty && (
        <p role="status" className="mt-3 text-xs text-slate-500" data-testid="aid-empty">
          Belum ada data bantuan atau posko yang dapat ditampilkan dari sumber yang tersedia.
        </p>
      )}
      <div className="mt-3 space-y-2">
        {aidShown.map((a) => (
          <article key={a.aidId} className="rounded-xl border border-slate-100 bg-slate-50 p-3" data-testid="aid-card">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-800">{a.aidType.replace(/_/g, ' ')}</span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">{STATUS_LABEL[a.distributionStatus]}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {a.quantity != null ? `${a.quantity.toLocaleString('id-ID')}${a.unit ? ` ${a.unit}` : ''}` : 'Jumlah tidak dilaporkan'}
              {a.distributingOrganization ? ` · ${a.distributingOrganization}` : ''}
              {a.recipientOrDestination ? ` · ${a.recipientOrDestination}` : ''}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {a.verificationStatus} · {a.sourceName ?? 'sumber tidak diketahui'}
              {a.sourceUrl && a.sourceUrl.startsWith('http') && (
                <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                  Buka sumber <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </p>
          </article>
        ))}
        {poskoShown.map((p) => (
          <article key={p.poskoId} className="rounded-xl border border-slate-100 bg-slate-50 p-3" data-testid="posko-card">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-800">{p.name}</span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">{p.poskoType}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {[p.village && `Desa ${p.village}`, p.regency, p.province].filter(Boolean).join(', ') || 'Lokasi detail belum tersedia'}
              {p.latitude == null && ' · tanpa koordinat terverifikasi (tidak ditandai di peta)'}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {p.verificationStatus} · {p.sourceName ?? 'sumber tidak diketahui'}
              {p.sourceUrl && p.sourceUrl.startsWith('http') && (
                <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                  Buka sumber <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};
