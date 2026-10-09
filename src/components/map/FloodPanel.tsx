import React, { useEffect, useState } from 'react';
import { Waves, X, ArrowLeft, RefreshCw, Layers3, Info, MapPinned, Radio, Droplets } from 'lucide-react';
import { currentSeverity, floodLevels, type FloodGauge, type FloodSnapshot } from '../../services/flood/data';

const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Belum tersedia';
const whole = (value: number) => String(Math.round(value));
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
  const min = 0;
  const rawMax = Math.max(...values, 1);
  const max = Math.max(50, Math.ceil(rawMax / 50) * 50);
  const first = Date.parse(points[0].time), last = Date.parse(points.at(-1)!.time);
  const x = (time: string) => 38 + (Date.parse(time) - first) / (last - first || 1) * 272;
  const y = (v: number) => 145 - (v - min) / (max - min) * 120;
  const currentIndex = Math.min(points.length - 1, Math.max(1, Math.floor(points.length * 0.55)));
  const currentTime = points[currentIndex].time;
  const observed = points.slice(0, currentIndex + 1);
  const forecast = points.slice(currentIndex);
  return <div className="space-y-2">
    <p className="font-medium">{unit === 'm' ? 'Tinggi air' : 'Debit air'} dalam {unit}</p>
    <svg viewBox="0 0 330 180" role="img" aria-label={`Grafik prakiraan ${gauge.name}, satuan ${unit}`} className="w-full rounded-lg bg-white">
      {[min, max / 2, max].map(v => <g key={v}><line x1="38" x2="310" y1={y(v)} y2={y(v)} stroke="#e2e8f0"/><text x="33" y={y(v)+4} textAnchor="end" fontSize="10" fill="#64748b">{whole(v)}</text></g>)}
      {thresholds.map(t => <line key={t.name} x1="38" x2="310" y1={y(t.value!)} y2={y(t.value!)} stroke={t.color} strokeWidth="2"/>)}
      <line x1={x(currentTime)} x2={x(currentTime)} y1="12" y2="148" stroke="#334155" strokeDasharray="4 3" strokeWidth="2"/>
      <polyline points={observed.map(p => `${x(p.time)},${y(p.value)}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="3"/>
      <polyline points={forecast.map(p => `${x(p.time)},${y(p.value)}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray="4 4"/>
      <text x={x(currentTime) + 4} y="24" fontSize="11" fontWeight="600" fill="#334155">Saat ini</text>
      <text x="38" y="168" fontSize="10" fill="#64748b">{new Date(first).toLocaleDateString('id-ID')}</text>
      <text x="310" y="168" textAnchor="end" fontSize="10" fill="#64748b">{new Date(last).toLocaleDateString('id-ID')}</text>
    </svg>
    <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">{thresholds.map(t => <span key={t.name} className="text-[11px]" style={{ color: t.color }}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{background:t.color}}/>{t.name}<strong className="block text-slate-700">{whole(t.value!)} {unit}</strong></span>)}</div>
    <p className="mt-2 text-slate-500">Diterbitkan {date(gauge.forecastIssuedTime)}. Garis putus-putus adalah prakiraan, bukan pengukuran langsung.</p>
  </div>;
}

function FloodOptions({ data, state, showNormal, onShowNormal, refresh }: {
  data: FloodSnapshot | null; state: string; showNormal: boolean; onShowNormal: (value: boolean) => void; refresh: () => void;
}) {
  const [showFlash, setShowFlash] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showProbability, setShowProbability] = useState(true);
  const count = (level: string) => state === 'ready' ? data?.gauges.filter(g => currentSeverity(g) === level).length ?? 0 : '—';
  return <aside aria-label="Opsi lapisan banjir" className="pointer-events-auto absolute z-20 top-[5.25rem] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-[min(30vw,8rem)] right-3 rounded-2xl border border-slate-200 bg-white/95 text-slate-800 shadow-xl overflow-hidden backdrop-blur sm:left-auto sm:top-20 sm:bottom-auto sm:right-4 sm:w-[280px] sm:max-h-[calc(100dvh-6rem)]">
    <div className="flex items-center justify-between border-b border-slate-100 p-4">
      <h3 className="flex items-center gap-2 font-semibold"><Layers3 className="h-5 w-5"/>Lihat opsi <Info className="h-4 w-4 text-slate-400"/></h3>
      <button aria-label="Tutup opsi banjir" className="rounded-full p-1 hover:bg-slate-100"><X className="h-5 w-5"/></button>
    </div>
    <div className="h-full space-y-3 overflow-y-auto p-3 text-sm sm:h-auto sm:max-h-[calc(100dvh-7rem)]">
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between font-medium">Data banjir <Info className="h-4 w-4 text-slate-400"/></div>
        {Object.entries(floodLevels).map(([level, item]) => <div key={level} className="flex items-center gap-2 py-1"><span className="h-3 w-3 rounded-full" style={{background:item.color}}/>{item.label}<span className="ml-auto text-xs text-slate-500">{count(level)}</span></div>)}
      </div>
      <ToggleRow icon={<Droplets className="h-4 w-4"/>} label="Banjir bandang" hint="Dalam 24 jam" checked={showFlash} onChange={setShowFlash}/>
      <div className="rounded-xl bg-slate-50 p-3 text-slate-600"><div className="flex items-center gap-2"><span className="h-5 w-5 rounded border-2 border-orange-400"/>Sangat mungkin</div><div className="mt-2 flex items-center gap-2"><span className="h-5 w-5 rounded border-2 border-amber-400"/>Mungkin</div></div>
      <ToggleRow icon={<Radio className="h-4 w-4"/>} label="Tampilkan titik normal" hint="Stasiun tanpa peringatan" checked={showNormal} onChange={onShowNormal}/>
      <ToggleRow icon={<MapPinned className="h-4 w-4"/>} label="Peristiwa banjir besar" checked={showEvents} onChange={setShowEvents}/>
      <div className="rounded-xl bg-slate-50 p-3"><div className="mb-2 flex items-center gap-2 font-medium"><span className="h-3 w-3 rounded-full bg-rose-300 ring-4 ring-rose-100"/>Peristiwa yang sedang berlangsung</div><p className="text-xs text-slate-500">Belum ada peristiwa besar dari snapshot ini.</p></div>
      <ToggleRow icon={<Droplets className="h-4 w-4"/>} label="Kemungkinan banjir" checked={showProbability} onChange={setShowProbability}/>
      <div className="rounded-xl bg-slate-50 p-3 space-y-2 text-slate-600"><div><span className="mr-2 inline-block h-3 w-3 rounded-full bg-blue-900"/>Sangat tinggi</div><div><span className="mr-2 inline-block h-3 w-3 rounded-full bg-blue-500"/>Tertinggi</div><div className="text-slate-400"><span className="mr-2 inline-block h-3 w-3 rounded-full bg-blue-100"/>Sedang</div></div>
      <div className="border-t pt-3 text-xs text-slate-500"><p>Snapshot: {date(data?.generatedAt)}</p><button onClick={refresh} disabled={state === 'loading'} className="mt-2 flex items-center gap-1 text-blue-600 disabled:opacity-50"><RefreshCw className="h-3 w-3"/>Muat ulang data</button></div>
    </div>
  </aside>;
}

function ToggleRow({ icon, label, hint, checked, onChange }: { icon: React.ReactNode; label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between border-b border-slate-200 px-1 py-3"><span className="flex items-center gap-2"><span className="text-slate-500">{icon}</span><span><strong className="block font-medium">{label}</strong>{hint && <small className="text-xs text-slate-500">{hint}</small>}</span></span><input type="checkbox" className="h-5 w-5 accent-blue-600" checked={checked} onChange={event => onChange(event.target.checked)} /></label>;
}

export function FloodPanel({ data, state, selected, onSelect, showNormal, onShowNormal, refresh }: {
  data: FloodSnapshot | null; state: string; selected: FloodGauge | null;
  onSelect: (id: string | null) => void; showNormal: boolean; onShowNormal: (v: boolean) => void; refresh: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => { if (selected) setCollapsed(false); }, [selected?.id]);
  const stale = data && Date.now() - Date.parse(data.generatedAt) > 24 * 3600000;
  if (!selected) return <FloodOptions data={data} state={state} showNormal={showNormal} onShowNormal={onShowNormal} refresh={refresh}/>;
  return <>
    <div className="hidden sm:block"><FloodOptions data={data} state={state} showNormal={showNormal} onShowNormal={onShowNormal} refresh={refresh}/></div>
    <section aria-label="Prakiraan banjir sungai" className="pointer-events-auto absolute z-20 top-[5.25rem] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-[min(30vw,8rem)] right-3 rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xl overflow-hidden backdrop-blur sm:bottom-auto sm:left-4 sm:top-4 sm:w-[370px] sm:max-h-none">
    <div className="flex items-center justify-between p-4 border-b border-slate-100">
      <button className="flex items-center gap-2 font-semibold text-sm min-h-8" onClick={() => setCollapsed(false)}><MapPinned className="w-5 h-5 text-emerald-600"/>Prakiraan sungai <Info className="h-4 w-4 text-slate-400"/></button>
      <button aria-label={collapsed ? 'Buka panel banjir' : 'Tutup panel banjir'} onClick={() => setCollapsed(!collapsed)} className="p-2">{collapsed ? <span>+</span> : <X className="w-4 h-4"/>}</button>
    </div>
    {!collapsed && <div className="h-full p-4 space-y-3 text-xs overflow-y-auto sm:h-auto sm:max-h-[calc(100dvh-120px)]">
      <p className="text-slate-500">Debit air dalam {selected.unit === 'METERS' ? 'meter' : 'm³/dtk'}</p>
      {state === 'loading' && <p role="status">Memuat prakiraan banjir…</p>}
      {state === 'unavailable' && <p role="status">Data prakiraan belum tersedia. Silakan coba lagi nanti.</p>}
      {stale && <p className="text-amber-800 bg-amber-50 p-2 rounded-lg">Pembaruan data lebih dari 24 jam lalu. Periksa waktu berlaku setiap prakiraan.</p>}
      {selected ? <>
        <button onClick={() => onSelect(null)} className="flex items-center gap-1 text-blue-600 py-2"><ArrowLeft className="w-4 h-4"/>Semua titik pantau</button>
        <h3 className="text-lg font-bold break-words">{selected.name}</h3>
        <p className="font-semibold" style={{color: floodLevels[currentSeverity(selected)].color}}>{floodLevels[currentSeverity(selected)].label} · {selected.river || 'Nama sungai belum tersedia'}</p>
        <ForecastChart gauge={selected}/>
        <dl className="grid grid-cols-2 gap-3 border-t pt-3">
          <div><dt className="text-slate-500">ID pengukur</dt><dd className="break-all">{selected.id}</dd></div>
          <div><dt className="text-slate-500">Sumber</dt><dd>{selected.source || 'Tidak tersedia'}</dd></div>
          <div><dt className="text-slate-500">Sungai</dt><dd>{selected.river || 'Tidak tersedia'}</dd></div>
          <div><dt className="text-slate-500">Koordinat</dt><dd>{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}</dd></div>
        </dl>
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-slate-500">Ukuran daerah aliran sungai (km²)</span>
          <strong>{Number.isFinite(selected.basinAreaKm2) ? whole(selected.basinAreaKm2!) : 'Belum tersedia'}</strong>
        </div>
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
    </section>
  </>;
}
