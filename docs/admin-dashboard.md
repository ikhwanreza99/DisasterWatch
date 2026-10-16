# Dashboard superuser

Route produksi: `/admin`. Username `admin` memakai akun Firebase Auth internal `admin@disasterwatch-61ed5.local`. Password hanya berasal dari secret provisioning `ADMIN_INITIAL_PASSWORD`, bukan VITE atau bundle browser. Akun memiliki custom claim `superuser:true`. Sesi admin memakai aplikasi Firebase terpisah dengan session persistence; sesi Google pelapor tidak ditimpa.

Dashboard hasil merge `fizri/homepage-verificator` membaca Firestore langsung dengan Firebase SDK. Static Firebase Hosting tidak membutuhkan server Express tambahan. Adapter Express lama disimpan untuk tes/preview lama; bukan jalur produksi dashboard.

Menu Verifikasi Laporan membaca collection `reports`; Data Bencana membaca `disasters` atau `incidents`; sumber artikel fact-check dari `incidentArticles`. Approval laporan atau titik memerlukan catatan minimal 10 karakter dan 1–5 URL sumber HTTPS. Data demo tidak dapat disetujui menjadi REAL. Superuser membandingkan lokasi, jenis bencana, tanggal, berita, BNPB/BMKG dan eviden lain; AI tidak memberi persetujuan akhir.

Approval memakai transaksi Firestore: status laporan VERIFIED, titik APPROVED, reviewer UID, waktu, catatan dan evidenceUrls, serta audit immutable di `reportReviews`. Bila laporan tidak memiliki titik, admin memasukkan koordinat dan transaksi membuat titik REAL baru. Titik APPROVED terbaca oleh peta publik bila dalam rentang 7 hari, kecuali arsip khusus NTT. Dataset sumber yang sudah reviewed tetap tersedia saat database gagal.

Rules hanya menerima laporan baru dari provider Google OAuth, dengan `reporterUid` sama dengan UID login, `isMock:false`, dan status belum VERIFIED. Pelapor tidak dapat mengisi metadata reviewer atau mengubah status approval. Claim superuser diberikan Admin SDK, tidak dapat ditambahkan sendiri oleh pengguna.

Setup: GitHub workflow `Setup superuser and approval rules` memvalidasi/deploy Firestore Rules, mengaktifkan Email/Password tanpa mengubah Google OAuth, lalu membuat akun dan claim. Menjalankan workflow ini lagi mereset password sesuai secret dan mencabut sesi lama; tidak dijalankan otomatis oleh hosting.

Status layanan menggunakan halaman status yang sama dengan publik. Token Usage tetap data provider dari browser ini, bukan tagihan agregat proyek. Tidak ada password, token login, prompt atau isi laporan yang disimpan dalam telemetry token.

Validasi: TypeScript/build, tes legacy Express, kebijakan evidence, rules validation dan uji login Firestore produksi. Persetujuan kejadian nyata tidak dilakukan otomatis demi uji: keputusan fact-check tetap milik superuser.

## Rejecting a report or incident

Use Tolak laporan, select HOAX or NO_DISASTER, write a 10–1000 character
fact-check note and confirm the check. Evidence URLs are optional for rejection
(max 5 HTTPS URLs), still required for approval. Real records only; demo reports
cannot decide the existence of real incidents. An already approved report may
also be rejected if later evidence disproves it. Rejected records cannot be
approved through another report; reopening is not implemented.

A transaction writes reports.verificationStatus=REJECTED (when reviewing a
report), disasters.approvalStatus=REJECTED and an immutable reportReviews audit.
The linked disasterId is authoritative: this action rejects the existence of
that entire incident, not just one description. Unlinked reports create a
rejection decision at disasters/reported-{reportId}, never a map point.
Map incident markers wait for the server moderation snapshot and remove rejected
IDs from bundled and previously approved markers. Sensor overlays are separate.
The source sync merges source metadata and preserves approvalStatus.

Publish the complete firestore.rules for rejection writes. The manual workflow
Publish Firestore rules validates/releases rules without changing admin accounts.
If IAM returns 403, publish through Firebase Console or grant Firebase Rules Admin
to the service account shown in the workflow log. No credential secrets are logged.

## Review form update

Approve/Reject buttons are clickable before the form is completed; click validation
shows missing requirements. Approve requires 1–3 checked source articles, with no
manual URL input. The optional note defaults to a statement recording the selected
evidence count. Province uses the recognized 38-province list. Reject opens its
own modal with reason and required fact-check note. DEMO data still cannot change
the existence of real incidents; clicking explains this restriction.

Google Search refresh reloads the published server status snapshot only. A nearby
workflow link runs a fresh backend probe with check_google_search enabled.
Browser requests never receive the GitHub or backend API secrets.
