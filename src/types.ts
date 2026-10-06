export type DisasterCategory = 'fire' | 'flood' | 'earthquake';
/** Category dock filter: one category, all of them, or none (all incident markers hidden). */
export type CategoryFilter = DisasterCategory | 'all' | 'none';

export interface DisasterCheckpoint {
  id: number;

  // Posko bantuan fields
  name?: string;
  location?: string;
  capacity?: {
    used: number;
    total: number;
  };
  capacityStatus?: 'Tersedia' | 'Padat' | 'Hampir Penuh' | 'Penuh' | 'Belum Ada Data';
  aid?: {
    name: string;
    quantity: string;
  }[];
  googleMapsUrl?: string;

  // Legacy route fields kept optional so existing disaster data remains compatible.
  title?: string;
  subtitle?: string;
  tag?: string;
  tagClass?: string;
  badgeColor?: string;
  lat?: number;
  lng?: number;
}

export interface SupplyItem {
  code: string;
  name: string;
  subtitle: string;
  status: 'Dibutuhkan' | 'Terpenuhi';
  urgency: 'Urgensi Tinggi' | 'Urgensi Rendah';
  icon: string;
}

export type NewsCategory = 'positive' | 'negative' | 'needs';

export interface CitizenReport {
  id: string;
  location: string;
  title?: string;
  desc: string;
  time: string;
  author: string;
  tag: string;
  tagClass: string;
  photoUrl?: string;
  photoAlt?: string;
  newsCategory?: NewsCategory;
  newsInsight?: string;
  sourceType?: import('./domain/intelligence').SourceType;
  sourceName?: string;
  sourceUrl?: string;
}

export interface DisasterGuide {
  title: string;
  cause: string;
  hazards: string;
  safeRadius: string;
  protocols: string[];
  evacRoute: string;
}

export interface RecoveryService {
  type: 'water' | 'electricity' | 'access' | 'telecommunication';
  recovery: number;
  status: 'Terganggu' | 'Dalam Pemulihan' | 'Hampir Pulih' | 'Pulih';
}

export interface DisasterIncident {
  id: string;
  category: DisasterCategory;
  name: string;
  province: string;
  fullName: string;
  fullTitleDisplay: string;
  urgency: string;
  urgencyClass: string;
  impact: string;
  cost: string;
  gapRecovery: string;
  recoveryPct: number;
  recoveryServices: RecoveryService[];
  coords: { top?: string; left?: string; lat: number; lng: number };
  timestamp: string;
  photoUrl: string;
  photoAlt: string;
  photoSource: string;
  stats: {
    hotspots: string;
    hotspotsChange: string;
    loss: string;
    lossChange: string;
    personnel: string;
    personnelChange: string;
  };
  guide: DisasterGuide;
  supplies: SupplyItem[];
  route: {
    distance: string;
    duration: string;
    convoy: string;
    statusBadge: string;
    checkpoints: DisasterCheckpoint[];
  };
  reports: CitizenReport[];
}

