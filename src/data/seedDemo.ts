// Polished flood demo scenario: 1 disaster (Demak) + 4 locations with reports + aid.
// Clearly labeled MOCK data — never present as live BNPB/BMKG feed.
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';

export const DEMO_SCENARIO_ID = 'demak';
export const DEMO_SCENARIO_LABEL = 'Skenario Demo: Banjir Demak & Kudus (MOCK)';

export const demoReports: IntelligenceReport[] = [
  {
    id: 'REP-DEMO-01',
    disasterId: 'demak',
    sourceType: 'citizen',
    sourceName: 'Warga Karanganyar (Ibu Siti)',
    rawText:
      'Air mulai masuk ke rumah warga di Desa Karanganyar. Sekitar 200 keluarga terdampak. Jembatan menuju desa tidak bisa dilewati. Warga membutuhkan air bersih dan makanan.',
    location: { name: 'Karanganyar, Demak', lat: -6.8944, lng: 110.6385 },
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    verificationStatus: 'VERIFIED',
    aiConfidence: 0.86,
    extractedData: {
      disasterType: 'flood',
      locationName: 'Karanganyar, Demak',
      affectedHouseholds: 200,
      affectedPopulation: 800,
      infrastructureDamage: ['jembatan tidak bisa dilewati', 'rumah terdampak genangan'],
      needs: [
        { category: 'clean_water', quantity: null, unit: null },
        { category: 'food', quantity: null, unit: null },
      ],
      urgency: 'high',
      confidence: 0.86,
    },
    isMock: true,
  },
  {
    id: 'REP-DEMO-02',
    disasterId: 'demak',
    sourceType: 'field',
    sourceName: 'TRC BPBD Jateng',
    rawText:
      'Tanggul Sungai Wulan jebol 25 meter di Km 3. Genangan 1,8 meter, 120 KK mengungsi ke Jembatan Tanggulangin. Butuh 2500 karung pasir, pompa sedot, dan perahu karet.',
    location: { name: 'Tanggul Sungai Wulan Km 3', lat: -6.901, lng: 110.645 },
    createdAt: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    verificationStatus: 'VERIFIED',
    aiConfidence: 0.91,
    extractedData: {
      disasterType: 'flood',
      locationName: 'Tanggul Sungai Wulan Km 3',
      affectedHouseholds: 120,
      affectedPopulation: 480,
      infrastructureDamage: ['tanggul jebol', 'akses jalan terputus'],
      needs: [
        { category: 'boat', quantity: 4, unit: 'unit' },
        { category: 'food', quantity: null, unit: null },
      ],
      urgency: 'critical',
      confidence: 0.91,
    },
    isMock: true,
  },
  {
    id: 'REP-DEMO-03',
    disasterId: 'demak',
    sourceType: 'citizen',
    sourceName: 'Relawan Kudus',
    rawText:
      'Posko Terminal Kudus menampung 90 keluarga. Air minum menipis, bayi butuh susu dan obat diare. Jalan pantura masih bisa dilewati truk.',
    location: { name: 'Terminal Induk Kudus (Posko)', lat: -6.813, lng: 110.841 },
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    verificationStatus: 'AI_REVIEWED',
    aiConfidence: 0.78,
    extractedData: {
      disasterType: 'flood',
      locationName: 'Terminal Induk Kudus',
      affectedHouseholds: 90,
      affectedPopulation: 360,
      infrastructureDamage: [],
      needs: [
        { category: 'clean_water', quantity: null, unit: null },
        { category: 'medicine', quantity: null, unit: null },
        { category: 'food', quantity: null, unit: null },
      ],
      urgency: 'high',
      confidence: 0.78,
    },
    isMock: true,
  },
  {
    id: 'REP-DEMO-04',
    disasterId: 'demak',
    sourceType: 'aid',
    sourceName: 'PMI Semarang',
    rawText:
      'Distribusi tahap 1 ke Karanganyar: 7000 liter air bersih dan 950 paket makanan disalurkan. Kebutuhan lanjutan masih besar untuk 800 jiwa.',
    location: { name: 'Karanganyar, Demak', lat: -6.8944, lng: 110.6385 },
    createdAt: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
    verificationStatus: 'VERIFIED',
    aiConfidence: 0.88,
    extractedData: {
      disasterType: 'flood',
      locationName: 'Karanganyar, Demak',
      affectedHouseholds: 200,
      affectedPopulation: 800,
      infrastructureDamage: ['rumah terdampak genangan'],
      needs: [
        { category: 'clean_water', quantity: null, unit: null },
        { category: 'food', quantity: null, unit: null },
      ],
      urgency: 'high',
      confidence: 0.88,
    },
    isMock: true,
  },
];

export const demoAid: AidRecord[] = [
  { id: 'AID-DEMO-01', disasterId: 'demak', needCategory: 'clean_water', quantity: 7000, unit: 'L', sourceName: 'PMI Semarang', receivedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), isMock: true },
  { id: 'AID-DEMO-02', disasterId: 'demak', needCategory: 'food', quantity: 950, unit: 'paket', sourceName: 'Dapur Umum Tagana', receivedAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(), isMock: true },
  { id: 'AID-DEMO-03', disasterId: 'demak', needCategory: 'boat', quantity: 2, unit: 'unit', sourceName: 'Basarnas Semarang', receivedAt: new Date(Date.now() - 1000 * 60 * 100).toISOString(), isMock: true },
  { id: 'AID-DEMO-04', disasterId: 'demak', needCategory: 'medicine', quantity: 120, unit: 'paket', sourceName: 'Dinkes Demak', receivedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(), isMock: true },
];
