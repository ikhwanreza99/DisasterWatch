# Threads: sumber sosial media tambahan

Provider baru memakai endpoint resmi Meta `GET https://graph.threads.net/v1.0/keyword_search`, q nama wilayah + jenis bencana, search_type RECENT, fields id,text,username,permalink,timestamp. Token hanya di backend. Maksimum 20 post per titik per run; tanpa pagination. Filter lokal membatasi 7 hari kalender WIB dan kecocokan lokasi/jenis bencana. Pencarian yang berhasil bukan approval kejadian.

## Langkah Meta developer

1. Buka Meta for Developers, buat app dan pilih use case untuk akses Threads API. Gunakan akun Threads operator yang akan mengizinkan aplikasi.
2. Pada konfigurasi Threads, tambahkan akun operator sebagai tester bila app masih Development; terima undangannya melalui pengaturan Threads.
3. Siapkan permission `threads_basic` dan `threads_keyword_search`. Periksa level akses dan persyaratan App Review di dashboard. Akses pencarian publik bergantung pada permission yang diberikan Meta; jangan menganggap token developer otomatis dapat membaca semua unggahan publik.
4. Isi konfigurasi aplikasi yang diminta Meta: domain web DisasterWatch, privacy policy, data deletion URL/instructions yang nyata, dan redirect URI OAuth. Jangan mengisi endpoint callback yang belum diimplementasikan di web. Integrasi ini belum menyediakan callback Threads otomatis.
5. Cara awal memakai Postman: fork koleksi resmi Meta Threads, isi Threads App ID, App Secret dan redirect URI yang sama persis dengan konfigurasi Meta. Gunakan OAuth Authorization Code dan scope dua permission tadi. Redirect URI harus sesuai alur callback OAuth Postman yang Anda pilih. Pilih Get New Access Token, login sebagai akun Threads operator, lalu izinkan aplikasi.
6. Jalankan request Get Long-Lived Access Token (`grant_type=th_exchange_token`) dalam koleksi Meta. Simpan token user hasil pertukaran, bukan App Access Token.
7. GitHub → Settings → Secrets and variables → Actions → Secrets → tambah `THREADS_ACCESS_TOKEN`. Jangan memakai awalan VITE dan jangan menempelkan token ke chat atau repository.
8. Jalankan workflow hosting agar konfigurasi terlihat pada `/status`. Crawler kejadian menjalankan pencarian setelah gate 24 jam lolos. Muat ulang halaman tidak menjalankan pencarian.
9. Uji request Search for Threads Posts di Postman dengan query lokasi yang diketahui. Hasil kosong dapat berarti tidak ada post, filter terlalu sempit, atau akses permission belum mencakup pencarian yang diharapkan; tidak otomatis berarti crawler rusak.
10. Perbarui token sebelum kedaluwarsa lewat request Refresh Access Token (`grant_type=th_refresh_token`) lalu ganti secret. Pembaruan token belum diotomatisasi.

## Tampilan dan penyimpanan

Update Berita Terkini memiliki tab Berita dan Sosmed · Threads. Unggahan disimpan di `incidentArticles` dengan `discoveredBy: threads:keyword-search`, sourceType OTHER, verificationStatus UNVERIFIED. Hanya kecocokan lokasi/tanggal yang masuk tab sosial, bukan feed media/BNPB. Tidak otomatis diekstrak sebagai kebutuhan, angka bantuan, posko, atau persentase pemulihan. Tidak menerbitkan post, reply, pesan, atau mengubah akun Threads.

Meta menentukan kelayakan use case, permission dan redisplay data. Jelaskan penggunaan yang sebenarnya dalam App Review; jangan mengajukan aplikasi sebagai alat publishing bila kenyataannya monitoring bencana. Jangan meminta permission write/publish yang tidak digunakan.

Referensi resmi: https://developers.facebook.com/documentation/threads dan https://www.postman.com/meta/threads/collection/dht3nzz/threads-api
Pencarian: https://www.postman.com/meta/threads/request/m9j4i2x/search-for-threads-posts
