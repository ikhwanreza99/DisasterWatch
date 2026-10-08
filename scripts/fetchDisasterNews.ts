import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { NEWS_QUERY, normalizeNews, type DisasterNewsFeed } from '../src/services/disasterNews.ts';

const output = process.argv[2] || 'public/data/disaster-news.json';
let feed: DisasterNewsFeed & { lastAttemptAt?: string } = { updatedAt: null, items: [] };
// Reuse the last successful snapshot on provider errors without pretending it is fresh.
try { feed = JSON.parse(await readFile(output, 'utf8')); } catch { /* first run */ }
try {
  const lastUpdate = Date.parse(feed.lastAttemptAt || feed.updatedAt || '');
  if (Number.isFinite(lastUpdate) && Date.now() >= lastUpdate && Date.now() - lastUpdate < 2 * 3600_000) {
    console.log('Google News: snapshot is less than 2 hours old; no API request.');
  } else {
    const key = process.env.ZAPI_API_KEY;
    if (!key) throw new Error('missing key');
    feed.lastAttemptAt = new Date().toISOString();
    const url = new URL('https://api.zapi.ink/v1/news:google-news/feed');
    url.searchParams.set('query', NEWS_QUERY);
    url.searchParams.set('limit', '50');
    const response = await fetch(url, { headers: { 'x-api-key': key }, signal: AbortSignal.timeout(20_000), redirect: 'error' });
    if (!response.ok) throw new Error('upstream failure');
    const items = normalizeNews(await response.json());
    if (!items.length) throw new Error('no relevant articles');
    feed = { updatedAt: new Date().toISOString(), lastAttemptAt: feed.lastAttemptAt, items };
    console.log(`Google News: ${items.length} articles fetched.`);
  }
} catch {
  // Never log response bodies, request headers, or error objects containing credentials.
  console.warn('::warning::Google News unavailable or ZAPI_API_KEY missing; keeping the previous snapshot if available.');
}
await mkdir(dirname(output), { recursive: true });
await writeFile(`${output}.tmp`, JSON.stringify(feed));
await rename(`${output}.tmp`, output);
