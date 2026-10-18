// Scheduled, Admin-SDK-only translator for title/summary fields in the
// user-facing MATCHED incident news feed. Never reads article bodies.
import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { inRecentWindow } from '../src/services/recentWindow.ts';
import { newsSourceUrl } from '../src/services/newsSourceUrl.ts';
import { canonicalUrl } from '../src/domain/nttCase.ts';
import { DEFAULT_GEMINI_MODEL } from '../src/lib/firebase/geminiConfig.ts';
import { looksEnglish, looksIndonesian } from '../src/i18n/newsText.ts';
import type { IncidentArticleDoc } from '../src/domain/humanitarian.ts';
import type { IncidentArticleTranslation } from '../src/domain/incidentDetail.ts';

const PROJECT_ID = 'disasterwatch-61ed5';
const INTERVAL_MS = 5 * 24 * 60 * 60_000;
const PROMPT_VERSION = 'news-card-en-v1';
const MODEL = process.env.DISASTERWATCH_TRANSLATION_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
const MAX_RECORDS = boundedInt(process.env.NEWS_TRANSLATION_MAX_RECORDS, 15, 1, 50);
const MAX_OUTPUT_CHARS = 900;
const stateRefName = 'incident-news-en-v1';
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force') || process.env.NEWS_TRANSLATION_FORCE === 'true';

function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}
export function fingerprint(title: string, summary: string | null): string {
  return createHash('sha256').update(JSON.stringify([title, summary, 'en', PROMPT_VERSION])).digest('hex');
}
export function eligible(a: IncidentArticleDoc, now: number): boolean {
  if (a.isMock || a.relevance?.status !== 'MATCHED' || a.relevance?.incidentId !== a.incidentId) return false;
  if (a.discoveredBy === 'threads:keyword-search' || !newsSourceUrl(a.url)) return false;
  return inRecentWindow(a.publishedAt, now);
}
function sourceLanguage(title: string): 'id' | 'en' | 'unknown' {
  if (looksIndonesian(title)) return 'id';
  if (looksEnglish(title)) return 'en';
  return 'unknown';
}
export function parseResponse(raw: string, expectedIds: Set<string>): Map<string, { title: string | null; summary: string | null }> {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: { items?: unknown };
  try { parsed = JSON.parse(text) as { items?: unknown }; }
  catch { throw Object.assign(new Error('malformed'), { safeCode: 'malformed-response' }); }
  if (!Array.isArray(parsed.items)) throw Object.assign(new Error('malformed'), { safeCode: 'malformed-response' });
  const out = new Map<string, { title: string | null; summary: string | null }>();
  for (const x of parsed.items) {
    if (!x || typeof x !== 'object') continue;
    const item = x as Record<string, unknown>;
    if (typeof item.id !== 'string' || !expectedIds.has(item.id) || out.has(item.id)) continue;
    if (item.title !== null && (typeof item.title !== 'string' || !item.title.trim() || item.title.length > MAX_OUTPUT_CHARS)) continue;
    if (item.summary !== null && (typeof item.summary !== 'string' || item.summary.length > 320 || /[\r\n]/.test(item.summary))) continue;
    out.set(item.id, { title: typeof item.title === 'string' ? item.title.trim() : null, summary: typeof item.summary === 'string' ? item.summary.trim() || null : null });
  }
  return out;
}
async function callGemini(records: Array<{ id: string; title: string | null; summary: string | null }>): Promise<Map<string, { title: string | null; summary: string | null }>> {
  const key = (process.env.DISASTERWATCH_GEMINI_KEY || process.env.DISASTERWATCH_GEMINI_SEARCH_KEY || process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw Object.assign(new Error('provider-unavailable'), { safeCode: 'provider-unavailable' });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(30_000), redirect: 'error',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `Translate non-null Indonesian fields in these news cards into natural concise English. A null title or summary means leave it null. Never add facts. Keep names, numbers, locations, dates, severity, and uncertainty. Summary must remain one short sentence. Return strict JSON only: {"items":[{"id":"...","title":"...","summary":"..."}]}. Input:\n${JSON.stringify(records)}` }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048, temperature: 0 },
    }),
  });
  if (!response.ok) throw Object.assign(new Error('upstream'), { safeCode: `http-${response.status}` });
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = payload.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  if (!raw || raw.length > 12_000) throw Object.assign(new Error('malformed'), { safeCode: 'malformed-response' });
  return parseResponse(raw, new Set(records.map(r => r.id)));
}

export async function runTranslationJob(options: { db: Firestore; translate?: typeof callGemini; now?: Date; dryRun?: boolean; force?: boolean; maxRecords?: number } ) {
  const started = (options.now ?? new Date()).toISOString();
  const startMs = Date.parse(started);
  const runId = randomUUID();
  const summary = { startedAt: started, finishedAt: '', eligibleFound: 0, newOrChangedFound: 0, translated: 0, skippedCurrent: 0, skippedEnglish: 0, failed: 0, aiRequests: 0, outcome: '' };
  const stateRef = options.db.collection('jobState').doc(stateRefName);
  const dryRun = options.dryRun ?? DRY_RUN;
  const force = options.force ?? FORCE;
  if (!dryRun) {
    const claim = await options.db.runTransaction(async tx => {
      const snap = await tx.get(stateRef); const data = snap.data() ?? {};
      const last = typeof data.lastRunAt === 'string' ? data.lastRunAt : null;
      if (!force && last && startMs - Date.parse(last) < INTERVAL_MS) return { acquired: false as const, last };
      const lease = typeof data.leaseUntil === 'string' ? Date.parse(data.leaseUntil) : 0;
      if (lease > startMs) return { acquired: false as const, last };
      tx.set(stateRef, { ...data, leaseId: runId, leaseUntil: new Date(startMs + 30 * 60_000).toISOString(), lastAttemptAt: started }, { merge: true });
      return { acquired: true as const, last };
    });
    if (!claim.acquired) {
      summary.outcome = 'GATED_SKIP'; summary.finishedAt = new Date().toISOString();
      console.log(JSON.stringify(summary));
      return summary;
    }
  }

  try {
    const snap = await options.db.collection('incidentArticles').where('relevance.status', '==', 'MATCHED').get();
    const docs = snap.docs.map(d => ({ ref: d.ref, data: d.data() as IncidentArticleDoc }));
    const eligibleDocs: typeof docs = [];
    const seen = new Set<string>();
    for (const d of docs.filter(x => eligible(x.data, startMs))
      .sort((a, b) => Date.parse(b.data.publishedAt ?? '') - Date.parse(a.data.publishedAt ?? ''))) {
      const urlKey = canonicalUrl(d.data.url) ?? d.data.url;
      const key = `${d.data.incidentId}::${urlKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      eligibleDocs.push(d);
    }
    summary.eligibleFound = eligibleDocs.length;
    const pending = eligibleDocs.flatMap(d => {
      const a = d.data; const lang = sourceLanguage(a.title);
      const titleEnglish = looksEnglish(a.title);
      const summaryEnglish = !a.summary || looksEnglish(a.summary);
      if (titleEnglish && summaryEnglish) { summary.skippedEnglish++; return []; }
      const fp = fingerprint(a.title, a.summary);
      const old = a.englishTranslation;
      if (old?.status === 'translated' && old.fingerprint === fp && old.promptVersion === PROMPT_VERSION) { summary.skippedCurrent++; return []; }
      const promptChanged = old?.promptVersion !== PROMPT_VERSION;
      return [{ ...d, lang, fp,
        needTitle: !titleEnglish && (promptChanged || old?.sourceTitle !== a.title || old?.titleStatus !== 'translated' || !old.title),
        needSummary: a.summary != null && !summaryEnglish && (promptChanged || old?.sourceSummary !== a.summary || old?.summaryStatus !== 'translated' || !old.summary),
      }];
    });
    summary.newOrChangedFound = pending.length;
    const maxRecords = Math.max(1, Math.min(50, options.maxRecords ?? MAX_RECORDS));
    const batch = pending.slice(0, maxRecords);
    if (dryRun) {
      summary.outcome = 'DRY_RUN';
      return summary;
    }
    const translator = options.translate ?? callGemini;
    // Batches are capped; if an item is absent/malformed, retry that item alone.
    for (let i = 0; i < batch.length; i += 10) {
      const group = batch.slice(i, i + 10);
      let results = new Map<string, { title: string | null; summary: string | null }>();
      let safeError: string | undefined;
      try { summary.aiRequests++; results = await translator(group.map(x => ({ id: x.data.id, title: x.needTitle ? x.data.title : null, summary: x.needSummary ? x.data.summary : null }))); }
      catch (e) { safeError = (e as { safeCode?: string }).safeCode ?? 'provider-error'; }
      for (const entry of group) {
        let result = results.get(entry.data.id);
        let recordError = safeError;
        const firstTitleValid = !entry.needTitle || (!!result?.title && result.title !== entry.data.title);
        const firstSummaryValid = !entry.needSummary || (!!result?.summary && result.summary !== entry.data.summary);
        if ((!firstTitleValid || !firstSummaryValid) && (!recordError || recordError === 'malformed-response')) {
          const first = result;
          try {
            summary.aiRequests++;
            const one = await translator([{ id: entry.data.id, title: entry.needTitle ? entry.data.title : null, summary: entry.needSummary ? entry.data.summary : null }]);
            const retry = one.get(entry.data.id);
            if (retry) result = {
              title: firstTitleValid ? first?.title ?? null : retry.title,
              summary: firstSummaryValid ? first?.summary ?? null : retry.summary,
            };
            else result = first;
          }
          catch (e) { recordError = (e as { safeCode?: string }).safeCode ?? 'provider-error'; }
        }
        const old = entry.data.englishTranslation;
        const validTitle = !entry.needTitle || (!!result?.title && result.title !== entry.data.title);
        const validSummary = !entry.needSummary || (!!result?.summary && result.summary !== entry.data.summary);
        const success = validTitle && validSummary;
        const titleEnglish = looksEnglish(entry.data.title);
        const summaryEnglish = !!entry.data.summary && looksEnglish(entry.data.summary);
        const titleCurrent = entry.needTitle ? validTitle : titleEnglish || (old?.sourceTitle === entry.data.title && !!old.title);
        const summaryCurrent = entry.data.summary == null || (entry.needSummary ? validSummary : summaryEnglish || (old?.sourceSummary === entry.data.summary && !!old.summary));
        const titleStatus = titleEnglish ? 'original' : titleCurrent ? 'translated' : 'failed';
        const summaryStatus = summaryEnglish ? 'original' : summaryCurrent ? 'translated' : 'failed';
        const translation: IncidentArticleTranslation = {
          language: 'en', status: titleCurrent && summaryCurrent ? 'translated' : 'failed',
          titleStatus, summaryStatus,
          title: entry.needTitle && validTitle ? result!.title : old?.title ?? null,
          summary: entry.data.summary == null ? null : entry.needSummary && validSummary ? result!.summary : old?.summary ?? null,
          sourceTitle: titleCurrent ? entry.data.title : old?.sourceTitle ?? entry.data.title,
          sourceSummary: summaryCurrent ? entry.data.summary : old?.sourceSummary ?? entry.data.summary,
          sourceLanguage: entry.lang,
          fingerprint: success ? entry.fp : old?.fingerprint ?? entry.fp, translatedAt: success ? new Date().toISOString() : old?.translatedAt ?? null,
          model: success ? MODEL : old?.model ?? MODEL, promptVersion: PROMPT_VERSION,
          ...(!success ? { errorCode: recordError ?? 'invalid-response' } : {}),
        };
        if (success) summary.translated++; else summary.failed++;
        if (!dryRun) await entry.ref.set({ englishTranslation: translation }, { merge: true });
      }
    }
    summary.outcome = summary.failed > 0 ? 'SUCCESS_WITH_FAILURES' : 'SUCCESS';
    summary.finishedAt = new Date().toISOString();
    if (!dryRun) await stateRef.set({ lastRunAt: started, lastSummary: summary, leaseId: null, leaseUntil: null }, { merge: true });
  } catch (error) {
    summary.outcome = 'FAILED';
    if (!dryRun) await stateRef.set({ lastErrorCode: (error as { code?: unknown })?.code === 'permission-denied' ? 'permission-denied' : 'job-error', leaseId: null, leaseUntil: null }, { merge: true });
    throw error;
  } finally {
    if (!summary.finishedAt) summary.finishedAt = new Date().toISOString();
    console.log(JSON.stringify(summary));
  }
  return summary;
}

async function main() {
  const raw = process.env.FIREBASE_NEWS_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Missing Firebase service account secret.');
  const account = JSON.parse(raw);
  if (account.project_id !== PROJECT_ID) throw new Error('Unexpected project.');
  const app = initializeApp({ credential: cert(account), projectId: PROJECT_ID });
  try { await runTranslationJob({ db: getFirestore(app) }); }
  finally { await deleteApp(app); }
}
if (process.argv[1]?.endsWith('translateIncidentNews.ts')) main().catch(e => { console.error(`News translation failed (${(e as { safeCode?: string }).safeCode ?? 'job-error'}).`); process.exitCode = 1; });
