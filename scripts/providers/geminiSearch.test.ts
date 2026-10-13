import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGroundedSearch, searchGemini } from './geminiSearch.ts';

const text = 'Banjir Gayo Lues membutuhkan air bersih.';
const citation = { type: 'url_citation', url: 'https://example.org/banjir#detail', title: 'Banjir Gayo Lues', start_index: 0, end_index: text.length };
const result = { status: 'completed', steps: [
  { type: 'google_search_call' },
  { type: 'google_search_result', result: [{ search_suggestions: '<div>Google</div>' }] },
  { type: 'model_output', content: [{ type: 'text', text: text + ' Kalimat tanpa sumber.', annotations: [citation, citation, { ...citation, url: 'http://localhost/a' }] }] },
] };

test('only cited public HTTPS links; dedupe; no invented date or uncited text', () => {
  const hits = parseGroundedSearch(result);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].link, 'https://example.org/banjir');
  assert.equal(hits[0].summary, text);
  assert.equal(hits[0].pubDate, null);
  assert.equal(hits[0].searchSuggestions, '<div>Google</div>');
});
test('rejects ungrounded or incomplete answers instead of treating them as empty search', () => {
  assert.throws(() => parseGroundedSearch({ steps: [{ type: 'model_output' }] }));
  assert.throws(() => parseGroundedSearch({ status: 'in_progress', steps: [] }));
  assert.deepEqual(parseGroundedSearch({ status: 'completed', steps: [{ type: 'google_search_call' }] }), []);
});
test('invalid citation offsets never include the whole generated answer', () => {
  const hits = parseGroundedSearch({ steps: [{ type: 'google_search_call' }, { type: 'model_output', content: [{ type: 'text', text, annotations: [{ ...citation, end_index: 9999 }] }] }] });
  assert.equal(hits[0].summary, null);
});
test('key in header only, Google search enabled, HTTP errors sanitized', async () => {
  const mock = (async (url, init) => {
    assert(!String(url).includes('test-secret'));
    assert.equal((init!.headers as Record<string, string>)['x-goog-api-key'], 'test-secret');
    assert.deepEqual(JSON.parse(String(init!.body)).tools, [{ type: 'google_search' }]);
    return new Response(JSON.stringify(result));
  }) as typeof fetch;
  assert.equal((await searchGemini('banjir Gayo Lues', 'test-secret', 'test-model', mock)).length, 1);
  await assert.rejects(searchGemini('query', 'test-secret', 'test-model', (async () => new Response('private body', { status: 429 })) as typeof fetch), { message: 'HTTP 429' });
});
