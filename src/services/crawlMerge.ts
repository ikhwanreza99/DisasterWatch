// Pure merge helpers for the incident crawl pipeline (browser-safe, no Admin imports).
// Rules: upsert new/changed only; never delete; failed crawls preserve everything;
// posko coordinates only upgrade (never downgrade confirmed → null); recovery
// history appends (never overwritten); AI runs only for new/changed content.
import { appendRecoveryStatus, currentRecoveryStatus } from '../domain/humanitarian';
import type { IncidentPoskoDoc, IncidentRecoveryDoc } from '../domain/humanitarian';

function norm(v: unknown): string {
  return JSON.stringify(v, Object.keys(v as object).sort());
}

/** Split incoming docs into { fresh (new or changed), unchanged } by stable id. */
export function diffUpserts<T extends { id: string }>(existing: T[], incoming: T[]): { fresh: T[]; unchanged: T[] } {
  const prev = new Map(existing.map((d) => [d.id, norm(d)]));
  const fresh: T[] = [];
  const unchanged: T[] = [];
  for (const doc of incoming) {
    if (prev.get(doc.id) === norm(doc)) unchanged.push(doc);
    else fresh.push(doc);
  }
  return { fresh, unchanged };
}

/** Article-likes eligible for AI extraction: unseen contentHash or changed summary. */
export function selectForAI<T extends { id: string; contentHash: string; summary: string | null }>(
  existing: T[],
  incoming: T[],
): T[] {
  const prev = new Map(existing.map((d) => [d.id, d]));
  return incoming.filter((c) => {
    const p = prev.get(c.id);
    return !p || p.contentHash !== c.contentHash || (p.summary ?? null) !== (c.summary ?? null);
  });
}

/**
 * Merge posko docs: keep existing confirmed coordinates (never downgrade to null),
 * upgrade NONE → stated coordinates, union facilities/supplies, keep latest timestamps.
 */
export function mergePosko(existing: IncidentPoskoDoc[], incoming: IncidentPoskoDoc[]): IncidentPoskoDoc[] {
  const prev = new Map(existing.map((d) => [d.id, d]));
  return incoming.map((doc) => {
    const p = prev.get(doc.id);
    if (!p) return doc;
    const keepCoords = p.coordinateSource !== 'NONE' && (doc.coordinateSource === 'NONE' || doc.latitude == null);
    return {
      ...p,
      ...doc,
      latitude: keepCoords ? p.latitude : doc.latitude,
      longitude: keepCoords ? p.longitude : doc.longitude,
      coordinateSource: keepCoords ? p.coordinateSource : doc.coordinateSource,
      coordinateAccuracy: keepCoords ? p.coordinateAccuracy : doc.coordinateAccuracy,
      availableFacilities: [...new Set([...(p.availableFacilities ?? []), ...(doc.availableFacilities ?? [])])],
      neededSupplies: [...new Set([...(p.neededSupplies ?? []), ...(doc.neededSupplies ?? [])])],
      lastUpdatedAt: doc.lastUpdatedAt > p.lastUpdatedAt ? doc.lastUpdatedAt : p.lastUpdatedAt,
    };
  });
}

/**
 * Merge recovery docs: append a new history entry only when the status actually
 * changed (or history is empty). Invalid status/category pairs throw (schema guard).
 */
export function mergeRecovery(existing: IncidentRecoveryDoc[], incoming: IncidentRecoveryDoc[]): IncidentRecoveryDoc[] {
  const prev = new Map(existing.map((d) => [d.id, d]));
  return incoming.map((doc) => {
    const p = prev.get(doc.id);
    if (!p) return doc;
    const cur = currentRecoveryStatus(p);
    const nextEntry = doc.history[doc.history.length - 1];
    if (!nextEntry) return p;
    if (cur && cur.status === nextEntry.status) {
      // Same status: refresh metadata only, history untouched.
      return { ...p, lastUpdatedAt: doc.lastUpdatedAt, impactDescription: doc.impactDescription ?? p.impactDescription };
    }
    return appendRecoveryStatus(p, nextEntry);
  });
}
