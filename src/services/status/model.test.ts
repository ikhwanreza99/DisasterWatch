import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fallbackNote,
  hasValidGeminiCandidates,
  isNonEmptyModelText,
  redactStatusText,
  stale,
  safeStatusError,
  isStatusVisible,
  statusAdvice,
  type ServiceCheck,
} from './model.ts';
const check: ServiceCheck = { id:'x',name:'x',state:'configured',detail:'x',checkedAt:null,scope:'backend' };
test('configuration is not proof and old success evidence is stale', () => {
  assert.equal(stale(check),false);
  assert.equal(stale({...check,state:'ok',checkedAt:'2026-10-12T00:00:00Z'},Date.parse('2026-10-13T01:00:00Z')),true);
  assert.equal(stale({...check,checkedAt:'invalid'}),true);
});
test('configured and unknown checks are hidden while actionable results remain visible', () => {
  assert.equal(isStatusVisible({ ...check, state: 'configured' }), false);
  assert.equal(isStatusVisible({ ...check, state: 'unknown' }), false);
  assert.equal(isStatusVisible({ ...check, id: 'gemini-direct', state: 'disabled' }), false);
  assert.equal(isStatusVisible({ ...check, id: 'gemini-direct', state: 'ok' }), true);
  assert.equal(isStatusVisible({ ...check, id: 'maps', state: 'error' }), false);
  assert.equal(isStatusVisible({ ...check, id: 'maps', state: 'ok' }), false);
  assert.equal(isStatusVisible({ ...check, id: 'google-search-probe', state: 'error' }), false);
  assert.equal(isStatusVisible({ ...check, id: 'google-search-probe', state: 'ok' }), false);
  assert.equal(isStatusVisible({ ...check, state: 'ok' }), true);
  assert.equal(isStatusVisible({ ...check, state: 'error' }), true);
  assert.equal(isStatusVisible({ ...check, state: 'disabled' }), true);
});
test('Google Search 403 failure explains the likely key and API permissions to check', () => {
  assert.match(statusAdvice({ ...check, id: 'google-search-probe', state: 'error', detail: 'HTTP 403' }) || '', /DISASTERWATCH_GEMINI_SEARCH_KEY/);
});
test('Maps timeout failure explains the key, API and App Check settings to inspect', () => {
  const advice = statusAdvice({ ...check, id: 'maps', state: 'error', detail: 'Peta belum berhasil memuat dalam 20 detik.' }) || '';
  assert.match(advice, /Maps JavaScript API/);
  assert.match(advice, /App Check\/reCAPTCHA/);
});
test('status errors exclude secrets, URLs and raw provider bodies', () => {
  assert.equal(safeStatusError(new Error('HTTP 403 secret=private-key response body')), 'HTTP 403');
  assert.equal(safeStatusError(new Error('https://host?key=private-key')), 'Permintaan gagal; periksa akses, jaringan, atau kuota');
  assert.equal(safeStatusError({code:'permission-denied'}), 'permission-denied');
});

test('SDK errors expose only numeric HTTP status, never provider message/body', () => {
  assert.equal(safeStatusError({code:'fetch-error',customErrorData:{status:503,errorDetails:'private-body'},message:'private-key'}), 'fetch-error · HTTP 503');
});

test('fallback success names the model that answered, without the primary raw error', () => {
  // Primary gemini-3.8-flash fails with empty output; fallback answers.
  const note = fallbackNote('gemini-3.5-flash-lite', 'gemini-3.8-flash');
  assert.ok(note.includes('gemini-3.5-flash-lite'));
  assert.ok(note.includes('Model utama dilewati; fallback berhasil digunakan.'));
  assert.ok(!note.includes('Empty model response'));
  assert.ok(!note.includes('HTTP'));
});

test('primary HTTP 429 still yields a clean fallback success note', () => {
  const note = fallbackNote('gemini-3.5-flash-lite', 'gemini-3.8-flash');
  assert.ok(note.includes('gemini-3.5-flash-lite'));
  assert.ok(!note.includes('429'));
  assert.ok(!note.includes('quota'));
});

test('primary success needs no fallback note', () => {
  assert.equal(fallbackNote('gemini-3.8-flash', 'gemini-3.8-flash'), 'menggunakan gemini-3.8-flash, tanpa fallback.');
});

test('empty output from every candidate is not success', () => {
  assert.equal(isNonEmptyModelText(''), false);
  assert.equal(isNonEmptyModelText('   '), false);
  assert.equal(isNonEmptyModelText(null), false);
  assert.equal(isNonEmptyModelText(undefined), false);
  assert.equal(isNonEmptyModelText('OK'), true);
  assert.equal(hasValidGeminiCandidates({ candidates: [] }), false);
  assert.equal(hasValidGeminiCandidates({ candidates: [{ content: { parts: [{ text: '' }] } }] }), false);
  assert.equal(hasValidGeminiCandidates({ candidates: [{ content: { parts: [{ text: '   ' }] } }] }), false);
  assert.equal(
    hasValidGeminiCandidates({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }),
    true,
  );
});

test('all candidates failing keeps an error state with a redacted message', () => {
  // Terse by design: numeric status only, raw body never surfaced here.
  assert.equal(safeStatusError(new Error('request failed: HTTP 401 unauthorized body')), 'HTTP 401');
  assert.equal(safeStatusError(new Error('request failed: HTTP 429 quota exceeded')), 'HTTP 429');
});

test('status text never leaks keys or tokens', () => {
  const fakeKey = 'AIzaFakeKey1234567890abcdef';
  const fakeJwt = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';
  assert.ok(!safeStatusError(new Error(`HTTP 401 ${fakeKey}`)).includes(fakeKey));
  assert.ok(!safeStatusError(new Error(`HTTP 401 ${fakeJwt}`)).includes(fakeJwt));
  assert.ok(!redactStatusText(`x-goog-api-key: ${fakeKey}`).includes(fakeKey));
  assert.ok(!redactStatusText(`token=${fakeJwt}`).includes(fakeJwt));
  const note = fallbackNote('gemini-3.5-flash-lite', 'gemini-3.8-flash');
  assert.ok(!note.includes(fakeKey));
  assert.ok(!note.includes(fakeJwt));
});


test('compliance reflects completed failures and disabled probes instead of claiming untested', async () => {
  const { complianceEvidence } = await import('./complianceEvidence');
  const base = { id: 'firebase-ai', name: 'Gemini', detail: '', checkedAt: '2026-10-17T00:00:00Z', scope: 'browser' as const };
  assert.equal(complianceEvidence({ ...base, state: 'error' }), 'failed');
  assert.equal(complianceEvidence({ ...base, state: 'disabled' }), 'disabled');
  assert.equal(complianceEvidence({ ...base, state: 'checking' }), 'checking');
  assert.equal(complianceEvidence({ ...base, state: 'ok' }), 'met');
  assert.equal(complianceEvidence({ ...base, state: 'ok', checkedAt: null }), 'untested');
  assert.equal(complianceEvidence(undefined), 'untested');
});
