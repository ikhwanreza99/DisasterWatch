# Admin melalui profil Firestore

Collection `users`, document `admin`, menyimpan username, role SUPERUSER, authUid, accountStatus dan permissions. Tidak menyimpan password. Login tetap Firebase Auth, lalu hak approval diperiksa dari custom claim atau profil Firestore yang terikat UID. `users` tidak boleh ditulis dari browser sehingga pengguna tidak dapat mengangkat role sendiri.

Login admin belum aktif bila provisioning gagal HTTP 403. Ada dua cara penyelesaian:

## Otomatis dengan IAM

Beri service account dari `FIREBASE_SERVICE_ACCOUNT_DISASTERWATCH_61ED5` role Firebase Rules Admin dan Firebase Authentication Admin. Jalankan workflow Setup superuser and approval rules. Script membuat akun `admin@disasterwatch-61ed5.local`, memakai password dari ADMIN_INITIAL_PASSWORD, lalu mengisi users/admin dengan authUid dan status ACTIVE. Username UI tetap `admin`.

## Manual lewat Firebase Console

1. Authentication → Sign-in method → aktifkan Email/Password. Google tetap aktif untuk pelapor.
2. Authentication → Users → Add user. Email `admin@disasterwatch-61ed5.local`; password sesuai yang diminta. Salin User UID setelah akun dibuat.
3. Firestore → users → admin: set `authUid` menjadi UID tersebut, `role` menjadi `SUPERUSER`, `accountStatus` menjadi `ACTIVE`, `username` menjadi `admin`. Jangan menambahkan field password.
4. Firestore → Rules: salin isi firestore.rules dari versi main terbaru lalu Publish. Role harus diperiksa oleh rules, bukan hanya tombol dashboard.
5. Login pada `/admin` menggunakan username `admin`. Uji melihat data nyata dan meninjau evidence. Jangan melakukan approval kejadian tanpa fact-check.

Langkah manual tidak membutuhkan password di Firestore atau membuka write permission publik. Sebelum rules dipublish dan UID dihubungkan, profil PENDING_AUTH tidak berarti akun bisa login.
