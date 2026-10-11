// Persisted crawled-article pool (written by scripts/crawlIncidentNews.ts).
// Loads the pool produced by real crawls; never throws — absence means "no pool",
// never an empty successful feed. Classification still happens per incident at display.
import { useEffect, useState } from 'react';
import type { IncidentArticle } from '../domain/incidentDetail';

interface PoolFile {
  at?: string;
  articles?: IncidentArticle[];
}

function validArticle(v: unknown): v is IncidentArticle {
  const a = v as Partial<IncidentArticle>;
  return (
    !!a &&
    typeof a.url === 'string' &&
    typeof a.title === 'string' &&
    typeof a.sourceName === 'string' &&
    typeof a.retrievedAt === 'string' &&
    (a.publishedAt === null || a.publishedAt === undefined || typeof a.publishedAt === 'string')
  );
}

export async function loadIncidentPool(): Promise<IncidentArticle[]> {
  try {
    const res = await fetch('/data/incident-articles.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const file = (await res.json()) as PoolFile;
    if (!Array.isArray(file.articles)) return [];
    return file.articles.filter(validArticle).map((a) => ({
      url: a.url,
      title: a.title,
      sourceName: a.sourceName,
      sourceType: a.sourceType === 'OFFICIAL' ? 'OFFICIAL' : a.sourceType === 'NEWS_MEDIA' ? 'NEWS_MEDIA' : 'OTHER',
      publishedAt: typeof a.publishedAt === 'string' ? a.publishedAt : null,
      retrievedAt: a.retrievedAt,
      summary: typeof a.summary === 'string' ? a.summary : null,
      contentStatus: a.contentStatus === 'FULL' || a.contentStatus === 'PARTIAL' || a.contentStatus === 'FAILED' ? a.contentStatus : 'METADATA_ONLY',
      incidentId: null,
      discoveredBy: typeof a.discoveredBy === 'string' ? a.discoveredBy : 'incident-pool',
    }));
  } catch {
    return [];
  }
}

/** React hook: pooled crawled articles (empty until the pool file loads). */
export function useIncidentPool(): IncidentArticle[] {
  const [pool, setPool] = useState<IncidentArticle[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadIncidentPool().then((p) => {
      if (!cancelled) setPool(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return pool;
}
