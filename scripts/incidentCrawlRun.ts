import 'dotenv/config';
import { recordServerUsage } from './recordAiUsage.ts';
import { searchGemini } from './providers/geminiSearch.ts';
import { searchSerpNews } from './providers/serpapiNews.ts';
import { searchThreads } from './providers/threadsSearch.ts';
import { newsSourceUrl } from '../src/services/newsSourceUrl.ts';
import { ACTIVE_NEWS_IDS } from '../src/services/incidentRegistry.ts';
// Gated incident crawl runner (Admin SDK, trusted GitHub Actions ONLY).
// NEVER import from browser code. Never commit/log credentials, keys, or bodies.
//
// - Gate: reads incidentCrawlRuns for the last SUCCESS/SUCCESS_EMPTY; paid ZAPI/SERP/
//   Gemini/Threads calls happen ONLY when ≥5 days elapsed (or --force). The daily schedule check
//   itself is one cheap Firestore read — no crawling API before due.
// - Outcomes: SUCCESS (≥1 incident ok), SUCCESS_EMPTY (ok, zero relevant —
//   distinct from failure), PROVIDER_FAILED (all failed → exit 1, data preserved),
//   GATED_SKIP (not due → exit 0, no paid calls).
// - Upserts new/changed docs only; never deletes; failures preserve everything.
// - AI extraction runs ONLY for new/changed article hashes and ONLY when
//   DISASTERWATCH_GEMINI_KEY is set; otherwise deterministic heuristics.
// - Summaries only — never full article copies.
// - Auth: FIREBASE_NEWS_SERVICE_ACCOUNT (JSON) or GOOGLE_APPLICATION_CREDENTIALS
//   (file path, existence-checked only). Project pinned to disasterwatch-61ed5.
// Usage: npx tsx scripts/incidentCrawlRun.ts [--dry-run] [--force] [--no-ai]
import { createHash } from 'node:crypto';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { INCIDENT_DESCRIPTORS, buildIncidentQueries } from '../src/services/incidentRegistry.ts';
import { classifyForIncident } from '../src/services/incidentNews.ts';
import { extractAidEvents, extractPosko } from '../src/services/incidentIntel.ts';
import { extractNeeds, extractRecovery } from '../src/services/extraction/needsRecovery.ts';
import { diffUpserts, mergePosko, mergeRecovery, selectForAI } from '../src/services/crawlMerge.ts';
import {
  HUMANITARIAN_COLLECTIONS,
  articleDocId,
  isCrawlDue,
  markConflicts,
  stableId,
  type CrawlOutcome,
  type IncidentAidEventDoc,
  type IncidentAidNeedDoc,
  type IncidentArticleDoc,
  type IncidentClaimDoc,
  type IncidentCrawlRunDoc,
  type IncidentPoskoDoc,
  type IncidentRecoveryDoc,
} from '../src/domain/humanitarian.ts';

const PROJECT_ID = 'disasterwatch-61ed5';
const TARGETS = ACTIVE_NEWS_IDS;
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');
const NO_AI = args.has('--no-ai');
const now = new Date().toISOString();
const zapiKey = process.env.ZAPI_API_KEY || '';
const serpapiKey = process.env.SERPAPI_API_KEY?.trim() || '';
const threadsToken = process.env.THREADS_ACCESS_TOKEN?.trim() || '';
const aiKey = process.env.DISASTERWATCH_GEMINI_KEY || '';
const searchKey = process.env.DISASTERWATCH_GEMINI_SEARCH_KEY || aiKey;
const searchEnabled = process.env.DISASTERWATCH_GOOGLE_SEARCH_ENABLED === 'true' && !!searchKey;
const searchModel = process.env.DISASTERWATCH_GOOGLE_SEARCH_MODEL || 'gemini-3.8-flash';

let stage = 'init';
function safeError(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  if (typeof code === 'number') return `code-${code}`;
  const s = String(code ?? '');
  if (['app/invalid-credential', 'permission-denied', 'unauthenticated', 'deadline-exceeded', 'unavailable'].includes(s)) return s;
  const msg = e instanceof Error ? e.message : String(e);
  if (/HTTP \d{3}/.test(msg)) return msg.match(/HTTP \d{3}/)![0]!;
  return 'unknown';
}

async function readAll<T>(db: Firestore, col: string): Promise<T[]> {
  const snap = await db.collection(col).get();
  return snap.docs.map((d) => d.data() as T);
}

async function latestSuccess(db: Firestore): Promise<string | null> {
  const snap = await db.collection(HUMANITARIAN_COLLECTIONS.incidentCrawlRuns).orderBy('startedAt', 'desc').limit(10).get();
  let best: string | null = null;
  for (const d of snap.docs) {
    const r = d.data() as IncidentCrawlRunDoc;
    if (r.outcome !== 'SUCCESS' && r.outcome !== 'SUCCESS_EMPTY') continue;
    if (r.errorCode || !TARGETS.every(id => r.perIncident.some(p => p.incidentId === id))) continue;
    const t = r.finishedAt ?? r.startedAt;
    if (best == null || t > best) best = t;
  }
  return best;
}

/** Minimal Gemini extraction for NEW/CHANGED content only. Key never logged. Returns null on any failure. */
async function aiExtract(title: string, summary: string | null, db: Firestore | null): Promise<{ summary: string } | null> {
  if (NO_AI || !aiKey) return null;
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': aiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Ringkas 1-2 kalimat Bahasa Indonesia, hanya fakta eksplisit, tanpa angka tebakan:\n${title}\n${summary ?? ''}`.slice(0, 2000) }] }],
          generationConfig: { maxOutputTokens: 200 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    await recordServerUsage(db, data.usageMetadata, 'gemini-2.0-flash', 'Crawler extraction');
    const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p?.text ?? '').join('').trim();
    return text ? { summary: text.slice(0, 500) } : null;
  } catch {
    return null;
  }
}

interface ZapiItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
}

async function main() {
  console.log(`target project : ${PROJECT_ID}`);
  console.log(`mode           : ${DRY_RUN ? 'dry-run (no writes, paid calls still gated)' : 'live'}`);
  console.log(`force          : ${FORCE}`);
  // NEVER print key presence/values — only the static policy.
  console.log('ai path        : heuristic default; keyed AI only for new/changed content when configured (never logged)');

  stage = 'credentials';
  let db: Firestore | null = null;
  let lastSuccess: string | null = null;
  if (!DRY_RUN) {
    const raw = process.env.FIREBASE_NEWS_SERVICE_ACCOUNT;
    const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '';
    if (raw) {
      const account = JSON.parse(raw);
      if (account.project_id !== PROJECT_ID) throw new Error('Unexpected project');
      initializeApp({ credential: cert(account), projectId: PROJECT_ID });
    } else {
      if (!gac) throw new Error('No service account (FIREBASE_NEWS_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS).');
      const { readFileSync, existsSync } = await import('node:fs');
      if (!existsSync(gac)) throw new Error('Credential file not found (existence only, contents never printed).');
      const account = JSON.parse(readFileSync(gac, 'utf8'));
      if (account.project_id !== PROJECT_ID) throw new Error('Unexpected project');
      initializeApp({ credential: cert(account), projectId: PROJECT_ID });
    }
    db = getFirestore();
    stage = 'gate';
    lastSuccess = await latestSuccess(db);
  } else {
    console.log('dry-run        : gate evaluated locally without Firestore (missing history → due)');
  }

  const due = FORCE || isCrawlDue(lastSuccess, Date.parse(now));
  const daysSince = lastSuccess ? ((Date.parse(now) - Date.parse(lastSuccess)) / 86400_000).toFixed(1) : 'n/a (no history)';
  console.log(`gate           : lastSuccess=${lastSuccess ?? 'none'} (${daysSince}d ago, interval=5d) → ${due ? 'DUE' : 'GATED_SKIP'}`);
  if (!due) {
    console.log('outcome        : GATED_SKIP (no paid API calls, no writes)');
    return { outcome: 'GATED_SKIP' as CrawlOutcome, exitCode: 0 };
  }

  if (!zapiKey && !searchEnabled && !serpapiKey && !threadsToken) {
    // Due but unpaid path unavailable: record failure honestly, preserve all data.
    console.log('outcome        : PROVIDER_FAILED (No configured search provider — no request sent, data preserved)');
    if (db) await recordRun(db, 'PROVIDER_FAILED', lastSuccess, [], 0, 0, 0, 'missing-search-provider');
    return { outcome: 'PROVIDER_FAILED' as CrawlOutcome, exitCode: 1 };
  }

  stage = 'crawl';
  let articlesNew = 0;
  let articlesUpdated = 0;
  let aiExtractions = 0;
  let okIncidents = 0;
  const perIncident: IncidentCrawlRunDoc['perIncident'] = [];
  const errors: string[] = [];

  // Preload existing docs once (upsert-diff + conflict context).
  const prev = db
    ? {
        articles: await readAll<IncidentArticleDoc>(db, HUMANITARIAN_COLLECTIONS.incidentArticles),
        claims: await readAll<IncidentClaimDoc>(db, HUMANITARIAN_COLLECTIONS.incidentClaims),
        needs: await readAll<IncidentAidNeedDoc>(db, HUMANITARIAN_COLLECTIONS.incidentAidNeeds),
        events: await readAll<IncidentAidEventDoc>(db, HUMANITARIAN_COLLECTIONS.incidentAidEvents),
        poskos: await readAll<IncidentPoskoDoc>(db, HUMANITARIAN_COLLECTIONS.incidentPoskos),
        recovery: await readAll<IncidentRecoveryDoc>(db, HUMANITARIAN_COLLECTIONS.incidentRecovery),
      }
    : { articles: [], claims: [], needs: [], events: [], poskos: [], recovery: [] };

  for (const id of TARGETS) {
    const d = INCIDENT_DESCRIPTORS.find((x) => x.incidentId === id)!;
    const queries = buildIncidentQueries(d);
    let fetched = 0;
    let matched = 0;
    let review = 0;
    let rejected = 0;
    try {
      let fresh: IncidentArticleDoc[] = [];
      let successfulQueries = 0;
      if (zapiKey) for (const q of queries) {
        try {
        const url = new URL('https://api.zapi.ink/v1/news:google-news/feed');
        url.searchParams.set('query', q);
        url.searchParams.set('limit', '20');
        // Key sent in header only; failures record safe codes, never bodies.
        const res = await fetch(url, { headers: { 'x-api-key': zapiKey }, signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { data?: { ok?: boolean; items?: unknown[] } };
        if (data?.data?.ok !== true || !Array.isArray(data.data.items)) throw new Error('Invalid news response');
        for (const raw of data.data.items as ZapiItem[]) {
          if (typeof raw.title !== 'string' || typeof raw.link !== 'string') continue;
          const title = raw.title.trim();
          if (!title) continue;
          let u: URL;
          try {
            const direct = newsSourceUrl(raw.link);
            if (!direct) continue;
            u = new URL(direct);
          } catch {
            continue;
          }
          if (u.protocol !== 'https:' || u.username || u.password) continue;
          u.hash = '';
          const sep = title.lastIndexOf(' - ');
          const t = typeof raw.pubDate === 'string' ? Date.parse(raw.pubDate) : NaN;
          fresh.push({
            id: articleDocId(id, u.href),
            incidentId: id,
            canonicalUrl: u.href,
            url: u.href,
            title: sep > 0 ? title.slice(0, sep) : title,
            sourceName: sep > 0 ? title.slice(sep + 3) : u.hostname,
            sourceType: 'NEWS_MEDIA',
            publishedAt: Number.isFinite(t) ? new Date(t).toISOString() : null,
            retrievedAt: now,
            updatedAt: now,
            summary: null,
            contentHash: createHash('sha256').update(`${title}|${u.href}`).digest('hex'),
            contentStatus: 'METADATA_ONLY',
            discoveredBy: `zapi:${q}`,
            relevance: { incidentId: id, status: 'REJECTED', score: 0, matchedAliases: [], matchedKeywords: [], reason: 'pending classification', classifiedAt: now },
            verificationStatus: 'UNVERIFIED',
            isMock: false,
            schemaVersion: 1,
          });
        }
        successfulQueries++;
        } catch (e) { console.log(`provider Zapi ${id}: ${safeError(e)}`); }
      }
      if (serpapiKey) {
        // Three bounded angles per incident: event, needs, and response/recovery.
        for (const q of [queries[0], queries[3], queries[5].replace('OR pemulihan)', 'OR pemulihan OR penanggulangan OR evakuasi)')]) {
          try {
            const hits = await searchSerpNews(q, serpapiKey);
            successfulQueries++;
            for (const hit of hits) fresh.push({
              id: articleDocId(id, hit.link), incidentId: id, canonicalUrl: hit.link, url: hit.link,
              title: hit.title, sourceName: hit.sourceName, sourceType: 'NEWS_MEDIA',
              publishedAt: hit.publishedAt, retrievedAt: now, updatedAt: now, summary: null,
              imageUrl: hit.imageUrl,
              contentHash: createHash('sha256').update(`${hit.title}|${hit.link}|${hit.publishedAt ?? ''}`).digest('hex'),
              contentStatus: 'METADATA_ONLY', discoveredBy: 'serpapi:google-news',
              relevance: { incidentId: id, status: 'REJECTED', score: 0, matchedAliases: [], matchedKeywords: [], reason: 'pending classification', classifiedAt: now },
              verificationStatus: 'UNVERIFIED', isMock: false, schemaVersion: 1,
            });
          } catch (e) { console.log(`provider SerpApi ${id}: ${safeError(e)}`); }
        }
      }
      if (searchEnabled) {
        // One bounded request per incident combining all query angles.
        try {
          const hits = await searchGemini(queries.join(' ; '), searchKey, searchModel, fetch, usage => recordServerUsage(db, {promptTokenCount:usage?.total_input_tokens, candidatesTokenCount:usage?.total_output_tokens, totalTokenCount:usage?.total_tokens}, searchModel, 'Crawler Google Search'));
          successfulQueries++;
          for (const hit of hits) {
            fresh.push({
              id: articleDocId(id, hit.link), incidentId: id, canonicalUrl: hit.link, url: hit.link,
              title: hit.title, sourceName: hit.sourceName, sourceType: 'OTHER',
              publishedAt: null, retrievedAt: now, updatedAt: now, summary: hit.summary,
              contentHash: createHash('sha256').update(`${hit.title}|${hit.link}|${hit.summary ?? ''}`).digest('hex'),
              contentStatus: 'METADATA_ONLY', discoveredBy: 'gemini:google-search',
              googleSearchSuggestions: hit.searchSuggestions,
              relevance: { incidentId: id, status: 'REJECTED', score: 0, matchedAliases: [], matchedKeywords: [], reason: 'pending classification', classifiedAt: now },
              verificationStatus: 'UNVERIFIED', isMock: false, schemaVersion: 1,
            });
          }
        } catch (e) { console.log(`provider Gemini ${id}: ${safeError(e)}`); }
      }
      if (threadsToken) {
        try {
          const q=queries[0].replace(/ after:.*$/,'');
          const hits=await searchThreads(q,threadsToken);
          successfulQueries++;
          for(const hit of hits)fresh.push({id:articleDocId(id,hit.url),incidentId:id,canonicalUrl:hit.url,url:hit.url,title:hit.text,sourceName:`Threads · @${hit.username}`,sourceType:'OTHER',publishedAt:hit.publishedAt,retrievedAt:now,updatedAt:now,summary:null,contentHash:createHash('sha256').update(`${hit.url}|${hit.text}`).digest('hex'),contentStatus:'METADATA_ONLY',discoveredBy:'threads:keyword-search',relevance:{incidentId:id,status:'REJECTED',score:0,matchedAliases:[],matchedKeywords:[],reason:'pending location/date classification',classifiedAt:now},verificationStatus:'UNVERIFIED',isMock:false,schemaVersion:1});
        }catch(error){console.log(`provider Threads ${id}: ${safeError(error)}`);}
      }
      if (!successfulQueries) throw new Error('All search providers failed');
      // Prefer dated publisher metadata over undated duplicates across providers.
      const unique = new Map<string, IncidentArticleDoc>();
      for (const article of fresh) {
        const existing = unique.get(article.id);
        if (!existing) unique.set(article.id, article);
        else {
          if (!existing.publishedAt && article.publishedAt) {
            article.googleSearchSuggestions ??= existing.googleSearchSuggestions;
            unique.set(article.id, article);
          } else if (article.googleSearchSuggestions) existing.googleSearchSuggestions = article.googleSearchSuggestions;
        }
      }
      fresh = [...unique.values()];
      fetched = fresh.length;
      // Classify (query hit never implies relevance) + AI summaries for new/changed only.
      const aiTargets = DRY_RUN ? [] : selectForAI(prev.articles.filter((a) => a.incidentId === id), fresh.filter(a=>a.discoveredBy!=='threads:keyword-search'));
      for (const c of aiTargets) {
        const s = await aiExtract(c.title, c.summary, db);
        if (s) {
          c.summary = s.summary;
          aiExtractions += 1;
        }
      }
      const classified = fresh.map((c) => {
        const withRel = classifyForIncident(
          { url: c.url, title: c.title, sourceName: c.sourceName, sourceType: c.sourceType, publishedAt: c.publishedAt, retrievedAt: c.retrievedAt, summary: c.summary, contentStatus: c.contentStatus, incidentId: null, discoveredBy: c.discoveredBy },
          d,
        );
        const rel = withRel.incidentRelevance!;
        if (rel.status === 'MATCHED') matched++;
        else if (rel.status === 'REVIEW_REQUIRED') review++;
        else rejected++;
        return { ...c, relevance: rel };
      });
      const { fresh: artFresh } = diffUpserts(prev.articles.filter((a) => a.incidentId === id), classified);
      articlesNew += artFresh.filter((a) => !prev.articles.some((p) => p.id === a.id)).length;
      articlesUpdated += artFresh.length - artFresh.filter((a) => !prev.articles.some((p) => p.id === a.id)).length;

      // Derive claims/needs/events/poskos/recovery from MATCHED articles only.
      const use = classified.filter((c) => c.relevance.status === 'MATCHED' && c.discoveredBy!=='threads:keyword-search');
      const claimDocs: IncidentClaimDoc[] = [];
      const needDocs: IncidentAidNeedDoc[] = [];
      const eventDocs: IncidentAidEventDoc[] = [];
      const poskoDocs: IncidentPoskoDoc[] = [];
      const recDocs: IncidentRecoveryDoc[] = [];
      for (const c of use) {
        const ctxBase = { incidentId: id, sourceUrl: c.url, sourceOrganization: c.sourceName, sourceType: c.sourceType, reportedAt: c.publishedAt, now, isMock: false };
        for (const ev of extractAidEvents({ url: c.url, title: c.title, sourceName: c.sourceName, sourceType: c.sourceType, publishedAt: c.publishedAt, retrievedAt: c.retrievedAt, summary: c.summary, contentStatus: c.contentStatus, incidentId: id, discoveredBy: c.discoveredBy }, id, false)) {
          eventDocs.push({
            id: stableId(id, 'REPORTED', ev.aidType, ev.quantity ?? '', ev.unit ?? '', c.url, ev.eventTime ?? ''),
            incidentId: id,
            articleId: c.url,
            aidStage: ev.distributionStatus === 'REPORTED_NEEDED' ? 'ANNOUNCED' : 'DISTRIBUTED',
            itemCategory: mapAidType(ev.aidType),
            itemName: ev.aidType,
            quantity: ev.quantity,
            unit: ev.unit,
            estimatedValue: ev.estimatedValue,
            recipientOrDestination: ev.recipientOrDestination,
            location: ev.location,
            distributingOrganization: ev.distributingOrganization,
            sourceUrl: c.url,
            sourceOrganization: c.sourceName,
            verificationStatus: ev.verificationStatus,
            eventTime: ev.eventTime,
            isMock: false,
            schemaVersion: 1,
          });
        }
        for (const p of extractPosko({ url: c.url, title: c.title, sourceName: c.sourceName, sourceType: c.sourceType, publishedAt: c.publishedAt, retrievedAt: c.retrievedAt, summary: c.summary, contentStatus: c.contentStatus, incidentId: id, discoveredBy: c.discoveredBy }, id, false)) {
          poskoDocs.push({
            id: stableId(id, p.name, p.village ?? '', p.regency ?? '', c.url),
            poskoId: stableId(id, p.name, p.village ?? '', p.regency ?? '', c.url),
            incidentId: id,
            articleId: c.url,
            name: p.name,
            poskoType: p.poskoType,
            address: p.address,
            village: p.village,
            district: null,
            regency: p.regency,
            province: p.province,
            latitude: null,
            longitude: null,
            coordinateSource: 'NONE',
            coordinateAccuracy: null,
            operationalStatus: p.operationalStatus,
            capacity: null,
            currentOccupancy: null,
            availableFacilities: [],
            neededSupplies: [],
            contact: null,
            sourceUrl: c.url,
            sourceOrganization: c.sourceName,
            verificationStatus: p.verificationStatus,
            reportedAt: c.publishedAt,
            lastVerifiedAt: null,
            lastUpdatedAt: now,
            isMock: false,
            schemaVersion: 1,
          });
        }
        for (const n of extractNeeds(c.title, c.summary, ctxBase)) {
          needDocs.push({ ...n, id: stableId(id, n.itemCategory, n.itemName, n.affectedArea ?? '', c.url) });
        }
        for (const r of extractRecovery(c.title, c.summary, ctxBase)) {
          recDocs.push(r);
        }
        // Claim per extracted need quantity + damage mentions stay source-attributed.
        for (const n of needDocs.filter((x) => x.sourceUrl === c.url && x.quantityNeeded != null)) {
          claimDocs.push({
            id: stableId(id, c.url, 'need', n.itemName, String(n.quantityNeeded)),
            incidentId: id,
            articleId: c.url,
            claimType: 'need',
            claimText: `${n.itemName}: ${n.quantityNeeded}${n.unit ? ` ${n.unit}` : ''}`,
            location: n.affectedArea,
            quantity: n.quantityNeeded,
            unit: n.unit,
            sourceUrl: c.url,
            sourceOrganization: c.sourceName,
            verificationStatus: n.verificationStatus,
            conflictingWith: [],
            extraction: { engine: 'HEURISTIC', at: now },
            isMock: false,
            schemaVersion: 1,
          });
        }
      }
      const marked = markConflicts([...prev.claims.filter((x) => x.incidentId === id), ...claimDocs]);

      if (db && !DRY_RUN) {
        const batch = db.batch();
        const put = (col: string, docs: Array<{ id: string }>) => {
          for (const doc of docs) batch.set(db.collection(col).doc(doc.id), { ...(doc as object), updatedAt: now }, { merge: true });
        };
        put(HUMANITARIAN_COLLECTIONS.incidentArticles, artFresh);
        const { fresh: claimFresh } = diffUpserts(prev.claims.filter((x) => x.incidentId === id), marked);
        put(HUMANITARIAN_COLLECTIONS.incidentClaims, claimFresh);
        const { fresh: needFresh } = diffUpserts(prev.needs.filter((x) => x.incidentId === id), needDocs as IncidentAidNeedDoc[]);
        put(HUMANITARIAN_COLLECTIONS.incidentAidNeeds, needFresh);
        const { fresh: evFresh } = diffUpserts(prev.events.filter((x) => x.incidentId === id), eventDocs);
        put(HUMANITARIAN_COLLECTIONS.incidentAidEvents, evFresh);
        put(HUMANITARIAN_COLLECTIONS.incidentPoskos, mergePosko(prev.poskos.filter((x) => x.incidentId === id), poskoDocs).filter((p) => !prev.poskos.some((q) => q.id === p.id && JSON.stringify(q) === JSON.stringify(p))));
        put(HUMANITARIAN_COLLECTIONS.incidentRecovery, mergeRecovery(prev.recovery.filter((x) => x.incidentId === id), recDocs).filter((r) => !prev.recovery.some((q) => q.id === r.id && JSON.stringify(q) === JSON.stringify(r))));
        await batch.commit();
      } else if (DRY_RUN) {
        console.log(`dry-run ${id}: fetched=${fetched} matched=${matched} review=${review} rejected=${rejected} needs=${needDocs.length} events=${eventDocs.length} poskos=${poskoDocs.length} recovery=${recDocs.length} claims=${claimDocs.length}`);
      }
      okIncidents += 1;
      perIncident.push({ incidentId: id, fetched, matched, review, rejected });
    } catch (e) {
      // Per-incident failure never touches stored data; continue with other incidents.
      stage = `crawl-${id}`;
      errors.push(`${id}:${safeError(e)}`);
      perIncident.push({ incidentId: id, fetched: 0, matched: 0, review: 0, rejected: 0 });
    }
  }

  const totalRelevant = perIncident.reduce((s, p) => s + p.matched + p.review, 0);
  let outcome: CrawlOutcome;
  let exitCode = 0;
  if (okIncidents === 0) {
    outcome = 'PROVIDER_FAILED';
    exitCode = 1;
  } else {
    outcome = totalRelevant === 0 ? 'SUCCESS_EMPTY' : 'SUCCESS';
  }
  console.log(`outcome        : ${outcome} (incidents ok=${okIncidents}/${TARGETS.length}, relevant=${totalRelevant}, ai=${aiExtractions}${errors.length ? `, errors=${errors.join(';')}` : ''})`);
  if (db && !DRY_RUN) {
    await recordRun(db, outcome, lastSuccess, perIncident, articlesNew, articlesUpdated, aiExtractions, errors.length ? errors.join(';') : null);
  }
  return { outcome, exitCode };
}

function mapAidType(t: string): IncidentAidEventDoc['itemCategory'] {
  if (/makanan|sembako|beras|air minum|pangan/i.test(t)) return 'FOOD_NUTRITION';
  if (/masker|obat|medis|P3K/i.test(t)) return 'HEALTH_MEDICAL';
  if (/tenda|selimut|terpal|kasur|tikar/i.test(t)) return 'SHELTER';
  if (/pakaian/i.test(t)) return 'CLOTHING_BEDDING';
  if (/air bersih|sanitasi|tangki/i.test(t)) return 'DRINKING_WATER';
  if (/perahu|evakuasi/i.test(t)) return 'RESCUE_ACCESS';
  if (/pompa|genset|karung|truk|mobil/i.test(t)) return 'LOGISTICS';
  if (/susu|popok/i.test(t)) return 'BABY_CHILDCARE';
  if (/sabun|hygiene|pembalut/i.test(t)) return 'HYGIENE_SANITATION';
  return 'OTHER';
}

async function recordRun(
  db: Firestore,
  outcome: CrawlOutcome,
  lastSuccess: string | null,
  perIncident: IncidentCrawlRunDoc['perIncident'],
  articlesNew: number,
  articlesUpdated: number,
  aiExtractions: number,
  errorCode: string | null,
): Promise<void> {
  const finishedAt = new Date().toISOString();
  const doc: IncidentCrawlRunDoc = {
    id: `run-${finishedAt.replace(/[:.]/g, '-')}`,
    startedAt: now,
    finishedAt,
    outcome,
    lastSuccessAt: lastSuccess,
    perIncident,
    articlesNew,
    articlesUpdated,
    aiExtractions,
    errorCode,
    schemaVersion: 1,
  };
  await db.collection(HUMANITARIAN_COLLECTIONS.incidentCrawlRuns).doc(doc.id).set(doc);
  console.log(`run recorded   : ${doc.id} (${outcome})`);
}

async function mainGuarded() {
  try {
    const { exitCode } = await main();
    process.exitCode = exitCode;
  } catch (e) {
    console.error(`CRAWL FAILED: stage=${stage} code=${safeError(e)}`);
    console.error('Data preserved: failures never delete or overwrite stored docs.');
    process.exitCode = 1;
  } finally {
    try {
      const { deleteApp, getApps } = await import('firebase-admin/app');
      if (getApps().length > 0) await deleteApp(getApps()[0]!);
    } catch {
      /* teardown best-effort */
    }
  }
}

void mainGuarded();
