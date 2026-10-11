// NTT case acceptance tests (pure logic, no network).
// Covers: idempotent case/article creation, no dupes on re-crawl, null timestamps,
// no fabricated content, claim source refs, conflicting visibility, unknown != zero,
// persistence round-trip, counts match, grounded context, no invented numbers,
// source links, crawl-failure safety.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalUrl,
  upsertArticles,
  formatUnknown,
  NTT_CASE_ID,
  type CaseArticle,
} from '../src/domain/nttCase.ts';
import { nttArticlesSeed, nttCaseSeed, nttClaimsSeed } from '../src/data/nttCase.ts';
import { buildNttTimeline, countNtt } from '../src/services/nttCaseStore.ts';
import { buildNttContext, isNttQuestion, nttFallbackAnswer } from '../src/services/ai/nttAssistant.ts';

const article = (over: Partial<CaseArticle> & { url: string; title: string }): CaseArticle => ({
  id: over.id ?? 'x',
  caseId: NTT_CASE_ID,
  sourceName: 'Test',
  sourceType: 'NEWS_MEDIA',
  publishedAt: null,
  retrievedAt: '2026-10-11T00:00:00.000Z',
  updatedAt: '2026-10-11T00:00:00.000Z',
  author: null,
  language: 'id',
  summary: null,
  originalSnippet: null,
  contentStatus: 'METADATA_ONLY',
  discoveredBy: 'test',
  eventDate: '2026-10-04',
  locationMentions: [],
  topics: [],
  verificationStatus: 'UNVERIFIED',
  verificationNotes: '',
  contentHash: 'h',
  caseLinkConfidence: 0.9,
  isMock: false,
  ...over,
});

test('1: case has stable id + both BMKG revisions preserved separately', () => {
  assert.equal(nttCaseSeed.caseId, 'ntt-sumba-barat-daya-2026-10-04');
  assert.equal(nttCaseSeed.isMock, false);
  const mags = nttCaseSeed.revisions.map((r) => r.magnitude).sort();
  assert.deepEqual(mags, [5.9, 6.1]);
  assert.equal(nttCaseSeed.isMajorDisaster, false);
});

test('2: repeated crawls update instead of duplicating (idempotent upsert)', () => {
  const a = article({ id: 'a', url: 'https://example.com/x', title: 'T', publishedAt: '2026-10-04T00:00:00Z' });
  const again = article({ id: 'a', url: 'https://example.com/x', title: 'T2', publishedAt: '2026-10-05T00:00:00Z', retrievedAt: '2026-10-12T00:00:00Z' });
  const merged = upsertArticles([a], [again]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.title, 'T2');
  assert.equal(merged[0]?.publishedAt, '2026-10-04T00:00:00Z');
});

test('3: missing publication timestamps remain null (never fabricated)', () => {
  const missing = nttArticlesSeed.filter((a) => a.publishedAt === null);
  assert.ok(missing.length >= 2);
  for (const a of nttArticlesSeed) {
    assert.ok(a.publishedAt === null || Number.isFinite(Date.parse(a.publishedAt)));
  }
});

test('4: missing content is marked METADATA_ONLY, never filled with invented text', () => {
  for (const a of nttArticlesSeed) {
    if (a.contentStatus === 'METADATA_ONLY') {
      assert.equal(a.originalSnippet, null);
    }
    assert.equal(a.isMock, false);
    assert.equal(a.author === null || typeof a.author === 'string', true);
  }
});

test('5: every claim retains its source reference', () => {
  assert.ok(nttClaimsSeed.length >= 8);
  for (const c of nttClaimsSeed) {
    assert.ok(/^https:\/\//.test(c.sourceUrl), c.claimId);
    assert.ok(c.articleId.length > 0);
    assert.equal(c.caseId, NTT_CASE_ID);
  }
});

test('6: conflicting damage claims stay distinguishable (never merged/summed)', () => {
  const dmg = nttClaimsSeed.filter((c) => c.claimType === 'damage' && c.verificationStatus === 'CONFLICTING');
  assert.ok(dmg.length >= 2);
  const quantities = dmg.map((c) => c.quantity);
  assert.ok(new Set(quantities).size >= 2);
});

test('7: unavailable casualty data renders "Belum tersedia", never zero', () => {
  assert.equal(formatUnknown(null), 'Belum tersedia');
  assert.equal(formatUnknown(undefined), 'Belum tersedia');
  assert.equal(formatUnknown(0), '0');
  const ans = nttFallbackAnswer('berapa korban meninggal?', {
    kase: nttCaseSeed, articles: nttArticlesSeed, claims: nttClaimsSeed, mode: 'seed', notice: '',
  });
  assert.match(ans, /Belum tersedia/);
  assert.doesNotMatch(ans, /0 orang meninggal/);
});

test('8: seed persists round-trip via localStorage-shaped JSON', () => {
  const json = JSON.stringify({ articles: nttArticlesSeed, claims: nttClaimsSeed });
  const back = JSON.parse(json) as { articles: CaseArticle[] };
  assert.equal(back.articles.length, nttArticlesSeed.length);
});

test('9: dashboard counts match persisted records', () => {
  const c = countNtt({ kase: nttCaseSeed, articles: nttArticlesSeed, claims: nttClaimsSeed });
  assert.equal(c.articles, nttArticlesSeed.length);
  assert.equal(c.official, nttArticlesSeed.filter((a) => a.sourceType === 'OFFICIAL').length);
  assert.equal(c.claims, nttClaimsSeed.length);
  assert.equal(c.conflicting, nttClaimsSeed.filter((x) => x.verificationStatus === 'CONFLICTING').length);
});

test('10: assistant context uses current case records with links', () => {
  const ctx = buildNttContext({ kase: nttCaseSeed, articles: nttArticlesSeed, claims: nttClaimsSeed, mode: 'seed', notice: '' });
  assert.match(ctx, /bmkg\.go\.id\/gempabumi\/20261004055834/);
  assert.match(ctx, /bnpb\.go\.id/);
});

test('11: fallback answers do not invent unsupported impact numbers', () => {
  const state = { kase: nttCaseSeed, articles: nttArticlesSeed, claims: nttClaimsSeed, mode: 'seed' as const, notice: '' };
  const a = nttFallbackAnswer('Apakah ada laporan kerusakan?', state);
  assert.match(a, /BNPB/);
  assert.match(a, /konflik/i);
  assert.ok(!/ribuan|ratusan ribu|evakuasi \d+/.test(a));
});

test('12: canonical source links are https + openable; unsafe rejected', () => {
  for (const a of nttArticlesSeed) {
    assert.ok(/^https:\/\//.test(a.url));
    assert.equal(canonicalUrl(a.url), a.url);
  }
  assert.equal(canonicalUrl('javascript:alert(1)'), null);
  assert.equal(canonicalUrl('http://example.com/x'), null);
});

test('13: refresh/upsert tolerates empty crawl (dashboard never breaks)', () => {
  const merged = upsertArticles(nttArticlesSeed, []);
  assert.equal(merged.length, nttArticlesSeed.length);
});

test('14: NTT routing triggers on case questions only', () => {
  assert.equal(isNttQuestion('Apa yang terjadi di Sumba Barat Daya?'), true);
  assert.equal(isNttQuestion('Berapa gap air bersih di Demak?'), false);
});

test('timeline separates event time from publish/retrieval time', () => {
  const tl = buildNttTimeline({ kase: nttCaseSeed, articles: nttArticlesSeed });
  const kinds = new Set(tl.map((e) => e.kind));
  assert.ok(kinds.has('EVENT_OCCURRED') && kinds.has('SOURCE_PUBLISHED') && kinds.has('SYSTEM_RETRIEVED'));
});
