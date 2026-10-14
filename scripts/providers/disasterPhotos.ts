import { newsSourceUrl } from '../../src/services/newsSourceUrl.ts';

export function driveFolders(text: string): string[] {
  return [...new Set([...text.matchAll(/https:\/\/drive\.google\.com\/drive\/folders\/([\w-]+)/g)].map(match => match[1]))];
}
export function articleImage(html: string, pageUrl: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), m[2]]));
    if (!['og:image', 'og:image:secure_url', 'twitter:image'].includes(attrs.property ?? attrs.name)) continue;
    const value = attrs.content?.replace(/&amp;/g, '&');
    if (!value) continue;
    try { const safe = newsSourceUrl(new URL(value, pageUrl).href); if (safe) return safe; } catch { /* invalid */ }
  }
  return null;
}
export async function driveImage(folderId: string, key: string, request: typeof fetch = fetch): Promise<{imageUrl: string; sourceUrl: string} | null> {
  if (!/^[\w-]+$/.test(folderId)) return null;
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`);
  url.searchParams.set('fields', 'files(id,mimeType,thumbnailLink,webViewLink)');
  url.searchParams.set('pageSize', '20');
  const response = await request(url, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json() as { files?: Array<{mimeType?: string; thumbnailLink?: string; webViewLink?: string}> };
  for (const file of data.files ?? []) {
    const imageUrl = newsSourceUrl(file.thumbnailLink);
    const sourceUrl = newsSourceUrl(file.webViewLink);
    if (file.mimeType?.startsWith('image/') && imageUrl && sourceUrl && new URL(imageUrl).hostname.endsWith('.googleusercontent.com')) return { imageUrl, sourceUrl };
  }
  return null;
}

// Only known publishers: no arbitrary crawled URL fetches or redirect traversal.
const PUBLISHERS = ['bnpb.go.id', 'bmkg.go.id', 'antaranews.com', 'liputan6.com', 'rri.co.id', 'kompas.com', 'detik.com', 'idntimes.com', 'tvrinews.com', 'kemenlh.go.id', 'kalteng.go.id'];
export async function fetchArticleImage(pageUrl: string): Promise<string | null> {
  const safe = newsSourceUrl(pageUrl);
  if (!safe) return null;
  const host = new URL(safe).hostname;
  if (!PUBLISHERS.some(domain => host === domain || host.endsWith(`.${domain}`))) return null;
  const response = await fetch(safe, { redirect: 'error', signal: AbortSignal.timeout(12_000), headers: { Accept: 'text/html' } });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || !response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = ''; let size = 0;
  try {
    while (size < 512_000) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      html += decoder.decode(part.value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
  } finally { await reader.cancel(); }
  return articleImage(html, safe);
}
