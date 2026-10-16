# 🌊 DisasterWatch

[English](README.md) · **Bahasa Indonesia**

DisasterWatch adalah dashboard tanggap darurat bencana Indonesia berbasis peta. Data bahaya resmi (gempa, cuaca, kebakaran hutan, gunung api, abu vulkanik) digabung dengan pemantauan insiden, analisis kesenjangan bantuan, dan AI helpdesk dalam satu peta interaktif.

Live: https://disasterwatch-61ed5.web.app

> ⚠️ Data insiden, laporan warga, dan angka bantuan di aplikasi adalah **data demo / hasil olahan AI**, bukan feed resmi BNPB atau BMKG. Layer resmi selalu diberi label sumbernya.

## Fitur

- **Peta interaktif**: Google Maps (satelit dan vektor), otomatis pindah ke Leaflet/OpenStreetMap kalau Google Maps tidak tersedia. Setiap pop up punya tombol tutup (✕).
- **Intelijen insiden**: baris KPI (insiden aktif, terdampak, prioritas, kesenjangan bantuan, laporan perlu verifikasi), detail bencana, rute distribusi, laporan warga, dan AI helpdesk (Firebase AI Logic + Gemini, dengan cadangan heuristik lokal).
- **Layer data resmi**, masing-masing punya toggle di peta:

| Toggle | Data | Sumber |
|---|---|---|
| 🌐 BMKG | Gempa bumi terkini | [BMKG](https://data.bmkg.go.id/gempabumi/) |
| ⛈ CUACA | Peringatan cuaca BMKG + cuaca terkini 21 kota besar + sidebar cuaca | BMKG nowcast, Google Weather API |
| 🔥 FIRMS | Titik panas dari satelit, mengikuti rentang tanggal di header (Hari ini / 24 jam / 7 hari / 30 hari) | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) (VIIRS, MODIS) |
| 🌋 MAGMA | Tingkat aktivitas gunung api (Level I–IV) dan laporan gerakan tanah, lengkap dengan legenda | [MAGMA Indonesia](https://magma.esdm.go.id/) (PVMBG) |
| 🌫 ABU VULKANIK | Awan abu vulkanik (teramati + prakiraan 6/12/18 jam) | [Darwin VAAC](https://www.bom.gov.au/aviation/warnings/volcanic-ash/) (BOM) |

## Teknologi

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Google Maps (`@vis.gl/react-google-maps`) · Leaflet · Firebase (Firestore, Auth, AI Logic, Hosting) · GitHub Actions

## Cara menjalankan

Kebutuhan: Node.js 22+ dan npm.

```bash
git clone https://github.com/ikhwanreza99/DisasterWatch.git
cd DisasterWatch
npm install
cp .env.example .env   # lalu isi key yang dibutuhkan
npm run dev            # http://localhost:3000
```

Tanpa key pun aplikasi tetap jalan, dengan data demo, Leaflet/OSM, dan fallback lokal.

### Environment variable

| Variable | Kegunaan |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps + Google Weather. Batasi dengan HTTP referrer. |
| `VITE_FIREBASE_*` | Firestore, Auth, dan App Check (opsional; kalau kosong, pakai data demo) |
| `VITE_GEMINI_MODEL` | Nama model Gemini saja (opsional). Tidak ada API key yang ikut ke bundle. |
| `GEMINI_API_KEY` | Hanya di server: proxy Gemini (`/api/ai/generate`). Jangan pakai awalan `VITE_`. |
| `NASA_FIRMS_MAP_KEY` | Hanya di server: proxy FIRMS dan snapshot saat build. Jangan pakai awalan `VITE_`. |

Key FIRMS gratis bisa diminta di https://firms.modaps.eosdis.nasa.gov/api/map_key/.

> Nilai `VITE_*` ikut masuk ke JavaScript publik. Jangan isi dengan secret server yang asli.

## Script

| Perintah | Keterangan |
|---|---|
| `npm run dev` | Dev server di port 3000 (dengan proxy untuk FIRMS, BMKG, dan VAAC) |
| `npm run build` | Build production ke `dist/` |
| `npm run preview` | Pratinjau hasil build |
| `npm run lint` | Cek tipe (`tsc --noEmit`) |
| `npm run seed:firestore` | Isi Firestore dengan data demo |
| `npx tsx scripts/testBmkgWeather.ts` | Tes parser peringatan cuaca BMKG (juga `testBmkgForecast.ts`, `testBmkg.ts`) |

## Struktur proyek

```
src/
  components/        UI (MapCanvas, sidebar, modal, overlay peta)
  services/
    bmkg/            Gempa, peringatan & prakiraan cuaca BMKG
    firms/           Titik panas NASA FIRMS
    magma/           Gunung api + gerakan tanah MAGMA Indonesia
    vaac/            Advisory abu vulkanik Darwin VAAC
    weather/         Google Weather (insiden + kota besar)
    ai/, intelligence/, pipeline/, store/
  lib/firebase/      Setup Firebase
scripts/             Seeding dan tes parser
.github/workflows/   Deploy Firebase Hosting
```

## Deploy

Setiap push ke `main` otomatis di-build lalu di-deploy ke Firebase Hosting (`.github/workflows/deploy-hosting.yml`). Workflow yang sama juga jalan terjadwal (kira-kira setiap 30 menit) untuk memperbarui snapshot abu vulkanik, dan bisa dijalankan manual dari tab Actions. Key untuk build diambil dari GitHub repository secrets, dengan nama yang sama seperti variable `VITE_*` di atas.

### Batasan yang diketahui

- Firebase Hosting hanya menyajikan file statis, jadi proxy dev tidak ada di production:
  - **ABU VULKANIK**: BOM memblokir request langsung dari browser, jadi production memakai snapshot (`/data/vaac.json`). Workflow deploy memperbaruinya kira-kira setiap 30 menit (`scripts/fetchVaacSnapshot.ts`), sehingga data di production bisa tertinggal 30–60 menit. Saat dev lokal, data diambil langsung lewat proxy.
  - **Peringatan cuaca BMKG** tampil "BROWSER ACCESS BLOCKED", karena BMKG juga memblokir akses langsung dari browser.
- **MAGMA** membaca data yang tertanam di halaman peta publik MAGMA (API resminya butuh login). Kalau PVMBG mengubah halaman itu, layer akan tampil "N/A", aplikasi tidak crash.
- Laporan gerakan tanah dari MAGMA sudah lama (2022–2023). Tanggalnya ditampilkan di setiap pop up.

## Sumber data & atribusi

BMKG · NASA FIRMS (LANCE/EOSDIS) · MAGMA Indonesia, PVMBG – Badan Geologi · Darwin VAAC, Australian Bureau of Meteorology · Google Maps Platform · © kontributor OpenStreetMap.
Setiap layer menautkan ke sumbernya. Ikuti ketentuan penggunaan masing-masing penyedia data.
