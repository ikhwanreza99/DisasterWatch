// Humanitarian Firestore repository (browser-safe reads).
// Firestore is the persistent source of truth; static seeds/JSON are EXPLICIT
// fallbacks with notices. Never throws to UI. Writes happen via Admin SDK
// scripts only (rules deny client writes on these collections).
import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, limit, query, where } from 'firebase/firestore';
import { getDb } from '../../lib/firebase/firestore';
import { HUMANITARIAN_COLLECTIONS } from '../../domain/humanitarian';
import type {
  IncidentAidEventDoc,
  IncidentAidNeedDoc,
  IncidentArticleDoc,
  IncidentClaimDoc,
  IncidentCrawlRunDoc,
  IncidentDoc,
  IncidentPoskoDoc,
  IncidentRecoveryDoc,
} from '../../domain/humanitarian';

export interface RemoteSnapshot {
  mode: 'live' | 'fallback';
  notice: string;
  incidents: IncidentDoc[];
  articles: IncidentArticleDoc[];
  claims: IncidentClaimDoc[];
  needs: IncidentAidNeedDoc[];
  aidEvents: IncidentAidEventDoc[];
  poskos: IncidentPoskoDoc[];
  recovery: IncidentRecoveryDoc[];
  crawlRuns: IncidentCrawlRunDoc[];
}

const EMPTY: Omit<RemoteSnapshot, 'mode' | 'notice'> = {
  incidents: [],
  articles: [],
  claims: [],
  needs: [],
  aidEvents: [],
  poskos: [],
  recovery: [],
  crawlRuns: [],
};

async function readCol<T>(db: NonNullable<ReturnType<typeof getDb>>, col: string, incidentId: string | null, max: number): Promise<T[]> {
  const ref = collection(db, col);
  const q =
    incidentId != null && col !== HUMANITARIAN_COLLECTIONS.incidentCrawlRuns
      ? query(ref, where('incidentId', '==', incidentId), limit(max))
      : col === HUMANITARIAN_COLLECTIONS.incidentCrawlRuns ? query(ref, orderBy('startedAt', 'desc'), limit(max)) : query(ref, limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as T);
}

/** Load all humanitarian docs for one incident, Firestore-first. */
export async function loadHumanitarian(incidentId: string): Promise<RemoteSnapshot> {
  const db = getDb();
  if (!db) {
    return { mode: 'fallback', notice: 'Firestore belum dikonfigurasi — memakai data lokal.', ...structuredClone(EMPTY) };
  }
  try {
    const [incidents, articles, claims, needs, aidEvents, poskos, recovery, crawlRuns] = await Promise.all([
      readCol<IncidentDoc>(db, HUMANITARIAN_COLLECTIONS.incidents, null, 50),
      readCol<IncidentArticleDoc>(db, HUMANITARIAN_COLLECTIONS.incidentArticles, incidentId, 100),
      readCol<IncidentClaimDoc>(db, HUMANITARIAN_COLLECTIONS.incidentClaims, incidentId, 200),
      readCol<IncidentAidNeedDoc>(db, HUMANITARIAN_COLLECTIONS.incidentAidNeeds, incidentId, 100),
      readCol<IncidentAidEventDoc>(db, HUMANITARIAN_COLLECTIONS.incidentAidEvents, incidentId, 100),
      readCol<IncidentPoskoDoc>(db, HUMANITARIAN_COLLECTIONS.incidentPoskos, incidentId, 100),
      readCol<IncidentRecoveryDoc>(db, HUMANITARIAN_COLLECTIONS.incidentRecovery, incidentId, 50),
      readCol<IncidentCrawlRunDoc>(db, HUMANITARIAN_COLLECTIONS.incidentCrawlRuns, null, 10),
    ]);
    const found = articles.length + claims.length + needs.length + aidEvents.length + poskos.length + recovery.length;
    return {
      mode: 'live',
      notice:
        found > 0
          ? `Memuat ${found} dokumen humaniter dari Firestore.`
          : 'Firestore live, koleksi humaniter masih kosong — memakai data lokal.',
      incidents: incidents.filter((d) => d && d.incidentId),
      articles: articles.filter((d) => d && d.id),
      claims: claims.filter((d) => d && d.id),
      needs: needs.filter((d) => d && d.id),
      aidEvents: aidEvents.filter((d) => d && d.id),
      poskos: poskos.filter((d) => d && d.id),
      recovery: recovery.filter((d) => d && d.id),
      crawlRuns: crawlRuns.filter((d) => d && d.startedAt),
    };
  } catch (e) {
    return { mode: 'fallback', notice: `Gagal memuat Firestore (${String(e)}). Fallback lokal.`, ...structuredClone(EMPTY) };
  }
}

/** Latest successful crawl timestamp across runs (the 1-day gate source of truth). */
export function latestSuccessAt(runs: IncidentCrawlRunDoc[]): string | null {
  let best: string | null = null;
  for (const r of runs) {
    if (r.outcome !== 'SUCCESS' && r.outcome !== 'SUCCESS_EMPTY') continue;
    const t = r.finishedAt ?? r.startedAt;
    if (!Number.isFinite(Date.parse(t))) continue;
    if (!best || Date.parse(t) > Date.parse(best)) best = t;
  }
  return best;
}

/** React hook: Firestore-first humanitarian snapshot (null until loaded). */
export function useHumanitarian(incidentId: string): RemoteSnapshot | null {
  const [snap, setSnap] = useState<{ incidentId: string; data: RemoteSnapshot } | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadHumanitarian(incidentId).then((s) => {
      if (!cancelled) setSnap({ incidentId, data: s });
    });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);
  return snap?.incidentId === incidentId ? snap.data : null;
}
