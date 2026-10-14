// DisasterWatch intelligence domain model.
// Additive layer — legacy `DisasterIncident` in src/types.ts stays canonical for UI.
// New types power: Report → Gemini extraction → validation → impact/needs → aid gap.

export type SourceType = 'official' | 'citizen' | 'media' | 'field' | 'aid' | 'internet' | 'social';

export type VerificationStatus = 'UNVERIFIED' | 'AI_REVIEWED' | 'VERIFIED' | 'CONFLICTING' | 'REJECTED';

export type DisasterType = 'fire' | 'flood' | 'earthquake' | 'landslide' | 'other';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ExtractedNeed {
  /** Normalised need key, e.g. clean_water, food, medicine, shelter, mask, boat */
  category: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string;
}

export interface AIExtraction {
  disasterType: DisasterType;
  locationName: string;
  affectedHouseholds?: number | null;
  affectedPopulation?: number | null;
  infrastructureDamage: string[];
  needs: ExtractedNeed[];
  urgency: UrgencyLevel;
  /** 0..1 — AI-generated confidence, NOT official verification */
  confidence: number;
  isDuplicate?: boolean;
  conflictNotes?: string;
}

export interface IntelligenceReport {
  reporterUid?: string;
  id: string;
  disasterId?: string;
  sourceType: SourceType;
  sourceName: string;
  rawText: string;
  mediaUrl?: string;
  sourceUrl?: string;
  newsInsight?: string;
  newsCategory?: import('../types').NewsCategory;
  location: {
    name: string;
    lat?: number;
    lng?: number;
  };
  createdAt: string; // ISO
  verificationStatus: VerificationStatus;
  aiConfidence?: number;
  extractedData?: AIExtraction;
  isMock: boolean;
}

export interface AidRecord {
  id: string;
  disasterId: string;
  needCategory: string;
  quantity: number;
  unit: string;
  sourceName: string;
  receivedAt: string; // ISO
  isMock: boolean;
}

export interface NeedEstimate {
  category: string;
  label: string;
  estimated: number;
  received: number;
  unit: string;
  gap: number;
  gapPct: number;
}

export interface UserIdentity {
  uid: string;
  isAnonymous: boolean;
  displayName?: string;
  email?: string;
  photoURL?: string;
  isMock: boolean;
}

export const NEED_LABELS: Record<string, string> = {
  clean_water: 'Air Bersih',
  food: 'Makanan',
  medicine: 'Obat & Medis',
  shelter: 'Tempat Tinggal',
  mask: 'Masker N95',
  boat: 'Perahu / Evakuasi',
  genset: 'Genset / Listrik',
  clothing: 'Pakaian',
};

export function needLabel(category: string): string {
  return NEED_LABELS[category] ?? category.replace(/_/g, ' ');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
