export type DisasterCategory = 'fire' | 'flood' | 'earthquake';

export interface DisasterCheckpoint {
  id: number;
  title: string;
  subtitle: string;
  tag: string;
  tagClass: string;
  badgeColor: string;
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
}

export interface DisasterGuide {
  title: string;
  cause: string;
  hazards: string;
  safeRadius: string;
  protocols: string[];
  evacRoute: string;
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
