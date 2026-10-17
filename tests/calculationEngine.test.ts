import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimatePhysicalDamage, estimateEconomicLoss, estimateEconomicLossNetFlow, estimateTotalLoss,
  estimateFundingGap, estimateFundingGapPercent, estimatePhysicalGapCount, estimatePhysicalGapPercent,
  estimateUtilityRecovery, estimateNeedsDemand, estimateForecastGap, scorePriority,
  evaluateLifeSafetyOverride, classifyNeedTier, priorityWeightsSum, duplicateFactIds,
  roundIdr, PRIORITY_WEIGHTS, PRIORITY_VERSION, CALCULATION_ENGINE_VERSION, METHOD_VERSION,
  estimateOriIndex, oriWeightsSum, estimateCurrentGap, estimateDamageAggregate, reconcileFacts,
  damage, economicLoss, totalLoss, gap, gapPercent, utilityRecovery, forecast, priority,
  toDamageFraction,
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

test('severity percent converts explicitly, never silently', () => {
  const pct = estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 150_000_000, damageFraction: 50, damageFractionUnit: 'percent' });
  assert.equal(pct.status, 'calculated');
  assert.equal(pct.value, 375_000_000);
  assert.match(pct.trace, /50%.*0\.5/);
  // Bare 50 in fraction mode stays invalid (guideline: never treat 50 as 0.5).
  const bare = estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 150_000_000, damageFraction: 50 });
  assert.equal(bare.status, 'invalid_input');
  assert.equal(bare.value, null);
  // Percent out of 0-100 is invalid too.
  assert.equal(estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 1, damageFraction: 150, damageFractionUnit: 'percent' }).status, 'invalid_input');
  // Helper is pure and explicit.
  assert.deepEqual(toDamageFraction(50, 'percent'), { fraction: 0.5, error: null });
  assert.equal(toDamageFraction(50, 'fraction').fraction, null);
  assert.ok(toDamageFraction(50, 'fraction').error);
});

test('net vs gross economic-loss basis is recorded, not confused', () => {
  const net = estimateEconomicLoss({ dailyEconomicLoss: 100_000_000, durationDays: 3, basis: 'net' });
  const gross = estimateEconomicLoss({ dailyEconomicLoss: 100_000_000, durationDays: 3, basis: 'gross' });
  assert.equal(net.value, 300_000_000);
  assert.equal(gross.value, 300_000_000);
  assert.match(net.trace, /net/);
  assert.match(gross.trace, /gross/);
  const nf = estimateEconomicLossNetFlow(
    { value: 100, unit: 'IDR/day', area: 'a', period: 'p', factIds: ['f1'] },
    { value: 20, unit: 'IDR/day', area: 'a', period: 'p', factIds: ['f2'] }, 3);
  assert.equal(nf.value, 240);
  assert.match(nf.trace, /net/);
});

test('unusable stock and unconfirmed incoming withhold the forecast', () => {
  const unusable = estimateForecastGap({ demand: 100, additionalBacklog: 0, usableStock: 10, expectedIncoming: 0, usableStockConfirmed: false });
  assert.equal(unusable.status, 'insufficient_data');
  assert.equal(unusable.value, null);
  assert.match(unusable.warnings.join(' '), /withheld/);
  const unconf = estimateForecastGap({ demand: 100, additionalBacklog: 0, usableStock: 0, expectedIncoming: 40, incomingConfirmed: false });
  assert.equal(unconf.status, 'insufficient_data');
  assert.equal(unconf.value, null);
  // Confirmed flags keep the calculated path.
  const ok = estimateForecastGap({ demand: 100, additionalBacklog: 0, usableStock: 10, expectedIncoming: 0, usableStockConfirmed: true, incomingConfirmed: true });
  assert.equal(ok.status, 'calculated');
  assert.equal(ok.value, 90);
});

test('total loss auto-withholds on mismatched component scopes', () => {
  const phys = estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 150_000_000, damageFraction: 0.5, area: 'SBD', period: '2026-10-04' });
  const flow = estimateEconomicLoss({ dailyEconomicLoss: 100_000_000, durationDays: 3, area: 'SBD', period: '2026-10-07' });
  const t = estimateTotalLoss(phys, flow);
  assert.equal(t.status, 'insufficient_data');
  assert.equal(t.value, null);
  assert.match(t.warnings.join(' '), /differ/);
  // Reconciled scopes still combine.
  const flow2 = estimateEconomicLoss({ dailyEconomicLoss: 100_000_000, durationDays: 3, area: 'SBD', period: '2026-10-04' });
  assert.equal(estimateTotalLoss(phys, flow2).value, 675_000_000);
});

test('results carry calculation ID, origin, and scope', () => {
  const r = estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 150_000_000, damageFraction: 0.5, calculationId: 'calc-001', origin: 'live', area: 'SBD', period: '2026-10-04' });
  assert.equal(r.id, 'calc-001');
  assert.equal(r.origin, 'live');
  assert.deepEqual(r.scope, { area: 'SBD', period: '2026-10-04' });
  // Defaults: no ID, unknown origin, empty scope.
  const d = estimateFundingGap({ requirement: 500, available: 100 });
  assert.equal(d.id, null);
  assert.equal(d.origin, 'unknown');
  // Duplicate refs in one calculation warn without changing the value.
  const pDup = estimatePhysicalDamage({ assetCount: 5, replacementCostPerAsset: 150_000_000, damageFraction: 0.5, sourceRefs: ['f-shared'] });
  const eDup = estimateEconomicLoss({ dailyEconomicLoss: 100_000_000, durationDays: 3, sourceRefs: ['f-shared'] });
  const tDup = estimateTotalLoss(pDup, eDup);
  assert.equal(tDup.value, 675_000_000);
  assert.match(tDup.warnings.join(' '), /duplicate evidence refs/);
});

test('WS1: ORI golden 20/75/40/80 = 50.75, missing withheld, weights sum to 1', () => {
  const ori = estimateOriIndex({ components: [
    { service: 'water', affected: 200, recovered: 40, unit: 'households', area: 'K', period: '3d', operationalDefinition: 'piped flow restored', temporaryRestoration: false },
    { service: 'electricity', affected: 400, recovered: 300, unit: 'customers', area: 'K', period: '3d', operationalDefinition: 'meter energised', temporaryRestoration: false },
    { service: 'access', affected: 5, recovered: 2, unit: 'km', area: 'K', period: '3d', operationalDefinition: 'km passable', temporaryRestoration: false },
    { service: 'telecom', affected: 600, recovered: 480, unit: 'customers', area: 'K', period: '3d', operationalDefinition: 'signal restored', temporaryRestoration: false }] });
  assert.equal(ori.status, 'calculated');
  assert.equal(ori.value, 50.75);
  assert.equal(ori.unit, 'index 0–100');
  assert.match(ori.warnings.join(' '), /NOT a direct percentage/);
  assert.equal(oriWeightsSum(), 1);
  // Missing category: withheld, weights never redistributed.
  const miss = estimateOriIndex({ components: [
    { service: 'water', affected: 200, recovered: 40, unit: 'households', operationalDefinition: 'x', temporaryRestoration: false }] });
  assert.equal(miss.status, 'insufficient_data');
  assert.equal(miss.value, null);
  // Mixed units rejected.
  const mixed = estimateOriIndex({ components: [
    { service: 'water', affected: 200, recovered: 40, unit: 'customers', operationalDefinition: 'x', temporaryRestoration: false },
    { service: 'electricity', affected: 400, recovered: 300, unit: 'customers', operationalDefinition: 'x', temporaryRestoration: false },
    { service: 'access', affected: 5, recovered: 2, unit: 'km', operationalDefinition: 'x', temporaryRestoration: false },
    { service: 'telecom', affected: 600, recovered: 480, unit: 'customers', operationalDefinition: 'x', temporaryRestoration: false }] });
  assert.equal(mixed.status, 'invalid_input');
});

test('WS2: horizon-less current gap — positive, zero, missing, units, usability', () => {
  const pos = estimateCurrentGap({ populationNeeding: 500, ratePerPerson: 2, usableSupply: 400, unit: 'portions' });
  assert.equal(pos.status, 'calculated');
  assert.equal(pos.value, 600);
  const zero = estimateCurrentGap({ populationNeeding: 100, ratePerPerson: 1, usableSupply: 150, unit: 'portions' });
  assert.equal(zero.value, 0);
  assert.equal(estimateCurrentGap({ populationNeeding: null, ratePerPerson: 2, usableSupply: 10 }).status, 'insufficient_data');
  assert.equal(estimateCurrentGap({ populationNeeding: 100, ratePerPerson: 1, usableSupply: 10, unit: 'portions', supplyUnit: 'kg' }).status, 'invalid_input');
  const unusable = estimateCurrentGap({ populationNeeding: 100, ratePerPerson: 1, usableSupply: 10, supplyConfirmedUsable: false });
  assert.equal(unusable.status, 'insufficient_data');
  const dist = estimateCurrentGap({ populationNeeding: 100, ratePerPerson: 1, usableSupply: 10, distributedHistory: 50 });
  assert.equal(dist.value, 90);
  assert.match(dist.warnings.join(' '), /not current usable stock/);
});

test('WS3: multi-category damage aggregate with guards', () => {
  const agg = estimateDamageAggregate({ categories: [
    { categoryId: 'houses', assetCount: 5, assetUnit: 'house', replacementCostPerAsset: 150_000_000, currency: 'IDR', damageFraction: 0.5, area: 'K', period: 'p', assessmentScope: 'rapid' },
    { categoryId: 'schools', assetCount: 2, assetUnit: 'building', replacementCostPerAsset: 500_000_000, currency: 'IDR', damageFraction: 50, damageFractionUnit: 'percent', area: 'K', period: 'p', assessmentScope: 'rapid' }] });
  assert.equal(agg.status, 'calculated');
  assert.equal(agg.value, 875_000_000);
  // Household counts rejected, never converted.
  assert.equal(estimateDamageAggregate({ categories: [
    { categoryId: 'x', assetCount: 10, assetUnit: 'households', replacementCostPerAsset: 1, currency: 'IDR', damageFraction: 0.5 }] }).status, 'invalid_input');
  // Missing cost withholds the combined total.
  assert.equal(estimateDamageAggregate({ categories: [
    { categoryId: 'x', assetCount: 5, assetUnit: 'house', replacementCostPerAsset: null, currency: 'IDR', damageFraction: 0.5 }] }).status, 'insufficient_data');
  // Duplicate categories and incompatible scopes withhold.
  assert.equal(estimateDamageAggregate({ categories: [
    { categoryId: 'x', assetCount: 1, assetUnit: 'house', replacementCostPerAsset: 1, currency: 'IDR', damageFraction: 0.5 },
    { categoryId: 'x', assetCount: 1, assetUnit: 'house', replacementCostPerAsset: 1, currency: 'IDR', damageFraction: 0.5 }] }).status, 'invalid_input');
  assert.equal(estimateDamageAggregate({ categories: [
    { categoryId: 'a', assetCount: 1, assetUnit: 'house', replacementCostPerAsset: 1, currency: 'IDR', damageFraction: 0.5, area: 'X' },
    { categoryId: 'b', assetCount: 1, assetUnit: 'house', replacementCostPerAsset: 1, currency: 'IDR', damageFraction: 0.5, area: 'Y' }] }).status, 'insufficient_data');
});

test('WS4: parent-child reconciliation golden cases and withholds', () => {
  const parent = reconcileFacts({ unit: 'packages', facts: [
    { factId: 'f-total', value: 400, unit: 'packages', relation: 'total', sourceRefs: ['s0'] },
    { factId: 'f-a', value: 250, unit: 'packages', relation: 'subset', parentFactId: 'f-total', sourceRefs: ['s1'] },
    { factId: 'f-b', value: 150, unit: 'packages', relation: 'subset', parentFactId: 'f-total', sourceRefs: ['s2'] }] });
  assert.equal(parent.status, 'calculated');
  assert.equal(parent.value, 400);
  assert.match(parent.trace, /f-total IN/);
  const disjoint = reconcileFacts({ unit: 'people', disjointGroupsConfirmed: true, facts: [
    { factId: 'g1', value: 367, unit: 'people', relation: 'independent', groupKey: 'A', sourceRefs: ['s1'] },
    { factId: 'g2', value: 250, unit: 'people', relation: 'independent', groupKey: 'B', sourceRefs: ['s2'] },
    { factId: 'g3', value: 55, unit: 'people', relation: 'independent', groupKey: 'C', sourceRefs: ['s3'] }] });
  assert.equal(disjoint.value, 672);
  assert.equal(reconcileFacts({ unit: 'people', facts: [
    { factId: 'g1', value: 367, unit: 'people', relation: 'independent', groupKey: 'A', sourceRefs: ['s1'] },
    { factId: 'g2', value: 250, unit: 'people', relation: 'independent', groupKey: 'B', sourceRefs: ['s2'] }] }).status, 'insufficient_data');
  assert.equal(reconcileFacts({ unit: 'packages', facts: [
    { factId: 't1', value: 400, unit: 'packages', relation: 'total', sourceRefs: ['s1'] },
    { factId: 't2', value: 420, unit: 'packages', relation: 'total', sourceRefs: ['s2'] }] }).status, 'insufficient_data');
});

test('WS4: single quantified observation is its own canonical total', () => {
  const r = reconcileFacts({ unit: 'kejadian', facts: [
    { factId: 'f1', value: 62, unit: 'kejadian', relation: 'independent', groupKey: 'a', sourceRefs: ['s1'] }] });
  assert.equal(r.status, 'calculated');
  assert.equal(r.value, 62);
  assert.match(r.trace, /single quantified observation/);
});

test('reconciliation integrity: duplicates, links, scopes, revisions, dangling parts', () => {
  // Duplicate source reports (syndication): same source + same value counts once.
  const syndup = reconcileFacts({ unit: 'packages', disjointGroupsConfirmed: true, facts: [
    { factId: 'f-a', value: 250, unit: 'packages', relation: 'independent', groupKey: 'A', sourceRefs: ['s1'] },
    { factId: 'f-a2', value: 250, unit: 'packages', relation: 'independent', groupKey: 'A', sourceRefs: ['s1'] },
    { factId: 'f-b', value: 150, unit: 'packages', relation: 'independent', groupKey: 'B', sourceRefs: ['s2'] }] });
  assert.equal(syndup.status, 'calculated');
  assert.equal(syndup.value, 400);
  assert.match(syndup.trace, /f-a2 OUT \(duplicated source claim/);
  // Linked duplicates: same sourceUrl, different factIds, same value → once.
  const linked = reconcileFacts({ unit: 'rumah', disjointGroupsConfirmed: true, facts: [
    { factId: 'l1', value: 20, unit: 'rumah', relation: 'independent', groupKey: 'A', sourceRefs: ['https://x.test/bnpb'] },
    { factId: 'l2', value: 20, unit: 'rumah', relation: 'independent', groupKey: 'A', sourceRefs: ['https://x.test/bnpb'] }] });
  assert.equal(linked.value, 20);
  assert.match(linked.trace, /l2 OUT \(duplicated source claim/);
  // Same source, different values → conflict withhold, never averaged.
  const sameSrcDiff = reconcileFacts({ unit: 'rumah', facts: [
    { factId: 'c1', value: 20, unit: 'rumah', relation: 'total', sourceRefs: ['s1'] },
    { factId: 'c2', value: 56, unit: 'rumah', relation: 'total', sourceRefs: ['s1'] }] });
  assert.equal(sameSrcDiff.value, null);
  assert.equal(sameSrcDiff.status, 'insufficient_data');
  assert.match(sameSrcDiff.trace, /conflicting totals \(20 vs 56\)/);
  // Dangling subset (parent absent) cannot stand as the whole.
  const dangling = reconcileFacts({ unit: 'packages', facts: [
    { factId: 'orphan', value: 250, unit: 'packages', relation: 'subset', parentFactId: 'ghost', sourceRefs: ['s1'] }] });
  assert.equal(dangling.value, null);
  assert.equal(dangling.status, 'insufficient_data');
  assert.match(dangling.trace, /dangling subset orphan/);
  // Revision supersedes the earlier independent report in its group.
  const revised = reconcileFacts({ unit: 'rumah', disjointGroupsConfirmed: true, facts: [
    { factId: 'old', value: 20, unit: 'rumah', relation: 'independent', groupKey: 'g', sourceRefs: ['s1'] },
    { factId: 'new', value: 26, unit: 'rumah', relation: 'revision', groupKey: 'g', sourceRefs: ['s2'], observedAt: '2026-10-05T00:00:00Z' }] });
  assert.equal(revised.value, 26);
  assert.match(revised.trace, /old OUT \(superseded by revision chain/);
  // Differing scopes summed only with confirmation + recorded warning.
  const scopes = reconcileFacts({ unit: 'people', disjointGroupsConfirmed: true, facts: [
    { factId: 'g1', value: 367, unit: 'people', relation: 'independent', groupKey: 'A', area: 'Kecamatan Tapan', sourceRefs: ['s1'] },
    { factId: 'g2', value: 250, unit: 'people', relation: 'independent', groupKey: 'B', area: 'Kecamatan Lunang', sourceRefs: ['s2'] }] });
  assert.equal(scopes.value, 617);
  assert.match(scopes.warnings.join(' '), /differing scopes/);
  // Null and negative quantities excluded with reasons, never zero-filled.
  const badQty = reconcileFacts({ unit: 'u', disjointGroupsConfirmed: true, facts: [
    { factId: 'ok', value: 10, unit: 'u', relation: 'independent', groupKey: 'A', sourceRefs: ['s1'] },
    { factId: 'nil', value: null, unit: 'u', relation: 'independent', groupKey: 'B', sourceRefs: ['s2'] },
    { factId: 'neg', value: -5, unit: 'u', relation: 'independent', groupKey: 'C', sourceRefs: ['s3'] }] });
  assert.equal(badQty.value, 10);
  assert.match(badQty.trace, /nil OUT \(missing, non-finite or negative/);
  assert.match(badQty.trace, /neg OUT \(missing, non-finite or negative/);
  // Single observation is labeled canonical-alone, not corroborated.
  const solo = reconcileFacts({ unit: 'kejadian', facts: [
    { factId: 'f1', value: 62, unit: 'kejadian', relation: 'independent', groupKey: 'a', sourceRefs: ['s1'] }] });
  assert.match(solo.trace, /NOT independently corroborated/);
});
