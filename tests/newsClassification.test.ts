import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyNews, getNewsSource } from '../src/services/newsClassification';

test('editorial classification overrides mixed report text', () => {
  assert.equal(classifyNews({ newsCategory: 'positive', desc: 'Bantuan diterima setelah akses terputus.' }), 'positive');
});
test('new unmet needs take priority over delivered aid in legacy reports', () => {
  assert.equal(classifyNews({ desc: 'Makanan telah diterima, warga masih membutuhkan air bersih.' }), 'needs');
});
test('casualties and broken access remain negative even alongside recovery', () => {
  assert.equal(classifyNews({ desc: 'Tercatat korban jiwa, pengiriman bantuan dimulai.' }), 'negative');
  assert.equal(classifyNews({ desc: 'Akses terputus, penanganan berlangsung.' }), 'negative');
});
test('delivery and recovery are positive', () => {
  assert.equal(classifyNews({ desc: 'Distribusi masker telah diterima di posko.' }), 'positive');
  assert.equal(classifyNews({ desc: 'Perbaikan jalan selesai, akses aman.' }), 'positive');
});
test('source links preserve article URL and name, with hostname fallback', () => {
  assert.deepEqual(getNewsSource({ sourceUrl: 'https://example.com/berita/1', sourceName: 'Portal Berita' }), { url: 'https://example.com/berita/1', name: 'Portal Berita' });
  assert.equal(getNewsSource({ sourceUrl: 'https://example.com/post/1' })?.name, 'example.com');
});
test('missing, malformed, and unsafe source URLs do not create links', () => {
  for (const sourceUrl of [undefined, 'not-a-url', 'javascript:alert(1)', 'data:text/html,hello']) {
    assert.equal(getNewsSource({ sourceUrl }), null);
  }
});


test('direct reports never link out even when they contain a URL', () => {
  for (const sourceType of ['citizen', 'field', 'aid'] as const) {
    assert.equal(getNewsSource({ sourceType, sourceUrl: 'https://example.com/report' }), null);
  }
});
test('portal and internet reports expose their source URL', () => {
  for (const sourceType of ['media', 'internet', 'social'] as const) {
    assert.equal(getNewsSource({ sourceType, sourceUrl: 'https://example.com/news' })?.url, 'https://example.com/news');
  }
});
