// NTT case seed — REAL retrieved sources only (retrieved 2026-10-11).
// BMKG event page was fetched in full (FULL). Others are search-discovery metadata
// (METADATA_ONLY): title/url/publishedAt from live search highlights; body NOT fetched.
// Never invent authors, timestamps, or article content. Missing => null.
import {
  NTT_CASE_ID,
  articleIdFromUrlSync,
  canonicalUrl,
  type CaseArticle,
  type CaseClaim,
  type NttCase,
} from '../domain/nttCase';

const RETRIEVED_AT = '2026-10-11T00:00:00.000Z';

export const nttCaseSeed: NttCase = {
  caseId: NTT_CASE_ID,
  title: 'Gempa Bumi Sumba Barat Daya, NTT — 4 Oktober 2026',
  eventDate: '2026-10-04',
  originTimeWib: '05:55:52',
  sourceUrl: 'https://www.bmkg.go.id/gempabumi/20261004055834',
  tsunamiAssessment: 'Tidak berpotensi tsunami (BMKG, kedua revisi)',
  isMajorDisaster: false,
  classificationNote:
    'Direpresentasikan sebagai insiden gempa bumi, bukan "bencana kemanusiaan besar" — bukti saat ini: kerusakan rumah/fasum terbatas dan 1 luka ringan (BNPB), belum ada dasar untuk klasifikasi lebih tinggi.',
  revisions: [
    {
      revision: 'initial',
      sourceUrl: 'https://www.bmkg.go.id/gempabumi/20261004055834',
      sourceLabel: 'BMKG — parameter awal (rilis 05:58:34 WIB)',
      reportedAt: '2026-10-04T05:58:34+07:00',
      retrievedAt: RETRIEVED_AT,
      magnitude: 6.1,
      depthKm: 10,
      latitude: -9.7,
      longitude: 118.92,
      locationText: '30 km barat daya Sumba Barat Daya, NTT',
      tsunamiAssessment: 'Tidak berpotensi tsunami',
    },
    {
      revision: 'update',
      sourceUrl: 'https://www.bmkg.go.id/gempabumi/20261004055834',
      sourceLabel: 'BMKG — siaran pers update (parameter update)',
      reportedAt: null,
      retrievedAt: RETRIEVED_AT,
      magnitude: 5.9,
      depthKm: 30,
      latitude: -9.84,
      longitude: 118.9,
      locationText: '59 km barat daya Kodi, Sumba Barat Daya (di laut)',
      tsunamiAssessment: 'TIDAK BERPOTENSI TSUNAMI (pemodelan)',
    },
  ],
  status: 'MONITORING_AFTERSHOCKS',
  lastCrawlAt: RETRIEVED_AT,
  lastUpdatedAt: RETRIEVED_AT,
  isMock: false,
};

interface SeedDef {
  sourceName: string;
  sourceType: 'OFFICIAL' | 'NEWS_MEDIA' | 'OTHER';
  title: string;
  url: string;
  publishedAt: string | null;
  author: string | null;
  summary: string | null;
  originalSnippet: string | null;
  contentStatus: 'FULL' | 'PARTIAL' | 'METADATA_ONLY' | 'FAILED';
  discoveredBy: string;
  locationMentions: string[];
  topics: string[];
  verificationStatus: 'UNVERIFIED' | 'AI_REVIEWED' | 'VERIFIED' | 'CONFLICTING';
  verificationNotes: string;
  caseLinkConfidence: number;
}

const SEEDS: SeedDef[] = [
  {
    sourceName: 'BMKG — Halaman Event Gempabumi',
    sourceType: 'OFFICIAL',
    title: 'Gempa Bumi M6,1 – 30 km BaratDaya SUMBABARATDAYA-NTT (parameter update M5,9)',
    url: 'https://www.bmkg.go.id/gempabumi/20261004055834',
    publishedAt: '2026-10-04T05:58:34+07:00',
    author: null,
    summary:
      'Halaman resmi BMKG: parameter awal M6,1 / 10 km di 9,70 LS–118,92 BT; siaran pers update M5,9 / 30 km di 9,84 LS–118,90 BT (59 km barat daya Kodi, di laut), mekanisme normal fault asosiasi Sesar Waikabubak; intensitas VI MMI (Kodi Balaghar, Kodi Bangedo, Kodi), IV MMI (Tambolaka, Waikabubak, Waibakul, Raba), III MMI (Bima); 62 aftershock M1,5–M4,3 s.d. 08:05 WIB; informasi kerusakan bangunan warga dan sekolah di Desa Perokonda, Kec. Kodi; TIDAK BERPOTENSI TSUNAMI.',
    originalSnippet:
      'Hasil analisis BMKG menunjukkan gempa bumi ini memiliki parameter update dengan magnitudo M5,9 pada kedalaman 30 km. Episenter … 9,84° LS ; 118,90° BT … 59 km barat daya Kodi … TIDAK BERPOTENSI TSUNAMI.',
    contentStatus: 'FULL',
    discoveredBy: 'bmkg-direct-fetch (WebFetch 2026-10-11, full page retrieved)',
    locationMentions: ['Sumba Barat Daya', 'Kodi', 'Kodi Balaghar', 'Kodi Bangedo', 'Tambolaka', 'Waikabubak', 'Waibakul', 'Raba', 'Bima', 'Desa Perokonda'],
    topics: ['official_parameters', 'tsunami_assessment', 'shaking', 'aftershocks', 'damage'],
    verificationStatus: 'VERIFIED',
    verificationNotes: 'Sumber resmi BMKG, diambil penuh. Parameter awal vs update dipertahankan terpisah.',
    caseLinkConfidence: 1,
  },
  {
    sourceName: 'BMKG — Siaran Pers',
    sourceType: 'OFFICIAL',
    title: 'Gempa Sumba Barat Daya Tak Berpotensi Tsunami, BMKG Imbau Warga Waspadai Bangunan Retak',
    url: 'https://www.bmkg.go.id/siaran-pers/gempa-sumba-barat-daya-tak-berpotensi-tsunami-bmkg-imbau-warga-waspadai-bangunan-retak',
    publishedAt: null,
    author: null,
    summary:
      'Siaran pers BMKG 4 Okt 2026: tektonik M6,1 (update M5,9), 05:55:52 WIB, episenter 9,84 LS–118,90 BT (±59 km barat daya Kodi, 30 km), sesar Waikabubak normal fault; VI MMI Kodi area, IV MMI Tambolaka/Waikabubak/Waibakul/Raba, III MMI Bima; 62 susulan M1,5–M4,3 s.d. 08:05 WIB; kerusakan rumah warga + sekolah di Desa Perokonda; 1 luka ringan (laporan sementara s.d. 08:40 WIB).',
    originalSnippet: null,
    contentStatus: 'METADATA_ONLY',
    discoveredBy: 'websearch-discovery 2026-10-11 (ZAPI crawler unavailable: missing ZAPI_API_KEY)',
    locationMentions: ['Sumba Barat Daya', 'Kodi', 'Tambolaka', 'Bima', 'Desa Perokonda'],
    topics: ['official_update', 'shaking', 'aftershocks', 'damage', 'casualties'],
    verificationStatus: 'VERIFIED',
    verificationNotes: 'Domain resmi bmkg.go.id; isi penuh belum diambil — angka mengikuti cuplikan hasil pencarian.',
    caseLinkConfidence: 0.95,
  },
  {
    sourceName: 'BMKG — Analisis Spektral',
    sourceType: 'OFFICIAL',
    title: 'Analisis Spektral Gempabumi Kodi, Sumba Barat Daya 4 Oktober 2026',
    url: 'https://www.bmkg.go.id/seismologi-teknik/analisis-spektral/analisis-spektral-gempabumi-kodi-sumba-barat-daya-4-oktober-2026',
    publishedAt: null,
    author: null,
    summary:
      'Analisis teknik BMKG: M6,1 (update M5,9) di 9,84 LS–118,90 BT, ±29 km barat daya Kodi, kedalaman 30 km; sinyal akselerograf stasiun KBSSI, WBSI, USTI; respons spektra umumnya di bawah spektrum desain SNI 1726:2019 kecuali komponen HNN KBSSI pada tanah lunak (potensi risiko bangunan tingkat rendah).',
    originalSnippet: null,
    contentStatus: 'METADATA_ONLY',
    discoveredBy: 'websearch-discovery 2026-10-11 (ZAPI crawler unavailable: missing ZAPI_API_KEY)',
    locationMentions: ['Kodi', 'Sumba Barat Daya'],
    topics: ['official_update', 'technical_analysis'],
    verificationStatus: 'VERIFIED',
    verificationNotes: 'Domain resmi bmkg.go.id; isi penuh belum diambil.',
    caseLinkConfidence: 0.95,
  },
  {
    sourceName: 'BNPB',
    sourceType: 'OFFICIAL',
    title: 'Gempa M6,1 Guncang Sumba Barat Daya, 20 Rumah Terdampak',
    url: 'https://bnpb.go.id/berita/gempa-m61-guncang-sumba-barat-daya-20-rumah-terdampak',
    publishedAt: '2026-10-04T13:54:00+07:00',
    author: 'PUSDATINKOM BNPB',
    summary:
      'BNPB 4 Okt 2026 13:54 WIB: gempa M6,1 pukul 05:55 WIB (06:55 WITA), parameter awal BMKG 9,70 LS–118,92 BT ±14 km barat daya Kodi kedalaman 10 km, tidak berpotensi tsunami; pendataan sementara: 20 unit rumah terdampak di SBD (19 rusak ringan, 1 rusak sedang) tersebar antara lain Desa Waikadada, Weerena, Bondo Kodi, Homba Karipit; 1 luka ringan tertimpa reruntuhan, rawat jalan.',
    originalSnippet: null,
    contentStatus: 'METADATA_ONLY',
    discoveredBy: 'websearch-discovery 2026-10-11 (ZAPI crawler unavailable: missing ZAPI_API_KEY)',
    locationMentions: ['Sumba Barat Daya', 'Kodi', 'Waikadada', 'Weerena', 'Bondo Kodi'],
    topics: ['damage', 'casualties', 'official_statement'],
    verificationStatus: 'VERIFIED',
    verificationNotes: 'Sumber resmi BNPB; angka = pendataan sementara lapangan via Kordalops, dapat berubah.',
    caseLinkConfidence: 0.95,
  },
  {
    sourceName: 'Kompas.com',
    sourceType: 'NEWS_MEDIA',
    title: 'Gempa Magnitudo 6,1 Guncang Sumba Barat Daya NTT, BMKG: Tidak Berpotensi Tsunami',
    url: 'https://regional.kompas.com/read/2026/10/04/072715378/gempa-magnitudo-61-guncang-sumba-barat-daya-ntt-bmkg-tidak-berpotensi',
    publishedAt: '2026-10-04T00:27:15.000Z',
    author: null,
    summary:
      'Kompas melaporkan gempa M6,1 di Kodi SBD 4 Okt 2026 05:55:52 WIB (04:55:52 WITA versi artikel), pusat awal 9,70 LS–118,92 BT ±14 km barat daya Kodi kedalaman 10 km; parameter terbaru M5,9 / 30 km di 9,84 LS–118,90 BT ±29 km barat daya Kodi; tidak berpotensi tsunami.',
    originalSnippet: null,
    contentStatus: 'METADATA_ONLY',
    discoveredBy: 'websearch-discovery 2026-10-11 (ZAPI crawler unavailable: missing ZAPI_API_KEY)',
    locationMentions: ['Kodi', 'Sumba Barat Daya'],
    topics: ['shaking', 'official_parameters'],
    verificationStatus: 'AI_REVIEWED',
    verificationNotes: 'Media mengutip BMKG; zona waktu WITA pada artikel vs WIB resmi — dipertahankan apa adanya.',
    caseLinkConfidence: 0.9,
  },
  {
    sourceName: 'CNN Indonesia',
    sourceType: 'NEWS_MEDIA',
    title: 'Update Gempa M 6,1 Sumba Barat Daya: 20 Rumah Rusak, 1 Warga Luka',
    url: 'https://www.cnnindonesia.com/nasional/20261004160508-20-1411499/update-gempa-m-61-sumba-barat-daya-20-rumah-rusak-1-warga-luka',
    publishedAt: '2026-10-04T09:24:39.000Z',
    author: null,
    summary:
      'CNN Indonesia 4 Okt 2026: 20 rumah rusak (19 ringan, 1 sedang) di Waikadada, Weerena, Bondo Kodi, Homba Karipit menurut Plt. Kapusdatin BNPB Berton SP Panjaitan; 1 luka ringan tertimpa reruntuhan, rawat jalan.',
    originalSnippet: null,
    contentStatus: 'METADATA_ONLY',
    discoveredBy: 'websearch-discovery 2026-10-11 (ZAPI crawler unavailable: missing ZAPI_API_KEY)',
    locationMentions: ['Sumba Barat Daya', 'Waikadada', 'Weerena', 'Bondo Kodi'],
    topics: ['damage', 'casualties'],
    verificationStatus: 'AI_REVIEWED',
    verificationNotes: 'Media mengutip BNPB; konsisten dengan rilis BNPB 20 rumah — belum verifikasi lapangan independen.',
    caseLinkConfidence: 0.9,
  },
  {
    sourceName: 'RRI.co.id',
    sourceType: 'NEWS_MEDIA',
    title: 'Terjadi 62 Gempa Susulan, BMKG Ungkap Dampak Gempa Sumba Barat Daya NTT',
    url: 'https://rri.co.id/nasional/2787121/terjadi-62-gempa-susulan-bmkg-ungkap-dampak-gempa-sumba-barat-daya-di-ntt',
    publishedAt: '2026-10-05T03:20:00.000Z',
    author: 'Dedi Hidayat',
    summary:
      'RRI: parameter update M5,9; sesar Waikabubak; VI MMI Kodi area, IV MMI Tambolaka/Waikabubak/Waibakul/Raba; 62 susulan M1,5–M4,3 s.d. 08:05 WIB; mengutip BNPB untuk kerusakan.',
    originalSnippet: null,
    contentStatus: 'METADATA_ONLY',
    discoveredBy: 'websearch-discovery 2026-10-11 (ZAPI crawler unavailable: missing ZAPI_API_KEY)',
    locationMentions: ['Sumba Barat Daya', 'Kodi', 'Tambolaka'],
    topics: ['aftershocks', 'shaking', 'official_update'],
    verificationStatus: 'AI_REVIEWED',
    verificationNotes: 'Media mengutip pejabat BMKG; klaim susulan konsisten dengan halaman event BMKG.',
    caseLinkConfidence: 0.9,
  },
  {
    sourceName: 'IDN Times',
    sourceType: 'NEWS_MEDIA',
    title: 'Gempa M 6,1 Guncang Sumba Barat Daya NTT, Gereja dan Rumah Rusak',
    url: 'https://ntb.idntimes.com/news/ntb/gempa-m-6-1-guncang-sumba-barat-daya-ntt-gereja-dan-rumah-rusak-00-4rv9p-h232p0',
    publishedAt: '2026-10-04T05:18:10.000Z',
    author: 'Putra F.D. Bali Mula',
    summary:
      'IDN Times: M6,1 (update M5,9) tidak berpotensi tsunami; getaran kuat Kodi–Bima, warga keluar rumah/gereja saat persiapan misa; retak menara gereja; kerusakan terparah di Kodi (rumah runtuh, sekolah) menurut warga; BPBD masih mendata, belum ada rincian resmi saat artikel terbit.',
    originalSnippet: null,
    contentStatus: 'METADATA_ONLY',
    discoveredBy: 'websearch-discovery 2026-10-11 (ZAPI crawler unavailable: missing ZAPI_API_KEY)',
    locationMentions: ['Sumba Barat Daya', 'Kodi', 'Tambolaka', 'Bima'],
    topics: ['shaking', 'damage', 'evacuation'],
    verificationStatus: 'UNVERIFIED',
    verificationNotes: 'Berisi kesaksian warga (belum terverifikasi) + status pendataan BPBD yang belum selesai.',
    caseLinkConfidence: 0.85,
  },
  {
    sourceName: 'TVRI News',
    sourceType: 'NEWS_MEDIA',
    title: 'Gempa M6,1 Sumba Barat Daya, 26 Bangunan Rusak dan 1 Warga Luka',
    url: 'https://nasional.tvrinews.com/berita/tdx5pyq-gempa-m61-sumba-barat-daya-26-bangunan-rusak-dan-1-warga-luka',
    publishedAt: null,
    author: 'Christhoper Natanael Raja',
    summary:
      'TVRI 4 Okt 2026: gempa M6,1 05:55 WIB/06:55 WITA, parameter awal 9,70 LS–118,92 BT ±14 km barat daya Kodi 10 km, tidak berpotensi tsunami; pendataan sementara: sejumlah bangunan rusak + 1 luka ringan. ANGKA BERBEDA dari BNPB (20) dan Bupati via detik (56+13) — konflik dipertahankan.',
    originalSnippet: null,
    contentStatus: 'METADATA_ONLY',
    discoveredBy: 'websearch-discovery 2026-10-11 (ZAPI crawler unavailable: missing ZAPI_API_KEY)',
    locationMentions: ['Sumba Barat Daya', 'Kodi'],
    topics: ['damage', 'casualties'],
    verificationStatus: 'CONFLICTING',
    verificationNotes: 'Angka 26 bangunan vs 20 (BNPB) vs 56+13 (Bupati via detik): konflik antar sumber, ditandai CONFLICTING.',
    caseLinkConfidence: 0.85,
  },
  {
    sourceName: 'detikBali',
    sourceType: 'NEWS_MEDIA',
    title: 'Dampak Gempa M 6,1 di Sumba Barat Daya: 56 Rumah-13 Fasilitas Umum Rusak',
    url: 'https://www.detik.com/bali/nusra/d-8692087/dampak-gempa-m-6-1-di-sumba-barat-daya-56-rumah-13-fasilitas-umum-rusak',
    publishedAt: '2026-10-04T12:07:16.000Z',
    author: 'Yufengki Bria',
    summary:
      'detikBali mengutip Bupati SBD Ratu Ngadu Bonu Wulla: 56 rumah rusak (disebut 50 ringan, 6 sedang, 1 berat — jumlah komponen 57, dipertahankan apa adanya sebagai konflik internal) di Kodi, Kodi Utara, Kodi Bangedo, Kodi Balaghar, Wewewa Selatan, Tambolaka; 13 fasum rusak (gereja, RSUD Pratama Reda Bolo, puskesmas/pustu, sekolah, PLN). BERBEDA dari BNPB 20 rumah — konflik dipertahankan, bukan dijumlah.',
    originalSnippet: null,
    contentStatus: 'METADATA_ONLY',
    discoveredBy: 'websearch-discovery 2026-10-11 (ZAPI crawler unavailable: missing ZAPI_API_KEY)',
    locationMentions: ['Sumba Barat Daya', 'Kodi', 'Kodi Utara', 'Kodi Bangedo', 'Kodi Balaghar', 'Wewewa Selatan', 'Tambolaka'],
    topics: ['damage', 'official_statement'],
    verificationStatus: 'CONFLICTING',
    verificationNotes: 'Atribusi: Bupati SBD (otoritas lokal) vs BNPB 20 rumah. Selisih besar + inkonsistensi internal 56 vs 50+6+1=57 — CONFLICTING.',
    caseLinkConfidence: 0.9,
  },
];

function simpleHash(s: string): string {
  return articleIdFromUrlSync(s);
}

export const nttArticlesSeed: CaseArticle[] = SEEDS.map((s) => {
  const url = canonicalUrl(s.url) ?? s.url;
  return {
    id: simpleHash(url),
    caseId: NTT_CASE_ID,
    sourceName: s.sourceName,
    sourceType: s.sourceType,
    title: s.title,
    url,
    publishedAt: s.publishedAt,
    retrievedAt: RETRIEVED_AT,
    updatedAt: RETRIEVED_AT,
    author: s.author,
    language: 'id',
    summary: s.summary,
    originalSnippet: s.originalSnippet,
    contentStatus: s.contentStatus,
    discoveredBy: s.discoveredBy,
    eventDate: '2026-10-04',
    locationMentions: s.locationMentions,
    topics: s.topics,
    verificationStatus: s.verificationStatus,
    verificationNotes: s.verificationNotes,
    contentHash: simpleHash(`${s.title}::${url}`),
    caseLinkConfidence: s.caseLinkConfidence,
    isMock: false,
  };
});

function claim(
  claimId: string,
  articleId: string,
  claimType: string,
  claimText: string,
  opts: Partial<CaseClaim> & { sourceUrl: string },
): CaseClaim {
  return {
    claimId,
    caseId: NTT_CASE_ID,
    articleId,
    claimType,
    claimText,
    location: opts.location ?? null,
    quantity: opts.quantity ?? null,
    unit: opts.unit ?? null,
    eventTime: opts.eventTime ?? null,
    sourceUrl: opts.sourceUrl,
    sourcePublishedAt: opts.sourcePublishedAt ?? null,
    extractionStatus: opts.extractionStatus ?? 'HEURISTIC',
    verificationStatus: opts.verificationStatus ?? 'AI_REVIEWED',
  };
}

const byUrl = (url: string) => nttArticlesSeed.find((a) => a.url === (canonicalUrl(url) ?? url))!;
const BMKG = 'https://www.bmkg.go.id/gempabumi/20261004055834';

export const nttClaimsSeed: CaseClaim[] = [
  claim('cl-tsunami-01', byUrl(BMKG).id, 'tsunami_assessment', 'Gempa tidak berpotensi tsunami (pemodelan BMKG).', {
    sourceUrl: BMKG, extractionStatus: 'MANUAL', verificationStatus: 'VERIFIED',
  }),
  claim('cl-update-01', byUrl(BMKG).id, 'official_update', 'Parameter update BMKG: M5,9, kedalaman 30 km, 9,84 LS–118,90 BT (±59 km barat daya Kodi, di laut).', {
    sourceUrl: BMKG, extractionStatus: 'MANUAL', verificationStatus: 'VERIFIED',
  }),
  claim('cl-mech-01', byUrl(BMKG).id, 'official_update', 'Jenis gempa dangkal, aktivitas sesar aktif diduga Sesar Waikabubak, mekanisme turun (normal fault).', {
    sourceUrl: BMKG, extractionStatus: 'MANUAL', verificationStatus: 'VERIFIED',
  }),
  claim('cl-shake-01', byUrl(BMKG).id, 'shaking', 'Intensitas VI MMI di Kodi Balaghar, Kodi Bangedo, Kodi; IV MMI di Tambolaka, Waikabubak, Waibakul, Raba; III MMI di Bima.', {
    sourceUrl: BMKG, location: 'Kodi, Sumba Barat Daya', extractionStatus: 'MANUAL', verificationStatus: 'VERIFIED',
  }),
  claim('cl-after-01', byUrl(BMKG).id, 'aftershocks', '62 gempa susulan M1,5–M4,3 hingga 08:05 WIB (monitoring BMKG).', {
    sourceUrl: BMKG, quantity: 62, unit: 'kejadian', eventTime: '2026-10-04T08:05:00+07:00', extractionStatus: 'MANUAL', verificationStatus: 'VERIFIED',
  }),
  claim('cl-dmg-bmkg-01', byUrl(BMKG).id, 'damage', 'Informasi kerusakan bangunan warga dan sekolah di Desa Perokonda, Kec. Kodi (berdasarkan laporan — belum ada angka).', {
    sourceUrl: BMKG, location: 'Desa Perokonda, Kodi', extractionStatus: 'MANUAL', verificationStatus: 'AI_REVIEWED',
  }),
  claim('cl-dmg-bnpb-01', byUrl('https://bnpb.go.id/berita/gempa-m61-guncang-sumba-barat-daya-20-rumah-terdampak').id, 'damage', 'BNPB (pendataan sementara): 20 unit rumah terdampak — 19 rusak ringan, 1 rusak sedang.', {
    sourceUrl: 'https://bnpb.go.id/berita/gempa-m61-guncang-sumba-barat-daya-20-rumah-terdampak', location: 'Sumba Barat Daya', quantity: 20, unit: 'rumah', extractionStatus: 'HEURISTIC', verificationStatus: 'AI_REVIEWED',
  }),
  claim('cl-cas-bnpb-01', byUrl('https://bnpb.go.id/berita/gempa-m61-guncang-sumba-barat-daya-20-rumah-terdampak').id, 'casualties', 'BNPB: 1 orang luka ringan tertimpa reruntuhan, rawat jalan.', {
    sourceUrl: 'https://bnpb.go.id/berita/gempa-m61-guncang-sumba-barat-daya-20-rumah-terdampak', quantity: 1, unit: 'orang luka ringan', extractionStatus: 'HEURISTIC', verificationStatus: 'AI_REVIEWED',
  }),
  claim('cl-dmg-detik-01', byUrl('https://www.detik.com/bali/nusra/d-8692087/dampak-gempa-m-6-1-di-sumba-barat-daya-56-rumah-13-fasilitas-umum-rusak').id, 'damage', 'Bupati SBD via detik: 56 rumah rusak + 13 fasum rusak. KONFLIK dengan BNPB (20 rumah). Rincian 50+6+1=57 juga inkonsisten internal — konflik dipertahankan.', {
    sourceUrl: 'https://www.detik.com/bali/nusra/d-8692087/dampak-gempa-m-6-1-di-sumba-barat-daya-56-rumah-13-fasilitas-umum-rusak', location: 'Sumba Barat Daya', quantity: 56, unit: 'rumah', extractionStatus: 'HEURISTIC', verificationStatus: 'CONFLICTING',
  }),
  claim('cl-dmg-tvri-01', byUrl('https://nasional.tvrinews.com/berita/tdx5pyq-gempa-m61-sumba-barat-daya-26-bangunan-rusak-dan-1-warga-luka').id, 'damage', 'TVRI: 26 bangunan rusak. KONFLIK dengan BNPB (20) dan Bupati via detik (56+13) — konflik dipertahankan.', {
    sourceUrl: 'https://nasional.tvrinews.com/berita/tdx5pyq-gempa-m61-sumba-barat-daya-26-bangunan-rusak-dan-1-warga-luka', quantity: 26, unit: 'bangunan', extractionStatus: 'HEURISTIC', verificationStatus: 'CONFLICTING',
  }),
  claim('cl-evac-idn-01', byUrl('https://ntb.idntimes.com/news/ntb/gempa-m-6-1-guncang-sumba-barat-daya-ntt-gereja-dan-rumah-rusak-00-4rv9p-h232p0').id, 'evacuation', 'Warga keluar rumah/gereja saat guncangan (kesaksian warga, belum terverifikasi); tidak ada angka pengungsi resmi.', {
    sourceUrl: 'https://ntb.idntimes.com/news/ntb/gempa-m-6-1-guncang-sumba-barat-daya-ntt-gereja-dan-rumah-rusak-00-4rv9p-h232p0', location: 'Kodi / Tambolaka', extractionStatus: 'HEURISTIC', verificationStatus: 'UNVERIFIED',
  }),
];
