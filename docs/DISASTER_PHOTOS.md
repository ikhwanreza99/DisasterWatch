# Dokumentasi foto kejadian

Workflow hosting membuat `/data/disaster-photos.json` dan menyinkronkan metadata foto ke `disasters`. Gambar tidak disalin/download ke hosting: browser memuat thumbnail/gambar dari host sumber. Field `photoUrl`, `photoSource`, `photoSourceUrl`, dan `photoReportDate` dipakai sidebar. Tanggal yang ditampilkan adalah tanggal laporan, bukan tanggal pemotretan.

Urutan: file gambar pada folder dokumentasi BNPB yang dapat diakses, thumbnail SerpApi dari artikel yang cocok, lalu `og:image`/`twitter:image` pada artikel matched dari penerbit yang diizinkan. Artikel wilayah lain atau di luar 7 hari tidak dipilih, kecuali arsip khusus NTT. Folder laporan BNPB terbaru diprioritaskan; maksimum dua folder per titik, tiga artikel per titik, tanpa menelusuri subfolder.

Untuk Drive: aktifkan Google Drive API di proyek Google Cloud lalu tambahkan GitHub Secret `BNPB_DRIVE_API_KEY`. Key backend harus diizinkan memakai Drive API dan tidak diberi pembatasan referrer browser karena request berasal dari GitHub Actions. Key tidak masuk ke bundle web. Tidak memerlukan akses ke Drive pribadi pengguna: hanya folder BNPB yang tersedia publik. Folder/file privat tetap tidak dapat dibaca dan tidak diubah permission-nya.

Thumbnail Drive berumur pendek; metadata diperbarui pada workflow hosting. Web menolak snapshot foto berumur 24 jam, menolak foto yang salah incidentId, dan kembali ke placeholder saat gambar gagal dimuat. Penerbit bisa menolak hotlink atau tidak menyediakan gambar; keadaan ini tidak membuat crawler lain gagal. Sumber artikel tetap dicantumkan sebagai tautan. Menemukan URL gambar tidak otomatis memberikan izin publikasi ulang; integrasi ini menggunakan URL metadata sumber dan tidak menyalin gambar ke Storage.

Thumbnail SerpApi mulai tersimpan saat crawler kejadian berikutnya berjalan; artikel yang sebelumnya tidak menyimpan thumbnail masih bisa memakai metadata gambar artikel. Koleksi artikel dan snapshot BNPB tidak menjadi feed realtime oleh perubahan ini.
