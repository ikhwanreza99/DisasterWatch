export interface DisasterNewsItem {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
}
export interface DisasterNewsFeed {
  updatedAt: string | null;
  items: DisasterNewsItem[];
}
export const NEWS_QUERY = '(banjir OR "gempa bumi" OR longsor OR tsunami OR erupsi OR karhutla OR "puting beliung" OR "bencana alam") Indonesia when:7d';

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
    // Query defines geography; reject clearly unrelated headlines returned by the provider.
    if (!/banjir|gempa|longsor|tsunami|erupsi|karhutla|kebakaran hutan|puting beliung|bencana/i.test(title)) return [];
    url.hash = '';
    const key = url.href;
    if (seen.has(key)) return [];
    seen.add(key);
    const separator = title.lastIndexOf(' - ');
    return [{ title: separator > 0 ? title.slice(0, separator) : title, url: key,
      publishedAt: new Date(date).toISOString(), source: separator > 0 ? title.slice(separator + 3) : url.hostname }];
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 15);
}
