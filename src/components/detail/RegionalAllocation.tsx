import React,{useEffect,useState} from 'react';
import { useI18n } from '../../i18n';
export interface Dataset {version:number;generatedAt:string;province:string;start:string;end:string;sourceUrl:string;coverage:string;points:Array<{id:string;name:string;weightBasis:string}>;metrics:Record<string,{total:number|null;allocations:Array<{id:string;share:number;value:number}>|null}>}
let request:Promise<Dataset>|null=null;
export function useRegionalAllocation(){
 const [data,setData]=useState<Dataset|null>(null);
 useEffect(()=>{let active=true;request??=fetch('/data/bnpb-regional.json',{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw new Error('Unavailable');return r.json();});request.then(d=>{if(active&&d.version===1&&Date.now()-Date.parse(d.generatedAt)<86400000*2)setData(d);}).catch(()=>{request=null;});return()=>{active=false;};},[]);
 return data;
}
export function RegionalAllocation({incidentId}:{incidentId:string}){
 const data=useRegionalAllocation();
 const { t, locale } = useI18n();
 const point=data?.points.find(p=>p.id===incidentId);if(!data||!point)return null;
 const labels:Record<string,string>={rumah_rusak_berat:'Rumah rusak berat',rumah_rusak_sedang:'Rumah rusak sedang',rumah_rusak_ringan:'Rumah rusak ringan',menderita_mengungsi:'Menderita/mengungsi (gabungan)'};
 return <details className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-slate-600"><summary className="font-bold cursor-pointer">{t('Alokasi estimasi agregat {province}', { province: data.province })}</summary><p className="mt-2">{t('Skenario proporsi · bukan laporan langsung titik ini.')} {data.start}–{data.end}. {t('Bobot:')} {point.weightBasis}.</p>{Object.entries(data.metrics).map(([key,metric])=>{const row=metric.allocations?.find(r=>r.id===incidentId);return <p key={key}>{t(labels[key])}: {row?`${row.value.toLocaleString(locale)} (${(row.share*100).toFixed(1)}% ${t('dari total')} ${metric.total?.toLocaleString(locale)})`:t('Belum tersedia')}</p>;})}<p className="mt-2">{data.coverage} {t('Tidak ditambahkan ke angka BNPB per kejadian atau dipakai sebagai populasi kebutuhan.')}</p><a className="text-blue-600 underline" href={data.sourceUrl} target="_blank" rel="noreferrer">{t('Agregat BNPB')}</a></details>;
}
