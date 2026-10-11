// NTT Sumba Barat Daya earthquake case — domain model.
// Additive layer: does not change existing DisasterIncident / IntelligenceReport types.
// Rule: nullable when source doesn't provide it; never invent authors/timestamps/content.

export const NTT_CASE_ID = 'ntt-sumba-barat-daya-2026-10-04';

export type NttSourceType = 'OFFICIAL' | 'NEWS_MEDIA' | 'OTHER';
export type NttContentStatus = 'FULL' | 'PARTIAL' | 'METADATA_ONLY' | 'FAILED';
export type NttVerificationStatus = 'UNVERIFIED' | 'AI_REVIEWED' | 'VERIFIED' | 'CONFLICTING';

export interface BmkgRevision {
  revision: 'initial' | 'update';
  sourceUrl: string;
  sourceLabel: string;
  reportedAt: string | null;
  retrievedAt: string;
  magnitude: number;
  depthKm: number;
  latitude: number;
  longitude: number;
  locationText: string;
  tsunamiAssessment: string;
}

export interface NttCase {
  caseId: string;
  title: string;
  eventDate: string;
  originTimeWib: string;
  sourceUrl: string;
  tsunamiAssessment: string;
  isMajorDisaster: boolean;
  classificationNote: string;
  revisions: BmkgRevision[];
  status: string;
  lastCrawlAt: string | null;
  lastUpdatedAt: string;
  isMock: false;
}

export interface CaseArticle {
  id: string;
  caseId: string;
  sourceName: string;
  sourceType: NttSourceType;
  title: string;
  url: string;
  publishedAt: string | null;
  retrievedAt: string;
  updatedAt: string;
  author: string | null;
  language: string;
  summary: string | null;
  originalSnippet: string | null;
  contentStatus: NttContentStatus;
  discoveredBy: string;
  eventDate: string | null;
  locationMentions: string[];
  topics: string[];
  verificationStatus: NttVerificationStatus;
  verificationNotes: string;
  contentHash: string;
  caseLinkConfidence: number;
  isMock: false;
}

export interface CaseClaim {
  claimId: string;
  caseId: string;
  articleId: string;
  claimType: string;
  claimText: string;
  location: string | null;
  quantity: number | null;
  unit: string | null;
  eventTime: string | null;
  sourceUrl: string;
  sourcePublishedAt: string | null;
  extractionStatus: 'HEURISTIC' | 'GEMINI' | 'MANUAL';
  verificationStatus: NttVerificationStatus;
}

export type TimelineKind =
  | 'EVENT_OCCURRED'
  | 'SOURCE_PUBLISHED'
  | 'SYSTEM_RETRIEVED'
  | 'PARAM_UPDATE'
  | 'CLAIM_VERIFIED'
  | 'CLAIM_DISPUTED';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: string | null;
  label: string;
  detail: string;
  sourceUrl: string | null;
}

/** Canonical URL for idempotent upserts (same rule as disasterNews.normalizeNews). */
export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

/** Stable article id from canonical URL (sha-256 hex, sync version for browser). */
export async function articleIdFromUrl(canonical: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = await crypto.subtle.digest('sha-256', new TextEncoder().encode(canonical));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h1 ^= canonical.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return `fallback-${h1.toString(16)}`;
}

/** Sync non-crypto fallback (used by tests + node scripts without subtle). */
export function articleIdFromUrlSync(canonical: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let h2 = 0x01000193;
  for (let i = canonical.length - 1; i >= 0; i--) {
    h2 ^= canonical.charCodeAt(i);
    h2 = Math.imul(h2, 0x811c9dc5) >>> 0;
  }
  return `${h.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/**
 * Idempotent upsert: repeated crawls update existing records, never duplicate cards.
 * Key = canonical URL. Preserves original publishedAt; bumps retrievedAt/updatedAt.
 */
export function upsertArticles(existing: CaseArticle[], incoming: CaseArticle[]): CaseArticle[] {
  const byUrl = new Map<string, CaseArticle>();
  for (const a of existing) byUrl.set(a.url, a);
  for (const inc of incoming) {
    const prev = byUrl.get(inc.url);
    if (!prev) {
      byUrl.set(inc.url, inc);
    } else {
      byUrl.set(inc.url, {
        ...prev,
        ...inc,
        publishedAt: prev.publishedAt,
        retrievedAt: inc.retrievedAt,
        updatedAt: inc.retrievedAt,
      });
    }
  }
  return [...byUrl.values()].sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : NaN;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : NaN;
    if (Number.isFinite(ta) && Number.isFinite(tb)) return tb - ta;
    if (Number.isFinite(tb)) return 1;
    if (Number.isFinite(ta)) return -1;
    return a.title.localeCompare(b.title);
  });
}

/** "Belum tersedia" for unknown — never render unknown casualty/damage as zero. */
export function formatUnknown(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('id-ID') : 'Belum tersedia';
}
