// Unified per-metric status projection for /calculation (visibility layer).
//
// This module composes EXISTING services — it never re-implements a formula and
// never invents a value:
//   - calculationService.listSupportedMetrics()          → the metric universe
//   - calculationRegistry.runCalculationVerification()   → synthetic formula checks
//   - liveAdapter.assessLiveReadiness()                  → live data readiness
//   - live runs (runCalculation on Firestore)            → latest live result
//
// React-free and pure so it can run in tests, scripts, and the browser page.
import { listSupportedMetrics, metricLabel, type ServiceMetric } from '../calculations/calculationService';
import { runCalculationVerification, type CheckOutcome, type CheckModule } from './calculationRegistry';
import type { MetricReadiness as LiveMetricReadiness } from '../calculations/liveAdapter';
import type { ExtendedResultStatus } from '../insights/formulas';

/** Verification module each metric is proven in (drill-down target). */
export const METRIC_MODULE: Record<string, CheckModule> = {
  physical_damage: 'loss', economic_loss: 'loss', economic_loss_netflow: 'loss', total_loss: 'loss',
  damage_aggregate: 'loss',
  funding_gap: 'recovery-gap', funding_gap_percent: 'recovery-gap',
  physical_gap: 'recovery-gap', physical_gap_percent: 'recovery-gap',
  utility_recovery: 'utility-recovery', ori_index: 'utility-recovery',
  needs_demand: 'needs-intelligence', needs_current_gap: 'needs-intelligence',
  needs_forecast_gap: 'needs-intelligence', priority_score: 'needs-intelligence',
  reconcile_facts: 'integration',
};

/** Registry check id → the metric(s) whose formula that check actually executes.
    Single explicit mapping so the explorer never guesses test ownership. */
export const CHECK_METRICS: Record<string, ServiceMetric[]> = {
  'loss-damage-ref': ['physical_damage'],
  'loss-severity-percent-ref': ['physical_damage'],
  'loss-severity-ambiguous': ['physical_damage'],
  'loss-fraction-range': ['physical_damage'],
  'valid-negative': ['physical_damage'],
  'loss-econ-ref': ['economic_loss'],
  'loss-econ-basis': ['economic_loss'],
  'loss-econ-netflow-ref': ['economic_loss_netflow'],
  'valid-scope-mismatch': ['economic_loss_netflow'],
  'loss-total-ref': ['total_loss'],
  'loss-total-overlap': ['total_loss'],
  'loss-total-period-mismatch': ['total_loss'],
  'loss-damage-aggregate-ref': ['damage_aggregate'],
  'loss-damage-aggregate-unit': ['damage_aggregate'],
  'gap-funding-ref': ['funding_gap'],
  'gap-stage-mismatch': ['funding_gap'],
  'gap-funding-pct-ref': ['funding_gap_percent'],
  'gap-zero-denominator': ['funding_gap_percent'],
  'gap-physical-ref': ['physical_gap'],
  'gap-recovered-exceeds': ['physical_gap'],
  'gap-physical-pct-ref': ['physical_gap_percent'],
  'util-water-ref': ['utility_recovery'],
  'util-electricity-ref': ['utility_recovery'],
  'util-access-ref': ['utility_recovery'],
  'util-telecom-ref': ['utility_recovery'],
  'util-zero-sample': ['utility_recovery'],
  'ori-golden-ref': ['ori_index'],
  'ori-missing-withheld': ['ori_index'],
  'ori-weights-sum': ['ori_index'],
  'needs-demand-ref': ['needs_demand'],
  'valid-need-tiers': ['needs_demand', 'needs_current_gap', 'needs_forecast_gap'],
  'needs-current-gap-ref': ['needs_current_gap'],
  'needs-current-gap-zero': ['needs_current_gap'],
  'needs-current-gap-missing': ['needs_current_gap'],
  'needs-current-gap-unit': ['needs_current_gap'],
  'needs-forecast-ref': ['needs_forecast_gap'],
  'needs-forecast-incomplete': ['needs_forecast_gap'],
  'needs-backlog-overlap': ['needs_forecast_gap'],
  'needs-distribution-excluded': ['needs_forecast_gap'],
  'needs-forecast-unusable-stock': ['needs_forecast_gap'],
  'needs-forecast-unconfirmed-incoming': ['needs_forecast_gap'],
  'needs-priority-ref': ['priority_score'],
  'needs-weights-sum': ['priority_score'],
  'needs-priority-missing': ['priority_score'],
  'needs-override-scope': ['priority_score'],
  'recon-parent-child-ref': ['reconcile_facts'],
  'recon-single-canonical': ['reconcile_facts'],
  'recon-dangling-subset': ['reconcile_facts'],
  'recon-revision-supersedes': ['reconcile_facts'],
  'recon-scope-warning': ['reconcile_facts'],
  'recon-disjoint-ref': ['reconcile_facts'],
  'recon-conflict-withheld': ['reconcile_facts'],
  'valid-duplicates': ['reconcile_facts'],
};

/** Registry checks that are cross-cutting: they prove the pipeline, not one
    metric. Kept explicit so coverage tests can insist nothing is silently lost. */
export const NON_METRIC_CHECKS = new Set<string>([
  'int-empty-snapshot',
  'int-unquantified-withheld',
  'int-live-readonly',
]);

export const METRIC_DESCRIPTIONS: Record<ServiceMetric, string> = {
  physical_damage: 'Damaged assets × replacement cost × severity (single category).',
  economic_loss: 'Comparable net daily economic flow lost over a duration.',
  economic_loss_netflow: 'Net-loss derivation from normal vs actual daily flows.',
  total_loss: 'Combined physical + economic loss, only when scopes reconcile.',
  damage_aggregate: 'Sum of per-category damage across disjoint categories.',
  funding_gap: 'Recovery requirement minus available (same stage) funding.',
  funding_gap_percent: 'Funding gap as a share of the recovery requirement.',
  physical_gap: 'Affected units minus recovered units for one cohort.',
  physical_gap_percent: 'Physical gap as a share of affected units.',
  utility_recovery: 'Restored ÷ affected units for a single utility service.',
  ori_index: 'Weighted composite of four service recoveries (30/25/25/20).',
  needs_demand: 'Population × per-person rate × horizon days.',
  needs_current_gap: 'Current unmet need: demand minus confirmed usable supply.',
  needs_forecast_gap: 'Forward gap: demand + backlog − usable stock − incoming.',
  priority_score: 'Weighted 0–100 heuristic from S/G/V/T/A components.',
  reconcile_facts: 'Canonical total from quantified facts, respecting relations.',
};

export interface LiveRunSummary {
  value: number | null;
  unit: string | null;
  status: ExtendedResultStatus;
  calculatedAt: string | null;
  source: string;
  detail: string;
  trace: string;
  warnings: string[];
  missingInputs: string[];
}

export interface MetricStatusRow {
  metric: ServiceMetric;
  label: string;
  description: string;
  module: CheckModule;
  /** True when at least one registry check actually executes this metric. */
  implemented: boolean;
  tests: CheckOutcome[];
  testTotal: number;
  testPass: number;
  /** True when at least one registry check for this metric PASSes. */
  tested: boolean;
  /** Live data readiness for the selected incident, or null (no live snapshot). */
  readiness: LiveMetricReadiness | null;
  /** Latest live execution for this metric, or null when none ran. */
  live: LiveRunSummary | null;
}

export function checksForMetric(metric: ServiceMetric, outcomes: CheckOutcome[]): CheckOutcome[] {
  const ids = new Set(
    Object.entries(CHECK_METRICS)
      .filter(([, metrics]) => metrics.includes(metric))
      .map(([id]) => id),
  );
  return outcomes.filter((o) => ids.has(o.id));
}

export interface BuildMetricStatusOptions {
  /** Registry outcomes; defaults to a fresh deterministic run. */
  outcomes?: CheckOutcome[];
  /** Live readiness rows; null/undefined → readiness stays unknown. */
  readiness?: LiveMetricReadiness[] | null;
  /** Latest live result per metric (from runCalculation on Firestore docs). */
  liveByMetric?: Partial<Record<ServiceMetric, LiveRunSummary>>;
}

export function buildMetricStatuses(opts: BuildMetricStatusOptions = {}): MetricStatusRow[] {
  const outcomes = opts.outcomes ?? runCalculationVerification().outcomes;
  const readinessById = new Map((opts.readiness ?? []).map((r) => [r.metric, r]));
  return listSupportedMetrics().map((metric) => {
    const tests = checksForMetric(metric, outcomes);
    const testPass = tests.filter((t) => t.status === 'PASS').length;
    return {
      metric,
      label: metricLabel(metric),
      description: METRIC_DESCRIPTIONS[metric],
      module: METRIC_MODULE[metric] ?? 'integration',
      implemented: tests.length > 0,
      tests,
      testTotal: tests.length,
      testPass,
      tested: tests.length > 0 && testPass > 0,
      readiness: readinessById.get(metric) ?? null,
      live: opts.liveByMetric?.[metric] ?? null,
    };
  });
}

export interface MetricOverview {
  tracked: number;
  implemented: number;
  tested: number;
  calculatedLive: number;
  blockedByData: number;
  conflictsOrInvalid: number;
}

/** Counts derived from the service/adapter results — never hardcoded. */
export function summariseMetricStatuses(rows: MetricStatusRow[]): MetricOverview {
  const hasLiveValue = (r: MetricStatusRow): boolean =>
    r.live !== null && r.live.value !== null && r.live.status !== 'invalid_input';
  return {
    tracked: rows.length,
    implemented: rows.filter((r) => r.implemented).length,
    tested: rows.filter((r) => r.tested).length,
    calculatedLive: rows.filter(hasLiveValue).length,
    blockedByData: rows.filter(
      (r) => !hasLiveValue(r) && (r.readiness === null || r.readiness.readiness !== 'READY'),
    ).length,
    conflictsOrInvalid: rows.filter(
      (r) => r.live?.status === 'conflict_pending_review' || r.live?.status === 'invalid_input',
    ).length,
  };
}

/** Exact required inputs declared for a metric in the requirements inventory. */
export function requiredInputsForMetric(
  metric: ServiceMetric,
  requirements: Array<{ metric_id: string; required_or_optional: string; data_item: string; expected_unit: string | null }>,
): Array<{ data_item: string; expected_unit: string | null }> {
  return requirements
    .filter((r) => r.metric_id === metric && r.required_or_optional === 'required')
    .map((r) => ({ data_item: r.data_item, expected_unit: r.expected_unit }));
}

/** Actionable next step. Deterministic, derived from observed state only. */
export function nextActionFor(row: MetricStatusRow): string {
  if (row.live && row.live.value !== null && row.live.status !== 'invalid_input') {
    return 'Has a live result — no action required.';
  }
  if (row.live && row.live.status === 'conflict_pending_review') {
    return 'Resolve the conflicting sources with reconciliation rules before a total is asserted.';
  }
  if (row.live && row.live.status === 'invalid_input') {
    return 'Fix the invalid input (unit/scope/range) reported by the engine, then re-run.';
  }
  if (row.readiness && row.readiness.readiness === 'READY') {
    return 'Inputs are available for this incident — run via calculationService.runCalculation.';
  }
  const missing = row.readiness?.missingFields ?? [];
  if (missing.length > 0) return `Provide the missing inputs: ${missing.join('; ')}`;
  return 'Requires a live Firestore session with readable data for this incident.';
}
