// Shared incident-detail domain model (additive; existing types untouched).
// Every metric carries provenance — never present demo/unverified as official.

export type MetricProvenance = 'OFFICIAL' | 'REPORTED' | 'ESTIMATED' | 'DEMO' | 'UNAVAILABLE';

export type RelevanceStatus = 'MATCHED' | 'REVIEW_REQUIRED' | 'REJECTED';

/** Persisted card-only English localization. Source fields remain authoritative. */
export interface IncidentArticleTranslation {
  language: 'en';
  status: 'translated' | 'failed';
  titleStatus?: 'translated' | 'failed' | 'original';
  summaryStatus?: 'translated' | 'failed' | 'original';
  title: string | null;
  summary: string | null;
  sourceTitle: string;
  sourceSummary: string | null;
  sourceLanguage: 'id' | 'en' | 'unknown';
  fingerprint: string;
  translatedAt: string | null;
  model: string | null;
  promptVersion: string;
  errorCode?: string;
}

/** Raw candidate article before/after classification. Nullable when unknown — never invented. */
export interface IncidentArticle {
  url: string;
  title: string;
  sourceName: string;
  sourceType: 'OFFICIAL' | 'NEWS_MEDIA' | 'OTHER';
  publishedAt: string | null;
  /** For source documentation cards; never used as publication date. */
  eventDate?: string;
  retrievedAt: string;
  summary: string | null;
  englishTranslation?: IncidentArticleTranslation;
  contentStatus: 'FULL' | 'PARTIAL' | 'METADATA_ONLY' | 'FAILED';
  /** Explicit link (e.g. NTT caseId) when the source record already declares it. */
  incidentId: string | null;
  discoveredBy: string;
  googleSearchSuggestions?: string | null;
  incidentRelevance?: {
    incidentId: string;
    status: RelevanceStatus;
    score: number;
    matchedAliases: string[];
    matchedKeywords: string[];
    reason: string;
    classifiedAt: string;
  };
}

export type AidDistributionStatus =
  | 'REPORTED_DISTRIBUTED'
  | 'REPORTED_RECEIVED'
  | 'REPORTED_DISPATCHED'
  | 'REPORTED_NEEDED'
  | 'UNKNOWN';

/**
 * A REPORTED distribution event — evidence that an org reportedly moved aid.
 * NOT current inventory. Never subtract from needs automatically.
 */
export interface AidEventRecord {
  aidId: string;
  incidentId: string;
  articleId: string | null;
  aidType: string;
  quantity: number | null;
  unit: string | null;
  estimatedValue: number | null;
  recipientOrDestination: string | null;
  location: string | null;
  distributingOrganization: string | null;
  distributionStatus: AidDistributionStatus;
  eventTime: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  verificationStatus: 'UNVERIFIED' | 'AI_REVIEWED' | 'VERIFIED' | 'CONFLICTING' | 'REJECTED';
  recordKind: 'REPORTED_EVENT';
  isMock: boolean;
}

export type PoskoType = 'COMMAND_POST' | 'EVACUATION_SHELTER' | 'FIELD_POST' | 'LOGISTICS_DEPOT' | 'UNKNOWN';

/** Posko/evacuation point. Coords stay null unless from a reliable source — never geocoded silently. */
export interface PoskoRecord {
  poskoId: string;
  incidentId: string;
  articleId: string | null;
  name: string;
  poskoType: PoskoType;
  address: string | null;
  village: string | null;
  regency: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  coordSource: 'OFFICIAL_CHECKPOINT' | null;
  contact: string | null;
  capacity: number | null;
  occupancy: number | null;
  operationalStatus: string | null;
  lastUpdatedAt: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  verificationStatus: 'UNVERIFIED' | 'AI_REVIEWED' | 'VERIFIED' | 'CONFLICTING' | 'REJECTED';
  isMock: boolean;
}

/** Map markers only for posko with verified coordinates. */
export function poskoMapMarkers(posko: PoskoRecord[]): Array<{ id: string; lat: number; lng: number; name: string }> {
  return posko.flatMap((p) =>
    typeof p.latitude === 'number' && typeof p.longitude === 'number'
      ? [{ id: p.poskoId, lat: p.latitude, lng: p.longitude, name: p.name }]
      : [],
  );
}

/** Official event parameter revision (e.g. BMKG initial vs updated). Revisions are never merged. */
export interface OfficialParam {
  label: string;
  value: string;
  revision: string | null;
  reportedAt: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
}

/**
 * A factual claim with its verification status preserved — a reported claim is
 * never promoted to a verified fact during refactor or display.
 */
export interface ClaimRef {
  claimId: string;
  claimType: string;
  claimText: string;
  location: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  verificationStatus: 'UNVERIFIED' | 'AI_REVIEWED' | 'VERIFIED' | 'CONFLICTING' | 'REJECTED';
}

/** Common detail data every incident adapter must supply. */
export interface IncidentDetailData {
  incidentId: string;
  provenance: {
    cost: MetricProvenance;
    impact: MetricProvenance;
    recovery: MetricProvenance;
    casualties: MetricProvenance;
    aid: MetricProvenance;
    posko: MetricProvenance;
  };
  provenanceNote: string;
  articles: IncidentArticle[];
  aidEvents: AidEventRecord[];
  posko: PoskoRecord[];
  /** Official parameters (empty when unavailable — same empty treatment as other sections). */
  officialParams: OfficialParam[];
  /** Extracted claims with verification status (conflicts kept visible, never merged). */
  claims: ClaimRef[];
  /** Aid needs from Firestore (null quantities preserved; dedicated panel is future work). */
  needs: import('./humanitarian').IncidentAidNeedDoc[];
  crawl: { lastAttemptAt: string | null; lastSuccessAt: string | null; error: string | null };
}
