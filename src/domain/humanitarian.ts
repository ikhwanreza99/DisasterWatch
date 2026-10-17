// Canonical Firestore schemas for humanitarian metadata (8 collections).
// Browser-safe (no node imports): shared by UI, repo layer, scripts, and tests.
// Rules: unknown quantities are null (never guessed); conflicting claims coexist;
// recovery keeps append-only history; map pins require validated coordinates.
import type { VerificationStatus } from './intelligence';

export const HUMANITARIAN_COLLECTIONS = {
  incidents: 'incidents',
  incidentArticles: 'incidentArticles',
  incidentClaims: 'incidentClaims',
  incidentAidNeeds: 'incidentAidNeeds',
  incidentAidEvents: 'incidentAidEvents',
  incidentPoskos: 'incidentPoskos',
  incidentRecovery: 'incidentRecovery',
  incidentCrawlRuns: 'incidentCrawlRuns',
} as const;

export const SCHEMA_VERSION = 1;

/** Deterministic dedup key (non-crypto; Admin sync layer uses sha256 where available). */
export function stableId(...parts: Array<string | number | null | undefined>): string {
  const s = parts.map((p) => (p ?? '').toString()).join('|');
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function articleDocId(incidentId: string, canonicalUrl: string): string {
  return `${incidentId}__${stableId(canonicalUrl)}`;
}

// --- 1. incidents (canonical registry; migrated from disasters docs shape) ---
export interface IncidentDoc {
  id: string; // == incidentId
  incidentId: string;
  name: string;
  province: string;
  disasterType: 'earthquake' | 'flood' | 'fire' | 'landslide' | 'other';
  eventDate: string | null;
  status: string;
  aliases: string[];
  isMock: boolean;
  provenanceNote: string;
  schemaVersion: number;
  updatedAt: string;
}

// --- 2. incidentArticles (per-incident crawled metadata; summaries only) ---
export type RelevanceStatus = 'MATCHED' | 'REVIEW_REQUIRED' | 'REJECTED';
export interface IncidentArticleDoc {
  id: string; // articleDocId(incidentId, canonicalUrl)
  incidentId: string;
  canonicalUrl: string;
  url: string;
  title: string;
  sourceName: string;
  sourceType: 'OFFICIAL' | 'NEWS_MEDIA' | 'OTHER';
  publishedAt: string | null;
  retrievedAt: string;
  updatedAt: string;
  summary: string | null;
  contentHash: string;
  contentStatus: 'FULL' | 'PARTIAL' | 'METADATA_ONLY' | 'FAILED';
  discoveredBy: string;
  googleSearchSuggestions?: string | null;
  imageUrl?: string | null; // Publisher/SerpApi thumbnail; never an inferred field photo.
  relevance: {
    incidentId: string;
    status: RelevanceStatus;
    score: number;
    matchedAliases: string[];
    matchedKeywords: string[];
    reason: string;
    classifiedAt: string;
  };
  verificationStatus: VerificationStatus;
  isMock: boolean;
  schemaVersion: number;
}

// --- 3. incidentClaims (conflicting values coexist, never silently picked) ---
export interface IncidentClaimDoc {
  id: string; // stableId(incidentId, canonicalUrl, claimType, claimText)
  incidentId: string;
  articleId: string;
  claimType: string;
  claimText: string;
  location: string | null;
  quantity: number | null;
  unit: string | null;
  sourceUrl: string;
  sourceOrganization: string | null;
  verificationStatus: VerificationStatus;
  conflictingWith: string[]; // ids of claims this one conflicts with
  extraction: { engine: 'HEURISTIC' | 'GEMINI' | 'MANUAL'; at: string };
  isMock: boolean;
  schemaVersion: number;
}

/** Mark pairwise conflicts within one incident+claimType group (pure). */
export function markConflicts(claims: IncidentClaimDoc[]): IncidentClaimDoc[] {
  return claims.map((c) => {
    if (c.quantity == null) return { ...c, conflictingWith: [] };
    const others = claims
      .filter(
        (o) =>
          o.id !== c.id &&
          o.incidentId === c.incidentId &&
          o.claimType === c.claimType &&
          o.quantity != null &&
          o.quantity !== c.quantity,
      )
      .map((o) => o.id);
    const status = others.length > 0 ? 'CONFLICTING' : c.verificationStatus === 'CONFLICTING' ? c.verificationStatus : c.verificationStatus;
    return { ...c, conflictingWith: others, verificationStatus: others.length > 0 ? 'CONFLICTING' : status } as IncidentClaimDoc;
  });
}

// --- 4. incidentAidNeeds (spec §1; quantities null when unknown) ---
export type NeedItemCategory =
  | 'FOOD_NUTRITION'
  | 'DRINKING_WATER'
  | 'HYGIENE_SANITATION'
  | 'BABY_CHILDCARE'
  | 'MENSTRUAL_HEALTH'
  | 'CLOTHING_BEDDING'
  | 'SHELTER'
  | 'HEALTH_MEDICAL'
  | 'VECTOR_CONTROL'
  | 'WATER_TREATMENT'
  | 'POWER_LIGHTING'
  | 'COMMUNICATION'
  | 'RESCUE_ACCESS'
  | 'DISABILITY_ELDERLY_CARE'
  | 'LOGISTICS'
  | 'OTHER';
export type NeedStatus = 'REPORTED' | 'INFERRED' | 'PENDING_VALIDATION' | 'VERIFIED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CLOSED' | 'EXPIRED';
export interface IncidentAidNeedDoc {
  id: string; // stableId(incidentId, itemCategory, itemName, affectedArea, sourceUrl)
  incidentId: string;
  itemCategory: NeedItemCategory;
  itemName: string;
  quantityNeeded: number | null;
  unit: string | null;
  quantityReceived: number | null;
  quantityDistributed: number | null;
  quantityRemaining: number | null; // deterministic: needed - max(received, distributed); null when needed null
  priority: 'HIGH' | 'NORMAL' | null;
  beneficiaryGroup: string | null;
  affectedArea: string | null;
  status: NeedStatus;
  statusReason: string | null; // required when CLOSED
  sourceUrl: string | null;
  sourceOrganization: string | null;
  verificationStatus: VerificationStatus;
  reportedAt: string | null;
  lastUpdatedAt: string;
  isMock: boolean;
  schemaVersion: number;
  // Multi-source evidence (additive; existing fields preserved).
  sourceReferences?: Array<{
    source: 'NEWS_REPORT' | 'CITIZEN_REPORT' | 'FIELD_OFFICER_REPORT' | 'OFFICIAL_SOURCE' | 'GEOSPATIAL_SIGNAL' | 'POPULATION_SIGNAL' | 'SERVICE_DISRUPTION' | 'RULE_INFERENCE';
    triggerSignals?: Array<{ type: string; description: string }>;
    evidenceSummary?: string;
    observedAt?: string;
    lastEvaluatedAt?: string;
    validUntil?: string;
  }>;
  inferenceChain?: Array<{
    ruleId?: string;
    premise?: Array<{ type: string; description: string }>;
    conclusion?: string;
    confidence?: number;
    evaluatedAt?: string;
  }>;
}

/** Deterministic remaining computation. AI never does this arithmetic. */
export function remainingNeed(needed: number | null, received: number | null, distributed: number | null): number | null {
  if (needed == null) return null;
  const got = Math.max(received ?? 0, distributed ?? 0);
  return Math.max(0, needed - got);
}

// --- 5. incidentAidEvents (stages never conflated) ---
export type AidStage = 'ANNOUNCED' | 'DISPATCHED' | 'ARRIVED' | 'DISTRIBUTED';
export interface IncidentAidEventDoc {
  id: string; // stableId(incidentId, stage, itemName, quantity, unit, sourceUrl, eventTime)
  incidentId: string;
  articleId: string | null;
  aidStage: AidStage;
  itemCategory: NeedItemCategory;
  itemName: string;
  quantity: number | null;
  unit: string | null;
  estimatedValue: number | null;
  recipientOrDestination: string | null;
  location: string | null;
  distributingOrganization: string | null;
  sourceUrl: string | null;
  sourceOrganization: string | null;
  verificationStatus: VerificationStatus;
  eventTime: string | null;
  isMock: boolean;
  schemaVersion: number;
}

// --- 6. incidentPoskos (coords null unless validated) ---
export type CoordinateSource = 'OFFICIAL_CHECKPOINT' | 'SOURCE_STATED' | 'SEED_DEMO' | 'NONE';
export type PoskoDisplayKind = 'CONFIRMED_POINT' | 'APPROXIMATE_AREA' | 'LIST_ONLY';
export interface GeospatialSignal {
  id: string; // stableId('signal', type, incidentId, locationKey)
  incidentId: string;
  signalType: 'FLOOD_AREA' | 'LANDSLIDE_ZONE' | 'FIRE_PERIMETER' | 'EVACUATION_AREA' | 'DISEASE_RISK' | 'ROAD_CLOSURE' | 'BRIDGE_DAMAGE' | 'HEALTH_FACILITY' | 'WATER_SOURCE' | 'SHELTER_AREA' | 'OTHER';
  location: { lat: number; lng: number; radiusMeters?: number };
  resolvedAt: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  source: 'OFFICIAL_GEO' | 'CITIZEN_REPORT' | 'MODEL_PREDICTION' | 'SATELLITE' | 'OTHER';
  description: string;
  notes?: string;
}
export type PopulationSignal = {
  id: string;
  incidentId: string;
  estimatedPopulation: number | null;
  affectedPopulation: number | null;
  demographicBreakdown?: {
    childrenUnder5: number | null;
    pregnantWomen: number | null;
    elderly: number | null;
    disabled: number | null;
  };
  source: 'CENSUS' | 'REGISTRY' | 'CITIZEN_ESTIMATE' | 'OTHER';
  observedAt: string;
};
export type ServiceDisruption = {
  id: string;
  incidentId: string;
  serviceType: 'POWER' | 'COMMUNICATION' | 'ACCESS_TRANSPORT' | 'WATER' | 'HEALTH_FACILITY' | 'SANITATION';
  status: 'OUTAGE' | 'LIMITED' | 'INTERRUPTED' | 'RESTORED' | 'UNKNOWN';
  affectedArea: string | null;
  reportedAt: string;
  source: 'OFFICIAL' | 'CITIZEN_REPORT' | 'MODEL' | 'OTHER';
};
export interface IncidentPoskoDoc {
  id: string; // poskoId: source id or stableId(incidentId, name, area, sourceUrl)
  poskoId: string;
  incidentId: string;
  articleId: string | null;
  name: string;
  poskoType: 'COMMAND_POST' | 'EVACUATION_SHELTER' | 'FIELD_POST' | 'LOGISTICS_DEPOT' | 'UNKNOWN';
  address: string | null;
  village: string | null;
  district: string | null;
  regency: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinateSource: CoordinateSource;
  coordinateAccuracy: string | null;
  operationalStatus: string | null;
  capacity: number | null;
  currentOccupancy: number | null;
  availableFacilities: string[];
  neededSupplies: string[];
  contact: string | null; // public contacts from trusted sources only
  sourceUrl: string | null;
  sourceOrganization: string | null;
  verificationStatus: VerificationStatus;
  reportedAt: string | null;
  lastVerifiedAt: string | null;
  lastUpdatedAt: string;
  isMock: boolean;
  schemaVersion: number;
}

export function isValidCoordinate(lat: number | null, lng: number | null): boolean {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Pin only when coords validate AND source is not NONE. Admin areas → approximate; else list-only. */
export function poskoDisplayKind(p: Pick<IncidentPoskoDoc, 'latitude' | 'longitude' | 'coordinateSource' | 'village' | 'regency' | 'district'>): PoskoDisplayKind {
  if (isValidCoordinate(p.latitude, p.longitude) && p.coordinateSource !== 'NONE') return 'CONFIRMED_POINT';
  if (p.village || p.district || p.regency) return 'APPROXIMATE_AREA';
  return 'LIST_ONLY';
}

// --- 7. incidentRecovery (append-only history per service+area) ---
export type RecoveryServiceType = 'POWER' | 'TELECOMMUNICATIONS' | 'WASH' | 'ACCESS_TRANSPORT' | 'PUBLIC_FACILITIES';
export type RecoveryStatus =
  | 'OPERATIONAL' | 'PARTIAL_OUTAGE' | 'OUTAGE' | 'RESTORED'
  | 'LIMITED' | 'UNAVAILABLE' | 'AVAILABLE'
  | 'OPEN' | 'RESTRICTED' | 'CLOSED' | 'ALTERNATE_ROUTE'
  | 'PARTIALLY_DAMAGED' | 'DAMAGED_CLOSED'
  | 'UNKNOWN';
const STATUS_BY_SERVICE: Record<RecoveryServiceType, ReadonlySet<string>> = {
  POWER: new Set(['OPERATIONAL', 'PARTIAL_OUTAGE', 'OUTAGE', 'RESTORED', 'UNKNOWN']),
  TELECOMMUNICATIONS: new Set(['OPERATIONAL', 'PARTIAL_OUTAGE', 'OUTAGE', 'RESTORED', 'UNKNOWN']),
  WASH: new Set(['AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'RESTORED', 'UNKNOWN']),
  ACCESS_TRANSPORT: new Set(['OPEN', 'RESTRICTED', 'CLOSED', 'ALTERNATE_ROUTE', 'UNKNOWN']),
  PUBLIC_FACILITIES: new Set(['OPERATIONAL', 'PARTIALLY_DAMAGED', 'DAMAGED_CLOSED', 'RESTORED', 'UNKNOWN']),
};
export function isValidRecoveryStatus(service: RecoveryServiceType, status: string): boolean {
  return STATUS_BY_SERVICE[service]?.has(status) ?? false;
}
export interface RecoveryStatusEntry {
  status: RecoveryStatus;
  at: string;
  sourceUrl: string | null;
  sourceOrganization: string | null;
  note: string | null;
}
export interface IncidentRecoveryDoc {
  id: string; // `${incidentId}__${serviceType}__${areaKey}`
  incidentId: string;
  serviceType: RecoveryServiceType;
  affectedArea: string | null;
  affectedEntity: string | null;
  impactDescription: string | null;
  affectedCount: number | null;
  unit: string | null;
  /** Restored/functional count in the same unit. Null until sourced evidence
      provides it — never zero-filled, never inferred from statuses. Additive:
      documents written before this field exist remain valid without it. */
  restoredCount: number | null;
  /** Operational criterion the restored count was judged against (source
      wording or null). Absence surfaces as a validation warning downstream. */
  restorationCriterion: string | null;
  waterSafety: 'SAFE' | 'UNSAFE' | 'UNKNOWN' | null; // WASH only, source-backed
  estimatedRestorationAt: string | null; // sourced estimates only, never invented
  restoredAt: string | null;
  history: RecoveryStatusEntry[]; // append-only; current = last
  sourceUrl: string | null;
  sourceOrganization: string | null;
  verificationStatus: VerificationStatus;
  reportedAt: string | null;
  lastUpdatedAt: string;
  isMock: boolean;
  schemaVersion: number;
}
export function currentRecoveryStatus(doc: IncidentRecoveryDoc): RecoveryStatusEntry | null {
  return doc.history.length > 0 ? doc.history[doc.history.length - 1]! : null;
}
/** Append a status entry (pure — history preserved, never overwritten). Rejects invalid status/category pairs. */
export function appendRecoveryStatus(doc: IncidentRecoveryDoc, entry: RecoveryStatusEntry): IncidentRecoveryDoc {
  if (!isValidRecoveryStatus(doc.serviceType, entry.status)) {
    throw new Error(`Invalid status ${entry.status} for ${doc.serviceType}`);
  }
  return { ...doc, history: [...doc.history, entry], lastUpdatedAt: entry.at };
}

// --- 8. incidentCrawlRuns (1-day gate source of truth) ---
export const CRAWL_INTERVAL_MS = 1 * 24 * 3600_000;
export type CrawlOutcome = 'SUCCESS' | 'SUCCESS_EMPTY' | 'PROVIDER_FAILED' | 'GATED_SKIP';
export interface IncidentCrawlRunDoc {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  outcome: CrawlOutcome;
  lastSuccessAt: string | null; // last SUCCESS/SUCCESS_EMPTY before this run
  perIncident: Array<{ incidentId: string; fetched: number; matched: number; review: number; rejected: number }>;
  articlesNew: number;
  articlesUpdated: number;
  aiExtractions: number;
  errorCode: string | null; // safe code only, never bodies/headers
  schemaVersion: number;
}
/** Pure gate: crawl only when ≥1d since last success (missing history → due). */
export function isCrawlDue(lastSuccessAt: string | null, nowMs = Date.now()): boolean {
  if (!lastSuccessAt) return true;
  const t = Date.parse(lastSuccessAt);
  if (!Number.isFinite(t)) return true;
  return nowMs - t >= CRAWL_INTERVAL_MS;
}
