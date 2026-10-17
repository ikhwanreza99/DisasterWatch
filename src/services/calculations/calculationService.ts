// DisasterWatch Calculation Service — shared orchestrator (Workstream B/D).
// Thin boundary over the production engine (src/services/insights/formulas.ts):
// it accepts validated inputs, invokes the REAL formula functions, and stamps
// the standard output contract (metric/incident/baseline/valid-time) plus the
// extended presentation status. No arithmetic lives here; no inputs invented.
// React-free and Firestore-free so dashboard, detail views, tests, and a future
// backend endpoint can all consume it without reimplementing formulas.
import {
  estimateCurrentGap,
  estimateDamageAggregate,
  estimateEconomicLoss,
  estimateEconomicLossNetFlow,
  estimateForecastGap,
  estimateFundingGap,
  estimateFundingGapPercent,
  estimateNeedsDemand,
  estimatePhysicalDamage,
  estimatePhysicalGapCount,
  estimatePhysicalGapPercent,
  estimateTotalLoss,
  estimateUtilityRecovery,
  estimateOriIndex,
  reconcileFacts,
  resolveExtendedStatus,
  scorePriority,
  type CalculationResult,
  type CurrentGapInput,
  type DamageAggregateInput,
  type EconomicLossInput,
  type ExtendedResultStatus,
  type ForecastGapInput,
  type FundingGapInput,
  type NeedsDemandInput,
  type OriIndexInput,
  type PhysicalDamageInput,
  type PhysicalGapInput,
  type PriorityComponents,
  type ReconcileFactsInput,
  type UtilityRecoveryInput,
} from '../insights/formulas';

export type ServiceMetric =
  | 'physical_damage' | 'economic_loss' | 'economic_loss_netflow' | 'total_loss'
  | 'funding_gap' | 'funding_gap_percent' | 'physical_gap' | 'physical_gap_percent'
  | 'utility_recovery' | 'ori_index'
  | 'needs_demand' | 'needs_current_gap' | 'needs_forecast_gap'
  | 'damage_aggregate' | 'reconcile_facts' | 'priority_score';

/** Execution lane: current-state measurement vs scenario vs forward forecast. */
export type ServiceMode = 'current' | 'scenario' | 'forecast';

export interface ServiceRequest {
  metric: ServiceMetric;
  /** Incident this run belongs to; null for incident-agnostic scenarios. */
  incidentId?: string | null;
  /** Valid time of the underlying observation (ISO). */
  validTime?: string | null;
  /** Baseline/parameter registry ids (empty until registries exist). */
  baselineIds?: string[];
  /** Lane override; defaults to the metric's nature (forecast family → forecast). */
  mode?: ServiceMode;
  /** Provenance designation, threaded into the engine input. */
  origin?: 'simulation' | 'live';
  calculationId?: string | null;
  /** Metric-specific engine input (see METRIC_INPUTS). For total_loss the
      caller first runs the component metrics through this same service. */
  input: unknown;
}

export interface ServiceResponse {
  metric: ServiceMetric;
  mode: ServiceMode;
  result: CalculationResult;
  extendedStatus: ExtendedResultStatus;
}

const METRIC_LABELS: Record<ServiceMetric, string> = {
  physical_damage: 'Physical damage',
  economic_loss: 'Economic loss (daily rate)',
  economic_loss_netflow: 'Economic loss (net-flow derivation)',
  total_loss: 'Total assessed impact',
  funding_gap: 'Funding gap',
  funding_gap_percent: 'Funding gap percent',
  physical_gap: 'Physical gap',
  physical_gap_percent: 'Physical gap percent',
  utility_recovery: 'Utility recovery',
  ori_index: 'Utility Recovery Index (ORI, internal)',
  needs_demand: 'Needs demand',
  needs_current_gap: 'Current needs gap',
  needs_forecast_gap: 'Forecast needs gap',
  damage_aggregate: 'Multi-category damage aggregate',
  reconcile_facts: 'Reconciled fact total',
  priority_score: 'Priority score (MVP heuristic)',
};

export function metricLabel(metric: ServiceMetric): string {
  return METRIC_LABELS[metric];
}

export function listSupportedMetrics(): ServiceMetric[] {
  return Object.keys(METRIC_LABELS) as ServiceMetric[];
}

function stamp(result: CalculationResult, req: ServiceRequest): CalculationResult {
  return {
    ...result,
    metricId: result.metricId ?? req.metric,
    incidentId: req.incidentId ?? result.incidentId ?? null,
    validTime: req.validTime ?? result.validTime ?? null,
    baselineIds: req.baselineIds ?? result.baselineIds ?? [],
  };
}

function respond(metric: ServiceMetric, result: CalculationResult, req: ServiceRequest): ServiceResponse {
  const mode: ServiceMode = req.mode ?? (metric === 'needs_forecast_gap' ? 'forecast' : 'current');
  const stamped = stamp(result, req);
  return { metric, mode, result: stamped, extendedStatus: resolveExtendedStatus(stamped, { mode }) };
}

/** Run one metric through the real production formula. Never invents inputs:
    missing/incompatible inputs come back as insufficient/invalid results. */
export function runCalculation(req: ServiceRequest): ServiceResponse {
  const origin = req.origin ?? 'simulation';
  const base = { origin, calculationId: req.calculationId ?? null };
  switch (req.metric) {
    case 'physical_damage':
      return respond(req.metric,
        estimatePhysicalDamage({ ...(req.input as PhysicalDamageInput), ...base }), req);
    case 'economic_loss':
      return respond(req.metric,
        estimateEconomicLoss({ ...(req.input as EconomicLossInput), ...base }), req);
    case 'economic_loss_netflow': {
      const i = req.input as { normal: Parameters<typeof estimateEconomicLossNetFlow>[0]; actual: Parameters<typeof estimateEconomicLossNetFlow>[1]; days: number | null; area?: string; period?: string };
      return respond(req.metric,
        estimateEconomicLossNetFlow(i.normal, i.actual, i.days, { area: i.area, period: i.period, calculationId: base.calculationId, origin: base.origin }), req);
    }
    case 'total_loss': {
      const i = req.input as { physical: CalculationResult; flow: CalculationResult; inputsOverlap?: boolean };
      return respond(req.metric,
        estimateTotalLoss(i.physical, i.flow, { inputsOverlap: i.inputsOverlap, calculationId: base.calculationId }), req);
    }
    case 'funding_gap':
      return respond(req.metric,
        estimateFundingGap({ ...(req.input as FundingGapInput), ...base }), req);
    case 'funding_gap_percent':
      return respond(req.metric,
        estimateFundingGapPercent({ ...(req.input as FundingGapInput), ...base }), req);
    case 'physical_gap':
      return respond(req.metric,
        estimatePhysicalGapCount({ ...(req.input as PhysicalGapInput), ...base }), req);
    case 'physical_gap_percent':
      return respond(req.metric,
        estimatePhysicalGapPercent({ ...(req.input as PhysicalGapInput), ...base }), req);
    case 'utility_recovery':
      return respond(req.metric,
        estimateUtilityRecovery({ ...(req.input as UtilityRecoveryInput), ...base }), req);
    case 'ori_index':
      return respond(req.metric,
        estimateOriIndex({ ...(req.input as OriIndexInput), ...base }), req);
    case 'needs_demand':
      return respond(req.metric,
        estimateNeedsDemand({ ...(req.input as NeedsDemandInput), ...base }), req);
    case 'needs_current_gap':
      return respond(req.metric,
        estimateCurrentGap({ ...(req.input as CurrentGapInput), ...base }), req);
    case 'needs_forecast_gap':
      return respond(req.metric,
        estimateForecastGap({ ...(req.input as ForecastGapInput), ...base }), req);
    case 'damage_aggregate':
      return respond(req.metric,
        estimateDamageAggregate({ ...(req.input as DamageAggregateInput), ...base }), req);
    case 'reconcile_facts':
      return respond(req.metric,
        reconcileFacts({ ...(req.input as ReconcileFactsInput), ...base }), req);
    case 'priority_score':
      return respond(req.metric,
        scorePriority(req.input as PriorityComponents), req);
    default:
      throw new Error(`Unsupported metric: ${String((req as ServiceRequest).metric)}`);
  }
}
