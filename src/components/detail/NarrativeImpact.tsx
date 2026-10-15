import React from 'react';
import {useIncidentNarratives} from '../../services/useIncidentNarratives';
export function NarrativeImpact({incidentId}:{incidentId:string}){
 const facts=useIncidentNarratives(incidentId).filter(f=>f.kind==='LOSS'||f.kind==='AID_VALUE'||f.kind==='BENEFICIARIES');
 if(!facts.length)return null;
 return <div className="mt-3 space-y-2 rounded-xl border border-cyan-100 bg-cyan-50/70 p-3 text-xs text-slate-700">
  <strong>Angka dari narasi berita</strong>
  {facts.map((f,i)=><p key={i}>{f.kind==='LOSS'?'Kerugian dilaporkan':f.kind==='BENEFICIARIES'?'Perkiraan penerima manfaat bantuan':'Perkiraan nilai bantuan dilaporkan'}{f.organization?` · ${f.organization}`:''}: <b>{f.unit==='Rp'?'Rp ':''}{f.quantity.toLocaleString('id-ID')}{f.unit==='Rp'?'':` ${f.unit}`}</b> <a className="text-blue-600 underline" href={f.sourceUrl} target="_blank" rel="noreferrer">{f.sourceName}</a></p>)}
  <p className="text-[10px] text-slate-500">Nilai bantuan bukan estimasi kerugian bencana. Angka mengikuti laporan sumber, bukan nilai inventaris terkini.</p>
 </div>;
}
