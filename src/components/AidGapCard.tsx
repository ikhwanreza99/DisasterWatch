import { useIncidentNarratives } from '../services/useIncidentNarratives';
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
  const narrative=useIncidentNarratives(disasterId);
  const matches:Record<string,RegExp>={clean_water:/air|mineral/i,food:/beras|nasi|mie|sarden|minyak|telur|susu|biskuit/i,medicine:/obat|medis|masker/i,shelter:/selimut|baju|tenda|terpal/i,boat:/perahu|evakuasi/i,sanitation:/popok|pembalut/i,kitchen:/kompor|panci|wajan|piring|gelas|sendok|teko|ember|spatula|gas/i};
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
        {gaps.length === 0 && ['clean_water', 'food', 'medicine', 'shelter', 'boat',...(['sanitation','kitchen'].filter(c=>narrative.some(f=>f.kind==='DISTRIBUTED'&&matches[c].test(f.item))))].map(category => (
          <div key={category} className="px-3.5 py-2.5 text-[11px]">
            <div className="flex flex-wrap justify-between gap-2 font-bold text-slate-800"><span>{category==='sanitation'?'Sanitasi & kebutuhan ibu/anak':category==='kitchen'?'Dapur umum & logistik':needLabel(category)}</span><span className="text-slate-400">{narrative.some(f=>matches[category].test(f.item))?'Gap belum dapat dihitung':'Belum tersedia'}</span></div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-slate-500"><span>Butuh: belum tersedia</span><span>Terima: {narrative.some(f=>f.kind==='DISTRIBUTED'&&matches[category].test(f.item))?'tercatat per sumber di bawah':'belum tersedia'}</span></div>
            {narrative.filter(f=>(f.kind==='DISTRIBUTED'||f.kind==='CAPACITY'||f.kind==='NEEDED')&&matches[category].test(f.item)).map((fact,index)=><div key={index} className="mt-2 rounded-lg border border-slate-100 bg-white p-2 text-slate-600"><span className="font-semibold">{fact.kind==='CAPACITY'?'Kapasitas sarana':fact.kind==='NEEDED'?'Kebutuhan dilaporkan':'Bantuan dilaporkan'}: {fact.quantity.toLocaleString('id-ID')} {fact.unit} {fact.item}</span><div className="mt-1 text-[10px]">{fact.organization?`${fact.organization} · `:''}Terbit {new Date(fact.publishedAt).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta'})} · <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{fact.sourceName}</a></div></div>)}
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
        Kekurangan hanya dihitung bila kebutuhan dan penerimaan diketahui untuk item, satuan, wilayah, dan periode yang sama. Kapasitas tangki bukan jumlah air tersalurkan. Laporan antarberita tidak otomatis dijumlahkan.
      </div>
    </div>
  );
};
