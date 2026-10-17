// Data Requirements Inventory & live database audit (read-only).
// Canonical registry of every data item each calculation requires, mapped to
// the real Firestore schema (src/domain/humanitarian.ts). The auditor inspects
// bounded per-incident samples through the existing authorized repository
// layer — it never writes, never invents fields, and never treats a document
// count as a valid calculation input. Formula correctness stays in
// calculationRegistry.ts; this module answers DATA availability only.
// React-free and pure (samples are plain data) so tests use labeled mocks.
import type { ServiceMetric } from '../calculations/calculationService';

export type RequirementSourceKind = 'observed_fact' | 'baseline' | 'parameter' | 'derived_value';

/** Field/data availability — never conflated with formula correctness. */
export type FieldAvailability =
  | 'AVAILABLE' | 'PARTIAL' | 'MISSING' | 'INVALID' | 'STALE' | 'CONFLICT' | 'NOT_CHECKED' | 'NOT_APPLICABLE';

/** Calculation readiness — READY only when every mandatory input is valid. */
export type CalculationReadiness = 'READY' | 'BLOCKED' | 'NOT_AVAILABLE';

export interface DataRequirement {
  requirement_id: string;
  metric_id: string;
  data_item: string;
  description: string;
  required_or_optional: 'required' | 'optional';
  expected_type: 'number' | 'integer' | 'string' | 'timestamp' | 'enum' | 'boolean';
  expected_unit: string | null;
  expected_scope: string;
  source_kind: RequirementSourceKind;
  /** Real Firestore collection, or null when no collection holds it. */
  expected_collection: string | null;
  /** Dot path within the document, or null when no field holds it. */
  expected_field_path: string | null;
  validation_rule: string;
  /** Documented freshness threshold; null = unknown (never guessed STALE). */
  freshness_rule: string | null;
  dependency_ids: string[];
  blocking_if_missing: boolean;
  notes: string;
  // Machine-checked validation (mirrors validation_rule for the auditor):
  /** Sibling field holding the observed unit, if any. */
  unit_field_path?: string | null;
  allowed_units?: string[] | null;
  denied_units?: string[] | null;
  range?: [number, number] | null;
  /** Special conflict signal evaluated by the auditor. */
  conflict_check?: 'conflicting-claims' | null;
}

function req(r: DataRequirement): DataRequirement {
  return r;
}

// Collection names mirror HUMANITARIAN_COLLECTIONS; field paths mirror the
// domain interfaces. Where the schema has no field, expected_collection and
// expected_field_path are null and notes say so explicitly.
export const DATA_REQUIREMENTS: DataRequirement[] = [
  // --- A. Disaster loss estimation ---
  req({ requirement_id: 'req-loss-incident', metric_id: 'physical_damage', data_item: 'Incident ID + geographical scope', description: 'Incident the damage belongs to, with province/area scope.', required_or_optional: 'required', expected_type: 'string', expected_unit: null, expected_scope: 'incident + province/area', source_kind: 'observed_fact', expected_collection: 'incidents', expected_field_path: 'incidentId', validation_rule: 'non-empty string; province present', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Registry data (incidents.id == incidentId).' }),
  req({ requirement_id: 'req-loss-category', metric_id: 'physical_damage', data_item: 'Asset/damage category', description: 'Which asset class the count refers to (house, school, …).', required_or_optional: 'required', expected_type: 'string', expected_unit: null, expected_scope: 'incident', source_kind: 'observed_fact', expected_collection: 'incidentClaims', expected_field_path: 'claimType', validation_rule: 'non-empty claimType', freshness_rule: null, dependency_ids: ['req-loss-incident'], blocking_if_missing: true, notes: 'claimType is free text, not a controlled asset taxonomy.' }),
  req({ requirement_id: 'req-loss-fact-id', metric_id: 'physical_damage', data_item: 'Fact/asset-group ID + lineage', description: 'Stable id plus source URL for traceability.', required_or_optional: 'required', expected_type: 'string', expected_unit: null, expected_scope: 'incident', source_kind: 'observed_fact', expected_collection: 'incidentClaims', expected_field_path: 'id', validation_rule: 'non-empty id; sourceUrl present', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Claim id = stableId(incident, url, type, text).' }),
  req({ requirement_id: 'req-loss-count', metric_id: 'physical_damage', data_item: 'Damaged asset count + unit', description: 'Genuine asset count with an explicit compatible (non-household) unit.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'asset-like unit', expected_scope: 'incident + area + period', source_kind: 'observed_fact', expected_collection: 'incidentClaims', expected_field_path: 'quantity', validation_rule: 'finite number >= 0; sibling unit must not be a household/population unit', freshness_rule: null, dependency_ids: ['req-loss-category'], blocking_if_missing: true, notes: 'Claims carry quantity+unit but no asset-vs-household semantics.', unit_field_path: 'unit', denied_units: ['household', 'households', 'kk', 'family', 'families', 'person', 'people', 'persons', 'jiwa', 'orang'], range: [0, Number.MAX_SAFE_INTEGER] }),
  req({ requirement_id: 'req-loss-cost', metric_id: 'physical_damage', data_item: 'Replacement cost per unit', description: 'Cost per asset in a consistent currency; baseline or assessed.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'IDR/unit (or declared currency)', expected_scope: 'asset type + geography + year', source_kind: 'baseline', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0 with matching currency/area/period', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds replacement costs. Baseline registry does not exist; must come from an explicit assumption, never invented silently.' }),
  req({ requirement_id: 'req-loss-severity', metric_id: 'physical_damage', data_item: 'Damage severity (fraction or %)', description: 'Severity 0–1, or 0–100 with explicitly declared percent unit.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'fraction 0–1 or percent 0–100 (declared)', expected_scope: 'asset type + assessment', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: '0–1 as fraction, 0–100 as declared percent; bare >1 invalid', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds severity. Engine converts only explicitly declared percents.' }),
  req({ requirement_id: 'req-loss-sector', metric_id: 'economic_loss', data_item: 'Economic sector + valid period', description: 'Sector and loss window the flow applies to.', required_or_optional: 'required', expected_type: 'string', expected_unit: null, expected_scope: 'sector + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'sector and period declared and comparable across flows', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds sectors or loss windows.' }),
  req({ requirement_id: 'req-loss-flows', metric_id: 'economic_loss', data_item: 'Normal and actual net-flow values', description: 'Comparable net daily flows in the same metric and unit.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'IDR/day (same metric both sides)', expected_scope: 'sector + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite numbers >= 0, same unit/area/period', freshness_rule: null, dependency_ids: ['req-loss-sector'], blocking_if_missing: true, notes: 'NO schema field holds economic flows; gross vs net must stay labeled.' }),
  req({ requirement_id: 'req-loss-agg-scope', metric_id: 'total_loss', data_item: 'Currency, scope, period + overlap info', description: 'Compatibility evidence for combining damage and flow loss.', required_or_optional: 'required', expected_type: 'string', expected_unit: null, expected_scope: 'incident', source_kind: 'derived_value', expected_collection: null, expected_field_path: null, validation_rule: 'equal currency/area/period; no unresolved overlap', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Derived from component results, not stored anywhere.' }),
  req({ requirement_id: 'req-loss-baseline', metric_id: 'damage_aggregate', data_item: 'Baseline/parameter identifiers', description: 'Cost baselines and severity parameters with versions.', required_or_optional: 'optional', expected_type: 'string', expected_unit: null, expected_scope: 'metric + geography + version', source_kind: 'baseline', expected_collection: null, expected_field_path: null, validation_rule: 'registry id + version when registries exist', freshness_rule: null, dependency_ids: [], blocking_if_missing: false, notes: 'Baseline/parameter registries do not exist; optional until they do.' }),
  // Damage aggregate shares single-category inputs; register its composition rule.
  req({ requirement_id: 'req-lossagg-categories', metric_id: 'damage_aggregate', data_item: 'Disjoint validated categories', description: 'Two or more per-category count/cost/severity sets with compatible scopes.', required_or_optional: 'required', expected_type: 'string', expected_unit: null, expected_scope: 'incident, shared currency/area/period/scope', source_kind: 'derived_value', expected_collection: null, expected_field_path: null, validation_rule: 'same composition rules as req-loss-* per category; disjoint ids', freshness_rule: null, dependency_ids: ['req-loss-count', 'req-loss-cost', 'req-loss-severity'], blocking_if_missing: true, notes: 'Composition of single-category inputs; same schema gaps apply per category.' }),
  req({ requirement_id: 'req-loss-netflow-mirror', metric_id: 'economic_loss_netflow', data_item: 'Normal/actual net flows + duration', description: 'Same as req-loss-flows plus a positive day count.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'IDR/day + days', expected_scope: 'sector + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'same as req-loss-flows; days > 0', freshness_rule: null, dependency_ids: ['req-loss-sector'], blocking_if_missing: true, notes: 'Mirror of req-loss-flows for the net-flow derivation variant.' }),
  // --- B. Financial recovery gap ---
  req({ requirement_id: 'req-fund-required', metric_id: 'funding_gap', data_item: 'Required recovery cost', description: 'Total recovery requirement in incident currency.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'IDR (declared currency)', expected_scope: 'incident/area + program + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds recovery requirements.' }),
  req({ requirement_id: 'req-fund-available', metric_id: 'funding_gap', data_item: 'Available allocated funding', description: 'Funds in the explicitly required stage (available, not pledged).', required_or_optional: 'required', expected_type: 'number', expected_unit: 'same currency as requirement', expected_scope: 'same program + period as requirement', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0; stage must match the required stage', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds staged funding; pledged ≠ available.' }),
  req({ requirement_id: 'req-fund-stage', metric_id: 'funding_gap', data_item: 'Funding allocation/availability status', description: 'Stage of the available figure: pledged/allocated/disbursed/available.', required_or_optional: 'required', expected_type: 'enum', expected_unit: null, expected_scope: 'program + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'one of the four stages; stages never interchanged', freshness_rule: null, dependency_ids: ['req-fund-available'], blocking_if_missing: true, notes: 'Stage metadata exists nowhere in the schema.' }),
  req({ requirement_id: 'req-fund-unusable', metric_id: 'funding_gap', data_item: 'Committed/restricted/unusable funding info', description: 'Funds that must be excluded from the available figure.', required_or_optional: 'optional', expected_type: 'number', expected_unit: 'same currency', expected_scope: 'program + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0 when present', freshness_rule: null, dependency_ids: [], blocking_if_missing: false, notes: 'Optional refinement; absent from schema.' }),
  req({ requirement_id: 'req-fundpct-mirror', metric_id: 'funding_gap_percent', data_item: 'Same inputs as funding gap', description: 'Percent variant reuses requirement + available + stage.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'same currency', expected_scope: 'same as funding_gap', source_kind: 'derived_value', expected_collection: null, expected_field_path: null, validation_rule: 'denominator > 0 or withheld', freshness_rule: null, dependency_ids: ['req-fund-required', 'req-fund-available', 'req-fund-stage'], blocking_if_missing: true, notes: 'Derived from the funding-gap inputs.' }),
  // --- C. Physical recovery gap ---
  req({ requirement_id: 'req-phys-affected', metric_id: 'physical_gap', data_item: 'Total units needing recovery', description: 'Affected-unit denominator with homogeneous unit.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'homogeneous asset unit', expected_scope: 'incident cohort', source_kind: 'observed_fact', expected_collection: 'incidentRecovery', expected_field_path: 'affectedCount', validation_rule: 'finite integer >= 0 with unit present', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'affectedCount exists but is sparse; homogeneous cohort not guaranteed.' }),
  req({ requirement_id: 'req-phys-restored', metric_id: 'physical_gap', data_item: 'Units restored', description: 'Restored count between zero and affected.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'same unit as affected', expected_scope: 'same cohort as affected', source_kind: 'observed_fact', expected_collection: 'incidentRecovery', expected_field_path: 'restoredCount', validation_rule: '0 ≤ restored ≤ affected', freshness_rule: null, dependency_ids: ['req-phys-affected'], blocking_if_missing: true, notes: 'Contract field exists since the recovery-counts change; values still absent in production docs (null = unknown, never zero).' }),
  req({ requirement_id: 'req-phys-tempperm', metric_id: 'physical_gap', data_item: 'Temporary vs permanent status', description: 'Whether restoration is temporary or permanent, if recorded.', required_or_optional: 'optional', expected_type: 'enum', expected_unit: null, expected_scope: 'cohort', source_kind: 'observed_fact', expected_collection: 'incidentRecovery', expected_field_path: 'history.status', validation_rule: 'valid RecoveryStatus per service type when present', freshness_rule: null, dependency_ids: [], blocking_if_missing: false, notes: 'Status history exists; restored-count semantics still absent.' }),
  req({ requirement_id: 'req-physpct-mirror', metric_id: 'physical_gap_percent', data_item: 'Same inputs as physical gap', description: 'Percent variant reuses affected + restored.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'same unit', expected_scope: 'same cohort', source_kind: 'derived_value', expected_collection: null, expected_field_path: null, validation_rule: 'denominator > 0 or withheld', freshness_rule: null, dependency_ids: ['req-phys-affected', 'req-phys-restored'], blocking_if_missing: true, notes: 'Derived from the physical-gap inputs.' }),
  // --- D. Utility recovery + ORI ---
  req({ requirement_id: 'req-util-affected', metric_id: 'utility_recovery', data_item: 'Affected units per service', description: 'Affected households/customers/km per service with unit.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'households | customers | km (per service)', expected_scope: 'service + area + period', source_kind: 'observed_fact', expected_collection: 'incidentRecovery', expected_field_path: 'affectedCount', validation_rule: 'finite integer > 0 with matching service unit', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Unit compatibility checked against UTILITY_UNITS.', unit_field_path: 'unit' }),
  req({ requirement_id: 'req-util-restored', metric_id: 'utility_recovery', data_item: 'Restored/functional units meeting criteria', description: 'Previously-affected units meeting the adequate-service criterion.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'same unit as affected', expected_scope: 'same service + area + period', source_kind: 'observed_fact', expected_collection: 'incidentRecovery', expected_field_path: 'restoredCount', validation_rule: '0 ≤ restored ≤ affected; operational criterion stated', freshness_rule: null, dependency_ids: ['req-util-affected'], blocking_if_missing: true, notes: 'Contract field exists since the recovery-counts change; values still absent in production docs. Out-of-range values surface as invalid_input, never clamped.' }),
  req({ requirement_id: 'req-util-criteria', metric_id: 'utility_recovery', data_item: 'Restoration criteria + temp/permanent flag', description: 'Operational definition of adequate restoration; durability when known.', required_or_optional: 'optional', expected_type: 'string', expected_unit: null, expected_scope: 'service observation', source_kind: 'observed_fact', expected_collection: 'incidentRecovery', expected_field_path: 'restorationCriterion', validation_rule: 'criterion stated when rate is asserted', freshness_rule: null, dependency_ids: [], blocking_if_missing: false, notes: 'Contract field since the recovery-counts change; engine warns when absent. Durability comes from history statuses.' }),
  req({ requirement_id: 'req-ori-services', metric_id: 'ori_index', data_item: 'Four validated service recoveries', description: 'Water, electricity, access, telecom recoveries with compatible scopes.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'percent per service', expected_scope: 'shared area + period', source_kind: 'derived_value', expected_collection: null, expected_field_path: null, validation_rule: 'all four calculated; shared geography and period', freshness_rule: null, dependency_ids: ['req-util-affected', 'req-util-restored'], blocking_if_missing: true, notes: 'Derived from utility-recovery components.' }),
  req({ requirement_id: 'req-ori-weights', metric_id: 'ori_index', data_item: 'ORI weights 30/25/25/20 + policy v1.0', description: 'Centrally defined weights summing to 1; withhold (no redistribution) policy.', required_or_optional: 'required', expected_type: 'string', expected_unit: null, expected_scope: 'global (code)', source_kind: 'parameter', expected_collection: null, expected_field_path: null, validation_rule: 'weights sum exactly 1; version recorded', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Parameter lives in code (ORI_WEIGHTS, ori-composite-v1.0), not in Firestore — NOT_APPLICABLE for DB audit, satisfied by code.' }),
  // --- E. Current needs gap ---
  req({ requirement_id: 'req-curgap-pop', metric_id: 'needs_current_gap', data_item: 'Population/demand basis per commodity', description: 'Numeric target population for the commodity.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'people', expected_scope: 'commodity + area + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'beneficiaryGroup is a label, not a count; quantityNeeded is per-item, not population-based.' }),
  req({ requirement_id: 'req-curgap-rate', metric_id: 'needs_current_gap', data_item: 'Demand rate + unit/period', description: 'Per-person requirement rate with commodity unit.', required_or_optional: 'required', expected_type: 'number', expected_unit: '<commodity-unit>/person', expected_scope: 'commodity + period', source_kind: 'baseline', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds rates (e.g. portions/person/day). Must come from an explicit baseline/assumption.' }),
  req({ requirement_id: 'req-curgap-supply', metric_id: 'needs_current_gap', data_item: 'Current usable supply/stock', description: 'Stock confirmed usable and distributable now, same unit.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'same commodity unit', expected_scope: 'commodity + area + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0; confirmed usable', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO stock fields exist; aidEvents are movement, never stock. Distribution history must stay excluded.' }),
  req({ requirement_id: 'req-curgap-usable', metric_id: 'needs_current_gap', data_item: 'Usability confirmation + distribution exclusion', description: 'Proof supply is usable; distributed aid kept separate.', required_or_optional: 'required', expected_type: 'boolean', expected_unit: null, expected_scope: 'commodity + area + period', source_kind: 'observed_fact', expected_collection: 'incidentAidEvents', expected_field_path: 'aidStage', validation_rule: 'DISTRIBUTED events excluded from stock, never subtracted silently', freshness_rule: null, dependency_ids: ['req-curgap-supply'], blocking_if_missing: true, notes: 'Stage discipline exists (AidStage); usability confirmation does not.' }),
  // --- F. Forecast needs gap ---
  req({ requirement_id: 'req-forecast-pop', metric_id: 'needs_forecast_gap', data_item: 'Forecast population/demand per horizon', description: 'Expected needing population per horizon period.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'people', expected_scope: 'commodity + area + horizon', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0 per horizon slice', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds forecast populations.' }),
  req({ requirement_id: 'req-forecast-rate', metric_id: 'needs_forecast_gap', data_item: 'Demand rate + unit/period', description: 'Same rate semantics as the current gap.', required_or_optional: 'required', expected_type: 'number', expected_unit: '<commodity-unit>/person', expected_scope: 'commodity + period', source_kind: 'baseline', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Same baseline gap as req-curgap-rate.' }),
  req({ requirement_id: 'req-forecast-backlog', metric_id: 'needs_forecast_gap', data_item: 'Backlog outside demand window', description: 'Unmet demand not already in the demand period.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'same commodity unit', expected_scope: 'commodity, outside window', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0; window disjointness declared', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds backlog.' }),
  req({ requirement_id: 'req-forecast-stock', metric_id: 'needs_forecast_gap', data_item: 'Current usable stock', description: 'Unexpired, accessible stock for the population and period.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'same commodity unit', expected_scope: 'commodity + area + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0; usability confirmed', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Same stock gap as req-curgap-supply.' }),
  req({ requirement_id: 'req-forecast-incoming', metric_id: 'needs_forecast_gap', data_item: 'Expected incoming: qty, arrival, usability, expiry, capacity', description: 'Scoped, confirmed incoming supply with logistics metadata.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'same commodity unit', expected_scope: 'commodity + area + horizon', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite number >= 0; scope + confirmation declared', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds incoming supply metadata.' }),
  req({ requirement_id: 'req-forecast-scenario', metric_id: 'needs_forecast_gap', data_item: 'Forecast scenario + assumption IDs', description: 'Which scenario (low/base/high or named) and its assumptions.', required_or_optional: 'optional', expected_type: 'string', expected_unit: null, expected_scope: 'forecast run', source_kind: 'parameter', expected_collection: null, expected_field_path: null, validation_rule: 'scenario labeled; never presented as ML prediction', freshness_rule: null, dependency_ids: [], blocking_if_missing: false, notes: 'Single-scenario engine today; scenario registry does not exist.' }),
  // Demand shares population/rate semantics; register its horizon input.
  req({ requirement_id: 'req-demand-horizon', metric_id: 'needs_demand', data_item: 'Population, rate, horizon days', description: 'Constant-population demand over a stated horizon.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'people; <unit>/person/day; days', expected_scope: 'commodity + area + horizon', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'finite numbers >= 0; days > 0', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Same population/rate schema gaps as the current gap, plus horizon days.' }),
  // --- G. Priority + override ---
  req({ requirement_id: 'req-prio-s', metric_id: 'priority_score', data_item: 'S severity 0–1 + definition + source', description: 'Normalized severity with source reference.', required_or_optional: 'required', expected_type: 'number', expected_unit: '0–1', expected_scope: 'incident + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: '0–1 inclusive; missing never zero', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds normalized priority components.' }),
  req({ requirement_id: 'req-prio-g', metric_id: 'priority_score', data_item: 'G gap ratio 0–1 + definition + source', description: 'Normalized need-gap ratio with source reference.', required_or_optional: 'required', expected_type: 'number', expected_unit: '0–1', expected_scope: 'incident + period', source_kind: 'derived_value', expected_collection: null, expected_field_path: null, validation_rule: '0–1 inclusive; derived from gap outputs when available', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Derivable from gap results; no direct source field.' }),
  req({ requirement_id: 'req-prio-v', metric_id: 'priority_score', data_item: 'V vulnerability 0–1 + definition + source', description: 'Normalized vulnerability with source reference.', required_or_optional: 'required', expected_type: 'number', expected_unit: '0–1', expected_scope: 'incident + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: '0–1 inclusive', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds normalized vulnerability.' }),
  req({ requirement_id: 'req-prio-t', metric_id: 'priority_score', data_item: 'T time urgency 0–1 + definition + source', description: 'Normalized time urgency with source reference.', required_or_optional: 'required', expected_type: 'number', expected_unit: '0–1', expected_scope: 'incident + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: '0–1 inclusive', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds normalized urgency.' }),
  req({ requirement_id: 'req-prio-a', metric_id: 'priority_score', data_item: 'A access barriers 0–1 + definition + source', description: 'Normalized access constraint with source reference.', required_or_optional: 'required', expected_type: 'number', expected_unit: '0–1', expected_scope: 'incident + period', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: '0–1 inclusive', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'NO schema field holds normalized access barriers.' }),
  req({ requirement_id: 'req-prio-weights', metric_id: 'priority_score', data_item: 'Priority weights 30/25/20/15/10 + v1.0', description: 'Centrally defined weights summing to 1 with version.', required_or_optional: 'required', expected_type: 'string', expected_unit: null, expected_scope: 'global (code)', source_kind: 'parameter', expected_collection: null, expected_field_path: null, validation_rule: 'weights sum exactly 1; version recorded', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Parameter lives in code (PRIORITY_WEIGHTS, priority-mvp-v1.0) — NOT_APPLICABLE for DB audit, satisfied by code.' }),
  req({ requirement_id: 'req-prio-override', metric_id: 'priority_score', data_item: 'Life-safety trigger evidence + policies', description: 'Explicit life-threat evidence plus missing-input/override policies.', required_or_optional: 'optional', expected_type: 'boolean', expected_unit: null, expected_scope: 'incident', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'lifeThreat explicitly true; triggers assessment only', freshness_rule: null, dependency_ids: [], blocking_if_missing: false, notes: 'No life-threat evidence field in schema; override criteria live in code.' }),
  // Reconciliation inputs.
  req({ requirement_id: 'req-recon-facts', metric_id: 'reconcile_facts', data_item: 'Fact quantities + units + lineage', description: 'Quantified facts with units and source lineage.', required_or_optional: 'required', expected_type: 'number', expected_unit: 'declared unit', expected_scope: 'incident + scope', source_kind: 'observed_fact', expected_collection: 'incidentClaims', expected_field_path: 'quantity', validation_rule: 'finite number >= 0 with unit; lineage (sourceUrl) present', freshness_rule: null, dependency_ids: [], blocking_if_missing: true, notes: 'Closest schema fit: claims carry quantity/unit/sourceUrl/conflictingWith.', unit_field_path: 'unit', conflict_check: 'conflicting-claims' }),
  req({ requirement_id: 'req-recon-relations', metric_id: 'reconcile_facts', data_item: 'Relation metadata + disjointness proof', description: 'Total/subset/parent linkage or confirmed disjointness.', required_or_optional: 'required', expected_type: 'string', expected_unit: null, expected_scope: 'fact set', source_kind: 'observed_fact', expected_collection: null, expected_field_path: null, validation_rule: 'relations declared or disjointness explicitly confirmed', freshness_rule: null, dependency_ids: ['req-recon-facts'], blocking_if_missing: true, notes: 'NO schema field holds relation metadata; conflictingWith signals conflict only. Execution derives grouping transparently per (claimType, unit) in liveClaimGroups — see adapter readiness, which stays the executability dimension.' }),
];

export const REQUIREMENT_KINDS: Record<string, string> = {
  observed_fact: 'Observasi',
  baseline: 'Baseline',
  parameter: 'Parameter',
  derived_value: 'Turunan',
};

// ---------------------------------------------------------------------------
// Read-only audit engine. Samples are plain data handed in by the caller
// (the page supplies bounded per-incident reads from loadHumanitarian).
// ---------------------------------------------------------------------------

export interface CollectionSample {
  /** Real collection name, e.g. 'incidentClaims'. */
  collection: string;
  /** Query bound applied (limit), for scope disclosure. */
  limit: number;
  /** True when the query filtered incidentId == incident. */
  incidentScoped: boolean;
  docs: Array<{ id: string; data: Record<string, unknown> }>;
}

export interface AuditScope {
  incidentId: string;
  /** True when the authorized read path succeeded this session. */
  accessOk: boolean;
  /** Safe error category when accessOk is false (never raw errors/secrets). */
  errorCategory: string | null;
  samples: CollectionSample[];
  auditedAt: string;
}

export interface RequirementAudit {
  requirement_id: string;
  status: FieldAvailability;
  validCount: number;
  invalidCount: number;
  missingCount: number;
  totalRecords: number;
  /** Why this status (blockers, unit mismatches, conflict evidence). */
  reasons: string[];
  /** 'unknown' unless a documented freshness_rule exists and is evaluated. */
  freshness: 'known-fresh' | 'unknown' | 'stale';
}

function getPath(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc !== null && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, data);
}

function isMissingValue(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function checkType(r: DataRequirement, v: unknown): boolean {
  switch (r.expected_type) {
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'integer':
      return typeof v === 'number' && Number.isInteger(v);
    case 'string':
      return typeof v === 'string' && v.trim() !== '';
    case 'timestamp':
      return typeof v === 'string' && Number.isFinite(Date.parse(v));
    case 'enum':
      return typeof v === 'string' && v.trim() !== '';
    case 'boolean':
      return typeof v === 'boolean';
    default:
      return false;
  }
}

function checkRange(r: DataRequirement, v: unknown): boolean {
  if (!r.range || typeof v !== 'number') return true;
  return v >= r.range[0] && v <= r.range[1];
}

function checkUnit(r: DataRequirement, doc: Record<string, unknown>): boolean {
  if (!r.unit_field_path) return true;
  const u = getPath(doc, r.unit_field_path);
  if (typeof u !== 'string' || u.trim() === '') return false;
  const norm = u.toLowerCase().trim();
  if (r.denied_units && r.denied_units.includes(norm)) return false;
  if (r.allowed_units && !r.allowed_units.includes(norm)) return false;
  return true;
}

export function auditRequirement(r: DataRequirement, scope: AuditScope): RequirementAudit {
  const base = {
    requirement_id: r.requirement_id,
    validCount: 0, invalidCount: 0, missingCount: 0, totalRecords: 0,
    reasons: [] as string[], freshness: 'unknown' as const,
  };
  // Parameters/baselines living in code are not database fields.
  if (r.expected_collection === null) {
    return {
      ...base,
      status: r.source_kind === 'parameter' || r.source_kind === 'baseline' ? 'NOT_APPLICABLE' : 'MISSING',
      reasons: [r.source_kind === 'derived_value'
        ? 'Derived at calculation time, not stored — availability follows its dependencies.'
        : `No '${r.data_item}' field exists in the Firestore schema (${r.notes})`],
    };
  }
  if (!scope.accessOk) {
    return { ...base, status: 'NOT_CHECKED', reasons: [`Database access not performed this session${scope.errorCategory ? ` (${scope.errorCategory})` : ''}.`] };
  }
  const sample = scope.samples.find((s) => s.collection === r.expected_collection);
  if (!sample) {
    return { ...base, status: 'NOT_CHECKED', reasons: [`Collection '${r.expected_collection}' was not sampled in this audit scope.`] };
  }
  const reasons: string[] = [];
  let valid = 0, invalid = 0, missing = 0;
  let conflictEvidence: string | null = null;
  for (const doc of sample.docs) {
    const v = r.expected_field_path ? getPath(doc.data, r.expected_field_path) : undefined;
    if (isMissingValue(v)) { missing++; continue; }
    if (!checkType(r, v) || !checkRange(r, v) || !checkUnit(r, doc.data)) { invalid++; continue; }
    valid++;
    if (r.conflict_check === 'conflicting-claims') {
      const cw = getPath(doc.data, 'conflictingWith');
      if (Array.isArray(cw) && cw.length > 0 && !conflictEvidence) conflictEvidence = doc.id;
    }
  }
  const total = sample.docs.length;
  let status: FieldAvailability;
  if (total === 0) {
    status = 'MISSING';
    reasons.push(`No '${r.expected_collection}' records in scope (limit ${sample.limit}${sample.incidentScoped ? ', incident-filtered' : ''}) — required value absent.`);
  } else if (conflictEvidence) {
    status = 'CONFLICT';
    reasons.push(`Conflicting lineage on record '${conflictEvidence}' (conflictingWith non-empty) — unresolved provenance.`);
  } else if (valid === total) {
    status = 'AVAILABLE';
  } else if (valid > 0) {
    status = 'PARTIAL';
    reasons.push(`${valid}/${total} records valid; ${invalid} invalid, ${missing} missing.`);
  } else if (invalid > 0) {
    status = 'INVALID';
    reasons.push(`${invalid}/${total} records fail ${r.validation_rule}.`);
  } else {
    status = 'MISSING';
    reasons.push(`Field '${r.expected_field_path}' absent in all ${total} sampled records.`);
  }
  return { requirement_id: r.requirement_id, status, validCount: valid, invalidCount: invalid, missingCount: missing, totalRecords: total, reasons, freshness: 'unknown' };
}

export function auditRequirements(reqs: DataRequirement[], scope: AuditScope): RequirementAudit[] {
  return reqs.map((r) => auditRequirement(r, scope));
}

export interface MetricReadiness {
  metric_id: string;
  readiness: CalculationReadiness;
  mandatoryTotal: number;
  availableCount: number;
  partialCount: number;
  missingCount: number;
  invalidCount: number;
  staleCount: number;
  conflictCount: number;
  notCheckedCount: number;
  coverageNumerator: number;
  coverageDenominator: number;
  /** Strict data-completeness share: valid mandatory / total mandatory. */
  coverage: number | null;
  blockers: string[];
  satisfiedRequirementIds: string[];
}

/** Metric readiness from its requirement audits. PARTIAL mandatory counts as
    blocked (coverage incomplete); NOT_CHECKED degrades to NOT_AVAILABLE. */
export function assessMetricReadiness(metricId: string, audits: RequirementAudit[]): MetricReadiness {
  const reqs = DATA_REQUIREMENTS.filter((r) => r.metric_id === metricId && r.required_or_optional === 'required');
  const byId = new Map(audits.map((a) => [a.requirement_id, a]));
  let available = 0, partial = 0, missing = 0, invalid = 0, stale = 0, conflict = 0, notChecked = 0;
  const blockers: string[] = [];
  const satisfied: string[] = [];
  for (const r of reqs) {
    const a = byId.get(r.requirement_id);
    if (!a) {
      notChecked++;
      blockers.push(`${r.requirement_id}: not audited`);
      continue;
    }
    switch (a.status) {
      case 'AVAILABLE': available++; satisfied.push(r.requirement_id); break;
      case 'PARTIAL':
        partial++;
        blockers.push(`${r.requirement_id}: partial coverage (${a.validCount}/${a.totalRecords} valid) — incomplete`);
        break;
      case 'MISSING': missing++; blockers.push(`${r.requirement_id}: missing — ${a.reasons.join(' ')}`); break;
      case 'INVALID': invalid++; blockers.push(`${r.requirement_id}: invalid — ${a.reasons.join(' ')}`); break;
      case 'STALE': stale++; blockers.push(`${r.requirement_id}: stale — ${a.reasons.join(' ')}`); break;
      case 'CONFLICT': conflict++; blockers.push(`${r.requirement_id}: conflict — ${a.reasons.join(' ')}`); break;
      case 'NOT_CHECKED': notChecked++; blockers.push(`${r.requirement_id}: not checked — ${a.reasons.join(' ')}`); break;
      case 'NOT_APPLICABLE': available++; satisfied.push(r.requirement_id); break;
    }
  }
  const total = reqs.length;
  // Coverage counts strictly valid (AVAILABLE, incl. code-satisfied
  // parameters) over total mandatory — optional fields never inflate it.
  // NOT_CHECKED degrades the whole metric to NOT_AVAILABLE (access unknown);
  // any other gap BLOCKS; READY needs every mandatory requirement valid.
  const readiness: CalculationReadiness =
    notChecked > 0 ? 'NOT_AVAILABLE'
    : (missing + invalid + stale + conflict + partial) > 0 ? 'BLOCKED'
    : 'READY';
  return {
    metric_id: metricId, readiness, mandatoryTotal: total,
    availableCount: available, partialCount: partial, missingCount: missing,
    invalidCount: invalid, staleCount: stale, conflictCount: conflict,
    notCheckedCount: notChecked,
    coverageNumerator: available, coverageDenominator: total,
    coverage: total > 0 ? available / total : null,
    blockers, satisfiedRequirementIds: satisfied,
  };
}

export function metricsWithRequirements(): string[] {
  return [...new Set(DATA_REQUIREMENTS.map((r) => r.metric_id))];
}
