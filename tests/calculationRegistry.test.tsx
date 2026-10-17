import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MODULE_LABELS,
  VERIFICATION_REGISTRY_VERSION,
  runCalculationVerification,
} from '../src/services/verification/calculationRegistry';
import CalculationVerificationPage from '../src/components/CalculationVerificationPage';
import { LanguageProvider } from '../src/i18n';

test('registry executes the engine and reports honest summary counts', () => {
  const r1 = runCalculationVerification();
  const r2 = runCalculationVerification();
  // Deterministic: same reference outputs on repeat runs (timestamps excluded).
  const strip = (r: typeof r1) => r.outcomes.map((o) => `${o.id}:${o.status}:${o.evidence.actual}`);
  assert.deepEqual(strip(r1), strip(r2));
  assert.equal(r1.registryVersion, VERIFICATION_REGISTRY_VERSION);
  assert.ok(r1.engineVersion.length > 0);
  assert.ok(r1.priorityVersion.length > 0);
  assert.ok(r1.generatedAt);
  const s = r1.summary;
  assert.equal(s.total, s.PASS + s.FAIL + s.PARTIAL + s.NOT_VERIFIED + s.NOT_IMPLEMENTED + s.INSUFFICIENT_DATA);
  // Six verification categories are all represented.
  assert.deepEqual(Object.keys(MODULE_LABELS).sort(), ['integration', 'loss', 'needs-intelligence', 'recovery-gap', 'utility-recovery', 'validation-provenance']);
  // Live read-only check must never PASS inside the synchronous registry.
  const live = r1.outcomes.find((o) => o.id === 'int-live-readonly');
  assert.equal(live?.method, 'live-read');
  assert.equal(live?.status, 'NOT_VERIFIED');
});

test('reference outcomes match the approved formulas', () => {
  const r = runCalculationVerification();
  const byId = new Map(r.outcomes.map((o) => [o.id, o]));
  assert.equal(byId.get('loss-damage-ref')?.status, 'PASS');
  assert.equal(byId.get('loss-econ-ref')?.status, 'PASS');
  assert.equal(byId.get('loss-total-ref')?.status, 'PASS');
  assert.equal(byId.get('gap-funding-ref')?.status, 'PASS');
  assert.equal(byId.get('gap-funding-pct-ref')?.status, 'PASS');
  assert.equal(byId.get('gap-physical-ref')?.status, 'PASS');
  assert.equal(byId.get('needs-demand-ref')?.status, 'PASS');
  assert.equal(byId.get('needs-priority-ref')?.status, 'PASS');
  assert.match(byId.get('needs-priority-ref')?.evidence.actual ?? '', /88/);
});

test('safety invariants are verified, not assumed', () => {
  const r = runCalculationVerification();
  const byId = new Map(r.outcomes.map((o) => [o.id, o]));
  for (const id of ['loss-total-overlap', 'loss-severity-percent-ref', 'loss-severity-ambiguous', 'loss-econ-basis', 'loss-total-period-mismatch', 'gap-stage-mismatch', 'gap-recovered-exceeds', 'gap-zero-denominator', 'needs-forecast-incomplete', 'needs-forecast-unusable-stock', 'needs-forecast-unconfirmed-incoming', 'needs-backlog-overlap', 'needs-distribution-excluded', 'needs-priority-missing', 'needs-override-scope', 'valid-negative', 'valid-scope-mismatch', 'valid-need-tiers', 'valid-duplicates', 'int-empty-snapshot', 'int-unquantified-withheld', 'ori-golden-ref', 'ori-missing-withheld', 'ori-weights-sum', 'needs-current-gap-ref', 'needs-current-gap-zero', 'needs-current-gap-missing', 'needs-current-gap-unit', 'loss-damage-aggregate-ref', 'loss-damage-aggregate-unit', 'recon-parent-child-ref', 'recon-disjoint-ref', 'recon-conflict-withheld', 'recon-single-canonical', 'recon-dangling-subset', 'recon-revision-supersedes', 'recon-scope-warning']) {
    assert.equal(byId.get(id)?.status, 'PASS', id);
  }
});

test('status mapping covers every required bucket', () => {
  const r = runCalculationVerification();
  const statuses = new Set(r.outcomes.map((o) => o.status));
  assert.ok(statuses.has('PASS'));
  assert.ok(statuses.has('NOT_VERIFIED'));
  // Every outcome carries evidence and a real run timestamp.
  for (const o of r.outcomes) {
    assert.ok(o.evidence.formula.length > 0, o.id);
    assert.ok(o.evidence.version.length > 0, o.id);
    assert.ok(o.checkedAt.length > 0, o.id);
    assert.ok(o.evidence.provenance.length > 0, o.id);
  }
});

test('/calculation page renders the compact judge view without secrets', () => {
  const markup = renderToStaticMarkup(
    <LanguageProvider>
      <CalculationVerificationPage />
    </LanguageProvider>,
  );
  assert.match(markup, /data-testid="calculation-page"/);
  assert.match(markup, /Mesin Kalkulasi/);
  assert.match(markup, /data-testid="summary-formulas"/);
  assert.match(markup, /data-testid="summary-tests"/);
  assert.match(markup, /data-testid="summary-live"/);
  assert.match(markup, /data-testid="key-results"/);
  assert.match(markup, /data-testid="data-readiness"/);
  // Technical-details UI is no longer part of the main page.
  assert.doesNotMatch(markup, /data-testid="calc-details"/);
  assert.doesNotMatch(markup, /calc-module-loss/);
  assert.doesNotMatch(markup, /data-testid="svc-proof"/);
  assert.doesNotMatch(markup, /data-testid="data-requirements"/);
  assert.doesNotMatch(markup, /AIza/);
  assert.doesNotMatch(markup, /eyJ[A-Za-z0-9]/);
});
