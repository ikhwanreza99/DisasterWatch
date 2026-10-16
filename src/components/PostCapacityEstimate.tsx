import React from 'react';
import { useI18n } from '../i18n';
import type { postAllocation } from '../services/places/postAllocation';
export function PostCapacityEstimate({estimate}:{estimate:ReturnType<typeof postAllocation>}) {
 const {t,locale}=useI18n();
 if(!estimate)return null;
 return <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-2.5 text-[11px] text-cyan-900" data-testid="post-capacity-estimate">
  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide">{t('Kapasitas (estimasi pembagian)')}</p>
  <p className="font-semibold">{t('{qty} jiwa/posko (estimasi)',{qty:estimate.perPost.toLocaleString(locale,{maximumFractionDigits:0})})}</p>
  <p className="mt-1 text-[10px]">{t('Asumsi: {population} jiwa ÷ {count} posko.',{population:estimate.population.toLocaleString(locale),count:estimate.postCount})}</p>
  <p className="text-[10px]">{t('Target pembagian; kapasitas lokasi belum diverifikasi.')}</p>
  {[...new Map(estimate.sources.map(f=>[f.sourceUrl,f])).values()].map(f=><a key={f.sourceUrl} href={f.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline text-blue-600">{t('Sumber jumlah jiwa')} · {f.sourceName}</a>)}
 </div>;
}
