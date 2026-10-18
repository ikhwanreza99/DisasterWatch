import test from 'node:test';
import assert from 'node:assert/strict';
import { eligible, fingerprint, parseResponse, runTranslationJob } from './translateIncidentNews.ts';
import type { IncidentArticleDoc } from '../src/domain/humanitarian.ts';

const now = new Date('2026-10-18T05:00:00.000Z');
function article(over: Partial<IncidentArticleDoc> = {}): IncidentArticleDoc {
  return {
    id: 'a1', incidentId: 'padang', canonicalUrl: 'https://news.example/a', url: 'https://news.example/a',
    title: 'Banjir di Padang rendam puluhan rumah', sourceName: 'News', sourceType: 'NEWS_MEDIA',
    publishedAt: '2026-10-17T05:00:00.000Z', retrievedAt: '2026-10-17T05:00:00.000Z', updatedAt: '2026-10-17T05:00:00.000Z',
    summary: 'Banjir merendam rumah warga di Padang.', contentHash: 'x', contentStatus: 'METADATA_ONLY', discoveredBy: 'test',
    relevance: { incidentId: 'padang', status: 'MATCHED', score: 1, matchedAliases: [], matchedKeywords: [], reason: '', classifiedAt: now.toISOString() },
    verificationStatus: 'UNVERIFIED', isMock: false, schemaVersion: 1, ...over,
  } as IncidentArticleDoc;
}

class MemoryDb {
  values = new Map<string, Record<string, unknown>>();
  private tail: Promise<void> = Promise.resolve();
  collection(name: string) {
    const ref = {
      doc: (id: string) => ({
        key: `${name}/${id}`,
        set: async (value: Record<string, unknown>, options?: { merge?: boolean }) => {
          const old = this.values.get(`${name}/${id}`) ?? {};
          this.values.set(`${name}/${id}`, options?.merge ? { ...old, ...value } : value);
        },
      }),
      where: (_field: string, _operator: string, _value: unknown) => ref,
      get: async () => ({ docs: [...this.values.entries()].filter(([key]) => key.startsWith(`${name}/`)).map(([key, data]) => ({ ref: {
        set: async (value: Record<string, unknown>, options?: { merge?: boolean }) => { this.values.set(key, options?.merge ? { ...data, ...value } : value); },
      }, data: () => data })) }),
    };
    return ref;
  }
  async runTransaction<T>(fn: (tx: { get: (ref: { key: string }) => Promise<{ data: () => Record<string, unknown> | undefined }>; set: (ref: { key: string }, value: Record<string, unknown>, options?: { merge?: boolean }) => void }) => Promise<T>) {
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await fn({
      get: async ref => ({ data: () => this.values.get(ref.key) }),
      set: (ref, value, options) => { const old = this.values.get(ref.key) ?? {}; this.values.set(ref.key, options?.merge ? { ...old, ...value } : value); },
    }); } finally { release(); }
  }
}

test('eligibility matches only recent matched feed records and ignores mock or review-only data', () => {
  assert.equal(eligible(article(), Date.parse(now.toISOString())), true);
  assert.equal(eligible(article({ isMock: true }), Date.parse(now.toISOString())), false);
  assert.equal(eligible(article({ relevance: { ...article().relevance, status: 'REVIEW_REQUIRED' } }), Date.parse(now.toISOString())), false);
  assert.equal(eligible(article({ publishedAt: '2026-09-01T00:00:00.000Z' }), Date.parse(now.toISOString())), false);
});

test('content fingerprint changes only with source fields or prompt version inputs', () => {
  assert.equal(fingerprint('a', 'b'), fingerprint('a', 'b'));
  assert.notEqual(fingerprint('a', 'b'), fingerprint('changed', 'b'));
  assert.notEqual(fingerprint('a', 'b'), fingerprint('a', 'changed'));
});

test('malformed or partial model output is not accepted as a translation', () => {
  assert.throws(() => parseResponse('not json', new Set(['a1'])));
  assert.equal(parseResponse('{"items":[{"id":"a1","title":"","summary":null}]}', new Set(['a1'])).size, 0);
  assert.equal(parseResponse('{"items":[{"id":"other","title":"Valid","summary":null}]}', new Set(['a1'])).size, 0);
});

test('a partially malformed batch retries only the affected record', async () => {
  const db = new MemoryDb();
  const a1 = article({ id: 'a1' });
  const a2 = article({ id: 'a2', url: 'https://news.example/b', canonicalUrl: 'https://news.example/b' });
  db.values.set('incidentArticles/a1', a1 as unknown as Record<string, unknown>);
  db.values.set('incidentArticles/a2', a2 as unknown as Record<string, unknown>);
  const calls: string[][] = [];
  const translate = async (xs: Array<{ id: string; title: string | null; summary: string | null }>) => {
    calls.push(xs.map(x => x.id));
    if (xs.length === 2) return new Map([
      ['a1', { title: 'Flooding affects Padang homes', summary: 'Floodwater entered homes in Padang.' }],
      ['a2', { title: null, summary: 'Floodwater entered nearby homes.' }],
    ]);
    return new Map([[xs[0]!.id, { title: 'Heavy flooding affects Padang residents', summary: 'Floodwater entered nearby homes.' }]]);
  };
  const result = await runTranslationJob({ db: db as never, now, force: true, translate });
  assert.deepEqual(calls, [['a1', 'a2'], ['a2']]);
  assert.equal(result.translated, 2);
  assert.equal(result.aiRequests, 2);
});

test('initial backlog respects the batch limit, resumes, and does not repeat successful records', async () => {
  const db = new MemoryDb();
  const a1 = article(); const a2 = article({ id: 'a2', url: 'https://news.example/b', canonicalUrl: 'https://news.example/b' });
  const a3 = article({ id: 'a3', url: 'https://news.example/c', canonicalUrl: 'https://news.example/c' });
  db.values.set('incidentArticles/a1', a1 as unknown as Record<string, unknown>);
  db.values.set('incidentArticles/a2', a2 as unknown as Record<string, unknown>);
  db.values.set('incidentArticles/a3', a3 as unknown as Record<string, unknown>);
  db.values.set('incidentArticles/old', article({ id: 'old', publishedAt: '2026-09-01T00:00:00.000Z' }) as unknown as Record<string, unknown>);
  let calls = 0;
  const translator = async (items: Array<{ id: string; title: string | null; summary: string | null }>) => {
    calls++;
    return new Map(items.map(x => [x.id, { title: x.title ? `English: ${x.title}` : null, summary: x.summary ? `English: ${x.summary}` : null }]));
  };
  const first = await runTranslationJob({ db: db as never, translate: translator, now, force: true, maxRecords: 2 });
  assert.equal(first.eligibleFound, 3);
  assert.equal(first.translated, 2);
  assert.equal(calls, 1);
  const stored = db.values.get('incidentArticles/a1')?.englishTranslation as { status: string; sourceTitle: string };
  assert.equal(stored.status, 'translated');
  assert.equal(stored.sourceTitle, a1.title);
  const second = await runTranslationJob({ db: db as never, translate: translator, now: new Date(now.getTime() + 5 * 86400_000), force: true, maxRecords: 2 });
  assert.equal(second.skippedCurrent, 2);
  assert.equal(second.translated, 1);
  assert.equal(calls, 2);
  const third = await runTranslationJob({ db: db as never, translate: translator, now: new Date(now.getTime() + 10 * 86400_000), force: true, maxRecords: 2 });
  assert.equal(third.skippedCurrent, 3);
  assert.equal(calls, 2);
});

test('already-English content is skipped without an AI call', async () => {
  const db = new MemoryDb();
  db.values.set('incidentArticles/en', article({ id: 'en', title: 'Floods hit Padang after heavy rain', summary: 'Officials report damaged roads.' }) as unknown as Record<string, unknown>);
  let calls = 0;
  const result = await runTranslationJob({ db: db as never, translate: async () => { calls++; return new Map(); }, now, force: true });
  assert.equal(result.skippedEnglish, 1);
  assert.equal(calls, 0);
});

test('an English title with an Indonesian summary sends only the summary', async () => {
  const db = new MemoryDb();
  db.values.set('incidentArticles/en-mixed', article({ id: 'en-mixed', title: 'Floods hit Padang after heavy rain', summary: 'Banjir merendam puluhan rumah.' }) as unknown as Record<string, unknown>);
  let sent: Array<{ title: string | null; summary: string | null }> = [];
  await runTranslationJob({ db: db as never, now, force: true, translate: async xs => {
    sent = xs.map(({ title, summary }) => ({ title, summary }));
    return new Map(xs.map(x => [x.id, { title: null, summary: 'Floodwater entered dozens of homes.' }]));
  } });
  assert.deepEqual(sent, [{ title: null, summary: 'Banjir merendam puluhan rumah.' }]);
  const stored = db.values.get('incidentArticles/en-mixed')?.englishTranslation as { titleStatus: string; summaryStatus: string; summary: string };
  assert.equal(stored.titleStatus, 'original');
  assert.equal(stored.summaryStatus, 'translated');
  assert.equal(stored.summary, 'Floodwater entered dozens of homes.');
});

test('source title and summary remain unchanged after persistence', async () => {
  const db = new MemoryDb(); const original = article();
  db.values.set('incidentArticles/a1', original as unknown as Record<string, unknown>);
  await runTranslationJob({ db: db as never, now, force: true, translate: async xs => new Map(xs.map(x => [x.id, { title: 'Flooding affects Padang homes', summary: 'Floodwater entered homes in Padang.' }])) });
  const stored = db.values.get('incidentArticles/a1')!;
  assert.equal(stored.title, original.title);
  assert.equal(stored.summary, original.summary);
  assert.equal(stored.sourceName, original.sourceName);
  assert.equal(stored.url, original.url);
  assert.equal(stored.publishedAt, original.publishedAt);
});

test('a changed summary requests only the summary and keeps the current translated title', async () => {
  const db = new MemoryDb();
  const original = article({ englishTranslation: {
    language: 'en', status: 'translated', title: 'Flooding affects Padang homes', summary: 'Old summary.',
    titleStatus: 'translated', summaryStatus: 'translated',
    sourceTitle: 'Banjir di Padang rendam puluhan rumah', sourceSummary: 'Old Indonesian summary.', sourceLanguage: 'id',
    fingerprint: 'old', translatedAt: now.toISOString(), model: 'test', promptVersion: 'news-card-en-v1',
  } });
  db.values.set('incidentArticles/a1', { ...original, summary: 'Ringkasan baru untuk banjir Padang.' } as unknown as Record<string, unknown>);
  let sent: Array<{ title: string | null; summary: string | null }> = [];
  await runTranslationJob({ db: db as never, now, force: true, translate: async xs => {
    sent = xs.map(({ title, summary }) => ({ title, summary }));
    return new Map(xs.map(x => [x.id, { title: null, summary: 'New concise summary.' }]));
  } });
  assert.deepEqual(sent, [{ title: null, summary: 'Ringkasan baru untuk banjir Padang.' }]);
  const stored = db.values.get('incidentArticles/a1')?.englishTranslation as { title: string; summary: string; sourceTitle: string; sourceSummary: string; status: string };
  assert.equal(stored.title, 'Flooding affects Padang homes');
  assert.equal(stored.summary, 'New concise summary.');
  assert.equal(stored.sourceTitle, original.title);
  assert.equal(stored.sourceSummary, 'Ringkasan baru untuk banjir Padang.');
  assert.equal(stored.status, 'translated');
});

test('a changed title requests only the title and keeps the current translated summary', async () => {
  const db = new MemoryDb();
  const original = article({ title: 'Banjir baru di Padang merendam rumah', englishTranslation: {
    language: 'en', status: 'translated', title: 'Old title.', summary: 'Floodwater entered homes in Padang.',
    titleStatus: 'translated', summaryStatus: 'translated',
    sourceTitle: 'Banjir lama di Padang merendam rumah', sourceSummary: 'Banjir merendam rumah warga di Padang.', sourceLanguage: 'id',
    fingerprint: 'old', translatedAt: now.toISOString(), model: 'test', promptVersion: 'news-card-en-v1',
  } });
  db.values.set('incidentArticles/a1', original as unknown as Record<string, unknown>);
  let sent: Array<{ title: string | null; summary: string | null }> = [];
  await runTranslationJob({ db: db as never, now, force: true, translate: async xs => {
    sent = xs.map(({ title, summary }) => ({ title, summary }));
    return new Map(xs.map(x => [x.id, { title: 'New flooding affects Padang homes', summary: null }]));
  } });
  assert.deepEqual(sent, [{ title: original.title, summary: null }]);
  const stored = db.values.get('incidentArticles/a1')?.englishTranslation as { title: string; summary: string; sourceTitle: string; sourceSummary: string };
  assert.equal(stored.title, 'New flooding affects Padang homes');
  assert.equal(stored.summary, 'Floodwater entered homes in Padang.');
  assert.equal(stored.sourceTitle, original.title);
  assert.equal(stored.sourceSummary, original.summary);
});

test('an explicit prompt version change refreshes source-language fields once', async () => {
  const db = new MemoryDb();
  const original = article({ englishTranslation: {
    language: 'en', status: 'translated', titleStatus: 'translated', summaryStatus: 'translated',
    title: 'Old translated title.', summary: 'Old translated summary.',
    sourceTitle: 'Banjir di Padang rendam puluhan rumah', sourceSummary: 'Banjir merendam rumah warga di Padang.',
    sourceLanguage: 'id', fingerprint: 'old', translatedAt: now.toISOString(), model: 'test', promptVersion: 'news-card-en-v0',
  } });
  db.values.set('incidentArticles/a1', original as unknown as Record<string, unknown>);
  let sent: Array<{ title: string | null; summary: string | null }> = [];
  const translator = async (xs: Array<{ id: string; title: string | null; summary: string | null }>) => {
    sent = xs.map(({ title, summary }) => ({ title, summary }));
    return new Map(xs.map(x => [x.id, { title: 'Updated English headline', summary: 'Updated English summary.' }]));
  };
  const result = await runTranslationJob({ db: db as never, now, force: true, translate: translator });
  assert.deepEqual(sent, [{ title: original.title, summary: original.summary }]);
  assert.equal(result.translated, 1);
  const again = await runTranslationJob({ db: db as never, now: new Date(now.getTime() + 5 * 86400_000), force: true, translate: translator });
  assert.equal(again.skippedCurrent, 1);
  assert.equal(sent.length, 1);
});

test('an empty eligible feed exits with zero AI calls', async () => {
  const db = new MemoryDb(); let calls = 0;
  const result = await runTranslationJob({ db: db as never, now, force: true, translate: async () => { calls++; return new Map(); } });
  assert.equal(result.eligibleFound, 0);
  assert.equal(result.aiRequests, 0);
  assert.equal(calls, 0);
});

test('provider failure records failure and leaves source fields intact', async () => {
  const db = new MemoryDb(); const original = article();
  db.values.set('incidentArticles/a1', original as unknown as Record<string, unknown>);
  const result = await runTranslationJob({ db: db as never, now, force: true, translate: async () => { throw Object.assign(new Error('private'), { safeCode: 'provider-unavailable' }); } });
  const stored = db.values.get('incidentArticles/a1')!;
  const translation = stored.englishTranslation as { status: string; errorCode: string; title: string | null };
  assert.equal(result.failed, 1);
  assert.equal(translation.status, 'failed');
  assert.equal(translation.errorCode, 'provider-unavailable');
  assert.equal(translation.title, null);
  assert.equal(stored.title, original.title);
  assert.equal(stored.summary, original.summary);
});

test('concurrent executions are serialized by the Firestore lease', async () => {
  const db = new MemoryDb(); db.values.set('incidentArticles/a1', article() as unknown as Record<string, unknown>);
  let calls = 0;
  const translate = async (xs: Array<{ id: string; title: string | null; summary: string | null }>) => {
    calls++;
    return new Map<string, { title: string | null; summary: string | null }>(xs.map(x => [x.id, { title: 'English headline', summary: 'English summary.' }]));
  };
  const [a, b] = await Promise.all([
    runTranslationJob({ db: db as never, now, translate }),
    runTranslationJob({ db: db as never, now, translate }),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual([a.outcome, b.outcome].sort(), ['GATED_SKIP', 'SUCCESS']);
});
