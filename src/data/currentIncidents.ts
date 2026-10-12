import { currentMedia } from './currentMedia';
import nationalSnapshot from './nationalIncidents.json';
import type { DisasterIncident, DisasterCategory } from '../types';
import type { IncidentArticle } from '../domain/incidentDetail';

// Reviewed snapshot, not a claim that these incidents are still active now.
export const CURRENT_REVIEWED_AT = '2026-10-12';
const bnpb = 'https://gis.bnpb.go.id/databencana/tabel/pencarian.php';
const reviewedRecords = [
  { id: 'padang', name: 'Kota Padang', province: 'Sumatera Barat', category: 'flood', date: '2026-10-10', lat: -0.9471, lng: 100.4172, aliases: ['Kota Padang', 'Kuranji', 'Koto Tangah', 'Nanggalo'], source: 'BNPB', url: bnpb, summary: 'Banjir tercatat di Kuranji, Koto Tangah, dan Nanggalo.' },
  { id: 'pesisir-selatan-2026-10', name: 'Pesisir Selatan', province: 'Sumatera Barat', category: 'flood', date: '2026-10-10', lat: -2.05, lng: 100.9, aliases: ['Pesisir Selatan', 'Tapan', 'Lunang'], source: 'BNPB', url: bnpb, summary: 'Banjir tercatat di wilayah Tapan dan Lunang.' },
  { id: 'palembang-2026-10', name: 'Palembang', province: 'Sumatera Selatan', category: 'fire', date: '2026-10-07', lat: -2.99, lng: 104.76, aliases: ['Palembang'], source: 'KLH/BPLH', url: 'https://kemenlh.go.id/news/detail/wamen-lh-pastikan-percepatan-pemadaman-karhutla-dan-pembasahan-gambut-di-palembang', summary: 'KLH melaporkan peninjauan penanganan karhutla di Palembang pada 7 Oktober; laporan diterbitkan 8 Oktober.' },
  { id: 'kobar-2026-10', name: 'Kotawaringin Barat', province: 'Kalimantan Tengah', category: 'fire', date: '2026-10-12', lat: -2.68, lng: 111.62, aliases: ['Kotawaringin Barat', 'Pangkalan Bun', 'Kobar'], source: 'Pemprov Kalimantan Tengah', url: 'https://kalteng.go.id/berita/read/42854/lihat-titik-api-di-kobar-gubernur-agustiar-sabran-turun-memadamkan-karhutla', summary: 'Laporan 12 Oktober menyebut pemadaman karhutla di ruas Pangkalan Bun–Kotawaringin Lama.' },
  { id: 'merauke-2026-10', name: 'Merauke', province: 'Papua Selatan', category: 'fire', date: '2026-10-09', lat: -8.49, lng: 140.4, aliases: ['Merauke', 'Tanah Miring', 'Kurik'], source: 'BNPB', url: bnpb, summary: 'Karhutla tercatat di sejumlah distrik Kabupaten Merauke pada 9 Oktober.' },
  { id: 'aceh-tamiang-2026-10', name: 'Aceh Tamiang', province: 'Aceh', category: 'flood', date: '2026-10-10', lat: 4.28, lng: 98.06, aliases: ['Aceh Tamiang', 'Tenggulun', 'Kejuruan Muda'], source: 'BNPB', url: bnpb, summary: 'Banjir tercatat di empat kecamatan Kabupaten Aceh Tamiang.' },
] as const;

export interface CurrentRecord {
  id: string; name: string; province: string; category: DisasterCategory; date: string;
  startDate?: string; disasterLabel?: string; lat: number; lng: number; aliases: readonly string[];
  source: string; url: string; summary: string; reports?: {date: string; location: string; documentationUrl?: string | null; impact?: Record<string, number | null>}[];
}
export const currentRecords: CurrentRecord[] = [
  ...(nationalSnapshot as CurrentRecord[]),
  ...reviewedRecords.filter(r => !nationalSnapshot.some(n => n.id === r.id)),
];
export const NATIONAL_REPORT_COUNT = nationalSnapshot.reduce((n, r) => n + r.reports.length, 0);
export const labelFor = (r: CurrentRecord) => r.disasterLabel ?? (r.category === 'fire' ? 'Kebakaran Hutan dan Lahan' : 'Banjir');

export const currentIncidents: Record<string, DisasterIncident> = Object.fromEntries(currentRecords.map(r => {
  const type = labelFor(r);
  return [r.id, {
    id: r.id, name: r.name, province: r.province, category: r.category,
    fullName: type, fullTitleDisplay: type, urgency: 'Laporan terbaru',
    urgencyClass: 'bg-blue-50 text-blue-700 border-blue-200',
    impact: 'Dampak belum diverifikasi', cost: 'Belum tersedia', gapRecovery: 'Belum tersedia',
    recoveryPct: 0, recoveryServices: [], coords: { lat: r.lat, lng: r.lng },
    timestamp: `Laporan ${r.date} · Ditinjau 12 Okt 2026`,
    photoUrl: '', photoAlt: '', photoSource: r.source,
    stats: { hotspots: 'Belum tersedia', hotspotsChange: '', loss: 'Belum tersedia', lossChange: '', personnel: 'Belum tersedia', personnelChange: '' },
    guide: { title: 'Informasi kejadian', cause: r.summary, hazards: 'Ikuti pembaruan BPBD setempat.', safeRadius: 'Belum tersedia', protocols: [], evacRoute: 'Rute evakuasi belum diverifikasi.' },
    supplies: [], route: { distance: 'Belum tersedia', duration: 'Belum tersedia', convoy: 'Belum tersedia', statusBadge: 'Belum diverifikasi', checkpoints: [] }, reports: [],
  }];
}));

// One card per source documentation link; publication and event dates stay distinct.
export const currentArticles: IncidentArticle[] = [...currentMedia, ...currentRecords.flatMap(r =>
  (r.reports ?? []).filter(report => report.documentationUrl).map((report): IncidentArticle => ({
    url: report.documentationUrl!, title: `${labelFor(r)} ${r.name} — ${report.date}`,
    sourceName: 'BNPB · Dokumentasi kejadian', sourceType: 'OFFICIAL',
    publishedAt: null, eventDate: report.date,
    retrievedAt: '2026-10-12T00:00:00+07:00', summary: report.location || r.summary,
    contentStatus: 'METADATA_ONLY', incidentId: r.id, discoveredBy: 'bnpb-documentation',
  }))
)];
