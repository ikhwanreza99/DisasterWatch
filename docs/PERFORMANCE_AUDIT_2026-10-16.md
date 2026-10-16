# Audit performa DisasterWatch — 16 Oktober 2026

## Laporan produksi yang dirujuk

https://pagespeed.web.dev/analysis/https-disasterwatch-61ed5-web-app/u2isnohpi4?form_factor=desktop

Desktop, Lighthouse 13.5.0: Performance 55; FCP 0,6 detik; LCP 2,6 detik; TBT 500 ms; Speed Index 4,4 detik; CLS 0. Accessibility 100, Best Practices 96, SEO 92. Ini laporan sebelum perubahan pada dokumen ini.

Temuan: cache aset first-party hanya satu jam (estimasi penghematan 350 KiB); reCAPTCHA sekitar 1,57 detik CPU; Google Maps sekitar 0,80 detik CPU, termasuk Places yang tidak diperlukan pencarian REST; JavaScript tidak terpakai 836 KiB. Temuan pihak ketiga bukan seluruhnya dapat diperbaiki lewat hosting aplikasi.

## Perubahan

- Cache satu tahun + immutable hanya untuk `/assets/**` yang namanya memiliki hash Vite. HTML tetap no-cache, snapshot publik lima menit + revalidasi, google-status no-store. Header keamanan dipertahankan.
- Library Places/Geometry tidak lagi dimuat di awal; pencarian tetap memakai REST Places. Maps memakai renderer raster 2D; advanced marker, polyline, polygon, dan overlay tetap didukung. Tidak ada deteksi Lighthouse/user-agent atau pemblokiran resource khusus audit.
- Request cuaca kota, MAGMA, erupsi, dan VAAC mengikuti layer yang aktif, bukan selalu dijalankan sejak homepage.
- Sidebar beserta detail dan perhitungan dimuat ketika dibuka. Kasus NTT tidak lagi membaca Firestore sampai tampilan yang membutuhkannya dibuka.
- Firebase/Auth dimuat sesudah render kerangka halaman. Pemeriksaan identitas murni dipisahkan dari SDK. Urutan konsumsi redirect sebelum anonymous sign-in dipertahankan; listener dibersihkan ketika unmount. App Check tetap diinisialisasi oleh getDb sebelum protected reads. Marker tetap menunggu hasil moderasi server.
- Homepage Google Maps tetap menampilkan Indonesia sampai pengguna memilih insiden; menghindari pengambilan tile untuk dua viewport saat startup. Pemilihan insiden tetap memfokuskan peta.
- Leaflet tidak memasang dua tile layer yang sama ketika mount. Banner error berada di overlay agar tidak menggeser toolbar.
- Hapus stylesheet Google Fonts yang memblokir render. Homepage memang memakai font sistem Tailwind; admin mengikuti font sistem juga.
- Batasi pemindaian Tailwind ke source aplikasi dan index.html, bukan worktree/dokumen lain.
- Tambah robots.txt asli agar Hosting tidak mengembalikan index.html untuk URL tersebut.

## Ukuran build lokal

App: 424,10 KB → sekitar 332 KB; gzip 125,77 KB → sekitar 100 KB (turun sekitar 22%). CSS utama: 134,60 → sekitar 131 KB. Firebase SDK tetap diunduh karena diperlukan keamanan dan data live, tetapi tidak lagi menjadi dependensi render awal homepage.

## Verifikasi

Lint dan build lulus. Suite utama 87 tes lulus; 41 tes tambahan auth preservation, auth errors, API layer visibility, dan NTT lulus. Pemeriksaan bundle secrets bersih. Assertion source auth preservation disesuaikan dengan lokasi helper identitas dan markup terjemahan yang sudah digunakan aplikasi.

Tes lama authBugCondition memiliki pemeriksaan domain auth literal yang tidak sesuai workflow berbasis GitHub Secrets; tidak diubah oleh optimasi performa ini.

Browser lokal: homepage dan marker tersedia, default mata OFF, modal login dapat dibuka/tutup. Google Maps localhost ditolak oleh referrer restriction; fallback Leaflet tersedia. Ini belum membuktikan login, pengiriman laporan, Firebase/Gemini, atau Google Maps produksi end-to-end.

## Pengukuran

Lighthouse CLI 13.5.0 desktop dengan Brave/Chromium headless. Baseline build disalin sebelum perubahan; build optimasi disajikan terpisah. Pengukuran awal dengan server tanpa kompresi sangat bervariasi (baseline 72; iterasi optimasi 42 dan 78); tidak digunakan sebagai klaim peningkatan produksi. Salah satu run Lighthouse 13.0.3 mengalami NO_LCP dan dibuang.

Pengukuran berpasangan dengan server gzip identik direkam terpisah di /tmp. Layanan peta lokal mendapat referrer restriction dan benchmark tidak memiliki konfigurasi/akses server yang identik dengan Hosting. Skor lokal tidak boleh dibandingkan langsung dengan 55 dari PageSpeed produksi.

## Setelah deploy

1. Verifikasi header Cache-Control aset hash satu tahun, HTML no-cache, snapshot lima menit, dan google-status no-store.
2. Jalankan ulang PageSpeed Mobile dan Desktop minimal tiga kali; bandingkan median dengan pengaturan sama.
3. Verifikasi marker dan moderasi, pencarian area, layer mata ON/OFF, pemilihan insiden/posko, login redirect/popup, upload dan penyimpanan laporan.
4. Periksa resource reCAPTCHA/Maps yang tersisa; jangan mematikan App Check demi skor. Optimasi gambar tile Maps dan caching SDK pihak ketiga berada di luar kendali Hosting first-party.

Referensi teknis: https://firebase.google.com/docs/hosting/full-config ; https://developers.google.com/maps/documentation/javascript/libraries ; https://visgl.github.io/react-google-maps/docs/api-reference/components/map ; https://developers.google.com/maps/documentation/javascript/advanced-markers/overview ; https://tailwindcss.com/docs/detecting-classes-in-source-files

## Hasil tiga pasang run gzip

| Metrik | Baseline lokal | Optimasi lokal |
| --- | ---: | ---: |
| Skor tiga run | [44, 88, 78] | [88, 88, 78] |
| Median skor | 78 | 88 |
| Median LCP | 2.520 detik | 1.928 detik |
| Median TBT | 107.500 ms | 0.000 ms |
| Median Speed Index | 2.903 detik | 2.121 detik |
| Median CLS | 0.031  | 0.000  |

Ketiga run optimasi memiliki CLS 0. Variabilitas jaringan/peta masih terlihat, sehingga hasil median dipakai dan skor 100 tidak diklaim. Log jaringan optimasi tidak memuat weather.googleapis.com, fonts.googleapis.com, MAGMA, VAAC, atau SlimSidebar saat homepage belum diinteraksikan. LCP lokal masih berupa tile OpenStreetMap setelah fallback dari Google Maps yang menolak referrer localhost.

Belum commit/push/deploy pada tahap ini. Perubahan cache perlu deploy Hosting untuk aktif pada domain produksi.

Catatan lanjutan: benchmark di atas mendahului hardening fallback Maps saat perbaikan pelaporan anonim. reuseMaps dihapus dan error boundary ditambahkan agar error provider tidak menghilangkan halaman/form. Tidak ada klaim benchmark produksi baru setelah perubahan tersebut.
