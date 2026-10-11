// Per-incident news crawl: location-specific queries via the existing ZAPI pipeline.
// After crawling: normalize URLs → dedupe → classify relevance per incident →
// persist article metadata + relevance decisions to public/data/incident-articles.json.
// A search result is never marked relevant merely because a query returned it.
// Honest receipt — a failed request is recorded as failed, never as success.
// Outputs: public/data/incident-articles.json (pool), public/data/incident-news.json (receipt)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { INCIDENT_DESCRIPTORS, buildIncidentQueries } from '../src/services/incidentRegistry.ts';
import { classifyRelevance } from '../src/services/incidentNews.ts';
import { canonicalUrl } from '../src/domain/nttCase.ts';
import type { IncidentArticle } from '../src/domain/incidentDetail.ts';

const poolOut = process.argv[2] || 'public/data/incident-articles.json';
const receiptOut = process.argv[3] || 'public/data/incident-news.json';
const now = new Date().toISOString();
const zapiKey = process.env.ZAPI_API_KEY || '';

const TARGETS = ['cianjur', 'lombok-2018-08-05', 'ntt-sumba-barat-daya-2026-10-04'];

interface ZapiItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
}

async function zapiSearch(query: string): Promise<ZapiItem[]> {
  const url = new URL('https://api.zapi.ink/v1/news:google-news/feed');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '20');
  const res = await fetch(url, { headers: { 'x-api-key': zapiKey }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { data?: { ok?: boolean; items?: unknown[] } };
  if (data?.data?.ok !== true || !Array.isArray(data.data.items)) throw new Error('Invalid news response');
  return data.data.items as ZapiItem[];
}

/** Normalize a raw result into a pool candidate. publishedAt stays null when unknown — never invented. */
function toCandidate(item: ZapiItem, query: string): IncidentArticle | null {
  if (typeof item.title !== 'string' || typeof item.link !== 'string') return null;
  const title = item.title.trim();
  if (!title) return null;
  let url: URL;
  try {
    url = new URL(item.link);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  url.hash = '';
  const separator = title.lastIndexOf(' - ');
  const headline = separator > 0 ? title.slice(0, separator) : title;
  const source = separator > 0 ? title.slice(separator + 3) : url.hostname;
  const t = typeof item.pubDate === 'string' ? Date.parse(item.pubDate) : NaN;
  return {
    url: url.href,
    title: headline,
    sourceName: source,
    sourceType: 'NEWS_MEDIA',
    publishedAt: Number.isFinite(t) ? new Date(t).toISOString() : null,
    retrievedAt: now,
    summary: null,
    contentStatus: 'METADATA_ONLY',
    incidentId: null,
    discoveredBy: `zapi:${query}`,
  };
}

const OFFICIAL_URLS: Record<string, string> = {
  'ntt-sumba-barat-daya-2026-10-04': 'https://www.bmkg.go.id/gempabumi/20261004055834',
  'lombok-2018-08-05': 'https://bnpb.go.id/berita/gempa-7-sr-guncang-lombok-utara-peringatan-dini-tsunami-diaktivasi',
};

interface IncidentResult {
  incidentId: string;
  queries: string[];
  zapi: { status: string; reason: string; fetched: number };
  officialFetch: { url: string | null; status: string; http?: number };
  classification: { matched: number; review: number; rejected: number };
}

let pool: IncidentArticle[] = [];
try {
  const prev = JSON.parse(await readFile(poolOut, 'utf8')) as { articles?: IncidentArticle[] };
  if (Array.isArray(prev.articles)) pool = prev.articles;
} catch {
  /* first run — no previous pool */
}

const results: IncidentResult[] = [];
let fetchedTotal = 0;
for (const id of TARGETS) {
  const d = INCIDENT_DESCRIPTORS.find((x) => x.incidentId === id)!;
  const queries = buildIncidentQueries(d);
  const zapi = { status: 'FAILED', reason: '', fetched: 0 };
  if (!zapiKey) {
    zapi.reason = 'ZAPI_API_KEY missing — no request sent (same guard as scripts/fetchDisasterNews.ts).';
  } else {
    const fresh: IncidentArticle[] = [];
    const failures: string[] = [];
    for (const q of queries) {
      try {
        for (const item of await zapiSearch(q)) {
          const c = toCandidate(item, q);
          if (c) fresh.push(c);
        }
      } catch (e) {
        failures.push(String(e).slice(0, 120));
      }
    }
    zapi.fetched = fresh.length;
    fetchedTotal += fresh.length;
    if (fresh.length > 0) {
      zapi.status = failures.length > 0 ? 'PARTIAL' : 'OK';
      zapi.reason = failures.length > 0 ? `partial: ${failures[0]}` : `${fresh.length} candidates from ${queries.length} queries`;
      const seen = new Set(pool.map((a) => canonicalUrl(a.url) ?? a.url));
      for (const c of fresh) {
        const key = canonicalUrl(c.url) ?? c.url;
        if (seen.has(key)) continue;
        seen.add(key);
        pool.push(c);
      }
    } else {
      zapi.status = 'FAILED';
      zapi.reason = failures[0] ?? 'no candidates returned';
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
  // Classify the whole pool per incident (a query hit never implies relevance).
  let matched = 0, review = 0, rejected = 0;
  for (const c of pool) {
    const r = classifyRelevance(c, d, Date.parse(now));
    if (r.status === 'MATCHED') matched++;
    else if (r.status === 'REVIEW_REQUIRED') review++;
    else rejected++;
  }
  results.push({ incidentId: d.incidentId, queries, zapi, officialFetch, classification: { matched, review, rejected } });
}

await mkdir(dirname(poolOut), { recursive: true });
await writeFile(poolOut, JSON.stringify({ at: now, articles: pool }, null, 2));
await mkdir(dirname(receiptOut), { recursive: true });
const receipt = { at: now, poolSize: pool.length, fetchedTotal, incidents: results };
await writeFile(receiptOut, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
