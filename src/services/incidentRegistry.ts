import { recentWindow } from './recentWindow';
import { allCurrentRecords, currentRecords } from '../data/currentIncidents';
// Incident registry: stable ids + relevance descriptors.
// Aliases/keywords come from each incident's OWN records — never generic `gempa` alone.
export interface IncidentDescriptor {
  incidentId: string;
  name: string;
  province: string;
  disasterType: 'earthquake' | 'flood' | 'fire' | 'landslide' | 'other';
  /** Location aliases that count as strong evidence (regency/city/villages from real records). */
  aliases: string[];
  /**
   * Broad single-word areas (e.g. 'Sumba', 'Bima', 'Lombok') that also match
   * neighboring regencies / different events. A broad-alias hit alone is never
   * sufficient for MATCHED — it needs distinctive supporting evidence.
   * Must be a subset of `aliases`. Province names must never appear here or in
   * `aliases`: province-only matching must not qualify an article.
   */
  broadAliases: string[];
  /** Distinctive non-location keywords (fault names, scale markers, program names). */
  keywords: string[];
  /** ISO event date when known; null for ongoing demo scenarios (date check skipped). */
  eventDate: string | null;
  /** Reporting window in days around eventDate (null = no date constraint). */
  windowDays: number | null;
}

const LEGACY_DESCRIPTORS: IncidentDescriptor[] = [
  {
    incidentId: 'cianjur',
    name: 'Cianjur & Sukabumi',
    province: 'Jawa Barat',
    disasterType: 'earthquake',
    aliases: ['Cianjur', 'Cugenang', 'Sukabumi', 'Gasol', 'Prawatasari'],
    broadAliases: ['Cianjur', 'Sukabumi'],
    keywords: ['Sesar Cugenang', 'Cugenang', 'Sayang Cianjur'],
    eventDate: null,
    windowDays: null,
  },
  {
    incidentId: 'lombok-2018-08-05',
    name: 'Lombok',
    province: 'Nusa Tenggara Barat',
    disasterType: 'earthquake',
    aliases: [
      'Lombok', 'Lombok Utara', 'Lombok Timur', 'Lombok Barat', 'Lombok Tengah',
      'Mataram', 'Rinjani', 'Gili', 'Tanjung', 'Pemenang',
    ],
    broadAliases: ['Lombok', 'Mataram', 'Gili'],
    keywords: ['Sesar Naik Flores', 'Flores Back Arc Thrust', 'MMI VIII', 'peringatan dini tsunami'],
    eventDate: '2018-08-05',
    windowDays: 3650,
  },
  {
    incidentId: 'ntt-sumba-barat-daya-2026-10-04',
    name: 'Sumba Barat Daya',
    province: 'Nusa Tenggara Timur',
    disasterType: 'earthquake',
    aliases: [
      'Sumba Barat Daya', 'Sumba', 'Kodi', 'Kodi Balaghar', 'Kodi Bangedo',
      'Tambolaka', 'Waikabubak', 'Waibakul', 'Perokonda', 'Bondo Kodi',
      'Waikadada', 'Weerena', 'Raba', 'Bima',
    ],
    broadAliases: ['Sumba', 'Bima', 'Raba'],
    keywords: ['Sesar Waikabubak', 'Waikabubak', 'M5,9', 'M6,1', '62 susulan', '62 gempa susulan'],
    eventDate: '2026-10-04',
    windowDays: 60,
  },
  {
    incidentId: 'palu',
    name: 'Palu & Donggala',
    province: 'Sulawesi Tengah',
    disasterType: 'earthquake',
    aliases: ['Palu', 'Donggala', 'Palu-Koro', 'Sulteng'],
    broadAliases: ['Sulteng'],
    keywords: ['Sesar Palu-Koro', 'likuifaksi'],
    eventDate: null,
    windowDays: null,
  },
  {
    incidentId: 'demak',
    name: 'Demak & Kudus',
    province: 'Jawa Tengah',
    disasterType: 'flood',
    aliases: ['Demak', 'Kudus', 'Karanganyar', 'Sungai Wulan', 'Tanggulangin'],
    broadAliases: ['Demak', 'Kudus'],
    keywords: ['Tanggul Sungai Wulan', 'Waduk Kedungombo'],
    eventDate: null,
    windowDays: null,
  },
  {
    incidentId: 'padang',
    name: 'Padang & Pesisir Selatan',
    province: 'Sumatera Barat',
    disasterType: 'flood',
    aliases: ['Padang', 'Pesisir Selatan', 'Kuranji', 'Batang Kuranji'],
    broadAliases: [],
    keywords: ['Galodo', 'Batang Kuranji'],
    eventDate: null,
    windowDays: null,
  },
  {
    incidentId: 'jayapura',
    name: 'Sentani, Jayapura',
    province: 'Papua',
    disasterType: 'flood',
    aliases: ['Sentani', 'Jayapura', 'Cycloop', 'Danau Sentani'],
    broadAliases: ['Jayapura'],
    keywords: ['Danau Sentani', 'Cycloop'],
    eventDate: null,
    windowDays: null,
  },
  {
    incidentId: 'banjar',
    name: 'Kec. Martapura, Kab. Banjar',
    province: 'Kalimantan Selatan',
    disasterType: 'fire',
    aliases: ['Martapura', 'Banjar', 'Karang Intan', 'Sungai Batang'],
    broadAliases: ['Banjar'],
    keywords: ['Manggala Agni', 'Karhutla Martapura'],
    eventDate: null,
    windowDays: null,
  },
  {
    incidentId: 'pekanbaru',
    name: 'Pekanbaru & Kampar',
    province: 'Riau',
    disasterType: 'fire',
    aliases: ['Pekanbaru', 'Kampar', 'Rimbo Panjang', 'Siak'],
    broadAliases: ['Pekanbaru', 'Siak'],
    keywords: ['Manggala Agni', 'gambut Kampar'],
    eventDate: null,
    windowDays: null,
  },
];

export const CURRENT_DESCRIPTORS: IncidentDescriptor[] = allCurrentRecords.filter(r => !r.id.startsWith('ntt-')).map(r => ({
  incidentId: r.id, name: r.name, province: r.province, disasterType: r.category,
  aliases: r.id === 'padang' ? ['Padang', ...r.aliases] : [...r.aliases], broadAliases: [], keywords: [], eventDate: r.startDate ?? r.date, windowDays: 12,
}));
export const INCIDENT_DESCRIPTORS: IncidentDescriptor[] = [
  ...CURRENT_DESCRIPTORS,
  ...LEGACY_DESCRIPTORS.filter(d => !CURRENT_DESCRIPTORS.some(c => c.incidentId === d.incidentId)),
];
export const ACTIVE_NEWS_IDS = currentRecords.map(r => r.id);

export function descriptorFor(incidentId: string): IncidentDescriptor | null {
  return INCIDENT_DESCRIPTORS.find((d) => d.incidentId === incidentId) ?? null;
}

const TYPE_WORDS: Record<IncidentDescriptor['disasterType'], RegExp> = {
  earthquake: /gempa|gempabumi|sesar|magnitudo|\bM\s?\d/i,
  flood: /banjir|genangan|tanggul|luapan/i,
  fire: /karhutla|kebakaran (?:hutan|lahan)|kabut asap|asap karhutla|hotspot|titik (?:api|panas)/i,
  landslide: /longsor|gerakan tanah/i,
  other: /bencana|kekeringan|cuaca ekstrem|angin kencang|abrasi|erupsi/i,
};

/** Incident-specific search queries (location + type + aid/posko/official angles). */
export function buildIncidentQueries(d: IncidentDescriptor, now = Date.now()): string[] {
  const raw = d.aliases[0] ?? d.name;
  // Quote multi-word places so the provider prioritizes the exact incident location.
  const loc = raw.includes(' ') ? `"${raw}"` : raw;
  const typeWord =
    d.disasterType === 'earthquake' ? 'gempa' : d.disasterType === 'flood' ? 'banjir' : d.disasterType === 'fire' ? 'karhutla' : d.disasterType === 'landslide' ? 'longsor' : 'bencana kekeringan';
  const window = recentWindow(now);
  const dates = ` after:${window.afterDate} before:${window.beforeDate}`;
  return [
    `${loc} ${typeWord}${dates}`,
    `${loc} ${typeWord} (site:detik.com OR site:rri.co.id OR site:tvrinews.com)${dates}`,
    `${loc} ${typeWord} (site:antaranews.com OR site:kompas.com OR site:bnpb.go.id)${dates}`,
    `${loc} ${typeWord} (kebutuhan OR kekurangan OR bantuan OR pengungsi)${dates}`,
    `${loc} ${typeWord} ("air bersih" OR makanan OR obat OR tenda OR evakuasi)${dates}`,
    `${loc} ${typeWord} (listrik OR jalan OR jembatan OR telekomunikasi OR pemulihan)${dates}`,
  ];
}

export function typeWordPresent(d: IncidentDescriptor, text: string): boolean {
  return TYPE_WORDS[d.disasterType].test(text);
}
