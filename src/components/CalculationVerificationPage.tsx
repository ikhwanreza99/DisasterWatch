// /calculation — Calculation Verification Center.
// Follows GoogleStatusPage (/status) styling and layout conventions.
// Evidence-driven: every check executes the real engine via the registry or
// the shared calculation service; this page never re-implements formulas,
// never invents PASS results, and never labels synthetic output as live.
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, CheckCircle2, XCircle, MinusCircle, HelpCircle, Ban, Database, FlaskConical, Radio } from 'lucide-react';
import { useI18n, localeFor } from '../i18n';
import { LanguageToggle } from '../i18n/LanguageToggle';
import {
  MODULE_LABELS,
  runCalculationVerification,
  type CheckModule,
  type CheckOutcome,
  type CheckStatus,
} from '../services/verification/calculationRegistry';
import {
  metricLabel,
  runCalculation,
  type ServiceMetric,
  type ServiceResponse,
} from '../services/calculations/calculationService';
import {
  assessLiveReadiness,
  readinessCounts,
  type LiveReadiness,
} from '../services/calculations/liveAdapter';
import { buildClaimFactGroups } from '../services/calculations/liveClaimGroups';
import { adaptUtilityInputs } from '../services/calculations/liveAdapter';
import {
  buildMetricStatuses,
  summariseMetricStatuses,
  nextActionFor,
  METRIC_MODULE,
  type LiveRunSummary,
  type MetricStatusRow,
} from '../services/verification/metricStatus';
import {
  DATA_REQUIREMENTS,
  REQUIREMENT_KINDS,
  assessMetricReadiness,
  auditRequirements,
  metricsWithRequirements,
  type AuditScope,
  type CalculationReadiness,
  type FieldAvailability,
} from '../services/verification/requirementsInventory';
import type { ExtendedResultStatus } from '../services/insights/formulas';
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

const EXTENDED_LABEL: Record<ExtendedResultStatus, string> = {
  calculated: 'Dihitung',
  scenario_estimate: 'Estimasi skenario',
  forecast: 'Prakiraan',
  insufficient_data: 'Data kurang',
  invalid_input: 'Input tidak valid',
  conflict_pending_review: 'Konflik — perlu telaah',
  stale_data: 'Data basi',
};

const READINESS_CHIP: Record<LiveReadiness, string> = {
  READY: 'bg-emerald-50 text-emerald-700',
  BLOCKED: 'bg-amber-50 text-amber-700',
  NOT_AVAILABLE: 'bg-slate-100 text-slate-600',
};

const READINESS_LABEL: Record<LiveReadiness, string> = {
  READY: 'Siap dihitung',
  BLOCKED: 'Terhambat',
  NOT_AVAILABLE: 'Tidak tersedia',
};

const AVAIL_CHIP: Record<FieldAvailability, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  MISSING: 'bg-rose-50 text-rose-700',
  INVALID: 'bg-rose-50 text-rose-700',
  STALE: 'bg-orange-50 text-orange-700',
  CONFLICT: 'bg-purple-50 text-purple-700',
  NOT_CHECKED: 'bg-slate-100 text-slate-600',
  NOT_APPLICABLE: 'bg-slate-100 text-slate-400',
};

const AVAIL_LABEL: Record<FieldAvailability, string> = {
  AVAILABLE: 'Tersedia',
  PARTIAL: 'Sebagian',
  MISSING: 'Hilang',
  INVALID: 'Tidak valid',
  STALE: 'Basi',
  CONFLICT: 'Konflik',
  NOT_CHECKED: 'Belum diperiksa',
  NOT_APPLICABLE: 'Tidak berlaku',
};

const CALC_READINESS_LABEL: Record<CalculationReadiness, string> = {
  READY: 'Siap dihitung',
  BLOCKED: 'Terhambat',
  NOT_AVAILABLE: 'Tidak tersedia',
};

const EXPLORER_FILTER_LABEL: Record<string, string> = {
  ALL: 'Semua metrik',
  CALCULATED: 'Terhitung',
  BLOCKED: 'Terhambat',
  CONFLICTS: 'Konflik',
  NOT_IMPLEMENTED: 'Belum diimplementasikan',
  SYNTHETIC: 'Verifikasi sintetis',
};

function OverviewStat({ value, caption }: { value: string; caption: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </div>
  );
}

function SummaryCard({ icon: Icon, value, label, sub, testId }: { icon: React.ElementType; value: string; label: string; sub: string; testId: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid={testId}>
      <Icon size={18} className="text-blue-600" />
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function KeyResultCard({ result }: { result: KeyResult }) {
  const { t, locale } = useI18n();
  const chipClass = result.source === 'live'
    ? 'bg-blue-50 text-blue-700'
    : result.source === 'synthetic' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500';
  const chipText = result.source === 'live'
    ? t('Live — read-only')
    : result.source === 'synthetic' ? t('Demonstrasi sintetis') : t('Data kurang');
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid={`key-result-${result.metric}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{result.label}</p>
        <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${chipClass}`}>{chipText}</span>
      </div>
      {result.value === null ? (
        <p className="mt-3 text-lg font-semibold text-slate-400">{t('Data kurang')}</p>
      ) : (
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          {result.value.toLocaleString(locale, { maximumFractionDigits: 2 })}
          {result.unit ? <span className="ml-1 text-sm font-normal text-slate-400">{result.unit}</span> : null}
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{result.explanation}</p>
    </div>
  );
}

/** Production engine function behind each proof (no reimplementation). */
const PROOF_FN: Record<string, string> = {
  physical_damage: 'estimatePhysicalDamage',
  utility_recovery: 'estimateUtilityRecovery',
  ori_index: 'estimateOriIndex',
  needs_current_gap: 'estimateCurrentGap',
  needs_forecast_gap: 'estimateForecastGap',
  damage_aggregate: 'estimateDamageAggregate',
  reconcile_facts: 'reconcileFacts',
};

/** Judge-facing key results: at most three, in priority order. */
const KEY_RESULT_METRICS: ServiceMetric[] = ['physical_damage', 'utility_recovery', 'ori_index'];

/** One short, non-technical explanation per key result metric. */
const KEY_RESULT_EXPLANATION: Partial<Record<ServiceMetric, string>> = {
  physical_damage: 'Kerusakan aset × biaya penggantian × tingkat keparahan.',
  utility_recovery: 'Unit pulih ÷ unit terdampak untuk satu layanan.',
  ori_index: 'Gabungan berbobot empat pemulihan layanan.',
};

interface KeyResult {
  metric: ServiceMetric;
  label: string;
  value: number | null;
  unit: string | null;
  source: 'live' | 'synthetic' | 'unavailable';
  explanation: string;
}

interface ProofCase {
  key: string;
  title: string;
  request: Parameters<typeof runCalculation>[0];
  expected: number | null;
}

const ORI_COMPONENTS = [
  { service: 'water', affected: 200, recovered: 40, unit: 'households', area: 'simulasi', period: '3 hari', operationalDefinition: 'aliran pipa pulih', temporaryRestoration: false },
  { service: 'electricity', affected: 400, recovered: 300, unit: 'customers', area: 'simulasi', period: '3 hari', operationalDefinition: 'meter bertegangan', temporaryRestoration: false },
  { service: 'access', affected: 5, recovered: 2, unit: 'km', area: 'simulasi', period: '3 hari', operationalDefinition: 'km dapat dilalui', temporaryRestoration: false },
  { service: 'telecom', affected: 600, recovered: 480, unit: 'customers', area: 'simulasi', period: '3 hari', operationalDefinition: 'sinyal pulih', temporaryRestoration: false },
] as const;

function buildProofs(): Array<{ proof: ProofCase; response: ServiceResponse }> {
  const cases: ProofCase[] = [
    {
      key: 'ori_index', title: 'ORI: 20/75/40/80 → 50,75',
      request: { metric: 'ori_index', mode: 'scenario', origin: 'simulation', calculationId: 'proof-ori', input: { components: [...ORI_COMPONENTS] } },
      expected: 50.75,
    },
    {
      key: 'physical_damage', title: 'Kerusakan fisik: 5 × 150 jt × 0,5 = 375 jt',
      request: {
        metric: 'physical_damage', origin: 'simulation', calculationId: 'proof-physical-damage',
        input: { assetCount: 5, replacementCostPerAsset: 150_000_000, damageFraction: 0.5, currency: 'IDR', area: 'simulasi', period: '3 hari', sourceRefs: ['verifikasi:damage-ref'] },
      },
      expected: 375_000_000,
    },
    {
      key: 'utility_recovery', title: 'Pemulihan air: 40/200 → 20%',
      request: {
        metric: 'utility_recovery', mode: 'current', origin: 'simulation', calculationId: 'proof-utility-water',
        input: { service: 'water', affected: 200, recovered: 40, area: 'simulasi', period: '3 hari', operationalDefinition: 'definisi-verifikasi' },
      },
      expected: 20,
    },
    {
      key: 'needs_current_gap', title: 'Current gap: 500 × 2 − 400 = 600',
      request: { metric: 'needs_current_gap', mode: 'current', origin: 'simulation', calculationId: 'proof-curgap', input: { populationNeeding: 500, ratePerPerson: 2, usableSupply: 400, unit: 'portions', commodity: 'meal portions' } },
      expected: 600,
    },
    {
      key: 'needs_current_gap_floor', title: 'Current gap floor: 100 × 1 − 150 = 0',
      request: { metric: 'needs_current_gap', mode: 'current', origin: 'simulation', calculationId: 'proof-curgap-floor', input: { populationNeeding: 100, ratePerPerson: 1, usableSupply: 150, unit: 'portions' } },
      expected: 0,
    },
    {
      key: 'damage_aggregate', title: 'Agregat: 375 jt + 500 jt = 875 jt',
      request: {
        metric: 'damage_aggregate', mode: 'scenario', origin: 'simulation', calculationId: 'proof-dmgagg',
        input: {
          categories: [
            { categoryId: 'houses', assetCount: 5, assetUnit: 'house', replacementCostPerAsset: 150_000_000, currency: 'IDR', damageFraction: 0.5, area: 'simulasi', period: '3 hari', assessmentScope: 'rapid-a' },
            { categoryId: 'schools', assetCount: 2, assetUnit: 'building', replacementCostPerAsset: 500_000_000, currency: 'IDR', damageFraction: 50, damageFractionUnit: 'percent', area: 'simulasi', period: '3 hari', assessmentScope: 'rapid-a' },
          ],
        },
      },
      expected: 875_000_000,
    },
    {
      key: 'reconcile_parent', title: 'Parent 400 + subset 250+150 → 400',
      request: {
        metric: 'reconcile_facts', mode: 'current', origin: 'simulation', calculationId: 'proof-recon',
        input: {
          unit: 'packages',
          facts: [
            { factId: 'f-total', value: 400, unit: 'packages', relation: 'total', sourceRefs: ['s0'] },
            { factId: 'f-a', value: 250, unit: 'packages', relation: 'subset', parentFactId: 'f-total', sourceRefs: ['s1'] },
            { factId: 'f-b', value: 150, unit: 'packages', relation: 'subset', parentFactId: 'f-total', sourceRefs: ['s2'] },
          ],
        },
      },
      expected: 400,
    },
    {
      key: 'forecast_gap', title: 'Forecast: 6048 + 0 − 0 − 0 = 6048',
      request: {
        metric: 'needs_forecast_gap', mode: 'forecast', origin: 'simulation', calculationId: 'proof-forecast',
        input: { demand: 6048, additionalBacklog: 0, usableStock: 0, expectedIncoming: 0, unit: 'portions' },
      },
      expected: 6048,
    },
    {
      key: 'reconcile_disjoint', title: 'Disjoint 367+250+55 → 672',
      request: {
        metric: 'reconcile_facts', mode: 'current', origin: 'simulation', calculationId: 'proof-disjoint',
        input: {
          unit: 'people', disjointGroupsConfirmed: true,
          facts: [
            { factId: 'g1', value: 367, unit: 'people', relation: 'independent', groupKey: 'A', sourceRefs: ['s1'] },
            { factId: 'g2', value: 250, unit: 'people', relation: 'independent', groupKey: 'B', sourceRefs: ['s2'] },
            { factId: 'g3', value: 55, unit: 'people', relation: 'independent', groupKey: 'C', sourceRefs: ['s3'] },
          ],
        },
      },
      expected: 672,
    },
  ];
  return cases.map((proof) => ({ proof, response: runCalculation(proof.request) }));
}

function SvcProofRow({ proof, response }: { proof: ProofCase; response: ServiceResponse }) {
  const { t, locale } = useI18n();
  const r = response.result;
  const pass = r.value === proof.expected;
  const num = (v: number | null) => (v === null ? t('Belum tersedia') : v.toLocaleString(locale, { maximumFractionDigits: 2 }));
  return (
    <details className="px-5 py-4" data-testid={`svc-proof-${proof.key}`}>
      <summary className="grid cursor-pointer gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_auto] sm:items-start">
        <div>
          <p className="text-sm font-semibold text-slate-900">{proof.title}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">{PROOF_FN[response.metric] ?? response.metric} · {r.metricId ?? '—'} · {r.id ?? '—'}</p>
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-slate-600 break-words">{r.trace || '—'}</p>
        <span className="flex flex-wrap items-start gap-1.5">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${pass ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {pass ? t('Lolos') : t('Gagal')}
          </span>
          <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">{t('Simulasi — bukan data resmi')}</span>
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{t(EXTENDED_LABEL[response.extendedStatus])}</span>
        </span>
      </summary>
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        <p><b className="text-slate-800">Rantai bukti:</b> fakta input → validasi/kesiapan ({t(EXTENDED_LABEL[response.extendedStatus])}) → {PROOF_FN[response.metric] ?? response.metric}(…) → trace → hasil aktual</p>
        <p className="mt-1"><b className="text-slate-800">Aktual:</b> {num(r.value)}{r.unit ? ` ${r.unit}` : ''} · <b className="text-slate-800">Ekspektasi:</b> {num(proof.expected)} · <b className="text-slate-800">Status engine:</b> {r.status}</p>
        <p className="mt-1"><b className="text-slate-800">Scope:</b> {r.scope.area ?? '—'} / {r.scope.period ?? '—'} · <b className="text-slate-800">Cakupan:</b> {r.coverage ?? '—'} · <b className="text-slate-800">Ketidakpastian:</b> {r.uncertainty ?? '—'}</p>
        <p className="mt-1"><b className="text-slate-800">Baseline:</b> {r.baselineIds.length > 0 ? r.baselineIds.join(', ') : '— (registri baseline belum ada)'} · <b className="text-slate-800">Fakta sumber:</b> {r.sourceFactIds.length > 0 ? r.sourceFactIds.join(', ') : '— (skenario sintetis)'} · <b className="text-slate-800">Input hilang:</b> {r.missingInputs.length > 0 ? r.missingInputs.join(', ') : '—'}</p>
        <p className="mt-1"><b className="text-slate-800">Insiden:</b> {r.incidentId ?? '— (skenario tanpa insiden)'} · <b className="text-slate-800">Valid time:</b> {r.validTime ?? '—'} · <b className="text-slate-800">Dihitung:</b> {fmtDate(r.calculatedAt, locale)}</p>
        {r.warnings.length > 0 && <p className="mt-1 text-amber-700"><b>Peringatan:</b> {r.warnings.join(' | ')}</p>}
        {r.errors.length > 0 && <p className="mt-1 text-rose-700"><b>Galat:</b> {r.errors.join(' | ')}</p>}
        <p className="mt-1 text-[11px] text-slate-400">Metode {r.version} · output kontrak {t('dihasilkan layanan calculationService.runCalculation dari fungsi produksi, bukan nilai tampilan')}</p>
      </div>
    </details>
  );
}

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

function MetricExplorerRow({ row }: { row: MetricStatusRow }) {
  const { t, locale } = useI18n();
  const required = DATA_REQUIREMENTS.filter((r) => r.metric_id === row.metric && r.required_or_optional === 'required');
  const primary = row.tests[0];
  const num = (v: number | null | undefined) => (v === null || v === undefined ? t('Belum tersedia') : v.toLocaleString(locale, { maximumFractionDigits: 2 }));
  const blockerCount = (row.readiness?.missingFields.length ?? 0) + (row.live?.missingInputs.length ?? 0);
  const liveChip = row.live
    ? row.live.value !== null
      ? 'bg-emerald-50 text-emerald-700'
      : row.live.status === 'invalid_input' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
    : 'bg-slate-100 text-slate-500';
  const readinessChip = row.readiness?.readiness === 'READY' ? 'bg-emerald-50 text-emerald-700'
    : row.readiness?.readiness === 'BLOCKED' ? 'bg-amber-50 text-amber-700'
      : row.readiness?.readiness === 'NOT_AVAILABLE' ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-500';
  const readinessLabel = row.readiness ? t(READINESS_LABEL[row.readiness.readiness]) : t('Belum diperiksa');
  return (
    <details className="px-5 py-4" data-testid={`metric-explorer-${row.metric}`}>
      <summary className="grid cursor-pointer gap-3 sm:grid-cols-[minmax(160px,1.3fr)_minmax(200px,2fr)_auto] sm:items-start">
        <div>
          <p className="text-sm font-semibold text-slate-900">{row.label}</p>
          <p className="mt-1 text-xs text-slate-500">{row.description}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">{row.metric} · {t('modul')}: {row.module}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.implemented ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {row.implemented ? t('Formula terimplementasi') : t('Belum diimplementasikan')}
          </span>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.tested ? 'bg-emerald-50 text-emerald-700' : row.testTotal > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
            {row.testTotal > 0 ? `${t('Uji')} ${row.testPass}/${row.testTotal}` : t('Tanpa uji')}
          </span>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${readinessChip}`}>{readinessLabel}</span>
          {row.live && (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${liveChip}`}>{t(EXTENDED_LABEL[row.live.status])}</span>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">
            {row.live ? `${num(row.live.value)}${row.live.unit ? ` ${row.live.unit}` : ''}` : '—'}
          </p>
          <p className="text-[11px] text-slate-400">{row.live ? t('hasil live') : t('tanpa hasil live')}</p>
          <p className="text-[11px] text-slate-400">{t('pemblokir')}: {blockerCount}</p>
        </div>
      </summary>
      <div className="mt-3 grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        <p><b className="text-slate-800">{t('Formula (implementasi aktual):')}</b> <span className="font-mono text-[11px]">{primary?.evidence.formula ?? '—'}</span></p>
        <p><b className="text-slate-800">{t('Fungsi produksi:')}</b> <span className="font-mono text-[11px]">{PROOF_FN[row.metric] ?? row.metric}</span> · <b className="text-slate-800">{t('Versi')}:</b> {primary?.evidence.version ?? '—'} · <a href={`#mod-${row.module}`} className="font-semibold text-blue-600 hover:underline">{t('Lihat bukti verifikasi')}</a></p>
        <p><b className="text-slate-800">{t('Input wajib:')}</b> {required.length > 0 ? required.map((r) => `${r.data_item}${r.expected_unit ? ` (${r.expected_unit})` : ''}`).join(' · ') : '—'}</p>
        <p><b className="text-slate-800">{t('Diterima live:')}</b> {row.readiness && row.readiness.availableFields.length > 0 ? row.readiness.availableFields.join(' · ') : t('Belum tersedia')}</p>
        <p className="text-amber-700"><b>{t('Hilang/tidak valid:')}</b> {row.readiness && row.readiness.missingFields.length > 0 ? row.readiness.missingFields.join(' · ') : '—'}</p>
        <div><b className="text-slate-800">{t('Hasil validasi/uji sintetis:')}</b>
          <ul className="mt-1 space-y-0.5">
            {row.tests.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-1.5">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${chip[c.status]}`}>{t(STATUS_LABEL[c.status])}</span>
                <span className="font-mono text-[10px] text-slate-500">{c.id}</span>
                <span className="text-[10px] text-slate-500">{c.title} · {t('ekspektasi')} {c.evidence.expected} / {t('aktual')} {c.evidence.actual}</span>
              </li>
            ))}
          </ul>
        </div>
        <p><b className="text-slate-800">{t('Hasil terbaru:')}</b> {row.live
          ? <>{row.live.value === null ? t('Ditahan') : `${num(row.live.value)}${row.live.unit ? ` ${row.live.unit}` : ''}`} · {t(EXTENDED_LABEL[row.live.status])} · {row.live.detail}</>
          : t('Belum ada eksekusi live untuk metrik ini pada insiden terpilih.')}</p>
        {row.live && row.live.trace && <p><b className="text-slate-800">{t('Trace:')}</b> <span className="font-mono text-[11px] break-words">{row.live.trace}</span></p>}
        {row.readiness?.note && <p><b className="text-slate-800">{t('Alasan ditahan:')}</b> {row.readiness.note}</p>}
        <p><b className="text-slate-800">{t('Provenans/ketidakpastian:')}</b> {primary?.evidence.provenance ?? '—'}{primary?.evidence.warnings && primary.evidence.warnings.length > 0 ? ` · ${primary.evidence.warnings.join(' | ')}` : ''}</p>
        <p><b className="text-slate-800">{t('Sumber & waktu:')}</b> {row.live?.source ?? '—'} · {t('Dihitung')} {fmtDate(row.live?.calculatedAt ?? null, locale)}</p>
        <p className="text-blue-700"><b>{t('Tindakan berikutnya:')}</b> {nextActionFor(row)}</p>
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
  // Service execution proof: the shared service invoking the REAL production
  // functions on labeled synthetic fixtures (P0 goldens). Rendered values come
  // from runCalculation return values — never prefilled display numbers.
  const proofs = useMemo(() => buildProofs(), []);
  const proofPass = proofs.filter(({ proof, response }) => response.result.value === proof.expected).length;
  const [incidentId, setIncidentId] = useState('padang');
  const [live, setLive] = useState<RemoteSnapshot | null>(null);
  const [liveAt, setLiveAt] = useState<string | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  const [filterMetric, setFilterMetric] = useState<string>('ALL');
  const [filterAvail, setFilterAvail] = useState<string>('ALL');
  const [explorerFilter, setExplorerFilter] = useState<string>('ALL');
  const [explorerQuery, setExplorerQuery] = useState('');
  useEffect(() => {
    let active = true;
    // Read-only probe via the existing authorized repository layer.
    // No writes; failure yields NOT VERIFIED, never invented numbers.
    loadHumanitarian(incidentId).then((s) => {
      if (!active) return;
      setLive(s);
      setLiveAt(new Date().toISOString());
    });
    return () => { active = false; };
  }, [incidentId, auditTick]);
  // Database availability audit for the SELECTED incident. Built from the
  // same bounded snapshot as the live probe above (per-incident limits
  // 50–200; incidents list limit 50) — conclusions are scoped to what was
  // actually read, never to the whole database. No writes, no new queries.
  const audit = useMemo(() => {
    if (!live || live.mode !== 'live') return null;
    const docsOf = (arr: Array<{ id: string }>) =>
      arr.filter((d) => d && d.id).map((d) => ({ id: (d as { id: string }).id, data: { ...(d as unknown as Record<string, unknown>) } }));
    const toErrorCategory = (notice: string): string | null => {
      if (/belum dikonfigurasi/i.test(notice)) return 'unconfigured';
      if (/gagal memuat/i.test(notice)) return 'read-failure';
      return 'unknown';
    };
    const scope: AuditScope = {
      incidentId,
      accessOk: true,
      errorCategory: toErrorCategory(live.notice),
      samples: [
        { collection: 'incidents', limit: 50, incidentScoped: false, docs: docsOf(live.incidents) },
        { collection: 'incidentClaims', limit: 200, incidentScoped: true, docs: docsOf(live.claims) },
        { collection: 'incidentAidNeeds', limit: 100, incidentScoped: true, docs: docsOf(live.needs) },
        { collection: 'incidentAidEvents', limit: 100, incidentScoped: true, docs: docsOf(live.aidEvents) },
        { collection: 'incidentRecovery', limit: 50, incidentScoped: true, docs: docsOf(live.recovery) },
      ],
      auditedAt: liveAt ?? new Date().toISOString(),
    };
    const audits = auditRequirements(DATA_REQUIREMENTS, scope);
    const metrics = metricsWithRequirements().map((metricId) => assessMetricReadiness(metricId, audits));
    return { scope, audits, metrics };
  }, [live, liveAt, incidentId]);
  const auditRan = audit !== null;
  const filteredAudits = useMemo(() => {
    if (!audit) return [];
    const byId = new Map(audit.audits.map((a) => [a.requirement_id, a]));
    return DATA_REQUIREMENTS.filter((r) => {
      if (filterMetric !== 'ALL' && r.metric_id !== filterMetric) return false;
      if (filterAvail !== 'ALL' && byId.get(r.requirement_id)?.status !== filterAvail) return false;
      return true;
    }).map((r) => ({ req: r, audit: byId.get(r.requirement_id)! }));
  }, [audit, filterMetric, filterAvail]);
  const availTally = useMemo(() => {
    const t: Record<FieldAvailability, number> = {
      AVAILABLE: 0, PARTIAL: 0, MISSING: 0, INVALID: 0, STALE: 0, CONFLICT: 0, NOT_CHECKED: 0, NOT_APPLICABLE: 0,
    };
    if (audit) for (const a of audit.audits) t[a.status]++;
    return t;
  }, [audit]);
  const readinessTally = useMemo(() => {
    if (!audit) return { READY: 0, BLOCKED: 0, NOT_AVAILABLE: 0 };
    return {
      READY: audit.metrics.filter((m) => m.readiness === 'READY').length,
      BLOCKED: audit.metrics.filter((m) => m.readiness === 'BLOCKED').length,
      NOT_AVAILABLE: audit.metrics.filter((m) => m.readiness === 'NOT_AVAILABLE').length,
    };
  }, [audit]);
  const readiness = useMemo(
    () => (live && live.mode === 'live' ? assessLiveReadiness(live, incidentId) : null),
    [live, incidentId],
  );
  const readyCounts = readiness ? readinessCounts(readiness) : null;
  // Live execution: quantified claim groups for the SELECTED incident run
  // through the shared calculation service (same runCalculation as synthetic
  // proofs). Only IDs, quantities, units, and publisher names are displayed —
  // never claim text or personal data.
  const liveRuns = useMemo(() => {
    if (!live || live.mode !== 'live') return null;
    return buildClaimFactGroups(incidentId, live.claims).map((g) => ({
      group: g,
      response: runCalculation({
        metric: 'reconcile_facts',
        incidentId,
        mode: 'current',
        origin: 'live',
        calculationId: `live-${incidentId}-${g.groupKey}`,
        input: g.input,
      }),
    }));
  }, [live, incidentId]);
  // Live utility execution: countable recovery observations run through the
  // same service. With current production data this yields zero runs and the
  // exact blocker below — never a fabricated rate.
  const liveUtilityRuns = useMemo(() => {
    if (!live || live.mode !== 'live') return null;
    const adapted = adaptUtilityInputs(incidentId, live.recovery);
    return {
      adapted,
      runs: adapted.readyInputs.map((inp) => ({
        input: inp,
        response: runCalculation({
          metric: 'utility_recovery',
          incidentId,
          mode: 'current',
          origin: 'live',
          calculationId: `live-${incidentId}-utility-${inp.service}`,
          input: {
            service: inp.service, affected: inp.affected, recovered: inp.recovered,
            unit: inp.unit, area: inp.area ?? undefined, period: undefined,
            sourceRefs: [inp.docId], observedAt: null,
            operationalDefinition: inp.criterion,
            temporaryRestoration: null,
          },
        }),
      })),
    };
  }, [live, incidentId]);
  const incidentOptions = useMemo(() => {
    const list = (live?.incidents ?? []).filter((d) => d && d.incidentId);
    const seen = new Map<string, typeof list[number]>();
    for (const d of list) if (!seen.has(d.incidentId)) seen.set(d.incidentId, d);
    return [...seen.values()].slice(0, 50);
  }, [live]);
  // Latest live result per metric, folded from the SAME live runs already
  // executed above — no extra Firestore reads, no fabricated values.
  const liveByMetric = useMemo(() => {
    const summarize = (
      out: Partial<Record<ServiceMetric, LiveRunSummary>>,
      metric: ServiceMetric,
      responses: Array<{ response: ServiceResponse; source: string; detail: string }>,
    ) => {
      if (responses.length === 0) return;
      const withValue = responses.filter(({ response }) => response.result.value !== null);
      const pick = withValue[0] ?? responses[0]!;
      const r = pick.response.result;
      const anyConflict = responses.some(({ response }) => response.extendedStatus === 'conflict_pending_review');
      out[metric] = {
        value: r.value,
        unit: r.unit || null,
        status: pick.response.extendedStatus === 'calculated' && anyConflict ? 'conflict_pending_review' : pick.response.extendedStatus,
        calculatedAt: r.calculatedAt,
        source: pick.source,
        detail: responses.length > 1 ? `${withValue.length}/${responses.length} ${t('grup terhitung')}` : pick.detail,
        trace: r.trace,
        warnings: r.warnings,
        missingInputs: r.missingInputs,
      };
    };
    const out: Partial<Record<ServiceMetric, LiveRunSummary>> = {};
    if (liveRuns) {
      summarize(out, 'reconcile_facts', liveRuns.map(({ group, response }) => ({
        response, source: group.claimIds.join(', '), detail: `${group.claimType} · ${group.unit}`,
      })));
    }
    if (liveUtilityRuns && liveUtilityRuns.runs.length > 0) {
      summarize(out, 'utility_recovery', liveUtilityRuns.runs.map(({ input, response }) => ({
        response, source: input.docId, detail: `${input.service} · ${input.affected}→${input.recovered} ${input.unit}`,
      })));
    }
    return out;
  }, [liveRuns, liveUtilityRuns, t]);
  // Unified per-metric status: implementation, synthetic test, live readiness,
  // latest live result, blockers. Composed from existing services only.
  const metricStatuses = useMemo(
    () => buildMetricStatuses({ outcomes: report.outcomes, readiness, liveByMetric }),
    [report, readiness, liveByMetric],
  );
  const metricOverview = useMemo(() => summariseMetricStatuses(metricStatuses), [metricStatuses]);
  const filteredMetrics = useMemo(() => {
    const q = explorerQuery.trim().toLowerCase();
    return metricStatuses.filter((row) => {
      if (q && !`${row.metric} ${row.label} ${row.description}`.toLowerCase().includes(q)) return false;
      switch (explorerFilter) {
        case 'CALCULATED': return row.live !== null && row.live.value !== null;
        case 'BLOCKED': return !(row.live !== null && row.live.value !== null) && (row.readiness === null || row.readiness.readiness !== 'READY');
        case 'CONFLICTS': return row.live?.status === 'conflict_pending_review' || row.live?.status === 'invalid_input';
        case 'NOT_IMPLEMENTED': return !row.implemented;
        case 'SYNTHETIC': return row.tested;
        default: return true;
      }
    });
  }, [metricStatuses, explorerFilter, explorerQuery]);
  const s = report.summary;
  // Live is only "verified" when a real read-only Firestore session produced a
  // full readiness assessment. Otherwise the count stays NOT verified — never 0.
  const liveVerified = live?.mode === 'live' && readiness !== null;
  // Up to three judge-facing results, preferring genuine live output; a metric
  // with a passing production-function proof is shown as a labelled synthetic
  // demonstration, and a metric with neither is withheld, never zeroed.
  const keyResults = useMemo<KeyResult[]>(() => KEY_RESULT_METRICS.map((metric) => {
    const row = metricStatuses.find((m) => m.metric === metric) ?? null;
    const liveRun = liveByMetric[metric];
    if (liveRun && liveRun.value !== null) {
      return { metric, label: metricLabel(metric), value: liveRun.value, unit: liveRun.unit, source: 'live', explanation: t(KEY_RESULT_EXPLANATION[metric] ?? '') };
    }
    const proof = proofs.find((p) => p.response.metric === metric)?.response.result;
    if (proof && proof.value !== null) {
      return { metric, label: metricLabel(metric), value: proof.value, unit: proof.unit || null, source: 'synthetic', explanation: t(KEY_RESULT_EXPLANATION[metric] ?? '') };
    }
    return {
      metric, label: metricLabel(metric), value: null, unit: null, source: 'unavailable',
      explanation: row?.readiness?.note ?? t('Metrik ini memerlukan input terverifikasi yang belum tersedia.'),
    };
  }), [metricStatuses, liveByMetric, proofs, t]);
  const readinessNotice = liveVerified
    ? metricOverview.blockedByData > 0
      ? t('{blocked} dari {total} metrik memerlukan input terverifikasi tambahan seperti jumlah pemulihan, pendanaan pemulihan, atau stok bantuan saat ini. Nilai yang hilang ditahan, bukan dianggap nol.', { blocked: metricOverview.blockedByData, total: metricOverview.tracked })
      : t('Semua metrik memiliki input terverifikasi untuk insiden ini.')
    : t('Data live belum diperiksa sesi ini. Sebagian kalkulasi memerlukan input terverifikasi tambahan seperti jumlah pemulihan, pendanaan pemulihan, atau stok bantuan saat ini. Nilai yang hilang ditahan, bukan dianggap nol.');
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
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-600">DisasterWatch</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('Calculation Engine')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
            {t('Verified formulas. Transparent calculations. Evidence-based disaster insights.')}
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">
            {t('Setiap metrik menjalankan formula produksi asli; hasil ditahan bila input tidak valid.')}
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            testId="summary-formulas" icon={FlaskConical}
            value={`${metricOverview.implemented}/${metricOverview.tracked}`}
            label={t('Formula Terimplementasi')} sub={t('dari registri metrik')}
          />
          <SummaryCard
            testId="summary-tests" icon={CheckCircle2}
            value={`${s.PASS}/${s.total}`}
            label={t('Uji Lolos')} sub={t('cek formula fixture sintetis — bukan uji produksi')}
          />
          <SummaryCard
            testId="summary-live" icon={Radio}
            value={liveVerified ? `${metricOverview.calculatedLive}` : t('Belum diverifikasi')}
            label={t('Kalkulasi Live')}
            sub={liveVerified ? t('metrik dari data live asli') : t('data live belum diperiksa sesi ini')}
          />
        </div>
        <section className="mt-8" data-testid="key-results">
          <h2 className="text-sm font-semibold text-slate-700">{t('Hasil perhitungan utama')}</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {keyResults.map((r) => <KeyResultCard key={r.metric} result={r} />)}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {t('Hasil live ditampilkan bila data terverifikasi tersedia; sisanya ditandai Demonstrasi sintetis.')}
          </p>
        </section>
        <section className="mt-8 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5" data-testid="data-readiness">
          <Database size={16} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('Kesiapan Data')}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{readinessNotice}</p>
          </div>
        </section>
        <details className="mt-8 rounded-2xl border border-slate-200 bg-white" data-testid="calc-details">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-700">{t('Lihat detail teknis')}</summary>
          <div className="border-t border-slate-100 p-5">
            <p className="mb-4 text-xs leading-relaxed text-slate-500">
              {t('Detail teknis: cek per modul, provenans, bukti eksekusi layanan, mode live read-only, dan inventaris kebutuhan data.')}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {cards.map(({ icon: Icon, value, caption }) => (
                <div key={caption} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <Icon size={18} className="text-blue-600" />
                  <p className="mt-3 text-base font-semibold">{value}</p>
                  <p className="mt-1 text-xs text-slate-400">{caption}</p>
                </div>
              ))}
            </div>
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="calc-overview">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">{t('Ikhtisar mesin perhitungan')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('Hitungan tingkat metrik yang diturunkan dari layanan perhitungan, registri verifikasi, dan adaptor live — bukan angka yang di-hardcode. Verifikasi sintetis dan hasil live adalah dua dimensi terpisah.')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
            <OverviewStat value={`${metricOverview.tracked}`} caption={t('Metrik dilacak')} />
            <OverviewStat value={`${metricOverview.implemented}`} caption={t('Formula terimplementasi')} />
            <OverviewStat value={`${metricOverview.tested}`} caption={t('Formula dengan uji lolos')} />
            <OverviewStat value={`${metricOverview.calculatedLive}`} caption={t('Terhitung dari data live')} />
            <OverviewStat value={`${metricOverview.blockedByData}`} caption={t('Terhambat kebutuhan data')} />
            <OverviewStat value={`${metricOverview.conflictsOrInvalid}`} caption={t('Konflik/input tidak valid')} />
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
            {t('Metrik terhitung live hanya bila dokumentasi Firestore menyuplai seluruh input wajib; sisanya ditahan dengan pemblokir eksplisit di bawah.')}
          </p>
        </section>
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="metric-explorer">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">{t('Penjelajah metrik')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('Setiap metrik dengan status implementasi, uji, kesiapan live, hasil terbaru, satuan, pemblokir, sumber, dan waktu. Pilih metrik untuk detail lengkap.')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
            {(['ALL', 'CALCULATED', 'BLOCKED', 'CONFLICTS', 'NOT_IMPLEMENTED', 'SYNTHETIC'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setExplorerFilter(key)}
                aria-pressed={explorerFilter === key}
                data-testid={`explorer-filter-${key}`}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${explorerFilter === key ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {t(EXPLORER_FILTER_LABEL[key])}
              </button>
            ))}
            <input
              type="search"
              value={explorerQuery}
              onChange={(e) => setExplorerQuery(e.target.value)}
              placeholder={t('Cari metrik…')}
              aria-label={t('Cari metrik')}
              data-testid="explorer-search"
              className="ml-auto w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs sm:w-56"
            />
          </div>
          <div className="divide-y divide-slate-100">
            {filteredMetrics.map((row) => <MetricExplorerRow key={row.metric} row={row} />)}
            {filteredMetrics.length === 0 && <p className="px-5 py-4 text-xs text-slate-500">{t('Tidak ada metrik yang cocok dengan filter ini.')}</p>}
          </div>
        </section>
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="blocked-metrics">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">{t('Metrik terhambat & input yang dibutuhkan')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('Setiap metrik terhambat menjelaskan alasan tepat dan tindakan berikutnya. “Data tidak tersedia” tidak cukup.')}</p>
          </div>
          <ul className="divide-y divide-slate-100 text-xs leading-relaxed text-slate-600">
            {metricStatuses.filter((row) => !(row.live?.value != null) && (row.readiness === null || row.readiness.readiness !== 'READY')).map((row) => (
              <li key={row.metric} className="px-5 py-3" data-testid={`blocked-${row.metric}`}>
                <span className="font-semibold text-slate-800">{row.label}</span>{' '}
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.readiness?.readiness === 'BLOCKED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  {row.readiness ? t(READINESS_LABEL[row.readiness.readiness]) : t('Belum diperiksa')}
                </span>
                <span className="mt-1 block">{t('Tindakan berikutnya:')} {nextActionFor(row)}</span>
                {row.readiness && row.readiness.missingFields.length > 0 && (
                  <span className="mt-0.5 block text-[11px] text-amber-700">{t('Kurang:')} {row.readiness.missingFields.join(' · ')}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
        {MODULES.map((m) => {
          const checks = report.outcomes.filter((o) => o.module === m);
          const pass = checks.filter((o) => o.status === 'PASS').length;
          return (
            <section key={m} id={`mod-${m}`} className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid={`calc-module-${m}`}>
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
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="svc-proof">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold"><FlaskConical size={16} className="text-blue-600" />{t('Bukti eksekusi layanan (sintetis)')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('Layanan calculationService.runCalculation memanggil fungsi produksi pada fixture berlabel. Nilai di bawah adalah return value aktual, bukan angka tampilan. {pass} dari {total} goldens cocok.', { pass: proofPass, total: proofs.length })}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {proofs.map(({ proof, response }) => <SvcProofRow key={proof.key} proof={proof} response={response} />)}
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="calc-live">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold"><Radio size={16} className="text-blue-600" />{t('Mode live read-only (Firestore)')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('Baca saja via repository yang ada. Tanpa tulis produksi. Hasil sintetis tidak pernah ditampilkan sebagai hasil live.')}</p>
          </div>
          <div className="px-5 py-4 text-xs leading-relaxed text-slate-600">
            {!live && <p>{t('Memeriksa akses baca…')}</p>}
            {live && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="font-semibold text-slate-800">{t('Insiden:')}</label>
                {incidentOptions.length > 0 ? (
                  <select
                    value={incidentOptions.some((d) => d.incidentId === incidentId) ? incidentId : incidentOptions[0]!.incidentId}
                    onChange={(e) => setIncidentId(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                    data-testid="live-incident-select"
                    aria-label={t('Pilih insiden live')}
                  >
                    {incidentOptions.map((d) => (
                      <option key={d.incidentId} value={d.incidentId}>
                        {d.name} · {d.province} ({d.incidentId}){d.isMock ? ` — ${t('simulasi/demo')}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-500">{t('Tidak ada insiden yang dapat dibaca dari Firestore pada sesi ini.')}</span>
                )}
                <span className="text-[11px] text-slate-400">{live.mode === 'live' ? t('Live — read-only') : t('Belum diverifikasi')} · {t('Diperiksa {at}', { at: fmtDate(liveAt, locale) })}</span>
              </div>
            )}
            {live && live.mode === 'live' && readiness && (
              <div data-testid="live-counts">
                <p>
                  <span className="font-semibold text-slate-800">{t('Kesiapan live per metrik:')}</span>{' '}
                  {t('{ready} siap · {blocked} terhambat · {na} tidak tersedia', {
                    ready: readyCounts?.READY ?? 0, blocked: readyCounts?.BLOCKED ?? 0, na: readyCounts?.NOT_AVAILABLE ?? 0,
                  })}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">{liveCounts} {t('dokumen humaniter terbaca untuk insiden ini')} · {live.notice}</p>
                {liveRuns && liveRuns.length > 0 && (
                  <div className="mt-3" data-testid="live-results">
                    <p className="font-semibold text-slate-800">
                      {t('Hasil live Firestore ({n} grup klaim):', { n: liveRuns.length })}{' '}
                      <span className="font-normal text-slate-500">{t('rekonsiliasi klaim terkuantifikasi per tipe+satuan; relasi diturunkan transparan, lineage tercatat.')}</span>
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {liveRuns.map(({ group, response }) => {
                        const r = response.result;
                        return (
                          <li key={group.groupKey} className="rounded-xl border border-blue-100 bg-blue-50/50 p-2.5" data-testid={`live-result-${group.claimType}-${group.unit}`}>
                            <span className="font-semibold text-slate-800">
                              {t('rekonsiliasi klaim')} · {group.claimType} · {group.unit}
                            </span>{' '}
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.value !== null ? 'bg-emerald-50 text-emerald-700' : r.status === 'invalid_input' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                              {t(EXTENDED_LABEL[response.extendedStatus])}
                            </span>
                            <span className="mt-1 block text-[11px]">
                              <b>{t('Metrik:')}</b> {r.metricId ?? 'reconcile_facts'} · <b>{t('Insiden:')}</b> {r.incidentId ?? incidentId} ·{' '}
                              <b>{t('Hasil:')}</b> {r.value === null ? t('Belum tersedia') : `${r.value.toLocaleString(locale)} ${r.unit}`}
                            </span>
                            <span className="mt-0.5 block font-mono text-[10px] text-slate-500 break-words">{r.trace || '—'}</span>
                            <span className="mt-0.5 block text-[10px] text-slate-400">
                              {t('Dokumen:')} {group.claimIds.join(', ')} · {t('Sumber:')} {group.sources.length > 0 ? group.sources.join(', ') : '—'} ·{' '}
                              {t('Baseline:')} {r.baselineIds.length > 0 ? r.baselineIds.join(', ') : '—'} · {t('Dihitung:')} {fmtDate(r.calculatedAt, locale)}
                              {r.warnings.length > 0 ? ` · ${t('Peringatan:')} ${r.warnings.join(' | ')}` : ''}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {liveRuns && liveRuns.length === 0 && (
                  <p className="mt-2 text-[11px] text-slate-500" data-testid="live-results-empty">
                    {t('Tidak ada klaim terkuantifikasi pada insiden ini — tidak ada kalkulasi live yang dapat dijalankan. Metrik lain menunjukkan pemblokirnya di bawah.')}
                  </p>
                )}
                {liveUtilityRuns && liveUtilityRuns.runs.length > 0 && (
                  <div className="mt-3" data-testid="live-utility-results">
                    <p className="font-semibold text-slate-800">
                      {t('Pemulihan layanan live ({n} observasi):', { n: liveUtilityRuns.runs.length })}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {liveUtilityRuns.runs.map(({ input, response }) => {
                        const r = response.result;
                        return (
                          <li key={`${input.service}-${input.docId}`} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5" data-testid={`live-result-utility-${input.service}`}>
                            <span className="font-semibold text-slate-800">
                              {t('pemulihan')} {input.service} · {input.affected.toLocaleString(locale)} → {input.recovered.toLocaleString(locale)} {input.unit}
                            </span>{' '}
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.value !== null ? 'bg-emerald-50 text-emerald-700' : r.status === 'invalid_input' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                              {t(EXTENDED_LABEL[response.extendedStatus])}
                            </span>
                            <span className="mt-1 block text-[11px]">
                              <b>{t('Metrik:')}</b> {r.metricId ?? 'utility_recovery'} · <b>{t('Insiden:')}</b> {r.incidentId ?? incidentId} ·{' '}
                              <b>{t('Hasil:')}</b> {r.value === null ? t('Belum tersedia') : `${r.value.toLocaleString(locale)}${r.unit}`}
                            </span>
                            <span className="mt-0.5 block font-mono text-[10px] text-slate-500 break-words">{r.trace || '—'}</span>
                            <span className="mt-0.5 block text-[10px] text-slate-400">
                              {t('Dokumen:')} {input.docId}{input.area ? ` · ${input.area}` : ''}{input.criterion ? ` · ${t('kriteria:')} ${input.criterion}` : ` · ${t('kriteria tidak dinyatakan')}`} · {t('Dihitung:')} {fmtDate(r.calculatedAt, locale)}
                              {r.warnings.length > 0 ? ` · ${t('Peringatan:')} ${r.warnings.join(' | ')}` : ''}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {liveUtilityRuns && liveUtilityRuns.runs.length === 0 && (
                  <p className="mt-2 text-[11px] text-slate-500" data-testid="live-utility-empty">
                    {t('Belum ada observasi pemulihan terhitung pada insiden ini. Yang kurang: {missing}', {
                      missing: liveUtilityRuns.adapted.blockers.length > 0
                        ? liveUtilityRuns.adapted.blockers.slice(0, 2).join(' | ')
                        : t('affectedCount/restoredCount dengan satuan eksplisit per layanan (recovery.affectedCount/restoredCount)'),
                    })}
                  </p>
                )}
                <ul className="mt-2 space-y-1.5">
                  {readiness.map((row) => (
                    <li key={row.metric} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5" data-testid={`live-readiness-${row.metric}`}>
                      <span className="font-semibold text-slate-800">{metricLabel(row.metric)}</span>{' '}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${READINESS_CHIP[row.readiness]}`}>{t(READINESS_LABEL[row.readiness])}</span>
                      {row.missingFields.length > 0 && (
                        <span className="mt-1 block text-[11px] text-amber-700">{t('Kurang:')} {row.missingFields.join(' · ')}</span>
                      )}
                      {row.availableFields.length > 0 && (
                        <span className="mt-0.5 block text-[11px] text-slate-500">{t('Ada:')} {row.availableFields.join(' · ')}</span>
                      )}
                      <span className="mt-0.5 block text-[11px] text-slate-400">{row.note}{row.docRefs.length > 0 ? ` · refs: ${row.docRefs.join(', ')}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {live && live.mode !== 'live' && (
              <p><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{t('Belum diverifikasi')}</span>
                <span className="ml-2">{live.notice} {t('Registry live tetap NOT_VERIFIED; tidak ada angka yang diinventarisasi.')}</span>
                <span className="mt-1 block text-[11px] text-slate-400">{t('Diperiksa {at}', { at: fmtDate(liveAt, locale) })}</span></p>
            )}
          </div>
        </section>
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="data-requirements">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold"><Database size={16} className="text-blue-600" />{t('Data Requirements & Availability')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('Inventaris kebutuhan tiap perhitungan vs ketersediaan aktual di Firestore. Formula benar dan data tersedia adalah dua dimensi terpisah.')}</p>
          </div>
          <div className="px-5 py-4 text-xs leading-relaxed text-slate-600">
            <p>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${auditRan ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                {auditRan ? t('Audit berjalan sesi ini') : t('Belum diperiksa')}
              </span>
              <span className="ml-2">
                {auditRan
                  ? t('Cakupan: {n} dokumen per koleksi (batas 50–200, filter insiden) untuk {incident}; kesimpulan hanya untuk cakupan itu, bukan seluruh database.', {
                      n: audit!.scope.samples.map((s) => s.docs.length).reduce((a, b) => a + b, 0), incident: incidentId,
                    })
                  : t('Audit database belum berjalan pada sesi ini — buka mode live dengan akses Firestore.')}
              </span>
              <button
                type="button"
                onClick={() => setAuditTick((v) => v + 1)}
                className="ml-2 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                {t('Periksa ulang')}
              </button>
            </p>
            {audit && (
              <>
                <p className="mt-3">
                  <b className="text-slate-800">{t('Ringkasan inventaris:')}</b>{' '}
                  {t('{total} kebutuhan ({mandatory} wajib). Tersedia {a} · Sebagian {p} · Hilang {m} · Tidak valid {i} · Konflik {c} · Belum diperiksa {n} · Tidak berlaku {na}.', {
                    total: DATA_REQUIREMENTS.length,
                    mandatory: DATA_REQUIREMENTS.filter((r) => r.required_or_optional === 'required').length,
                    a: availTally.AVAILABLE, p: availTally.PARTIAL, m: availTally.MISSING,
                    i: availTally.INVALID, c: availTally.CONFLICT, n: availTally.NOT_CHECKED, na: availTally.NOT_APPLICABLE,
                  })}
                </p>
                <p className="mt-1">
                  <b className="text-slate-800">{t('Kesiapan metrik:')}</b>{' '}
                  {t('{ready} siap · {blocked} terhambat · {na} tidak tersedia.', {
                    ready: readinessTally.READY, blocked: readinessTally.BLOCKED, na: readinessTally.NOT_AVAILABLE,
                  })}{' '}
                  <span className="text-slate-400">{t('Cakupan = kebutuhan wajib yang valid / total kebutuhan wajib. Cakupan adalah kelengkapan data, bukan skor kepercayaan.')}</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="font-semibold text-slate-800">{t('Metrik:')}</label>
                  <select value={filterMetric} onChange={(e) => setFilterMetric(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" data-testid="req-filter-metric" aria-label={t('Filter metrik')}>
                    <option value="ALL">{t('Semua metrik')}</option>
                    {metricsWithRequirements().map((m) => <option key={m} value={m}>{metricLabel(m as never)}</option>)}
                  </select>
                  <label className="font-semibold text-slate-800">{t('Status:')}</label>
                  <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" data-testid="req-filter-avail" aria-label={t('Filter status')}>
                    <option value="ALL">{t('Semua status')}</option>
                    {(Object.keys(AVAIL_LABEL) as FieldAvailability[]).map((k) => <option key={k} value={k}>{t(AVAIL_LABEL[k])}</option>)}
                  </select>
                </div>
                {metricsWithRequirements().filter((m) => filterMetric === 'ALL' || filterMetric === m).map((metricId) => {
                  const rows = filteredAudits.filter((x) => x.req.metric_id === metricId);
                  if (rows.length === 0) return null;
                  const ready = audit.metrics.find((x) => x.metric_id === metricId)!;
                  return (
                    <div key={metricId} className="mt-3 rounded-xl border border-slate-200" data-testid={`req-metric-${metricId}`}>
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                        <b className="text-slate-800">{metricLabel(metricId as never)}</b>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ready.readiness === 'READY' ? 'bg-emerald-50 text-emerald-700' : ready.readiness === 'BLOCKED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {t(CALC_READINESS_LABEL[ready.readiness])}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {t('cakupan {num}/{den} · pemblokir: {b}', {
                            num: ready.coverageNumerator, den: ready.coverageDenominator,
                            b: ready.blockers.length > 0 ? ready.blockers.slice(0, 3).join(' | ') + (ready.blockers.length > 3 ? ` (+${ready.blockers.length - 3})` : '') : '—',
                          })}
                        </span>
                        <a href={`#mod-${METRIC_MODULE[metricId] ?? 'integration'}`} className="ml-auto text-[11px] font-semibold text-blue-600 hover:underline">
                          {t('Lihat bukti verifikasi')}
                        </a>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-[11px]">
                          <thead>
                            <tr className="text-slate-400">
                              <th className="px-3 py-1.5 font-semibold">{t('Data yang dibutuhkan')}</th>
                              <th className="px-3 py-1.5 font-semibold">{t('Sumber Firestore')}</th>
                              <th className="px-3 py-1.5 font-semibold">{t('Ketersediaan')}</th>
                              <th className="px-3 py-1.5 font-semibold">{t('Valid/total')}</th>
                              <th className="px-3 py-1.5 font-semibold">{t('Satuan')}</th>
                              <th className="px-3 py-1.5 font-semibold">{t('Blokir?')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(({ req, audit: a }) => (
                              <tr key={req.requirement_id} className="border-t border-slate-100" data-testid={`req-row-${req.requirement_id}`}>
                                <td className="px-3 py-1.5">
                                  <span className="font-semibold text-slate-800">{req.data_item}</span>
                                  <span className="ml-1.5 inline-flex rounded-full bg-slate-100 px-1.5 py-px text-[10px] text-slate-500">{t(REQUIREMENT_KINDS[req.source_kind])}</span>
                                  {req.required_or_optional === 'optional' && <span className="ml-1 text-slate-400">({t('opsional')})</span>}
                                  <span className="block font-mono text-[10px] text-slate-400">{req.requirement_id} · {req.validation_rule}</span>
                                </td>
                                <td className="px-3 py-1.5 font-mono text-[10px]">{req.expected_collection ? `${req.expected_collection}.${req.expected_field_path ?? '—'}` : '—'}</td>
                                <td className="px-3 py-1.5">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${AVAIL_CHIP[a.status]}`}>{t(AVAIL_LABEL[a.status])}</span>
                                  {a.reasons.length > 0 && <span className="block text-[10px] text-slate-400">{a.reasons.join(' ')}</span>}
                                </td>
                                <td className="px-3 py-1.5">{a.totalRecords > 0 ? `${a.validCount}/${a.totalRecords}` : '—'}</td>
                                <td className="px-3 py-1.5">{req.expected_unit ?? '—'}</td>
                                <td className="px-3 py-1.5">{req.blocking_if_missing && req.required_or_optional === 'required' ? t('Ya') : t('Tidak')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {ready.readiness === 'READY' && (
                        <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-emerald-700">
                          {t('Terpenuhi: {ids}. Jalankan via calculationService.runCalculation dengan input tervalidasi untuk output live.', { ids: ready.satisfiedRequirementIds.join(', ') || '—' })}
                        </p>
                      )}
                    </div>
                  );
                })}
                <p className="mt-2 text-[11px] text-slate-400">
                  {t('Legenda sumber: Observasi = fakta terukur; Baseline = nilai acuan eksplisit; Parameter = konstanta versi di kode; Turunan = dihitung saat kalkulasi. Audit hanya membaca; tidak menulis, memigrasi, atau seed data.')}
                </p>
              </>
            )}
          </div>
        </section>
        <p className="mt-5 text-[11px] leading-relaxed text-slate-400">
          {t('Halaman internal untuk verifikasi implementasi. Bukan klaim kesiapan produksi. Cek live membutuhkan sesi browser dengan akses Firestore; selebihnya halaman ini deterministik dan dapat diuji ulang.')}
        </p>
          </div>
        </details>
      </Content>
    </div>
  );
}
