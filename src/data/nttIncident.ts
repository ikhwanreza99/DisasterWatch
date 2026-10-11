// NTT incident for the map + dashboard registry.
// Honest demo-adjacent record: coordinates + labels from BMKG, impact fields explicitly
// "Belum tersedia" where no source evidence exists. Never invent casualties/aid totals.
import type { DisasterIncident } from '../types';
import { NTT_CASE_ID } from '../domain/nttCase';

export const nttIncident: DisasterIncident = {
  id: NTT_CASE_ID,
  category: 'earthquake',
  name: 'Sumba Barat Daya',
  province: 'Nusa Tenggara Timur',
  fullName: 'Gempa Bumi Tektonik',
  fullTitleDisplay: 'Gempa M6,1 (update M5,9) — Kasus Nyata',
  urgency: 'Pemantauan Susulan',
  urgencyClass: 'bg-rose-50 text-rose-600 border-rose-200',
  impact: 'Kerusakan dalam pendataan (BNPB sementara: 20 rumah; klaim media berbeda)',
  cost: 'Belum tersedia',
  gapRecovery: 'Belum tersedia',
  recoveryPct: 0,
  recoveryServices: [],
  coords: { lat: -9.84, lng: 118.9 },
  timestamp: '4 Okt 2026 • 05:55:52 WIB (kasus nyata BMKG)',
  photoUrl: '',
  photoAlt: 'Episenter gempa Sumba Barat Daya (data BMKG, tanpa foto ilustrasi)',
  photoSource: 'BMKG https://www.bmkg.go.id/gempabumi/20261004055834',
  stats: {
    hotspots: '62 susulan (BMKG)',
    hotspotsChange: 's.d. 08:05 WIB',
    loss: 'Belum tersedia',
    lossChange: '-',
    personnel: 'Belum tersedia',
    personnelChange: '-',
  },
  guide: {
    title: 'Mitigasi Gempa Sumba Barat Daya (himbauan BMKG)',
    cause: 'Gempa dangkal aktivitas sesar aktif diduga Sesar Waikabubak, mekanisme turun (normal fault).',
    hazards: 'Guncangan VI MMI di Kodi; waspadai gempa susulan dan bangunan retak/rusak.',
    safeRadius: 'Hindari bangunan retak/rusak; tetap tenang dan ikuti kanal resmi @infoBMKG.',
    protocols: [
      'Tetap tenang dan tidak terpengaruh isu yang tidak dapat dipertanggungjawabkan.',
      'Hindari bangunan yang retak atau rusak akibat gempa.',
      'Pastikan informasi resmi hanya dari BMKG (web, @infoBMKG, aplikasi infoBMKG/wrs-bmkg).',
    ],
    evacRoute: 'Belum ada rute evakuasi resmi tercatat untuk kasus ini.',
  },
  supplies: [],
  route: {
    distance: '-',
    duration: '-',
    convoy: '-',
    statusBadge: 'Kasus nyata — tanpa konvoi demo',
    checkpoints: [],
  },
  reports: [
    {
      id: 'ntt-bmkg-official',
      location: 'Kodi, Sumba Barat Daya',
      title: 'BMKG: M6,1 (update M5,9), tidak berpotensi tsunami',
      desc: 'Parameter awal M6,1/10 km; update M5,9/30 km di 9,84 LS–118,90 BT. 62 susulan M1,5–M4,3. Sumber: https://www.bmkg.go.id/gempabumi/20261004055834',
      time: '4 Okt 2026',
      author: 'Oleh: BMKG (resmi)',
      tag: 'Terverifikasi BMKG',
      tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      sourceType: 'official',
      sourceName: 'BMKG',
      sourceUrl: 'https://www.bmkg.go.id/gempabumi/20261004055834',
    },
  ],
};
