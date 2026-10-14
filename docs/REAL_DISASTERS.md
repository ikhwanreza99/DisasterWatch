# Dokumen REAL pada collection disasters

Workflow hosting menjalankan `scripts/syncRealDisasters.ts` sebelum deployment. Script hanya menulis record wilayah dengan sumber dari dataset reviewed BNPB/penerbit resmi, ditambah kasus khusus NTT dari BMKG. Data REAL di sini berarti kejadian bersumber, bukan semua angka dampak/recovery sudah terverifikasi atau bencana masih berlangsung.

Field utama: `demoNotice: "REAL"`, `isMock: false`, `sourceName`, `sourceUrl`, `eventDate`, `eventStartDate`, `sourceReviewedAt`, `dataOrigin: "REVIEWED_SOURCE_SNAPSHOT"`, `datasetWindow`, dan `isArchivedCase`.

ID dokumen tetap sama dengan ID titik pada aplikasi, misalnya `padang`, `merauke-2026-10`, dan `ntt-sumba-barat-daya-2026-10-04`. Dokumen yang semula demo hanya diganti bila ada record nyata dengan ID sama. Nilai simulasi seperti biaya/recovery tidak dibawa ke record REAL. Dokumen REAL yang sudah ada menerima pembaruan field sumber sambil mempertahankan field tambahan. Tidak menghapus kota lain atau mengubah demo-only menjadi REAL.

Seed demo dilindungi agar tidak menimpa `disasters` yang sudah `isMock:false` atau `demoNotice:REAL`. Collection laporan/kebutuhan/bantuan demo tidak ikut dilabeli REAL.

Untuk memeriksa: Firebase Console → Firestore → disasters → pilih padang, Merauke atau NTT. Verifikasi field REAL dan URL sumbernya. Banjar/Cianjur/Demak/Pekanbaru lama tetap DEMO jika belum ada bukti pada dataset sumber aktif.

`node --import tsx scripts/syncRealDisasters.ts --dry-run` memeriksa rencana tanpa jaringan/penulisan. `--verify-only` melakukan readback dengan service account backend tanpa penulisan.

Saat ini aplikasi membaca daftar wilayah dari snapshot reviewed di kode; sinkronisasi ini menyamakan record Firestore untuk daftar wilayah tersebut. Ini belum mengubah aplikasi menjadi daftar kota dari Firestore atau menjadikan BNPB sebagai feed realtime.
