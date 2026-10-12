/** Only public HTTPS source links; unwrap explicit Google redirect destinations. */
export function newsSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let input = value;
  for (let depth = 0; depth < 3; depth++) {
    let url: URL;
    try { url = new URL(input); } catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || !host.includes('.') || host.endsWith('.local') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return null;
    if (host === 'news.google.com' || host === 'google.com' || host === 'www.google.com') {
      const destination = url.searchParams.get('url') || url.searchParams.get('q');
      if (!destination) return null; // Opaque Google News IDs are not publisher URLs.
      input = destination;
      continue;
    }
    url.hash = '';
    return url.href;
  }
  return null;
}
