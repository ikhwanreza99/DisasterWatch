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
  publishedAt: new Date().toISOString(),
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

test('2: historical Lombok articles stay out of the recent dataset', () => {
  const a = art({ url: 'https://example.com/lb', title: 'Gempa Lombok Utara: 80 persen bangunan rusak, BNPB salurkan bantuan', publishedAt: '2018-08-06T00:00:00Z', summary: 'Mataram dan Lombok Timur terdampak' });
  assert.equal(classifyRelevance(a, lombok).status, 'REJECTED');
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
  assert.equal(r.status, 'REVIEW_REQUIRED');
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
  assert.ok(news.includes('ZAPI_API_KEY missing'));
  assert.ok(!news.includes('Menampilkan berita yang sudah tersedia.'));
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

test('15: broad single-word alias alone never MATCHES (Bima quake is not NTT news)', () => {
  // Root-cause regression: "Gempa Bima" must not appear in the Sumba Barat Daya feed.
  const a = art({ url: 'https://example.com/bima', title: 'Gempa Bima M4,2 dirasakan warga sore ini', publishedAt: '2026-10-05T00:00:00.000Z' });
  const r = classifyRelevance(a, ntt);
  assert.notEqual(r.status, 'MATCHED');
  assert.equal(classifyRelevance(a, cianjur).status, 'REJECTED');
  assert.equal(classifyRelevance(a, lombok).status, 'REJECTED');
});

test('16: province-only matching never qualifies (Nusa Tenggara Barat ≠ Lombok incident)', () => {
  const a = art({ url: 'https://example.com/prov', title: 'Gempa di Nusa Tenggara Barat, BMKG catat M5,0', summary: 'Getaran dirasakan di beberapa daerah' });
  assert.equal(classifyRelevance(a, lombok).status, 'REJECTED');
  assert.equal(classifyRelevance(a, ntt).status, 'REJECTED');
  assert.equal(classifyRelevance(a, cianjur).status, 'REJECTED');
});

test('17: REVIEW_REQUIRED and REJECTED never enter the default feed', async () => {
  const { classifyForIncident, reviewQueue } = await import('../src/services/incidentNews.ts');
  const pool = [
    art({ url: 'https://example.com/m', title: 'Gempa Cianjur: posko Cugenang salurkan bantuan', summary: 'Desa Gasol' }),
    art({ url: 'https://example.com/r', title: 'Gempa Sukabumi dirasakan warga', publishedAt: new Date().toISOString() }),
    art({ url: 'https://example.com/x', title: 'Gempa Lombok Utara rusak berat', summary: 'Mataram' }),
  ].map((a) => classifyForIncident(a, cianjur));
  const feed = filterIncidentNews(pool, 'cianjur');
  assert.equal(feed.length, 1);
  assert.equal(feed[0]!.url, 'https://example.com/m');
  assert.ok(feed.every((a) => a.incidentRelevance?.status === 'MATCHED'));
  assert.equal(reviewQueue(pool, 'cianjur').length, 1);
});

test('18: zero matches render the exact required empty state', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = await import('react');
  const { IncidentNewsPanel } = await import('../src/components/detail/IncidentNewsPanel.tsx');
  const html = renderToStaticMarkup(React.createElement(IncidentNewsPanel, {
    incidentName: 'Cianjur', matched: [], review: [],
    freshness: { lastAttemptAt: null, lastSuccessAt: null, error: null },
  }));
  assert.ok(html.includes('Belum ada berita yang relevan dengan lokasi bencana ini.'));
  assert.ok(!html.includes('data-testid="news-card"'));
});

test('19: no generic fallback bypasses the incident filter', async () => {
  const { buildIncidentDetail } = await import('../src/services/incidentDetailAdapter.ts');
  const { disastersData } = await import('../src/data/disasters.ts');
  const { detail } = buildIncidentDetail(disastersData['cianjur']!, null);
  const feed = filterIncidentNews(detail.articles, 'cianjur');
  // Every displayed article must carry a MATCHED relevance decision for THIS incident.
  assert.ok(feed.every((a) => a.incidentRelevance?.incidentId === 'cianjur' && a.incidentRelevance.status === 'MATCHED'));
  // Unclassified articles (no relevance decision at all) are never displayed.
  const sneaky = { ...art({ url: 'https://example.com/s', title: 'Gempa Cianjur Cugenang darurat' }) };
  delete (sneaky as Partial<IncidentArticle>).incidentRelevance;
  assert.equal(filterIncidentNews([sneaky], 'cianjur').length, 0);
});

test('20: NTT renders the exact same detail shell as Cianjur and Lombok', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = await import('react');
  const { DisasterDetailView } = await import('../src/components/detail/DisasterDetailView.tsx');
  const { buildIncidentDetail } = await import('../src/services/incidentDetailAdapter.ts');
  const { disastersData } = await import('../src/data/disasters.ts');
  const { lombokIncident } = await import('../src/data/lombokIncident.ts');
  const { nttIncident } = await import('../src/data/nttIncident.ts');
  const { nttArticlesSeed, nttCaseSeed, nttClaimsSeed } = await import('../src/data/nttCase.ts');
  const noop = () => {};
  const nttState = { kase: nttCaseSeed, articles: nttArticlesSeed, claims: nttClaimsSeed, mode: 'seed' as const, notice: '' };
  const shells: string[] = [];
  for (const [inc, state] of [[disastersData['cianjur']!, null], [lombokIncident, null], [nttIncident, nttState]] as const) {
    const { detail, timeline } = buildIncidentDetail(inc, state);
    shells.push(renderToStaticMarkup(
      React.createElement(DisasterDetailView, {
        disaster: inc, detail, timeline, onOpenRoute: noop, onClose: noop,
        onOpenDonationModal: noop, onOpenDisasterBrief: noop, intelReports: [], aidRecords: [],
      }),
    ));
  }
  // Core shared inventory, in identical order, for all three incidents.
  // (Presence is proven by the inventory itself; only data and source records differ.)
  const inventory = (html: string) => [...html.matchAll(/data-testid="(disaster-detail|incident-overview|incident-news|aid-posko|claims)"/g)].map((m) => m[1]);
  const base = inventory(shells[0]!);
  assert.deepEqual(base, ['disaster-detail', 'incident-overview', 'incident-news', 'aid-posko', 'claims']);
  assert.deepEqual(inventory(shells[1]!), base);
  assert.deepEqual(inventory(shells[2]!), base);
});

test('21: NTT standard detail carries official params + claims without inventing metrics', async () => {
  const { buildIncidentDetail } = await import('../src/services/incidentDetailAdapter.ts');
  const { nttIncident } = await import('../src/data/nttIncident.ts');
  const { nttArticlesSeed, nttCaseSeed, nttClaimsSeed } = await import('../src/data/nttCase.ts');
  const nttState = { kase: nttCaseSeed, articles: nttArticlesSeed, claims: nttClaimsSeed, mode: 'seed' as const, notice: '' };
  const { detail } = buildIncidentDetail(nttIncident, nttState);
  // Both BMKG revisions preserved separately, never merged.
  assert.equal(detail.officialParams.length, 2);
  assert.ok(detail.officialParams.some((p) => p.revision === 'initial'));
  assert.ok(detail.officialParams.some((p) => p.revision === 'update'));
  // Claims keep verification status; conflicts stay visible.
  assert.equal(detail.claims.length, nttClaimsSeed.length);
  assert.ok(detail.claims.some((c) => c.verificationStatus === 'CONFLICTING'));
  assert.ok(detail.claims.some((c) => c.verificationStatus === 'VERIFIED'));
  assert.ok(detail.claims.every((c) => typeof c.claimText === 'string' && typeof c.sourceUrl === 'string'));
  // Unavailable stays unavailable — no invented recovery/cost.
  assert.equal(detail.provenance.cost, 'UNAVAILABLE');
  assert.equal(detail.provenance.recovery, 'UNAVAILABLE');
  // Default news feed contains only NTT-matched articles.
  const feed = filterIncidentNews(detail.articles, nttIncident.id);
  assert.ok(feed.length >= nttArticlesSeed.length);
  assert.ok(feed.some(a => a.discoveredBy === 'bnpb-documentation'));
});

test('22: Lombok detail carries real official params; Cianjur has honest empty states', async () => {
  const { buildIncidentDetail } = await import('../src/services/incidentDetailAdapter.ts');
  const { lombokIncident } = await import('../src/data/lombokIncident.ts');
  const { disastersData } = await import('../src/data/disasters.ts');
  const lb = buildIncidentDetail(lombokIncident, null);
  assert.equal(lb.detail.officialParams.length, 1);
  assert.match(lb.detail.officialParams[0]!.value, /M7,0/);
  const cj = buildIncidentDetail(disastersData['cianjur']!, null);
  assert.deepEqual(cj.detail.officialParams, []);
  assert.deepEqual(cj.detail.claims, []);
  assert.equal(filterIncidentNews(cj.detail.articles, 'cianjur').length, 0);
});

test('Padang feed accepts recent local floods but excludes other places and disaster types', () => {
  const padang = descriptorFor('padang')!;
  const now = Date.parse('2026-10-12T12:00:00Z');
  const candidate = (title: string) => art({ url: 'https://example.com/padang-fixture', title, publishedAt: '2026-10-11T00:00:00Z' });
  assert.equal(classifyRelevance(candidate('Banjir Padang, warga mengungsi'), padang, now).status, 'MATCHED');
  assert.notEqual(classifyRelevance(candidate('Banjir Pesisir Selatan merendam rumah'), padang, now).status, 'MATCHED');
  for (const title of ['Banjir Demak merendam rumah', 'Banjir Padang Panjang merendam rumah', 'Gempa mengguncang Padang', 'Banjir Sumatera Barat']) {
    assert.notEqual(classifyRelevance(candidate(title), padang, now).status, 'MATCHED');
  }
  assert.notEqual(classifyRelevance({ ...candidate('Banjir Padang'), publishedAt: '2020-01-01T00:00:00Z' }, padang, now).status, 'MATCHED');
});

test('freshness reports only actual runs for the selected incident', async () => {
  const { incidentFreshness } = await import('../src/services/incidentFreshness');
  const run = { id: 'r', startedAt: '2026-10-12T00:00:00Z', finishedAt: '2026-10-12T00:01:00Z', outcome: 'SUCCESS' as const, lastSuccessAt: null, perIncident: [{ incidentId: 'cianjur', fetched: 2, matched: 1, rejected: 1, review: 0 }], articlesNew: 2, articlesUpdated: 0, aiExtractions: 0, errorCode: null, schemaVersion: 1 };
  assert.deepEqual(incidentFreshness('padang', [run]), { lastAttemptAt: null, lastSuccessAt: null, error: null });
  assert.equal(incidentFreshness('cianjur', [run]).lastSuccessAt, run.finishedAt);
});
