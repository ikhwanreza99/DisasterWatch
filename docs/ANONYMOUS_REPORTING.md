# Pelaporan tanpa login Google

Tombol Laporkan Bencana langsung membuka alur form DisasterAI, tanpa modal Google Login. Alur laporan kebutuhan bantuan dan pesan yang terdeteksi sebagai laporan juga tidak diblokir login. Draf dan tahap konfirmasi tetap berjalan tanpa akun Google.

Saat pengguna mengirim, aplikasi memulihkan/membuat sesi anonim Firebase melalui signInAnonymously. UID sesi dipakai sebagai reporterUid dan jalur lampiran. Sesi demo tidak boleh menyamar menjadi sesi live. Bila Firebase dikonfigurasi tetapi sesi anonim gagal dibuat, pengiriman ditolak dan isian tetap disimpan di form.

Aturan CREATE /reports menerima sesi anonymous atau Google yang UID-nya cocok dengan reporterUid. Batas field, panjang rawText, status awal yang belum terverifikasi, dan larangan self-approval tetap berlaku. Update/review laporan tetap memerlukan superuser dan audit. App Check tetap aktif. Jika saveReport tidak menghasilkan mode live untuk sesi nyata, pipeline melempar error; UI tidak mengklaim sudah terkirim.

## Aktivasi produksi

- Aktifkan provider Anonymous di Firebase Authentication bila belum aktif. Login Google tidak diperlukan.
- Deploy frontend dan firestore.rules. Workflow Hosting saat ini tidak otomatis merilis rules; jalankan proses deploy rules terpisah.
- Verifikasi Storage rules mengizinkan unggah ke report-attachments/{uid}/... hanya untuk UID pemilik dengan batas ukuran/jenis file yang sesuai. Rules Storage produksi tidak ada di repository, sehingga pengunggahan anonim belum diverifikasi.
- Lakukan uji laporan nyata hanya dengan data yang diizinkan, periksa dokumen tersimpan serta moderasi. Jangan menganggap draft lokal atau UI berhasil sebagai bukti Firestore.

Perubahan ini belum dipublikasikan dan tidak membuat laporan uji di produksi.

Referensi: https://firebase.google.com/docs/auth/web/anonymous-auth

Verifikasi lokal: lint/build dan 94 tes lulus; tombol homepage membuka form DisasterAI langsung, dan pengisian lokasi berlanjut ke pertanyaan jenis bencana tanpa login. Tidak dilakukan submit ke produksi. Error boundary peta mempertahankan halaman dan form ketika SDK Google Maps gagal; reuseMaps dihapus setelah error pada referrer localhost ditemukan.

Tautan langsung: `/helpdesk` membuka DisasterAI layar penuh, `/lapor` membuka alur laporan tanpa Google login. Keduanya memakai komponen yang sama dengan tombol homepage.
