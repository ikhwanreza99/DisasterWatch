# Google News untuk Update Berita Terkini

Pada GitHub repository, buka **Settings → Secrets and variables → Actions → Secrets → New repository secret**:

- Name: `ZAPI_API_KEY`
- Secret: API key Zapi Anda.

Jangan gunakan Actions Variable atau `VITE_ZAPI_API_KEY`. Key hanya tersedia pada langkah snapshot, tidak pada build Vite atau browser. Tidak perlu menaruh key di chat atau commit.

Workflow `.github/workflows/deploy-hosting.yml` mengambil snapshot sebelum build. Hosting menggunakan jadwal yang sudah ada (`7,37 * * * *`, sekitar 30 menit). GitHub dapat menunda scheduled runs; jadwal berjalan dari default branch. Perubahan pada `rafii-api` belum aktif di produksi sebelum diintegrasikan dan di-deploy melalui workflow yang relevan.

Pengambilan Zapi hanya dilakukan ketika snapshot terakhir berusia minimal 2 jam. Push/manual run di dalam jendela itu menggunakan cache tanpa request API. Perkiraan 360 request per 30 hari atau 372 per 31 hari; cache miss/eviction dapat menambah request. Percobaan yang gagal juga diberi jeda 2 jam agar tidak menghabiskan kuota. Kuota gratis yang tercantum di dokumentasi Zapi adalah 600 request/bulan; jadwal 2 jam menyisakan sekitar 228–240 request untuk pengujian atau cache miss. Tidak ada request Zapi per pengunjung.

Endpoint resmi: https://api.zapi.ink/v1/news:google-news/feed
Dokumentasi: https://zapi.ink/api/news/google-news/llms.txt
Autentikasi: header `x-api-key`.

Query mencari banjir, gempa, longsor, tsunami, erupsi, karhutla, puting beliung, dan bencana alam terkait Indonesia dalam 7 hari terakhir. Ambil hingga 50 kandidat, buang judul tidak relevan/tanggal invalid/URL tidak aman/duplikat, urutkan publikasi terbaru, lalu tampilkan maksimal 15. Relevansi lokasi mengikuti hasil pencarian Google News; ini bukan verifikasi geolokasi setiap artikel. Jika kandidat valid kurang dari 15, tampilkan jumlah yang tersedia.

Bagian berita bersifat nasional, bukan laporan dari titik bencana yang sedang dipilih. Sidebar menampilkan 2 artikel dan tombol Lihat Semua; panel detail menampilkan sampai 15. Browser memuat ulang snapshot setiap 5 menit. Waktu ditampilkan dalam WIB. HTML ringkasan dari provider tidak dirender.

Snapshot terakhir disimpan di Actions cache dan dipakai bila provider gagal/kuota habis/key belum tersedia. Timestamp tidak diperbarui saat gagal; UI menandai data berusia lebih dari 4 jam. Artikel lebih dari 7 hari disembunyikan. Jika tidak ada cache, UI menampilkan keadaan kosong. Cache dapat dieviksikan oleh GitHub.

Untuk lokal, simpan `ZAPI_API_KEY` dalam `.env.local` yang diabaikan git, lalu:

```bash
node --env-file=.env.local --import tsx scripts/fetchDisasterNews.ts
npm run dev
```

Validasi dengan fixture tidak membuktikan akses Zapi menggunakan key asli. Uji live setelah secret dipasang; periksa hasil snapshot dan log langkah tanpa mencetak key.
