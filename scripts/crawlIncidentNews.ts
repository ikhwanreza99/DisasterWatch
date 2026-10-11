// Per-incident news crawl: incident-specific queries via the existing ZAPI pipeline,
// plus direct official-page verification. Honest receipt — a failed request is
// recorded as failed, never as a successful crawl.
// Output: public/data/incident-news.json
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { INCIDENT_DESCRIPTORS, buildIncidentQueries } from '../src/services/incidentRegistry.ts';
import { classifyRelevance } from '../src/services/incidentNews.ts';
import { nttArticlesSeed } from '../src/data/nttCase.ts';
import type { IncidentArticle } from '../src/domain/incidentDetail.ts';

const out = process.argv[2] || 'public/data/incident-news.json';
const now = new Date().toISOString();
const zapiKey = process.env.ZAPI_API_KEY || '';

const candidates: IncidentArticle[] = nttArticlesSeed.map((a) => ({
  url: a.url,
  title: a.title,
  sourceName: a.sourceName,
  sourceType: a.sourceType,
  publishedAt: a.publishedAt,
  retrievedAt: a.retrievedAt,
  summary: a.summary,
  contentStatus: a.contentStatus,
  incidentId: a.caseId,
  discoveredBy: a.discoveredBy,
}));

const OFFICIAL_URLS: Record<string, string> = {
  'ntt-sumba-barat-daya-2026-10-04': 'https://www.bmkg.go.id/gempabumi/20261004055834',
  'lombok-2018-08-05': 'https://bnpb.go.id/berita/gempa-7-sr-guncang-lombok-utara-peringatan-dini-tsunami-diaktivasi',
};

interface IncidentResult {
  incidentId: string;
  queries: string[];
  zapi: { status: string; reason: string };
  officialFetch: { url: string | null; status: string; http?: number };
  classification: { matched: number; review: number; rejected: number };
}

const results: IncidentResult[] = [];
for (const d of INCIDENT_DESCRIPTORS) {
  if (d.incidentId !== 'cianjur' && d.incidentId !== 'lombok-2018-08-05' && d.incidentId !== 'ntt-sumba-barat-daya-2026-10-04') continue;
  const queries = buildIncidentQueries(d);
  const zapi = zapiKey
    ? { status: 'SKIPPED', reason: 'key present but per-incident live search deferred to scheduled workflow' }
    : { status: 'FAILED', reason: 'ZAPI_API_KEY missing — no request sent (same guard as scripts/fetchDisasterNews.ts).' };
  if (zapiKey) {
    try {
      const url = new URL('https://api.zapi.ink/v1/news:google-news/feed');
      url.searchParams.set('query', queries[0]!);
      url.searchParams.set('limit', '10');
      const res = await fetch(url, { headers: { 'x-api-key': zapiKey }, signal: AbortSignal.timeout(20_000) });
      zapi.status = res.ok ? 'OK' : 'FAILED';
      zapi.reason = `HTTP ${res.status}`;
    } catch (e) {
      zapi.status = 'FAILED';
      zapi.reason = String(e).slice(0, 160);
    }
  }
  const officialUrl = OFFICIAL_URLS[d.incidentId] ?? null;
  let officialFetch: IncidentResult['officialFetch'] = { url: officialUrl, status: officialUrl ? 'SKIPPED' : 'NO_URL' };
  if (officialUrl) {
    try {
      const res = await fetch(officialUrl, { headers: { 'User-Agent': 'DisasterWatch-crawl/1.0' }, signal: AbortSignal.timeout(25_000) });
      officialFetch = { url: officialUrl, status: res.ok ? 'OK' : 'FAILED', http: res.status };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.arrayBuffer();
    } catch {
      officialFetch = { url: officialUrl, status: 'FAILED' };
    }
  }
  let matched = 0, review = 0, rejected = 0;
  for (const c of candidates) {
    const r = classifyRelevance(c, d, Date.parse(now));
    if (r.status === 'MATCHED') matched++;
    else if (r.status === 'REVIEW_REQUIRED') review++;
    else rejected++;
  }
  results.push({ incidentId: d.incidentId, queries, zapi, officialFetch, classification: { matched, review, rejected } });
}

const receipt = { at: now, incidents: results };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
