/** English translations — modals slice. Keys are the Indonesian source strings. */
const modals: Record<string, string> = {
  'Draf diperbarui. Informasi lain tetap disimpan.': 'Draft updated. The other information has been kept.',

  'Saya belum dapat memahami maksud pesan ini karena layanan AI belum tersedia atau hasilnya belum cukup jelas. Draf Anda tidak berubah. Coba lagi, atau gunakan tombol layanan dan pembatalan.': 'I could not interpret this message because the AI service is unavailable or its decision is unclear. Your draft is unchanged. Please try again, or use the service and cancellation buttons.',
  'Laporan dijeda. Draf Anda tetap tersimpan dalam percakapan ini. Anda dapat bertanya atau melanjutkannya nanti.': 'The report is paused. Your draft remains in this conversation. You can ask questions or resume it later.',
  'Informasi itu belum dapat dimasukkan ke draf. Jelaskan bagian laporan yang ingin Anda ubah.': 'That information could not be added to the draft. Please explain which part of the report you want to change.',
  'Bagian mana yang ingin Anda koreksi? Ceritakan perubahannya; informasi lain tetap disimpan.': 'Which part would you like to correct? Describe the change; the other information will be kept.',
  'Lanjutkan laporan': 'Resume report',

  'Apakah Anda memiliki foto atau dokumen pendukung? Lampiran bersifat opsional dan tidak otomatis memverifikasi laporan.': 'Do you have a supporting photo or document? Attachments are optional and do not automatically verify a report.',

  'Batalkan laporan': 'Cancel report',
  'Laporan dibatalkan. Draf aktif dan lampiran telah dibersihkan. Tidak ada laporan yang dikirim. Silakan pilih layanan lain atau tulis pertanyaan Anda.': 'Report cancelled. The active draft and attachment have been cleared. No report was submitted. Choose another service or ask a question.',

  'Kapasitas (estimasi pembagian)':'Capacity (allocation estimate)',
  'Tutup form donasi':'Close donation form',
  'Pilih Posko Drop-off':'Choose a drop-off post',
  'Memuat daftar Posko Bantuan…':'Loading aid posts…',
  'Daftar posko gagal dimuat.':'Unable to load aid posts.',
  'Belum ada posko yang tersedia untuk wilayah ini.':'No posts are available for this area yet.',
  'Lihat di Google Maps':'View on Google Maps',
  'Usulan lokasi; konfirmasi operasional sebelum mengantar bantuan.':'Proposed location; confirm operations before delivering aid.',
  'Posko tujuan: {name}':'Destination post: {name}',
  '{qty} jiwa/posko (estimasi)':'{qty} people/post (estimate)',
  'Asumsi: {population} jiwa ÷ {count} posko.':'Assumption: {population} people ÷ {count} posts.',
  'Target pembagian; kapasitas lokasi belum diverifikasi.':'Allocation target; venue capacity is unverified.',
  'Sumber jumlah jiwa':'Population source',
  // ----- Shared labels -----
  Batal: 'Cancel',
  'Selesai & Tutup': 'Done & Close',
  'Lokasi:': 'Location:',
  'Posko Bantuan': 'Aid Post',

  // ----- ReportModal -----
  'Gagal memproses laporan: {error}': 'Failed to process report: {error}',
  'Buat Laporan Darurat Bencana': 'Create a Disaster Emergency Report',
  'Laporkan kejadian darurat atau ajukan penyaluran bantuan':
    'Report an emergency incident or request aid distribution',
  'Jenis Bencana': 'Disaster Type',
  'Kebakaran Hutan & Lahan (Karhutla)': 'Forest & Land Fire (Karhutla)',
  'Banjir Bandang / Genangan': 'Flash Flood / Inundation',
  'Gempa Bumi / Tanah Longsor': 'Earthquake / Landslide',
  'Lokasi Wilayah / Titik Acuan': 'Area Location / Reference Point',
  'Contoh: Jl. Ahmad Yani Km 14, Kab. Banjar': 'Example: Jl. Ahmad Yani Km 14, Banjar Regency',
  'Tingkat Urgensi': 'Urgency Level',
  'Darurat Tinggi': 'High Emergency',
  'Siaga Penuh': 'Full Alert',
  Waspada: 'Watch',
  'Kebutuhan Mendesak': 'Urgent Needs',
  'Contoh: Masker & Perahu Karet': 'Example: Masks & Rubber Boats',
  'Upload Bukti Kejadian (Foto / Video)': 'Upload Incident Evidence (Photo / Video)',
  '✓ Terpilih: {name}': '✓ Selected: {name}',
  'Upload Foto / Video Bukti Kejadian': 'Upload Photo / Video of Incident Evidence',
  'Format PNG, JPG, MP4 maksimal 15MB': 'PNG, JPG, MP4 format, max 15MB',
  'Keterangan Situasi & Dampak': 'Situation & Impact Description',
  'Jelaskan kondisi akses jalan, korban terdampak, atau titik api...':
    'Describe the road access conditions, affected victims, or fire hotspots...',
  'Menganalisis AI…': 'Analyzing with AI…',
  'Kirimkan Laporan': 'Submit Report',
  'Laporan Berhasil Terkirim!': 'Report Sent Successfully!',
  'Terima kasih. Laporanmu sudah diterima dan akan segera diverifikasi oleh tim penanggulangan darurat TRC & BPBD.':
    'Thank you. Your report has been received and will be verified shortly by the TRC & BPBD emergency response team.',
  'ID Laporan:': 'Report ID:',
  'Status Validasi:': 'Validation Status:',
  'Menunggu Validasi TRC': 'Awaiting TRC Validation',
  'Engine AI:': 'AI Engine:',
  'Keyakinan AI:': 'AI confidence:',
  'Gemini (Firebase AI Logic)': 'Gemini (Firebase AI Logic)',
  'Heuristik lokal': 'Local heuristics',
  '{pct}% (indikator AI)': '{pct}% (AI indicator)',
  'Ekstraksi:': 'Extraction:',
  'Buat Laporan Baru': 'Create New Report',

  // ----- DonationModal -----
  'Salurkan Bantuan / Donasi': 'Send Aid / Donation',
  'Pilih Jenis Bantuan': 'Select Aid Type',
  'Nama bantuan lainnya': 'Other aid name',
  'Contoh: pompa sedot, perahu karet, perlengkapan bayi':
    'Example: suction pump, rubber boat, baby supplies',
  'Jumlah / Kuantitas Bantuan': 'Aid Amount / Quantity',
  'Contoh: 200 Box atau Rp 500.000': 'Example: 200 Boxes or Rp 500,000',
  'Nama Donatur / Komunitas': 'Donor / Community Name',
  'Nama Lengkap': 'Full Name',
  'No. WhatsApp / Kontak': 'WhatsApp No. / Contact',
  'Posko Drop-off Terdekat:': 'Nearest Drop-off Post:',
  'Gudang Satgas Terpadu BPBD': 'BPBD Integrated Task Force Warehouse',
  'Posko Komando Induk': 'Main Command Post',
  'Konfirmasi Bantuan': 'Confirm Aid',
  'Komitmen Bantuan Diterima!': 'Aid Commitment Received!',
  'Terima kasih': 'Thank you',
  '. Penyaluran bantuan': '. The aid delivery of',
  '({qty}) untuk': '({qty}) for',
  'telah terdata di sistem logistik.': 'has been recorded in the logistics system.',
  'Kode Konfirmasi:': 'Confirmation Code:',
  Lainnya: 'Other',
  'Masker N95': 'N95 Mask',
  'Tangki Air Bersih': 'Clean Water Tank',
  'Paket Obat ISPA': 'ARI Medicine Package',
  'Paket Sembako': 'Groceries Package',

  // ----- LoginModal -----
  'Tutup login': 'Close login',
  'Masuk ke DisasterWatch': 'Sign in to DisasterWatch',
  'Masuk untuk laporkan bencana': 'Sign in to report a disaster',
  'Gunakan akun Google untuk melaporkan bencana dan menyimpan laporan Anda.':
    'Use a Google account to report disasters and save your reports.',
  'Gunakan akun Google. Setelah masuk, formulir laporan DisasterAI akan langsung terbuka.':
    'Use a Google account. After signing in, the DisasterAI report form will open automatically.',
  'Menghubungkan…': 'Connecting…',
  'Masuk dengan Google': 'Sign in with Google',
  'Mengalihkan ke halaman login Google…': 'Redirecting to the Google sign-in page…',
  'Login belum tersedia. Silakan coba lagi setelah layanan login diaktifkan.':
    'Login is not available yet. Please try again after the login service is enabled.',
  'Login belum berhasil. Silakan coba lagi.': 'Sign-in was not successful. Please try again.',
  'Login dibatalkan. Silakan coba lagi.': 'Sign-in cancelled. Please try again.',
  'Popup diblokir browser. Kami alihkan ke halaman login Google…':
    'The popup was blocked by the browser. Redirecting to the Google sign-in page…',
  'Permintaan login sebelumnya dibatalkan. Mengalihkan ke halaman login Google…':
    'The previous sign-in request was cancelled. Redirecting to the Google sign-in page…',
  'Browser ini tidak mendukung popup login. Mengalihkan ke halaman login Google…':
    'This browser does not support login popups. Redirecting to the Google sign-in page…',
  'Domain ini belum diizinkan untuk login Google. Hubungi admin DisasterWatch.':
    'This domain is not yet allowed for Google sign-in. Contact the DisasterWatch admin.',
  'Login Google belum diaktifkan untuk aplikasi ini. Hubungi admin DisasterWatch.':
    'Google sign-in is not enabled for this app yet. Contact the DisasterWatch admin.',
  'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.':
    'Connection problem. Check your internet and try again.',
  'Terjadi gangguan pada layanan login. Silakan coba lagi beberapa saat lagi.':
    'There was a problem with the login service. Please try again in a moment.',
  'Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.':
    'Too many sign-in attempts. Wait a moment and try again.',
  'Akun ini dinonaktifkan. Hubungi admin DisasterWatch.':
    'This account is disabled. Contact the DisasterWatch admin.',
  'Browser memblokir penyimpanan data. Aktifkan cookie/penyimpanan situs lalu coba lagi.':
    'The browser is blocking data storage. Enable cookies/site storage and try again.',
  'Email ini sudah terdaftar dengan metode login lain.':
    'This email is already registered with another sign-in method.',

  // ----- AIHelpdeskPanel -----
  'Apa kabar terbaru tentang {title} di {name}? Ceritakan perubahan kondisi, dampak, atau penanganan yang Anda ketahui.':
    'What is the latest on {title} in {name}? Describe any changes in conditions, impact, or response that you know of.',
  'Belum ada data posko bantuan untuk lokasi tersebut di aplikasi. Coba sebutkan kota/kabupaten lain atau perjelas nama lokasinya.':
    'There is no aid post data for that location in the app yet. Try mentioning another city/regency or clarifying the location name.',
  'Berikut posko bantuan yang tercatat untuk {cities}:\n\n{list}\n\nData dapat berubah. Kota/kabupaten mana lagi yang ingin Anda cari?':
    'Here are the aid posts recorded for {cities}:\n\n{list}\n\nData may change. Which other city/regency would you like to search?',
  'Kapasitas:': 'Capacity:',
  '{used} / {total} orang': '{used} / {total} people',
  'Belum ada data': 'No data yet',
  'Bantuan:': 'Aid:',
  'Peta:': 'Map:',
  'Halo, saya DisasterAI. Anda sedang melihat {title} di {name}, {province}. Saya bisa membantu melaporkan bencana, melaporkan kebutuhan, atau mempelajari bencana. Konfirmasi lokasi dan jenis bencana saat membuat laporan agar informasi Anda tepat.':
    'Hi, I am DisasterAI. You are viewing {title} in {name}, {province}. I can help report a disaster, report needs, or learn about disasters. Confirm the location and disaster type when making a report so your information is accurate.',
  'Halo, saya DisasterAI. Bencana apa dan di mana yang ingin Anda laporkan atau pelajari? Pilih layanan di bawah untuk memulai, lalu kita bahas bersama.':
    'Hi, I am DisasterAI. Which disaster and where would you like to report or learn about? Choose a service below to start, then we can discuss it together.',
  'Di kota/kabupaten mana Anda ingin mencari posko bantuan?':
    'Which city/regency would you like to find an aid post in?',
  'Apa yang ingin Anda pelajari tentang {title} di {name}?':
    'What would you like to learn about {title} in {name}?',
  'Bencana apa dan di mana yang ingin Anda pelajari?':
    'Which disaster and where would you like to learn about?',
  'Saya ingin melaporkan update bencana {title} di {name}':
    'I want to report an update on the {title} disaster in {name}',
  'Saya ingin melaporkan bencana': 'I want to report a disaster',
  'Saya ingin melaporkan kebutuhan bantuan untuk bencana terkait':
    'I want to report aid needs for the related disaster',
  'Bantu saya mencari Posko Bantuan terdekat': 'Help me find the nearest aid post',
  'Saya ingin mempelajari bencana lebih lanjut': 'I want to learn more about disasters',
  'Mari pelajari {title} di {name}. Anda ingin tahu tentang penyebab, risiko, atau cara melindungi diri?':
    "Let's learn about {title} in {name}. Would you like to know about the causes, risks, or how to protect yourself?",
  'Di mana bencana terjadi? Sebutkan kota/kabupaten dan lokasi yang lebih spesifik, seperti desa atau alamat.':
    'Where did the disaster occur? State the city/regency and a more specific location, such as a village or address.',
  'Jenis bencana apa yang ingin Anda laporkan?': 'What type of disaster would you like to report?',
  'Kapan bencana terjadi? Sebutkan tanggal dan perkiraan waktunya.':
    'When did the disaster occur? State the date and approximate time.',
  'Ceritakan kondisi di lokasi dan dampak yang Anda lihat, termasuk warga yang terdampak.':
    'Describe the conditions at the location and the impact you see, including affected residents.',
  'Seberapa mendesak kondisinya? Apakah ada warga yang masih membutuhkan pertolongan segera?':
    'How urgent is the situation? Are there residents still in need of immediate help?',
  'Bantuan apa yang dibutuhkan? Sebutkan jenis, jumlah, dan satuannya jika diketahui.':
    'What aid is needed? State the type, quantity, and unit if known.',
  'Di mana bantuan dibutuhkan? Sebutkan kota/kabupaten serta nama posko, desa, atau alamat.':
    'Where is the aid needed? State the city/regency as well as the post, village, or address name.',
  'Kebutuhan ini terkait bencana apa?': 'Which disaster is this need related to?',
  'Berapa orang atau keluarga yang membutuhkan bantuan tersebut?':
    'How many people or families need that aid?',
  'Bagaimana akses menuju lokasi dan siapa kontak yang bisa dihubungi untuk penyaluran bantuan?':
    'How is the access to the location and who can be contacted for aid distribution?',
  'Kebutuhan mana yang paling mendesak dan kapan bantuan diperlukan?':
    'Which need is the most urgent and when is the aid required?',
  'Apakah anda memiliki foto atau dokumen pendukung. Dokumen ini akan memberikan validasi lebih pada laporan anda dan menambah akurasi kami dalam merekam data':
    'Do you have a supporting photo or document? This document will provide more validation for your report and improve our accuracy in recording data',
  'Silakan lampirkan foto atau dokumen melalui ikon klip, atau pilih “Tanpa Dokumen”.':
    'Please attach a photo or document via the clip icon, or choose “No Document”.',
  'Kota/kabupaten mana di {region}? Anda juga bisa mengetik desa atau alamat yang lebih spesifik.':
    'Which city/regency in {region}? You can also type a more specific village or address.',
  'Silakan pilih “Kirim Laporan” jika sudah benar, atau “Perbaiki Laporan” untuk mengulang informasi.':
    'Please choose “Send Report” if it is correct, or “Fix Report” to redo the information.',
  'Waktu yang tercatat untuk insiden ini: {time}.': 'The time recorded for this incident: {time}.',
  'Estimasi kerugian/dampak yang tercatat: {cost}. Dampak: {impact}.':
    'Recorded estimate of losses/impact: {cost}. Impact: {impact}.',
  'Berikut laporan terakhir yang tersedia di aplikasi:\n{reports}\nInformasi ini berasal dari data aplikasi, bukan pembaruan berita langsung.':
    'Here are the latest reports available in the app:\n{reports}\nThis information comes from app data, not direct news updates.',
  'Belum ada laporan terbaru.': 'No recent reports yet.',
  '{cause}\n\nRisiko yang perlu diperhatikan: {hazards}':
    '{cause}\n\nRisks to note: {hazards}',
  'Untuk {title} di {name}:\n\n{answer}\n\nBagian mana yang ingin Anda bahas lebih lanjut: risiko, perlindungan diri, atau evakuasi?':
    'For {title} in {name}:\n\n{answer}\n\nWhich part would you like to discuss further: risks, self-protection, or evacuation?',
  'Bencana apa yang ingin Anda pelajari, misalnya banjir, gempa, atau kebakaran? Sebutkan juga kota/kabupatennya agar saya dapat memilih konteks yang sesuai.':
    'Which disaster would you like to learn about, for example flood, earthquake, or fire? Also mention the city/regency so I can choose the matching context.',
  'Jawaban belum tersedia. Silakan coba lagi.': 'No answer available yet. Please try again.',
  'Lampiran: {name}': 'Attachment: {name}',
  'File Anda sudah ditambahkan. Apa yang ingin Anda laporkan atau pelajari dari dokumen ini?':
    'Your file has been added. What would you like to report or learn from this document?',
  'Laporkan Bencana': 'Report a Disaster',
  'Laporkan Bantuan': 'Report Aid',
  'Cari Posko Bantuan': 'Find an Aid Post',
  'Pelajari Bencana': 'Learn About Disasters',
  'Laporkan Update Bencana': 'Report a Disaster Update',
  'Air bersih': 'Clean water',
  'Makanan / sembako': 'Food / groceries',
  'Obat-obatan': 'Medicines',
  'Tempat tinggal sementara': 'Temporary shelter',
  'Kapan bencana terjadi?': 'When did the disaster happen?',
  'Berapa kerugian bencana?': 'How much were the losses?',
  'Berikan kabar terbaru': 'Give the latest update',
  'Berikut rangkuman {kind} Anda:\n\n{summary}\nDokumen pendukung: {document}\n\nApakah informasi ini sudah benar? Klik “Kirim Laporan”, atau “Perbaiki Laporan” untuk mengulang.':
    'Here is a summary of your {kind}:\n\n{summary}\nSupporting document: {document}\n\nIs this information correct? Click “Send Report”, or “Fix Report” to redo.',
  kebutuhan: 'needs',
  'laporan bencana': 'disaster report',
  Lokasi: 'Location',
  'Jenis bencana': 'Disaster type',
  Waktu: 'Time',
  'Kondisi dan dampak': 'Condition and impact',
  Urgensi: 'Urgency',
  Kebutuhan: 'Needs',
  'Penerima bantuan': 'Aid recipients',
  'Akses dan kontak': 'Access and contact',
  'Tidak ada': 'None',
  'Saya melampirkan {name}.': 'I am attaching {name}.',
  'Tidak ada dokumen pendukung.': 'No supporting document.',
  'Kirim laporan.': 'Send report.',
  'Layanan unggah dokumen belum tersedia.': 'Document upload service is not available yet.',
  '{status} Terima kasih sudah melaporkan. {attachment}\n\nApakah ada hal lain yang ingin Anda laporkan atau pelajari?':
    '{status} Thank you for reporting. {attachment}\n\nIs there anything else you would like to report or learn about?',
  'Laporan tersimpan dalam sesi demo lokal.':
    'The report was saved in the local demo session.',
  'Laporan berhasil disimpan untuk ditinjau.':
    'The report was saved successfully for review.',
  'Dokumen pendukung tersedia dalam sesi lokal ini.':
    'The supporting document is available in this local session.',
  'Dokumen pendukung telah dilampirkan.': 'The supporting document has been attached.',
  'Laporan belum berhasil dikirim. Informasi Anda masih ada di sini. Silakan coba “Kirim Laporan” lagi.':
    'The report was not sent successfully. Your information is still here. Please try “Send Report” again.',
  'Asisten informasi dan laporan bencana': 'Disaster information and reporting assistant',
  'Kecilkan obrolan': 'Shrink chat',
  'Perluas obrolan ke layar penuh': 'Expand chat to full screen',
  'Tutup DisasterAI Helpdesk': 'Close DisasterAI Helpdesk',
  'Gunakan {name}': 'Use {name}',
  'Lampirkan Foto / Dokumen': 'Attach Photo / Document',
  'Tanpa Dokumen': 'No Document',
  'Kirim Laporan': 'Send Report',
  'Perbaiki Laporan': 'Fix Report',
  'DisasterAI sedang memproses…': 'DisasterAI is processing…',
  'Ukuran dokumen maksimal 5 MB. Pilih file yang lebih kecil.':
    'Maximum document size is 5 MB. Choose a smaller file.',
  'Gunakan foto JPG, PNG, WebP, atau dokumen PDF.':
    'Use a JPG, PNG, WebP photo, or a PDF document.',
  'Lampirkan foto atau dokumen': 'Attach a photo or document',
  'Pesan untuk DisasterAI': 'Message for DisasterAI',
  'Tulis jawaban atau pertanyaan Anda…': 'Write your answer or question…',
  'Kirim pesan': 'Send message',
  'Berbasis data DisasterWatch · data demo/prototipe':
    'Based on DisasterWatch data · demo/prototype data',

  // ----- CitizenReportsView -----
  '[LAPORAN WARGA TERVERIFIKASI - {name}]\nLokasi: {location}\nJudul: {title}\nInfo: {desc}\nStatus: {tag} ({time})':
    '[VERIFIED CITIZEN REPORT - {name}]\nLocation: {location}\nTitle: {title}\nInfo: {desc}\nStatus: {tag} ({time})',
  'Laporan Warga Terverifikasi': 'Verified Citizen Reports',
  '{name} • Divalidasi Posko TRC & BPBD': '{name} • Validated by Posko TRC & BPBD',
  '{count} Laporan Aktif': '{count} Active Reports',
  'Tutup & Kembali ke Peta': 'Close & Return to Map',
  'Tutup Halaman Laporan Warga': 'Close Citizen Reports Page',
  'Kirim Laporan Kejadian Lapangan Baru': 'Submit a New Field Incident Report',
  'Semua ({count})': 'All ({count})',
  'Validasi TRC': 'TRC Validation',
  Logistik: 'Logistics',
  'Jalur & Akses': 'Routes & Access',
  'Tidak ada laporan pada kategori ini.': 'No reports in this category.',
  'Bagikan / Salin Laporan': 'Share / Copy Report',
  'Tersalin!': 'Copied!',
  Bagikan: 'Share',
  'Detail Bencana': 'Disaster Details',
  'Rute Distribusi': 'Distribution Route',

  // ----- EvacuationPostView -----
  'Pencarian fasum belum berhasil. Periksa Places API (New), izin API key, dan koneksi.':
    'The facility search was not successful. Check the Places API (New), API key permissions, and connection.',
  Posko: 'Aid Post',
  'Usulan fasum': 'Proposed facilities',
  'Tutup Posko Bantuan': 'Close Aid Post',
  'Usulan lokasi posko': 'Proposed aid post locations',
  'Fasum terdekat dari koordinat laporan. Belum ditetapkan sebagai posko aktif; kapasitas dan keamanan perlu pemeriksaan BPBD.':
    'The nearest public facilities to the report coordinates. Not yet designated as active posts; capacity and safety require BPBD inspection.',
  '{mode} · radius {radius} km · jarak garis lurus.':
    '{mode} · radius {radius} km · straight-line distance.',
  'Urutan dibantu Gemini': 'Order assisted by Gemini',
  'Urutan berdasarkan jarak; Gemini belum tersedia': 'Order by distance; Gemini not available yet',
  'Mencari fasum terdekat dan meminta pertimbangan Gemini…':
    'Searching for the nearest facilities and asking Gemini for input…',
  'Coba lagi': 'Try again',
  'Belum ditemukan fasum yang sesuai dalam radius 15 km. Periksa koordinat laporan atau cari lokasi melalui BPBD setempat.':
    'No suitable facilities found within a 15 km radius. Check the report coordinates or find a location via the local BPBD.',
  'Lokasi belum tersedia': 'Location not available yet',
  'Buka {name} di Google Maps': 'Open {name} in Google Maps',
  'Usulan · {type}': 'Suggestion · {type}',
  '{km} km dari lokasi acuan': '{km} km from the reference location',
  'Sumber: Google Maps': 'Source: Google Maps',
  Kapasitas: 'Capacity',
  '{pct}% terisi': '{pct}% filled',
  Bantuan: 'Aid',
  'Data bantuan belum tersedia': 'Aid data not available yet',
  'Usulan fasum dipilih di peta': 'Proposed facility selected on the map',
  'Posko dipilih di peta': 'Aid post selected on the map',
  'Belum Ada Data': 'No Data Yet',
  Penuh: 'Full',
  'Hampir Penuh': 'Almost Full',
  Padat: 'Crowded',
  Tersedia: 'Available',

  // ----- NttCaseView -----
  'Tanggal belum tersedia': 'Date not available yet',
  'Terbit:': 'Published:',
  'tidak tersedia': 'not available',
  'Diambil:': 'Retrieved:',
  'Topik:': 'Topics:',
  'Jawaban belum tersedia. Data kasus di atas tetap dapat diakses.':
    'No answer available yet. The case data above remains accessible.',
  'Kasus Gempa NTT': 'NTT Earthquake Case',
  'Kasus nyata · bukan demo': 'Real case · not a demo',
  'Sumba Barat Daya, NTT — M6,1 (update M5,9)': 'Sumba Barat Daya, NTT — M6.1 (updated M5.9)',
  '4 Okt 2026 · 05:55:52 WIB · Tidak berpotensi tsunami (BMKG)':
    'Oct 4, 2026 · 05:55:52 WIB · No tsunami potential (BMKG)',
  'Tutup kasus NTT': 'Close NTT case',
  'Revisi dipertahankan terpisah: awal M6,1/10 km vs update M5,9/30 km · Update data: {time}':
    'Revisions kept separate: initial M6.1/10 km vs updated M5.9/30 km · Data update: {time}',
  'Ringkasan intelijen': 'Intelligence summary',
  'Parameter awal': 'Initial parameters',
  'Parameter update': 'Updated parameters',
  Artikel: 'Articles',
  '{n} ({official} resmi)': '{n} ({official} official)',
  'Klaim / konflik': 'Claims / conflicts',
  '{claims} / {conflicting} konflik': '{claims} / {conflicting} conflicts',
  'Menunggu verifikasi': 'Awaiting verification',
  'Crawl terakhir': 'Last crawl',
  'Korban meninggal': 'Deaths',
  'Pengungsi resmi': 'Official displaced',
  'Korban luka: 1 ringan (BNPB). Kerusakan: klaim konflik 20 vs 26 vs 56+13 — lihat panel klaim, jangan dijumlah.':
    'Injured: 1 minor (BNPB). Damage: conflicting claims 20 vs 26 vs 56+13 — see the claims panel, do not sum.',
  'Konteks peta': 'Map context',
  'Episenter resmi (update): 9,84 LS, 118,90 BT — marker insiden NTT tampil di peta utama bersama marker gempa BMKG. Klik marker untuk sumber + provenance. Tidak ada poligon dampak buatan.':
    'Official epicenter (update): 9.84 S, 118.90 E — the NTT incident marker appears on the main map alongside BMKG earthquake markers. Click the marker for source + provenance. There is no artificial impact polygon.',
  'Feed berita ({shown}/{total})': 'News feed ({shown}/{total})',
  'Menyegarkan…': 'Refreshing…',
  Refresh: 'Refresh',
  Semua: 'All',
  Resmi: 'Official',
  Media: 'Media',
  'Filter verifikasi': 'Verification filter',
  'Semua status': 'All statuses',
  'Filter topik': 'Topic filter',
  'Semua topik': 'All topics',
  'Tidak ada artikel untuk filter ini.': 'No articles for this filter.',
  'Timeline insiden': 'Incident timeline',
  'Waktu publikasi tidak tersedia': 'Publication time not available',
  'Buka sumber': 'Open source',
  'Klaim & verifikasi': 'Claims & verification',
  'Ekstraksi AI bukan verifikasi. Angka konflik dipertahankan per sumber — jangan dijumlah.':
    'AI extraction is not verification. Conflicting figures are kept per source — do not sum.',
  'Kerusakan (konflik)': 'Damage (conflicting)',
  Korban: 'Casualties',
  Sumber: 'Source',
  'Korban meninggal: Belum tersedia (bukan nol). Pengungsi resmi: Belum tersedia.':
    'Deaths: Not available yet (not zero). Official displaced: Not available yet.',
  'Semua klaim ({count})': 'All claims ({count})',
  'Tanya kasus NTT (grounded)': 'Ask the NTT case (grounded)',
  'Pertanyaan kasus NTT': 'NTT case question',
  'Cth: "Apakah ada laporan kerusakan?"': 'e.g. "Is there any damage report?"',
  Tanya: 'Ask',
  'Jawaban mengutip link sumber aktual; yang tidak ada disebut "Belum tersedia".':
    'Answers cite actual source links; anything missing is labeled "Not available yet".',
};

export default modals;
