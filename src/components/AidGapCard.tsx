import {needItems} from '../services/insights/needItems';
import React from 'react';
import {Package} from 'lucide-react';
import { useIncidentNarratives } from '../services/useIncidentNarratives';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import { HAZARD_NEEDS,NEED_LABELS } from '../services/insights/formulas';
import { useI18n } from '../i18n';
interface Props {disasterId:string;hazard?:string;reports:IntelligenceReport[];aid:AidRecord[]}
const matches:Record<string,RegExp>={clean_water:/air|mineral/i,food:/beras|nasi|mie|sarden|minyak|telur|susu|biskuit/i,medicine:/obat|medis/i,shelter:/tenda|terpal/i,clothing:/selimut|baju/i,boat:/perahu|evakuasi/i,sanitation:/popok|pembalut|hygiene/i,mask:/masker/i,kitchen:/kompor|panci|wajan|piring|gelas|sendok|teko|ember|spatula|gas/i};
export const AidGapCard:React.FC<Props>=({disasterId,hazard='other',reports,aid})=>{
 const {t,locale}=useI18n();
 const categoryLabel=(category:string)=>t(category==='drainage'?'Drainase & pengendalian banjir':NEED_LABELS[category]??category);
 const facts=useIncidentNarratives(disasterId).filter(f=>['DISTRIBUTED','CAPACITY','NEEDED'].includes(f.kind));
 const evidenceCategories=Object.keys(matches).filter(c=>facts.some(f=>matches[c].test(f.item)));
 const reportNeeds=reports.filter(r=>r.disasterId===disasterId).flatMap(r=>r.extractedData?.needs.map(n=>n.category)??[]);
 const categories=[...new Set([...(hazard==='flood'?['drainage']:[]),...(HAZARD_NEEDS[hazard]??['clean_water','food','medicine','shelter']),...evidenceCategories,...reportNeeds])];
 return <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
 <div className="px-3.5 py-2 bg-slate-50 text-[11px] font-bold text-slate-600">{t('Kebutuhan sesuai jenis bencana')}</div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">{categories.map(category=>{
 const rows=facts.filter(f=>matches[category]?.test(f.item));
 const indicated=rows.some(f=>f.kind==='NEEDED')||reportNeeds.includes(category);
 const demands=reports.filter(r=>r.disasterId===disasterId).flatMap(r=>(r.extractedData?.needs??[]).filter(n=>n.category===category&&typeof n.quantity==='number'&&n.quantity>0&&n.unit).map(n=>({quantity:n.quantity!,unit:n.unit!,date:r.createdAt.slice(0,10),mock:r.isMock})));
 const demand=demands.length===1?demands[0]:null;
 const deliveries=demand?aid.filter(a=>a.disasterId===disasterId&&a.needCategory===category&&a.unit===demand.unit&&a.receivedAt.slice(0,10)===demand.date&&a.isMock===demand.mock&&Number.isFinite(a.quantity)&&a.quantity>=0):[];
 const received=deliveries.length?Array.from(new Map(deliveries.map(a=>[a.id,a])).values()).reduce((sum,a)=>sum+a.quantity,0):null;
 const pct=demand&&received!==null?Math.min(100,100*received/demand.quantity):null;
 return <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs min-w-0" key={category}>
 <div className="flex justify-between gap-3 font-bold text-slate-800"><span className="flex items-center gap-2"><Package className="w-5 h-5 shrink-0 text-orange-500"/>{categoryLabel(category)}</span><span className="font-medium text-slate-400">{indicated?t('Indikasi kebutuhan'):t('Potensial')}</span></div>
 <p className="mt-2 text-[11px] text-slate-500">{demand?t('Butuh {qty} {unit}',{qty:demand.quantity.toLocaleString(locale),unit:demand.unit}):t('Butuh: belum tersedia')} · {received===null?t('Terima: belum tersedia'):t('Terima {qty} {unit}',{qty:received.toLocaleString(locale),unit:demand!.unit})}</p>
 <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200" role={pct!==null?'progressbar':undefined} aria-label={t('Pemenuhan {label}',{label:categoryLabel(category)})} aria-valuenow={pct??undefined} aria-valuemin={pct!==null?0:undefined} aria-valuemax={pct!==null?100:undefined}>
 {pct!==null&&<><div className="h-full bg-emerald-500" style={{width:`${pct}%`}}/><div className="h-full bg-orange-400" style={{width:`${100-pct}%`}}/></>}
 </div>
 <p className="mt-1.5 flex flex-wrap justify-between gap-1 text-[10px]">{pct===null?<span className="text-slate-400">{t('Pemenuhan & sisa: belum dapat dihitung')}</span>:<><span className="text-emerald-700">{t('{pct}% terpenuhi',{pct:pct.toFixed(1)})}</span><span className="text-orange-700">{t('{pct}% belum · kurang {qty} {unit}',{pct:(100-pct).toFixed(1),qty:Math.max(0,demand!.quantity-received!).toLocaleString(locale),unit:demand!.unit})}</span></>}</p>
 <details className="mt-2 text-[11px] text-slate-600"><summary className="cursor-pointer text-blue-600">{t('Jenis barang / layanan')}</summary><ul className="mt-2 list-disc pl-4 space-y-1">{needItems(hazard,category).map(item=><li key={item}>{t(item)}</li>)}</ul><p className="mt-1 text-slate-400">{t('Kandidat kebutuhan; sesuaikan asesmen lapangan.')}</p></details>
 {rows.length>0&&<details className="mt-2 text-[11px] text-slate-600"><summary className="cursor-pointer text-blue-600">{t('Lihat rincian bantuan & sumber')}</summary><ul className="mt-2 space-y-2">{rows.map((f,i)=><li key={i}>{f.kind==='CAPACITY'?t('Kapasitas sarana'):f.kind==='NEEDED'?t('Kebutuhan dilaporkan'):t('Bantuan historis')}: <b>{f.quantity.toLocaleString(locale)} {f.unit} {f.item}</b><br/><a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{f.sourceName}</a> · {new Date(f.publishedAt).toLocaleDateString(locale,{timeZone:'Asia/Jakarta'})}</li>)}</ul></details>}
 </div>})}</div>
 <p className="px-3.5 py-2 text-[10px] text-slate-400 bg-slate-50">{t('Potensial berasal dari template bencana, bukan kekurangan terkonfirmasi. Bantuan historis dan kapasitas sarana bukan stok siap pakai. Persentase membandingkan kebutuhan eksplisit dan penyaluran tercatat pada insiden, tanggal, dan satuan yang sama; bukan perkiraan stok esok hari.')}</p>
 </div>;
};
