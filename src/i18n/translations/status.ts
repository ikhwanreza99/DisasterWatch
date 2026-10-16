/** English translations — status slice. Keys are the Indonesian source strings. */
const status: Record<string, string> = {
  'Progres pemeriksaan layanan': 'Service check progress',
  'Memeriksa layanan · {done}/{total} tahap · {percent}%': 'Checking services · {done}/{total} steps · {percent}%',
  'Pemeriksaan selesai · 100%': 'Checks finished · 100%',

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
  'Google Air Quality · UAQI kota': 'Google Air Quality · City UAQI',
  'Respons Air Quality API valid untuk Jakarta; UAQI {aqi} ({category}).':
    'Valid Air Quality API response for Jakarta; UAQI {aqi} ({category}).',
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

  // API key security panel (GoogleStatusPage) — build-time evidence only.
  'Keamanan kunci API': 'API key security',
  'Ringkasan kebijakan kunci. Tidak ada nilai kunci yang ditampilkan di halaman ini.':
    'Key policy summary. No key value is shown on this page.',
  'Kunci server di bundel browser': 'Server keys in the browser bundle',
  'Tidak ditemukan: guard otomatis memindai bundel saat build.':
    'None found: an automatic guard scans the bundle at build time.',
  'Transport AI': 'AI transport',
  'Firebase AI Logic; kunci Gemini tidak pernah dikirim ke browser.':
    'Firebase AI Logic; the Gemini key is never sent to the browser.',
  'Data titik panas FIRMS': 'FIRMS hotspot data',
  'Lewat proxy server atau snapshot statis; MAP_KEY tidak ada di browser.':
    'Served via a server proxy or a static snapshot; the MAP_KEY is not in the browser.',
  'Kunci yang memang publik': 'Keys that are public by design',
  'Google Maps dan Firebase web API key dibatasi referrer, API restriction, dan App Check.':
    'The Google Maps and Firebase web API keys are restricted by referrer, API restriction, and App Check.',
  'Bukti build: {date} · {count} file bundel dipindai · guard otomatis lulus.':
    'Build evidence: {date} · {count} bundle files scanned · automatic guard passed.',

  // Technical compliance checklist (GoogleStatusPage) — AI Builder Cup 2026.
  'Kesesuaian teknis · AI Builder Cup 2026': 'Technical compliance · AI Builder Cup 2026',
  'Ringkasan aturan teknis (bagian B & C) berbasis bukti nyata halaman ini dan bukti build. Tanpa klaim yang tidak terverifikasi.':
    'Technical rules summary (sections B & C) based on real evidence from this page and the build evidence. No unverified claims.',
  'Terpenuhi': 'Met',
  'Perlu tindakan': 'Action needed',
  'Deploy di Firebase atau Cloud Run': 'Deployed on Firebase or Cloud Run',
  'Situs ini dilayani dari produksi (Firebase Hosting) pada origin ini.':
    'This site is served from production (Firebase Hosting) on this origin.',
  'API server berjalan di Cloud Run': 'API server running on Cloud Run',
  'Proxy /api/ai menjawab uji dari layanan server.':
    'The /api/ai proxy answered a test from the server service.',
  'Endpoint /api/health menjawab JSON dari layanan server.':
    'The /api/health endpoint answered JSON from the server service.',
  'Belum aktif. Aplikasi tetap berfungsi lewat Firebase AI Logic (jalur utama) dan snapshot statis FIRMS.':
    'Not active yet. The app still works through Firebase AI Logic (primary) and the static FIRMS snapshot.',
  'Gemini dipakai minimal untuk reasoning': 'Gemini used at least for reasoning',
  'Firebase AI Logic menjawab uji generateContent.':
    'Firebase AI Logic answered a generateContent test.',
  'Uji langsung perlu login Google di halaman ini. Fitur analisis memakai Firebase AI Logic (Gemini).':
    'A direct test requires Google sign-in on this page. Analysis features use Firebase AI Logic (Gemini).',
  'Belum diuji': 'Not tested yet',
  'Cloud Firestore untuk data dokumen': 'Cloud Firestore for document data',
  'Baca Firestore dari server berhasil pada sesi ini.':
    'A server-side Firestore read succeeded in this session.',
  'Belum ada bukti baca Firestore pada sesi ini.':
    'No Firestore read evidence in this session yet.',
  'Kunci API di server, tidak ada di bundel browser':
    'API keys on the server, not in the browser bundle',
  'Guard build memindai {count} file bundel; tidak ada kunci server.':
    'The build guard scanned {count} bundle files; no server key found.',
  'Bukti build belum tersedia.': 'Build evidence is not available yet.',
  'URL bawaan Firebase (bukan custom domain)': 'Default Firebase URL (no custom domain)',
  'Origin ini memakai domain bawaan Firebase.':
    'This origin uses a default Firebase domain.',
  'Origin ini bukan domain bawaan Firebase; pertimbangkan memakai URL bawaan saat submission.':
    'This origin is not a default Firebase domain; consider submitting the default URL.',
  'Prototipe tetap online selama penjurian': 'Prototype stays online throughout judging',
  'Halaman ini dimuat dari produksi. Laporan build: {date}.':
    'This page loaded from production. Build report: {date}.',
  'Nilai plus': 'Bonus points',
  'Solusi teknis nyata yang bisa ditonjolkan saat penjurian.':
    'Genuine technical solutions worth highlighting during judging.',
  'Kunci API dipindahkan ke proxy server; bundel browser tidak lagi memuat kunci Gemini/FIRMS.':
    'API keys moved to a server proxy; the browser bundle no longer contains the Gemini/FIRMS keys.',
  'Guard otomatis anti-bocor: build gagal bila kunci server terdeteksi di bundel.':
    'Automatic leak guard: the build fails if a server key is detected in the bundle.',
  'Rate limit per IP dan allowlist origin pada proxy publik.':
    'Per-IP rate limiting and an origin allow-list on the public proxy.',
  'Transport AI bertingkat: Firebase AI Logic → proxy server → fallback deterministik (tidak pernah crash).':
    'Layered AI transport: Firebase AI Logic → server proxy → deterministic fallback (never crashes).',
  'Snapshot statis dan cache: FIRMS, VAAC, berita, dan status tetap tersedia saat upstream down.':
    'Static snapshots and caching: FIRMS, VAAC, news and status stay available when upstream is down.',
  'Antarmuka dua bahasa (Indonesia/Inggris) dengan pilihan tersimpan.':
    'Bilingual interface (Indonesian/English) with a saved preference.',

  // Calculation Verification Center (/calculation) — internal evidence page.
  'Verifikasi Perhitungan': 'Calculation Verification',
  'Setiap cek mengeksekusi fungsi perhitungan asli dan membandingkan aktual vs ekspektasi. Status tidak pernah diberikan hanya karena fungsi atau komponen ada. Contoh berlabel simulasi; bukan data resmi.':
    'Each check executes the real calculation function and compares actual vs expected. Status is never granted merely because a function or component exists. Examples are labelled simulation; not official data.',
  'Lolos verifikasi': 'Passed verification',
  'Gagal — perlu perbaikan': 'Failed — needs a fix',
  'Sebagian terverifikasi': 'Partially verified',
  'Belum diverifikasi (butuh sesi live)': 'Not verified (needs a live session)',
  'Belum diimplementasikan': 'Not implemented',
  'Data kurang': 'Insufficient data',
  'Lolos': 'Pass',
  'Sebagian': 'Partial',
  'Belum diverifikasi': 'Not verified',
  'Simulasi — bukan data resmi': 'Simulation — not official data',
  'Live — read-only': 'Live — read-only',
  'uji kode': 'code test',
  'integrasi sintetis': 'synthetic integration',
  'baca-live': 'live read',
  'Estimasi Kerugian Bencana': 'Disaster Loss Estimation',
  'Estimasi Kesenjangan Pemulihan': 'Recovery Gap Estimation',
  'Persentase Pemulihan Utilitas': 'Utility Recovery Percentage',
  'Intelijen Kebutuhan & Skor Prioritas': 'Needs Intelligence & Priority Score',
  'Validasi Input & Provenans Data': 'Input Validation & Data Provenance',
  'Integrasi Firestore → UI': 'Firestore → UI Integration',
  '{pass} dari {total} cek lolos': '{pass} of {total} checks passed',
  'Provenans & versi': 'Provenance & versions',
  'Sumber kebenaran tunggal dan versi formula yang diverifikasi.':
    'Single source of truth and the verified formula versions.',
  'Probe live read-only (Firestore)': 'Live read-only probe (Firestore)',
  'Baca saja untuk insiden padang via repository yang ada. Tanpa tulis produksi.':
    'Read-only probe for the padang incident via the existing repository. No production writes.',
  'Memeriksa akses baca…': 'Checking read access…',
  'Registry live tetap NOT_VERIFIED; tidak ada angka yang diinventarisasi.':
    'The live registry check stays NOT_VERIFIED; no numbers are invented.',
  'Diperiksa {at}': 'Checked {at}',
  'Halaman internal untuk verifikasi implementasi. Bukan klaim kesiapan produksi. Cek live membutuhkan sesi browser dengan akses Firestore; selebihnya halaman ini deterministik dan dapat diuji ulang.':
    'Internal page for verifying the implementation. Not a production-readiness claim. Live checks need a browser session with Firestore access; the rest of this page is deterministic and re-runnable.',
};

export default status;
