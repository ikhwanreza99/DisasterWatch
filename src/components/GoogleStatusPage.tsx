import React, { useEffect, useState } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { Activity, ArrowLeft, RefreshCw, ArrowUpRight, CheckCircle2, AlertCircle, Clock3 } from 'lucide-react';
import { initialChecks, probeBrowserCheck } from '../services/status/browserChecks';
import { stale, stateLabels, statusAdvice, type ServiceCheck, type StatusSnapshot } from '../services/status/model';

const colors: Record<ServiceCheck['state'], string> = {
  ok: 'bg-emerald-50 text-emerald-700', empty: 'bg-sky-50 text-sky-700', error: 'bg-rose-50 text-rose-700',
  configured: 'bg-amber-50 text-amber-700', disabled: 'bg-slate-100 text-slate-600', unknown: 'bg-slate-100 text-slate-600', checking: 'bg-blue-50 text-blue-700',
};
function date(value: string | null) { return value ? new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB' : 'Belum diperiksa'; }
export default function GoogleStatusPage() {
  const [checks, setChecks] = useState(initialChecks);
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [mapsTest, setMapsTest] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [recheck, setRecheck] = useState(0);
  const update = (result: ServiceCheck) => setChecks(current => current.map(c => c.id === result.id ? result : c));
  useEffect(() => {
    const controller = new AbortController();
    setSnapshotError('');
    fetch('/data/google-status.json', { cache: 'no-store', signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (data.version !== 1 || !Array.isArray(data.services)) throw new Error();
      setSnapshot(data);
    }).catch(() => { if (!controller.signal.aborted) setSnapshotError('Laporan backend belum tersedia atau gagal dimuat. Jalankan workflow Deploy untuk menerbitkannya.'); });
    return () => controller.abort();
  }, [recheck]);
  useEffect(() => {
    const fail = () => update({ ...initialChecks()[0], state: 'error', checkedAt: new Date().toISOString(), detail: 'Google Maps menolak autentikasi. Periksa API aktif, referrer domain, billing, dan kuota.' });
    window.addEventListener('gmp-auth-failure', fail);
    return () => window.removeEventListener('gmp-auth-failure', fail);
  }, []);
  useEffect(() => {
    if (!mapsTest || mapsLoaded) return;
    const timer = window.setTimeout(() => setChecks(current => current.map(c => c.id === 'maps' && c.state === 'checking' ? { ...c, state: 'error', checkedAt: new Date().toISOString(), detail: 'Peta belum berhasil memuat dalam 20 detik.' } : c)), 20_000);
    return () => window.clearTimeout(timer);
  }, [mapsTest, mapsLoaded]);
  async function test(id: string) {
    if (running) return;
    if (id === 'maps') { setMapAttempt(v => v + 1); setMapsTest(false); setMapsLoaded(false); update({ ...initialChecks()[0], state: 'checking', detail: 'Memuat peta Google...', checkedAt: null }); setMapsTest(true); return; }
    setRunning(id);
    update({ ...initialChecks().find(c => c.id === id)!, state: 'checking', detail: 'Mengirim pemeriksaan API...', checkedAt: null });
    const result = await probeBrowserCheck(id, true);
    update(result); setRunning(null);
  }
  useEffect(() => {
    let mounted = true;
    const configured = initialChecks().filter(c => c.state === 'configured');
    if (configured.some(c => c.id === 'maps')) {
      update({ ...initialChecks()[0], state: 'checking', detail: 'Memuat peta Google...', checkedAt: null });
      setMapsTest(true);
    }
    for (const check of configured.filter(c => !['maps', 'storage'].includes(c.id))) {
      update({ ...check, state: 'checking', detail: 'Pemeriksaan otomatis sedang berjalan...', checkedAt: null });
      probeBrowserCheck(check.id).then(result => { if (mounted) update(result); });
    }
    return () => { mounted = false; };
  }, []);
  const backend = snapshot ? [...snapshot.services, ...(snapshot.searchProbe ? [snapshot.searchProbe] : [{ id: 'google-search-probe', name: 'Google Search · uji langsung', state: 'unknown' as const, scope: 'backend' as const, detail: 'Belum ada uji langsung. Run workflow Deploy dengan opsi “Uji Google Search” aktif.', checkedAt: null }])] : [];
  const all = [...checks, ...backend];
  const ok = all.filter(c => c.state === 'ok' && !stale(c)).length;
  const failures = all.filter(c => c.state === 'error').length;
  function table(rows: ServiceCheck[], browser = false) { return <div className="divide-y divide-slate-100">{rows.map(c => <article key={c.id} className="grid gap-3 px-5 py-5 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_auto] sm:items-start">
    <div><h3 className="font-semibold text-slate-900 text-sm">{c.name}</h3><p className="mt-1 text-xs text-slate-400">{c.scope === 'browser' ? 'Browser ini' : c.scope === 'backend' ? 'GitHub Actions / server' : 'Snapshot produksi'}</p></div>
    <div><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[c.state]}`}>{stateLabels[c.state]}</span>{stale(c) && <span className="ml-2 text-[11px] text-amber-700">Hasil lebih dari 24 jam</span>}<p className="mt-2 text-xs leading-relaxed text-slate-600 break-words">{c.detail}</p>{statusAdvice(c) && <p className="mt-2 text-xs leading-relaxed text-amber-700">{statusAdvice(c)}</p>}<p className="mt-2 text-[11px] text-slate-400">{date(c.checkedAt)}</p></div>
    {browser && <button onClick={() => test(c.id)} disabled={!!running || c.state === 'checking' || c.state === 'disabled' || c.id === 'storage'} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">{running === c.id || c.state === 'checking' ? 'Memeriksa...' : c.id === 'maps' ? 'Uji ulang Maps' : c.id === 'storage' ? 'Perlu lampiran' : 'Uji ulang'}</button>}
  </article>)}</div>; }
  return <div className="min-h-screen bg-[#f8fafb] text-slate-900">
    <header className="border-b border-slate-200/70 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><a href="/" className="flex items-center gap-2 font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white"><Activity size={18}/></span>DisasterWatch<span className="hidden sm:inline text-xs font-normal text-slate-400 ml-2">Service status</span></a><a href="/" className="flex items-center gap-2 text-xs text-slate-500"><ArrowLeft size={14}/>Kembali ke peta</a></div></header>
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-600">DisasterWatch · Google services</p><h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Status layanan aplikasi</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">Periksa layanan Google yang dipakai web ini. Konfigurasi tersedia, request berhasil, dan data tampil adalah tiga hasil yang berbeda.</p></div><button onClick={() => setRecheck(v => v+1)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600"><RefreshCw size={14}/>Muat ulang laporan</button></div>
      <div className="my-7 grid grid-cols-1 gap-3 sm:grid-cols-3">{[[CheckCircle2, `${ok} berhasil diuji`, 'Bukti request atau snapshot valid'], [AlertCircle, `${failures} gagal`, 'Periksa detail layanan'], [Clock3, 'Tidak otomatis berarti live', 'Uji backend dan browser terpisah']].map(([Icon,title,caption]) => { const I = Icon as typeof Activity; return <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-5"><I size={18} className="text-blue-600"/><p className="mt-3 text-base font-semibold">{String(title)}</p><p className="mt-1 text-xs text-slate-400">{String(caption)}</p></div>; })}</div>
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Pemeriksaan browser</h2><p className="mt-1 text-xs text-slate-500">Origin: {window.location.origin}. Diuji otomatis saat halaman dibuka. Hasil request dipakai ulang selama 10 menit di tab ini; tidak memakai data simulasi.</p></div>{table(checks, true)}{mapsTest && <div className="mx-5 mb-5 h-44 overflow-hidden rounded-xl border border-slate-200"><APIProvider key={mapAttempt} apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} onError={() => update({ ...initialChecks()[0], state: 'error', checkedAt: new Date().toISOString(), detail: 'Maps JavaScript gagal dimuat.' })}><Map defaultCenter={{lat:-6.2,lng:106.8}} defaultZoom={9} disableDefaultUI onTilesLoaded={() => { setMapsLoaded(true); setChecks(current => current.map(c => c.id === 'maps' && c.state !== 'error' ? {...c, state:'ok', checkedAt:new Date().toISOString(), detail:'Peta dan tile Google berhasil dirender di origin ini.'} : c)); }}/></APIProvider></div>}</section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Backend & pipeline data</h2><p className="mt-1 text-xs text-slate-500">Laporan build: {date(snapshot?.generatedAt || null)} · revisi {snapshot?.revision || 'belum tersedia'}. Muat ulang halaman tidak menjalankan crawler.</p></div>{snapshotError && <p role="status" className="p-5 text-sm text-amber-700">{snapshotError}</p>}{table(backend)}</section>
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500"><a className="inline-flex items-center gap-1 hover:text-blue-600" href="https://github.com/ikhwanreza99/DisasterWatch/actions/workflows/deploy-hosting.yml" target="_blank" rel="noreferrer">Workflow status & deploy<ArrowUpRight size={13}/></a><a className="inline-flex items-center gap-1 hover:text-blue-600" href="https://github.com/ikhwanreza99/DisasterWatch/actions/workflows/incident-crawl.yml" target="_blank" rel="noreferrer">Workflow crawler<ArrowUpRight size={13}/></a><a className="inline-flex items-center gap-1 hover:text-blue-600" href="https://aistudio.google.com/status" target="_blank" rel="noreferrer">Status global Google AI<ArrowUpRight size={13}/></a></div>
      <p className="mt-5 text-[11px] leading-relaxed text-slate-400">Halaman ini menunjukkan pemeriksaan aplikasi, bukan status global Google. Secret backend tidak dikirim ke browser. Storage menunggu penggunaan lampiran; login OAuth sampai selesai membutuhkan pengguna. Google Analytics belum diimplementasikan di aplikasi ini.</p>
    </main>
  </div>;
}
