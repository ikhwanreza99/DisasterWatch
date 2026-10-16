import React,{useState} from 'react';
import { useI18n } from '../../i18n';
import { damage,economicLoss,totalLoss,gap,gapPercent,utilityRecovery,forecast,priority,METHOD_VERSION,type Measure } from '../../services/insights/formulas';
export function InsightCalculator({incidentId}:{incidentId:string}){
 const [values,setValues]=useState<Record<string,string>>({});
 const { t, locale } = useI18n();
 const n=(key:string)=>values[key]?.trim()!==''&&values[key]!==undefined&&Number.isFinite(Number(values[key]))?Number(values[key]):null;
 const measure=(key:string,unit:string):Measure|null=>n(key)!==null?{value:n(key)!,unit,area:incidentId,period:'skenario pengguna',factIds:[`scenario:${key}`]}:null;
 const physical=damage(measure('assets','asset'),n('cost'),n('severity'));
 const flow=economicLoss(measure('normal','IDR/day'),measure('actual','IDR/day'),n('duration'));
 const total=totalLoss(physical,flow);
 const financial=gap(measure('required','IDR'),measure('funding','IDR'));
 const financialPct=gapPercent(measure('required','IDR'),measure('funding','IDR'));
 const physicalPct=gapPercent(measure('damaged','asset'),measure('restored','asset'));
 const output=(v:number|null,suffix='')=>v===null?t('Belum tersedia'):`${v.toLocaleString(locale,{maximumFractionDigits:2})}${suffix}`;
 const field=(key:string,label:string)=><label key={key} className="block text-[11px] text-slate-500">{label}<input type="number" min="0" step="any" value={values[key]??''} onChange={e=>setValues({...values,[key]:e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 p-2 text-slate-800" placeholder={t('Belum tersedia')}/></label>;
 return <details className="rounded-2xl border border-slate-200 bg-white p-4 text-xs"><summary className="font-bold text-slate-800 cursor-pointer">{t('Perhitungan dampak & kebutuhan')}</summary>
 <p className="mt-2 text-slate-500">{t('Data aktual belum memenuhi input formula. Buka simulasi di bawah untuk asesmen berskenario. Isian tidak disimpan atau mengganti data kejadian.')}</p>
 <details className="mt-3"><summary className="cursor-pointer text-blue-600">{t('Simulasi — bukan data resmi')}</summary><div className="space-y-4 mt-3">
 <section><b>{t('Kerusakan fisik & kerugian ekonomi')}</b><div className="grid grid-cols-2 gap-2 mt-2">{field('assets',t('Jumlah aset (bukan KK)'))}{field('cost',t('Biaya penggantian IDR/aset'))}{field('severity',t('Fraksi kerusakan 0–1'))}{field('normal',t('Arus ekonomi bersih normal IDR/hari'))}{field('actual',t('Arus bersih aktual IDR/hari'))}{field('duration',t('Durasi hari'))}</div><p className="mt-2">Damage: {output(physical.value,' IDR')} · Flow loss: {output(flow.value,' IDR')}<br/>{t('Total cakupan asesmen')}: {output(total.value,' IDR')}</p></section>
 <section><b>{t('Gap pendanaan dan fisik (terpisah)')}</b><div className="grid grid-cols-2 gap-2 mt-2">{field('required',t('Biaya pemulihan IDR'))}{field('funding',t('Dana tersedia teralokasi IDR'))}{field('damaged',t('Aset perlu dipulihkan'))}{field('restored',t('Aset sudah pulih'))}</div><p className="mt-2">{t('Pendanaan:')} {output(financial.value,' IDR')} ({output(financialPct.value,'%')}) · {t('Fisik:')} {output(physicalPct.value,'%')}</p></section>
 <section><b>{t('Pemulihan layanan')}</b>{[['water',t('Air & sanitasi (rumah tangga)')],['electricity',t('Listrik (pelanggan)')],['access',t('Akses (km)')],['telecom',t('Telekomunikasi (pelanggan)')]].map(([id,label])=><div className="mt-2" key={id}><span>{label}</span><div className="grid grid-cols-2 gap-2">{field(`${id}Affected`,t('Terdampak'))}{field(`${id}Restored`,t('Pulih'))}</div><p>{output(utilityRecovery(measure(`${id}Affected`,id),measure(`${id}Restored`,id)).value,'%')}</p></div>)}</section>
 <section><b>{t('Proyeksi kebutuhan')}</b><div className="grid grid-cols-2 gap-2 mt-2">{field('people',t('Populasi membutuhkan'))}{field('rate',t('Kebutuhan unit/orang/hari'))}{field('days',t('Horizon hari'))}{field('backlog',t('Backlog (unit)'))}{field('stock',t('Stok siap pakai (unit)'))}{field('incoming',t('Pasokan masuk siap pakai (unit)'))}</div><p className="mt-2">Forecast gap: {output(forecast(n('people'),n('rate'),n('days'),n('backlog'),n('stock'),n('incoming')),' unit')}</p><p className="text-slate-400">{t('Populasi konstan dalam horizon; gunakan satu jenis barang dan satuan yang sama. Nol harus dimasukkan secara eksplisit.')}</p></section>
 <section><b>{t('Prioritas heuristik MVP (0–100)')}</b><div className="grid grid-cols-2 gap-2 mt-2">{field('s','Severity 0–1')}{field('g',t('Rasio gap 0–1'))}{field('v',t('Kerentanan 0–1'))}{field('t',t('Urgensi waktu 0–1'))}{field('a',t('Hambatan akses 0–1'))}</div><p className="mt-2">{t('Skor:')} {output(priority(n('s'),n('g'),n('v'),n('t'),n('a')))}</p><p className="text-slate-400">{t('Ancaman keselamatan memerlukan asesmen segera, terlepas dari kelengkapan skor.')}</p></section>
 <p className="text-[10px] text-slate-400">{t('Metode {version} · Area: {area} · Cakupan/waktu seluruh input harus sama. Baseline draft tidak otomatis diterapkan. Financial gap dan physical gap tidak dijumlahkan. Hasil simulasi bukan bukti lapangan.', { version: METHOD_VERSION, area: incidentId })}</p>
 </div></details></details>;
}
