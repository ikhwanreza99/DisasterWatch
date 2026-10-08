# Berita bencana Indonesia: snapshot dan Firestore

## Secrets GitHub

Settings → Secrets and variables → Actions → Secrets:

- `ZAPI_API_KEY`: key Zapi, hanya digunakan server/CI (tanpa prefix VITE_).
- `FIREBASE_NEWS_SERVICE_ACCOUNT`: opsional, JSON service account untuk project `disasterwatch-61ed5` yang dapat membaca/menulis Firestore. Jika tidak diisi, workflow memakai `FIREBASE_SERVICE_ACCOUNT_DISASTERWATCH_61ED5` yang sudah digunakan deployment. Jika akun tersebut hanya memiliki izin Hosting, sinkronisasi gagal dan memerlukan akun dengan izin Firestore; script tidak mengubah IAM otomatis.

Tidak ada kredensial yang disertakan dalam JSON publik atau bundle Vite.

## Frekuensi dan data

Workflow Hosting tetap dijalankan sekitar 30 menit sesuai kebutuhan snapshot layer lain. Request Zapi hanya dilakukan setelah 5 x 24 jam dari percobaan terakhir, sekitar 6–7 request/bulan. Waktu percobaan tersimpan di Actions cache, termasuk kegagalan. Cache eviction dapat memicu request tambahan. Scheduled runs GitHub dapat terlambat. Cache v2 memulai pengambilan pertama dengan metadata baru.

Endpoint: https://api.zapi.ink/v1/news:google-news/feed
Dokumentasi: https://zapi.ink/api/news/google-news/llms.txt
Header autentikasi: `x-api-key`.

Query mencari berita bencana serta bantuan bencana terkait Indonesia dalam 7 hari terakhir. Dari maksimal 50 kandidat, pilih maksimal 15 valid, unik, dan terbaru. Hanya headline dengan kata bencana serta petunjuk lokasi Indonesia yang diterima. Headline yang menyebut lokasi luar negeri yang dikenali ditolak, termasuk Indonesia sebagai pemberi bantuan ke luar negeri. Filter konservatif dapat melewatkan berita daerah; ini bukan verifikasi geografis penuh. Artikel tanpa bukti lokasi tidak diterbitkan. Nama penerbit tidak digunakan sebagai bukti lokasi.

Metadata diekstrak dari headline, bukan isi artikel penuh: `countryCode`, `locationEvidence`, `disasterTypes`, `topic`, `aidRelated`, `aidCategories`, `verificationStatus`, `extractionMethod`. Semua berstatus UNVERIFIED; tidak membuat angka korban, koordinat, jumlah bantuan, atau klaim bantuan telah diterima.

UI nasional terpisah dari titik bencana terpilih. Sidebar menampilkan 2 artikel dan Lihat Semua hingga 15; panel detail hingga 15. UI menunjukkan interval 5 hari dan waktu aktual snapshot (WIB). Artikel lebih tua dari 14 hari disembunyikan; data yang gagal diperbarui lebih dari 5 hari + 6 jam ditandai. HTML ringkasan provider tidak dirender.

## Firestore JSON

Admin SDK melakukan transaksi atomik pada:

- `newsArticles/{sha256(url)}`: dokumen per artikel, idempotent berdasarkan URL; artikel lama disimpan sebagai arsip.
- `newsFeeds/indonesia-disasters`: `articleIds`, `count`, `updatedAt`, `schemaVersion` untuk snapshot aktif.

Hanya snapshot lebih baru yang ditulis. Transaksi atomik mencegah daftar aktif menunjuk dokumen yang belum tersimpan. News tidak masuk ke koleksi `reports` atau `aid`. Rules klien tidak diubah; browser tetap membaca snapshot statis dan tidak dapat menulis koleksi berita. Admin SDK memerlukan izin IAM, bukan izin security rules klien.

Contoh struktur (ilustrasi, bukan berita aktual):

```json
{
  "title": "Contoh bantuan logistik untuk korban banjir Demak",
  "url": "https://example.com/berita-contoh",
  "source": "Contoh Media",
  "publishedAt": "2026-10-09T00:00:00.000Z",
  "fetchedAt": "2026-10-09T01:00:00.000Z",
  "schemaVersion": 1,
  "provider": "zapi_google_news",
  "isMock": false,
  "metadata": {
    "countryCode": "ID",
    "locationEvidence": ["Demak"],
    "disasterTypes": ["flood"],
    "topic": "disaster_aid",
    "aidRelated": true,
    "aidCategories": ["logistics"],
    "verificationStatus": "UNVERIFIED",
    "extractionMethod": "headline_keywords_v1"
  }
}
```

Lokal, simpan key di `.env.local` yang diabaikan git:

```bash
node --env-file=.env.local --import tsx scripts/fetchDisasterNews.ts
node --import tsx scripts/syncDisasterNews.ts public/data/disaster-news.json --dry-run
npm run dev
```

Dry-run mencetak JSON metadata tanpa akses Firestore. Sinkronisasi nyata memerlukan secret service account dan tanpa `--dry-run`. Kegagalan sinkronisasi menghentikan workflow agar tidak salah dilaporkan berhasil.
