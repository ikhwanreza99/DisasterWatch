// Shared, bounded cache for public snapshots. Failed requests are retryable.
const cache = new Map<string, { expires: number; request: Promise<unknown> }>();
export function fetchSnapshot<T>(url: string, ttlMs = 300_000): Promise<T> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.request as Promise<T>;
  const request = fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(15_000) })
    .then(response => { if (!response.ok) throw new Error('Snapshot unavailable'); return response.json() as Promise<T>; })
    .catch(error => { if (cache.get(url)?.request === request) cache.delete(url); throw error; });
  cache.set(url, { expires: Date.now() + ttlMs, request });
  if (cache.size > 20) cache.delete(cache.keys().next().value!);
  return request;
}
