/** English translations — services slice. Keys are the Indonesian source strings. */
const services: Record<string, string> = {
  // ----- services/status/model.ts -----
  'menggunakan {model}, tanpa fallback.': 'using {model}, no fallback.',
  'menggunakan {model}. Model utama dilewati; fallback berhasil digunakan.':
    'using {model}. Primary model skipped; fallback was used successfully.',
  'Batas waktu pemeriksaan habis': 'Check timed out',
  'Permintaan gagal; periksa akses, jaringan, atau kuota':
    'Request failed; check access, network, or quota',

  // ----- services/status/browserChecks.ts -----
  'Sesi login dipulihkan': 'Login session restored',
  'Tidak ada sesi login': 'No login session',
  'Baca Firestore dari server berhasil; sampel {count} artikel.':
    'Reading Firestore from the server succeeded; sample of {count} articles.',
  'Autocomplete dan Place Details berhasil; {count} saran.':
    'Autocomplete and Place Details succeeded; {count} suggestions.',
  'GenerateContent berhasil {note}': 'GenerateContent succeeded {note}',
  '{detail} Init: terinisialisasi.': '{detail} Init: initialized.',
  'App Check: terinisialisasi.': 'App Check: initialized.',
  'App Check: {reason}.': 'App Check: {reason}.',
  'tidak terinisialisasi': 'not initialized',
  'Firebase AI Logic berhasil {note} {appCheck}':
    'Firebase AI Logic succeeded {note} {appCheck}',
  'Endpoint Google OAuth menghasilkan URL login. Login pengguna sampai selesai belum diuji.':
    'The Google OAuth endpoint produced a login URL. A full user sign-in has not been tested.',
  'Autocomplete berhasil; tidak ada saran lokasi.':
    'Autocomplete succeeded; no location suggestions.',
  'Respons Weather API valid untuk Jakarta; tidak memakai cuaca simulasi.':
    'Valid Weather API response for Jakarta; no simulated weather is used.',
  'Bucket terkonfigurasi. Upload/download membutuhkan pengguna login dan lampiran; tidak mengunggah file uji otomatis.':
    'Bucket configured. Upload/download requires a signed-in user and an attachment; no test file is uploaded automatically.',
  'Uji peta melalui tombol “Uji Maps” pada halaman status.':
    'Test the map via the “Test Maps” button on the status page.',
  'Batas waktu pemeriksaan habis (25 detik).': 'Check timed out (25 seconds).',

  // ----- services/incidentFreshness.ts -----
  'Pembaruan berita belum selesai. Silakan periksa kembali nanti.':
    'The news update is not finished yet. Please check back later.',

  // ----- services/places/placeSearch.ts -----
  'Google Maps API key belum diisi': 'Google Maps API key is not set',
  'Places HTTP {status}': 'Places HTTP {status}',
  'Lokasi tempat tidak ditemukan': 'Place location not found',

  // ----- services/places/recommendEvacuation.ts -----
  'Acuan wilayah laporan: {area}. Lokasi dicocokkan melalui Google Places.':
    'Report area reference: {area}. The location was matched via Google Places.',

  // ----- services/places/evacuationCandidates.ts (rendered in EvacuationPostView / AIHelpdeskPanel) -----
  Masjid: 'Mosque',
  Gereja: 'Church',
  Sekolah: 'School',
  'Balai warga': 'Community hall',
  'Lapangan / fasilitas olahraga': 'Field / sports facility',
  'Alamat belum tersedia': 'Address not yet available',
  'Kapasitas, akses, izin pengelola, dan keamanan lokasi perlu diperiksa BPBD.':
    'Capacity, access, manager permits, and site safety need to be checked by BPBD.',

  // ----- services/nttCaseStore.ts -----
  'Memuat {count} artikel kasus NTT dari Firestore.':
    'Loading {count} NTT case articles from Firestore.',
  'Menampilkan {count} artikel NTT tersimpan lokal (Firestore tidak tersedia).':
    'Showing {count} locally stored NTT articles (Firestore unavailable).',
  'Menampilkan {count} artikel NTT hasil retrieval nyata 11 Okt 2026.':
    'Showing {count} NTT articles from the real 11 Oct 2026 retrieval.',
  'Refresh {time}: {count} artikel (tidak ada duplikat). Tersimpan ke Firestore.':
    'Refresh {time}: {count} articles (no duplicates). Saved to Firestore.',
  'Refresh {time}: {count} artikel (tidak ada duplikat). Crawler ZAPI tidak tersedia (tanpa key) — data lokal dipertahankan.':
    'Refresh {time}: {count} articles (no duplicates). ZAPI crawler unavailable (no key) — local data retained.',
  'Gempa terjadi': 'Earthquake occurred',
  'M6,1 (parameter awal) — barat daya Sumba Barat Daya. Waktu kejadian, bukan waktu publikasi.':
    'M6.1 (initial parameter) — southwest of Southwest Sumba. Time of occurrence, not time of publication.',
  'BMKG merilis parameter awal': 'BMKG released the initial parameters',
  'M6,1 / 10 km / 9,70 LS–118,92 BT. Tidak berpotensi tsunami.':
    'M6.1 / 10 km / 9.70 S–118.92 E. No tsunami potential.',
  'BMKG menerbitkan parameter update': 'BMKG issued updated parameters',
  'M5,9 / 30 km / 9,84 LS–118,90 BT (±59 km barat daya Kodi). Revisi dipertahankan terpisah dari parameter awal.':
    'M5.9 / 30 km / 9.84 S–118.90 E (±59 km southwest of Kodi). The revision is kept separate from the initial parameters.',
  'Sumber terbit: {name}': 'Source published: {name}',
  'Sistem mengambil: {name}': 'System retrieved: {name}',
  'Konten penuh diambil.': 'Full content retrieved.',
  'Hanya metadata (isi penuh tidak diambil).': 'Metadata only (full content not retrieved).',

  // ----- services/incidentDetailAdapter.ts -----
  'Parameter awal BMKG': 'BMKG initial parameters',
  'Parameter update BMKG': 'BMKG updated parameters',
  'M{magnitude} · kedalaman {depth} km · {latitude}°LS {longitude}°BT — {location}. {assessment}.':
    'M{magnitude} · depth {depth} km · {latitude}°S {longitude}°E — {location}. {assessment}.',
  'Parameter BMKG (dimutakhirkan)': 'BMKG parameters (updated)',
  'M7,0 · kedalaman 15 km · 8,37°LS 116,48°BT — 18 km barat laut Lombok Timur. Sesar Naik Flores. Peringatan dini tsunami diaktivasi; terdeteksi 0,135 m di Carik dan 0,100 m di Badas; berakhir 20:25 WIB.':
    'M7.0 · depth 15 km · 8.37°S 116.48°E — 18 km northwest of East Lombok. Flores Thrust. Tsunami early warning activated; 0.135 m detected at Carik and 0.100 m at Badas; ended 20:25 WIB.',
  'Gempa utama M7,0': 'M7.0 mainshock',
  '18 km barat laut Lombok Timur, kedalaman 15 km (BMKG). Sesar Naik Flores.':
    '18 km northwest of East Lombok, depth 15 km (BMKG). Flores Thrust.',
  'Peringatan dini tsunami + deteksi': 'Tsunami early warning + detection',
  'Tsunami terdeteksi 0,135 m di Carik, 0,100 m di Badas; peringatan berakhir 20:25 WIB (BMKG).':
    'Tsunami detected at 0.135 m at Carik, 0.100 m at Badas; warning ended 20:25 WIB (BMKG).',
  'BNPB: 82 korban jiwa (pendataan sementara)':
    'BNPB: 82 fatalities (provisional data collection)',
  'Per 6 Agu 2018 02:30 WIB; angka final berbeda antar sumber — lihat catatan.':
    'As of 6 Aug 2018 02:30 WIB; final figures differ between sources — see the notes.',
  'Kejadian tercatat': 'Event recorded',
  'Laporan: {location}': 'Report: {location}',
  'Layanan {service}: {status}{area}': 'Service {service}: {status}{area}',
  'Perubahan status tercatat ({status}).': 'Status change recorded ({status}).',

  // ----- services/store/disasterStore.ts -----
  'Firestore belum dikonfigurasi — memakai data demo lokal.':
    'Firestore is not configured — using local demo data.',
  'Firestore kosong — memakai data demo lokal.': 'Firestore is empty — using local demo data.',
  'Memuat {count} insiden dari Firestore.': 'Loading {count} incidents from Firestore.',
  'Gagal memuat Firestore ({error}). Fallback lokal.':
    'Failed to load Firestore ({error}). Local fallback.',
  'Laporan disimpan lokal (mock).': 'Report saved locally (mock).',
  'Laporan {id} tersimpan di Firestore.': 'Report {id} saved to Firestore.',
  'Firestore gagal ({error}). Tersimpan lokal.': 'Firestore failed ({error}). Saved locally.',
  'Bantuan tercatat lokal (mock).': 'Aid recorded locally (mock).',
  'Bantuan {id} tersimpan di Firestore.': 'Aid {id} saved to Firestore.',
  'Firestore gagal ({error}). Tercatat lokal.': 'Firestore failed ({error}). Recorded locally.',

  // ----- services/ai/disasterExtraction.ts -----
  'Teks kosong — ekstraksi minimal.': 'Empty text — minimal extraction.',
  'Diekstrak oleh Gemini via Firebase AI Logic.': 'Extracted by Gemini via Firebase AI Logic.',
  'Gemini tidak tersedia — memakai ekstraksi heuristik lokal (jelas berlabel).':
    'Gemini unavailable — using local heuristic extraction (clearly labeled).',

  // ----- lib/firebase/authErrors.ts -----
  'Login Google belum berhasil (kode: {code}). Silakan coba lagi.':
    'Google sign-in was not successful (code: {code}). Please try again.',

  // ----- lib/firebase/config.ts (App Check) -----
  'App Check dilewati: tidak ada window (non-browser).':
    'App Check skipped: no window (non-browser).',
  'App Check tidak diinisialisasi: site key tidak tersedia di bundle ini.':
    'App Check not initialized: no site key available in this bundle.',
  'Inisialisasi App Check gagal.': 'App Check initialization failed.',
  'App Check belum terinisialisasi.': 'App Check is not initialized yet.',
  'Token App Check berhasil diterbitkan (nilai tidak ditampilkan).':
    'App Check token issued successfully (value not shown).',
  'App Check tidak mengembalikan token.': 'App Check did not return a token.',
  'Gagal memperoleh token App Check.': 'Failed to obtain an App Check token.',

  // ----- services/newsClassification.ts (getNewsInsight labels) -----
  'Butuh Masker Tambahan': 'More Masks Needed',
  'Butuh Air Bersih': 'Clean Water Needed',
  'Butuh Bantuan Medis': 'Medical Help Needed',
  'Butuh Pasokan Pangan': 'Food Supplies Needed',
  'Kebutuhan Belum Terpenuhi': 'Needs Not Yet Met',
  'Korban Jiwa Tercatat': 'Fatalities Recorded',
  'Warga Masih Hilang': 'Residents Still Missing',
  'Visibilitas Terganggu': 'Visibility Impaired',
  'Akses Jalan Terganggu': 'Road Access Disrupted',
  'Kerugian Bencana Tercatat': 'Disaster Losses Recorded',
  'Dampak Bencana Dilaporkan': 'Disaster Impact Reported',
  'Bantuan Telah Diterima': 'Aid Received',
  'Bantuan Tersalurkan': 'Aid Distributed',
  'Bantuan Dalam Pengiriman': 'Aid In Transit',
  'Pengungsian Telah Disiapkan': 'Shelter Prepared',
  'Perbaikan Infrastruktur Berlangsung': 'Infrastructure Repair Underway',
  'Infrastruktur Aman Digunakan': 'Infrastructure Safe to Use',
  'Pemulihan Sedang Berlangsung': 'Recovery In Progress',

  // ----- data/currentIncidents.ts (rendered across detail views) -----
  'Laporan terbaru': 'Latest report',
  'Dampak belum diverifikasi': 'Impact not yet verified',
  'Informasi kejadian': 'Incident information',
  'Ikuti pembaruan BPBD setempat.': 'Follow updates from the local BPBD.',
  'Rute evakuasi belum diverifikasi.': 'Evacuation route not yet verified.',

  // ----- components/AIHelpdeskPanel.tsx (report summary raw text) -----
  'Laporan kebutuhan bantuan': 'Aid needs report',
  'Laporan bencana': 'Disaster report',
  'Tidak ada': 'None',

  // ----- services/ai/disasterAssistant.ts (fallbackAnswer chat prose) -----
  'Bencana apa dan di kota/kabupaten mana yang ingin Anda pelajari?':
    'Which disaster, and in which city/regency, would you like to learn about?',
  'Sebagai gambaran dari panduan yang tersedia di aplikasi: {cause}\n\n{hazards}\n\nDi kota/kabupaten mana bencana yang Anda maksud? Apakah Anda ingin membahas risiko atau perlindungan diri?':
    'As an overview from the guides available in the app: {cause}\n\n{hazards}\n\nWhich city/regency is the disaster you mean in? Would you like to discuss risks or self-protection?',
  'Data DisasterWatch yang tersedia saat ini belum mencatat angka korban meninggal secara terverifikasi.':
    'The DisasterWatch data currently available does not yet record a verified death toll.',
  'Kondisi Saat Ini (menurut data DisasterWatch saat ini):':
    'Current Conditions (according to current DisasterWatch data):',
  '• {count} insiden aktif': '• {count} active incidents',
  '• {count} orang terdampak': '• {count} people affected',
  '• {count} laporan belum terverifikasi': '• {count} unverified reports',
  '• Gap bantuan terbesar: {need}': '• Largest aid gap: {need}',
  '• Prioritas tertinggi: {name}': '• Highest priority: {name}',
  'Saat ini ada {count} insiden bencana aktif di DisasterWatch: {names}.':
    'There are currently {count} active disaster incidents in DisasterWatch: {names}.',
  'Menurut data DisasterWatch saat ini, {count} orang terdampak.':
    'According to current DisasterWatch data, {count} people are affected.',
  'Selain itu ada {count} laporan CONFLICTING yang perlu rekonsiliasi.':
    'In addition, there are {count} CONFLICTING reports that need reconciliation.',
  'Ya. Saat ini ada {count} laporan yang masih menunggu verifikasi (dari {total} laporan intelijen).{detail}{conf}':
    'Yes. There are currently {count} reports still awaiting verification (out of {total} intelligence reports).{detail}{conf}',
  'Data DisasterWatch saat ini belum memuat estimasi kebutuhan air bersih.':
    'Current DisasterWatch data does not yet include an estimate of clean water needs.',
  'Gap air bersih terbesar saat ini di {name}: kebutuhan {estimated} {unit}, bantuan diterima {received} {unit}, masih kurang {gap} {unit} (coverage {coverage}%).':
    'The largest clean water gap is currently in {name}: need {estimated} {unit}, aid received {received} {unit}, still short {gap} {unit} (coverage {coverage}%).',
  'Kebutuhan air tercatat {estimated} {unit}, sementara bantuan yang sudah diterima {received} {unit}. Jadi masih ada gap {gap} {unit}, dengan coverage sekitar {coverage}%.':
    'Recorded water need is {estimated} {unit}, while aid already received is {received} {unit}. So there is still a gap of {gap} {unit}, with coverage of about {coverage}%.',
  'Gap air bersih per wilayah — {list}.': 'Clean water gap by region — {list}.',
  '{name}: kurang {gap} {unit}': '{name}: short {gap} {unit}',
  'Menurut data DisasterWatch saat ini, total {count} catatan bantuan sudah diterima{detail}':
    'According to current DisasterWatch data, a total of {count} aid records have been received{detail}',
  'Menurut data DisasterWatch saat ini, total gap bantuan yang belum terpenuhi adalah {amount}.':
    'According to current DisasterWatch data, the total unmet aid gap is {amount}.',
  'Belum ada data aid gap terstruktur. Estimasi kebutuhan muncul setelah laporan dianalisis AI.':
    'No structured aid gap data yet. Need estimates appear after reports are analyzed by AI.',
  'Aid gap terbesar: {name} — {list}. (PERHITUNGAN DETERMINISTIK)':
    'Largest aid gap: {name} — {list}. (DETERMINISTIC CALCULATION)',
  '{need} kurang {gap}{unit} ({pct}%)': '{need} short {gap}{unit} ({pct}%)',
  '{name} saat ini menjadi prioritas tertinggi dengan skor {score}. Fokus utama adalah kebutuhan bantuan yang masih memiliki gap.':
    '{name} is currently the highest priority with a score of {score}. The main focus is aid needs that still have a gap.',
  'Belum ada data bencana.': 'No disaster data yet.',
  'Kebutuhan {name}: {list} (data posko).': 'Needs for {name}: {list} (posko data).',
  'Kebutuhan {name}: {list}.': 'Needs for {name}: {list}.',
  '{need} — butuh {estimated}, terima {received}, kurang {gap}':
    '{need} — need {estimated}, received {received}, short {gap}',
  'Total {count} laporan intelijen tersimpan. {list}.':
    'A total of {count} intelligence reports are stored. {list}.',
  '{name}: {count} laporan warga': '{name}: {count} citizen reports',
  'Secara umum (panduan umum, bukan data DisasterWatch saat ini): ikuti arahan posko/BNPB setempat — amankan diri dan keluarga dulu, siapkan dokumen penting dan tas siaga, matikan listrik/gas bila terancam, dan hindari area berbahaya. Untuk kondisi spesifik wilayah Anda, tanyakan misalnya "wilayah mana yang paling prioritas?" berdasarkan data DisasterWatch saat ini.':
    'In general (general guidance, not current DisasterWatch data): follow the directions of the local posko/BNPB — secure yourself and your family first, prepare important documents and a go-bag, turn off electricity/gas if threatened, and avoid dangerous areas. For conditions specific to your area, ask for example "which region is the highest priority?" based on current DisasterWatch data.',
  'Saya menjawab dari DATA APLIKASI: {count} insiden aktif ({names}). Tanya misalnya: "daerah mana yang paling membutuhkan air bersih?", "berapa bantuan yang masih kurang?", atau "berapa laporan belum diverifikasi?"':
    'I answer from APP DATA: {count} active incidents ({names}). Ask for example: "which region needs clean water the most?", "how much aid is still lacking?", or "how many reports are unverified?"',

  // Need labels referenced by the assistant fallback (same values as the admin slice)
  'Air Bersih': 'Clean Water',
  'Makanan': 'Food',
  'Obat & Medis': 'Medicine & Medical',
  'Tempat Tinggal': 'Shelter',
  'Masker N95': 'N95 Mask',
  'Perahu / Evakuasi': 'Boat / Evacuation',
  'Genset / Listrik': 'Generator / Electricity',
  'Pakaian': 'Clothing',
};

export default services;
