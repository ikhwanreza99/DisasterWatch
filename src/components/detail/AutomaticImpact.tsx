import {incidentImpactBasis} from '../../services/insights/incidentImpactBasis';
import React from 'react';
import { useI18n } from '../../i18n';
import {elapsedIncidentDays,estimateHousingDamage} from '../../services/insights/impactEstimate';
const rupiah=(value:number,locale:string)=>new Intl.NumberFormat(locale,{style:'currency',currency:'IDR',notation:'compact',maximumFractionDigits:2}).format(value);
export function AutomaticImpact({incidentId,fallback}:{incidentId:string;fallback?:string}){
 const { t, locale } = useI18n();
 const {record,report,homes}=incidentImpactBasis(incidentId);
 if(homes==null||!record)return <>{fallback ? t(fallback) : t('Belum tersedia')}</>;
 const cost=100000000,days=elapsedIncidentDays(record!.startDate??record!.date);
 return <div className="mt-1 text-slate-800"><strong className="block text-lg leading-snug">{rupiah(estimateHousingDamage(homes,cost,.3)!,locale)}</strong>
 <span className="block mt-1 text-[10px] font-semibold text-amber-700">{t('Kerusakan fisik rumah · estimasi, bukan nilai resmi')}</span>
 <span className="block mt-2 text-[11px] font-normal text-slate-500">{homes.toLocaleString(locale)} {t('rumah rusak tercatat × Rp100 juta/rumah × 30%.')}</span>
 <details className="mt-2 text-[10px] font-normal text-slate-500"><summary className="cursor-pointer text-blue-600">{t('Dasar estimasi')}</summary><p className="mt-1">{t('Biaya dan severity ditetapkan pengguna: Rp100 juta/rumah dan 30%.')}</p><p>{t('Jumlah rumah memakai laporan BNPB {date} yang sama dengan kartu Dampak tercatat. Angka agregat provinsi tidak mengganti jumlah rumah kejadian ini. Biaya penggantian dan severity merupakan asumsi perhitungan, bukan hasil asesmen teknis.', { date: report?.date ?? '' })}</p><p>{t('Tanggal kejadian {date} · {days} hari berlalu (WIB). Durasi bukan bukti gangguan ekonomi masih berlangsung. Kerugian ekonomi harian dan total gabungan belum tersedia.', { date: record!.startDate??record!.date, days: days ?? '—' })}</p><a className="text-blue-600 underline" href={record!.url} target="_blank" rel="noreferrer">{t('Sumber BNPB')}</a></details></div>;
}
