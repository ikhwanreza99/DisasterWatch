# Cloud Run + Firebase Hosting (aman kunci)

Tujuan: **tidak ada kunci rahasia di browser**. Frontend statis dilayani Firebase
Hosting; panggilan `/api/ai` (Gemini) dan `/api/firms` (NASA FIRMS) di-rewrite ke
Cloud Run, yang menyimpan kunci di Secret Manager.

```
Browser ──► Firebase Hosting ──/api/**──► Cloud Run (disasterwatch-api)
             (dist statis)                   ├─ /api/ai    → Gemini  (GEMINI_API_KEY)
                                             └─ /api/firms → FIRMS   (NASA_FIRMS_MAP_KEY)
```

## Penting: aplikasi tetap jalan tanpa Cloud Run

Perbaikan kebocoran kunci **tidak bergantung** pada Cloud Run:

| Fitur | Tanpa Cloud Run | Dengan Cloud Run |
|---|---|---|
| Asisten AI | Firebase AI Logic (jalur utama) | + fallback Gemini langsung via proxy |
| Titik panas FIRMS | snapshot `/data/firms.json` (dibuat saat build) | data FIRMS live via proxy |
| Kunci Gemini/FIRMS di browser | **tidak ada** | **tidak ada** |

Jadi push ke `main` sekarang **aman**: kalau Cloud Run belum ada, workflow otomatis
mendeploy Hosting tanpa rewrite `/api/**`, dan aplikasi memakai fallback di atas.

## Otomatis dari GitHub Actions

`deploy-hosting.yml` menjalankan, berurutan:

1. build + snapshot data (FIRMS/VAAC/berita/dll),
2. `npm run check:bundle-secrets` (gagal bila ada rahasia server di `dist/`),
3. **best effort**: buat/refresh secret `gemini-key` & `firms-key` dari repo secret
   `GEMINI_API_KEY` / `NASA_FIRMS_MAP_KEY`,
4. **best effort**: deploy Cloud Run `--source .` (build dari `Dockerfile`),
5. **rewrite `/api/**` hanya bila service Cloud Run benar-benar ada**,
6. deploy Hosting (live).

Semua langkah Cloud Run memakai `continue-on-error: true`, jadi kegagalan IAM
**tidak pernah** menggagalkan deploy Hosting.

## Yang dibutuhkan dari pemilik project GCP (sekali saja)

Hanya pemilik project `disasterwatch-61ed5` yang bisa melakukan ini:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com \
  --project disasterwatch-61ed5
```

Beri role ke service account GitHub Actions
(`FIREBASE_SERVICE_ACCOUNT_DISASTERWATCH_61ED5`):

`roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/cloudbuild.builds.editor`,
`roles/artifactregistry.writer`, `roles/storage.admin`, `roles/secretmanager.admin`.

Setelah itu: cukup **push ke `main`** → Cloud Run otomatis ter-deploy dan rewrite
`/api/**` otomatis aktif. Tidak perlu ubah kode lagi.

Alternatif manual (oleh pemilik project):

```bash
GEMINI_API_KEY="<kunci-baru>" NASA_FIRMS_MAP_KEY="<firms-key>" ./scripts/deployCloudRun.sh
```

## Repo/owner: tambahkan dua GitHub Secrets

Agar workflow bisa mengisi Secret Manager otomatis:

- `GEMINI_API_KEY` — kunci Gemini **baru** (setelah rotasi).
- `NASA_FIRMS_MAP_KEY` — kunci FIRMS (boleh pakai nilai `VITE_NASA_FIRMS_MAP_KEY` lama).

## 1. ROTASI kunci Gemini yang bocor (WAJIB, lakukan dulu)

Kunci `AQ.Ab8RN6…` **sudah publik** di bundel lama. Hapus di
**Google Cloud Console → APIs & Services → Credentials** (atau AI Studio → API keys),
lalu buat kunci baru. Setelah dicabut, kunci di bundel lama tidak berguna.

## 2. Verifikasi setelah deploy

```bash
URL=https://disasterwatch-61ed5.web.app
# a) Tidak ada kunci rahasia di bundel:
for a in $(curl -s "$URL/" | grep -oE '/assets/[A-Za-z0-9_.-]+\.js'); do
  curl -s "$URL$a" | grep -oE 'AQ\.[A-Za-z0-9_-]{20,}|VITE_GEMINI_API_KEY|generativelanguage'
done | sort -u   # harapan: KOSONG
# b) Proxy hidup? 503 = proxy ada tanpa kunci server; 404/HTML = rewrite belum aktif:
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/api/ai/generate" \
  -H 'Content-Type: application/json' -d '{"model":"m","prompt":"hi"}'
# c) FIRMS live via proxy (setelah rewrite aktif):
curl -s "$URL/api/firms/VIIRS_SNPP_NRT/92,-13.5,143,9/1/2026-10-15" | head -1
```

Di **DevTools**: pastikan tidak ada request ke `generativelanguage.googleapis.com`
dan URL `/api/firms/...` tidak memuat kunci.
