# Calculation Service — shared consumption contract

`src/services/calculations/calculationService.ts` is the stable boundary for
dashboard, incident detail, recovery monitoring, and needs intelligence.
Consumers call `runCalculation()` — they never reimplement formulas.

## Interface

```ts
import { runCalculation, metricLabel, listSupportedMetrics } from './src/services/calculations/calculationService';

const response = runCalculation({
  metric: 'ori_index',          // 16 supported metrics (see listSupportedMetrics())
  incidentId: null,             // set for incident runs; null for scenarios
  validTime: null,              // ISO observation time, when known
  baselineIds: [],              // empty until baseline registries exist
  mode: 'scenario',             // 'current' | 'scenario' | 'forecast'
  origin: 'simulation',         // 'simulation' | 'live' — explicit, never inferred
  calculationId: 'proof-ori',   // optional correlation id
  input: { /* metric-specific engine input */ },
});
// response: { metric, mode, result: CalculationResult, extendedStatus }
```

## Lanes
- `current` — point-in-time measurement (damage, gaps, utility, current gap).
- `scenario` — explicitly simulated inputs → `scenario_estimate`.
- `forecast` — forward projection (`needs_forecast_gap` always maps here).

## Extended status (derived, engine `status` trio unchanged)
`calculated` · `scenario_estimate` · `forecast` · `insufficient_data` ·
`invalid_input` · `conflict_pending_review` (withheld + conflict markers) ·
`stale_data` (only with an explicit `maxAgeMs` freshness bound).

Withheld results keep `value: null` plus `missingInputs[]` and blocker text in
`warnings`/`trace`. Missing inputs are never zero-filled.

## Live adapter
`src/services/calculations/liveAdapter.ts` — `assessLiveReadiness(snapshot,
incidentId)` reports per-metric `READY` / `BLOCKED` / `NOT_AVAILABLE` with
exact missing fields, using only schema fields that demonstrably exist.
Current schema truthfully yields no READY metric (restored counts, funding
fields, population/rate/stock fields are absent); the adapter reports blockers
instead of inventing inputs. Read-only; no persistence.

## Backend wrapping (future, not implemented)
A backend endpoint could accept `ServiceRequest` JSON, call `runCalculation()`,
and return `ServiceResponse` JSON unchanged — the types are plain data. No new
server, Cloud Function, or public endpoint is added here; none is needed for
the current Spark-architecture browser flow. No calculation-run persistence
exists; immutability/audit-run storage is explicitly out of scope.

## Representative response contract
Field set of every `result` (see `CalculationResult`): `metricId`,
`incidentId`, `value`, `unit`, `status`, `scope{area,period}`, `version`,
`baselineIds`, `sourceFactIds`, `assumptions`, `missingInputs`, `uncertainty`,
`coverage`, `validTime`, `calculatedAt` (`calculated_at`), `warnings`, `trace`,
`id`, `origin`.

### EXAMPLE payload (shape illustration — not an execution result)
```json
{
  "metric": "needs_current_gap",
  "mode": "current",
  "result": {
    "metricId": "needs_current_gap", "incidentId": "padang",
    "value": 600, "unit": "portions", "status": "calculated",
    "scope": { "area": "padang", "period": "2026-10-16" },
    "version": "disaster-insights-v1.0", "baselineIds": [],
    "sourceFactIds": ["need-doc-1"], "missingInputs": [],
    "coverage": "padang / 2026-10-16", "calculatedAt": "<ISO>"
  },
  "extendedStatus": "calculated"
}
```

### Real captured execution (synthetic fixture, from `tests/calculationService.test.ts`)
`runCalculation({ metric: 'ori_index', mode: 'scenario', origin: 'simulation',
input: { components: [water 40/200, electricity 300/400, access 2/5km,
telecom 480/600] } })`
→ `value: 50.75`, `unit: 'index 0–100'`, `status: 'calculated'`,
`extendedStatus: 'scenario_estimate'`, `metricId: 'ori_index'`,
`trace: '0.30×20+0.25×75+0.25×40+0.20×80 = 50.75 (index)'`.

## Data requirements inventory & live availability audit
Canonical registry: `src/services/verification/requirementsInventory.ts`
(`DATA_REQUIREMENTS`, one row per required input across all 16 metrics, mapped
to real `humanitarian.ts` collections/fields; parameters living in code are
marked `NOT_APPLICABLE` for DB audit, never faked as observed).

- Auditor evaluates bounded per-incident samples from the existing
  `loadHumanitarian()` reads (limits 50–200, incident-filtered; incidents list
  50). Conclusions are scoped to the audited incident and those bounds — never
  to the whole database. Read-only; no writes, migration, or seeding.
- Availability: `AVAILABLE` / `PARTIAL` / `MISSING` / `INVALID` / `STALE` /
  `CONFLICT` / `NOT_CHECKED` / `NOT_APPLICABLE`. Freshness is `unknown`
  everywhere: no freshness threshold is documented, so nothing is labeled
  stale. `STALE` exists in the vocabulary for future documented rules.
- Coverage = valid mandatory requirements / total mandatory requirements
  (optionals excluded). Completeness indicator only — not confidence, not proof
  of accuracy. `READY` requires every mandatory requirement valid in the same
  incident/scope/unit/period.
- Observed truth (current schema): restored-unit counts, funding fields,
  population/rate/stock fields, severity, durations, and baseline registries
  are absent — so every metric except claim reconciliation is blocked. The
  exception is `reconcile_facts`: quantified claims carry quantity/unit/lineage,
  and `liveClaimGroups.buildClaimFactGroups` derives (claimType, unit) groups
  transparently (singletons → canonical singles; competing values → conflict
  withhold with lineage). The `/calculation` "Data Requirements & Availability"
  section shows per-metric readiness, exact missing fields, valid/total counts,
  and blockers instead of numbers. Mock-based unit tests
  (`tests/requirementsInventory.test.tsx`) prove auditor logic only and are
  labeled MOCK; they prove nothing about production data.

## Recovery-count data contract (additive, Iteration 3)

- `incidentRecovery` docs gained two optional fields, resolved in
  `src/domain/humanitarian.ts`: `restoredCount: number | null` and
  `restorationCriterion: string | null`. Absent/`null` = unknown, never zero.
  Legacy docs without the fields remain valid (read as `undefined` → unknown).
- Ingestion: `crawlMerge.mergeRecovery` fill-gaps both fields (incoming non-null
  fills a null; existing values are never overwritten). `needsRecovery.extractRecovery`
  still emits `null` for both — counts are only written by a source that states
  them. A conservative `extractServiceCounts(title, summary)` parser exists as
  groundwork and returns all-`null` unless a count carries an explicit unit and
  an unambiguous affected/restored verb; it is **not** wired into the crawl
  pipeline (pending review) and never sums or infers.
- Adapter: `liveAdapter.adaptUtilityInputs(incidentId, recovery)` maps countable
  observations to `utility_recovery` inputs keyed by service. It blocks on null
  counts or missing unit, blocks duplicate countable docs for the same
  service+area (never picks), skips non-utility services and other incidents, and
  passes unit compatibility to the engine (`estimateUtilityRecovery` rejects an
  observed unit that differs from the service's canonical unit instead of coercing).
- Definition of done: **path 2 — data gap precisely identified, groundwork in
  place, no manufactured result.** Live probe of production `incidentRecovery`
  (66 docs) shows `affectedCount`/`restoredCount`/`unit` all `null` and zero docs
  carrying `restoredCount`, so the `/calculation` live utility section renders the
  exact missing-field blocker and runs nothing. No live `utility_recovery` value
  can be produced until a source reports affected+restored counts with units.

