import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNews } from '../src/services/disasterNews.ts';
const now = Date.parse('2026-10-08T12:00:00Z');
const item = (i: number) => ({ title: `Banjir Indonesia ${i} - Media`, link: `https://example.com/articles/${i}`, pubDate: new Date(now - i * 60_000).toUTCString() });
test('selects 15 newest unique headlines with source and publication dates', () => {
  const items = normalizeNews({ data: { ok: true, items: [...Array.from({ length: 30 }, (_, i) => item(29-i)), item(0)] } }, now);
  assert.equal(items.length, 15);
  assert.equal(items[0].title, 'Banjir Indonesia 0');
  assert.equal(items[14].title, 'Banjir Indonesia 14');
  assert.equal(items[0].source, 'Media');
});
test('rejects unsafe links, malformed dates, old/future and unrelated news', () => {
  const invalid = [null, {}, { ...item(0), link: 'https://news.google.com/rss/articles/opaque' }, { ...item(0), link: 'javascript:alert(1)' }, { ...item(0), link: 'https://secret@evil.com' }, { ...item(0), pubDate: 'unknown' }, item(60*24*8), item(-60), { ...item(0), title: 'Harga saham terbaru' }];
  assert.deepEqual(normalizeNews({ data: { ok: true, items: invalid } }, now), []);
});
test('provider failure is not silently interpreted as an empty successful feed', () => {
  for (const response of [null, {}, { data: { ok: false, items: [] } }]) assert.throws(() => normalizeNews(response, now));
});

test('fresh cache skips Zapi even with an unusable key; missing key preserves last data', async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = await mkdtemp(join(tmpdir(), 'dw-news-test-'));
  const file = join(dir, 'news.json');
  try {
    const feed = { updatedAt: new Date().toISOString(), items: [{ title: 'Banjir Indonesia', url: 'https://example.com', source: 'Test', publishedAt: new Date().toISOString() }] };
    await writeFile(file, JSON.stringify(feed));
    const run = (key: string) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/fetchDisasterNews.ts', file], { encoding: 'utf8', env: { ...process.env, ZAPI_API_KEY: key } });
    const cached = run('test-key-never-sent');
    assert.equal(cached.status, 0);
    assert.match(cached.stdout, /no API request/);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), feed);
    feed.updatedAt = '2026-01-01T00:00:00Z';
    await writeFile(file, JSON.stringify(feed));
    assert.equal(run('').status, 0);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), feed);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test('metadata separates domestic aid, domestic disasters and foreign destinations', async () => {
  const { extractNewsMetadata } = await import('../src/services/newsMetadata.ts');
  const aid = extractNewsMetadata('BPBD kirim bantuan sembako untuk korban banjir Demak');
  assert.equal(aid?.countryCode, 'ID');
  assert.equal(aid?.aidRelated, true);
  assert.deepEqual(aid?.aidCategories, ['logistics']);
  assert.equal(aid?.verificationStatus, 'UNVERIFIED');
  assert.equal(extractNewsMetadata('Gempa bumi mengguncang Cianjur')?.topic, 'disaster_event');
  assert.equal(extractNewsMetadata('Indonesia kirim bantuan bencana ke Myanmar'), null);
  assert.equal(extractNewsMetadata('Banjir besar melanda sebuah kota'), null);
  assert.equal(extractNewsMetadata('Harga sembako turun di Jakarta'), null);
});

test('five-day interval does not request API for a four-day-old snapshot', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = await mkdtemp(join(tmpdir(), 'dw-five-day-'));
  try {
    const file = join(dir, 'feed.json');
    await writeFile(file, JSON.stringify({ updatedAt: new Date(Date.now() - 4 * 86400_000).toISOString(), items: [] }));
    const run = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/fetchDisasterNews.ts', file], { encoding: 'utf8', env: { ...process.env, ZAPI_API_KEY: 'never-sent' } });
    assert.equal(run.status, 0);
    assert.match(run.stdout, /no API request/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('fills a short feed from fallback searches, deduplicates and stops at 15', async () => {
  const { collectDisasterNews } = await import('../src/services/disasterNews.ts');
  let calls = 0;
  const result = await collectDisasterNews(async () => {
    calls++;
    return { data: { ok: true, items: Array.from({ length: calls === 1 ? 5 : 20 }, (_, i) => item(i)) } };
  }, now);
  assert.equal(calls, 2);
  assert.equal(result.length, 15);
  assert.equal(new Set(result.map(x => x.url)).size, 15);
  assert.equal(result[0].title, 'Banjir Indonesia 0');
});

test('keeps a partial feed when fallbacks fail and never invents extra articles', async () => {
  const { collectDisasterNews, NEWS_QUERIES } = await import('../src/services/disasterNews.ts');
  let calls = 0;
  const result = await collectDisasterNews(async () => {
    if (++calls > 1) throw new Error('unavailable');
    return { data: { ok: true, items: [item(0)] } };
  }, now);
  assert.equal(calls, NEWS_QUERIES.length);
  assert.equal(result.length, 1);
  await assert.rejects(collectDisasterNews(async () => { throw new Error('unavailable'); }, now));
});
