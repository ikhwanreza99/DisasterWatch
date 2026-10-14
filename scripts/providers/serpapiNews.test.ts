import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSerpNews, searchSerpNews } from './serpapiNews.ts';

const item = { title: 'Banjir Gayo Lues', link: 'https://example.org/banjir#detail', source: { name: 'Media' }, iso_date: '2026-10-09T10:00:00Z', thumbnail: 'https://example.org/foto.jpg' };
test('parses grouped stories, deduplicates URLs and retains explicit publisher timestamps', () => {
  const hits = parseSerpNews({ search_metadata: { status: 'Success' }, news_results: [
    { ...item, iso_date: undefined }, { stories: [item, { ...item, link: 'http://localhost/private' }] },
  ] });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].link, 'https://example.org/banjir');
  assert.equal(hits[0].publishedAt, '2026-10-09T10:00:00.000Z');
  assert.equal(hits[0].sourceName, 'Media');
  assert.equal(hits[0].imageUrl, 'https://example.org/foto.jpg');
});
test('does not invent publication dates and distinguishes invalid responses from empty results', () => {
  assert.equal(parseSerpNews({ search_metadata: { status: 'Success' }, news_results: [{ ...item, iso_date: '2 hours ago' }] })[0].publishedAt, null);
  assert.deepEqual(parseSerpNews({ search_metadata: { status: 'Success' }, news_results: [] }), []);
  assert.throws(() => parseSerpNews({ error: 'private provider error' }), { message: 'Invalid SerpApi news response' });
});
test('uses Indonesian Google News and sanitizes failures containing credentials', async () => {
  const request = (async (url) => {
    const params = new URL(String(url)).searchParams;
    assert.equal(params.get('engine'), 'google_news');
    assert.equal(params.get('hl'), 'id');
    assert.equal(params.get('gl'), 'id');
    assert.equal(params.get('api_key'), 'test-secret');
    return new Response(JSON.stringify({ search_metadata: { status: 'Success' }, news_results: [item] }));
  }) as typeof fetch;
  assert.equal((await searchSerpNews('query', 'test-secret', request)).length, 1);
  await assert.rejects(searchSerpNews('query', 'test-secret', (async () => new Response('test-secret', { status: 429 })) as typeof fetch), { message: 'HTTP 429' });
  await assert.rejects(searchSerpNews('query', 'test-secret', (async () => { throw new Error('URL api_key=test-secret'); }) as typeof fetch), { message: 'SerpApi request failed' });
});
