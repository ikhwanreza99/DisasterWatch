# National incident snapshot, 1–12 October 2026

The snapshot contains all 86 records in the downloaded BNPB table within this inclusive date range, grouped into 60 regency/disaster-type markers. Two additional reviewed locations (Palembang and Kotawaringin Barat) bring the map to 62 locations. This is coverage of the retrieved sources, not a guarantee that every disaster in Indonesia was reported or remains active. BMKG/FIRMS layers remain separate.

- Incident source: https://gis.bnpb.go.id/databencana/tabel/pencarian.php
- Table fetched using POST fields `tgl_awal=01/10/2026`, `tgl_akhir=12/10/2026`, `s_kejadian=`, `submit=Cari`; the importer independently filters dates because the server response also contains older records.
- Approximate regional coordinates: https://github.com/coll-j/indonesia-locations-data/blob/main/final_results/kota_kab_lat_long.csv (credit: coll-j; use permitted in repository README). Matched by normalized administrative name, preserving the Kota/Kabupaten distinction. These are representative region coordinates, not incident coordinates or affected-area boundaries.
- Regeneration: `python3 scripts/importBnpbSnapshot.py table.html kota_kab_lat_long.csv 2026-10-12`. Missing coordinates or an empty source abort without replacing the last snapshot.
- This is a reviewed, dated snapshot; no automatic national discovery job is claimed. Reimport and review the snapshot and update the range before publishing a new period.
- Article publication dates remain null when unknown. Event dates are never substituted for publication dates.
- Reviewed detik/RRI article metadata lives in `src/data/currentMedia.ts`. Paid crawler queries now include detik, RRI, ANTARA and Kompas, with exact location and date constraints; returned candidates still require relevance checks. Live paid crawling was not run during this update.

## Pembaruan 17 Oktober 2026

Rentang aktif: 14 hari kalender termasuk hari ini, WIB (4–17 Oktober pada saat pembaruan). Importer sekarang memakai 14 hari, bukan 7 hari.

Sebanyak 27 laporan tambahan yang belum ada dalam snapshot sebelumnya ditambahkan dari tabel BNPB yang terindeks dan diakses 17 Oktober. Total arsip menjadi 113 laporan dalam 68 kelompok wilayah/jenis, ditambah dua lokasi dari sumber lain. Filter runtime tetap membuang laporan di luar 14 hari. Tanggal laporan terbaru yang tersedia adalah 14 Oktober, bukan klaim cakupan lengkap sampai 17 Oktober. Endpoint tabel langsung (GET dan POST) mengembalikan HTTP 500 saat pemeriksaan; tautan dokumentasi individual yang tidak tersedia tidak direka. `sourceEvidence=BNPB_INDEXED_TABLE` menandai bukti tabel resmi tersebut, bukan artikel berita buatan.

Koordinat Pasuruan pada CSV berada di luar Jawa Timur sehingga ditolak. Titik representatif memakai tengah rentang astronomis Pemkab (-7.75, 112.85), dengan sumber dan pemberitahuan bahwa ini bukan lokasi kejadian: https://www.pasuruankab.go.id/halaman/gambaran-umum-kabupaten-pasuruan-2021 . Koordinat baru lainnya memakai dataset wilayah di atas dan lolos pemeriksaan batas provinsi; tetap membutuhkan pemeriksaan lokasi presisi.

Helpdesk menjawab permintaan 14 hari secara deterministik dari daftar yang benar-benar tampil dan telah melewati moderasi, dengan tanggal, jenis, rentang WIB, dan batas cakupan sumber.
