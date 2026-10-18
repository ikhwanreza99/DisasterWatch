# Menyiapkan pengujian layanan Google

## Firebase AI Logic: HTTP 401

401 menunjukkan permintaan ditolak, tetapi kode HTTP saja belum menentukan penyebabnya. App Check belum terpasang sebelum integrasi site key ini ditambahkan.

1. Buka Firebase Console, pilih proyek `disasterwatch-61ed5`, lalu AI Logic. Selesaikan setup dengan provider Gemini Developer API.
2. Buka Google Cloud Console pada proyek yang sama, bagian reCAPTCHA. Buat key untuk Website dengan integrasi score-based. Daftarkan domain `disasterwatch-61ed5.web.app` dan `disasterwatch-61ed5.firebaseapp.com` (tanpa https/path).
3. Firebase Console → App Check → Apps → pilih aplikasi web yang app ID-nya sama dengan konfigurasi aplikasi. Daftarkan provider reCAPTCHA Enterprise dengan site key tersebut.
4. GitHub repository → Settings → Secrets and variables → Actions → Secrets. Tambah `VITE_FIREBASE_APPCHECK_SITE_KEY` dengan site key reCAPTCHA Enterprise. Ini bukan API key Gemini dan bukan debug token.
5. Jalankan workflow hosting pada main agar env masuk ke bundle baru. Kode akan menginisialisasi App Check sebelum layanan Firebase dipakai. Jangan memakai site key produksi untuk localhost; pengembangan lokal membutuhkan debug provider terpisah yang belum disediakan oleh integrasi ini.
6. Di App Check → APIs, periksa konfigurasi Firebase AI Logic. Integrasi ini mendukung baseline enforcement. Replay protection membutuhkan limited-use tokens dan belum dikonfigurasi oleh kode ini.
7. Google Cloud → APIs & Services → Credentials → key yang sesuai dengan `VITE_FIREBASE_API_KEY`. Jika ada API restrictions, pastikan Firebase AI Logic API (`firebasevertexai.googleapis.com`) diizinkan. Jika ada pembatasan HTTP referrer, izinkan `https://disasterwatch-61ed5.web.app/*` dan domain hosting lain yang dipakai. Pertahankan izin API Firebase lain yang sudah diperlukan aplikasi.
8. Buka `/status` di produksi, lalu Uji ulang Firebase AI Logic.

Jangan mengganti `VITE_FIREBASE_API_KEY` dengan key Google Search backend. Firebase AI Logic memakai konfigurasi proyek Firebase, bukan secret crawler.

Referensi: https://firebase.google.com/docs/ai-logic/app-check dan https://firebase.google.com/docs/ai-logic/error-codes

## Gemini Developer API fallback: HTTP 503

503 berarti layanan/model sementara tidak tersedia; kode ini belum membuktikan masalah permission. Sejak Okt 2026, model Flash utama (`gemini-3.8-flash`, `3.7`, `3.6`) sering 503 karena overload global, sementara `gemini-3.5-flash-lite` menjawab 200. Karena itu kode sekarang mencoba kandidat model berurutan (`resolveGeminiCandidates()` di `src/lib/firebase/geminiConfig.ts`): primer dulu, lalu `gemini-3.5-flash-lite`, masing-masing dengan 1x retry untuk error transient (429/5xx). Pemeriksaan `/status` dan fitur AI aplikasi (`getGeminiModel()`) sama-sama memakai rantai ini — hasil "Berhasil" akan menyebut model mana yang menjawab dan apakah itu fallback.

Fallback Gemini Developer API kini berjalan **lewat proxy server** (`POST /api/ai/generate`, lihat `server/aiProxy.ts`) dan tidak memakai key di browser. Key hidup hanya sebagai `GEMINI_API_KEY` (server-side) dan **tidak boleh** diberi awalan `VITE_`, karena semua `VITE_*` ikut masuk ke bundle browser. Model fallback dapat diatur lewat `VITE_GEMINI_MODEL` (nama model saja, bukan key); ini berbeda dari variable backend `DISASTERWATCH_GOOGLE_SEARCH_MODEL`. Bila proxy belum tersedia, kode otomatis memakai Firebase AI Logic (jalur utama) lalu fallback deterministik — tidak pernah memuat key di browser.

Referensi: https://ai.google.dev/gemini-api/docs/troubleshooting

## Firebase Storage: terpasang, belum diuji

Ini bukan hasil gagal. Halaman status belum melakukan upload lampiran. Aktifkan bucket Storage dan billing yang diperlukan di Firebase Console, pastikan `VITE_FIREBASE_STORAGE_BUCKET` sesuai, dan gunakan Storage Rules yang mengizinkan upload untuk pengguna/pola path laporan aplikasi. Login, buat laporan dengan lampiran kecil, kemudian pastikan file tersimpan. Jangan membuka seluruh bucket untuk publik hanya agar pengujian hijau.

## Interval crawler kejadian

Crawler kejadian menjadi due 5 hari (120 jam) setelah SUCCESS/SUCCESS_EMPTY terakhir. Workflow memeriksanya setiap hari pukul 05.00 UTC (12.00 WIB). Bila pemeriksaan jadwal terjadi sebelum batas 5 hari, crawl menunggu pemeriksaan berikutnya. Workflow dapat dijalankan manual setelah jatuh tempo.

Snapshot berita nasional terpisah masih memakai interval 5 hari. Mengubah interval crawler tidak menghapus kebutuhan klasifikasi/review artikel Gemini tanpa tanggal publikasi.

## Panel "Keamanan kunci API"

Panel ini hanya menampilkan ringkasan kebijakan berbasis bukti build (`/data/security.json` yang diterbitkan `npm run check:bundle-secrets`): jumlah file bundel yang dipindai dan status guard. Panel tidak pernah menampilkan nilai kunci, nama secret, atau URL layanan. Guard kini juga mencocokkan *pola* kredensial (`AIza…`, `AQ.…`, blok PEM) sehingga kunci bocor tetap tertangkap walau CI tidak pernah melihat nilainya; hanya dua kunci publik (Maps, Firebase web) yang di-allowlist berdasarkan nilai persis.

## Panel "Kesesuaian teknis · AI Builder Cup 2026"

Checklist kepatuhan aturan teknis (bagian B & C) yang dihitung dari bukti nyata halaman: hasil pemeriksaan langsung (Firebase AI Logic, Firestore, proxy `/api/ai`), laporan guard build, dan origin yang melayani halaman. Tiga status dipakai secara jujur:

- `Terpenuhi` — ada bukti pada sesi ini.
- `Perlu tindakan` — belum ada infrastruktur/bukti (mis. Cloud Run belum ter-deploy, origin bukan domain bawaan Firebase).
- `Belum diuji` — butuh login Google untuk menguji (mis. `generateContent`).

Bagian "Nilai plus" memuat solusi teknis nyata yang bisa ditonjolkan saat penjurian (pemindahan kunci ke proxy server, guard anti-bocor, rate limit + allowlist origin, transport AI bertingkat, snapshot statis/cache, antarmuka dua bahasa). Tidak ada klaim yang tidak dapat diverifikasi di halaman ini.
