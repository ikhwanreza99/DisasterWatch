// Admin SDK only: never import in browser code.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { DisasterNewsFeed } from '../src/services/disasterNews.ts';
import { extractNewsMetadata } from '../src/services/newsMetadata.ts';

let stage = 'snapshot-validation';
async function main() {
  const feed = JSON.parse(await readFile(process.argv[2] || 'public/data/disaster-news.json', 'utf8')) as DisasterNewsFeed;
  if (!feed.updatedAt || !feed.items.length) { console.log('No news snapshot to sync.'); return; }
  if (!Number.isFinite(Date.parse(feed.updatedAt))) throw new Error('Invalid snapshot');
  const records = feed.items.slice(0, 15).map(item => {
    const metadata = extractNewsMetadata(item.title);
    if (!metadata || !/^https:\/\//.test(item.url) || !Number.isFinite(Date.parse(item.publishedAt))) throw new Error('Unclassified article');
    return { id: createHash('sha256').update(item.url).digest('hex'), title: item.title,
      url: item.url, source: item.source, publishedAt: item.publishedAt, metadata,
      fetchedAt: feed.updatedAt, schemaVersion: 1, provider: 'zapi_google_news', isMock: false };
  });
  if (process.argv.includes('--dry-run')) { console.log(JSON.stringify({ updatedAt: feed.updatedAt, articles: records }, null, 2)); return; }
  stage = 'credentials';
  const raw = process.env.FIREBASE_NEWS_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Missing service account');
  const account = JSON.parse(raw);
  if (account.project_id !== 'disasterwatch-61ed5') throw new Error('Unexpected project');
  const app = initializeApp({ credential: cert(account), projectId: 'disasterwatch-61ed5' });
  try {
    const db = getFirestore(app);
    const state = db.collection('newsFeeds').doc('indonesia-disasters');
    stage = 'firestore-transaction';
    const result = await db.runTransaction(async transaction => {
      const previous = await transaction.get(state);
      const prior = Date.parse(previous.data()?.updatedAt || '');
      if (prior >= Date.parse(feed.updatedAt!)) return false;
      for (const record of records) transaction.set(db.collection('newsArticles').doc(record.id), record);
      transaction.set(state, { updatedAt: feed.updatedAt, articleIds: records.map(r => r.id), count: records.length, schemaVersion: 1 });
      return true;
    });
    console.log(result ? `Firestore: synced ${records.length} news articles.` : 'Firestore: snapshot already synced.');
  } finally { await deleteApp(app); }
}
main().catch((error: unknown) => {
  const code = (error as { code?: unknown })?.code;
  const safeCode = typeof code === 'number' ? String(code) : ['app/invalid-credential', 'permission-denied', 'unauthenticated'].includes(String(code)) ? String(code) : 'unknown';
  console.error(`Firestore sync stage: ${stage}; error code: ${safeCode}`);
  console.error('News Firestore sync failed. Check snapshot, service account secret and Firestore IAM access.');
  process.exitCode = 1;
});
