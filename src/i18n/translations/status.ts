/** English translations — status slice. Keys are the Indonesian source strings. */
const status: Record<string, string> = {
  'Belum diperiksa': 'Not yet checked',
  'Laporan server terbaru dimuat. Untuk menjalankan uji Google Search baru, buka workflow dan aktifkan opsi Uji Google Search.':
    'The latest server report was loaded. To run a new Google Search test, open the workflow and enable the Test Google Search option.',
  'Browser ini': 'This browser',
  'Snapshot produksi': 'Production snapshot',
  'Hasil lebih dari 24 jam': 'Result older than 24 hours',
  'Mengambil laporan server terbaru…': 'Fetching the latest server report…',
  'Memuat…': 'Loading…',
  'Refresh Google Search': 'Refresh Google Search',
  'Muat hasil terbaru': 'Load latest results',
  'Uji ulang di server': 'Re-test on server',
  'GitHub → Run workflow → main': 'GitHub → Run workflow → main',
  ' → centang Uji SerpApi': ' → check Test SerpApi',
  ' → centang Uji Google Search': ' → check Test Google Search',
  '. Setelah selesai, muat hasil terbaru. Waktu hanya berubah setelah uji berhasil.':
    '. When finished, load the latest results. The time only changes after a successful test.',
  'Memeriksa...': 'Checking...',
  'Uji ulang Maps': 'Re-test Maps',
  'Perlu lampiran': 'Attachment required',
  'Uji ulang': 'Re-test',
  'Kembali ke peta': 'Back to map',
  'Status layanan aplikasi': 'Application service status',
  'Layanan Google yang berhasil diuji di aplikasi ini. Parameter tanpa hasil uji berhasil disembunyikan.':
    'Google services successfully tested in this application. Parameters without a successful test result are hidden.',
  'Memeriksa layanan...': 'Checking services...',
  'Muat ulang laporan': 'Reload report',
  'Menjalankan ulang pemeriksaan browser dan mengambil laporan backend terbaru...':
    'Re-running browser checks and fetching the latest backend report...',
  'Pemeriksaan ulang selesai. Waktu hasil setiap layanan tercantum di bawah; laporan backend mengikuti run GitHub Actions terakhir.':
    "Re-check complete. Each service's result time is listed below; the backend report follows the last GitHub Actions run.",
  '{count} berhasil diuji': '{count} successfully tested',
  'Bukti request atau snapshot valid': 'Valid request or snapshot evidence',
  '{count} layanan browser': '{count} browser services',
  'Hasil pemeriksaan browser yang berhasil': 'Successful browser check results',
  '{count} layanan backend': '{count} backend services',
  'Waktu uji terakhir tercantum pada setiap layanan': 'Last test time is listed for each service',
  'Pemeriksaan browser': 'Browser checks',
  'Origin: {origin}. Diuji otomatis saat halaman dibuka. Hasil request dipakai ulang selama 10 menit di tab ini; tidak memakai data simulasi.':
    'Origin: {origin}. Tested automatically when the page opens. Request results are reused for 10 minutes in this tab; no simulated data is used.',
  'Backend & pipeline data': 'Backend & pipeline data',
  'Laporan build: {date} · revisi {revision}. Muat ulang halaman tidak menjalankan crawler.':
    'Build report: {date} · revision {revision}. Reloading the page does not run the crawler.',
  'belum tersedia': 'not yet available',
  'Workflow crawler': 'Workflow crawler',
  'Status global Google AI': 'Google AI global status',
  'Halaman ini menunjukkan pemeriksaan aplikasi, bukan status global Google. Secret backend tidak dikirim ke browser. Hanya hasil uji berhasil yang ditampilkan. Login OAuth sampai selesai membutuhkan pengguna.':
    "This page shows application checks, not Google's global status. Backend secrets are not sent to the browser. Only successful test results are displayed. Completing OAuth login requires a user.",

  // Labels provided by services/status/model.ts
  'Berhasil diuji': 'Successfully tested',
  'Gagal': 'Failed',
  'Terpasang · belum diuji': 'Configured · not yet tested',
  'Nonaktif': 'Disabled',
  'Belum diketahui': 'Unknown',
  'Berhasil · data kosong': 'Success · empty data',
  'Memeriksa': 'Checking',
  'Periksa kuota dan batas request akun SerpApi. Tunggu sebelum menjalankan uji kembali.':
    'Check the SerpApi account quota and request limit. Wait before running the test again.',
  'Periksa GitHub Secret SERPAPI_API_KEY, akun SerpApi, dan status layanannya. Setelah mengganti key, jalankan workflow hosting dengan check_serpapi.':
    'Check the GitHub Secret SERPAPI_API_KEY, the SerpApi account, and its service status. After changing the key, run the hosting workflow with check_serpapi.',
  'Periksa Firestore Rules untuk koleksi incidentArticles. Backend Admin dan browser memakai jalur akses yang berbeda.':
    'Check the Firestore Rules for the incidentArticles collection. The Admin backend and the browser use different access paths.',
  'Periksa kuota, rate limit, dan billing proyek API di Google AI Studio / Google Cloud. Tunggu batas reset sebelum menguji ulang.':
    'Check the quota, rate limit, and billing of the API project in Google AI Studio / Google Cloud. Wait for the limit to reset before re-testing.',
  'Layanan sedang tidak tersedia atau sibuk. Coba ulang nanti; periksa status global Google AI.':
    'The service is currently unavailable or busy. Try again later; check the Google AI global status.',
  'Periksa autentikasi API key, konfigurasi Firebase AI Logic, dan App Check pada proyek ini.':
    'Check the API key authentication, Firebase AI Logic configuration, and App Check for this project.',
  'Periksa API yang diaktifkan, pembatasan API key/referrer, App Check, dan izin proyek.':
    'Check the enabled APIs, API key/referrer restrictions, App Check, and project permissions.',
  'Periksa nama model atau endpoint yang didukung proyek ini.':
    'Check the model or endpoint name supported by this project.',

  // Service names from services/status/browserChecks.ts
  'Google Maps JavaScript': 'Google Maps JavaScript',
  'Google Places · Autocomplete & Details': 'Google Places · Autocomplete & Details',
  'Google Weather · Kondisi sekarang': 'Google Weather · Current conditions',
  'Google Weather · Prakiraan': 'Google Weather · Forecast',
  'Firebase Auth · Google Login': 'Firebase Auth · Google Login',
  'Cloud Firestore · baca dari web': 'Cloud Firestore · read from web',
  'Firebase Storage · lampiran laporan': 'Firebase Storage · report attachments',
  'Firebase App Check · token': 'Firebase App Check · token',
  'Firebase AI Logic · Gemini': 'Firebase AI Logic · Gemini',
  'Gemini Developer API · fallback': 'Gemini Developer API · fallback',
  'Konfigurasi tersedia; belum ada bukti request berhasil dari halaman ini.':
    'Configuration available; no evidence of a successful request from this page yet.',
  'Konfigurasi browser belum tersedia.': 'Browser configuration is not available yet.',

  // Details and backend snapshot entries assembled on the status page
  'Google Search · uji langsung': 'Google Search · direct test',
  'Belum ada uji langsung. Run workflow Deploy dengan opsi “Uji Google Search” aktif.':
    'No direct test yet. Run the Deploy workflow with the “Test Google Search” option enabled.',
  'Google Maps menolak autentikasi. Periksa API aktif, referrer domain, billing, dan kuota.':
    'Google Maps rejected authentication. Check the enabled APIs, domain referrers, billing, and quota.',
  'Peta belum berhasil memuat dalam 20 detik.': 'The map did not finish loading within 20 seconds.',
  'Memuat peta Google...': 'Loading Google Maps...',
  'Mengirim pemeriksaan API...': 'Sending API check...',
  'Pemeriksaan otomatis sedang berjalan...': 'Automatic checks are running...',
  'Maps JavaScript gagal dimuat.': 'Maps JavaScript failed to load.',
  'Peta dan tile Google berhasil dirender di origin ini.':
    'Google Maps and tiles rendered successfully on this origin.',

  // Snapshot load failure (GoogleStatusPage)
  'Laporan backend belum tersedia atau gagal dimuat. Jalankan workflow Deploy untuk menerbitkannya.':
    'The backend report is not available yet or failed to load. Run the Deploy workflow to publish it.',
};

export default status;
