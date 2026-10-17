# Pengendali percakapan AI Helpdesk

Aturan runtime ada di `src/services/ai/helpdeskAgent.ts`, konstanta `HELPDESK_AGENT_RULES`. Panel tidak lagi memakai daftar pola kalimat untuk memulai, mengisi atau membatalkan laporan. File lama `reportIntent.ts` dan `reportControl.ts` dihapus.

## Kontrak keputusan

Setiap pesan teks dikirim ke Gemini bersama workflow, tahap, status jeda, field yang benar-benar sedang ditanyakan, draf aktif, riwayat delapan pesan terakhir (masing-masing maksimal 350 karakter), bahasa percakapan, katalog insiden ringkas, dan status lampiran. Riwayat/katalog dipangkas saat perlu agar prompt tidak melebihi 7900 karakter. Pesan terbaru maksimal 1600 karakter; konteks yang melebihi batas ditolak tanpa perubahan draf.

Gemini memilih tindakan berdasarkan makna dan konteks:

| Tindakan | Efek aplikasi |
| --- | --- |
| update_report | Memulai/mengisi/mengoreksi laporan; bisa mengisi beberapa field sekaligus. |
| cancel_report | Membersihkan draf aktif/lampiran, kembali ke menu. |
| pause_report | Menyimpan draf dalam sesi chat dan menampilkan tombol lanjut. |
| resume_report | Melanjutkan dari field yang belum terisi. |
| answer | Menjawab pertanyaan selingan memakai layanan jawaban berbasis data, tanpa mengubah draf. |
| clarify | Meminta klarifikasi tanpa mengubah draf. |
| review_report | Memeriksa kelengkapan lalu menampilkan rangkuman; tidak mengirim laporan. |
| skip_attachment | Melewati lampiran opsional; tidak membatalkan laporan. |

Ini daftar tindakan aplikasi, bukan daftar bentuk kalimat pengguna. Contoh ujaran berada di tes/evaluasi, bukan pencocokan pola runtime.

## Batas tindakan

- Output JSON divalidasi: action, bahasa, confidence, field dan jenis laporan dibatasi.
- Setiap perubahan field wajib memiliki bukti berupa potongan pesan terbaru. Nilai bisa dinormalisasi model, tetapi bukti harus benar-benar ada dalam pesan pengguna.
- Confidence di bawah 0,75, JSON rusak/terpotong, provider gagal, atau keluaran tidak valid: draf dipertahankan dan pengguna diminta mencoba lagi. Tidak ada fallback yang menganggap teks sebagai jawaban field saat itu.
- Pertanyaan selingan tidak menimpa atau menggeser field laporan.
- Koreksi mempertahankan field lain. Jika jenis layanan berubah, field bersama seperti lokasi tetap dipertahankan dan field yang tidak kompatibel dibuang.
- Isi pesan/katalog tidak dapat mengeksekusi perintah atau membuat tool baru. Tindakan tidak dikenal ditolak.
- Model tidak dapat submit. Hanya tombol Kirim Laporan sesudah rangkuman dan pemeriksaan kelengkapan yang menjalankan pipeline penyimpanan.
- Jeda hanya bertahan selama panel/sesi tersebut; tidak menambah penyimpanan draf setelah reload.

## Integrasi Gemini

Transport tetap Firebase AI Logic, lalu proxy server. Keputusan terstruktur menggunakan temperature 0 dan batas keluaran 2048 token; panggilan lama tetap default 512. Proxy hanya mengizinkan batas 2048 atau default, bukan angka arbitrer dari klien.

Jalur proxy menerima token Firebase terverifikasi, termasuk sesi anonim yang juga dipakai pelaporan publik. Tidak ada endpoint tanpa autentikasi baru. Batas 10 permintaan/UID/menit dan pembatas IP/origin produksi tetap berlaku. Tidak ada kunci Gemini yang ditaruh di browser.

## Verifikasi

`tests/helpdeskAgent.test.ts` menguji kontrak keputusan, kelengkapan konteks, isolasi draf, pengisian banyak field, koreksi, jeda/lanjut, kegagalan model, bukti pesan dan larangan submit otomatis.

`npm run test:agent:live` menjalankan `scripts/evalHelpdeskAgent.ts` dengan percakapan sintetis melalui Gemini sungguhan. Script manual ini memberi jeda 16 detik antarskenario dan satu retry setelah 60 detik ketika provider membatasi kuota. Script membutuhkan kunci server pada environment; tidak mengubah Firestore dan tidak dipanggil oleh suite tes reguler. Semua contoh kalimat hanya merupakan skenario evaluasi.

Evaluasi awal menemukan metadata topic=null pada tindakan laporan dan JSON terpotong. Metadata yang tidak berlaku kini dinormalisasi menjadi general; batas keluaran keputusan dinaikkan menjadi 2048. Satu fixture evaluasi juga diperbaiki agar riwayat dan pertanyaan urgensi tidak saling bertentangan. Hasil akhir dicatat setelah evaluasi selesai; kelulusan fixture bukan jaminan semua variasi bahasa akan selalu benar.

Uji browser lokal dengan transport evaluasi Gemini nyata membuktikan pengisian beberapa field sekaligus, koreksi lokasi saat pertanyaan lain aktif, pemeliharaan rincian lama dalam rangkuman, dan pembatalan dengan ungkapan bebas tanpa kata cancel/batal. Pengujian ini tidak mengirim laporan dan tidak membuktikan deployment maupun kredensial Firebase produksi sudah benar.

Hasil verifikasi akhir: 152/152 tes reguler lulus; 13/13 skenario evaluasi Gemini nyata lulus pada putaran dengan jeda (primary sempat 429 dan fallback model bekerja). TypeScript dan build produksi lulus; pemindaian bundle bersih pada 64 file.

### Free-text information routing

All `answer` decisions pass the original user message to `answerHelpdeskQuestion` and the grounded disaster assistant. Topic hints never dispatch a canned aid-post response. `general` covers disaster dates/details; `aid_posts` means physical aid posts or shelters only. Explicit location matches rank before previous selections. Today/recent queries retain the complete incident window. Aid-post records and candidate flags are included in grounded context for actual facility queries. The explicit Find Aid Posts service button retains its dedicated presentation.
