// Incident registry: stable ids + relevance descriptors.
// Aliases/keywords come from each incident's OWN records — never generic `gempa` alone.
export interface IncidentDescriptor {
  incidentId: string;
  name: string;
  province: string;
  disasterType: 'earthquake' | 'flood' | 'fire' | 'landslide' | 'other';
  /** Location aliases that count as strong evidence (regency/city/villages from real records). */
  aliases: string[];
  /** Distinctive non-location keywords (fault names, scale markers, program names). */
  keywords: string[];
  /** ISO event date when known; null for ongoing demo scenarios (date check skipped). */
  eventDate: string | null;
  /** Reporting window in days around eventDate (null = no date constraint). */
  windowDays: number | null;
}

export const INCIDENT_DESCRIPTORS: IncidentDescriptor[] = [
  {
    incidentId: 'cianjur',
    name: 'Cianjur & Sukabumi',
    province: 'Jawa Barat',
    disasterType: 'earthquake',
    aliases: ['Cianjur', 'Cugenang', 'Sukabumi', 'Gasol', 'Prawatasari'],
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
    keywords: ['Manggala Agni', 'gambut Kampar'],
    eventDate: null,
    windowDays: null,
  },
];

export function descriptorFor(incidentId: string): IncidentDescriptor | null {
  return INCIDENT_DESCRIPTORS.find((d) => d.incidentId === incidentId) ?? null;
}

const TYPE_WORDS: Record<IncidentDescriptor['disasterType'], RegExp> = {
  earthquake: /gempa|gempabumi|sesar|magnitudo|\bM\s?\d/i,
  flood: /banjir|genangan|tanggul|luapan/i,
  fire: /kebakaran|karhutla|api|asap|hotspot/i,
  landslide: /longsor|gerakan tanah/i,
  other: /bencana/i,
};

/** Incident-specific search queries (location + type + aid/posko/official angles). */
export function buildIncidentQueries(d: IncidentDescriptor): string[] {
  const loc = d.aliases[0] ?? d.name;
  const typeWord =
    d.disasterType === 'earthquake' ? 'gempa' : d.disasterType === 'flood' ? 'banjir' : d.disasterType === 'fire' ? 'karhutla' : 'bencana';
  return [
    `${loc} ${typeWord} dampak kerusakan`,
    `${loc} ${typeWord} bantuan logistik posko pengungsian`,
    `${loc} ${typeWord} BPBD BNPB update`,
  ];
}

export function typeWordPresent(d: IncidentDescriptor, text: string): boolean {
  return TYPE_WORDS[d.disasterType].test(text);
}
