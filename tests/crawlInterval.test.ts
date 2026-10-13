import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isCrawlDue } from '../src/domain/humanitarian.ts';

test('paid incident crawl becomes due exactly 24 hours after last success', () => {
  const lastSuccess = '2026-10-13T12:36:44.058Z';
  const nextDue = Date.parse('2026-10-14T12:36:44.058Z');
  assert.equal(isCrawlDue(lastSuccess, nextDue - 1), false);
  assert.equal(isCrawlDue(lastSuccess, nextDue), true);
  assert.equal(isCrawlDue(lastSuccess, nextDue + 1), true);
});

test('missing or invalid history allows initial crawl, future success blocks it', () => {
  const now = Date.parse('2026-10-13T12:36:44.058Z');
  assert.equal(isCrawlDue(null, now), true);
  assert.equal(isCrawlDue('invalid', now), true);
  assert.equal(isCrawlDue('2026-10-14T12:36:44.058Z', now), false);
});
