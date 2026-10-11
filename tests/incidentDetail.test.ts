// Incident detail acceptance tests (pure logic + static template render; no network).
// Fixture headlines below are SYNTHETIC test data, never presented as real articles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncidentArticle } from '../src/domain/incidentDetail.ts';
import { descriptorFor } from '../src/services/incidentRegistry.ts';
import { classifyRelevance, filterIncidentNews } from '../src/services/incidentNews.ts';
import { extractAidEvents, extractPosko } from '../src/services/incidentIntel.ts';
import { poskoMapMarkers } from '../src/domain/incidentDetail.ts';

const art = (over: Partial<IncidentArticle> & { url: string; title: string }): IncidentArticle => ({
  sourceName: 'Test Media',
  sourceType: 'NEWS_MEDIA',
  publishedAt: '2026-10-05T00:00:00.000Z',
  retrievedAt: '2026-10-11T00:00:00.000Z',
  summary: null,
  contentStatus: 'METADATA_ONLY',
  incidentId: null,
  discoveredBy: 'test-fixture',
  ...over,
});

const cianjur = descriptorFor('cianjur')!;
const lombok = descriptorFor('lombok-2018-08-05')!;
const ntt = descriptorFor('ntt-sumba-barat-daya-2026-10-04')!;

test('1: Cianjur articles match Cianjur, reject Lombok/NTT news', () => {
  const a = art({ url: 'https://example.com/cj', title: 'Gempa Cianjur: BPBD dirikan posko di Cugenang, 6 tenda disalurkan', summary: 'Tagana dirikan tenda di Desa Gasol' });
  assert.equal(classifyRelevance(a, cianjur).status, 'MATCHED');
  assert.equal(classifyRelevance(a, lombok).status, 'REJECTED');
  assert.equal(classifyRelevance(a, ntt).status, 'REJECTED');
});

test('2: Lombok articles match Lombok, reject Cianjur/NTT news', () => {
  const a = art({ url: 'https://example.com/lb', title: 'Gempa Lombok Utara: 80 persen bangunan rusak, BNPB salurkan bantuan', publishedAt: '2018-08-06T00:00:00Z', summary: 'Mataram dan Lombok Timur terdampak' });
  assert.equal(classifyRelevance(a, lombok).status, 'MATCHED');
  assert.equal(classifyRelevance(a, cianjur).status, 'REJECTED');
  assert.equal(classifyRelevance(a, ntt).status, 'REJECTED');
});

test('3: NTT articles match the NTT incident only', async () => {
  const { nttArticlesSeed } = await import('../src/data/nttCase.ts');
  const { descriptorFor: d } = await import('../src/services/incidentRegistry.ts');
  const { classifyRelevance: c } = await import('../src/services/incidentNews.ts');
  const desc = d('ntt-sumba-barat-daya-2026-10-04')!;
  for (const s of nttArticlesSeed) {
    const r = c({ url: s.url, title: s.title, sourceName: s.sourceName, sourceType: s.sourceType, publishedAt: s.publishedAt, retrievedAt: s.retrievedAt, summary: s.summary, contentStatus: s.contentStatus, incidentId: s.caseId, discoveredBy: s.discoveredBy }, desc);
    assert.equal(r.status, 'MATCHED', s.url);
  }
  assert.equal(c({ url: nttArticlesSeed[0]!.url, title: 'x', sourceName: 'y', sourceType: 'NEWS_MEDIA', publishedAt: null, retrievedAt: '2026-10-11T00:00:00Z', summary: null, contentStatus: 'METADATA_ONLY', incidentId: nttArticlesSeed[0]!.caseId, discoveredBy: 't' }, descriptorFor('cianjur')!).status, 'REJECTED');
});

test('4: generic keyword "gempa" alone never establishes a match', () => {
  const a = art({ url: 'https://example.com/g', title: 'Gempa mengguncang wilayah Indonesia timur' });
  assert.equal(classifyRelevance(a, cianjur).status, 'REJECTED');
  assert.equal(classifyRelevance(a, lombok).status, 'REJECTED');
  assert.equal(classifyRelevance(a, ntt).status, 'REJECTED');
});

test('5: alias matching is incident-specific (Kodi vs Cugenang)', () => {
  const kodi = art({ url: 'https://example.com/k', title: 'Guncangan kuat di Kodi, Sumba Barat Daya' });
  assert.equal(classifyRelevance(kodi, ntt).status, 'MATCHED');
  assert.equal(classifyRelevance(kodi, cianjur).status, 'REJECTED');
  const cug = art({ url: 'https://example.com/c', title: 'Retakan lereng di Cugenang, Cianjur' });
  assert.equal(classifyRelevance(cug, cianjur).status, 'MATCHED');
  assert.equal(classifyRelevance(cug, ntt).status, 'REJECTED');
});

test('6: duplicate canonical URLs are deduplicated', async () => {
  const { filterIncidentNews: f } = await import('../src/services/incidentNews.ts');
  const base = art({ url: 'https://example.com/dup#frag', title: 'Bantuan untuk korban gempa Cianjur disalurkan di Cianjur', summary: 'BPBD Cianjur' });
  const listed = [
    { ...base, incidentRelevance: { incidentId: 'cianjur', status: 'MATCHED' as const, score: 5, matchedAliases: ['Cianjur'], matchedKeywords: [], reason: 't', classifiedAt: '2026-10-11T00:00:00Z' } },
    { ...base, url: 'https://example.com/dup', incidentRelevance: { incidentId: 'cianjur', status: 'MATCHED' as const, score: 5, matchedAliases: ['Cianjur'], matchedKeywords: [], reason: 't', classifiedAt: '2026-10-11T00:00:00Z' } },
  ];
  assert.equal(f(listed, 'cianjur').length, 1);
});

test('7: missing publication dates stay unknown, never fabricated', () => {
  const a = art({ url: 'https://example.com/n', title: 'Posko pengungsian Cianjur di Cugenang menampung warga', publishedAt: null });
  assert.equal(a.publishedAt, null);
  const r = classifyRelevance(a, cianjur);
  assert.equal(r.status, 'MATCHED');
});

test('8: missing aid quantities stay null (not zero, not invented)', () => {
  const recs = extractAidEvents(art({ url: 'https://example.com/a', title: 'BPBD Cianjur salurkan bantuan masker di Cugenang' }), 'cianjur', true);
  assert.ok(recs.length >= 1);
  assert.equal(recs[0]!.quantity, null);
  assert.equal(recs[0]!.unit, null);
  assert.equal(recs[0]!.estimatedValue, null);
});

test('9: posko without verified coords never yields map markers', () => {
  const ps = extractPosko(art({ url: 'https://example.com/p', title: 'Posko pengungsian Cugenang menampung warga Cianjur', summary: 'Desa Gasol' }), 'cianjur', true);
  assert.ok(ps.length >= 1);
  for (const p of ps) {
    assert.equal(p.latitude, null);
    assert.equal(p.longitude, null);
    assert.equal(p.contact, null);
    assert.equal(p.capacity, null);
  }
  assert.deepEqual(poskoMapMarkers(ps), []);
});

test('10: extracted aid records retain source article references', () => {
  const recs = extractAidEvents(art({ url: 'https://example.com/s', title: 'BPBD salurkan 500 paket sembako untuk korban gempa Cianjur', summary: 'Cianjur' }), 'cianjur', true);
  assert.equal(recs[0]!.sourceUrl, 'https://example.com/s');
  assert.equal(recs[0]!.articleId, 'https://example.com/s');
  assert.equal(recs[0]!.quantity, 500);
});

test('11: historical distribution is not confused with current inventory', () => {
  const recs = extractAidEvents(art({ url: 'https://example.com/h', title: '500 masker telah disalurkan BPBD di Cianjur', summary: 'Cianjur' }), 'cianjur', true);
  assert.equal(recs[0]!.recordKind, 'REPORTED_EVENT');
  assert.equal(recs[0]!.distributionStatus, 'REPORTED_DISTRIBUTED');
  const need = extractAidEvents(art({ url: 'https://example.com/w', title: 'Warga Cianjur butuh air bersih di Cugenang', summary: 'Cianjur' }), 'cianjur', true);
  assert.equal(need[0]!.distributionStatus, 'REPORTED_NEEDED');
});

test('12: all incidents render the same shared detail template', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = await import('react');
  const { DisasterDetailView } = await import('../src/components/detail/DisasterDetailView.tsx');
  const { buildIncidentDetail } = await import('../src/services/incidentDetailAdapter.ts');
  const { disastersData } = await import('../src/data/disasters.ts');
  const { lombokIncident } = await import('../src/data/lombokIncident.ts');
  const { nttIncident } = await import('../src/data/nttIncident.ts');
  const noop = () => {};
  for (const inc of [disastersData['cianjur']!, lombokIncident, nttIncident]) {
    const { detail, timeline } = buildIncidentDetail(inc, null);
    const html = renderToStaticMarkup(
      React.createElement(DisasterDetailView, {
        disaster: inc, detail, timeline, onOpenRoute: noop, onClose: noop,
        onOpenDonationModal: noop, onOpenDisasterBrief: noop, intelReports: [], aidRecords: [],
      }),
    );
    for (const t of ['data-testid="disaster-detail"', 'data-testid="incident-overview"', 'data-testid="incident-news"', 'data-testid="aid-posko"']) {
      assert.ok(html.includes(t), `${inc.id} missing ${t}`);
    }
    // Same shared recovery component: cards when data exists, honest empty state otherwise.
    assert.ok(html.includes('data-testid="recovery-cards"') || html.includes('data-testid="recovery-empty"'), `${inc.id} missing recovery section`);
    assert.ok(html.includes(`data-detail-template="${inc.id}"`));
  }
});

test('13: empty and crawl-failure states render without breaking', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = await import('react');
  const { IncidentNewsPanel } = await import('../src/components/detail/IncidentNewsPanel.tsx');
  const { AidAndPoskoPanel } = await import('../src/components/detail/AidAndPoskoPanel.tsx');
  const news = renderToStaticMarkup(React.createElement(IncidentNewsPanel, {
    incidentName: 'Cianjur', matched: [], review: [],
    freshness: { lastAttemptAt: '2026-10-11T00:00:00Z', lastSuccessAt: null, error: 'ZAPI_API_KEY missing' },
  }));
  assert.ok(news.includes('Crawl terakhir gagal'));
  const aid = renderToStaticMarkup(React.createElement(AidAndPoskoPanel, { aid: [], posko: [] }));
  assert.ok(aid.includes('Belum ada data bantuan atau posko'));
});

test('14: existing NTT intelligence, BMKG, and AI features remain functional', async () => {
  const { buildNttContext } = await import('../src/services/ai/nttAssistant.ts');
  const { nttArticlesSeed, nttCaseSeed, nttClaimsSeed } = await import('../src/data/nttCase.ts');
  const ctx = buildNttContext({ kase: nttCaseSeed, articles: nttArticlesSeed, claims: nttClaimsSeed, mode: 'seed', notice: '' });
  assert.match(ctx, /bmkg\.go\.id/);
  const { normalizeBmkgPayload } = await import('../src/services/bmkg/bmkgNormalizer.ts');
  assert.equal(typeof normalizeBmkgPayload, 'function');
  const { askAssistant } = await import('../src/services/ai/disasterAssistant.ts');
  assert.equal(typeof askAssistant, 'function');
});
