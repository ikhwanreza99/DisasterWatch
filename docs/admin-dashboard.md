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

## Evaluator (jury) account `admindemo`

A second account, `admindemo` / Firebase Auth `admindemo@disasterwatch-61ed5.local`,
exists for evaluation: its credentials are printed on the `/admin` login card so a
judge can run the approval workflow without the primary account. The project owner
chose full parity with `admin`.

That parity is the whole risk: anyone who opens `/admin` can approve or reject the
live incidents, not only judges. Treat the credential as public, and close it when
the evaluation window ends (steps below).

### How parity is granted, and why it is a uid

Parity normally means the custom claim `superuser:true`, which only the Firebase
Admin SDK can set. Neither service account available to CI holds Firebase
Authentication Admin — both answer `auth/insufficient-permission` — so the claim
cannot be provisioned from a workflow. The account is therefore listed by uid in the
`superuser()` predicate of `firestore.rules`:

```
request.auth.uid == 'uHlTB6xYKJUw4Mv6uvnv1A9E5Nl2'
```

A uid is server-generated, so a client cannot choose one. That is why the account is
not matched on its email: sign-up is enabled in this project, so an email check would
hand superuser to whoever registered that address first.

The client does not repeat that list. `superuser()` in `src/admin/firebaseApi.ts` no
longer reads `users/admin`; when the token carries no claim it probes a superuser-only
read (`reportReviews`, capped at one document), so success means the rules consider the
account a superuser and the two can never drift. The same probe runs on `/login`, so a
login that the rules would reject fails immediately instead of opening a dead session.

### Moving to a claim, and removing the account

To use the claim instead, grant the CI service account `roles/firebaseauth.admin`,
run the `Setup jury demo superuser` workflow (it sets the claim and verifies the
readback), then delete the uid line. The workflow does one thing only and never
re-provisions the primary account:

```
node --import tsx scripts/provisionDemoSuperuser.ts
```

To revoke the evaluator account: delete or disable
`admindemo@disasterwatch-61ed5.local` in Firebase Console → Authentication, remove the
uid line from `superuser()`, publish rules with the `Publish Firestore rules` workflow,
and remove the evaluator card in `src/admin/AdminPage.tsx`.


