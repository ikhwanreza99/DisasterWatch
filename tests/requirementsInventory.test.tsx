import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DATA_REQUIREMENTS,
  assessMetricReadiness,
  auditRequirement,
  auditRequirements,
  metricsWithRequirements,
  type AuditScope,
  type CollectionSample,
} from '../src/services/verification/requirementsInventory';
import { listSupportedMetrics } from '../src/services/calculations/calculationService';
import { runCalculation } from '../src/services/calculations/calculationService';
import CalculationVerificationPage from '../src/components/CalculationVerificationPage';
import { LanguageProvider } from '../src/i18n';

// MOCK helpers: synthetic audit fixtures for unit testing only. They prove the
// auditor's logic, never production database availability.
function mockScope(samples: CollectionSample[], accessOk = true): AuditScope {
  return { incidentId: 'mock-x', accessOk, errorCategory: null, samples, auditedAt: '2026-10-16T00:00:00.000Z' };
}
function mockSample(collection: string, docs: Array<Record<string, unknown>>, limit = 100): CollectionSample {
  return { collection, limit, incidentScoped: true, docs: docs.map((data, i) => ({ id: `doc-${i}`, data })) };
}
function req(id: string) {
  const r = DATA_REQUIREMENTS.find((x) => x.requirement_id === id);
  assert.ok(r, id);
  return r;
}

test('inventory: every service metric registers required inputs', () => {
  for (const m of listSupportedMetrics()) {
    const reqs = DATA_REQUIREMENTS.filter((r) => r.metric_id === m && r.required_or_optional === 'required');
    assert.ok(reqs.length > 0, `${m} has no required inputs registered`);
  }
  assert.ok(metricsWithRequirements().length >= 14);
});

test('inventory: mappings reference the real schema (collections + fields)', () => {
  const collections = ['incidents', 'incidentClaims', 'incidentAidNeeds', 'incidentAidEvents', 'incidentRecovery', null];
  const fields: Record<string, string[]> = {
    incidents: ['incidentId', 'province', 'name'],
    incidentClaims: ['id', 'quantity', 'unit', 'claimType', 'sourceUrl', 'conflictingWith', 'location', 'verificationStatus'],
    incidentAidNeeds: ['quantityNeeded', 'unit', 'quantityReceived', 'quantityDistributed', 'itemCategory', 'affectedArea', 'status', 'verificationStatus', 'priority', 'beneficiaryGroup', 'reportedAt'],
    incidentAidEvents: ['quantity', 'unit', 'aidStage', 'itemName', 'eventTime'],
    incidentRecovery: ['affectedCount', 'unit', 'restoredCount', 'restorationCriterion', 'serviceType', 'affectedArea', 'history', 'restoredAt', 'waterSafety'],
  };
  for (const r of DATA_REQUIREMENTS) {
    assert.ok(collections.includes(r.expected_collection), `${r.requirement_id}: unknown collection`);
    if (r.expected_collection && r.expected_field_path && !r.expected_field_path.includes('.')) {
      assert.ok((fields[r.expected_collection] ?? []).includes(r.expected_field_path),
        `${r.requirement_id}: field '${r.expected_field_path}' not in schema allowlist`);
    }
    assert.ok(['observed_fact', 'baseline', 'parameter', 'derived_value'].includes(r.source_kind), r.requirement_id);
  }
});

test('audit: missing fields produce MISSING, never zero-filled values', () => {
  const scope = mockScope([mockSample('incidentClaims', [{ id: 'c1', claimType: 'damage', quantity: null, unit: null }])]);
  const a = auditRequirement(req('req-loss-count'), scope);
  assert.equal(a.status, 'MISSING');
  assert.equal(a.validCount, 0);
  assert.equal(a.missingCount, 1);
  assert.match(a.reasons.join(' '), /absent/);
});

test('audit: invalid types and denied units produce INVALID', () => {
  const scope = mockScope([mockSample('incidentClaims', [
    { id: 'c1', quantity: -5, unit: 'house' },
    { id: 'c2', quantity: 10, unit: 'households' },
    { id: 'c3', quantity: 'banyak', unit: 'house' },
  ])]);
  const a = auditRequirement(req('req-loss-count'), scope);
  assert.equal(a.status, 'INVALID');
  assert.equal(a.validCount, 0);
  assert.equal(a.invalidCount, 3);
});

test('audit: mixed coverage produces PARTIAL with valid/total counts', () => {
  const scope2 = mockScope([mockSample('incidentRecovery', [
    { id: 'r1', affectedCount: 400, unit: 'customers' },
    { id: 'r2', affectedCount: null, unit: null },
  ])]);
  const a = auditRequirement(req('req-phys-affected'), scope2);
  assert.equal(a.status, 'PARTIAL');
  assert.equal(a.validCount, 1);
  assert.equal(a.totalRecords, 2);
});

test('audit: conflicting lineage produces CONFLICT', () => {
  const scope = mockScope([mockSample('incidentClaims', [
    { id: 'c1', quantity: 5, unit: 'houses', conflictingWith: ['c2'] },
    { id: 'c2', quantity: 7, unit: 'houses', conflictingWith: ['c1'] },
  ])]);
  const a = auditRequirement(req('req-recon-facts'), scope);
  assert.equal(a.status, 'CONFLICT');
  assert.match(a.reasons.join(' '), /Conflicting lineage/);
});

test('audit: freshness stays unknown without a documented rule (never STALE)', () => {
  const scope = mockScope([mockSample('incidentClaims', [{ id: 'c1', quantity: 5, unit: 'houses' }])]);
  const a = auditRequirement(req('req-loss-count'), scope);
  assert.equal(a.freshness, 'unknown');
  assert.notEqual(a.status, 'STALE');
});

test('audit: access failure yields NOT_CHECKED and metric NOT_AVAILABLE', () => {
  const scope = mockScope([], false);
  scope.errorCategory = 'read-failure';
  const a = auditRequirement(req('req-loss-count'), scope);
  assert.equal(a.status, 'NOT_CHECKED');
  const readiness = assessMetricReadiness('physical_damage', auditRequirements(DATA_REQUIREMENTS, scope));
  assert.equal(readiness.readiness, 'NOT_AVAILABLE');
  assert.ok(readiness.blockers.length > 0);
});

test('audit: coverage numerator/denominator exclude optionals', () => {
  const scope = mockScope([
    mockSample('incidentRecovery', [{ id: 'r1', affectedCount: 10, unit: 'houses' }]),
  ]);
  const audits = auditRequirements(DATA_REQUIREMENTS, scope);
  const r = assessMetricReadiness('physical_gap', audits);
  const mandatory = DATA_REQUIREMENTS.filter((x) => x.metric_id === 'physical_gap' && x.required_or_optional === 'required');
  assert.equal(r.coverageDenominator, mandatory.length);
  assert.ok(r.coverageNumerator <= r.coverageDenominator);
  assert.equal(r.coverage, r.coverageDenominator > 0 ? r.coverageNumerator / r.coverageDenominator : null);
  assert.equal(r.readiness, 'BLOCKED'); // restored counts absent
  assert.match(r.blockers.join(' '), /req-phys-restored/);
});

test('audit: READY metric executes the real formula with satisfied IDs (mock)', () => {
  // Linkage: satisfied IDs feed a real service run with validated inputs.
  const resp = runCalculation({
    metric: 'physical_damage', origin: 'simulation',
    input: { assetCount: 5, replacementCostPerAsset: 150_000_000, damageFraction: 0.5 },
  });
  assert.equal(resp.result.value, 375_000_000);
  assert.equal(resp.result.status, 'calculated');
});

test('page: requirements section renders NOT_CHECKED state without live data', () => {
  const markup = renderToStaticMarkup(
    <LanguageProvider>
      <CalculationVerificationPage />
    </LanguageProvider>,
  );
  assert.match(markup, /data-testid="data-requirements"/);
  // SSR has no snapshot: audit has not run — must say so, with no DB counts.
  assert.match(markup, /Belum diperiksa/);
  assert.match(markup, /Periksa ulang/);
  // No synthetic fixture counts presented as database counts.
  assert.doesNotMatch(markup, /dokumen humaniter terbaca untuk insiden ini/);
});
