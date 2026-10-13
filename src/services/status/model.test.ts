import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stale, safeStatusError, type ServiceCheck } from './model.ts';
const check: ServiceCheck = { id:'x',name:'x',state:'configured',detail:'x',checkedAt:null,scope:'backend' };
test('configuration is not proof and old success evidence is stale', () => {
  assert.equal(stale(check),false);
  assert.equal(stale({...check,state:'ok',checkedAt:'2026-10-12T00:00:00Z'},Date.parse('2026-10-13T01:00:00Z')),true);
  assert.equal(stale({...check,checkedAt:'invalid'}),true);
});
test('status errors exclude secrets, URLs and raw provider bodies', () => {
  assert.equal(safeStatusError(new Error('HTTP 403 secret=private-key response body')), 'HTTP 403');
  assert.equal(safeStatusError(new Error('https://host?key=private-key')), 'Permintaan gagal; periksa akses, jaringan, atau kuota');
  assert.equal(safeStatusError({code:'permission-denied'}), 'permission-denied');
});

test('SDK errors expose only numeric HTTP status, never provider message/body', () => {
  assert.equal(safeStatusError({code:'fetch-error',customErrorData:{status:503,errorDetails:'private-body'},message:'private-key'}), 'fetch-error · HTTP 503');
});
