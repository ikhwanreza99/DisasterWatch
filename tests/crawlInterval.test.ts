import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CRAWL_INTERVAL_MS, isCrawlDue } from '../src/domain/humanitarian.ts';

const DAY_MS = 24 * 3600_000;

test('shared incident-crawler cooldown is five days for every provider', () => {
  assert.equal(CRAWL_INTERVAL_MS, 5 * DAY_MS);
});

test('paid incident crawl becomes due exactly five days after last success', () => {
  const lastSuccess = '2026-10-13T12:36:44.058Z';
  const nextDue = Date.parse(lastSuccess) + CRAWL_INTERVAL_MS;
  assert.equal(isCrawlDue(lastSuccess, nextDue - 1), false);
  assert.equal(isCrawlDue(lastSuccess, nextDue), true);
  assert.equal(isCrawlDue(lastSuccess, nextDue + 1), true);
});

test('a successful run less than five days ago is not due', () => {
  const lastSuccess = '2026-10-13T12:36:44.058Z';
  const now = Date.parse(lastSuccess) + 4 * DAY_MS;
  assert.equal(isCrawlDue(lastSuccess, now), false);
});

test('missing or invalid history allows initial crawl, future success blocks it', () => {
  const now = Date.parse('2026-10-13T12:36:44.058Z');
  assert.equal(isCrawlDue(null, now), true);
  assert.equal(isCrawlDue('invalid', now), true);
  assert.equal(isCrawlDue('2026-10-15T12:36:44.058Z', now), false);
});

test('behaviour is consistent at the five-day boundary', () => {
  const lastSuccess = '2026-10-13T12:36:44.058Z';
  const at = Date.parse(lastSuccess);
  assert.equal(isCrawlDue(lastSuccess, at), false);
  assert.equal(isCrawlDue(lastSuccess, at + CRAWL_INTERVAL_MS - 1), false);
  assert.equal(isCrawlDue(lastSuccess, at + CRAWL_INTERVAL_MS), true);
});
