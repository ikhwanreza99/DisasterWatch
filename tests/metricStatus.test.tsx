import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CHECK_METRICS,
  NON_METRIC_CHECKS,
  METRIC_MODULE,
  buildMetricStatuses,
  summariseMetricStatuses,
  checksForMetric,
  nextActionFor,
  requiredInputsForMetric,
} from '../src/services/verification/metricStatus';
import {
  listSupportedMetrics,
  runCalculation,
} from '../src/services/calculations/calculationService';
import { runCalculationVerification } from '../src/services/verification/calculationRegistry';
import { assessLiveReadiness } from '../src/services/calculations/liveAdapter';
import { DATA_REQUIREMENTS } from '../src/services/verification/requirementsInventory';
import CalculationVerificationPage from '../src/components/CalculationVerificationPage';
import { LanguageProvider } from '../src/i18n';

// --- Mapping integrity: nothing silently lost, every metric owned ---
test('mapping: every registry check is either metric-owned or explicitly cross-cutting', () => {
  const outcomes = runCalculationVerification().outcomes;
  const mapped = new Set(Object.keys(CHECK_METRICS));
  for (const o of outcomes) {
    assert.ok(mapped.has(o.id) || NON_METRIC_CHECKS.has(o.id), `check '${o.id}' is neither mapped nor non-metric`);
  }
  // No stale mapping entries referencing checks that no longer exist.
  const ids = new Set(outcomes.map((o) => o.id));
  for (const id of Object.keys(CHECK_METRICS)) {
    assert.ok(ids.has(id), `CHECK_METRICS references missing check '${id}'`);
  }
});

test('mapping: every supported metric is implemented and proven by at least one passing check', () => {
  const outcomes = runCalculationVerification().outcomes;
  const rows = buildMetricStatuses({ outcomes });
  assert.equal(rows.length, listSupportedMetrics().length);
  for (const row of rows) {
    assert.ok(row.implemented, `${row.metric} has no executing check`);
    assert.ok(row.testTotal > 0, `${row.metric} has no checks`);
    assert.ok(row.tested && row.testPass > 0, `${row.metric} has no passing check`);
    assert.ok(METRIC_MODULE[row.metric], `${row.metric} has no module drill-down`);
  }
});

test('checksForMetric returns only the checks that execute the metric', () => {
  const outcomes = runCalculationVerification().outcomes;
  const fundingGap = checksForMetric('funding_gap', outcomes).map((c) => c.id).sort();
  assert.deepEqual(fundingGap, ['gap-funding-ref', 'gap-stage-mismatch']);
  const reconcile = checksForMetric('reconcile_facts', outcomes).map((c) => c.id);
  assert.ok(reconcile.includes('recon-conflict-withheld'));
  assert.ok(!reconcile.includes('gap-funding-ref'));
});

// --- Overview counts are derived, never hardcoded ---
test('overview: counts derive from readiness + live runs, not from constants', () => {
  const outcomes = runCalculationVerification().outcomes;
  // No live snapshot → readiness unknown, no live results → everything blocked.
  const offline = summariseMetricStatuses(buildMetricStatuses({ outcomes, readiness: null }));
  assert.equal(offline.tracked, listSupportedMetrics().length);
  assert.equal(offline.implemented, listSupportedMetrics().length);
  assert.equal(offline.tested, listSupportedMetrics().length);
  assert.equal(offline.calculatedLive, 0);
  assert.equal(offline.blockedByData, listSupportedMetrics().length);
  assert.equal(offline.conflictsOrInvalid, 0);

  // A live reconcile result raises calculatedLive and lowers blockedByData.
  const readiness = assessLiveReadiness(
    { needs: [], recovery: [], claims: [], aidEvents: [], incidents: [] } as never,
    'x',
  );
  const liveByMetric = {
    reconcile_facts: {
      value: 62, unit: 'kejadian', status: 'calculated' as const,
      calculatedAt: '2026-10-16T00:00:00.000Z', source: 'm3', detail: 'aftershocks', trace: '62', warnings: [], missingInputs: [],
    },
  };
  const withLive = summariseMetricStatuses(buildMetricStatuses({ outcomes, readiness, liveByMetric }));
  assert.equal(withLive.calculatedLive, 1);
  assert.ok(withLive.blockedByData < offline.blockedByData);
});

test('overview: a withheld live run is never counted as calculated', () => {
  const outcomes = runCalculationVerification().outcomes;
  const readiness = assessLiveReadiness(
    { needs: [], recovery: [], claims: [], aidEvents: [], incidents: [] } as never,
    'x',
  );
  const liveByMetric = {
    reconcile_facts: {
      value: null, unit: null, status: 'conflict_pending_review' as const,
      calculatedAt: null, source: 'm1,m2', detail: 'damage', trace: '', warnings: [], missingInputs: [],
    },
  };
  const s = summariseMetricStatuses(buildMetricStatuses({ outcomes, readiness, liveByMetric }));
  assert.equal(s.calculatedLive, 0);
  assert.equal(s.conflictsOrInvalid, 1);
});

// --- Adapter output maps into the UI rows with exact blockers ---
test('readiness: unknown live values surface as blockers, never as zero', () => {
  const rows = buildMetricStatuses({
    readiness: assessLiveReadiness(
      { needs: [], recovery: [], claims: [], aidEvents: [], incidents: [] } as never,
      'padang',
    ),
  });
  const currentGap = rows.find((r) => r.metric === 'needs_current_gap')!;
  assert.equal(currentGap.readiness?.readiness, 'BLOCKED');
  assert.match(currentGap.readiness!.missingFields.join(' '), /usable supply|population|rate/);
  assert.equal(currentGap.live, null);
  // The next action names the missing inputs and never fabricates a result.
  assert.match(nextActionFor(currentGap), /Provide the missing inputs/);
});

test('requiredInputsForMetric lists mandatory items with units only', () => {
  const reqs = requiredInputsForMetric('utility_recovery', DATA_REQUIREMENTS);
  assert.ok(reqs.length >= 2);
  assert.ok(reqs.every((r) => r.data_item.length > 0));
  const currentGap = requiredInputsForMetric('needs_current_gap', DATA_REQUIREMENTS);
  assert.ok(currentGap.some((r) => /supply/i.test(r.data_item)));
});

// --- Synthetic vs live separation in the UI ---
test('page: technical detail sections are removed from the main view', () => {
  const markup = renderToStaticMarkup(
    <LanguageProvider>
      <CalculationVerificationPage />
    </LanguageProvider>,
  );
  assert.match(markup, /data-testid="calculation-page"/);
  assert.doesNotMatch(markup, /data-testid="calc-details"/);
  assert.doesNotMatch(markup, /data-testid="calc-overview"/);
  assert.doesNotMatch(markup, /data-testid="metric-explorer"/);
  assert.doesNotMatch(markup, /data-testid="blocked-metrics"/);
  assert.doesNotMatch(markup, /data-testid="svc-proof"/);
  assert.doesNotMatch(markup, /data-testid="calc-live"/);
  assert.doesNotMatch(markup, /data-testid="data-requirements"/);
  assert.doesNotMatch(markup, /AIza/);
});

// --- Service-layer sanity: live execution uses the real formula ---
test('live execution path returns a real value through the shared service', () => {
  const single = runCalculation({
    metric: 'reconcile_facts',
    incidentId: 'mx',
    origin: 'live',
    input: {
      unit: 'kejadian',
      facts: [{ factId: 'm3', value: 62, unit: 'kejadian', relation: 'independent', groupKey: 'aftershocks', sourceRefs: ['m3'] }],
    },
  });
  assert.equal(single.result.value, 62);
  assert.equal(single.result.origin, 'live');
  assert.equal(single.extendedStatus, 'calculated');
});

// --- Judge-facing default view: compact and honest ---
test('page: default view has three summary cards, three key results, and a readiness notice', () => {
  const markup = renderToStaticMarkup(
    <LanguageProvider>
      <CalculationVerificationPage />
    </LanguageProvider>,
  );
  assert.match(markup, /data-testid="summary-formulas"/);
  assert.match(markup, /data-testid="summary-tests"/);
  assert.match(markup, /data-testid="summary-live"/);
  assert.match(markup, /data-testid="key-results"/);
  assert.match(markup, /data-testid="key-result-physical_damage"/);
  assert.match(markup, /data-testid="key-result-utility_recovery"/);
  assert.match(markup, /data-testid="key-result-ori_index"/);
  assert.match(markup, /data-testid="data-readiness"/);
  assert.equal(markup.match(/data-testid="summary-/g)?.length, 3);
  assert.equal(markup.match(/data-testid="key-result-/g)?.length, 3);
});

test('page: no live session means Live Calculations is NOT verified, never zero', () => {
  const markup = renderToStaticMarkup(
    <LanguageProvider>
      <CalculationVerificationPage />
    </LanguageProvider>,
  );
  assert.match(markup, /data-testid="summary-live"[\s\S]*?Belum diverifikasi/);
  // With no verified live run, every key result is a labelled simulation, never live.
  assert.equal(markup.match(/Contoh Simulasi<\/span>/g)?.length, 3);
  assert.doesNotMatch(markup, /Data Aktual<\/span>/);
});
