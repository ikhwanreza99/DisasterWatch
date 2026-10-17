import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  listSupportedMetrics,
  metricLabel,
  runCalculation,
} from '../src/services/calculations/calculationService';
import {
  assessLiveReadiness,
  readinessCounts,
} from '../src/services/calculations/liveAdapter';
import { buildClaimFactGroups } from '../src/services/calculations/liveClaimGroups';
import { adaptUtilityInputs } from '../src/services/calculations/liveAdapter';
import {
  resolveExtendedStatus,
} from '../src/services/insights/formulas';
import CalculationVerificationPage from '../src/components/CalculationVerificationPage';
import { LanguageProvider } from '../src/i18n';

// Explicitly labeled synthetic fixtures (not live data, not mocks of Firestore).
const ORI_COMPONENTS = [
  { service: 'water', affected: 200, recovered: 40, unit: 'households', area: 'K', period: '3d', operationalDefinition: 'x', temporaryRestoration: false },
  { service: 'electricity', affected: 400, recovered: 300, unit: 'customers', area: 'K', period: '3d', operationalDefinition: 'x', temporaryRestoration: false },
  { service: 'access', affected: 5, recovered: 2, unit: 'km', area: 'K', period: '3d', operationalDefinition: 'x', temporaryRestoration: false },
  { service: 'telecom', affected: 600, recovered: 480, unit: 'customers', area: 'K', period: '3d', operationalDefinition: 'x', temporaryRestoration: false },
] as const;

// --- Contract: extended statuses ---
test('contract: extended status mapping preserves engine behavior', () => {
  const sim = runCalculation({ metric: 'physical_damage', mode: 'scenario', origin: 'simulation', input: { assetCount: 5, replacementCostPerAsset: 150_000_000, damageFraction: 0.5 } });
  assert.equal(sim.result.status, 'calculated');
  assert.equal(sim.extendedStatus, 'scenario_estimate');
  const fc = runCalculation({ metric: 'needs_forecast_gap', origin: 'simulation', input: { demand: 100, additionalBacklog: 0, usableStock: 10, expectedIncoming: 0, unit: 'u' } });
  assert.equal(fc.extendedStatus, 'forecast');
  const bad = runCalculation({ metric: 'physical_damage', input: { assetCount: -1, replacementCostPerAsset: 1, damageFraction: 0.5 } });
  assert.equal(bad.result.status, 'invalid_input');
  assert.equal(bad.extendedStatus, 'invalid_input');
  const missing = runCalculation({ metric: 'funding_gap', input: { requirement: null, available: 1 } });
  assert.equal(missing.result.value, null);
  assert.equal(missing.extendedStatus, 'insufficient_data');
  assert.deepEqual(missing.result.missingInputs, ['recovery_requirement']);
  // Conflict-withheld reconciliation surfaces as conflict_pending_review.
  const conflict = runCalculation({
    metric: 'reconcile_facts',
    input: {
      unit: 'u',
      facts: [
        { factId: 't1', value: 1, unit: 'u', relation: 'total', sourceRefs: ['s1'] },
        { factId: 't2', value: 2, unit: 'u', relation: 'total', sourceRefs: ['s2'] },
      ],
    },
  });
  assert.equal(conflict.result.status, 'insufficient_data');
  assert.equal(conflict.extendedStatus, 'conflict_pending_review');
  // Stale bound only applies with an explicit maxAgeMs.
  const fresh = resolveExtendedStatus(sim.result, {});
  assert.equal(fresh, 'scenario_estimate');
  const stale = resolveExtendedStatus({ ...sim.result, calculatedAt: '2020-01-01T00:00:00.000Z' }, { maxAgeMs: 1000, nowMs: Date.parse('2026-10-16T00:00:00.000Z') });
  assert.equal(stale, 'stale_data');
});

// --- Service invokes real functions (P0 goldens through the service) ---
test('service: P0 goldens return production values with full contract', () => {
  const ori = runCalculation({ metric: 'ori_index', mode: 'scenario', origin: 'simulation', calculationId: 't-ori', input: { components: [...ORI_COMPONENTS] } });
  assert.equal(ori.result.value, 50.75);
  assert.equal(ori.result.metricId, 'ori_index');
  assert.equal(ori.result.id, 't-ori');
  assert.equal(ori.extendedStatus, 'scenario_estimate');
  assert.match(ori.result.trace, /50\.75/);
  const cur = runCalculation({ metric: 'needs_current_gap', incidentId: 'sim', input: { populationNeeding: 500, ratePerPerson: 2, usableSupply: 400, unit: 'portions' } });
  assert.equal(cur.result.value, 600);
  assert.equal(cur.result.incidentId, 'sim');
  assert.equal(cur.result.coverage, null);
  const floor = runCalculation({ metric: 'needs_current_gap', input: { populationNeeding: 100, ratePerPerson: 1, usableSupply: 150, unit: 'portions' } });
  assert.equal(floor.result.value, 0);
  const agg = runCalculation({
    metric: 'damage_aggregate', input: {
      categories: [
        { categoryId: 'houses', assetCount: 5, assetUnit: 'house', replacementCostPerAsset: 150_000_000, currency: 'IDR', damageFraction: 0.5 },
        { categoryId: 'schools', assetCount: 2, assetUnit: 'building', replacementCostPerAsset: 500_000_000, currency: 'IDR', damageFraction: 50, damageFractionUnit: 'percent' },
      ],
    },
  });
  assert.equal(agg.result.value, 875_000_000);
  const rec = runCalculation({
    metric: 'reconcile_facts',
    input: {
      unit: 'packages',
      facts: [
        { factId: 'f-total', value: 400, unit: 'packages', relation: 'total', sourceRefs: ['s0'] },
        { factId: 'f-a', value: 250, unit: 'packages', relation: 'subset', parentFactId: 'f-total', sourceRefs: ['s1'] },
        { factId: 'f-b', value: 150, unit: 'packages', relation: 'subset', parentFactId: 'f-total', sourceRefs: ['s2'] },
      ],
    },
  });
  assert.equal(rec.result.value, 400);
  assert.deepEqual(rec.result.sourceFactIds.sort(), ['f-a', 'f-b', 'f-total', 's0', 's1', 's2']);
  const dis = runCalculation({
    metric: 'reconcile_facts',
    input: {
      unit: 'people', disjointGroupsConfirmed: true,
      facts: [
        { factId: 'g1', value: 367, unit: 'people', relation: 'independent', groupKey: 'A', sourceRefs: ['s1'] },
        { factId: 'g2', value: 250, unit: 'people', relation: 'independent', groupKey: 'B', sourceRefs: ['s2'] },
        { factId: 'g3', value: 55, unit: 'people', relation: 'independent', groupKey: 'C', sourceRefs: ['s3'] },
      ],
    },
  });
  assert.equal(dis.result.value, 672);
  // Null preservation through the service (never zero-filled).
  const withheld = runCalculation({ metric: 'needs_current_gap', input: { populationNeeding: null, ratePerPerson: 2, usableSupply: 1 } });
  assert.equal(withheld.result.value, null);
  assert.ok(withheld.result.missingInputs.length > 0);
});

// --- Service metadata ---
test('service: supported metrics are stable and labeled', () => {
  const metrics = listSupportedMetrics();
  assert.equal(metrics.length, 16);
  assert.ok(metrics.includes('ori_index'));
  assert.ok(metrics.includes('reconcile_facts'));
  assert.equal(metricLabel('ori_index'), 'Utility Recovery Index (ORI, internal)');
});

// --- Live adapter with explicitly labeled mock snapshots ---
test('adapter: mock empty snapshot blocks everything truthfully', () => {
  // MOCK: synthetic RemoteSnapshot-shaped fixture for adapter unit testing only.
  const mockEmpty = { needs: [], recovery: [], claims: [], aidEvents: [], incidents: [] };
  const rows = assessLiveReadiness(mockEmpty, 'padang');
  assert.equal(rows.length, 16);
  assert.deepEqual(readinessCounts(rows), { READY: 0, BLOCKED: 11, NOT_AVAILABLE: 5 });
  const funding = rows.find((r) => r.metric === 'funding_gap');
  assert.equal(funding?.readiness, 'NOT_AVAILABLE');
  assert.match(funding?.missingFields.join(' ') ?? '', /funding/);
});

test('adapter: mock snapshot with docs still names exact missing fields', () => {
  // MOCK: fixture with realistic doc shapes; still insufficient for formulas.
  const mockDocs = {
    needs: [{ id: 'n1', incidentId: 'x', itemCategory: 'FOOD_NUTRITION', itemName: 'beras', quantityNeeded: 100, unit: 'kg', quantityReceived: null, quantityDistributed: null, quantityRemaining: 100, priority: null, beneficiaryGroup: 'balita', affectedArea: 'Desa A', status: 'REPORTED', statusReason: null, sourceUrl: null, sourceOrganization: null, verificationStatus: 'UNVERIFIED', reportedAt: null, lastUpdatedAt: '2026-10-16', isMock: true, schemaVersion: 1 }],
    recovery: [{ id: 'r1', incidentId: 'x', serviceType: 'POWER', affectedArea: 'Desa A', affectedEntity: null, impactDescription: null, affectedCount: 400, unit: 'customers', waterSafety: null, estimatedRestorationAt: null, restoredAt: null, history: [], sourceUrl: null, sourceOrganization: null, verificationStatus: 'UNVERIFIED', reportedAt: null, lastUpdatedAt: '2026-10-16', isMock: true, schemaVersion: 1 }],
    claims: [{ id: 'c1', incidentId: 'x', articleId: 'a1', claimType: 'damage', claimText: 't', location: null, quantity: 5, unit: 'houses', sourceUrl: 'https://example.test', sourceOrganization: null, verificationStatus: 'UNVERIFIED', conflictingWith: [], extraction: { engine: 'HEURISTIC', at: '2026-10-16' }, isMock: true, schemaVersion: 1 }],
    aidEvents: [{ id: 'e1', incidentId: 'x', articleId: null, aidStage: 'DISTRIBUTED', itemCategory: 'FOOD_NUTRITION', itemName: 'beras', quantity: 50, unit: 'kg', estimatedValue: null, recipientOrDestination: null, location: null, distributingOrganization: null, sourceUrl: null, sourceOrganization: null, verificationStatus: 'UNVERIFIED', eventTime: null, isMock: true, schemaVersion: 1 }],
    incidents: [],
  } as unknown as Parameters<typeof assessLiveReadiness>[0];
  const rows = assessLiveReadiness(mockDocs, 'x');
  const byMetric = new Map(rows.map((r) => [r.metric, r]));
  assert.equal(byMetric.get('utility_recovery')?.readiness, 'BLOCKED');
  assert.match(byMetric.get('utility_recovery')?.missingFields.join(' ') ?? '', /restored/);
  // MOCK quantified claim → reconcile executable via the transparent grouping
  // bridge (relations derived, lineage preserved).
  assert.equal(byMetric.get('reconcile_facts')?.readiness, 'READY');
  assert.match(byMetric.get('reconcile_facts')?.availableFields.join(' ') ?? '', /lineage/);
  assert.equal(byMetric.get('needs_current_gap')?.readiness, 'BLOCKED');
});

// --- Live claim grouping with explicitly labeled mock claims ---
test('grouping: mock claims group by type+unit without inventing relations', () => {
  // MOCK: mirrors the NTT live shape (conflicting damage pair + singletons).
  const mockClaims = [
    { id: 'm1', incidentId: 'mx', articleId: 'a', claimType: 'damage', claimText: 't', location: null, quantity: 20, unit: 'rumah', sourceUrl: 'https://example.test/bnpb', sourceOrganization: 'BNPB', verificationStatus: 'CONFLICTING', conflictingWith: ['m2'], extraction: { engine: 'HEURISTIC', at: '2026-10-16' }, isMock: true, schemaVersion: 1 },
    { id: 'm2', incidentId: 'mx', articleId: 'a', claimType: 'damage', claimText: 't', location: null, quantity: 56, unit: 'rumah', sourceUrl: 'https://example.test/detik', sourceOrganization: 'Detik', verificationStatus: 'CONFLICTING', conflictingWith: ['m1'], extraction: { engine: 'HEURISTIC', at: '2026-10-16' }, isMock: true, schemaVersion: 1 },
    { id: 'm3', incidentId: 'mx', articleId: 'a', claimType: 'aftershocks', claimText: 't', location: null, quantity: 62, unit: 'kejadian', sourceUrl: 'https://example.test/bmkg', sourceOrganization: 'BMKG', verificationStatus: 'VERIFIED', conflictingWith: [], extraction: { engine: 'HEURISTIC', at: '2026-10-16' }, isMock: true, schemaVersion: 1 },
    { id: 'm4', incidentId: 'other', articleId: 'a', claimType: 'damage', claimText: 't', location: null, quantity: 9, unit: 'rumah', sourceUrl: 'https://example.test/x', sourceOrganization: null, verificationStatus: 'UNVERIFIED', conflictingWith: [], extraction: { engine: 'HEURISTIC', at: '2026-10-16' }, isMock: true, schemaVersion: 1 },
    { id: 'm5', incidentId: 'mx', articleId: 'a', claimType: 'damage', claimText: 't', location: null, quantity: null, unit: null, sourceUrl: 'https://example.test/x', sourceOrganization: null, verificationStatus: 'UNVERIFIED', conflictingWith: [], extraction: { engine: 'HEURISTIC', at: '2026-10-16' }, isMock: true, schemaVersion: 1 },
  ] as never[];
  const groups = buildClaimFactGroups('mx', mockClaims);
  assert.equal(groups.length, 2);
  const pair = groups.find((g) => g.groupKey === 'damage||rumah');
  assert.deepEqual(pair?.claimIds.sort(), ['m1', 'm2']);
  assert.deepEqual(groups.find((g) => g.groupKey === 'aftershocks||kejadian')?.claimIds, ['m3']);
  // Other-incident and null-quantity claims never leak in.
  assert.ok(!groups.some((g) => g.claimIds.includes('m4') || g.claimIds.includes('m5')));
  // End-to-end through the real service: conflict withholds, singleton calculates.
  const conflict = runCalculation({ metric: 'reconcile_facts', incidentId: 'mx', origin: 'simulation', input: pair!.input });
  assert.equal(conflict.result.value, null);
  assert.equal(conflict.extendedStatus, 'conflict_pending_review');
  const single = runCalculation({ metric: 'reconcile_facts', incidentId: 'mx', origin: 'simulation', input: groups.find((g) => g.groupKey === 'aftershocks||kejadian')!.input });
  assert.equal(single.result.value, 62);
  assert.equal(single.result.status, 'calculated');
});

// --- Page: synthetic/live separation and blocked states ---
test('page: compact view keeps synthetic and live results separated', () => {
  const markup = renderToStaticMarkup(
    <LanguageProvider>
      <CalculationVerificationPage />
    </LanguageProvider>,
  );
  assert.match(markup, /data-testid="key-results"/);
  // SSR has no live snapshot: all three key results are labelled simulations,
  // and none is presented as actual live data.
  assert.equal(markup.match(/Contoh Simulasi<\/span>/g)?.length, 3);
  assert.doesNotMatch(markup, /Data Aktual<\/span>/);
  // Live Calculations is unverified (not a fabricated zero) without a session.
  assert.match(markup, /data-testid="summary-live"[\s\S]*?Belum diverifikasi/);
  // The technical-details UI is gone from the main page.
  assert.doesNotMatch(markup, /data-testid="calc-details"/);
  assert.doesNotMatch(markup, /data-testid="svc-proof"/);
  assert.doesNotMatch(markup, /data-testid="calc-live"/);
  assert.doesNotMatch(markup, /AIza/);
});

// --- Iteration 3: recovery data contract (additive, backward compatible) ---
test('contract: legacy recovery docs without new fields stay valid', () => {
  // Legacy shape (pre-restoredCount): missing fields read as undefined → unknown.
  const legacy = {
    id: 'r-legacy', incidentId: 'x', serviceType: 'POWER', affectedArea: null,
    affectedCount: null, unit: null, verificationStatus: 'UNVERIFIED',
  } as never;
  const adapted = adaptUtilityInputs('x', [legacy]);
  assert.equal(adapted.readyInputs.length, 0);
  assert.ok(adapted.blockers.length > 0);
  assert.match(adapted.blockers.join(' '), /unknown is never zero/);
});

test('contract: null counts, zero denominator, incompatible units, overlap, exceed', () => {
  const base = (over: Record<string, unknown>) => ({
    id: 'r1', incidentId: 'x', serviceType: 'POWER', affectedArea: 'Desa A',
    affectedCount: 400, unit: 'customers', restoredCount: 300,
    restorationCriterion: null, verificationStatus: 'UNVERIFIED',
    ...over,
  }) as never;
  // Ready path preserves provenance for the engine.
  const ok = adaptUtilityInputs('x', [base({})]);
  assert.equal(ok.readyInputs.length, 1);
  assert.equal(ok.readyInputs[0]!.docId, 'r1');
  const run = runCalculation({
    metric: 'utility_recovery', incidentId: 'x', origin: 'simulation',
    input: { service: 'electricity', affected: 400, recovered: 300, unit: 'customers', sourceRefs: ['r1'] },
  });
  assert.equal(run.result.value, 75);
  // Null counts → blocker, never zero.
  assert.ok(adaptUtilityInputs('x', [base({ restoredCount: null })]).blockers.join(' ').includes('restored=null'));
  // Zero denominator passes through; the engine (not the adapter) invalidates.
  const zero = adaptUtilityInputs('x', [base({ affectedCount: 0, restoredCount: 0 })]);
  assert.equal(zero.readyInputs.length, 1);
  const zeroRun = runCalculation({
    metric: 'utility_recovery', input: { service: 'electricity', affected: 0, recovered: 0, unit: 'customers', sourceRefs: ['r1'] },
  });
  assert.equal(zeroRun.result.status, 'invalid_input');
  assert.equal(zeroRun.result.value, null);
  // Incompatible units pass through; the engine rejects with scope message.
  const badUnit = runCalculation({
    metric: 'utility_recovery', input: { service: 'water', affected: 200, recovered: 40, unit: 'gardu', sourceRefs: ['r2'] },
  });
  assert.equal(badUnit.result.status, 'invalid_input');
  // Overlapping countable docs for one service+area block without picking.
  const overlap = adaptUtilityInputs('x', [base({}), base({ id: 'r2', restoredCount: 100 })]);
  assert.equal(overlap.readyInputs.length, 0);
  assert.match(overlap.blockers.join(' '), /overlap/);
  // Restored exceeding affected → engine anomaly status, not a silent clamp.
  const exceed = runCalculation({
    metric: 'utility_recovery', input: { service: 'electricity', affected: 400, recovered: 500, unit: 'customers', sourceRefs: ['r1'] },
  });
  assert.equal(exceed.result.status, 'invalid_input');
  assert.equal(exceed.result.value, null);
  assert.match(exceed.result.errors.join(' '), /exceeds affected/);
  // Non-utility services and other incidents are skipped, never mixed in.
  const skip = adaptUtilityInputs('x', [
    base({ id: 'p1', serviceType: 'PUBLIC_FACILITIES' }),
    base({ id: 'o1', incidentId: 'other' }),
  ]);
  assert.equal(skip.readyInputs.length, 0);
  assert.equal(skip.skipped.length, 1);
  assert.match(skip.skipped[0]!.reason, /not a utility service/);
});
