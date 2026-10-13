// Server-only: the SerpApi key must never enter a Vite bundle or request log.
import { newsSourceUrl } from '../../src/services/newsSourceUrl.ts';

export interface SerpNewsHit {
  title: string; link: string; sourceName: string; publishedAt: string | null;
}
interface NewsItem {
  title?: unknown; link?: unknown; source?: { name?: unknown }; iso_date?: unknown;
  stories?: NewsItem[];
}
interface NewsResponse {
  error?: unknown; search_metadata?: { status?: string }; news_results?: NewsItem[];
}

export function parseSerpNews(data: NewsResponse): SerpNewsHit[] {
  if (data.error || data.search_metadata?.status !== 'Success' || !Array.isArray(data.news_results)) {
    throw new Error('Invalid SerpApi news response');
  }
  const unique = new Map<string, SerpNewsHit>();
  function add(items: NewsItem[], depth = 0): void {
    for (const item of items) {
      if (Array.isArray(item.stories) && depth < 3) add(item.stories, depth + 1);
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const link = newsSourceUrl(item.link);
      if (!title || !link) continue;
      // Only trust an explicit timestamp with timezone, never relative display dates.
      const rawDate = typeof item.iso_date === 'string' ? item.iso_date : '';
      const time = /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(rawDate) ? Date.parse(rawDate) : NaN;
      const hit = {
        title: title.slice(0, 1000), link,
        sourceName: typeof item.source?.name === 'string' && item.source.name.trim() ? item.source.name.trim().slice(0, 200) : new URL(link).hostname,
        publishedAt: Number.isFinite(time) ? new Date(time).toISOString() : null,
      };
      if (!unique.has(link) || (!unique.get(link)!.publishedAt && hit.publishedAt)) unique.set(link, hit);
    }
  }
  add(data.news_results);
  return [...unique.values()].slice(0, 30);
}

export async function searchSerpNews(query: string, apiKey: string, request: typeof fetch = fetch): Promise<SerpNewsHit[]> {
  const url = new URL('https://serpapi.com/search.json');
  for (const [key, value] of Object.entries({ engine: 'google_news', q: query, gl: 'id', hl: 'id', api_key: apiKey })) url.searchParams.set(key, value);
  // SerpApi requires api_key as a query parameter. Never log this URL or raw errors.
  let response: Response;
  try { response = await request(url, { signal: AbortSignal.timeout(30_000) }); }
  catch { throw new Error('SerpApi request failed'); }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  let data: NewsResponse;
  try { data = await response.json() as NewsResponse; } catch { throw new Error('Invalid SerpApi news response'); }
  return parseSerpNews(data);
}
