import React,{useMemo,useState} from 'react';
import { useI18n } from '../../i18n';
import {
  estimateEconomicLossNetFlow, estimateForecastGap, estimateFundingGap, estimateFundingGapPercent,
  estimateNeedsDemand, estimatePhysicalDamage, estimatePhysicalGapCount, estimatePhysicalGapPercent,
  estimateTotalLoss, estimateUtilityRecovery, evaluateLifeSafetyOverride, scorePriority,
  METHOD_VERSION, PRIORITY_VERSION, type CalculationResult,
} from '../../services/insights/formulas';
import type { LiveInputAvailability } from '../../services/insights/calculationInputs';

export function InsightCalculator({incidentId,live}:{incidentId:string;live?:LiveInputAvailability|null}){
  const [values,setValues]=useState<Record<string,string>>({});
  const [sevUnit,setSevUnit]=useState<'fraction'|'percent'>('fraction');
  const { t, locale } = useI18n();
  // Raw numeric parse: empty string -> null (missing is never zero).
  // Malformed numbers (e.g. "abc") also -> null here and surface as
  // insufficient_data; hard negatives are flagged invalid_input by the engine.
  const n=(key:string)=>{
    const raw=values[key];
    if(raw===undefined||raw.trim()==='')return null;
    const v=Number(raw);
    return Number.isFinite(v)?v:null;
  };
  const src=(key:string)=>[`scenario:${incidentId}:${key}`];
  const area=incidentId, period='skenario pengguna';

  // --- A. Loss (engine-backed; trace/status shown below) ---
  const physical=useMemo(()=>estimatePhysicalDamage({assetCount:n('assets'),
    replacementCostPerAsset:n('cost'),damageFraction:n('severity'),damageFractionUnit:sevUnit,
    currency:'IDR',area,period,sourceRefs:src('assets'),evidenceTier:'modeled'}),[values,incidentId,sevUnit]);
  void physical;
  const flowNet=useMemo(()=>{
    const normal=n('normal'),actual=n('actual'),duration=n('duration');
    return estimateEconomicLossNetFlow(
      normal!==null?{value:normal,unit:'IDR/day',area,period,factIds:src('normal')}:null,
      actual!==null?{value:actual,unit:'IDR/day',area,period,factIds:src('actual')}:null,
      duration,{area,period});
  },[values,incidentId]);
  void flowNet;
  // Task base formula display uses the same net-flow engine result (legacy
  // economicLoss semantics preserved: max(0, normal-actual) x days).
  const econForTotal:CalculationResult={...flowNet};
  const physicalForTotal:CalculationResult=useMemo(()=>estimatePhysicalDamage({assetCount:n('assets'),
    replacementCostPerAsset:n('cost'),damageFraction:n('severity'),damageFractionUnit:sevUnit,currency:'IDR',area,period,sourceRefs:src('assets'),evidenceTier:'modeled'}),
    [values,incidentId,sevUnit]);
  const total=useMemo(()=>estimateTotalLoss(physicalForTotal,econForTotal),[physicalForTotal,econForTotal]);

  // --- B. Gaps ---
  const funding=useMemo(()=>estimateFundingGap({requirement:n('required'),available:n('funding'),
    currency:'IDR',area,period,programScope:'skenario pengguna',
    requirementStage:'available',availableStage:'available',sourceRefs:src('required')}),[values,incidentId]);
  const fundingPct=useMemo(()=>estimateFundingGapPercent({requirement:n('required'),available:n('funding'),
    currency:'IDR',area,period,programScope:'skenario pengguna',
    requirementStage:'available',availableStage:'available',sourceRefs:src('required')}),[values,incidentId]);
  const physGap=useMemo(()=>estimatePhysicalGapCount({affectedUnits:n('damaged'),recoveredUnits:n('restored'),
    unit:'asset',area,period,sourceRefs:src('damaged')}),[values,incidentId]);
  const physGapPct=useMemo(()=>estimatePhysicalGapPercent({affectedUnits:n('damaged'),recoveredUnits:n('restored'),
    unit:'asset',area,period,sourceRefs:src('damaged')}),[values,incidentId]);

  // --- D. Needs ---
  const demand=useMemo(()=>estimateNeedsDemand({targetPopulation:n('people'),
    dailyRequirementPerPerson:n('rate'),durationDays:n('days'),
    commodity:'scenario-item',unit:'unit',area,period,sourceRefs:src('people')}),[values,incidentId]);
  const forecastGap=useMemo(()=>estimateForecastGap({demand:demand.value,
    additionalBacklog:n('backlog'),usableStock:n('stock'),expectedIncoming:n('incoming'),
    unit:'unit',area,period,sourceRefs:src('people')}),[values,incidentId,demand.value]);
  const prio=useMemo(()=>scorePriority({S:n('s'),G:n('g'),V:n('v'),T:n('t'),A:n('a')}),[values]);
  const override=useMemo(()=>evaluateLifeSafetyOverride({severity:n('s'),timeUrgency:n('t'),lifeThreat:null}),[values]);

  const output=(r:CalculationResult,suffix='')=>r.value===null?t('Belum tersedia'):`${r.value.toLocaleString(locale,{maximumFractionDigits:2})}${suffix}`;
  const statusBadge=(r:CalculationResult)=>{
    const label=r.status==='calculated'?t('Dihitung'):r.status==='invalid_input'?t('Input tidak valid'):t('Data kurang');
    const cls=r.status==='calculated'?'bg-emerald-50 text-emerald-700 border-emerald-200':r.status==='invalid_input'?'bg-rose-50 text-rose-700 border-rose-200':'bg-slate-100 text-slate-500 border-slate-200';
    return <span className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
  };
  const traceLine=(r:CalculationResult)=>{
    if(r.value===null&&r.errors.length===0&&r.warnings.length===0)return null;
    return <span className="mt-1 block text-[10px] text-slate-400">
      {r.trace}
      {r.warnings.map((w,i)=><span key={i} className="block text-amber-700">⚠ {w}</span>)}
      {r.errors.map((e,i)=><span key={i} className="block text-rose-700">✕ {e}</span>)}
    </span>;
  };
  const field=(key:string,label:string)=><label key={key} className="block text-[11px] text-slate-500">{label}<input type="number" min="0" step="any" value={values[key]??''} onChange={e=>setValues({...values,[key]:e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 p-2 text-slate-800" placeholder={t('Belum tersedia')}/></label>;
  const svcIds=[['water',t('Air & sanitasi (rumah tangga)')],['electricity',t('Listrik (pelanggan)')],['access',t('Akses (km)')],['telecom',t('Telekomunikasi (pelanggan)')]] as const;
  return <details className="rounded-2xl border border-slate-200 bg-white p-4 text-xs" data-testid="insight-calculator"><summary className="font-bold text-slate-800 cursor-pointer">{t('Perhitungan dampak & kebutuhan')}</summary>
  <p className="mt-2 text-slate-500">{t('Data aktual belum memenuhi input formula. Buka simulasi di bawah untuk asesmen berskenario. Isian tidak disimpan atau mengganti data kejadian.')}</p>
  {live&&<div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600" data-testid="insight-live">
    <b>{t('Data kejadian (Firestore)')}</b>
    <span className="ml-2 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px]">{live.notice}</span>
    <span className="mt-1 block">Needs: {live.needsDocs} docs ({live.needsWithQuantities} quantified) · Recovery: {live.recoveryDocs} docs ({live.recoveryWithCounts} counted) · Claims: {live.claimsDocs} · Aid events: {live.aidEventDocs}</span>
    {live.blockers.map((b,i)=><span key={i} className="block text-slate-500">• {b}</span>)}
  </div>}
  <details className="mt-3"><summary className="cursor-pointer text-blue-600">{t('Simulasi — bukan data resmi')}</summary><div className="space-y-4 mt-3">
  <section><b>{t('Kerusakan fisik & kerugian ekonomi')}</b>{statusBadge(total)}<div className="grid grid-cols-2 gap-2 mt-2">{field('assets',t('Jumlah aset (bukan KK)'))}{field('cost',t('Biaya penggantian IDR/aset'))}<label className="block text-[11px] text-slate-500">{t('Tingkat kerusakan')}<div className="mt-1 flex gap-1"><input type="number" min="0" step="any" value={values['severity']??''} onChange={e=>setValues({...values,['severity']:e.target.value})} className="block w-full rounded-lg border border-slate-200 p-2 text-slate-800" placeholder={t('Belum tersedia')}/><select value={sevUnit} onChange={e=>setSevUnit(e.target.value as 'fraction'|'percent')} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-800" aria-label={t('Satuan tingkat kerusakan')}><option value="fraction">{t('Fraksi 0–1')}</option><option value="percent">{t('Persen 0–100')}</option></select></div></label>{field('normal',t('Arus ekonomi bersih normal IDR/hari'))}{field('actual',t('Arus bersih aktual IDR/hari'))}{field('duration',t('Durasi hari'))}</div><p className="mt-2">Damage: {output(physicalForTotal,' IDR')} · Flow loss: {output(econForTotal,' IDR')}<br/>{t('Total cakupan asesmen')}: {output(total,' IDR')}</p>{traceLine(total)}<p className="text-[10px] text-slate-400">physical: {physicalForTotal.trace} · flow: {econForTotal.trace}</p></section>
  <section><b>{t('Gap pendanaan dan fisik (terpisah)')}</b>{statusBadge(funding)}<div className="grid grid-cols-2 gap-2 mt-2">{field('required',t('Biaya pemulihan IDR'))}{field('funding',t('Dana tersedia teralokasi IDR'))}{field('damaged',t('Aset perlu dipulihkan'))}{field('restored',t('Aset sudah pulih'))}</div><p className="mt-2">{t('Pendanaan:')} {output(funding,' IDR')} ({output(fundingPct,'%')}) · {t('Fisik:')} {output(physGapPct,'%')}{statusBadge(physGapPct)}</p>{traceLine(funding)}{traceLine(physGap)}<p className="text-[10px] text-slate-400">Gap fisik: {physGap.value===null?t('Belum tersedia'):`${physGap.value} unit belum pulih`} · {physGap.trace}</p></section>
  <section><b>{t('Pemulihan layanan')}</b>{svcIds.map(([id,label])=>{
    const r=estimateUtilityRecovery({service:id as 'water'|'electricity'|'access'|'telecom',
      affected:n(`${id}Affected`),recovered:n(`${id}Restored`),area,period,sourceRefs:src(`${id}Affected`)});
    return <div className="mt-2" key={id}><span>{label}{statusBadge(r)}</span><div className="grid grid-cols-2 gap-2">{field(`${id}Affected`,t('Terdampak'))}{field(`${id}Restored`,t('Pulih'))}</div><p>{output(r,'%')}</p>{traceLine(r)}</div>;})}</section>
  <section><b>{t('Proyeksi kebutuhan')}</b>{statusBadge(forecastGap)}<div className="grid grid-cols-2 gap-2 mt-2">{field('people',t('Populasi membutuhkan'))}{field('rate',t('Kebutuhan unit/orang/hari'))}{field('days',t('Horizon hari'))}{field('backlog',t('Backlog (unit)'))}{field('stock',t('Stok siap pakai (unit)'))}{field('incoming',t('Pasokan masuk siap pakai (unit)'))}</div><p className="mt-2">Forecast gap: {output(forecastGap,' unit')}</p><p className="text-[10px] text-slate-400">Demand: {demand.trace}</p>{traceLine(forecastGap)}<p className="text-slate-400">{t('Populasi konstan dalam horizon; gunakan satu jenis barang dan satuan yang sama. Nol harus dimasukkan secara eksplisit.')}</p></section>
  <section><b>{t('Prioritas heuristik MVP (0–100)')}</b>{statusBadge(prio)}<div className="grid grid-cols-2 gap-2 mt-2">{field('s','Severity 0–1')}{field('g',t('Rasio gap 0–1'))}{field('v',t('Kerentanan 0–1'))}{field('t',t('Urgensi waktu 0–1'))}{field('a',t('Hambatan akses 0–1'))}</div><p className="mt-2">{t('Skor:')} {output(prio)}</p>{traceLine(prio)}<p className="text-[10px] text-slate-400">MVP {PRIORITY_VERSION} · 0.30/0.25/0.20/0.15/0.10 · {override.triggered?override.reason:t('Ancaman keselamatan memerlukan asesmen segera, terlepas dari kelengkapan skor.')}</p></section>
  <p className="text-[10px] text-slate-400">{t('Metode {version} · Area: {area} · Cakupan/waktu seluruh input harus sama. Baseline draft tidak otomatis diterapkan. Financial gap dan physical gap tidak dijumlahkan. Hasil simulasi bukan bukti lapangan.', { version: METHOD_VERSION, area: incidentId })}</p>
  </div></details></details>;
}
