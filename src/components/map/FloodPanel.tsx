import React, { useEffect, useState } from 'react';
import { Waves, X, ArrowLeft, RefreshCw, Layers3, Info, MapPinned, Radio, Droplets } from 'lucide-react';
import { currentFloodForecast, currentSeverity, floodLevels, type FloodGauge, type FloodSnapshot } from '../../services/flood/data';
import { useI18n, translate, localeFor } from '../../i18n';

const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(localeFor(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : translate('Belum tersedia');
const whole = (value: number) => String(Math.round(value));
function ForecastChart({ gauge, now }: { gauge: FloodGauge; now: number }) {
  const { t: tr, locale } = useI18n();
  const unit = gauge.unit === 'METERS' ? 'm' : gauge.unit === 'CUBIC_METERS_PER_SECOND' ? 'm³/dtk' : null;
  const points = gauge.forecast;
  if (!unit || points.length < 2) return <p className="rounded-xl bg-slate-50 p-4 text-slate-500">{tr('Grafik prakiraan belum tersedia untuk titik ini.')}</p>;
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
  const currentTime = new Date(now).toISOString();
  const currentX = Math.max(38, Math.min(310, x(currentTime)));
  const inRange = now >= first && now <= last;
  const current = currentFloodForecast(gauge, now);
  return <div className="space-y-2">
    <p className="font-medium">{tr('{kind} dalam {unit}', { kind: unit === 'm' ? tr('Tinggi air') : tr('Debit air'), unit: tr(unit) })}</p>
    <svg viewBox="0 0 330 180" role="img" aria-label={tr('Grafik prakiraan {name}, satuan {unit}', { name: gauge.name, unit: tr(unit) })} className="w-full rounded-lg bg-white">
      {[min, max / 2, max].map(v => <g key={v}><line x1="38" x2="310" y1={y(v)} y2={y(v)} stroke="#e2e8f0"/><text x="33" y={y(v)+4} textAnchor="end" fontSize="10" fill="#64748b">{whole(v)}</text></g>)}
      {thresholds.map(t => <line key={t.name} x1="38" x2="310" y1={y(t.value!)} y2={y(t.value!)} stroke={t.color} strokeWidth="2"/>)}
      {inRange && <line x1={currentX} x2={currentX} y1="12" y2="148" stroke="#334155" strokeDasharray="4 3" strokeWidth="2"/>}
      <polyline points={points.map(p => `${x(p.time)},${y(p.value)}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray="4 4"/>
      {inRange && <text x={currentX > 250 ? currentX - 4 : currentX + 4} textAnchor={currentX > 250 ? 'end' : 'start'} y="24" fontSize="11" fontWeight="600" fill="#334155">{tr('Saat ini')}</text>}
      {current && inRange && <circle cx={currentX} cy={y(current.value)} r="4" fill="#2563eb" stroke="white" strokeWidth="2"/>}
      <text x="38" y="168" fontSize="10" fill="#64748b">{new Date(first).toLocaleDateString(locale)}</text>
      <text x="310" y="168" textAnchor="end" fontSize="10" fill="#64748b">{new Date(last).toLocaleDateString(locale)}</text>
    </svg>
    <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">{thresholds.map(t => <span key={t.name} className="text-[11px]" style={{ color: t.color }}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{background:t.color}}/>{tr(t.name)}<strong className="block text-slate-700">{whole(t.value!)} {tr(unit)}</strong></span>)}</div>
    <p className="mt-2 text-slate-500">{tr('Diterbitkan {date}. Garis putus-putus adalah prakiraan, bukan pengukuran langsung.', { date: date(gauge.forecastIssuedTime) })}</p>
  </div>;
}

interface AreaControlsProps {
  showFlashAreas: boolean; onShowFlashAreas: (v: boolean) => void;
  showRiverAreas: boolean; onShowRiverAreas: (v: boolean) => void;
}
function AreaControls({ data, showFlashAreas, onShowFlashAreas, showRiverAreas, onShowRiverAreas }: AreaControlsProps & { data: FloodSnapshot | null }) {
  const { t } = useI18n();
  return <div className="space-y-2 rounded-xl bg-slate-50 p-3">
    <ToggleRow icon={<Droplets className="h-4 w-4"/>} label={t('Area banjir bandang')} hint={t('Prakiraan aktif dari Google')} checked={showFlashAreas} onChange={onShowFlashAreas}/>
    <div className="flex flex-wrap gap-3 text-xs"><span className="text-amber-700">{t('■ Mungkin')}</span><span className="text-red-600">{t('■ Sangat mungkin')}</span></div>
    <ToggleRow icon={<Waves className="h-4 w-4"/>} label={t('Area sungai terpilih')} hint={t('Genangan dan area peringatan')} checked={showRiverAreas} onChange={onShowRiverAreas}/>
    <p className="text-xs text-slate-500">{t('Biru: genangan (tingkat mengikuti model probabilitas/kedalaman). Ungu: area peringatan, bukan batas DAS.')}</p>
    {data?.areaState !== 'ready' && <p role="status" className="text-xs text-amber-700">{data?.areaState === 'partial' ? t('Sebagian area belum dapat dimuat.') : t('Data area belum tersedia. Titik dan grafik sungai tetap dapat digunakan.')}</p>}
    {data?.areaState === 'ready' && !data.areas?.some(a => Date.parse(a.start) <= Date.now() && Date.now() < Date.parse(a.end)) && <p className="text-xs text-slate-500">{t('Tidak ada polygon prakiraan aktif pada snapshot ini; bukan berarti bebas risiko banjir.')}</p>}
  </div>;
}

interface FloodMapControlsProps {
  mapType: 'roadmap' | 'hybrid' | 'terrain';
  onMapType: (type: 'roadmap' | 'hybrid' | 'terrain') => void;
  googleAvailable: boolean;
}
function FloodMapControls({ mapType, onMapType, googleAvailable }: FloodMapControlsProps) {
  const { t } = useI18n();
  return <div className="space-y-2">
    <div role="group" aria-label={t('Mode Google Maps')} className="flex rounded-full border border-slate-300 p-1">
      {([{ id: 'roadmap', label: 'Peta' }, { id: 'hybrid', label: 'Hybrid' }] as const).map(mode => <button key={mode.id} type="button" disabled={!googleAvailable} aria-pressed={googleAvailable && mapType === mode.id} onClick={() => onMapType(mode.id)} className={`min-h-11 flex-1 rounded-full text-sm font-semibold disabled:opacity-50 ${googleAvailable && mapType === mode.id ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-50'}`}>{t(mode.label)}</button>)}
    </div>
    {!googleAvailable && <p className="text-xs text-slate-500">{t('Google Maps tidak tersedia. Menggunakan peta cadangan; mode Hybrid belum dapat dipilih.')}</p>}
  </div>;
}

function FloodOptions({ data, state, showNormal, onShowNormal, refresh, onClose, mapControls }: {
  data: FloodSnapshot | null; state: string; showNormal: boolean; onShowNormal: (value: boolean) => void; refresh: () => void; onClose: () => void; mapControls: React.ReactNode;
}) {
  const { t } = useI18n();
  const count = (level: string) => state === 'ready' ? data?.gauges.filter(g => currentSeverity(g) === level).length ?? 0 : '—';
  return <aside aria-label={t('Opsi lapisan banjir')} className="flood-panel">
    <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-3">
      <h3 className="flex items-center gap-2 font-semibold"><Layers3 className="h-5 w-5"/>{t('Lihat opsi')} <Info className="h-4 w-4 text-slate-400"/></h3>
      <button type="button" onClick={onClose} aria-label={t('Tutup opsi banjir')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"><X className="h-5 w-5"/></button>
    </div>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 text-sm">
      {mapControls}
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between font-medium">{t('Data banjir')} <Info className="h-4 w-4 text-slate-400"/></div>
        {Object.entries(floodLevels).map(([level, item]) => <div key={level} className="flex items-center gap-2 py-1"><span className="h-3 w-3 rounded-full" style={{background:item.color}}/>{t(item.label)}<span className="ml-auto text-xs text-slate-500">{count(level)}</span></div>)}
      </div>
      <ToggleRow icon={<Radio className="h-4 w-4"/>} label={t('Tampilkan titik normal')} hint={t('Stasiun tanpa peringatan')} checked={showNormal} onChange={onShowNormal}/>
      <div className="border-t pt-3 text-xs text-slate-500"><p>{t('Snapshot: {date}', { date: date(data?.generatedAt) })}</p><button onClick={refresh} disabled={state === 'loading'} className="mt-2 flex items-center gap-1 text-blue-600 disabled:opacity-50"><RefreshCw className="h-3 w-3"/>{t('Muat ulang data')}</button></div>
    </div>
  </aside>;
}

function ToggleRow({ icon, label, hint, checked, onChange }: { icon: React.ReactNode; label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-slate-200 px-1 py-3"><span className="flex items-center gap-2"><span className="text-slate-500">{icon}</span><span><strong className="block font-medium">{label}</strong>{hint && <small className="text-xs text-slate-500">{hint}</small>}</span></span><input type="checkbox" className="h-5 w-5 shrink-0 accent-blue-600" checked={checked} onChange={event => onChange(event.target.checked)} /></label>;
}

export function FloodPanel({ data, state, selected, onSelect, showNormal, onShowNormal, refresh, mapType, onMapType, googleAvailable, showFlashAreas, onShowFlashAreas, showRiverAreas, onShowRiverAreas }: {
  data: FloodSnapshot | null; state: string; selected: FloodGauge | null;
  onSelect: (id: string | null) => void; showNormal: boolean; onShowNormal: (v: boolean) => void; refresh: () => void;
} & FloodMapControlsProps & AreaControlsProps) {
  const { t, locale } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const mapControls = <><FloodMapControls mapType={mapType} onMapType={onMapType} googleAvailable={googleAvailable}/><AreaControls data={data} showFlashAreas={showFlashAreas} onShowFlashAreas={onShowFlashAreas} showRiverAreas={showRiverAreas} onShowRiverAreas={onShowRiverAreas}/></>;
  const current = selected ? currentFloodForecast(selected, now) : null;
  const unit = selected?.unit === 'METERS' ? 'm' : selected?.unit === 'CUBIC_METERS_PER_SECOND' ? 'm³/dtk' : null;
  useEffect(() => { if (selected) setCollapsed(false); }, [selected?.id]);
  const stale = data && Date.now() - Date.parse(data.generatedAt) > 24 * 3600000;
  const close = () => { onSelect(null); setCollapsed(true); };
  if (collapsed) return <button type="button" onClick={() => setCollapsed(false)} className="flood-panel-reopen"><Waves className="h-4 w-4"/>{t('Buka panel banjir')}</button>;
  if (!selected) return <FloodOptions data={data} state={state} showNormal={showNormal} onShowNormal={onShowNormal} refresh={refresh} onClose={close} mapControls={mapControls}/>;
  return <section aria-label={t('Prakiraan banjir sungai')} className="flood-panel">
    <div className="flex shrink-0 items-center justify-between p-3 border-b border-slate-100">
      <h3 className="flex items-center gap-2 font-semibold text-sm min-h-8"><MapPinned className="w-5 h-5 text-emerald-600"/>{t('Prakiraan sungai')} <Info className="h-4 w-4 shrink-0 text-slate-400"/></h3>
      <button type="button" aria-label={t('Tutup panel banjir')} onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"><X className="w-5 h-5"/></button>
    </div>
    <div className="min-h-0 flex-1 p-4 space-y-3 text-xs overflow-y-auto overscroll-contain">
      {mapControls}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3" role="status">
        <p className="font-medium text-slate-600">{t('{kind} · prakiraan saat ini', { kind: unit === 'm' ? t('Tinggi air') : unit ? t('Debit air') : t('Nilai sungai') })}</p>
        <p className="mt-1 text-2xl font-bold text-blue-800">{current && unit ? `${current.value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${t(unit)}` : t('Belum tersedia')}</p>
        {current && <p className="mt-1 text-slate-600">{t('Berlaku {start} – {end}', { start: date(current.time), end: date(current.endTime) })}</p>}
        <p className="mt-1 text-slate-500">{t('Prakiraan model, bukan pengukuran langsung.')}{unit === 'm³/dtk' ? t(' Data tinggi air dalam meter tidak disediakan untuk titik ini.') : ''}</p>
      </div>
      {state === 'loading' && <p role="status">{t('Memuat prakiraan banjir…')}</p>}
      {state === 'unavailable' && <p role="status">{t('Data prakiraan belum tersedia. Silakan coba lagi nanti.')}</p>}
      {stale && <p className="text-amber-800 bg-amber-50 p-2 rounded-lg">{t('Pembaruan data lebih dari 24 jam lalu. Periksa waktu berlaku setiap prakiraan.')}</p>}
      <>
        <button onClick={() => onSelect(null)} className="flex items-center gap-1 text-blue-600 py-2"><ArrowLeft className="w-4 h-4"/>{t('Semua titik pantau')}</button>
        <h3 className="text-lg font-bold break-words">{selected.name}</h3>
        <p className="font-semibold" style={{color: floodLevels[currentSeverity(selected)].color}}>{t(floodLevels[currentSeverity(selected)].label)} · {selected.river || t('Nama sungai belum tersedia')}</p>
        <ForecastChart gauge={selected} now={now}/>
        <dl className="grid grid-cols-2 gap-3 border-t pt-3">
          <div><dt className="text-slate-500">{t('ID pengukur')}</dt><dd className="break-all">{selected.id}</dd></div>
          <div><dt className="text-slate-500">{t('Sumber')}</dt><dd>{selected.source || t('Tidak tersedia')}</dd></div>
          <div><dt className="text-slate-500">{t('Sungai')}</dt><dd>{selected.river || t('Tidak tersedia')}</dd></div>
          <div><dt className="text-slate-500">{t('Koordinat')}</dt><dd>{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}</dd></div>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <span className="text-slate-500">{t('Ukuran daerah aliran sungai (km²)')}</span>
          <strong>{Number.isFinite(selected.basinAreaKm2) ? whole(selected.basinAreaKm2!) : t('Belum tersedia')}</strong>
        </div>
        <p>{selected.qualityVerified ? t('Model terverifikasi kualitas') : t('Model belum terverifikasi kualitas')}</p>
        <p>{t('Status diterbitkan {date}', { date: date(selected.issuedTime) })}<br/>{t('Berlaku sampai {date}', { date: date(selected.validUntil) })}</p>
        <a className="text-blue-600 underline" href={`https://sites.research.google/floods/l/${selected.lat}/${selected.lng}/8/g/${encodeURIComponent(selected.id)}`} target="_blank" rel="noreferrer">{t('Lihat di Flood Hub ↗')}</a>
      </>
      <div className="border-t pt-3 space-y-2 text-slate-500"><p>{t('Snapshot: {date}', { date: date(data?.generatedAt) })}</p><button onClick={refresh} disabled={state === 'loading'} className="flex gap-1 items-center text-blue-600 py-1 disabled:opacity-50"><RefreshCw className="w-3 h-3"/>{t('Muat ulang data')}</button><p>{t('Data:')} <a className="underline" href="https://sites.research.google/floods/" target="_blank" rel="noreferrer">Google Flood Forecasting</a> · CC BY 4.0</p><p>{t('Cakupan titik sungai tidak mewakili semua banjir lokal atau banjir bandang.')}</p></div>
    </div>
    </section>;
}
