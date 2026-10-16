// /calculation — Calculation Verification Center.
// Follows GoogleStatusPage (/status) styling and layout conventions.
// Evidence-driven: every check executes the real engine via the registry;
// this page never re-implements formulas and never invents PASS results.
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, CheckCircle2, XCircle, MinusCircle, HelpCircle, Ban, Database } from 'lucide-react';
import { useI18n, localeFor } from '../i18n';
import { LanguageToggle } from '../i18n/LanguageToggle';
import {
  MODULE_LABELS,
  runCalculationVerification,
  type CheckModule,
  type CheckOutcome,
  type CheckStatus,
} from '../services/verification/calculationRegistry';
import { loadHumanitarian, type RemoteSnapshot } from '../services/store/humanitarianRepo';

const chip: Record<CheckStatus, string> = {
  PASS: 'bg-emerald-50 text-emerald-700',
  FAIL: 'bg-rose-50 text-rose-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  NOT_VERIFIED: 'bg-slate-100 text-slate-600',
  NOT_IMPLEMENTED: 'bg-slate-100 text-slate-600',
  INSUFFICIENT_DATA: 'bg-sky-50 text-sky-700',
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  PASS: 'Lolos',
  FAIL: 'Gagal',
  PARTIAL: 'Sebagian',
  NOT_VERIFIED: 'Belum diverifikasi',
  NOT_IMPLEMENTED: 'Belum diimplementasikan',
  INSUFFICIENT_DATA: 'Data kurang',
};

const MODULES: CheckModule[] = ['loss', 'recovery-gap', 'utility-recovery', 'needs-intelligence', 'validation-provenance', 'integration'];

function fmtDate(value: string | null, locale: string) {
  return value ? new Date(value).toLocaleString(locale, { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB' : '—';
}

function CheckRow({ check }: { check: CheckOutcome }) {
  const { t, locale } = useI18n();
  const e = check.evidence;
  return (
    <details className="px-5 py-4" data-testid={`calc-check-${check.id}`}>
      <summary className="grid cursor-pointer gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_auto] sm:items-start">
        <div>
          <p className="text-sm font-semibold text-slate-900">{check.title}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">{check.id} · {check.method === 'code-test' ? t('uji kode') : check.method === 'synthetic-integration' ? t('integrasi sintetis') : t('baca-live')}</p>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">{check.what}</p>
        <span className="flex flex-wrap items-start gap-1.5">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${chip[check.status]}`}>{t(STATUS_LABEL[check.status])}</span>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${check.kind === 'simulasi' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>
            {check.kind === 'simulasi' ? t('Simulasi — bukan data resmi') : t('Live — read-only')}
          </span>
        </span>
      </summary>
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        <p><b className="text-slate-800">Formula:</b> <span className="font-mono text-[11px]">{e.formula}</span></p>
        <p className="mt-1"><b className="text-slate-800">Input uji:</b> <span className="font-mono text-[11px]">{e.inputs}</span></p>
        <p className="mt-1"><b className="text-slate-800">Ekspektasi:</b> {e.expected} · <b className="text-slate-800">Aktual:</b> {e.actual} · <b className="text-slate-800">Selisih:</b> {e.difference}</p>
        {e.warnings.length > 0 && <p className="mt-1 text-amber-700"><b>Peringatan validasi:</b> {e.warnings.join(' | ')}</p>}
        <p className="mt-1 break-words"><b className="text-slate-800">Trace:</b> <span className="font-mono text-[11px]">{e.trace || '—'}</span></p>
        <p className="mt-1"><b className="text-slate-800">Provenans:</b> {e.provenance}</p>
        <p className="mt-1 text-[11px] text-slate-400">Versi {e.version} · Diperiksa {fmtDate(check.checkedAt, locale)} · Invarian: {check.invariant}</p>
      </div>
    </details>
  );
}

export default function CalculationVerificationPage({ embedded = false }: { embedded?: boolean }) {
  const { t, locale } = useI18n();
  const Content = embedded ? 'div' : 'main';
  // Deterministic run: executes the real engine now; the timestamp below is
  // the actual run time, not a stored claim.
  const report = useMemo(() => runCalculationVerification(), []);
  const [live, setLive] = useState<RemoteSnapshot | null>(null);
  const [liveAt, setLiveAt] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    // Read-only probe of one incident via the existing repository layer.
    // No writes; failure yields NOT VERIFIED, never invented numbers.
    loadHumanitarian('padang').then((s) => {
      if (!active) return;
      setLive(s);
      setLiveAt(new Date().toISOString());
    });
    return () => { active = false; };
  }, []);
  const s = report.summary;
  const cards = [
    { icon: CheckCircle2, value: `${s.PASS}/${s.total}`, caption: t('Lolos verifikasi') },
    { icon: XCircle, value: `${s.FAIL}`, caption: t('Gagal — perlu perbaikan') },
    { icon: MinusCircle, value: `${s.PARTIAL}`, caption: t('Sebagian terverifikasi') },
    { icon: HelpCircle, value: `${s.NOT_VERIFIED}`, caption: t('Belum diverifikasi (butuh sesi live)') },
    { icon: Ban, value: `${s.NOT_IMPLEMENTED}`, caption: t('Belum diimplementasikan') },
    { icon: Database, value: `${s.INSUFFICIENT_DATA}`, caption: t('Data kurang') },
  ];
  const liveCounts = live ? live.needs.length + live.recovery.length + live.claims.length + live.aidEvents.length + live.articles.length : null;
  return (
    <div className={embedded ? 'admin-status-view text-slate-900' : 'min-h-screen bg-[#f8fafb] text-slate-900'} data-testid="calculation-page">
      {!embedded && (
        <header className="border-b border-slate-200/70 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
            <a href="/" className="flex items-center gap-2 font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white"><Activity size={18} /></span>
              DisasterWatch<span className="ml-2 hidden text-xs font-normal text-slate-400 sm:inline">Calculation Verification Center</span>
            </a>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <a href="/" className="flex items-center gap-2 text-xs text-slate-500"><ArrowLeft size={14} />{t('Kembali ke peta')}</a>
            </div>
          </div>
        </header>
      )}
      <Content className={embedded ? 'w-full' : 'mx-auto max-w-6xl px-5 py-10'}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-600">DisasterWatch · Calculation Engine</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('Verifikasi Perhitungan')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
            {t('Setiap cek mengeksekusi fungsi perhitungan asli dan membandingkan aktual vs ekspektasi. Status tidak pernah diberikan hanya karena fungsi atau komponen ada. Contoh berlabel simulasi; bukan data resmi.')}
          </p>
        </div>
        <div className="my-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map(({ icon: Icon, value, caption }) => (
            <div key={caption} className="rounded-2xl border border-slate-200 bg-white p-5">
              <Icon size={18} className="text-blue-600" />
              <p className="mt-3 text-base font-semibold">{value}</p>
              <p className="mt-1 text-xs text-slate-400">{caption}</p>
            </div>
          ))}
        </div>
        {MODULES.map((m) => {
          const checks = report.outcomes.filter((o) => o.module === m);
          const pass = checks.filter((o) => o.status === 'PASS').length;
          return (
            <section key={m} className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid={`calc-module-${m}`}>
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold">{t(MODULE_LABELS[m])}</h2>
                <p className="mt-1 text-xs text-slate-500">{t('{pass} dari {total} cek lolos', { pass, total: checks.length })}</p>
              </div>
              <div className="divide-y divide-slate-100">
                {checks.map((c) => <CheckRow key={c.id} check={c} />)}
              </div>
            </section>
          );
        })}
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">{t('Provenans & versi')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('Sumber kebenaran tunggal dan versi formula yang diverifikasi.')}</p>
          </div>
          <ul className="divide-y divide-slate-100 text-xs leading-relaxed text-slate-600">
            <li className="px-5 py-3">Engine: <span className="font-mono">{report.engineVersion}</span> · Prioritas: <span className="font-mono">{report.priorityVersion}</span> · Registry: <span className="font-mono">{report.registryVersion}</span> — <span className="font-mono">src/services/insights/formulas.ts</span></li>
            <li className="px-5 py-3">Adapter Firestore: <span className="font-mono">src/services/insights/calculationInputs.ts</span> (summariseLiveInputs — null dipertahankan, EVENT distribusi bukan stok)</li>
            <li className="px-5 py-3">UI terintegrasi: <span className="font-mono">InsightCalculator</span> pada kartu “Kesenjangan Bantuan” di kedua template detail · tier kebutuhan memakai <span className="font-mono">NeedStatus/VerificationStatus</span> yang ada</li>
            <li className="px-5 py-3">Waktu run pengujian ini: {fmtDate(report.generatedAt, localeFor())} (waktu eksekusi aktual halaman ini, bukan klaim tersimpan)</li>
          </ul>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="calc-live">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">{t('Probe live read-only (Firestore)')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('Baca saja untuk insiden padang via repository yang ada. Tanpa tulis produksi.')}</p>
          </div>
          <div className="px-5 py-4 text-xs leading-relaxed text-slate-600">
            {!live && <p>{t('Memeriksa akses baca…')}</p>}
            {live && live.mode === 'live' && (
              <p><span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{t('Live — read-only')}</span>
                <span className="ml-2">{liveCounts} dokumen humaniter terbaca · needs {live.needs.length} · recovery {live.recovery.length} · claims {live.claims.length} · aidEvents {live.aidEvents.length} · {live.notice}</span>
                <span className="mt-1 block text-[11px] text-slate-400">{t('Diperiksa {at}', { at: fmtDate(liveAt, locale) })}</span></p>
            )}
            {live && live.mode !== 'live' && (
              <p><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{t('Belum diverifikasi')}</span>
                <span className="ml-2">{live.notice} {t('Registry live tetap NOT_VERIFIED; tidak ada angka yang diinventarisasi.')}</span>
                <span className="mt-1 block text-[11px] text-slate-400">{t('Diperiksa {at}', { at: fmtDate(liveAt, locale) })}</span></p>
            )}
          </div>
        </section>
        <p className="mt-5 text-[11px] leading-relaxed text-slate-400">
          {t('Halaman internal untuk verifikasi implementasi. Bukan klaim kesiapan produksi. Cek live membutuhkan sesi browser dengan akses Firestore; selebihnya halaman ini deterministik dan dapat diuji ulang.')}
        </p>
      </Content>
    </div>
  );
}
