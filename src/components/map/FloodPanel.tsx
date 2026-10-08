import React, { useEffect, useState } from 'react';
import { Waves, X, ArrowLeft, RefreshCw } from 'lucide-react';
import { currentSeverity, floodLevels, type FloodGauge, type FloodSnapshot } from '../../services/flood/data';

const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Belum tersedia';
function ForecastChart({ gauge }: { gauge: FloodGauge }) {
  const unit = gauge.unit === 'METERS' ? 'm' : gauge.unit === 'CUBIC_METERS_PER_SECOND' ? 'm³/dtk' : null;
  const points = gauge.forecast;
  if (!unit || points.length < 2) return <p className="rounded-xl bg-slate-50 p-4 text-slate-500">Grafik prakiraan belum tersedia untuk titik ini.</p>;
  const thresholds = [
    { name: 'Peringatan', value: gauge.thresholds?.warningLevel, color: '#f59e0b' },
    { name: 'Bahaya', value: gauge.thresholds?.dangerLevel, color: '#f04421' },
    { name: 'Ekstrem', value: gauge.thresholds?.extremeDangerLevel, color: '#b91c1c' },
  ].filter(t => Number.isFinite(t.value));
  const values = [...points.map(p => p.value), ...thresholds.map(t => t.value!)];
  const min = Math.min(0, ...values), max = Math.max(...values, min + 1);
  const first = Date.parse(points[0].time), last = Date.parse(points.at(-1)!.time);
  const x = (time: string) => 38 + (Date.parse(time) - first) / (last - first || 1) * 272;
  const y = (v: number) => 145 - (v - min) / (max - min) * 120;
  return <div>
    <p className="font-medium">{unit === 'm' ? 'Tinggi air' : 'Debit sungai'} ({unit}) · prakiraan model</p>
    <svg viewBox="0 0 330 180" role="img" aria-label={`Grafik prakiraan ${gauge.name}, satuan ${unit}`} className="w-full">
      {[min, (max + min) / 2, max].map(v => <g key={v}><line x1="38" x2="310" y1={y(v)} y2={y(v)} stroke="#e2e8f0"/><text x="33" y={y(v)+4} textAnchor="end" fontSize="10" fill="#64748b">{Math.round(v*10)/10}</text></g>)}
      {thresholds.map(t => <line key={t.name} x1="38" x2="310" y1={y(t.value!)} y2={y(t.value!)} stroke={t.color} strokeWidth="1.5"/>)}
      <polyline points={points.map(p => `${x(p.time)},${y(p.value)}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray="5 3"/>
      <text x="38" y="168" fontSize="10" fill="#64748b">{new Date(first).toLocaleDateString('id-ID')}</text>
      <text x="310" y="168" textAnchor="end" fontSize="10" fill="#64748b">{new Date(last).toLocaleDateString('id-ID')}</text>
    </svg>
    <div className="flex flex-wrap gap-3">{thresholds.map(t => <span key={t.name} style={{ color: t.color }}>{t.name}: {t.value} {unit}</span>)}</div>
    <p className="mt-2 text-slate-500">Diterbitkan {date(gauge.forecastIssuedTime)}. Garis putus-putus adalah prakiraan, bukan pengukuran langsung.</p>
  </div>;
}
export function FloodPanel({ data, state, selected, onSelect, showNormal, onShowNormal, refresh }: {
  data: FloodSnapshot | null; state: string; selected: FloodGauge | null;
  onSelect: (id: string | null) => void; showNormal: boolean; onShowNormal: (v: boolean) => void; refresh: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => { if (selected) setCollapsed(false); }, [selected?.id]);
  const stale = data && Date.now() - Date.parse(data.generatedAt) > 24 * 3600000;
  return <section aria-label="Prakiraan banjir sungai" className="pointer-events-auto absolute z-30 bottom-24 left-16 right-3 sm:left-auto sm:top-20 sm:bottom-auto sm:right-4 sm:w-80 rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xl overflow-hidden">
    <div className="flex items-center justify-between p-3 border-b border-slate-100">
      <button className="flex items-center gap-2 font-semibold text-sm min-h-8" onClick={() => setCollapsed(false)}><Waves className="w-5 h-5 text-blue-600"/>Prakiraan sungai</button>
      <button aria-label={collapsed ? 'Buka panel banjir' : 'Tutup panel banjir'} onClick={() => setCollapsed(!collapsed)} className="p-2">{collapsed ? <span>+</span> : <X className="w-4 h-4"/>}</button>
    </div>
    {!collapsed && <div className="p-4 space-y-3 text-xs overflow-y-auto max-h-[38dvh] sm:max-h-[calc(100dvh-280px)]">
      <p className="text-slate-500">Indonesia · banjir luapan sungai</p>
      {state === 'loading' && <p role="status">Memuat prakiraan banjir…</p>}
      {state === 'unavailable' && <p role="status">Data prakiraan belum tersedia. Silakan coba lagi nanti.</p>}
      {stale && <p className="text-amber-800 bg-amber-50 p-2 rounded-lg">Pembaruan data lebih dari 24 jam lalu. Periksa waktu berlaku setiap prakiraan.</p>}
      {selected ? <>
        <button onClick={() => onSelect(null)} className="flex items-center gap-1 text-blue-600 py-2"><ArrowLeft className="w-4 h-4"/>Semua titik pantau</button>
        <h3 className="text-base font-bold break-words">{selected.name}</h3>
        <p className="font-semibold" style={{color: floodLevels[currentSeverity(selected)].color}}>{floodLevels[currentSeverity(selected)].label}</p>
        <ForecastChart gauge={selected}/>
        <dl className="grid grid-cols-2 gap-3 border-t pt-3">
          <div><dt className="text-slate-500">ID pengukur</dt><dd className="break-all">{selected.id}</dd></div>
          <div><dt className="text-slate-500">Sumber</dt><dd>{selected.source || 'Tidak tersedia'}</dd></div>
          <div><dt className="text-slate-500">Sungai</dt><dd>{selected.river || 'Tidak tersedia'}</dd></div>
          <div><dt className="text-slate-500">Koordinat</dt><dd>{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}</dd></div>
        </dl>
        <p>{selected.qualityVerified ? 'Model terverifikasi kualitas' : 'Model belum terverifikasi kualitas'}</p>
        <p>Status diterbitkan {date(selected.issuedTime)}<br/>Berlaku sampai {date(selected.validUntil)}</p>
        <a className="text-blue-600 underline" href={`https://sites.research.google/floods/l/${selected.lat}/${selected.lng}/8/g/${encodeURIComponent(selected.id)}`} target="_blank" rel="noreferrer">Lihat di Flood Hub ↗</a>
      </> : <>
        <div className="rounded-xl bg-slate-50 p-3 space-y-2">
          <p className="font-medium">Tingkat peringatan</p>
          {Object.entries(floodLevels).map(([level, item]) => <div key={level} className="flex items-center gap-2"><span className="rounded-full w-3 h-3" style={{background:item.color}}/>{item.label}<span className="ml-auto text-slate-500">{state === 'ready' ? data?.gauges.filter(g => currentSeverity(g) === level).length ?? 0 : '—'}</span></div>)}
          <label className="flex items-center justify-between pt-2 border-t"><span>Tampilkan titik normal</span><input type="checkbox" checked={showNormal} onChange={e => onShowNormal(e.target.checked)}/></label>
        </div>
        <input aria-label="Cari titik pantau sungai" placeholder="Cari sungai atau titik pantau" value={query} onChange={e => setQuery(e.target.value)} className="w-full border rounded-lg p-2"/>
        <div className="space-y-1">{data?.gauges.filter(g => (showNormal || currentSeverity(g) !== 'NO_FLOODING') && `${g.name} ${g.river} ${g.id}`.toLowerCase().includes(query.toLowerCase())).map(g => <button key={g.id} onClick={() => onSelect(g.id)} className="w-full flex items-center gap-2 text-left p-2 rounded-lg hover:bg-blue-50"><span className="w-3 h-3 rounded-full shrink-0" style={{background:floodLevels[currentSeverity(g)].color}}/><span className="truncate">{g.name}</span><span className="ml-auto">›</span></button>)}</div>
        {state === 'ready' && !data?.gauges.length && <p>Tidak ada titik pantau tersedia untuk Indonesia.</p>}
      </>}
      <div className="border-t pt-3 space-y-2 text-slate-500"><p>Snapshot: {date(data?.generatedAt)}</p><button onClick={refresh} disabled={state === 'loading'} className="flex gap-1 items-center text-blue-600 py-1 disabled:opacity-50"><RefreshCw className="w-3 h-3"/>Muat ulang data</button><p>Data: <a className="underline" href="https://sites.research.google/floods/" target="_blank" rel="noreferrer">Google Flood Forecasting</a> · CC BY 4.0</p><p>Cakupan titik sungai tidak mewakili semua banjir lokal atau banjir bandang.</p></div>
    </div>}
  </section>;
}
