/** English translations — shell slice. Keys are the Indonesian source strings. */
const shell: Record<string, string> = {
  // App.tsx — technical brief + report feed labels
  '[DATA TEKNIS SATGAS BNPB & BMKG]': '[BNPB & BMKG TASK FORCE TECHNICAL DATA]',
  'Wilayah: {region}': 'Region: {region}',
  'Bencana: {disaster}': 'Disaster: {disaster}',
  'Status: {status}': 'Status: {status}',
  'Estimasi Kerugian: {cost}': 'Estimated Loss: {cost}',
  'Gap Pemulihan: {recovery}': 'Recovery Gap: {recovery}',
  'Jumlah Hotspot/Titik: {hotspots}': 'Hotspots/Points: {hotspots}',
  'Personel Siaga: {personnel}': 'Standby Personnel: {personnel}',
  'Dokumentasi {name}': 'Documentation of {name}',
  'Lokasi belum tersedia': 'Location not yet available',
  'Laporan Warga Baru': 'New Citizen Report',
  'Laporan baru diterima dari lapangan.': 'New report received from the field.',
  'Baru saja': 'Just now',
  'Oleh: Warga Pelapor Terverifikasi': 'By: Verified Citizen Reporter',
  'Menunggu Verifikasi TRC': 'Awaiting TRC Verification',
  'Laporan AI': 'AI Report',
  'Oleh: {source}': 'By: {source}',
  'Terverifikasi Posko TRC': 'Verified by Posko TRC',
  'Konflik — Perlu Verifikasi': 'Conflict — Needs Verification',
  'AI Review — Menunggu TRC': 'AI Review — Awaiting TRC',
  'Buka detail gempa Sumba Barat Daya 4 Okt 2026 (tampilan standar yang sama)':
    'Open the Southwest Sumba 4 Oct 2026 earthquake detail (same standard view)',
  'Kasus NTT · M6,1 Sumba Barat Daya': 'NTT case · M6.1 Southwest Sumba',
  '{count} berita': '{count} news items',

  // SlimSidebar.tsx
  'Update 3m lalu': 'Updated 3m ago',
  'Minimize sidebar': 'Minimize sidebar',
  'Estimasi Dampak': 'Estimated Impact',
  'Gap Recovery': 'Recovery Gap',
  'Belum tersedia': 'Not yet available',
  'Dokumentasi kejadian': 'Incident documentation',
  'Laporan {date}': 'Report {date}',
  'Detail Bencana': 'Disaster Details',
  'Posko Evakuasi': 'Evacuation Post',
  'Cuaca Lapangan': 'Field Weather',
  'Tanya DisasterAI': 'Ask DisasterAI',

  // SidebarDetailTemplate.tsx
  'Air & Sanitasi': 'Water & Sanitation',
  'Listrik': 'Electricity',
  'Akses': 'Access',
  'Telekomunikasi': 'Telecommunications',
  'Status {status}: {title} di {name}.': 'Status {status}: {title} in {name}.',
  'Tautan pantauan bencana berhasil disalin ke clipboard!':
    'Disaster monitoring link copied to clipboard!',
  'Detail Situasi Wilayah': 'Regional Situation Detail',
  'Detail Situasi Wilayah & Jalur Logistik Terbuka':
    'Regional Situation Detail & Open Logistics Routes',
  'Tutup & Kembali ke Homepage Peta': 'Close & Return to the Map Homepage',
  'Tutup': 'Close',
  'STATUS {value}': 'STATUS {value}',
  'Detail Teknis Satgas': 'Task Force Technical Details',
  'Dokumentasi: {source}': 'Documentation: {source}',
  'Sumber: {source}': 'Source: {source}',
  '· Laporan {date}': '· Report {date}',
  'Lihat Posko Evakuasi': 'View Evacuation Posts',
  'Bagikan Titik Lokasi': 'Share Location Pin',
  'Status Recovery': 'Recovery Status',
  'Kesenjangan Bantuan': 'Aid Gap',
  'Salurkan Bantuan / Donasi': 'Distribute Aid / Donate',

  // CategoryFilterBar.tsx
  'Semua bencana': 'All disasters',
  'Kebakaran': 'Fire',
  'Banjir': 'Flood',
  'Gempa': 'Earthquake',
  'Longsor': 'Landslide',
  'Bencana lainnya': 'Other disasters',
  'Jenis bencana': 'Disaster type',
  'Minimalkan jenis bencana': 'Collapse disaster types',
  'Buka jenis bencana': 'Open disaster types',

  // MobileSheetHandle.tsx
  'Kecilkan panel untuk melihat peta': 'Shrink the panel to see the map',
  'Perluas panel': 'Expand panel',
  'Kecilkan panel': 'Shrink panel',

  // DisasterTicker.tsx
  'Berita bencana terbaru': 'Latest disaster news',
  'TERKINI': 'LATEST',
  'Lanjutkan berita berjalan': 'Resume the news ticker',
  'Jeda berita berjalan': 'Pause the news ticker',

  // IntelligenceSummaryBar.tsx
  'Insiden Aktif': 'Active Incidents',
  'Terdampak': 'Affected',
  'Prioritas': 'Priority',
  'Gap': 'Gap',
  'Perlu Verifikasi': 'Needs Verification',
  'MOCK + AI-PROCESSED — bukan feed resmi BNPB/BMKG':
    'MOCK + AI-PROCESSED — not an official BNPB/BMKG feed',
  'Demo data · AI-processed · Not official BNPB/BMKG':
    'Demo data · AI-processed · Not official BNPB/BMKG',
};

export default shell;
