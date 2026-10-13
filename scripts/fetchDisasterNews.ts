import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { inRecentWindow } from '../src/services/recentWindow.ts';
import { NEWS_REFRESH_MS, collectDisasterNews, type DisasterNewsFeed } from '../src/services/disasterNews.ts';

const output = process.argv[2] || 'public/data/disaster-news.json';
let feed: DisasterNewsFeed & { lastAttemptAt?: string } = { updatedAt: null, items: [] };
// Reuse the last successful snapshot on provider errors without pretending it is fresh.
try { feed = JSON.parse(await readFile(output, 'utf8')); } catch { /* first run */ }
try {
  const lastUpdate = Date.parse(feed.lastAttemptAt || feed.updatedAt || '');
  if (Number.isFinite(lastUpdate) && Date.now() >= lastUpdate && Date.now() - lastUpdate < NEWS_REFRESH_MS) {
    console.log('Google News: last attempt is less than 5 days old; no API request.');
  } else {
    const key = process.env.ZAPI_API_KEY;
    if (!key) throw new Error('missing key');
    feed.lastAttemptAt = new Date().toISOString();
    const items = await collectDisasterNews(async query => {
      const url = new URL('https://api.zapi.ink/v1/news:google-news/feed');
      url.searchParams.set('query', query);
      url.searchParams.set('limit', '50');
      const response = await fetch(url, { headers: { 'x-api-key': key }, signal: AbortSignal.timeout(20_000), redirect: 'error' });
      if (!response.ok) throw new Error('upstream failure');
      return response.json();
    });
    feed = { updatedAt: new Date().toISOString(), lastAttemptAt: feed.lastAttemptAt, items };
    console.log(`Google News: ${items.length} articles fetched.`);
  }
} catch {
  // Never log response bodies, request headers, or error objects containing credentials.
  console.warn('::warning::Google News unavailable or ZAPI_API_KEY missing; keeping the previous snapshot if available.');
}
feed.items = feed.items.filter(item => inRecentWindow(item.publishedAt));
await mkdir(dirname(output), { recursive: true });
await writeFile(`${output}.tmp`, JSON.stringify(feed));
await rename(`${output}.tmp`, output);
