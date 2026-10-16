import {useRegionalAllocation} from './RegionalAllocation';
import React from 'react';
import {currentRecords} from '../../data/currentIncidents';
import {elapsedIncidentDays,estimateHousingDamage} from '../../services/insights/impactEstimate';
const rupiah=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',notation:'compact',maximumFractionDigits:2}).format(value);
export function AutomaticImpact({incidentId,fallback}:{incidentId:string;fallback?:string}){
 const regional=useRegionalAllocation();
 const record=currentRecords.find(r=>r.id===incidentId);
 const report=record?.reports?.at(-1);
 const allocated=['rumah_rusak_berat','rumah_rusak_sedang','rumah_rusak_ringan'].map(key=>regional?.metrics[key]?.allocations?.find(a=>a.id===incidentId));
 const isAllocated=allocated.every(a=>a!==undefined);
 const homes=isAllocated?allocated.reduce((sum,a)=>sum+a!.value,0):report?.impact?.damagedHomes;
 if(homes==null||!record)return <>{fallback??'Belum tersedia'}</>;
 const cost=100000000,days=elapsedIncidentDays(record!.startDate??record!.date);
 return <div className="mt-1 text-slate-800"><strong className="block text-lg leading-snug">{rupiah(estimateHousingDamage(homes,cost,.3)!)}</strong>
 <span className="block mt-1 text-[10px] font-semibold text-amber-700">Estimasi berskenario · bukan nilai resmi</span>
 <span className="block mt-2 text-[11px] font-normal text-slate-500">{homes.toLocaleString('id-ID')} {isAllocated?'rumah estimasi':'rumah rusak tercatat'} × Rp100 juta/rumah × 30%.</span>
 <details className="mt-2 text-[10px] font-normal text-slate-500"><summary className="cursor-pointer text-blue-600">Dasar estimasi</summary><p className="mt-1">Biaya dan severity ditetapkan pengguna: Rp100 juta/rumah dan 30%.</p><p>{isAllocated?`Jumlah rumah ditaksir dari proporsi ${(allocated[0]!.share*100).toFixed(1)}% terhadap data BNPB ${regional!.province}, periode ${regional!.start}–${regional!.end}. Pembagian hanya mencakup titik DisasterWatch yang tersedia; bukan jumlah rumah terverifikasi di lokasi ini.`:`Jumlah rumah: laporan BNPB ${report?.date}.`} Biaya penggantian dan severity merupakan asumsi perhitungan, bukan hasil asesmen teknis.</p><p>Tanggal kejadian {record!.startDate??record!.date} · {days??'—'} hari berlalu (WIB). Durasi bukan bukti gangguan ekonomi masih berlangsung. Kerugian ekonomi harian dan total gabungan belum tersedia.</p><a className="text-blue-600 underline" href={isAllocated?regional!.sourceUrl:record!.url} target="_blank" rel="noreferrer">Sumber BNPB</a></details></div>;
}
