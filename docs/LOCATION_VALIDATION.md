# Validasi wilayah titik bencana

Kesalahan ditemukan pada koordinat impor Bojonegoro (Jawa Timur, tetapi koordinat Sulawesi) dan Kota Padang (Sumatera Barat, tetapi koordinat Sumatera Utara). Tabel BNPB menyediakan informasi laporan; script terpisah mencocokkan koordinat dari CSV. Jadi ketidakcocokan pada dataset impor tidak membuktikan bahwa titik asal API BNPB salah.

Koordinat Bojonegoro dikoreksi ke titik representatif wilayah Kecamatan Bojonegoro, memakai contoh koordinat Kelurahan Ledokwetan dari BPS Kecamatan Bojonegoro Dalam Angka 2022, Tabel 1.5 (-7.14613,111.8753). Ini bukan lokasi presisi lahan terbakar. Padang memakai titik representatif yang sudah ada pada dataset reviewed (-0.9471,100.4172), sesuai rentang administratif Kota Padang.

Sumber: BPS Bojonegoro dan https://padang.go.id/arsip/105 ; batas administratif Bojonegoro juga diterangkan pada https://jatim.bpk.go.id/kabupaten-bojonegoro/.

Pemeriksaan otomatis menggunakan kotak batas kasar provinsi untuk menolak koordinat yang jelas berada di provinsi lain. Ini bukan polygon yurisdiksi dan bukan geocoding presisi: nama kota/desa yang tertukar di provinsi sama masih membutuhkan fact-check admin. Status REGION_CHECKED berarti lolos pemeriksaan kasar, bukan bahwa lokasi terdampak sudah diverifikasi.

Impor CSV menolak kecocokan nama ambigu, membandingkan provinsi bila tersedia, dan menahan koordinat di luar batas provinsi. Dataset dan approval titik juga menolak kesalahan kasar tersebut. Admin wajib memeriksa kota/kabupaten, provinsi, koordinat pada peta, jenis bencana, tanggal dan bukti sumber sebelum approval. Data lokasi yang salah perlu dikoreksi oleh jalur admin data sebelum persetujuan.
