// /calculation — Calculation Verification Center.
// Follows GoogleStatusPage (/status) styling and layout conventions.
// Evidence-driven: every check executes the real engine via the registry or
// the shared calculation service; this page never re-implements formulas,
// never invents PASS results, and never labels synthetic output as live.
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, CheckCircle2, Database, FlaskConical, Radio } from 'lucide-react';
import { useI18n } from '../i18n';
import { LanguageToggle } from '../i18n/LanguageToggle';
import { runCalculationVerification } from '../services/verification/calculationRegistry';
import {
  metricLabel,
  runCalculation,
  type ServiceMetric,
  type ServiceResponse,
} from '../services/calculations/calculationService';
import { assessLiveReadiness, adaptUtilityInputs } from '../services/calculations/liveAdapter';
import { buildClaimFactGroups } from '../services/calculations/liveClaimGroups';
import {
  buildMetricStatuses,
  summariseMetricStatuses,
  type LiveRunSummary,
} from '../services/verification/metricStatus';
import { loadHumanitarian, type RemoteSnapshot } from '../services/store/humanitarianRepo';

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
    ? t('Data Aktual')
    : result.source === 'synthetic' ? t('Contoh Simulasi') : t('Data Belum Cukup');
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid={`key-result-${result.metric}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{result.label}</p>
        <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${chipClass}`}>{chipText}</span>
      </div>
      {result.value === null ? (
        <p className="mt-3 text-lg font-semibold text-slate-400">{t('Data Belum Cukup')}</p>
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
  const [incidentId] = useState('padang');
  const [live, setLive] = useState<RemoteSnapshot | null>(null);
  useEffect(() => {
    let active = true;
    // Read-only probe via the existing authorized repository layer.
    // No writes; failure yields NOT VERIFIED, never invented numbers.
    loadHumanitarian(incidentId).then((s) => {
      if (active) setLive(s);
    });
    return () => { active = false; };
  }, [incidentId]);
  const readiness = useMemo(
    () => (live && live.mode === 'live' ? assessLiveReadiness(live, incidentId) : null),
    [live, incidentId],
  );
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
  const s = report.summary;
  // Live is only "verified" when a real read-only Firestore session produced a
  // full readiness assessment. Otherwise the count stays NOT verified — never 0.
  const liveVerified = live?.mode === 'live' && readiness !== null;
  // Up to three judge-facing results. Status follows the actual data origin and
  // result: a validated live result is "Data Aktual"; a production-function run
  // on synthetic inputs is "Contoh Simulasi"; anything else is "Data Belum
  // Cukup" (withheld, never shown as zero).
  const keyResults = useMemo<KeyResult[]>(() => KEY_RESULT_METRICS.map((metric) => {
    const liveRun = liveByMetric[metric];
    if (liveRun && liveRun.value !== null && liveRun.status === 'calculated') {
      return { metric, label: metricLabel(metric), value: liveRun.value, unit: liveRun.unit, source: 'live', explanation: t(KEY_RESULT_EXPLANATION[metric] ?? '') };
    }
    const proof = proofs.find((p) => p.response.metric === metric)?.response.result;
    if (proof && proof.value !== null) {
      return { metric, label: metricLabel(metric), value: proof.value, unit: proof.unit || null, source: 'synthetic', explanation: t(KEY_RESULT_EXPLANATION[metric] ?? '') };
    }
    return {
      metric, label: metricLabel(metric), value: null, unit: null, source: 'unavailable',
      explanation: t('Metrik ini memerlukan input terverifikasi yang belum tersedia.'),
    };
  }), [liveByMetric, proofs, t]);
  const readinessNotice = liveVerified
    ? metricOverview.blockedByData > 0
      ? t('{blocked} dari {total} metrik memerlukan input terverifikasi tambahan seperti jumlah pemulihan, pendanaan pemulihan, atau stok bantuan saat ini. Nilai yang hilang ditahan, bukan dianggap nol.', { blocked: metricOverview.blockedByData, total: metricOverview.tracked })
      : t('Semua metrik memiliki input terverifikasi untuk insiden ini.')
    : t('Data live belum diperiksa sesi ini. Sebagian kalkulasi memerlukan input terverifikasi tambahan seperti jumlah pemulihan, pendanaan pemulihan, atau stok bantuan saat ini. Nilai yang hilang ditahan, bukan dianggap nol.');
  return (
    <div className={embedded ? 'admin-status-view text-slate-900' : 'min-h-screen bg-[#f8fafb] text-slate-900'} data-testid="calculation-page">
      {!embedded && (
        <header className="border-b border-slate-200/70 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
            <a href="/" className="flex items-center gap-2 font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white"><Activity size={18} /></span>
              DisasterWatch<span className="ml-2 hidden text-xs font-normal text-slate-400 sm:inline">{t('Pusat Verifikasi Kalkulasi')}</span>
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
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('Mesin Kalkulasi')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
            {t('Formula terverifikasi. Kalkulasi transparan. Insight bencana berbasis bukti.')}
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
            {t('Angka simulasi untuk menunjukkan cara kerja rumus, bukan data bencana aktual.')}
          </p>
        </section>
        <section className="mt-8 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5" data-testid="data-readiness">
          <Database size={16} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('Kesiapan Data')}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{readinessNotice}</p>
          </div>
        </section>
      </Content>
    </div>
  );
}
