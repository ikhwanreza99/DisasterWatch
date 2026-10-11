// Lombok 2018 earthquake registry entry.
// Event params from official records (BMKG/BNPB/ESDM, verified via live search 2026-10-11).
// Dashboard placeholder metrics follow the existing demo-incident convention and are
// labelled DEMO by the provenance system — never presented as official measurements.
import type { DisasterIncident } from '../types';

export const LOMBOK_ID = 'lombok-2018-08-05';

export const lombokIncident: DisasterIncident = {
  id: LOMBOK_ID,
  category: 'earthquake',
  name: 'Lombok',
  province: 'Nusa Tenggara Barat',
  fullName: 'Gempa Bumi Tektonik',
  fullTitleDisplay: 'Gempa M7,0 Lombok 2018 — Arsip Referensi',
  urgency: 'Arsip Referensi',
  urgencyClass: 'bg-slate-100 text-slate-600 border-slate-200',
  impact: 'Lihat catatan provenance (angka dashboard = demo)',
  cost: 'Belum tersedia',
  gapRecovery: 'Belum tersedia',
  recoveryPct: 0,
  recoveryServices: [],
  coords: { lat: -8.37, lng: 116.48 },
  timestamp: '5 Agu 2018 • 18:46:37 WIB (M7,0 BMKG)',
  photoUrl: '',
  photoAlt: 'Arsip gempa Lombok 2018 (tanpa foto ilustrasi)',
  photoSource: 'BMKG https://bnpb.go.id/berita/gempa-7-sr-guncang-lombok-utara-peringatan-dini-tsunami-diaktivasi',
  stats: {
    hotspots: 'Belum tersedia',
    hotspotsChange: '-',
    loss: 'Belum tersedia',
    lossChange: '-',
    personnel: 'Belum tersedia',
    personnelChange: '-',
  },
  guide: {
    title: 'Mitigasi Gempa Lombok (himbauan umum BMKG)',
    cause: 'Aktivitas Sesar Naik Flores (Flores Back Arc Thrust), kedalaman 15 km.',
    hazards: 'Guncangan kuat hingga MMI VIII di dekat episenter; gempa susulan; waspadai tsunami saat peringatan aktif.',
    safeRadius: 'Ikuti arahan BPBD; jauhi pantai saat peringatan tsunami aktif.',
    protocols: [
      'Tetap tenang dan ikuti arahan pemerintah daerah dan BPBD setempat.',
      'Jangan terpancing isu yang tidak bertanggung jawab mengenai gempa dan tsunami.',
      'Hindari bangunan yang retak atau rusak akibat gempa.',
    ],
    evacRoute: 'Titik kumpul mengikuti arahan BPBD setempat (tidak ada rute demo yang diklaim).',
  },
  supplies: [],
  route: {
    distance: '-',
    duration: '-',
    convoy: '-',
    statusBadge: 'Arsip — tanpa konvoi demo',
    checkpoints: [],
  },
  reports: [
    {
      id: 'lombok-bnpb-2018',
      location: 'Lombok Utara, NTB',
      title: 'BNPB: gempa M7,0, peringatan dini tsunami diaktivasi',
      desc: 'Parameter awal M6,8 dimutakhirkan M7,0 (15 km). Tsunami terdeteksi 10–13 cm; peringatan berakhir 20:25 WIB. 14 gempa susulan saat laporan awal.',
      time: '5 Agu 2018',
      author: 'Oleh: BNPB (resmi, arsip)',
      tag: 'Arsip Resmi',
      tagClass: 'bg-slate-100 text-slate-600 border-slate-200',
      sourceType: 'official',
      sourceName: 'BNPB',
      sourceUrl: 'https://bnpb.go.id/berita/gempa-7-sr-guncang-lombok-utara-peringatan-dini-tsunami-diaktivasi',
    },
  ],
};
