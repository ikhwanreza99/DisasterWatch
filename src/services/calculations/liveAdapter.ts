// Live input adapter — read-only assessment of real Firestore documents.
// Maps ONLY demonstrably existing schema fields (src/domain/humanitarian.ts)
// into per-metric readiness. Never invents inputs, never writes, never weakens
// rules. When the schema cannot supply a metric's required inputs the metric
// is reported BLOCKED or NOT_AVAILABLE with the exact missing fields.
// React-free and pure: fully testable with explicitly labeled mock snapshots.
import type { RemoteSnapshot } from '../store/humanitarianRepo';
import type { ServiceMetric } from './calculationService';
import { buildClaimFactGroups } from './liveClaimGroups';
import type { IncidentRecoveryDoc, RecoveryServiceType } from '../../domain/humanitarian';
import type { UtilityRecoveryInput } from '../insights/formulas';

export type LiveReadiness = 'READY' | 'BLOCKED' | 'NOT_AVAILABLE';

export interface MetricReadiness {
  metric: ServiceMetric;
  readiness: LiveReadiness;
  /** Schema fields present and usable for this metric (field names only). */
  availableFields: string[];
  /** Required inputs with no backing schema field. */
  missingFields: string[];
  /** Source doc ids inspected (evidence refs, not values). */
  docRefs: string[];
  note: string;
}

type Snap = Pick<RemoteSnapshot, 'needs' | 'recovery' | 'claims' | 'aidEvents' | 'incidents'>;

function scoped<T>(docs: T[], incidentId: string, pick: (d: T) => string): T[] {
  const seen = new Set<string>();
  return docs.filter((d) => {
    const doc = d as unknown as Record<string, unknown>;
    if (doc['incidentId'] !== incidentId || typeof doc['id'] !== 'string') return false;
    const k = pick(d);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function hasUsableClaimQty(claims: Snap['claims']): boolean {
  return claims.some((c) => typeof c.quantity === 'number' && Number.isFinite(c.quantity) && !!c.unit);
}

// --- Utility input builder (mapping layer) ----------------------------------
// Maps recovery docs to engine utility inputs. Pure + read-only. Range and
// unit compatibility are NOT pre-judged here: out-of-range or mismatched units
// pass through so the engine returns explicit invalid_input instead of the
// adapter silently dropping evidence. Overlaps (two countable docs for the
// same service+area) block that service rather than picking a winner.
const RECOVERY_TO_UTILITY: Record<RecoveryServiceType, UtilityRecoveryInput['service'] | null> = {
  POWER: 'electricity',
  TELECOMMUNICATIONS: 'telecom',
  WASH: 'water',
  ACCESS_TRANSPORT: 'access',
  PUBLIC_FACILITIES: null,
};

export interface AdaptedUtilityService {
  service: UtilityRecoveryInput['service'];
  affected: number;
  recovered: number;
  unit: string;
  area: string | null;
  docId: string;
  criterion: string | null;
}

export interface UtilityAdaptation {
  readyInputs: AdaptedUtilityService[];
  blockers: string[];
  skipped: Array<{ docId: string; reason: string }>;
}

function isCountable(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function adaptUtilityInputs(incidentId: string, recovery: IncidentRecoveryDoc[]): UtilityAdaptation {
  const blockers: string[] = [];
  const skipped: Array<{ docId: string; reason: string }> = [];
  const scopedDocs = recovery.filter((d) => d && d.incidentId === incidentId && d.id);
  if (scopedDocs.length === 0) {
    return { readyInputs: [], blockers: ['no recovery documents in scope'], skipped };
  }
  const countable = new Map<string, AdaptedUtilityService[]>();
  for (const d of scopedDocs) {
    const service = RECOVERY_TO_UTILITY[d.serviceType];
    if (!service) {
      skipped.push({ docId: d.id, reason: `service '${d.serviceType}' is not a utility service (no recovery-rate semantics)` });
      continue;
    }
    if (!isCountable(d.affectedCount) || !isCountable(d.restoredCount)) {
      blockers.push(`${d.id} (${service}): affected/restored counts missing (affected=${String(d.affectedCount)}, restored=${String(d.restoredCount)}) — unknown is never zero`);
      continue;
    }
    if (typeof d.unit !== 'string' || d.unit.trim() === '') {
      blockers.push(`${d.id} (${service}): count unit missing — numerator and denominator require the same explicit unit`);
      continue;
    }
    const key = `${service}|${d.affectedArea ?? 'general'}`;
    const row: AdaptedUtilityService = {
      service, affected: d.affectedCount, recovered: d.restoredCount,
      unit: d.unit, area: d.affectedArea, docId: d.id,
      criterion: d.restorationCriterion ?? null,
    };
    const arr = countable.get(key);
    if (arr) arr.push(row);
    else countable.set(key, [row]);
  }
  const readyInputs: AdaptedUtilityService[] = [];
  for (const [key, rows] of countable) {
    if (rows.length > 1) {
      blockers.push(`${key}: ${rows.length} countable documents overlap (${rows.map((r) => r.docId).join(', ')}) — no silent winner; reconcile sources first`);
      continue;
    }
    readyInputs.push(rows[0]!);
  }
  return { readyInputs, blockers, skipped };
}

/** Assess every metric against one incident's real documents. Read-only. */
export function assessLiveReadiness(snap: Snap, incidentId: string): MetricReadiness[] {
  const needs = scoped(snap.needs, incidentId, (n) => n.id);
  const recovery = scoped(snap.recovery, incidentId, (r) => r.id);
  const claims = scoped(snap.claims, incidentId, (c) => c.id);
  const aidEvents = scoped(snap.aidEvents, incidentId, (e) => e.id);
  const claimRefs = claims.slice(0, 5).map((c) => c.id);
  const needRefs = needs.slice(0, 5).map((n) => n.id);
  const recRefs = recovery.slice(0, 5).map((r) => r.id);
  // Utility + ORI readiness comes from the mapping layer above: a service is
  // executable only with both counts and an explicit unit from sourced docs.
  const utilAdapt = adaptUtilityInputs(incidentId, recovery);
  const utilServices = [...new Set(utilAdapt.readyInputs.map((r) => r.service))];
  const oriReady = (['water', 'electricity', 'access', 'telecom'] as const).every((s) => utilServices.includes(s));
  const out: MetricReadiness[] = [
    {
      metric: 'physical_damage', readiness: 'BLOCKED',
      availableFields: hasUsableClaimQty(claims) ? ['claims.quantity', 'claims.unit (unscoped for damage)'] : [],
      missingFields: ['asset counts with genuine asset units (no schema field)', 'replacement costs (no schema field)', 'severity fractions (no schema field)'],
      docRefs: claimRefs,
      note: 'Claim quantities exist but carry no asset-unit/cost/severity semantics; mapping them into damage inputs would invent facts.',
    },
    {
      metric: 'economic_loss', readiness: 'NOT_AVAILABLE',
      availableFields: [],
      missingFields: ['net daily economic flows (no schema field)', 'loss duration (no schema field)'],
      docRefs: [],
      note: 'No collection holds economic-flow fields.',
    },
    {
      metric: 'economic_loss_netflow', readiness: 'NOT_AVAILABLE',
      availableFields: [],
      missingFields: ['normal/actual net daily flows (no schema field)', 'loss duration (no schema field)'],
      docRefs: [],
      note: 'No collection holds economic-flow fields.',
    },
    {
      metric: 'total_loss', readiness: 'BLOCKED',
      availableFields: [],
      missingFields: ['damage component (blocked)', 'economic-loss component (not available)'],
      docRefs: [...claimRefs],
      note: 'Total assembles damage + economic loss; both components are unavailable from schema fields.',
    },
    {
      metric: 'funding_gap', readiness: 'NOT_AVAILABLE',
      availableFields: [],
      missingFields: ['recovery requirement amounts (no schema field)', 'available/allocated funding by stage (no schema field)'],
      docRefs: [],
      note: 'No collection holds funding requirement or staged-funding fields.',
    },
    {
      metric: 'funding_gap_percent', readiness: 'NOT_AVAILABLE',
      availableFields: [],
      missingFields: ['recovery requirement amounts (no schema field)', 'available/allocated funding by stage (no schema field)'],
      docRefs: [],
      note: 'Same as funding_gap: no funding fields in schema.',
    },
    {
      metric: 'physical_gap', readiness: 'BLOCKED',
      availableFields: recovery.some((r) => typeof r.affectedCount === 'number') ? ['recovery.affectedCount'] : [],
      missingFields: ['affected_units with homogeneous units (partial: recovery.affectedCount)', 'recovered_units (no schema field: recovery docs carry statuses, not restored counts)'],
      docRefs: recRefs,
      note: 'Recovery docs track status history, not restored-unit counts; affected counts alone cannot form a gap.',
    },
    {
      metric: 'physical_gap_percent', readiness: 'BLOCKED',
      availableFields: recovery.some((r) => typeof r.affectedCount === 'number') ? ['recovery.affectedCount'] : [],
      missingFields: ['affected_units denominator (partial)', 'recovered_units (no schema field)'],
      docRefs: recRefs,
      note: 'Same as physical_gap: restored counts absent.',
    },
    {
      metric: 'utility_recovery',
      readiness: utilAdapt.readyInputs.length > 0 ? 'READY' : 'BLOCKED',
      availableFields: [
        ...(recovery.some((r) => typeof r.affectedCount === 'number') ? ['recovery.affectedCount'] : []),
        ...(recovery.some((r) => typeof r.restoredCount === 'number') ? ['recovery.restoredCount'] : []),
        ...(recovery.some((r) => typeof r.unit === 'string' && r.unit) ? ['recovery.unit'] : []),
        'recovery.serviceType',
      ],
      missingFields: utilAdapt.readyInputs.length > 0 ? [] : [
        'affected counts with units (recovery.affectedCount/unit — null in sampled docs)',
        'restored counts (recovery.restoredCount — null in sampled docs)',
        ...utilAdapt.blockers.slice(0, 3),
      ],
      docRefs: recRefs,
      note: utilAdapt.readyInputs.length > 0
        ? `${utilAdapt.readyInputs.length} countable service observation(s) via adaptUtilityInputs; range/unit compatibility judged by the engine, not the adapter.`
        : 'No countable affected+restored pair exists; rates cannot be formed without inventing the numerator or denominator.',
    },
    {
      metric: 'ori_index',
      readiness: oriReady ? 'READY' : 'BLOCKED',
      availableFields: utilAdapt.readyInputs.length > 0 ? ['validated service observations (see utility_recovery)'] : [],
      missingFields: oriReady ? [] : ['four validated service recoveries with shared scope (currently blocked: restored counts absent)'],
      docRefs: recRefs,
      note: oriReady
        ? 'All four services countable with compatible scopes; ORI aggregates validated components.'
        : 'ORI aggregates service recoveries; every component is blocked.',
    },
    {
      metric: 'needs_demand', readiness: 'BLOCKED',
      availableFields: needs.some((n) => typeof n.quantityNeeded === 'number') ? ['needs.quantityNeeded', 'needs.unit', 'needs.affectedArea'] : ['needs.affectedArea (when present)'],
      missingFields: ['target population as a number (beneficiaryGroup is a label, not a count)', 'per-person daily rate (no schema field)'],
      docRefs: needRefs,
      note: 'Needs docs describe items, not population×rate demand parameters.',
    },
    {
      metric: 'needs_current_gap', readiness: 'BLOCKED',
      availableFields: needs.some((n) => typeof n.quantityNeeded === 'number') ? ['needs.quantityNeeded', 'needs.unit'] : [],
      missingFields: ['target population as a number (no schema field)', 'per-person rate (no schema field)', 'confirmed usable supply (no stock fields; aidEvents are movement, not stock)'],
      docRefs: [...needRefs, ...aidEvents.slice(0, 5).map((e) => e.id)],
      note: 'Usable-supply fields do not exist; distribution events must not be relabeled as stock.',
    },
    {
      metric: 'needs_forecast_gap', readiness: 'BLOCKED',
      availableFields: aidEvents.some((e) => e.aidStage === 'DISTRIBUTED') ? ['aidEvents.quantity as distributedHistory (movement only)'] : [],
      missingFields: ['demand (blocked)', 'additional backlog (no schema field)', 'usable stock (no schema field)', 'expected incoming supply (no schema field)'],
      docRefs: [...needRefs, ...aidEvents.slice(0, 5).map((e) => e.id)],
      note: 'Forecast inputs beyond distributed history are absent from the schema.',
    },
    {
      metric: 'damage_aggregate', readiness: 'BLOCKED',
      availableFields: hasUsableClaimQty(claims) ? ['claims.quantity', 'claims.unit (unscoped for damage)'] : [],
      missingFields: ['per-category asset counts/costs/severities with compatible scopes (no schema fields)'],
      docRefs: claimRefs,
      note: 'Same as physical_damage: claims lack damage-input semantics.',
    },
  // Claim groups are derived transparently per (claimType, unit) — see
  // liveClaimGroups.buildClaimFactGroups — so stored relation metadata is not
  // required for execution; conflict and lineage handling stays in the engine.
  ];
  const claimGroups = buildClaimFactGroups(incidentId, claims as never[]);
  if (claimGroups.length === 0) {
    out.push({
      metric: 'reconcile_facts', readiness: 'BLOCKED',
      availableFields: [],
      missingFields: ['quantified claims with units (none in scope)'],
      docRefs: claimRefs,
      note: 'No quantified claims in scope; nothing to reconcile.',
    });
  } else {
    out.push({
      metric: 'reconcile_facts', readiness: 'READY',
      availableFields: ['claims.quantity', 'claims.unit', 'claims.claimType (grouping key)', 'claims.sourceUrl lineage', 'claims.conflictingWith (corroboration)'],
      missingFields: [],
      docRefs: claimRefs,
      note: `${claimGroups.length} quantified claim group(s) in scope; relations derived transparently per grouping rule, lineage preserved by the engine.`,
    });
  }
  out.push(
    {
      metric: 'priority_score', readiness: 'NOT_AVAILABLE',
      availableFields: [],
      missingFields: ['severity/gap/vulnerability/time/access components 0–1 (no schema fields)'],
      docRefs: [],
      note: 'No component sources exist in the schema.',
    },
  );
  return out;
}

export function readinessCounts(rows: MetricReadiness[]): Record<LiveReadiness, number> {
  return {
    READY: rows.filter((r) => r.readiness === 'READY').length,
    BLOCKED: rows.filter((r) => r.readiness === 'BLOCKED').length,
    NOT_AVAILABLE: rows.filter((r) => r.readiness === 'NOT_AVAILABLE').length,
  };
}
