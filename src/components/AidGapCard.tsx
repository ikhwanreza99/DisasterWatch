import React from 'react';
import { useIncidentNarratives } from '../services/useIncidentNarratives';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import { HAZARD_NEEDS,NEED_LABELS } from '../services/insights/formulas';
interface Props {disasterId:string;hazard?:string;reports:IntelligenceReport[];aid:AidRecord[]}
const matches:Record<string,RegExp>={clean_water:/air|mineral/i,food:/beras|nasi|mie|sarden|minyak|telur|susu|biskuit/i,medicine:/obat|medis/i,shelter:/tenda|terpal/i,clothing:/selimut|baju/i,boat:/perahu|evakuasi/i,sanitation:/popok|pembalut|hygiene/i,mask:/masker/i,kitchen:/kompor|panci|wajan|piring|gelas|sendok|teko|ember|spatula|gas/i};
export const AidGapCard:React.FC<Props>=({disasterId,hazard='other',reports})=>{
 const facts=useIncidentNarratives(disasterId).filter(f=>['DISTRIBUTED','CAPACITY','NEEDED'].includes(f.kind));
 const evidenceCategories=Object.keys(matches).filter(c=>facts.some(f=>matches[c].test(f.item)));
 const reportNeeds=reports.filter(r=>r.disasterId===disasterId).flatMap(r=>r.extractedData?.needs.map(n=>n.category)??[]);
 const categories=[...new Set([...(HAZARD_NEEDS[hazard]??['clean_water','food','medicine','shelter']),...evidenceCategories,...reportNeeds])];
 return <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
 <div className="px-3.5 py-2 bg-slate-50 text-[11px] font-bold text-slate-600">Kebutuhan sesuai jenis bencana</div>
 <div className="divide-y divide-slate-100">{categories.map(category=>{
 const rows=facts.filter(f=>matches[category]?.test(f.item));
 const indicated=rows.some(f=>f.kind==='NEEDED')||reportNeeds.includes(category);
 return <div className="px-3.5 py-3 text-xs" key={category}>
 <div className="flex justify-between gap-3 font-bold text-slate-800"><span>{NEED_LABELS[category]??category}</span><span className="font-medium text-slate-400">{indicated?'Indikasi kebutuhan':'Potensial'}</span></div>
 <p className="mt-1 text-[11px] text-slate-500">Kuantitas & gap: belum tersedia{rows.length?` · ${rows.length} catatan sumber`:''}</p>
 {rows.length>0&&<details className="mt-2 text-[11px] text-slate-600"><summary className="cursor-pointer text-blue-600">Lihat rincian bantuan & sumber</summary><ul className="mt-2 space-y-2">{rows.map((f,i)=><li key={i}>{f.kind==='CAPACITY'?'Kapasitas sarana':f.kind==='NEEDED'?'Kebutuhan dilaporkan':'Bantuan historis'}: <b>{f.quantity.toLocaleString('id-ID')} {f.unit} {f.item}</b><br/><a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{f.sourceName}</a> · {new Date(f.publishedAt).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta'})}</li>)}</ul></details>}
 </div>})}</div>
 <p className="px-3.5 py-2 text-[10px] text-slate-400 bg-slate-50">Potensial berasal dari template bencana, bukan kekurangan terkonfirmasi. Bantuan historis dan kapasitas sarana bukan stok siap pakai. Gap memerlukan kebutuhan dan stok dengan satuan, wilayah, serta periode yang sama.</p>
 </div>;
};
