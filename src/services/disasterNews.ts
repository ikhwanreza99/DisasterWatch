import { extractNewsMetadata } from './newsMetadata';
export const NEWS_REFRESH_MS = 5 * 24 * 3600_000;
export interface DisasterNewsItem {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  metadata?: NonNullable<ReturnType<typeof extractNewsMetadata>>;
}
export interface DisasterNewsFeed {
  updatedAt: string | null;
  items: DisasterNewsItem[];
}
export const NEWS_QUERY = '(banjir OR "gempa bumi" OR longsor OR tsunami OR erupsi OR karhutla OR "puting beliung" OR "bencana alam" OR "bantuan bencana" OR "evakuasi korban" OR "kekeringan") Indonesia when:7d';

export function normalizeNews(response: unknown, now = Date.now()): DisasterNewsItem[] {
  const payload = response as { data?: { ok?: boolean; items?: unknown[] } };
  if (payload?.data?.ok !== true || !Array.isArray(payload.data.items)) throw new Error('Invalid news response');
  const seen = new Set<string>();
  return payload.data.items.flatMap((value): DisasterNewsItem[] => {
    const item = value as { title?: unknown; link?: unknown; pubDate?: unknown };
    if (!item || typeof item.title !== 'string' || typeof item.link !== 'string' || typeof item.pubDate !== 'string') return [];
    const title = item.title.trim();
    const date = Date.parse(item.pubDate);
    let url: URL;
    try { url = new URL(item.link); } catch { return []; }
    if (url.protocol !== 'https:' || url.username || url.password || !title || !Number.isFinite(date) || date > now + 300_000 || now - date > 7 * 86400_000) return [];
    const separator = title.lastIndexOf(' - ');
    const headline = separator > 0 ? title.slice(0, separator) : title;
    const metadata = extractNewsMetadata(headline);
    if (!metadata) return [];
    url.hash = '';
    const key = url.href;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ metadata, title: separator > 0 ? title.slice(0, separator) : title, url: key,
      publishedAt: new Date(date).toISOString(), source: separator > 0 ? title.slice(separator + 3) : url.hostname }];
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 15);
}

// Broaden the candidate pool only when the first search cannot fill the feed.
export const NEWS_QUERIES = [
  NEWS_QUERY,
  '(banjir OR longsor OR "puting beliung") Indonesia when:7d',
  '("gempa bumi" OR erupsi OR tsunami) Indonesia when:7d',
  '(karhutla OR kekeringan OR "bantuan bencana" OR "evakuasi korban") Indonesia when:7d',
];

export async function collectDisasterNews(
  request: (query: string) => Promise<unknown>, now = Date.now(),
): Promise<DisasterNewsItem[]> {
  const candidates: unknown[] = [];
  let items: DisasterNewsItem[] = [];
  for (const query of NEWS_QUERIES) {
    try {
      const response = await request(query);
      // Validate each response before merging; a failed fallback keeps valid results.
      normalizeNews(response, now);
      candidates.push(...(response as { data: { items: unknown[] } }).data.items);
      items = normalizeNews({ data: { ok: true, items: candidates } }, now);
      if (items.length >= 15) break;
    } catch { /* Try the next search without discarding successful candidates. */ }
  }
  if (!items.length) throw new Error('no relevant articles');
  return items;
}
