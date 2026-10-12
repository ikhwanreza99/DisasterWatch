import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFirmsHotspots, firmsRangeFromSelection } from '../src/services/firms/index.ts';
import { resolveDateRange } from '../src/domain/dateRange.ts';
const csv = 'latitude,longitude,frp,confidence,acq_date,acq_time,daynight\n-6,110,20,n,2026-10-08,0100,D';

test('Today includes yesterday for NASA FIRMS near-real-time delay', () => {
  const range = firmsRangeFromSelection('Today');
  const today = resolveDateRange('Today');
  assert.equal(range.days, 2);
  assert.equal(range.id, 'today-nrt');
  assert.equal(range.start.getTime(), today.start.getTime() - 86_400_000);
  assert.equal(range.sources.length, 4);
});

test('a source taking more than 45 seconds still contributes all its hotspots', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = globalThis.fetch;
  let finish!: (response: Response) => void;
  let firstReady!: () => void;
  const first = new Promise<void>(resolve => { firstReady = resolve; });
  let calls = 0;
  globalThis.fetch = ((_url, options) => {
    if (++calls === 1) return Promise.resolve(new Response(csv));
    return new Promise<Response>((resolve, reject) => {
      finish = resolve;
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  }) as typeof fetch;
  try {
    const range = { ...firmsRangeFromSelection('Today'), id: 'slow-source-test', start: new Date('2026-10-08T00:00:00Z'), end: new Date('2026-10-08T23:59:59Z') };
    range.sources = ['VIIRS_SNPP_NRT', 'MODIS_NRT'];
    let failed = 0;
    const pending = fetchFirmsHotspots(range, undefined, (progress) => {
      failed = progress.failed;
      if (progress.completed === 1) firstReady();
    });
    await first;
    t.mock.timers.tick(60_000);
    finish(new Response(csv));
    const points = await pending;
    assert.equal(points.length, 2, 'slow source must not be discarded by a UI timeout');
    assert.equal(failed, 0);
  } finally { globalThis.fetch = original; t.mock.timers.reset(); }
});

test('renders successful FIRMS batches before a slower source completes; partial results are not cached', async () => {
  const original = globalThis.fetch;
  let resolveSlow!: (response: Response) => void;
  let calls = 0;
  globalThis.fetch = (() => {
    calls++;
    return calls === 1 ? Promise.resolve(new Response(csv)) : new Promise<Response>(resolve => { resolveSlow = resolve; });
  }) as typeof fetch;
  try {
    const range = { ...firmsRangeFromSelection('Today'), id: 'progress-test', start: new Date('2026-10-08T00:00:00Z'), end: new Date('2026-10-08T23:59:59Z') };
    range.sources = ['VIIRS_SNPP_NRT', 'MODIS_NRT'];
    let firstReady!: () => void;
    const first = new Promise<void>(resolve => { firstReady = resolve; });
    const updates: { completed: number; failed: number; count: number }[] = [];
    const pending = fetchFirmsHotspots(range, undefined, (progress, points) => {
      updates.push({ completed: progress.completed, failed: progress.failed, count: points.length });
      if (progress.completed === 1) firstReady();
    });
    await first;
    assert.equal(updates.at(-1)?.count, 1);
    assert.equal(updates.at(-1)?.completed, 1);
    resolveSlow(new Response('unavailable', { status: 503 }));
    assert.equal((await pending).length, 1);
    assert.equal(updates.at(-1)?.failed, 1);
    globalThis.fetch = (async () => { calls++; return new Response(csv); }) as typeof fetch;
    await fetchFirmsHotspots(range);
    assert.equal(calls, 4, 'retry must fetch missing data instead of serving an incomplete cache');
  } finally { globalThis.fetch = original; }
});

test('all failed FIRMS requests reject instead of showing zero as success', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response('failure', { status: 500 })) as typeof fetch;
  try {
    const range = { ...firmsRangeFromSelection('Today'), id: 'failure-test' };
    await assert.rejects(fetchFirmsHotspots(range), /belum tersedia/);
  } finally { globalThis.fetch = original; }
});
