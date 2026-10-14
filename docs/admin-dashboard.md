# Dashboard superuser

Route produksi: `/admin`. Username `admin` memakai akun Firebase Auth internal `admin@disasterwatch-61ed5.local`. Password hanya berasal dari secret provisioning `ADMIN_INITIAL_PASSWORD`, bukan VITE atau bundle browser. Akun memiliki custom claim `superuser:true`. Sesi admin memakai aplikasi Firebase terpisah dengan session persistence; sesi Google pelapor tidak ditimpa.

Dashboard hasil merge `fizri/homepage-verificator` membaca Firestore langsung dengan Firebase SDK. Static Firebase Hosting tidak membutuhkan server Express tambahan. Adapter Express lama disimpan untuk tes/preview lama; bukan jalur produksi dashboard.

Menu Verifikasi Laporan membaca collection `reports`; Data Bencana membaca `disasters` atau `incidents`; sumber artikel fact-check dari `incidentArticles`. Approval laporan atau titik memerlukan catatan minimal 10 karakter dan 1–5 URL sumber HTTPS. Data demo tidak dapat disetujui menjadi REAL. Superuser membandingkan lokasi, jenis bencana, tanggal, berita, BNPB/BMKG dan eviden lain; AI tidak memberi persetujuan akhir.

Approval memakai transaksi Firestore: status laporan VERIFIED, titik APPROVED, reviewer UID, waktu, catatan dan evidenceUrls, serta audit immutable di `reportReviews`. Bila laporan tidak memiliki titik, admin memasukkan koordinat dan transaksi membuat titik REAL baru. Titik APPROVED terbaca oleh peta publik bila dalam rentang 7 hari, kecuali arsip khusus NTT. Dataset sumber yang sudah reviewed tetap tersedia saat database gagal.

Rules hanya menerima laporan baru dari provider Google OAuth, dengan `reporterUid` sama dengan UID login, `isMock:false`, dan status belum VERIFIED. Pelapor tidak dapat mengisi metadata reviewer atau mengubah status approval. Claim superuser diberikan Admin SDK, tidak dapat ditambahkan sendiri oleh pengguna.

Setup: GitHub workflow `Setup superuser and approval rules` memvalidasi/deploy Firestore Rules, mengaktifkan Email/Password tanpa mengubah Google OAuth, lalu membuat akun dan claim. Menjalankan workflow ini lagi mereset password sesuai secret dan mencabut sesi lama; tidak dijalankan otomatis oleh hosting.

Status layanan menggunakan halaman status yang sama dengan publik. Token Usage tetap data provider dari browser ini, bukan tagihan agregat proyek. Tidak ada password, token login, prompt atau isi laporan yang disimpan dalam telemetry token.

Validasi: TypeScript/build, tes legacy Express, kebijakan evidence, rules validation dan uji login Firestore produksi. Persetujuan kejadian nyata tidak dilakukan otomatis demi uji: keputusan fact-check tetap milik superuser.
