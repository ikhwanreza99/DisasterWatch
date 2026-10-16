import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimatePhysicalDamage, estimateEconomicLoss, estimateEconomicLossNetFlow, estimateTotalLoss,
  estimateFundingGap, estimateFundingGapPercent, estimatePhysicalGapCount, estimatePhysicalGapPercent,
  estimateUtilityRecovery, estimateNeedsDemand, estimateForecastGap, scorePriority,
  evaluateLifeSafetyOverride, classifyNeedTier, priorityWeightsSum, duplicateFactIds,
  roundIdr, PRIORITY_WEIGHTS, PRIORITY_VERSION, CALCULATION_ENGINE_VERSION, METHOD_VERSION,
  damage, economicLoss, totalLoss, gap, gapPercent, utilityRecovery, forecast, priority,
} from '../src/services/insights/formulas';
import { summariseLiveInputs } from '../src/services/insights/calculationInputs';

// 1. All four reference simulations produce the expected results.
test('reference: loss 5x150M x0.5 + 100M x3d = 675M', () => {
  const d = estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 150_000_000, damageFraction: 0.5, currency: 'IDR', area: 't', period: 'p' });
  assert.equal(d.status, 'calculated'); assert.equal(d.value, 375_000_000);
  const e = estimateEconomicLoss({ dailyEconomicLoss: 100_000_000, durationDays: 3, currency: 'IDR', area: 't', period: 'p' });
  assert.equal(e.value, 300_000_000);
  const t = estimateTotalLoss(d, e);
  assert.equal(t.status, 'calculated'); assert.equal(t.value, 675_000_000);
  assert.match(t.trace, /675000000/);
});

test('reference: funding gap 500M-120M=380M/76%; physical 5-1=4/80%', () => {
  const f = estimateFundingGap({ requirement: 500_000_000, available: 120_000_000, requirementStage: 'available', availableStage: 'available' });
  assert.equal(f.value, 380_000_000); assert.equal(f.status, 'calculated');
  const fp = estimateFundingGapPercent({ requirement: 500_000_000, available: 120_000_000, requirementStage: 'available', availableStage: 'available' });
  assert.equal(fp.value, 76);
  const p = estimatePhysicalGapCount({ affectedUnits: 5, recoveredUnits: 1, unit: 'asset' });
  assert.equal(p.value, 4);
  const pp = estimatePhysicalGapPercent({ affectedUnits: 5, recoveredUnits: 1, unit: 'asset' });
  assert.equal(pp.value, 80);
});

test('reference: utility water 20 / electricity 75 / road 40 / telecom 80', () => {
  assert.equal(estimateUtilityRecovery({ service: 'water', affected: 200, recovered: 40, operationalDefinition: 'piped flow restored' }).value, 20);
  assert.equal(estimateUtilityRecovery({ service: 'electricity', affected: 400, recovered: 300, operationalDefinition: 'meter energised' }).value, 75);
  assert.equal(estimateUtilityRecovery({ service: 'access', affected: 5, recovered: 2, operationalDefinition: 'km passable' }).value, 40);
  assert.equal(estimateUtilityRecovery({ service: 'telecom', affected: 600, recovered: 480, operationalDefinition: 'signal restored' }).value, 80);
});

test('reference: demand 672x3x3=6048, gap with zeros=6048, priority=88', () => {
  const d = estimateNeedsDemand({ targetPopulation: 672, dailyRequirementPerPerson: 3, durationDays: 3, unit: 'portions' });
  assert.equal(d.value, 6048);
  const g = estimateForecastGap({ demand: 6048, additionalBacklog: 0, usableStock: 0, expectedIncoming: 0, unit: 'portions' });
  assert.equal(g.status, 'calculated'); assert.equal(g.value, 6048);
  const s = scorePriority({ S: 0.9, G: 1.0, V: 0.8, T: 1.0, A: 0.5 });
  assert.equal(s.value, 88); assert.equal(s.status, 'calculated');
  assert.equal(s.version, PRIORITY_VERSION);
});

// 2. Zero values where zero is valid.
test('zero is valid for costs/losses/gaps, never silently for missing', () => {
  assert.equal(estimatePhysicalDamage({ assetCount: 0, replacementCostPerAsset: 150_000_000, damageFraction: 0.5 }).value, 0);
  assert.equal(estimateFundingGap({ requirement: 100, available: 100 }).value, 0);
  assert.equal(estimateForecastGap({ demand: 100, additionalBacklog: 0, usableStock: 60, expectedIncoming: 40 }).value, 0);
  // Zero affected denominators still cannot yield a rate:
  assert.equal(estimateUtilityRecovery({ service: 'water', affected: 0, recovered: 0 }).status, 'invalid_input');
});

// 3+4. Missing / null / malformed inputs -> insufficient_data, never zero.
test('missing and null inputs yield insufficient_data', () => {
  assert.equal(estimatePhysicalDamage({ assetCount: null, replacementCostPerAsset: 1, damageFraction: 0.5 }).status, 'insufficient_data');
  assert.equal(estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: null, damageFraction: 0.5 }).status, 'insufficient_data');
  assert.equal(estimateNeedsDemand({ targetPopulation: null, dailyRequirementPerPerson: 3, durationDays: 3 }).status, 'insufficient_data');
  assert.equal(scorePriority({ S: 0.9, G: null, V: 0.8, T: 1, A: 0.5 }).status, 'insufficient_data');
  // Incomplete forecast never assumes zero stock/backlog:
  assert.equal(estimateForecastGap({ demand: 6048, additionalBacklog: null, usableStock: 0, expectedIncoming: 0 }).status, 'insufficient_data');
  assert.equal(forecast(672, 3, 3, null, null, null), null);
  assert.equal(priority(1, null, 1, 1, 1), null);
});

test('malformed (NaN/Infinity) inputs are rejected', () => {
  assert.equal(estimatePhysicalDamage({ assetCount: NaN, replacementCostPerAsset: 1, damageFraction: 0.5 }).status, 'insufficient_data');
  assert.equal(estimateUtilityRecovery({ service: 'water', affected: Infinity, recovered: 1 }).status, 'insufficient_data');
});

// 5. Negative values -> invalid_input.
test('negatives are invalid_input, never coerced', () => {
  assert.equal(estimatePhysicalDamage({ assetCount: -1, replacementCostPerAsset: 1, damageFraction: 0.5 }).status, 'invalid_input');
  assert.equal(estimateEconomicLoss({ dailyEconomicLoss: -5, durationDays: 3 }).status, 'invalid_input');
  assert.equal(estimateFundingGap({ requirement: 100, available: -2 }).status, 'invalid_input');
  assert.equal(estimateNeedsDemand({ targetPopulation: 10, dailyRequirementPerPerson: -1, durationDays: 2 }).status, 'invalid_input');
});

// 6. Zero denominators -> no division by zero.
test('zero denominators never divide', () => {
  assert.equal(estimateFundingGapPercent({ requirement: 0, available: 0 }).status, 'insufficient_data');
  assert.equal(estimatePhysicalGapPercent({ affectedUnits: 0, recoveredUnits: 0 }).status, 'insufficient_data');
  assert.equal(estimateUtilityRecovery({ service: 'electricity', affected: 0, recovered: 0 }).status, 'invalid_input');
});

// 7. Percentages at 0% and 100%.
test('percent boundaries 0 and 100', () => {
  assert.equal(estimateFundingGapPercent({ requirement: 100, available: 100 }).value, 0);
  assert.equal(estimateFundingGapPercent({ requirement: 100, available: 0 }).value, 100);
  assert.equal(estimatePhysicalGapPercent({ affectedUnits: 4, recoveredUnits: 4 }).value, 0);
  assert.equal(estimatePhysicalGapPercent({ affectedUnits: 4, recoveredUnits: 0 }).value, 100);
  assert.equal(estimateUtilityRecovery({ service: 'water', affected: 10, recovered: 10, operationalDefinition: 'x' }).value, 100);
  assert.equal(estimateUtilityRecovery({ service: 'water', affected: 10, recovered: 0, operationalDefinition: 'x' }).value, 0);
});

// 8. Recovery greater than affected totals is flagged, not corrected.
test('recovered > affected is invalid, not clamped', () => {
  assert.equal(estimatePhysicalGapCount({ affectedUnits: 5, recoveredUnits: 6 }).status, 'invalid_input');
  assert.equal(estimateUtilityRecovery({ service: 'water', affected: 5, recovered: 6 }).status, 'invalid_input');
  assert.equal(utilityRecovery(
    { value: 5, unit: 'x', area: 'a', period: 'p', factIds: ['f'] },
    { value: 6, unit: 'x', area: 'a', period: 'p', factIds: ['g'] }).value, null);
});

// 9. Severity and priority components outside the allowed range.
test('fractions outside 0-1 are invalid', () => {
  assert.equal(estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 1, damageFraction: 1.5 }).status, 'invalid_input');
  assert.equal(estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 1, damageFraction: -0.1 }).status, 'invalid_input');
  assert.equal(scorePriority({ S: 1.2, G: 1, V: 1, T: 1, A: 1 }).status, 'invalid_input');
  assert.equal(scorePriority({ S: -0.1, G: 0, V: 0, T: 0, A: 0 }).status, 'invalid_input');
});

// 10. Priority weights sum to 1.
test('priority weights sum to 1 and are centrally defined', () => {
  assert.equal(priorityWeightsSum(), 1);
  assert.deepEqual({ ...PRIORITY_WEIGHTS }, { S: 0.3, G: 0.25, V: 0.2, T: 0.15, A: 0.1 });
});

// 11. Duplicate or overlapping inputs.
test('duplicate evidence and overlapping loss inputs are surfaced', () => {
  assert.deepEqual(duplicateFactIds(['a', 'b', 'a']), ['a']);
  const d = estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 10, damageFraction: 0.5 });
  const e = estimateEconomicLoss({ dailyEconomicLoss: 10, durationDays: 2 });
  const overlap = estimateTotalLoss(d, e, { inputsOverlap: true });
  assert.equal(overlap.status, 'insufficient_data');
  assert.match(overlap.warnings.join(' '), /overlap|double-count/);
});

// 12. Unit, period, or geographic-scope mismatch.
test('scope mismatches withhold comparison', () => {
  const incompatible = estimateEconomicLossNetFlow(
    { value: 100, unit: 'IDR/day', area: 'a', period: 'p', factIds: ['f1'] },
    { value: 20, unit: 'IDR/day', area: 'other', period: 'p', factIds: ['f2'] }, 3);
  assert.equal(incompatible.status, 'invalid_input');
  assert.match(incompatible.errors.join(' '), /geographic-scope/);
  const stageMixed = estimateFundingGap({ requirement: 500, available: 100, requirementStage: 'pledged', availableStage: 'available' });
  assert.equal(stageMixed.status, 'insufficient_data');
  assert.match(stageMixed.warnings.join(' '), /stages differ/);
});

// 13. Backlog already included in demand is rejected.
test('overlapping backlog window is invalid (double-count)', () => {
  const r = estimateForecastGap({ demand: 100, additionalBacklog: 20, usableStock: 0, expectedIncoming: 0, backlogOverlapsDemand: true });
  assert.equal(r.status, 'invalid_input');
  assert.match(r.errors.join(' '), /counted twice/);
});

// 14. Stock, incoming supply, and distribution not double-counted.
test('distribution history is excluded from stock with a warning', () => {
  const r = estimateForecastGap({ demand: 100, additionalBacklog: 0, usableStock: 10, expectedIncoming: 0, distributedHistory: 50 });
  assert.equal(r.status, 'calculated');
  assert.equal(r.value, 90);
  assert.match(r.warnings.join(' '), /not available stock/);
});

// 15. Confirmed versus inferred versus potential needs.
test('need tiers reuse humanitarian conventions', () => {
  assert.equal(classifyNeedTier('VERIFIED', 'VERIFIED'), 'confirmed');
  assert.equal(classifyNeedTier('REPORTED', 'AI_REVIEWED'), 'inferred');
  assert.equal(classifyNeedTier('PENDING_VALIDATION', 'UNVERIFIED'), 'inferred');
  assert.equal(classifyNeedTier('CLOSED', 'REJECTED'), 'potential');
  assert.equal(classifyNeedTier(undefined, undefined), 'potential');
});

// 16. Reproducibility from stored inputs and calculation version.
test('results carry version, inputs, and trace for reproduction', () => {
  const d = estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 150_000_000, damageFraction: 0.5, sourceRefs: ['f1'], observedAt: '2026-10-10T00:00:00+07:00' });
  assert.equal(d.version, CALCULATION_ENGINE_VERSION);
  assert.equal(d.version, METHOD_VERSION);
  assert.ok(d.calculatedAt);
  assert.equal(d.inputs[0]!.value, 5);
  assert.deepEqual(d.inputs[0]!.sourceRefs, ['f1']);
  assert.equal(d.inputs[0]!.observedAt, '2026-10-10T00:00:00+07:00');
  assert.match(d.trace, /5/);
  // Safe money: integer IDR rounding.
  assert.equal(roundIdr(10.6), 11);
  // Life-safety override is assessment-only and criteria-bound.
  assert.equal(evaluateLifeSafetyOverride({ severity: 0.9, timeUrgency: 1, lifeThreat: true }).triggered, true);
  assert.equal(evaluateLifeSafetyOverride({ severity: 0.9, timeUrgency: 1, lifeThreat: false }).triggered, false);
  assert.equal(evaluateLifeSafetyOverride({ severity: 0.2, timeUrgency: 0, lifeThreat: true }).triggered, false);
});

// 17. Regression: legacy wrappers agree numerically with the engine.
test('legacy formula wrappers still agree with the engine', () => {
  const m = (value: number, unit = 'asset') => ({ value, unit, area: 't', period: 'p', factIds: ['f1'] });
  assert.equal(totalLoss(damage(m(5), 150e6, 0.5), economicLoss(m(100e6, 'IDR/day'), m(0, 'IDR/day'), 3)).value, 675e6);
  assert.equal(gap(m(500e6, 'IDR'), m(120e6, 'IDR')).value, 380e6);
  assert.equal(gapPercent(m(5), m(1)).value, 80);
  assert.equal(utilityRecovery(m(300), m(225)).value, 75);
  assert.equal(forecast(672, 3, 3, 0, 0, 0), 6048);
  assert.equal(priority(1, 1, 1, 1, 1), 100);
});

test('live Firestore summary never invents quantities', () => {
  const s = summariseLiveInputs('padang', { needs: [], recovery: [], claims: [], aidEvents: [] });
  assert.equal(s.needsDocs, 0);
  assert.match(s.notice, /simulation mode/);
  assert.ok(s.blockers.length > 0);
  const withUnquantified = summariseLiveInputs('x', {
    needs: [{ id: 'n1', incidentId: 'x', quantityNeeded: null, unit: null, status: 'REPORTED', verificationStatus: 'UNVERIFIED' } as never],
    recovery: [], claims: [], aidEvents: [{ id: 'e1', incidentId: 'x' } as never],
  });
  assert.match(withUnquantified.blockers.join(' '), /no quantified demand|not usable stock/);
});
