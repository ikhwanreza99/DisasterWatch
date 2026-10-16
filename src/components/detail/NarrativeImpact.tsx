import React from 'react';
import { useI18n } from '../../i18n';
import {useIncidentNarratives} from '../../services/useIncidentNarratives';
import type {NarrativeFact} from '../../services/articleNarrative';
export function NarrativeImpact({incidentId}:{incidentId:string}){
 const { t, locale } = useI18n();
 const facts=useIncidentNarratives(incidentId).filter(f=>f.kind==='LOSS'||f.kind==='AID_VALUE'||f.kind==='BENEFICIARIES'||f.kind==='IMPACT');
 if(!facts.length)return null;
 // Reported impact rows keep the source's own label and unit; aid and loss rows
 // keep their fixed labels.
 const label=(f:NarrativeFact)=>f.kind==='IMPACT'?t(f.item):f.kind==='LOSS'?t('Kerugian dilaporkan'):f.kind==='BENEFICIARIES'?t('Perkiraan penerima manfaat bantuan'):t('Perkiraan nilai bantuan dilaporkan');
 const unit=(f:NarrativeFact)=>t(f.unit);
 return <div className="mt-3 space-y-2 rounded-xl border border-cyan-100 bg-cyan-50/70 p-3 text-xs text-slate-700">
  <strong>{t('Angka dari narasi berita')}</strong>
  {facts.map((f,i)=><p key={i}>{label(f)}{f.organization?` · ${f.organization}`:''}: <b>{f.unit==='Rp'?'Rp ':''}{f.quantity.toLocaleString(locale)}{f.unit==='Rp'?'':` ${unit(f)}`}</b> <a className="text-blue-600 underline" href={f.sourceUrl} target="_blank" rel="noreferrer">{f.sourceName}</a></p>)}
  <p className="text-[10px] text-slate-500">{t('Angka dampak mengikuti laporan sumber dan tidak dijumlahkan antar pemberitaan.')} {t('Nilai bantuan bukan estimasi kerugian bencana. Angka mengikuti laporan sumber, bukan nilai inventaris terkini.')}</p>
 </div>;
}
