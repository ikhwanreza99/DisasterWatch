import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProgress } from './checkProgress';
import type { ServiceCheck } from './model';
const check = (id: string, state: ServiceCheck['state']): ServiceCheck => ({ id, state, name: id, detail: '', checkedAt: null, scope: 'browser' });
test('pending browser checks and report start at zero', () => {
  assert.deepEqual(checkProgress([check('maps', 'checking'), check('ai', 'configured')], ['maps', 'ai'], true), { total: 3, completed: 0, percent: 0 });
});
test('report and failed checks count as completed work, not successful services', () => {
  assert.deepEqual(checkProgress([check('maps', 'error'), check('ai', 'checking')], ['maps', 'ai'], false), { total: 3, completed: 2, percent: 67 });
});
test('completed, empty, and skipped results reach 100%; excluded storage is not pending', () => {
  assert.equal(checkProgress([check('maps', 'ok'), check('ai', 'disabled'), check('weather', 'empty'), check('storage', 'configured')], ['maps', 'ai', 'weather'], false).percent, 100);
});
test('a retry decreases progress until its new result settles', () => {
  const ids = ['maps', 'ai'];
  assert.equal(checkProgress([check('maps', 'ok'), check('ai', 'ok')], ids, false).percent, 100);
  assert.equal(checkProgress([check('maps', 'checking'), check('ai', 'ok')], ids, false).percent, 67);
});
test('report-only mode and missing results do not invent completed browser checks', () => {
  assert.equal(checkProgress([], [], true).percent, 0);
  assert.equal(checkProgress([], [], false).percent, 100);
  assert.equal(checkProgress([], ['maps'], false).completed, 1);
});
