import {narrativeAidProgress, aggregateAidProgress, aidCategoryMatches} from '../services/narrativeAidProgress';
import {needItems} from '../services/insights/needItems';
import React from 'react';
import {Package} from 'lucide-react';
import { useIncidentNarratives } from '../services/useIncidentNarratives';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import { HAZARD_NEEDS,NEED_LABELS } from '../services/insights/formulas';
import { useI18n } from '../i18n';
import { aidAssumptionText } from '../i18n/incidentText';
interface Props {disasterId:string;hazard?:string;reports:IntelligenceReport[];aid:AidRecord[]}
const matches = aidCategoryMatches;
export const AidGapCard:React.FC<Props>=({disasterId,hazard='other',reports,aid})=>{
 const {t,locale,lang}=useI18n();
 const categoryLabel=(category:string)=>t(category==='drainage'?'Drainase & pengendalian banjir':NEED_LABELS[category]??category);
 const allFacts=useIncidentNarratives(disasterId);
 const estimates=narrativeAidProgress(allFacts);
 const facts=allFacts.filter(f=>['DISTRIBUTED','CAPACITY','NEEDED'].includes(f.kind));
 const evidenceCategories=Object.keys(matches).filter(c=>facts.some(f=>matches[c].test(f.item)));
 const reportNeeds=reports.filter(r=>r.disasterId===disasterId).flatMap(r=>r.extractedData?.needs.map(n=>n.category)??[]);
 const categories=[...new Set([...(hazard==='flood'?['drainage']:[]),...(HAZARD_NEEDS[hazard]??['clean_water','food','medicine','shelter']),...evidenceCategories,...reportNeeds])];
 const aggregate=aggregateAidProgress(allFacts,categories);
 return <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
 <div className="px-3.5 py-2 bg-slate-50 text-[11px] font-bold text-slate-600">{t('Kebutuhan sesuai jenis bencana')}</div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">{categories.map(category=>{
 const rows=facts.filter(f=>matches[category]?.test(f.item));
 const categoryEstimates=estimates.filter(e=>matches[category]?.test(e.fact.item));
 const indicated=rows.some(f=>f.kind==='NEEDED')||reportNeeds.includes(category);
 const demands=reports.filter(r=>r.disasterId===disasterId).flatMap(r=>(r.extractedData?.needs??[]).filter(n=>n.category===category&&typeof n.quantity==='number'&&n.quantity>0&&n.unit).map(n=>({quantity:n.quantity!,unit:n.unit!,date:r.createdAt.slice(0,10),mock:r.isMock})));
 const demand=demands.length===1?demands[0]:null;
 const deliveries=demand?aid.filter(a=>a.disasterId===disasterId&&a.needCategory===category&&a.unit===demand.unit&&a.receivedAt.slice(0,10)===demand.date&&a.isMock===demand.mock&&Number.isFinite(a.quantity)&&a.quantity>=0):[];
 const received=deliveries.length?Array.from(new Map(deliveries.map(a=>[a.id,a])).values()).reduce((sum,a)=>sum+a.quantity,0):null;
 const modeled=aggregate.groups.find(g=>g.category===category);
 const pct=demand&&received!==null?Math.min(100,100*received/demand.quantity):modeled?.pct??null;
 const remaining=demand&&received!==null?Math.max(0,demand.quantity-received):Math.max(0,(modeled?.population??0)-(modeled?.received??0));
 return <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs min-w-0" key={category}>
 <div className="flex justify-between gap-3 font-bold text-slate-800"><span className="flex items-center gap-2"><Package className="w-5 h-5 shrink-0 text-orange-500"/>{categoryLabel(category)}</span><span className="font-medium text-slate-400">{indicated?t('Indikasi kebutuhan'):t('Potensial')}</span></div>
 <p className="mt-2 text-[11px] text-slate-500">{demand?t('Butuh {qty} {unit}',{qty:demand.quantity.toLocaleString(locale),unit:demand.unit}):modeled?.population?t('Acuan: {population} jiwa',{population:modeled.population.toLocaleString(locale)}):t('Butuh: belum tersedia')} · {received===null?(rows.some(f=>f.kind==='DISTRIBUTED')?t('Terima: lihat daftar'):t('Terima: belum tersedia')):t('Terima {qty} {unit}',{qty:received.toLocaleString(locale),unit:demand!.unit})}</p>
 {<>
 <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200" role={pct!==null?'progressbar':undefined} aria-label={t('Pemenuhan {label}',{label:categoryLabel(category)})} aria-valuenow={pct??undefined} aria-valuemin={pct!==null?0:undefined} aria-valuemax={pct!==null?100:undefined}>
 {pct!==null&&<><div className="h-full bg-emerald-500" style={{width:`${pct}%`}}/><div className="h-full bg-orange-400" style={{width:`${100-pct}%`}}/></>}
 </div>
 <p className="mt-1.5 flex flex-wrap justify-between gap-1 text-[10px]">{pct===null?<span className="text-slate-400">{t('Pemenuhan & sisa: belum dapat dihitung')}</span>:<><span className="text-emerald-700">{t('{pct}% terpenuhi',{pct:pct.toFixed(1)})}</span><span className="text-orange-700">{t('{pct}% belum · kurang {qty} {unit}',{pct:(100-pct).toFixed(1),qty:remaining.toLocaleString(locale),unit:demand&&received!==null?demand.unit:t('jiwa (estimasi)')})}</span></>}</p>
 </>}
 {modeled?.pct!==null&&modeled?.population&&<p className="mt-1 text-[10px] text-slate-500">{t('Estimasi: {received} / {population} jiwa · {method}',{received:modeled.received.toLocaleString(locale),population:modeled.population.toLocaleString(locale),method:t(category==='kitchen'?'jumlah barang = jiwa':'pembagian merata')})}</p>}
 {rows.some(f=>f.kind==='DISTRIBUTED')&&<div className="mt-3"><p className="text-[11px] font-semibold text-slate-700">{t('Bantuan sudah diterima')}</p><ul className="mt-1.5 space-y-1.5 text-[11px] text-slate-600">{rows.filter(f=>f.kind==='DISTRIBUTED').map((f,i)=><li key={i} className="flex flex-wrap justify-between gap-x-2"><span><b>{f.quantity.toLocaleString(locale)} {f.unit}</b> {f.item}</span><a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{f.sourceName}</a></li>)}</ul></div>}
 {(category==='kitchen'?[]:categoryEstimates).map((e,i)=><div key={i} className="mt-3 rounded-lg border border-emerald-100 bg-white p-2">
 <p className="font-semibold">{t('Estimasi pembagian merata · {item}',{item:e.fact.item})}</p>
 <p className="mt-1 text-[11px]">{e.fact.quantity.toLocaleString(locale)} {e.fact.unit} → {e.received.toLocaleString(locale)} {e.allocationUnit} / {e.population.toLocaleString(locale)} jiwa</p>
 <div role="progressbar" aria-label={t('Estimasi {item}',{item:e.fact.item})} aria-valuenow={e.pct} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-500" style={{width:`${e.pct}%`}}/></div>
 <p className="mt-1 text-[11px]">{t('{pct}% terpenuhi · sisa {qty} {unit}',{pct:e.pct.toFixed(1),qty:Math.max(0,e.required-e.received).toLocaleString(locale),unit:e.allocationUnit})}</p>
 <p className="mt-1 text-[10px] text-slate-500">{t('Asumsi: {assumption}.',{assumption:aidAssumptionText(e.assumption,lang)})}</p>
 <a href={e.fact.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{e.fact.sourceName}</a>{e.populationSources.map((f,j)=><a key={j} href={f.sourceUrl} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 underline">{t('Sumber jumlah jiwa')}</a>)}
 </div>)}
 <details className="mt-2 text-[11px] text-slate-600"><summary className="cursor-pointer text-blue-600">{t('Jenis barang / layanan')}</summary><ul className="mt-2 list-disc pl-4 space-y-1">{needItems(hazard,category).map(item=><li key={item}>{t(item)}</li>)}</ul><p className="mt-1 text-slate-400">{t('Kandidat kebutuhan; sesuaikan asesmen lapangan.')}</p></details>
 {rows.some(f=>f.kind!=='DISTRIBUTED')&&<details className="mt-2 text-[11px] text-slate-600"><summary className="cursor-pointer text-blue-600">{t('Lihat rincian bantuan & sumber')}</summary><ul className="mt-2 space-y-2">{rows.filter(f=>f.kind!=='DISTRIBUTED').map((f,i)=><li key={i}>{f.kind==='CAPACITY'?t('Kapasitas sarana'):f.kind==='NEEDED'?t('Kebutuhan dilaporkan'):t('Bantuan historis')}: <b>{f.quantity.toLocaleString(locale)} {f.unit} {f.item}</b><br/><a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{f.sourceName}</a> · {new Date(f.publishedAt).toLocaleDateString(locale,{timeZone:'Asia/Jakarta'})}</li>)}</ul></details>}
 </div>})}</div>
 <p className="px-3.5 py-2 text-[10px] text-slate-400 bg-slate-50">{t('Estimasi per barang memakai jumlah jiwa terbesar dari berita. Asumsi kemasan dapat berbeda dari isi sebenarnya; bukan stok terkini.')} {t('Recovery: rata-rata kategori, maksimal 100% per kategori. Kategori tanpa angka dihitung 0 dalam skenario, bukan bukti belum menerima bantuan.')}</p>
 </div>;
};
