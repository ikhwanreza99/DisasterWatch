// Shared incident-detail domain model (additive; existing types untouched).
// Every metric carries provenance — never present demo/unverified as official.

export type MetricProvenance = 'OFFICIAL' | 'REPORTED' | 'ESTIMATED' | 'DEMO' | 'UNAVAILABLE';

export type RelevanceStatus = 'MATCHED' | 'REVIEW_REQUIRED' | 'REJECTED';

/** Raw candidate article before/after classification. Nullable when unknown — never invented. */
export interface IncidentArticle {
  url: string;
  title: string;
  sourceName: string;
  sourceType: 'OFFICIAL' | 'NEWS_MEDIA' | 'OTHER';
  publishedAt: string | null;
  retrievedAt: string;
  summary: string | null;
  contentStatus: 'FULL' | 'PARTIAL' | 'METADATA_ONLY' | 'FAILED';
  /** Explicit link (e.g. NTT caseId) when the source record already declares it. */
  incidentId: string | null;
  discoveredBy: string;
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
  verificationStatus: 'UNVERIFIED' | 'AI_REVIEWED' | 'VERIFIED' | 'CONFLICTING';
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
  verificationStatus: 'UNVERIFIED' | 'AI_REVIEWED' | 'VERIFIED' | 'CONFLICTING';
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
  crawl: { lastAttemptAt: string | null; lastSuccessAt: string | null; error: string | null };
}
