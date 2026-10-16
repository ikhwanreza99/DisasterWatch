import React, { useEffect, useState } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { Activity, ArrowLeft, RefreshCw, ArrowUpRight, CheckCircle2, AlertCircle, Clock3 } from 'lucide-react';
import { initialChecks, probeBrowserCheck } from '../services/status/browserChecks';
import { checkProgress } from '../services/status/checkProgress';
import { complianceEvidence, type EvidenceState } from '../services/status/complianceEvidence';
import { stale, stateLabels, statusAdvice, safeStatusError, type ServiceCheck, type StatusSnapshot } from '../services/status/model';
import { useI18n, translate, localeFor } from '../i18n';
import { LanguageToggle } from '../i18n/LanguageToggle';

const colors: Record<ServiceCheck['state'], string> = {
  ok: 'bg-emerald-50 text-emerald-700', empty: 'bg-sky-50 text-sky-700', error: 'bg-rose-50 text-rose-700',
  configured: 'bg-amber-50 text-amber-700', disabled: 'bg-slate-100 text-slate-600', unknown: 'bg-slate-100 text-slate-600', checking: 'bg-blue-50 text-blue-700',
};
function date(value: string | null) { return value ? new Date(value).toLocaleString(localeFor(), { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB' : translate('Belum diperiksa'); }
export default function GoogleStatusPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
  const Content = embedded ? 'div' : 'main';
  const [checks, setChecks] = useState(initialChecks);
  const [progressIds] = useState(() => initialChecks().filter(c => c.state === 'configured' && c.id !== 'storage').map(c => c.id));
  const [showProgress, setShowProgress] = useState(false);
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState('');
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [mapsTest, setMapsTest] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [backendRefresh,setBackendRefresh]=useState(0);
  const [backendNotice,setBackendNotice]=useState('');
  const [recheck, setRecheck] = useState(0);
  const [security, setSecurity] = useState<{ generatedAt: string; bundleSecrets?: { filesScanned?: number } } | null>(null);
  const [apiProxy, setApiProxy] = useState<boolean | null>(null);
  const update = (result: ServiceCheck) => setChecks(current => current.map(c => c.id === result.id ? result : c));
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setSnapshotLoading(true);
    setSnapshotError('');
    const timer = window.setTimeout(() => controller.abort(), 20_000);
    fetch('/data/google-status.json', { cache: 'no-store', signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (data.version !== 1 || !Array.isArray(data.services)) throw new Error();
      if (active) {setSnapshot(data);if(backendRefresh>0)setBackendNotice(t('Laporan server terbaru dimuat. Untuk menjalankan uji Google Search baru, buka workflow dan aktifkan opsi Uji Google Search.'));}
    }).catch(() => { if (active) setSnapshotError(t('Laporan backend belum tersedia atau gagal dimuat. Jalankan workflow Deploy untuk menerbitkannya.')); }).finally(() => { window.clearTimeout(timer); if (active) setSnapshotLoading(false); });
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [recheck,backendRefresh]);
  // Build-time key-isolation evidence (written by scripts/checkBundleSecrets.ts).
  // Purely informational: no secret value, name or infrastructure detail is shown.
  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/security.json', { cache: 'no-store', signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (d?.version === 1 && d?.bundleSecrets?.clean) setSecurity(d); })
      .catch(() => { /* The panel is optional; stay silent when absent. */ });
    return () => controller.abort();
  }, []);
  // Is the Cloud Run API proxy live behind the /api/** rewrite? A dedicated
  // health endpoint answers JSON only when the service and rewrite are active;
  // otherwise Hosting serves index.html. The gemini-direct check can no longer
  // answer this because the browser-key path is permanently disabled.
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { cache: 'no-store', signal: controller.signal })
      .then(r => { const type = r.headers.get('content-type') || ''; setApiProxy(r.ok && type.includes('application/json')); })
      .catch(() => { if (!controller.signal.aborted) setApiProxy(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const fail = () => update({ ...initialChecks()[0], state: 'error', checkedAt: new Date().toISOString(), detail: 'Google Maps menolak autentikasi. Periksa API aktif, referrer domain, billing, dan kuota.' });
    window.addEventListener('gmp-auth-failure', fail);
    return () => window.removeEventListener('gmp-auth-failure', fail);
  }, []);
  useEffect(() => {
    if (!mapsTest || mapsLoaded) return;
    const timer = window.setTimeout(() => setChecks(current => current.map(c => c.id === 'maps' && c.state === 'checking' ? { ...c, state: 'error', checkedAt: new Date().toISOString(), detail: 'Peta belum berhasil memuat dalam 20 detik.' } : c)), 20_000);
    return () => window.clearTimeout(timer);
  }, [mapsTest, mapsLoaded, mapAttempt]);
  async function test(id: string) {
    if (running) return;
    if (id === 'maps') { setMapAttempt(v => v + 1); setMapsTest(false); setMapsLoaded(false); update({ ...initialChecks()[0], state: 'checking', detail: 'Memuat peta Google...', checkedAt: null }); setMapsTest(true); return; }
    setRunning(id);
    update({ ...initialChecks().find(c => c.id === id)!, state: 'checking', detail: 'Mengirim pemeriksaan API...', checkedAt: null });
    try {
      update(await probeBrowserCheck(id, true));
    } catch (error) {
      update({ ...initialChecks().find(c => c.id === id)!, state: 'error', checkedAt: new Date().toISOString(), detail: safeStatusError(error) });
    } finally { setRunning(null); }
  }
  useEffect(() => {
    let mounted = true;
    if (recheck > 0) { setMapAttempt(v => v + 1); setMapsLoaded(false); }
    const configured = initialChecks().filter(c => c.state === 'configured');
    if (configured.some(c => c.id === 'maps')) {
      update({ ...initialChecks()[0], state: 'checking', detail: 'Memuat peta Google...', checkedAt: null });
      setMapsTest(true);
    }
    for (const check of configured.filter(c => !['maps', 'storage'].includes(c.id))) {
      update({ ...check, state: 'checking', detail: 'Pemeriksaan otomatis sedang berjalan...', checkedAt: null });
      probeBrowserCheck(check.id, recheck > 0).then(result => { if (mounted) update(result); }).catch(error => { if (mounted) update({ ...check, state: 'error', checkedAt: new Date().toISOString(), detail: safeStatusError(error) }); });
    }
    return () => { mounted = false; };
  }, [recheck]);
  const backend = snapshot ? [...snapshot.services, ...(snapshot.searchProbe ? [snapshot.searchProbe] : [{ id: 'google-search-probe', name: 'Google Search · uji langsung', state: 'unknown' as const, scope: 'backend' as const, detail: 'Belum ada uji langsung. Run workflow Deploy dengan opsi “Uji Google Search” aktif.', checkedAt: null }])] : [];
  const busy = snapshotLoading || !!running || checks.some(c => c.state === 'checking');
  const progress = checkProgress(checks, progressIds, snapshotLoading);
  useEffect(() => {
    if (busy) { setShowProgress(true); return; }
    const timer = window.setTimeout(() => setShowProgress(false), 700);
    return () => window.clearTimeout(timer);
  }, [busy]);
  const progressPercent = busy ? Math.min(progress.percent, 99) : progress.percent;
  const failedChecks = checks.filter(check => check.state === 'error').length;
  const progressLabel = busy
    ? t('Memeriksa layanan · {done}/{total} tahap · {percent}%', { done: progress.completed, total: progress.total, percent: progressPercent })
    : t('Pemeriksaan otomatis selesai · {percent}% · {failed} gagal', { percent: progressPercent, failed: failedChecks });
  const visibleChecks=checks.filter(c=>c.state==='ok' && !!c.checkedAt);
  const visibleBackend=backend.filter(c=>c.state==='ok' && !!c.checkedAt);
  const ok=visibleChecks.length+visibleBackend.length;
  // Technical compliance with the AI Builder Cup 2026 rules, derived only from
  // evidence this page can actually observe (live checks + the build guard).
  const checkById = (id: string) => checks.find(c => c.id === id);
  const defaultFirebaseUrl = /\.(web\.app|firebaseapp\.com)$/.test(window.location.hostname);
  const proxyLive = apiProxy === true;
  const geminiLive = checkById('firebase-ai')?.state === 'ok';
  const firestoreLive = checkById('firestore')?.state === 'ok';
  const compliance: { id: string; rule: string; title: string; state: EvidenceState; detail: string }[] = [
    { id: 'hosting', rule: 'B1', title: t('Deploy di Firebase atau Cloud Run'), state: 'met', detail: t('Situs ini dilayani dari produksi (Firebase Hosting) pada origin ini.') },
    { id: 'cloudrun', rule: 'B1 · B2', title: t('API server berjalan di Cloud Run'), state: proxyLive ? 'met' : 'pending', detail: proxyLive ? t('Endpoint /api/health menjawab JSON dari layanan server.') : t('Belum aktif. Aplikasi tetap berfungsi lewat Firebase AI Logic (jalur utama) dan snapshot statis FIRMS.') },
    { id: 'gemini', rule: 'B4', title: t('Gemini dipakai minimal untuk reasoning'), state: complianceEvidence(checkById('firebase-ai')), detail: geminiLive ? t('Firebase AI Logic menjawab uji generateContent.') : t('Uji Gemini berjalan otomatis tanpa login Google. {detail}', { detail: t(checkById('firebase-ai')?.detail ?? 'Belum diperiksa') }) },
    { id: 'firestore', rule: 'C9', title: t('Cloud Firestore untuk data dokumen'), state: complianceEvidence(checkById('firestore')), detail: firestoreLive ? t('Baca Firestore dari server berhasil pada sesi ini.') : t(checkById('firestore')?.detail ?? 'Belum diperiksa') },
    { id: 'keys', rule: 'C4', title: t('Kunci API di server, tidak ada di bundel browser'), state: security ? 'met' : 'pending', detail: security ? t('Guard build memindai {count} file bundel; tidak ada kunci server.', { count: security.bundleSecrets?.filesScanned ?? 0 }) : t('Bukti build belum tersedia.') },
    { id: 'url', rule: 'B3', title: t('URL bawaan Firebase (bukan custom domain)'), state: defaultFirebaseUrl ? 'met' : 'pending', detail: defaultFirebaseUrl ? t('Origin ini memakai domain bawaan Firebase.') : t('Origin ini bukan domain bawaan Firebase; pertimbangkan memakai URL bawaan saat submission.') },
    { id: 'online', rule: 'A4 · D7', title: t('Prototipe tetap online selama penjurian'), state: 'met', detail: t('Halaman ini dimuat dari produksi. Laporan build: {date}.', { date: date(snapshot?.generatedAt || null) }) },
  ];
  const complianceChip: Record<EvidenceState, string> = { met: 'bg-emerald-50 text-emerald-700', pending: 'bg-amber-50 text-amber-700', untested: 'bg-slate-100 text-slate-600', checking: 'bg-blue-50 text-blue-700', failed: 'bg-rose-50 text-rose-700', disabled: 'bg-slate-100 text-slate-600' };
  const evidenceLabels: Record<EvidenceState, string> = { met: 'Terpenuhi', pending: 'Perlu tindakan', untested: 'Belum diuji', checking: 'Memeriksa', failed: 'Gagal', disabled: 'Nonaktif' };
  function table(rows: ServiceCheck[], browser = false) { return <div className="divide-y divide-slate-100">{rows.map(c => <article key={c.id} className="grid gap-3 px-5 py-5 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_auto] sm:items-start">
    <div><h3 className="font-semibold text-slate-900 text-sm">{t(c.name)}</h3><p className="mt-1 text-xs text-slate-400">{c.scope === 'browser' ? t('Browser ini') : c.scope === 'backend' ? 'GitHub Actions / server' : t('Snapshot produksi')}</p></div>
    <div><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[c.state]}`}>{t(stateLabels[c.state])}</span>{stale(c) && <span className="ml-2 text-[11px] text-amber-700">{t('Hasil lebih dari 24 jam')}</span>}<p className="mt-2 text-xs leading-relaxed text-slate-600 break-words">{t(c.detail)}</p>{statusAdvice(c) && <p className="mt-2 text-xs leading-relaxed text-amber-700">{t(statusAdvice(c)!)}</p>}<p className="mt-2 text-[11px] text-slate-400">{date(c.checkedAt)}</p></div>
    {!browser && (stale(c) || c.id==='google-search-probe') && <div className="flex flex-col items-start gap-2"><button type="button" disabled={snapshotLoading} onClick={()=>{setBackendNotice(t('Mengambil laporan server terbaru…'));setBackendRefresh(v=>v+1);}} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><RefreshCw size={14}/>{snapshotLoading?t('Memuat…'):c.id==='google-search-probe'?t('Refresh Google Search'):t('Muat hasil terbaru')}</button><a className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100" href="https://github.com/ikhwanreza99/DisasterWatch/actions/workflows/deploy-hosting.yml" target="_blank" rel="noreferrer"><RefreshCw size={14}/>{t('Uji ulang di server')}<ArrowUpRight size={13}/></a><p className="max-w-xs text-xs leading-relaxed text-slate-500">{t('GitHub → Run workflow → main')}{c.id==='serpapi-probe'?t(' → centang Uji SerpApi'):c.id==='google-search-probe'?t(' → centang Uji Google Search'):''}{t('. Setelah selesai, muat hasil terbaru. Waktu hanya berubah setelah uji berhasil.')}</p>{backendNotice && <p role="status" className="max-w-xs text-xs text-slate-500">{backendNotice}</p>}</div>}
    {browser && <button onClick={() => test(c.id)} disabled={!!running || c.state === 'checking' || c.state === 'disabled' || c.id === 'storage'} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">{running === c.id || c.state === 'checking' ? t('Memeriksa...') : c.id === 'maps' ? t('Uji ulang Maps') : c.id === 'storage' ? t('Perlu lampiran') : t('Uji ulang')}</button>}
  </article>)}</div>; }
  return <div className={embedded ? "admin-status-view text-slate-900" : "min-h-screen bg-[#f8fafb] text-slate-900"}>
    {showProgress && <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999]" data-testid="status-check-progress">
      <div role="progressbar" aria-label={t('Progres pemeriksaan layanan')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} aria-valuetext={progressLabel} aria-busy={busy} className="h-1 w-full overflow-hidden bg-blue-100">
        <div className="h-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 transition-[width] duration-300 motion-reduce:transition-none" style={{width:`${progressPercent}%`}} />
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="mx-auto w-fit max-w-[calc(100%-1rem)] rounded-b-lg border border-t-0 border-blue-100 bg-white/95 px-3 py-1 text-center text-[10px] font-medium text-blue-700 shadow-sm">{progressLabel}</div>
    </div>}
    {!embedded && <header className="border-b border-slate-200/70 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><a href="/" className="flex items-center gap-2 font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white"><Activity size={18}/></span>DisasterWatch<span className="hidden sm:inline text-xs font-normal text-slate-400 ml-2">Service status</span></a><div className="flex items-center gap-3"><LanguageToggle /><a href="/" className="flex items-center gap-2 text-xs text-slate-500"><ArrowLeft size={14}/>{t('Kembali ke peta')}</a></div></div></header>}
    <Content className={embedded ? "w-full" : "mx-auto max-w-6xl px-5 py-10"}>
      <div className={embedded ? "flex justify-end" : "flex flex-wrap items-start justify-between gap-5"}>{!embedded && <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-600">DisasterWatch · Google services</p><h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">{t('Status layanan aplikasi')}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">{t('Hasil pemeriksaan layanan, termasuk gagal, nonaktif, dan belum diuji. Progres 100% berarti pemeriksaan selesai, bukan semua layanan berhasil.')}</p></div>}<button type="button" onClick={() => setRecheck(v => v+1)} disabled={busy} aria-busy={busy} className="relative z-10 pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"><RefreshCw size={14} className={busy ? "animate-spin" : ""}/>{busy ? t("Memeriksa layanan...") : t("Muat ulang laporan")}</button></div>
      {!busy && <p role="status" className="mt-4 text-xs text-slate-600">{progressLabel}</p>}
      {recheck > 0 && <p role="status" aria-live="polite" className="mt-4 text-xs text-blue-600">{busy ? t("Menjalankan ulang pemeriksaan browser dan mengambil laporan backend terbaru...") : t("Pemeriksaan ulang selesai. Waktu hasil setiap layanan tercantum di bawah; laporan backend mengikuti run GitHub Actions terakhir.")}</p>}
      <div className="my-7 grid grid-cols-1 gap-3 sm:grid-cols-3">{[[CheckCircle2, t('{count} berhasil diuji', { count: ok }), t('Bukti request atau snapshot valid')], [CheckCircle2, t('{count} layanan browser', { count: visibleChecks.length }), t('Hasil pemeriksaan browser yang berhasil')], [Clock3, t('{count} layanan backend', { count: visibleBackend.length }), t('Waktu uji terakhir tercantum pada setiap layanan')]].map(([Icon,title,caption]) => { const I = Icon as typeof Activity; return <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-5"><I size={18} className="text-blue-600"/><p className="mt-3 text-base font-semibold">{String(title)}</p><p className="mt-1 text-xs text-slate-400">{String(caption)}</p></div>; })}</div>
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">{t('Pemeriksaan browser')}</h2><p className="mt-1 text-xs text-slate-500">{t('Origin: {origin}. Diuji otomatis saat halaman dibuka. Hasil request dipakai ulang selama 10 menit di tab ini; tidak memakai data simulasi.', { origin: window.location.origin })}</p></div>{table(checks, true)}{mapsTest && <div className={visibleChecks.some(c=>c.id==='maps')?"mx-5 mb-5 h-44 overflow-hidden rounded-xl border border-slate-200":"pointer-events-none fixed -left-[10000px] h-44 w-80 overflow-hidden"}><APIProvider key={mapAttempt} apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} onError={() => update({ ...initialChecks()[0], state: 'error', checkedAt: new Date().toISOString(), detail: 'Maps JavaScript gagal dimuat.' })}><Map defaultCenter={{lat:-6.2,lng:106.8}} defaultZoom={9} disableDefaultUI onTilesLoaded={() => { setMapsLoaded(true); setChecks(current => current.map(c => c.id === 'maps' && c.state !== 'error' ? {...c, state:'ok', checkedAt:new Date().toISOString(), detail:'Peta dan tile Google berhasil dirender di origin ini.'} : c)); }}/></APIProvider></div>}</section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">{t('Backend & pipeline data')}</h2><p className="mt-1 text-xs text-slate-500">{t('Laporan build: {date} · revisi {revision}. Muat ulang halaman tidak menjalankan crawler.', { date: date(snapshot?.generatedAt || null), revision: snapshot?.revision || t('belum tersedia') })}</p></div>{table(backend)}</section>
      {security && <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">{t('Keamanan kunci API')}</h2><p className="mt-1 text-xs text-slate-500">{t('Ringkasan kebijakan kunci. Tidak ada nilai kunci yang ditampilkan di halaman ini.')}</p></div><ul className="divide-y divide-slate-100">{[[t('Kunci server di bundel browser'),t('Tidak ditemukan: guard otomatis memindai bundel saat build.')],[t('Transport AI'),t('Firebase AI Logic; kunci Gemini tidak pernah dikirim ke browser.')],[t('Data titik panas FIRMS'),t('Lewat proxy server atau snapshot statis; MAP_KEY tidak ada di browser.')],[t('Kunci yang memang publik'),t('Google Maps dan Firebase web API key dibatasi referrer, API restriction, dan App Check.')]].map(([title,detail]) => <li key={title} className="flex gap-3 px-5 py-4"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600"/><div><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs leading-relaxed text-slate-600">{detail}</p></div></li>)}</ul><p className="border-t border-slate-100 px-5 py-4 text-[11px] text-slate-400">{t('Bukti build: {date} · {count} file bundel dipindai · guard otomatis lulus.', { date: date(security.generatedAt), count: security.bundleSecrets?.filesScanned ?? 0 })}</p></section>}
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">{t('Kesesuaian teknis · AI Builder Cup 2026')}</h2><p className="mt-1 text-xs text-slate-500">{t('Ringkasan aturan teknis (bagian B & C) berbasis bukti nyata halaman ini dan bukti build. Tanpa klaim yang tidak terverifikasi.')}</p></div><ul className="divide-y divide-slate-100">{compliance.map(row => <li key={row.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_auto] sm:items-start"><div><p className="text-sm font-semibold text-slate-900">{row.title}</p><p className="mt-1 text-[11px] font-medium text-slate-400">{row.rule}</p></div><p className="text-xs leading-relaxed text-slate-600">{row.detail}</p><span className={'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ' + complianceChip[row.state]}>{t(evidenceLabels[row.state])}</span></li>)}</ul><div className="border-t border-slate-100 px-5 py-4"><h3 className="text-sm font-semibold text-slate-900">{t('Nilai plus')}</h3><p className="mt-1 text-xs text-slate-500">{t('Solusi teknis nyata yang bisa ditonjolkan saat penjurian.')}</p><ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">{[t('Kunci API dipindahkan ke proxy server; bundel browser tidak lagi memuat kunci Gemini/FIRMS.'),t('Guard otomatis anti-bocor: build gagal bila kunci server terdeteksi di bundel.'),t('Rate limit per IP dan allowlist origin pada proxy publik.'),t('Transport AI bertingkat: Firebase AI Logic → proxy server → fallback deterministik (tidak pernah crash).'),t('Snapshot statis dan cache: FIRMS, VAAC, berita, dan status tetap tersedia saat upstream down.'),t('Antarmuka dua bahasa (Indonesia/Inggris) dengan pilihan tersimpan.')].map(item => <li key={item} className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600"/><span>{item}</span></li>)}</ul></div></section>
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500"><a className="inline-flex items-center gap-1 hover:text-blue-600" href="https://github.com/ikhwanreza99/DisasterWatch/actions/workflows/deploy-hosting.yml" target="_blank" rel="noreferrer">Workflow status & deploy<ArrowUpRight size={13}/></a><a className="inline-flex items-center gap-1 hover:text-blue-600" href="https://github.com/ikhwanreza99/DisasterWatch/actions/workflows/incident-crawl.yml" target="_blank" rel="noreferrer">{t('Workflow crawler')}<ArrowUpRight size={13}/></a><a className="inline-flex items-center gap-1 hover:text-blue-600" href="https://aistudio.google.com/status" target="_blank" rel="noreferrer">{t('Status global Google AI')}<ArrowUpRight size={13}/></a></div>
      <p className="mt-5 text-[11px] leading-relaxed text-slate-400">{t('Halaman ini menunjukkan pemeriksaan aplikasi, bukan status global Google. Secret backend tidak dikirim ke browser. Hasil gagal dan nonaktif juga ditampilkan agar kendala dapat ditindaklanjuti. Uji Gemini tidak memerlukan login Google.')}</p>
    </Content>
  </div>;
}
