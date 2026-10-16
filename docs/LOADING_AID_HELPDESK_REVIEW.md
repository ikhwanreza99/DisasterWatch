# Loading, aid gap, dan audit AIHelpdesk — 16 Oktober 2026

## Implementasi lokal

- Panel AI, posko, laporan warga, login, laporan, donasi, dan NTT dimuat dengan React.lazy saat dibuka. Suspense lokal mempertahankan peta ketika panel dimuat.
- Ikon mata default OFF. Pengambilan BMKG/FIRMS ditunda sampai pengguna mengaktifkannya; hook layer lain sudah mengikuti visibility.
- Foto dan narasi memakai cache memori 5 menit, deduplikasi request, timeout 15 detik, dan retry sesudah kegagalan. HTTP cache tetap divalidasi saat cache memori habis. Cache ini tidak bertahan setelah reload halaman.
- Aid gap menampilkan estimasi per barang dari maksimum jumlah jiwa pada fakta dampak berita, tanpa menjumlahkan laporan. Satu porsi/jiwa untuk satu kali makan; satu selimut/jiwa. Barang untuk anak/bayi tidak memakai seluruh populasi sebagai kebutuhan kelompok tersebut. Pembaruan: daftar bantuan tampil langsung; paket bantuan umum diasumsikan untuk 30 jiwa dan box/dus barang konsumsi berisi 40 pcs, kecuali isi disebutkan sumber. Nasi siap konsumsi tetap 1 porsi/jiwa. Kapasitas tangki, uang, dan peralatan dapur tidak dikonversi menjadi jiwa terlayani.
- Dataset Padang saat audit: 672 jiwa maksimum, nasi 400 bungkus (59,5%, sisa 272); selimut 300 pcs (44,6%, sisa 372). Angka 753 tidak ada pada snapshot. Tes skenario 753 menghasilkan 53,1% untuk 400 porsi dan sisa 353. Tidak mengubah bukti berita menjadi angka tanpa sumber.

## Branch fizri/AIHelpdesk

Dibandingkan main 3d9664e, tip branch 26db095 memiliki 5 commit yang belum ada di main; main memiliki satu commit posko yang belum ada di branch. Audit merge tiga arah tanpa mengubah main tidak menghasilkan konflik tekstual.

Perubahan: konteks dan riwayat percakapan; interpretasi pertanyaan bebas Indonesia/Inggris; klarifikasi lokasi; pertanyaan laporan sesuai konteks; rangkuman, koreksi, dan konfirmasi sebelum pengiriman; validasi lampiran; penanda engine Gemini/fallback; membedakan data populasi kosong dan nol. Ada workflow preview Firebase channel ai-helpdesk.

Bukan hanya template UI: askAssistant memakai getGeminiModel; submitReportPipeline menjalankan ekstraksi/validasi lalu saveReport ke Firestore; lampiran memakai Firebase Storage. Saat layanan gagal, tersedia fallback deterministik/lokal. Keberadaan fallback tidak membuktikan koneksi Gemini/Firestore berhasil.

Batas sinkronisasi: App mengawali laporan dari demoReports/demoAid dan menerima laporan baru melalui callback lokal. Listener Firestore yang ada memantau moderasi disasters; tidak ada listener laporan/bantuan lintas pengguna pada App. Karena itu, jangan menyatakan dashboard sepenuhnya realtime dengan Firestore.

Rekomendasi: layak diintegrasikan dari sisi konflik dan tes sumber. Sebelum menyebutnya terverifikasi live, uji Google login, respons engine=gemini, unggah Storage, dokumen reports yang benar-benar tersimpan, pembacaan setelah reload, dan pembaruan lintas sesi. Tidak dilakukan merge, push, deploy, atau pengiriman laporan produksi pada audit ini.

## Verifikasi

- Lint dan production build lokal lulus. App chunk sebelum 546,96 KB (gzip 162,87 KB), setelah perubahan 422,92 KB (gzip 125,41 KB), turun sekitar 23%. Ini pengurangan bundel App, bukan pengukuran waktu loading end-to-end.
- Suite utama + regresi aid gap: 85/85 lulus (server loopback membutuhkan akses di luar sandbox).
- Arsip branch AIHelpdesk: lint lulus; 27/27 tes helpdesk lulus.
- Browser preview: ikon mata OFF dan progress nasi/selimut terlihat. Google Maps menolak referrer localhost; peta fallback Leaflet tetap tampil. Belum ada uji mobile khusus atau backend live.

Pembaruan verifikasi: lint, build, dan 11 tes narasi/aid gap lulus setelah konversi kemasan.
