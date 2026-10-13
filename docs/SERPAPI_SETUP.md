# SerpApi Google News untuk titik bencana

1. GitHub → Settings → Secrets and variables → Actions → Secrets → New repository secret.
2. Nama persis: `SERPAPI_API_KEY`. Value: private API key dari akun SerpApi.
3. Tidak perlu variable enabled; provider aktif saat secret tersedia. Key hanya masuk ke crawler/status backend, tidak ke bundle browser.
4. Actions → Deploy to Firebase Hosting (production) → Run workflow → branch main → aktifkan `check_serpapi`. Ini satu request untuk membuktikan key bekerja, tanpa menyimpan artikel atau melewati gate harian.
5. Buka `/status` → Muat ulang laporan. Lihat SerpApi konfigurasi, uji langsung, dan artikel tersimpan.
6. Crawler Incident humanitarian crawl berjalan harian pukul 12.00 WIB bila sudah 24 jam sejak SUCCESS/SUCCESS_EMPTY terakhir. Bisa Run workflow manual setelah jatuh tempo. Reload halaman tidak menjalankan crawler.

Provider memakai `engine=google_news`, `gl=id`, `hl=id`. Tiga query per titik aktif: kejadian, kebutuhan, penanggulangan/pemulihan. Tidak melakukan pagination. Batas hasil 30 artikel per query. Kuota perkiraan per run: jumlah titik aktif × 3 request SerpApi, di luar provider lain dan uji langsung. Cache default SerpApi tetap digunakan.

Pencarian dan klasifikasi memakai 7 tanggal kalender terakhir dalam WIB, termasuk hari ini. Rentang bergeser otomatis setiap hari. Laporan BNPB dan artikel tersimpan di luar rentang disembunyikan dari dataset aktif tanpa menghapus arsip.

`iso_date` disimpan sebagai tanggal publikasi. Tanggal relatif atau kosong tidak ditebak dan membutuhkan review. Artikel dari kelompok stories juga dibaca. Hasil tetap diperiksa lokasi, jenis bencana, dan waktu kejadian. URL identik digabung; metadata bertanggal lebih diprioritaskan. Bila URL sudah ditemukan Zapi, artikel dapat tercatat sebagai Zapi sehingga jumlah SerpApi bukan total hasil pencarian mentah.

Hasil API adalah metadata artikel, bukan isi lengkap. Judul/link/penerbit dapat tampil di sidebar yang sama dengan sumber lain; kebutuhan atau jumlah bantuan hanya diekstrak jika eksplisit tersedia pada bukti. Tidak ada angka gap atau persentase pemulihan yang dibuat dari hasil pencarian.

AI Overview dan AI Mode belum ditambahkan pada perubahan ini.

Dokumentasi provider: https://serpapi.com/google-news-api
