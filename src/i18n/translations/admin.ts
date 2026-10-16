/** English translations — admin slice. Keys are the Indonesian source strings. */
const admin: Record<string, string> = {
  // Sidebar menu
  'Verifikasi Laporan': 'Report Verification',
  'Tinjau laporan warga dan pastikan informasi yang dibagikan dapat dipercaya.':
    'Review citizen reports and ensure the information shared can be trusted.',
  'Data Bencana': 'Disaster Data',
  'Telusuri catatan bencana yang tersimpan dalam database DisasterWatch.':
    'Browse disaster records stored in the DisasterWatch database.',
  'Status Layanan Aplikasi': 'Application Service Status',
  'Pantau koneksi API dan hasil pemeriksaan pipeline data.':
    'Monitor API connections and data pipeline check results.',
  'Status Token Usage': 'Token Usage Status',
  'Pantau pemakaian token yang dilaporkan oleh layanan AI.':
    'Monitor token usage reported by AI services.',

  // Report status labels
  'Belum ditinjau': 'Not reviewed',
  'Menunggu verifikasi': 'Awaiting verification',
  'Perlu perhatian': 'Needs attention',
  'Terverifikasi': 'Verified',
  'Ditolak': 'Rejected',

  // Shared module helpers
  'Terjadi kesalahan. Silakan coba lagi.': 'Something went wrong. Please try again.',
  'DisasterWatch beranda': 'DisasterWatch home',
  'Sesi berakhir. Silakan login kembali.': 'Your session has expired. Please sign in again.',
  'Login Admin · DisasterWatch': 'Admin Login · DisasterWatch',

  // Login screen
  'Memeriksa sesi admin…': 'Checking admin session…',
  'Portal Verificator': 'Verifier Portal',
  'Informasi terpercaya.': 'Trusted information.',
  'Respons lebih tepat.': 'More precise response.',
  'Ruang kerja tim verificator untuk meninjau laporan dan menjaga kualitas informasi bencana.':
    'A workspace for the verifier team to review reports and maintain the quality of disaster information.',
  'Verifikasi manusia untuk setiap laporan.': 'Human verification for every report.',
  'Pantau data dan layanan dalam satu tempat.': 'Monitor data and services in one place.',
  'Selamat datang kembali': 'Welcome back',
  'Masuk untuk mengakses dashboard admin.': 'Sign in to access the admin dashboard.',
  'Username': 'Username',
  'Masukkan username': 'Enter username',
  'Password': 'Password',
  'Masukkan password': 'Enter password',
  'Sembunyikan password': 'Hide password',
  'Tampilkan password': 'Show password',
  'Memproses…': 'Processing…',
  'Masuk ke dashboard': 'Sign in to dashboard',
  'Akses khusus tim verificator DisasterWatch':
    'Exclusive access for the DisasterWatch verifier team',
  'DisasterWatch · Bersama, lebih siap menghadapi bencana.':
    'DisasterWatch · Together, more prepared for disasters.',

  // Dashboard chrome
  'Lewati ke konten': 'Skip to content',
  'Pengguna Admin': 'Admin User',
  'Verificator': 'Verifier',
  'Logout': 'Logout',
  'Menu dashboard': 'Dashboard menu',
  'RUANG KERJA': 'WORKSPACE',
  'Menu admin': 'Admin menu',
  'Setiap laporan berarti.': 'Every report matters.',
  'Periksa sumber dan detail sebelum memberikan persetujuan.':
    'Check the source and details before giving approval.',
  'Kembali ke halaman publik': 'Back to public page',
  'Dashboard': 'Dashboard',
  'Mode demo lokal': 'Local demo mode',
  'Data simulasi. Persetujuan hanya berlaku sampai server dimulai ulang.':
    'Simulated data. Approvals are only valid until the server restarts.',
  'Memuat status layanan…': 'Loading service status…',

  // Records list
  'Laporan sesuai filter': 'Reports matching filter',
  'Total catatan dalam koleksi': 'Total records in collection',
  'Ditampilkan di halaman ini': 'Shown on this page',
  'Terverifikasi di halaman ini': 'Verified on this page',
  'Sumber data': 'Data source',
  'Demo': 'Demo',
  'Daftar laporan': 'Report list',
  'Daftar bencana': 'Disaster list',
  'Buka detail untuk memeriksa dan menyetujui laporan.':
    'Open a detail to review and approve a report.',
  'Pilih koleksi untuk melihat data bencana yang tersedia.':
    'Select a collection to view available disaster data.',
  'Muat ulang': 'Reload',
  'Cari pada halaman ini': 'Search on this page',
  'Cari pada halaman ini…': 'Search on this page…',
  'Filter status laporan': 'Report status filter',
  'Semua status': 'All statuses',
  'Koleksi bencana': 'Disaster collection',
  'Bencana dashboard': 'Dashboard disasters',
  'Insiden pipeline': 'Pipeline incidents',
  'Memuat data…': 'Loading data…',
  'Coba lagi': 'Try again',
  'Tidak ada hasil pencarian': 'No search results',
  'Belum ada data': 'No data yet',
  'Coba kata kunci lain atau kosongkan pencarian.':
    'Try another keyword or clear the search.',
  'Data akan tampil di sini setelah tersedia. Anda juga bisa mengubah filter.':
    'Data will appear here once available. You can also change the filter.',
  'Laporan & lokasi': 'Report & location',
  'Pelapor': 'Reporter',
  'Waktu laporan': 'Report time',
  'Status': 'Status',
  'Aksi': 'Action',
  'Nama bencana': 'Disaster name',
  'Lokasi': 'Location',
  'Kategori': 'Category',
  'Waktu': 'Time',
  'ID catatan': 'Record ID',
  'Lokasi belum tersedia': 'Location not yet available',
  'Tidak diketahui': 'Unknown',
  'Tinjau': 'Review',
  'DEMO · data simulasi': 'DEMO · simulated data',
  'REAL · data kejadian': 'REAL · incident data',
  'Asal data belum diketahui': 'Data origin unknown',
  ' · titik REAL terhubung': ' · connected REAL point',
  'Data simulasi': 'Simulated data',
  'Data bencana': 'Disaster data',
  'Lihat detail': 'View detail',
  '{count} catatan · Halaman {page}': '{count} records · Page {page}',
  'Halaman sebelumnya': 'Previous page',
  'Halaman berikutnya': 'Next page',
  'Keputusan fact-check berhasil disimpan.': 'Fact-check decision saved successfully.',

  // Disaster detail dialog
  'DETAIL BENCANA': 'DISASTER DETAIL',
  'Tutup detail bencana': 'Close disaster detail',
  'Waktu kejadian': 'Event time',
  'Ringkasan': 'Summary',
  'Sumber berita dan data': 'News and data sources',
  'Buka sumber': 'Open source',
  'Belum ada tautan sumber yang tercatat.': 'No source links recorded yet.',
  'Tutup': 'Close',
  'Sumber data bencana': 'Disaster data source',
  'Bukti tersimpan oleh verifikator': 'Evidence saved by the verifier',

  // Review dialog
  'DETAIL LAPORAN': 'REPORT DETAIL',
  'Laporan warga': 'Citizen report',
  'Tutup detail laporan': 'Close report detail',
  'DEMO — approve/tolak disimpan ke laporan simulasi di Firestore. Tidak membuat atau mengubah marker bencana real. Berita pendukung opsional untuk latihan.':
    'DEMO — approve/reject is saved to a simulated report in Firestore. It does not create or change a real disaster marker. Supporting news is optional for practice.',
  'Dilaporkan': 'Reported',
  'ID laporan': 'Report ID',
  'Keyakinan AI': 'AI confidence',
  'bukan verifikasi manusia': 'not human verification',
  'Belum tersedia': 'Not yet available',
  'Isi laporan': 'Report content',
  'Buka sumber laporan': 'Open report source',
  'Buka bukti lampiran': 'Open attachment evidence',
  'Kebutuhan yang teridentifikasi': 'Identified needs',
  'Laporan sudah berstatus terverifikasi. Riwayat persetujuan manusia belum tercatat.':
    'The report is already verified. No human approval history is recorded.',
  'Laporan ditolak. Marker bencana terkait disembunyikan.':
    'Report rejected. The related disaster marker is hidden.',
  'Catatan fact-check': 'Fact-check note',
  '(opsional untuk persetujuan)': '(optional for approval)',
  'Tambahkan hasil pengecekan sumber atau konteks laporan…':
    'Add the result of source checking or report context…',
  'Bukti pilihan verifikator ({count} terpilih)': 'Verifier-selected evidence ({count} selected)',
  'Berita pendukung — pilih 1–3 berita ({count}/3)':
    'Supporting news — select 1–3 articles ({count}/3)',
  'Memuat berita pendukung…': 'Loading supporting news…',
  'Belum ada berita pendukung yang cocok. Laporan belum dapat disetujui; pilihan Tolak tetap tersedia.':
    'No matching supporting news yet. The report cannot be approved yet; the Reject option remains available.',
  'Pilih bukti: {name}': 'Select evidence: {name}',
  'Provinsi titik': 'Point province',
  'Pilih provinsi': 'Select province',
  'Latitude titik': 'Point latitude',
  'Longitude titik': 'Point longitude',
  'Disetujui {name} · {date}': 'Approved by {name} · {date}',
  'Tolak laporan': 'Reject report',
  'Menyimpan…': 'Saving…',
  'Setujui laporan': 'Approve report',
  'Penolakan menyembunyikan marker bencana terkait. Tentukan alasan berdasarkan pemeriksaan Anda.':
    'Rejection hides the related disaster marker. Choose a reason based on your review.',
  'Alasan penolakan': 'Rejection reason',
  'Tidak ada bencana di titik ini': 'No disaster at this point',
  'Laporan hoaks': 'Hoax report',
  'Catatan penolakan (minimal 10 karakter)': 'Rejection note (minimum 10 characters)',
  'Batal': 'Cancel',
  'Konfirmasi penolakan': 'Confirm rejection',
  'Belum ada kejadian yang cocok untuk memuat berita pendukung.':
    'No matching incident to load supporting news.',
  'Berita Firestore gagal dimuat; menampilkan berita snapshot jika tersedia.':
    'Failed to load Firestore news; showing snapshot news if available.',
  'Centang 1–3 berita pendukung sebelum menyetujui laporan.':
    'Check 1–3 supporting articles before approving the report.',
  'Catatan tambahan minimal 10 karakter, atau kosongkan untuk menggunakan ringkasan bukti terpilih.':
    'The additional note must be at least 10 characters, or leave it empty to use the summary of the selected evidence.',
  'Isi alasan penolakan minimal 10 karakter.':
    'Enter a rejection reason of at least 10 characters.',

  // Identified needs
  'Air Bersih': 'Clean Water',
  'Makanan': 'Food',
  'Obat & Medis': 'Medicine & Medical',
  'Tempat Tinggal': 'Shelter',
  'Masker N95': 'N95 Mask',
  'Perahu / Evakuasi': 'Boat / Evacuation',
  'Genset / Listrik': 'Generator / Electricity',
  'Pakaian': 'Clothing',

  // Token usage
  'Gagal membaca aiUsage. Periksa koneksi dan publikasikan Firestore Rules terbaru.':
    'Failed to read aiUsage. Check the connection and publish the latest Firestore Rules.',
  'Cakupan: Firestore aiUsage': 'Scope: Firestore aiUsage',
  'Maksimal 1.000 panggilan terbaru dari crawler dan browser pengguna yang login. Metadata browser dilaporkan oleh klien; metadata crawler dicatat server. Bukan total tagihan proyek. Diperbarui setiap 30 detik.':
    "The latest 1,000 calls from the crawler and signed-in users' browsers. Browser metadata is reported by the client; crawler metadata is recorded by the server. Not the project's billing total. Updated every 30 seconds.",
  'Total token tercatat': 'Total tokens recorded',
  'Token input': 'Input tokens',
  'Token output': 'Output tokens',
  'Riwayat penggunaan AI': 'AI usage history',
  'Jumlah aktual yang dikembalikan provider. Total dapat mencakup token penalaran.':
    'Actual amounts returned by the provider. Totals may include reasoning tokens.',
  'Periode penggunaan token': 'Token usage period',
  '24 jam terakhir': 'Last 24 hours',
  '7 hari terakhir': 'Last 7 days',
  '30 hari terakhir': 'Last 30 days',
  'Data token belum dapat dibaca': "Token data can't be read yet",
  'Memuat penggunaan token…': 'Loading token usage…',
  'Mengambil catatan dari Firestore.': 'Fetching records from Firestore.',
  'Model': 'Model',
  'Input': 'Input',
  'Output': 'Output',
  'Total': 'Total',
  'Belum ada penggunaan token tercatat': 'No token usage recorded yet',
  'Catatan muncul setelah panggilan Gemini baru berhasil dan metadata tersimpan di Firestore. Riwayat sebelum pencatatan diaktifkan tidak tersedia.':
    'Records appear after a new successful Gemini call and metadata is stored in Firestore. History from before logging was enabled is unavailable.',

  // Default review notes composed by AdminPage
  'Persetujuan simulasi DEMO untuk latihan verifikasi; tidak menerbitkan titik peta.':
    'DEMO simulation approval for verification practice; does not publish a map point.',
  'Disetujui berdasarkan {n} berita pendukung setelah pemeriksaan lokasi dan kejadian.':
    'Approved based on {n} supporting news articles after checking the location and event.',

  // admin/firebaseApi.ts — errors and notices surfaced in the admin UI
  'Silakan login sebagai superuser.': 'Please sign in as a superuser.',
  'Profil superuser belum aktif atau belum terhubung dengan Firebase Auth.':
    'The superuser profile is not active yet or is not linked to Firebase Auth.',
  'Username atau password salah.': 'Incorrect username or password.',
  'Login ditolak. Periksa akun superuser dan Email/Password provider.':
    'Sign-in denied. Check the superuser account and the Email/Password provider.',
  'Firebase Auth superuser dan akses Firestore berhasil.':
    'Firebase Auth superuser and Firestore access succeeded.',
  'Koleksi tidak valid.': 'Invalid collection.',
  'ID tidak valid.': 'Invalid ID.',
  'Laporan demo tidak ditemukan.': 'Demo report not found.',
  'Laporan sudah diputuskan dan tidak dapat diubah.':
    'The report has already been decided and cannot be changed.',
  'Status berubah. Muat ulang daftar.': 'The status changed. Reload the list.',
  'Data tidak ditemukan.': 'Data not found.',
  'Laporan demo tidak dapat digunakan untuk menolak kejadian nyata.':
    'A demo report cannot be used to reject a real event.',
  'Titik demo tidak dapat diputuskan sebagai kejadian nyata.':
    'A demo point cannot be decided as a real event.',
  'Data demo tidak dapat disetujui sebagai kejadian nyata.':
    'Demo data cannot be approved as a real event.',
  'Koordinat tidak sesuai provinsi. Koreksi data lokasi sebelum menyetujui titik ini.':
    'Coordinates do not match the province. Correct the location data before approving this point.',
  'Titik ini sudah ditolak. Persetujuan laporan lain tidak dapat mengaktifkannya kembali.':
    'This point has already been rejected. Approving another report cannot reactivate it.',
  'Titik baru memerlukan koordinat yang telah diperiksa.':
    'A new point requires verified coordinates.',
  'Titik baru memerlukan provinsi yang dikenali dan koordinat yang sesuai wilayahnya.':
    'A new point requires a recognized province and coordinates that match its region.',
  'Endpoint tidak tersedia.': 'Endpoint not available.',

  // admin/api.ts (legacy Express adapter)
  'API admin belum tersedia. Jalankan server admin terlebih dahulu.':
    'The admin API is not available yet. Start the admin server first.',
  'Permintaan gagal.': 'Request failed.',

  // admin/reviewPolicy.ts — validation messages shown in the review form
  'Isi catatan fact-check minimal 10 karakter dan 1–3 tautan bukti HTTPS.':
    'Enter a fact-check note of at least 10 characters and 1–3 HTTPS evidence links.',
  'Tautan bukti harus berupa URL sumber HTTPS yang valid.':
    'Evidence links must be valid HTTPS source URLs.',
  'Pilih alasan penolakan dan isi catatan fact-check minimal 10 karakter.':
    'Choose a rejection reason and enter a fact-check note of at least 10 characters.',
  'Maksimal 5 tautan bukti.': 'Maximum 5 evidence links.',
  'Tautan bukti harus berupa URL HTTPS yang valid.': 'Evidence links must be valid HTTPS URLs.',

  // AdminPage login card — evaluator (jury) credentials
  'Akses juri · simulasi approval': 'Evaluator access · approval simulation',
  'Akun demo untuk mencoba alur verifikasi laporan dan approval titik bencana. Hak aksesnya sama dengan admin.':
    'Demo account for trying the report verification and disaster-point approval flow. It holds the same access as admin.',
  'Akun ini dapat mengubah data produksi. Gunakan hanya selama sesi penilaian.':
    'This account can change production data. Use it only during the evaluation session.',
};

export default admin;
