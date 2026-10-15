import React,{useState} from 'react';
import { damage,economicLoss,totalLoss,gap,gapPercent,utilityRecovery,forecast,priority,METHOD_VERSION,type Measure } from '../../services/insights/formulas';
export function InsightCalculator({incidentId}:{incidentId:string}){
 const [values,setValues]=useState<Record<string,string>>({});
 const n=(key:string)=>values[key]?.trim()!==''&&values[key]!==undefined&&Number.isFinite(Number(values[key]))?Number(values[key]):null;
 const measure=(key:string,unit:string):Measure|null=>n(key)!==null?{value:n(key)!,unit,area:incidentId,period:'skenario pengguna',factIds:[`scenario:${key}`]}:null;
 const physical=damage(measure('assets','asset'),n('cost'),n('severity'));
 const flow=economicLoss(measure('normal','IDR/day'),measure('actual','IDR/day'),n('duration'));
 const total=totalLoss(physical,flow);
 const financial=gap(measure('required','IDR'),measure('funding','IDR'));
 const financialPct=gapPercent(measure('required','IDR'),measure('funding','IDR'));
 const physicalPct=gapPercent(measure('damaged','asset'),measure('restored','asset'));
 const output=(v:number|null,suffix='')=>v===null?'Belum tersedia':`${v.toLocaleString('id-ID',{maximumFractionDigits:2})}${suffix}`;
 const field=(key:string,label:string)=><label key={key} className="block text-[11px] text-slate-500">{label}<input type="number" min="0" step="any" value={values[key]??''} onChange={e=>setValues({...values,[key]:e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 p-2 text-slate-800" placeholder="Belum tersedia"/></label>;
 return <details className="rounded-2xl border border-slate-200 bg-white p-4 text-xs"><summary className="font-bold text-slate-800 cursor-pointer">Perhitungan dampak & kebutuhan</summary>
 <p className="mt-2 text-slate-500">Data aktual belum memenuhi input formula. Buka simulasi di bawah untuk asesmen berskenario. Isian tidak disimpan atau mengganti data kejadian.</p>
 <details className="mt-3"><summary className="cursor-pointer text-blue-600">Simulasi — bukan data resmi</summary><div className="space-y-4 mt-3">
 <section><b>Kerusakan fisik & kerugian ekonomi</b><div className="grid grid-cols-2 gap-2 mt-2">{field('assets','Jumlah aset (bukan KK)')}{field('cost','Biaya penggantian IDR/aset')}{field('severity','Fraksi kerusakan 0–1')}{field('normal','Arus ekonomi bersih normal IDR/hari')}{field('actual','Arus bersih aktual IDR/hari')}{field('duration','Durasi hari')}</div><p className="mt-2">Damage: {output(physical.value,' IDR')} · Flow loss: {output(flow.value,' IDR')}<br/>Total cakupan asesmen: {output(total.value,' IDR')}</p></section>
 <section><b>Gap pendanaan dan fisik (terpisah)</b><div className="grid grid-cols-2 gap-2 mt-2">{field('required','Biaya pemulihan IDR')}{field('funding','Dana tersedia teralokasi IDR')}{field('damaged','Aset perlu dipulihkan')}{field('restored','Aset sudah pulih')}</div><p className="mt-2">Pendanaan: {output(financial.value,' IDR')} ({output(financialPct.value,'%')}) · Fisik: {output(physicalPct.value,'%')}</p></section>
 <section><b>Pemulihan layanan</b>{[['water','Air & sanitasi (rumah tangga)'],['electricity','Listrik (pelanggan)'],['access','Akses (km)'],['telecom','Telekomunikasi (pelanggan)']].map(([id,label])=><div className="mt-2" key={id}><span>{label}</span><div className="grid grid-cols-2 gap-2">{field(`${id}Affected`,'Terdampak')}{field(`${id}Restored`,'Pulih')}</div><p>{output(utilityRecovery(measure(`${id}Affected`,id),measure(`${id}Restored`,id)).value,'%')}</p></div>)}</section>
 <section><b>Proyeksi kebutuhan</b><div className="grid grid-cols-2 gap-2 mt-2">{field('people','Populasi membutuhkan')}{field('rate','Kebutuhan unit/orang/hari')}{field('days','Horizon hari')}{field('backlog','Backlog (unit)')}{field('stock','Stok siap pakai (unit)')}{field('incoming','Pasokan masuk siap pakai (unit)')}</div><p className="mt-2">Forecast gap: {output(forecast(n('people'),n('rate'),n('days'),n('backlog'),n('stock'),n('incoming')),' unit')}</p><p className="text-slate-400">Populasi konstan dalam horizon; gunakan satu jenis barang dan satuan yang sama. Nol harus dimasukkan secara eksplisit.</p></section>
 <section><b>Prioritas heuristik MVP (0–100)</b><div className="grid grid-cols-2 gap-2 mt-2">{field('s','Severity 0–1')}{field('g','Rasio gap 0–1')}{field('v','Kerentanan 0–1')}{field('t','Urgensi waktu 0–1')}{field('a','Hambatan akses 0–1')}</div><p className="mt-2">Skor: {output(priority(n('s'),n('g'),n('v'),n('t'),n('a')))}</p><p className="text-slate-400">Ancaman keselamatan memerlukan asesmen segera, terlepas dari kelengkapan skor.</p></section>
 <p className="text-[10px] text-slate-400">Metode {METHOD_VERSION} · Area: {incidentId} · Cakupan/waktu seluruh input harus sama. Baseline draft tidak otomatis diterapkan. Financial gap dan physical gap tidak dijumlahkan. Hasil simulasi bukan bukti lapangan.</p>
 </div></details></details>;
}
