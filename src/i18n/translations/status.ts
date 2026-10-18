/** English translations — status slice. Keys are the Indonesian source strings. */
const status: Record<string, string> = {
  'Proxy AI server tidak tersedia untuk sesi anonim. Uji utama memakai Firebase AI Logic.': 'The server AI proxy is unavailable to anonymous sessions. The primary check uses Firebase AI Logic.',
  'Pemeriksaan otomatis selesai · {percent}% · {failed} gagal': 'Automatic checks finished · {percent}% · {failed} failed',
  'Uji Gemini berjalan otomatis tanpa login Google. {detail}': 'Gemini is tested automatically without Google sign-in. {detail}',
  'Firebase Auth · sesi pelaporan': 'Firebase Auth · reporting session',
  'Sesi Firebase untuk pelaporan tersedia; tidak memerlukan login Google. Tidak ada laporan uji yang dikirim.': 'A Firebase reporting session is available; Google sign-in is not required. No test report was submitted.',
  'Hasil pemeriksaan layanan, termasuk gagal, nonaktif, dan belum diuji. Progres 100% berarti pemeriksaan selesai, bukan semua layanan berhasil.': 'Service check results, including failures, disabled services and untested services. 100% means checks finished, not that every service succeeded.',
  'Halaman ini menunjukkan pemeriksaan aplikasi, bukan status global Google. Secret backend tidak dikirim ke browser. Hasil gagal dan nonaktif juga ditampilkan agar kendala dapat ditindaklanjuti. Uji Gemini tidak memerlukan login Google.': 'This page shows application checks, not global Google status. Backend secrets are not sent to the browser. Failed and disabled results are shown so issues can be addressed. Gemini checks do not require Google sign-in.',
  'Antarmuka dua bahasa (Indonesia/Inggris) dengan pilihan tersimpan.': 'Bilingual interface (Indonesian/English) with a saved preference.',
  'Threads · pencarian sosial media': 'Threads · social media search',
  'Gemini · Google Search': 'Gemini · Google Search',
  'SerpApi · Google News': 'SerpApi · Google News',
  'SerpApi · uji langsung': 'SerpApi · direct test',
  'Crawler berita · gate & hasil tersimpan': 'News crawler · gate & stored results',
  'Artikel Google · tampil di sidebar': 'Google articles · shown in sidebar',
  'Artikel SerpApi · tampil di sidebar': 'SerpApi articles · shown in sidebar',
  'Foto · dokumentasi kejadian': 'Photos · incident documentation',
  'Token backend tersedia. Request dan hasil publik belum dibuktikan oleh konfigurasi; crawler menjalankan satu pencarian per titik saat gate harian lolos.':
    'A backend token is available. Configuration alone does not confirm public requests or results; the crawler runs one search per location when the daily gate allows it.',
  'Tambahkan THREADS_ACCESS_TOKEN dari OAuth Meta dengan threads_basic dan threads_keyword_search.':
    'Add THREADS_ACCESS_TOKEN from Meta OAuth with threads_basic and threads_keyword_search.',
  'Dataset · {days} hari terakhir': 'Dataset · last {days} days',
  'Rentang {start}–{end} WIB (termasuk hari ini). BNPB snapshot tersaring: {regions} wilayah, {reports} laporan. Snapshot BNPB masih memerlukan impor sumber terbaru; filter bukan bukti pengambilan data baru.':
    'Date range: {start}–{end} WIB (including today). Filtered BNPB snapshot: {regions} areas, {reports} reports. The BNPB snapshot still needs an updated source import; filtering does not mean new data was fetched.',
  'DISASTERWATCH_GOOGLE_SEARCH_ENABLED belum true.': 'DISASTERWATCH_GOOGLE_SEARCH_ENABLED is not true.',
  'Key backend belum tersedia.': 'The backend key is not available.',
  'Aktif; model {model}. Key tersedia di backend.': 'Active; model {model}. The key is available on the backend.',
  'Tambahkan GitHub Secret SERPAPI_API_KEY untuk mengaktifkan provider.':
    'Add the SERPAPI_API_KEY GitHub secret to enable this provider.',
  'Key backend tersedia. Tiga pencarian per titik: kejadian, kebutuhan, dan penanggulangan/pemulihan.':
    'The backend key is available. Three searches per location: incidents, needs, and response/recovery.',
  'Google News berhasil: {count} artikel, {dated} bertanggal. Uji ini tidak menulis artikel atau melewati gate crawler.':
    'Google News succeeded: {count} articles, {dated} with dates. This test does not write articles or bypass the crawler gate.',
  'Permintaan Gemini selesai dengan Google Search: {count} sumber berkutip. Uji ini tidak menulis artikel ke Firestore dan tidak melewati gate crawler.':
    'Gemini completed a Google Search request: {count} cited sources. This test does not write articles to Firestore or bypass the crawler gate.',
  'Service account untuk laporan crawler belum tersedia.': 'The crawler report service account is not available.',
  'Terakhir: {outcome}. {schedule}. Artikel Gemini tersimpan: {geminiCount}; seluruh artikel: {articleCount}{runAt}':
    'Last run: {outcome}. {schedule}. Gemini articles stored: {geminiCount}; all articles: {articleCount}{runAt}',
  'belum ada run sukses': 'no successful run yet',
  'Sudah jatuh tempo': 'Due',
  'Tertahan interval {days} hari': 'Held by the {days}-day interval',
  ' Run sukses: {runAt}.': ' Successful run: {runAt}.',
  'Tersimpan {count} artikel Gemini. Sampel {sample}: {matched} sesuai kejadian, {review} perlu review. Tanpa tanggal publikasi yang cocok, hasil Gemini masuk review dan tidak otomatis tampil di feed utama.':
    '{count} Gemini articles stored. Sample of {sample}: {matched} match incidents, {review} need review. Without a matching publication date, Gemini results are sent for review and are not automatically shown in the main feed.',
  'Tersimpan {count} artikel. Sampel {sample}: {matched} sesuai kejadian, {review} perlu review. Berita digabung dengan sumber lain setelah pemeriksaan lokasi dan tanggal.':
    '{count} articles stored. Sample of {sample}: {matched} match incidents, {review} need review. News is merged with other sources after location and date checks.',
  'Snapshot produksi: {count} gauge Indonesia.': 'Production snapshot: {count} gauges in Indonesia.',
  'Snapshot banjir belum tersedia.': 'The flood snapshot is not available.',
  'Metadata foto tersedia untuk {available}/{total} titik. Memuat sumber dan tanggal laporan; keberhasilan render gambar di browser belum diuji oleh snapshot ini.':
    'Photo metadata is available for {available} of {total} locations. It includes sources and report dates; this snapshot has not tested whether images render in the browser.',
  '{count} foto dari folder BNPB yang bisa diakses. Folder privat/hasil kosong memakai fallback berita.':
    '{count} photos are available from the accessible BNPB folder. Private or empty result folders fall back to news.',
  'Autocomplete dan Place Details berhasil; {count} saran.':
    'Autocomplete and Place Details succeeded; {count} suggestions.',
  'Autocomplete berhasil; tidak ada saran lokasi.':
    'Autocomplete succeeded; no location suggestions were found.',
  'Respons Weather API valid untuk Jakarta; tidak memakai cuaca simulasi.':
    'Valid Weather API response for Jakarta; simulated weather is not used.',
  'Kualitas udara rendah': 'Low air pollution',
  'Baca Firestore dari server berhasil; sampel {count} artikel.':
    'Firestore server read succeeded; {count} sample articles.',
  'Bucket terkonfigurasi. Upload/download membutuhkan pengguna login dan lampiran; tidak mengunggah file uji otomatis.':
    'The bucket is configured. Uploads and downloads require a signed-in user and an attachment; no test file is uploaded automatically.',
  'Uji peta melalui tombol “Uji Maps” pada halaman status.':
    'Test the map using the “Test Maps” button on the status page.',
  'Batas waktu pemeriksaan habis': 'The check timed out',
  'Permintaan gagal; periksa akses, jaringan, atau kuota':
    'The request failed; check access, network, or quota',

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
  'Status layanan': 'Service status',
  'Status workflow & deploy': 'Workflow status & deploy',
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
  'Uji Google Search ditolak (HTTP 403). Pastikan secret DISASTERWATCH_GEMINI_SEARCH_KEY valid, Gemini API aktif di proyek key tersebut, dan pembatasan key mengizinkan request dari GitHub Actions.':
    'The Google Search test was denied (HTTP 403). Verify that the DISASTERWATCH_GEMINI_SEARCH_KEY secret is valid, the Gemini API is enabled in that key’s project, and the key restrictions allow requests from GitHub Actions.',
  'Peta tidak selesai dimuat dalam 20 detik. Pastikan Maps JavaScript API aktif, key VITE_GOOGLE_MAPS_API_KEY mengizinkan origin situs ini, serta billing dan kuota tersedia. Jika muncul 403 App Check/reCAPTCHA, periksa site key dan domain yang diizinkan.':
    'The map did not finish loading within 20 seconds. Verify that the Maps JavaScript API is enabled, the VITE_GOOGLE_MAPS_API_KEY allows this site origin, and billing and quota are available. If App Check/reCAPTCHA returns 403, check the site key and allowed domains.',

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
  'Bukti eksekusi layanan (sintetis)': 'Service execution proof (synthetic)',
  'Layanan calculationService.runCalculation memanggil fungsi produksi pada fixture berlabel. Nilai di bawah adalah return value aktual, bukan angka tampilan. {pass} dari {total} goldens cocok.':
    'The calculationService.runCalculation service calls production functions on labeled fixtures. Values below are actual return values, not display numbers. {pass} of {total} goldens match.',
  'Estimasi skenario': 'Scenario estimate',
  'Prakiraan': 'Forecast',
  'Konflik — perlu telaah': 'Conflict — needs review',
  'Data basi': 'Stale data',
  'Siap dihitung': 'Ready to calculate',
  'Terhambat': 'Blocked',
  'Tidak tersedia': 'Not available',
  'Insiden:': 'Incident:',
  'Kurang:': 'Missing:',
  'Ada:': 'Available:',
  'simulasi/demo': 'simulation/demo',
  'Pilih insiden live': 'Select live incident',
  'Kesiapan live per metrik:': 'Live readiness per metric:',
  '{ready} siap · {blocked} terhambat · {na} tidak tersedia': '{ready} ready · {blocked} blocked · {na} unavailable',
  'dokumen humaniter terbaca untuk insiden ini': 'humanitarian documents read for this incident',
  'Mode live read-only (Firestore)': 'Live read-only mode (Firestore)',
  'Baca saja via repository yang ada. Tanpa tulis produksi. Hasil sintetis tidak pernah ditampilkan sebagai hasil live.':
    'Read-only via the existing repository. No production writes. Synthetic results are never shown as live results.',
  'Tidak ada insiden yang dapat dibaca dari Firestore pada sesi ini.': 'No incidents could be read from Firestore in this session.',
  'dihasilkan layanan calculationService.runCalculation dari fungsi produksi, bukan nilai tampilan':
    'produced by the calculationService.runCalculation service from production functions, not display values',
  'Data Requirements & Availability': 'Data Requirements & Availability',
  'Inventaris kebutuhan tiap perhitungan vs ketersediaan aktual di Firestore. Formula benar dan data tersedia adalah dua dimensi terpisah.':
    'Inventory of each calculation\u2019s requirements vs actual Firestore availability. Formula correctness and data availability are separate dimensions.',
  'Audit berjalan sesi ini': 'Audit ran this session',
  'Cakupan: {n} dokumen per koleksi (batas 50–200, filter insiden) untuk {incident}; kesimpulan hanya untuk cakupan itu, bukan seluruh database.':
    'Scope: {n} documents per collection (limits 50–200, incident-filtered) for {incident}; conclusions cover that scope only, not the whole database.',
  'Audit database belum berjalan pada sesi ini — buka mode live dengan akses Firestore.':
    'The database audit has not run in this session — open live mode with Firestore access.',
  'Periksa ulang': 'Recheck',
  'Ringkasan inventaris:': 'Inventory summary:',
  '{total} kebutuhan ({mandatory} wajib). Tersedia {a} · Sebagian {p} · Hilang {m} · Tidak valid {i} · Konflik {c} · Belum diperiksa {n} · Tidak berlaku {na}.':
    '{total} requirements ({mandatory} mandatory). Available {a} · Partial {p} · Missing {m} · Invalid {i} · Conflict {c} · Not checked {n} · Not applicable {na}.',
  'Kesiapan metrik:': 'Metric readiness:',
  'Cakupan = kebutuhan wajib yang valid / total kebutuhan wajib. Cakupan adalah kelengkapan data, bukan skor kepercayaan.':
    'Coverage = valid mandatory requirements / total mandatory requirements. Coverage is data completeness, not a confidence score.',
  'Metrik:': 'Metric:',
  'Hasil:': 'Result:',
  'Dokumen:': 'Documents:',
  'Sumber:': 'Sources:',
  'Baseline:': 'Baselines:',
  'Dihitung:': 'Calculated at:',
  'Peringatan:': 'Warnings:',
  'Hasil live Firestore ({n} grup klaim):': 'Live Firestore results ({n} claim groups):',
  'rekonsiliasi klaim terkuantifikasi per tipe+satuan; relasi diturunkan transparan, lineage tercatat.':
    'reconciliation of quantified claims per type+unit; relations derived transparently, lineage recorded.',
  'rekonsiliasi klaim': 'claim reconciliation',
  'Tidak ada klaim terkuantifikasi pada insiden ini — tidak ada kalkulasi live yang dapat dijalankan. Metrik lain menunjukkan pemblokirnya di bawah.':
    'No quantified claims for this incident — no live calculation can run. Other metrics show their blockers below.',
  'Pemulihan layanan live ({n} observasi):': 'Live service recovery ({n} observations):',
  'pemulihan': 'recovery',
  'kriteria:': 'criterion:',
  'kriteria tidak dinyatakan': 'criterion unstated',
  'Belum ada observasi pemulihan terhitung pada insiden ini. Yang kurang: {missing}':
    'No countable recovery observations for this incident yet. Missing: {missing}',
  'affectedCount/restoredCount dengan satuan eksplisit per layanan (recovery.affectedCount/restoredCount)':
    'affectedCount/restoredCount with explicit per-service units (recovery.affectedCount/restoredCount)',
  'Semua metrik': 'All metrics',
  'Status:': 'Status:',
  'cakupan {num}/{den} · pemblokir: {b}': 'coverage {num}/{den} · blockers: {b}',
  'Lihat bukti verifikasi': 'See verification evidence',
  'Data yang dibutuhkan': 'Required data item',
  'Sumber Firestore': 'Firestore source',
  'Ketersediaan': 'Availability',
  'Valid/total': 'Valid/total',
  'Satuan': 'Unit',
  'Blokir?': 'Blocking?',
  'Ya': 'Yes',
  'Tidak': 'No',
  'opsional': 'optional',
  'Tersedia': 'Available',
  'Tidak valid': 'Invalid',
  'Basi': 'Stale',
  'Konflik': 'Conflict',
  'Tidak berlaku': 'Not applicable',
  'Observasi': 'Observed',
  'Baseline': 'Baseline',
  'Parameter': 'Parameter',
  'Turunan': 'Derived',
  'Terpenuhi: {ids}. Jalankan via calculationService.runCalculation dengan input tervalidasi untuk output live.':
    'Satisfied: {ids}. Run via calculationService.runCalculation with validated inputs for live output.',
  'Legenda sumber: Observasi = fakta terukur; Baseline = nilai acuan eksplisit; Parameter = konstanta versi di kode; Turunan = dihitung saat kalkulasi. Audit hanya membaca; tidak menulis, memigrasi, atau seed data.':
    'Source legend: Observed = measured facts; Baseline = explicit reference values; Parameter = versioned constants in code; Derived = computed at calculation time. The audit only reads; it never writes, migrates, or seeds data.',
  // Metric-level visibility layer (Calculation Overview / Metric Explorer / Blocked).
  'Ikhtisar mesin perhitungan': 'Calculation engine overview',
  'Hitungan tingkat metrik yang diturunkan dari layanan perhitungan, registri verifikasi, dan adaptor live — bukan angka yang di-hardcode. Verifikasi sintetis dan hasil live adalah dua dimensi terpisah.':
    'Metric-level counts derived from the calculation service, verification registry, and live adapter — not hardcoded numbers. Synthetic verification and live results are two separate dimensions.',
  'Metrik dilacak': 'Metrics tracked',
  'Formula terimplementasi': 'Formulas implemented',
  'Formula dengan uji lolos': 'Formulas with passing tests',
  'Terhitung dari data live': 'Calculated from live data',
  'Terhambat kebutuhan data': 'Blocked by data requirements',
  'Konflik/input tidak valid': 'Conflicts/invalid inputs',
  'Metrik terhitung live hanya bila dokumentasi Firestore menyuplai seluruh input wajib; sisanya ditahan dengan pemblokir eksplisit di bawah.':
    'A metric is calculated live only when Firestore documents supply every mandatory input; the rest are withheld with explicit blockers below.',
  'Penjelajah metrik': 'Metric explorer',
  'Setiap metrik dengan status implementasi, uji, kesiapan live, hasil terbaru, satuan, pemblokir, sumber, dan waktu. Pilih metrik untuk detail lengkap.':
    'Every metric with implementation, test, live-readiness status, latest result, unit, blockers, source, and time. Select a metric for full detail.',
  'Terhitung': 'Calculated',
  'Verifikasi sintetis': 'Synthetic verification',
  'Cari metrik…': 'Search metrics…',
  'Cari metrik': 'Search metrics',
  'Tidak ada metrik yang cocok dengan filter ini.': 'No metric matches this filter.',
  'Metrik terhambat & input yang dibutuhkan': 'Blocked metrics & required inputs',
  'Setiap metrik terhambat menjelaskan alasan tepat dan tindakan berikutnya. “Data tidak tersedia” tidak cukup.':
    'Every blocked metric states the exact reason and the next action. “Data unavailable” is not enough.',
  'modul': 'module',
  'Uji': 'Tests',
  'Tanpa uji': 'No tests',
  'hasil live': 'live result',
  'tanpa hasil live': 'no live result',
  'pemblokir': 'blockers',
  'grup terhitung': 'groups calculated',
  'Formula (implementasi aktual):': 'Formula (actual implementation):',
  'Fungsi produksi:': 'Production function:',
  'Versi': 'Version',
  'Input wajib:': 'Required inputs:',
  'Diterima live:': 'Received live:',
  'Hilang/tidak valid:': 'Missing/invalid:',
  'Hasil validasi/uji sintetis:': 'Validation/synthetic-test outcomes:',
  'ekspektasi': 'expected',
  'aktual': 'actual',
  'Hasil terbaru:': 'Latest result:',
  'Ditahan': 'Withheld',
  'Belum ada eksekusi live untuk metrik ini pada insiden terpilih.':
    'No live execution for this metric on the selected incident yet.',
  'Alasan ditahan:': 'Reason withheld:',
  'Provenans/ketidakpastian:': 'Provenance/uncertainty:',
  'Sumber & waktu:': 'Source & time:',
  'Dihitung': 'Calculated',
  'Tindakan berikutnya:': 'Next action:',
  // Judge-facing simplified view (header, three summary cards, key results, readiness).
  'Mesin Kalkulasi': 'Calculation Engine',
  'Pusat Verifikasi Kalkulasi': 'Calculation Verification Center',
  'Formula terverifikasi. Kalkulasi transparan. Insight bencana berbasis bukti.':
    'Verified formulas. Transparent calculations. Evidence-based disaster insights.',
  'Setiap metrik menjalankan formula produksi asli; hasil ditahan bila input tidak valid.':
    'Every metric runs the real production formula; results are withheld when inputs are invalid.',
  'Formula Terimplementasi': 'Formulas Implemented',
  'Uji Lolos': 'Tests Passed',
  'Kalkulasi Live': 'Live Calculations',
  'dari registri metrik': 'from the metric registry',
  'cek formula fixture sintetis — bukan uji produksi': 'formula checks on synthetic fixtures — not a production test run',
  'metrik dari data live asli': 'metrics from genuine live data',
  'data live belum diperiksa sesi ini': 'live data not checked this session',
  'Hasil perhitungan utama': 'Key calculation results',
  'Contoh Simulasi': 'Simulation example',
  'Data Aktual': 'Actual data',
  'Data Belum Cukup': 'Insufficient data',
  'Kesiapan Data': 'Data Readiness',
  'Lihat detail teknis': 'View technical details',
  'Detail teknis: cek per modul, provenans, bukti eksekusi layanan, mode live read-only, dan inventaris kebutuhan data.':
    'Technical detail: per-module checks, provenance, service execution proof, live read-only mode, and the data-requirements inventory.',
  'Angka simulasi untuk menunjukkan cara kerja rumus, bukan data bencana aktual.':
    'Simulation figures show how the formulas work, not actual disaster data.',
  'Kerusakan aset × biaya penggantian × tingkat keparahan.': 'Damaged assets × replacement cost × severity.',
  'Unit pulih ÷ unit terdampak untuk satu layanan.': 'Restored units ÷ affected units for one service.',
  'Gabungan berbobot empat pemulihan layanan.': 'Weighted composite of four service recoveries.',
  'Metrik ini memerlukan input terverifikasi yang belum tersedia.':
    'This metric requires verified inputs that are not available yet.',
  '{blocked} dari {total} metrik memerlukan input terverifikasi tambahan seperti jumlah pemulihan, pendanaan pemulihan, atau stok bantuan saat ini. Nilai yang hilang ditahan, bukan dianggap nol.':
    '{blocked} of {total} metrics require additional verified inputs such as restoration counts, recovery funding, or current aid stock. Missing values are withheld rather than treated as zero.',
  'Semua metrik memiliki input terverifikasi untuk insiden ini.':
    'All metrics have the verified inputs they need for this incident.',
  'Data live belum diperiksa sesi ini. Sebagian kalkulasi memerlukan input terverifikasi tambahan seperti jumlah pemulihan, pendanaan pemulihan, atau stok bantuan saat ini. Nilai yang hilang ditahan, bukan dianggap nol.':
    'Live data has not been checked in this session. Some calculations require additional verified inputs such as restoration counts, recovery funding, or current aid stock. Missing values are withheld rather than treated as zero.',
};

export default status;
