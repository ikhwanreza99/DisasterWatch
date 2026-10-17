# Peta AI Helpdesk

Basis audit: origin/main 70810a0, 17 Oktober 2026. Perubahan awal ada pada branch codex/ai-helpdesk-main-review; belum dipush atau dimerge.

## Folder dan file terkait

| Lokasi | Tanggung jawab / file utama |
| --- | --- |
| src/App.tsx | Membuka panel, konteks insiden, draft pesan/lampiran, callback laporan; panel dimuat lazy. |
| src/components/ | AIHelpdeskPanel.tsx: empat layanan, state percakapan, pertanyaan laporan, rangkuman, upload, konfirmasi. MapChatComposer.tsx: input awal dari peta. SlimSidebar.tsx dan detail/IncidentNewsPanel.tsx: pintu masuk. |
| src/services/ai/ | disasterAssistant.ts: jawaban Gemini dan fallback; disasterAssistantContext.ts: snapshot fakta; prompts.ts: instruksi; reportIntent.ts: deteksi laporan; helpdeskAttachment.ts: validasi file; disasterExtraction.ts + schemas.ts: ekstraksi; disasterValidation.ts: duplikasi/konflik; nttAssistant.ts + nttClaims.ts: kasus NTT; recentDisasterList.ts: daftar bencana terbaru. |
| src/lib/firebase/ | ai.ts: Firebase AI Logic lalu proxy; geminiConfig.ts: model; config.ts: aplikasi Firebase; auth.ts + identity.ts: identitas termasuk pelapor anonim; firestore.ts: akses database. |
| server/ | index.ts memasang endpoint; aiProxy.ts menangani /api/ai/generate dengan kunci server, autentikasi dan rate limit. |
| src/services/pipeline/ | reportPipeline.ts: identitas → ekstraksi → validasi → penyimpanan; gagal menyimpan ke server pada sesi nyata dianggap gagal. |
| src/services/store/ | disasterStore.ts: penyimpanan/pembacaan laporan; humanitarianRepo.ts: data kemanusiaan terkait. |
| src/services/intelligence/ | aidGapEngine.ts, impactEngine.ts, priorityEngine.ts: perhitungan data untuk konteks/jawaban. |
| src/services/places/ | Kandidat lokasi evakuasi, pencarian, rekomendasi dan alokasi. Pada main, Cari Posko di panel masih membaca route.checkpoints insiden secara langsung. |
| src/services/weather/ | cityWeather.ts: daftar kota untuk saran lokasi terdekat melalui geolocation. |
| src/domain/ + src/types.ts | intelligence.ts: laporan, bantuan, identitas; nttCase.ts: model kasus; DisasterIncident: tipe konteks insiden. |
| src/data/ | currentIncidents.ts, disasters.ts, seedDemo.ts, nttCase.ts: referensi data/konteks; bedakan data demo dan data sumber. |
| src/i18n/ | Provider bahasa dan translations/modals.ts, services.ts, shell.ts untuk teks panel/layanan. |
| tests/ | reportAccess.test.ts, reportIntent.test.ts, helpdeskAttachment.test.ts, recentDisasterList.test.ts, nttCase.test.ts, geminiCandidates.test.ts. |
| docs/ | AI_USAGE.md, ANONYMOUS_REPORTING.md, LOADING_AID_HELPDESK_REVIEW.md dan dokumen ini. |
| root | .env.example, firebase.json, firestore.rules, vite.config.ts: konfigurasi layanan, hosting, akses dan development proxy. |

## Alur

Chat: App / composer → AIHelpdeskPanel → detectReportIntent → askAssistant / askNttAssistant → snapshot → Firebase AI Logic / proxy Gemini → fallback deterministik jika AI gagal.

Laporan: pertanyaan → lampiran opsional → rangkuman → konfirmasi → ensureReportUser → upload Storage bila ada → submitReportPipeline → ekstraksi → validasi → saveReport → callback App.

Cari posko dan sebagian Pelajari Bencana dijawab langsung dari data/panduan lokal, sehingga respons panel tidak selalu menggunakan Gemini.

## Perbaikan awal

- Validasi ukuran maksimal 5 MB dan MIME diterapkan juga pada initialAttachment dari composer, bukan hanya pemilih file panel.
- Narasi yang memulai laporan dimasukkan ke rangkuman dan rawText; pesan pengguna tidak digandakan dengan pesan template.
- Sesudah submit berhasil, state laporan dibersihkan dan pilihan layanan ditampilkan kembali.
- Submit dan pemilihan lampiran dibatasi pada tahap yang sesuai.
- Perilaku pelaporan anonim main dipertahankan.

## Pekerjaan lanjutan

- Riwayat chat belum dikirim ke askAssistant; konteks pertanyaan lanjutan masih terbatas. Pencocokan kota memakai substring sederhana.
- Pelajari Bencana dengan konteks memakai aturan kata kunci Indonesia; prompt Gemini juga masih meminta Bahasa Indonesia walaupun UI Inggris.
- Koreksi laporan masih mengulang pertanyaan, belum mengedit satu field.
- Pencocokan insiden laporan belum mempertimbangkan jenis bencana; periksa sebelum mengikat koordinat.
- Panel belum menunjukkan engine jawaban. Proxy menolak sesi anonim; akses publik Gemini bergantung pada konfigurasi Firebase AI Logic atau fallback.
- App menerima laporan baru lewat callback sesi; jangan menganggap laporan sinkron lintas pengguna tanpa memeriksa listener dan pembacaan ulang.
- Branch lokal fizri/AIHelpdesk mempunyai implementasi riwayat, scope, koreksi field dan validasi yang lebih luas. Integrasi perlu mempertahankan perubahan main, termasuk akses anonim dan daftar bencana terbaru; jangan menyalin panel lama secara utuh.

## Validasi dan batas

TypeScript, build produksi dan tes terfokus dijalankan lokal. Belum menguji interaksi browser, respons Gemini live, upload Storage, atau penyimpanan Firestore lintas sesi.

## Evaluasi lanjutan — bahasa, sumber data, pembatalan

Temuan awal:
1. ASSISTANT_SYSTEM, askAssistant dan askNttAssistant memaksa Bahasa Indonesia. Jalur Pelajari Bencana menampilkan panduan Indonesia langsung. Fallback generik 14 hari belum memiliki kunci terjemahan yang sesuai.
2. Snapshot menetapkan isDemoData=true dan prompt menyebut seluruh dashboard demo/prototipe. Ini bukan hasil pemeriksaan Firebase. App sendiri memakai insiden bersumber lokal ditambah moderasi/insiden approved Firestore; laporan/bantuan sebelumnya diinisialisasi dari demoReports/demoAid tanpa listener.
3. Tidak ada pemrosesan perintah pembatalan sebelum jawaban disimpan ke field form.

Perubahan lanjutan (menggantikan catatan implementasi awal di atas):
- assistantLanguage.ts menetapkan bahasa percakapan dari pesan yang jelas; nama kota/angka mempertahankan bahasa sebelumnya. Perubahan pilihan bahasa UI juga diperhatikan. Prompt meminta seluruh prosa/istilah mengikuti bahasa tersebut; respons model yang jelas mencampur bahasa ditolak dan memakai fallback. Nama sumber/tempat serta kutipan sumber dipertahankan. Ini deteksi heuristik, bukan jaminan sempurna untuk setiap variasi bahasa.
- Riwayat empat pesan terakhir disertakan secara terbatas. Jalur belajar tidak lagi langsung menempelkan panduan Indonesia ke respons English. NTT memiliki prompt bahasa dan fallback English.
- reportControl.ts mendeteksi pembatalan sebelum pertanyaan, lampiran dan konfirmasi, termasuk “Tidak jadi melaporkan” dan “Cancel my report”. State draf aktif/lampiran dibersihkan; riwayat chat tetap terlihat. “Tidak ada korban” dan “No document” bukan pembatalan. Tombol Batalkan laporan tersedia. Pembatalan tidak membatalkan pengiriman yang sudah berjalan; kontrol dinonaktifkan selama pengiriman.
- operationalRecords.ts membaca koleksi reports dan aid melalui listener, masing-masing maksimal 200 catatan terbaru, mengecualikan isMock. Koleksi kosong/gagal tidak diganti data demo. Callback submit dideduplikasi berdasarkan ID. Listener dibersihkan saat unmount.
- assistantSources.ts membawa status loading, cache, firestore, unavailable, local/mixed ke konteks dan footer. Firestore hanya disebut terkonfirmasi sesudah snapshot server tanpa pending writes. Insiden tetap campuran dataset sumber lokal dan Firestore; tidak semua data aplikasi berasal dari Firebase.
- isDemoData dihitung dari tanda isMock; instruksi yang selalu menyebut prototype dihapus. Ringkasan dan detail konteks merupakan snapshot terbatas, bukan seluruh database. Dokumen Firestore bukan otomatis bukti resmi/terverifikasi.
- Pertanyaan “bencana hari ini” / “disasters today” memakai tanggal kejadian WIB. eventDate tersimpan diprioritaskan atas tanggal bundle. Timestamp pembaruan bukan tanggal kejadian. Tidak ada catatan hari ini berarti belum ada dalam snapshot, bukan membuktikan tidak terjadi bencana.

Batas yang masih ada:
- Koleksi humanitarian (incidentArticles, incidentClaims, incidentAidEvents, dll.) tidak otomatis seluruhnya menjadi konteks Helpdesk. Kasus NTT memiliki store tersendiri. Integrasi sumber lintas koleksi harus dirancang berdasarkan kebutuhan pertanyaan, tanpa mengirim seluruh database ke model.
- Filter insiden/moderasi dan jendela tanggal main tetap berlaku. Data lokal bersumber tetap digunakan sebagai bagian dari baseline insiden.
- Preview lokal tidak dikonfigurasi ke Firebase produksi. Karena itu pengujian browser hanya membuktikan alur UI dan fallback lokal, bukan koneksi Gemini/Firestore live. Tidak ada laporan produksi yang dikirim saat pengujian.
- Deteksi bahasa dan pembatalan berbasis aturan masih dapat melewatkan variasi ungkapan; perlu perluasan berdasarkan contoh percakapan nyata.

Verifikasi: TypeScript dan build produksi lulus; suite utama final 141/141 lulus, termasuk regresi penjagaan bahasa; browser membuktikan pembatalan di awal dan konfirmasi, “No document” menuju rangkuman, serta respons hari ini dalam English tanpa label prototype. Belum push, merge atau deploy.
