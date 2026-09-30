import { DisasterIncident } from '../types';

export const disastersData: Record<string, DisasterIncident> = {
  padang: {
    id: 'padang',
    category: 'flood',
    name: 'Padang & Pesisir Selatan',
    province: 'Sumatera Barat',
    fullName: 'Banjir Bandang & Longsor',
    fullTitleDisplay: 'Banjir Bandang & Luapan Sungai',
    urgency: 'Darurat Tinggi',
    urgencyClass: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-500/30',
    impact: 'Area: 1.250 KK Terdampak',
    cost: 'Rp 3,8 Miliar',
    gapRecovery: '54% Terpenuhi',
    recoveryPct: 54,
    coords: { top: '48%', left: '16.5%', lat: -0.9471, lng: 100.4172 },
    timestamp: 'Terjadi sejak 3 hari lalu • 08:30 WIB',
    photoUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1WN9imTMvwDcpBErPeGdYeg_x1tCS7dEeLc_I-OICFWUDMhXaw8X0v2DrnRTFYapFZZyc_xmzu5Z7JN8Zdyqa0mTDNwLyWeeUWxTvxeVVojnWrkbcX1tSiRYl8Jdv9Z_IxVhGECNrIuZEqAoIvCGrNegNX85zgJzzxxcAc1ixXubC9XeDvDyvm59uWx-JYWbYhrDhTG6kmwaCCzA6JkqbNXGrh_9Gy3K_yPoIO_r-TxZlsezSBeBlSEtd7N',
    photoAlt: 'Situasi Tanggap Darurat Bencana Padang & Pesisir Selatan',
    photoSource: 'Pusdalops BPBD Sumbar / Tim Reaksi Cepat',
    stats: {
      hotspots: '3 Aliran Meluap',
      hotspotsChange: '+18%',
      loss: 'Rp 3,8 M',
      lossChange: '+12%',
      personnel: '142 Tim',
      personnelChange: '+15%'
    },
    guide: {
      title: 'Mitigasi Banjir Bandang & Galodo Batang Kuranji',
      cause: 'Intensitas hujan ekstrem di lereng hulu Pegunungan Bukit Barisan memicu runtuhnya bendung alami sedimen dan luapan debit sungai.',
      hazards: 'Arus deras lumpur bercampur batu besar, gelondongan kayu hanyut, dan bahaya aliran arus berkecepatan tinggi.',
      safeRadius: 'Tinggalkan bantaran sungai minimal radius 250 meter menuju titik elevasi perbukitan aman.',
      protocols: [
        'Segera matikan sumber listrik utama dan gas elpiji di rumah.',
        'Simpan dokumen berharga, surat tanah, dan identitas ke kantong plastik kedap air.',
        'Hindari menyeberangi genangan arus deras di atas mata kaki tanpa tali pengaman.',
        'Waspadai ancaman hewan berbisa dan kuman leptospirosis pada air genangan.'
      ],
      evacRoute: 'Jalur Evakuasi Terbuka: Naik melalui Jl. Bypass Kuranji menuju Shelter Evakuasi Kampus Unand & Balai Desa.'
    },
    supplies: [
      { code: 'Bt 1', name: 'Masker N95', subtitle: 'Kesehatan Napas', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 2', name: 'Tangki Air', subtitle: 'Air Minum Bersih', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'droplet' },
      { code: 'Bt 3', name: 'Obat ISPA', subtitle: 'Medis Lapangan', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'pill' },
      { code: 'Bt 4', name: 'Sembako', subtitle: 'Pangan Darurat', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'package' }
    ],
    route: {
      distance: '38 km',
      duration: '± 55 Menit',
      convoy: 'Konvoi 3 Armada',
      statusBadge: 'Rute Aman',
      checkpoints: [
        {
          id: 1,
          title: 'Titik Awal: Posko Utama Komando',
          subtitle: 'Gudang Logistik & Medis BPBD. Muatan: 500 Masker N95 & 2 Tangki Air Bersih.',
          tag: 'Siap Berangkat',
          tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          badgeColor: 'bg-slate-900 text-white',
          lat: -0.9515,
          lng: 100.3543
        },
        {
          id: 2,
          title: 'Checkpoint 1: Jalur Poros Utama',
          subtitle: 'Kondisi jalan teraspal mulus, visibilitas > 500m. Dikawal 1 Unit Patroli Sabhara.',
          tag: 'Jalan Aman',
          tagClass: 'bg-blue-50 text-blue-700 border-blue-200',
          badgeColor: 'bg-blue-600 text-white',
          lat: -1.0924,
          lng: 100.4682
        },
        {
          id: 3,
          title: 'Checkpoint 2: Pos Aju Logistik',
          subtitle: 'Distribusi 200 masker N95 & suplai 1 tangki air bersih untuk warga pengungsi aula desa.',
          tag: 'Drop Logistik 1',
          tagClass: 'bg-amber-50 text-amber-800 border-amber-200',
          badgeColor: 'bg-amber-500 text-white',
          lat: -1.2421,
          lng: 100.4851
        },
        {
          id: 4,
          title: 'Titik Akhir: Desa Terdampak Utama',
          subtitle: 'Area terdampak kabut asap terparah. Pos Relawan Lapangan & Tenda Medis ISPA.',
          tag: 'Zona Kritis',
          tagClass: 'bg-rose-50 text-rose-700 border-rose-200',
          badgeColor: 'bg-rose-500 text-white',
          lat: -1.3512,
          lng: 100.5750
        }
      ]
    },
    reports: [
      {
        id: 'rep-1',
        location: 'Desa Karang Intan, Martapura',
        title: 'Asap Pekat Mengarah ke Pemukiman',
        desc: 'Asap pekat dari lahan gambut mulai masuk pekarangan warga, jarak pandang tinggal ±200 meter. Warga butuh masker respirator tambahan.',
        time: '12m lalu',
        author: 'Oleh: Bpk. Ridwan (Ketua RT 03)',
        tag: 'Terverifikasi Posko TRC',
        tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      {
        id: 'rep-2',
        location: 'SMPN 2 Martapura (Pos Pengungsi)',
        title: 'Suplai Masker N95 Diterima',
        desc: 'Distribusi 500 masker N95 dan 1 unit tangki air bersih telah diterima langsung oleh koordinator posko evakuasi.',
        time: '28m lalu',
        author: 'Oleh: Tim Relawan PMI',
        tag: 'Logistik Disalurkan',
        tagClass: 'bg-blue-50 text-blue-700 border-blue-200'
      },
      {
        id: 'rep-3',
        location: 'Jl. Poros Sungai Ulin',
        title: 'Peringatan Visibilitas Jalan Terbatas',
        desc: 'Akses jalur alternatif tertutup kabut asap tebal. Pengendara diimbau menyalakan lampu kabut dan mengurangi kecepatan.',
        time: '45m lalu',
        author: 'Oleh: Patroli Polsek Setempat',
        tag: 'Peringatan Akses Jalan',
        tagClass: 'bg-orange-50 text-orange-700 border-orange-200'
      },
      {
        id: 'rep-4',
        location: 'Desa Sungai Batang',
        title: 'Tambahan Mobil Tangki Air Sangat Mendesak',
        desc: 'Kebutuhan mendesak tangki air bersih cadangan untuk konsumsi warga lansia dan pemadaman titik bara tanah gambut.',
        time: '1j lalu',
        author: 'Oleh: Tagana Relawan',
        tag: 'Bantuan Darurat',
        tagClass: 'bg-amber-50 text-amber-700 border-amber-200'
      }
    ]
  },

  banjar: {
    id: 'banjar',
    category: 'fire',
    name: 'Kec. Martapura, Kab. Banjar',
    province: 'Kalimantan Selatan',
    fullName: 'Kebakaran Hutan & Lahan',
    fullTitleDisplay: 'Kebakaran Hutan & Lahan (Karhutla)',
    urgency: 'Darurat Tinggi',
    urgencyClass: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-500/30',
    impact: 'Area: ± 420 Ha Lahan',
    cost: 'Rp 1,4 Miliar',
    gapRecovery: '68% Terpenuhi',
    recoveryPct: 68,
    coords: { top: '52%', left: '45%', lat: -3.4116, lng: 114.8541 },
    timestamp: 'Terjadi sejak 2 hari lalu • 14:20 WIB',
    photoUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1VrRHTuWDVNlImivINWwIr8efCJAxteDYMLElnKu3G2ekqcS6dRI0DBIjh_Y__GhH0ty8xSsFRfY4624s9AND_KlK_MapyVlpjRuVQnrkGKrhUvPoPq2VncTDeMvbVBZhd9_6Mms1rGu23YFozYBw1TZEkXtq7T5sOzNe64Ph0rlXKV5-QSJLXnT4P7xzwVQZxZWry1ESI7mUveXWfD9eW5YDx44lKxuYh0E_GHQa4bDPjy1UEKmgBJCU_-',
    photoAlt: 'Foto Lapangan Karhutla Martapura',
    photoSource: 'Drone Pantau TRC BPBD Kalsel',
    stats: {
      hotspots: '42 Titik',
      hotspotsChange: '+14%',
      loss: 'Rp 820 Jt',
      lossChange: '-5%',
      personnel: '128 Tim',
      personnelChange: '+12%'
    },
    guide: {
      title: 'Mitigasi Karhutla & Kabut Asap Martapura',
      cause: 'Kemarau panjang memicu kekeringan biomassa gambut dan gesekan alang-alang kering di sekitar perkebunan kelapa sawit.',
      hazards: 'Bahaya partikel PM2.5 tinggi memicu ISPA parah, iritasi kornea mata, serta penurunan jarak pandang ekstrim (< 300m).',
      safeRadius: 'Zona Merah: < 1.5 km dari bibir api. Radius aman pemukiman minimal 3 km arah melawan angin (upwind).',
      protocols: [
        'Wajib menggunakan Masker Standar N95 / Respirator Karbon aktif.',
        'Tutup ventilasi rumah dengan kain lembab untuk menahan infiltrasi abu vulkanik/arang.',
        'Siapkan tetes mata steril dan tabung oksigen portabel untuk kelompok lansia/anak.',
        'Segera laporkan titik bara tanah gambut tersembunyi ke posko pemadam Manggala Agni.'
      ],
      evacRoute: 'Jalur Evakuasi Terbuka: Lewat Jl. Ahmad Yani Km 36 menuju Pos Transit GOR Indrasari Martapura.'
    },
    supplies: [
      { code: 'Bt 1', name: 'Masker N95', subtitle: 'Kesehatan Napas', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 2', name: 'Tangki Air', subtitle: 'Air Minum Bersih', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'droplet' },
      { code: 'Bt 3', name: 'Obat ISPA', subtitle: 'Medis Lapangan', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'pill' },
      { code: 'Bt 4', name: 'Sembako', subtitle: 'Pangan Darurat', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'package' }
    ],
    route: {
      distance: '38 km',
      duration: '± 55 Menit',
      convoy: 'Konvoi 3 Armada',
      statusBadge: 'Rute Aman',
      checkpoints: [
        {
          id: 1,
          title: 'Titik Awal: Posko Utama Komando Martapura',
          subtitle: 'Gudang Logistik & Medis BPBD Banjar. Muatan: 500 Masker N95 & 2 Tangki Air Bersih.',
          tag: 'Siap Berangkat',
          tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          badgeColor: 'bg-slate-900 text-white'
        },
        {
          id: 2,
          title: 'Checkpoint 1: Jalur Poros Jl. Veteran',
          subtitle: 'Kondisi jalan teraspal mulus, visibilitas terpantau > 500m. Dikawal 1 Unit Patroli Sabhara.',
          tag: 'Jalan Aman',
          tagClass: 'bg-blue-50 text-blue-700 border-blue-200',
          badgeColor: 'bg-blue-600 text-white'
        },
        {
          id: 3,
          title: 'Checkpoint 2: Pos Aju Desa Karang Intan',
          subtitle: 'Distribusi 200 masker N95 & suplai 1 tangki air bersih untuk warga pengungsi aula desa.',
          tag: 'Drop Logistik 1',
          tagClass: 'bg-amber-50 text-amber-800 border-amber-200',
          badgeColor: 'bg-amber-500 text-white'
        },
        {
          id: 4,
          title: 'Titik Akhir: Desa Sungai Batang',
          subtitle: 'Area terdampak kabut asap terparah. Pos Relawan Lapangan Kompas Borneo & Tenda Medis ISPA.',
          tag: 'Zona Kritis',
          tagClass: 'bg-rose-50 text-rose-700 border-rose-200',
          badgeColor: 'bg-rose-500 text-white'
        }
      ]
    },
    reports: [
      {
        id: 'rep-b1',
        location: 'Desa Karang Intan, Martapura',
        title: 'Asap Pekat Mengarah ke Pemukiman',
        desc: 'Asap pekat dari lahan gambut mulai masuk pekarangan warga, jarak pandang tinggal ±200 meter. Warga butuh masker respirator tambahan.',
        time: '12m lalu',
        author: 'Oleh: Bpk. Ridwan (Ketua RT 03)',
        tag: 'Terverifikasi Posko TRC',
        tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      {
        id: 'rep-b2',
        location: 'SMPN 2 Martapura (Pos Pengungsi)',
        title: 'Distribusi 500 Masker N95 Selesai',
        desc: 'Distribusi 500 masker N95 di Posko Pengungsian SMPN 2 Martapura telah disalurkan oleh BPBD Banjar.',
        time: '28m lalu',
        author: 'BPBD Kab. Banjar (Resmi)',
        tag: 'Logistik Disalurkan',
        tagClass: 'bg-blue-50 text-blue-700 border-blue-200'
      },
      {
        id: 'rep-b3',
        location: 'Desa Sungai Batang',
        title: 'Akses Poros Terhalang Asap',
        desc: 'Akses jalan poros Desa Sungai Batang terhalang kepulan asap tebal, visibilitas berkurang di bawah 50 meter.',
        time: '45m lalu',
        author: 'Relawan Kompas Borneo',
        tag: 'Visibilitas Terbatas',
        tagClass: 'bg-rose-50 text-rose-700 border-rose-200'
      }
    ]
  },

  pekanbaru: {
    id: 'pekanbaru',
    category: 'fire',
    name: 'Pekanbaru & Kampar',
    province: 'Riau',
    fullName: 'Kebakaran Lahan Gambut',
    fullTitleDisplay: 'Kebakaran Hutan & Lahan Gambut',
    urgency: 'Siaga Penuh',
    urgencyClass: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-500/30',
    impact: 'Area: ± 210 Ha Gambut',
    cost: 'Rp 820 Juta',
    gapRecovery: '72% Terpenuhi',
    recoveryPct: 72,
    coords: { top: '35%', left: '14%', lat: 0.5071, lng: 101.4478 },
    timestamp: 'Terjadi sejak kemarin • 10:15 WIB',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsSS4dJTqoIYbdQblGvKPPKAjmwhcnH5uPg_yy8CrBwVIrbN9opS5vdmxSyR-bidEt37F2cz0SsSO_FheTfjXzJO0AkStF7sKBp0DTlOA-HTSjrg00gBUhgH4v_q-BK6OT_KsHQtB7mCeu6alfrU7wS2HNrQStZEuRBdzeCjhBwADdFmaK57x5vYl4VmCXRlfJvqZy2wd4wbmdd7vj-8CPpzrl6WlenN5vx5Bgv5_q',
    photoAlt: 'Patroli Penanganan Karhutla Riau',
    photoSource: 'Manggala Agni Daerah Operasi Kampar',
    stats: {
      hotspots: '58 Titik',
      hotspotsChange: '+8%',
      loss: 'Rp 820 Jt',
      lossChange: '-2%',
      personnel: '94 Tim',
      personnelChange: '+5%'
    },
    guide: {
      title: 'Mitigasi Kebakaran Lahan Gambut Kampar - Riau',
      cause: 'Subsiden muka air tanah di kanal gambut memicu bara bawah permukaan (subsurface fire) yang sulit padam.',
      hazards: 'Emisi gas Karbon Monoksida (CO) pekat dan sulfur yang berbahaya jika terhirup saat malam hari.',
      safeRadius: 'Jarak steril minimal 2 km dari area sekat kanal terbakar.',
      protocols: [
        'Gunakan masker N95 ganda dan pelindung mata saat berada di luar ruangan.',
        'Nyalakan lampu kabut kendaraan bermotor di siang hari karena jarak pandang terbatas.',
        'Dukung tim relawan dengan suplai air mineral dan makanan siap saji tinggi kalori.'
      ],
      evacRoute: 'Arah Evakuasi: Pos Induk Aula Kantor Bupati Kampar & Gedung Olahraga Bangkinang.'
    },
    supplies: [
      { code: 'Bt 1', name: 'Pompa Portable', subtitle: 'Pemadam Ringan', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 2', name: 'Masker N95', subtitle: 'Perlindungan Asap', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 3', name: 'Tetes Mata', subtitle: 'Anti-Iritasi', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'pill' },
      { code: 'Bt 4', name: 'Peralatan Sekop', subtitle: 'Sekat Bakar', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'package' }
    ],
    route: {
      distance: '24 km',
      duration: '± 40 Menit',
      convoy: 'Konvoi 2 Truk BPBD',
      statusBadge: 'Rute Terbuka',
      checkpoints: [
        { id: 1, title: 'Titik Awal: Lanud Roesmin Nurjadin', subtitle: 'Pusat Heli Water Bombing', tag: 'Pemberangkatan', tagClass: 'bg-emerald-50 text-emerald-700', badgeColor: 'bg-slate-900 text-white' },
        { id: 2, title: 'Checkpoint 1: Sp. Rimbo Kampar', subtitle: 'Jalur Poros Bebas Asap', tag: 'Aman Dilalui', tagClass: 'bg-blue-50 text-blue-700', badgeColor: 'bg-blue-600 text-white' },
        { id: 3, title: 'Titik Akhir: Desa Rimbo Panjang', subtitle: 'Pos Pantau Manggala Agni', tag: 'Area Operasi', tagClass: 'bg-rose-50 text-rose-700', badgeColor: 'bg-rose-500 text-white' }
      ]
    },
    reports: [
      {
        id: 'rep-p1',
        location: 'Rimbo Panjang, Kampar',
        title: 'Operasi Pemadaman Kanal Berlanjut',
        desc: 'Tim darat gabungan mengerahkan 4 mesin pompa portabel menyiram titik asap dari bawah gambut.',
        time: '35m lalu',
        author: 'Manggala Agni Daops Siak',
        tag: 'Penanganan Aktif',
        tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }
    ]
  },

  cianjur: {
    id: 'cianjur',
    category: 'earthquake',
    name: 'Cianjur & Sukabumi',
    province: 'Jawa Barat',
    fullName: 'Gempa Bumi Tektonik',
    fullTitleDisplay: 'Gempa Tektonik M 5.2',
    urgency: 'Darurat Tinggi',
    urgencyClass: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-500/30',
    impact: 'Area: 310 Unit Fasilitas Rusak',
    cost: 'Rp 6,2 Miliar',
    gapRecovery: '42% Terpenuhi',
    recoveryPct: 42,
    coords: { top: '76%', left: '24.5%', lat: -6.8222, lng: 107.1394 },
    timestamp: 'Terjadi 4 jam lalu • 11:22 WIB',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBg_OnpzZ9B3N5k5ZmX3vO_hj7vzj8bk3nKHws-lHift4KDgWlVPOzgU0xtZl8TtAhSfn-twGxJVPza3VKn3_4IkD48kRsaTpELA9JCQtL22OiSUVQPe7aA44nITNdMT_AlXKSsOwXJtkhjc50R4oJh7e5dUpG6vUX2IT20bFhJS6A18yL3R0I8JnOc5-OPCb7NmKvPoB-HinGFh5DgA_EKxRH6zy_17bx6Gd565LSH2UessCPB6zKJKQ',
    photoAlt: 'Asesmen Kerusakan Bangunan Gempa Cianjur',
    photoSource: 'Pusdalops BPBD Kabupaten Cianjur',
    stats: {
      hotspots: '14 Titik Sesar',
      hotspotsChange: '+20%',
      loss: 'Rp 6,2 M',
      lossChange: '+25%',
      personnel: '310 Tim',
      personnelChange: '+30%'
    },
    guide: {
      title: 'Mitigasi Gempa Dangkal Sesar Cugenang',
      cause: 'Reaktivasi pergeseran sesar aktif kerak dangkal kedalaman 10 km.',
      hazards: 'Runtuhan dinding bata hebel, retakan lereng tanah berisiko longsor susulan, dan potensi gempa replika.',
      safeRadius: 'Area terbuka hijau berjarak minimal tinggi bangunan 1.5x dari gedung tinggi atau tiang listrik.',
      protocols: [
        'Terapkan "Drop, Cover, and Hold On" saat terjadi goyangan kuat.',
        'Hindari masuk kembali ke dalam rumah yang dindingnya telah mengalami retakan silang (diagonal).',
        'Pakai alas kaki tebal untuk mencegah luka dari pecahan kaca atau puing genteng.'
      ],
      evacRoute: 'Kumpul Lapangan: Lapangan Prawatasari & Alun-Alun Cianjur.'
    },
    supplies: [
      { code: 'Bt 1', name: 'Tenda Peleton', subtitle: 'Hunian Sementara', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 2', name: 'Genset Listrik', subtitle: 'Tenaga Darurat', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 3', name: 'Perban Medis', subtitle: 'Pertolongan Pertama', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'pill' },
      { code: 'Bt 4', name: 'Air Minum', subtitle: 'Konsumsi Pengungsi', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'package' }
    ],
    route: {
      distance: '18 km',
      duration: '± 35 Menit',
      convoy: 'Konvoi SAR & Medis',
      statusBadge: 'Jalur Steril',
      checkpoints: [
        { id: 1, title: 'RSUD Sayang Cianjur', subtitle: 'Posko Medis Rujukan', tag: 'Siaga 24 Jam', tagClass: 'bg-emerald-50 text-emerald-700', badgeColor: 'bg-slate-900 text-white' },
        { id: 2, title: 'Kec. Cugenang Sektor 1', subtitle: 'Pembersihan Puing PU-PR', tag: 'Akses Satu Arah', tagClass: 'bg-amber-50 text-amber-700', badgeColor: 'bg-amber-500 text-white' }
      ]
    },
    reports: [
      {
        id: 'rep-c1',
        location: 'Desa Gasol, Cugenang',
        title: 'Tenda Darurat Mulai Terpasang',
        desc: '6 tenda pengungsian keluarga telah didirikan tim Tagana di lapangan desa untuk 85 kepala keluarga.',
        time: '50m lalu',
        author: 'TRC BPBD Jawa Barat',
        tag: 'Evakuasi Selesai',
        tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }
    ]
  },

  demak: {
    id: 'demak',
    category: 'flood',
    name: 'Demak & Kudus',
    province: 'Jawa Tengah',
    fullName: 'Banjir Luapan Tanggul',
    fullTitleDisplay: 'Banjir Jebol Tanggul Sungai Wulan',
    urgency: 'Darurat Tinggi',
    urgencyClass: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-500/30',
    impact: 'Area: Genangan 1.8 Meter',
    cost: 'Rp 4,5 Miliar',
    gapRecovery: '61% Terpenuhi',
    recoveryPct: 61,
    coords: { top: '77.5%', left: '32%', lat: -6.8944, lng: 110.6385 },
    timestamp: 'Terjadi kemarin • 06:40 WIB',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBg_OnpzZ9B3N5k5ZmX3vO_hj7vzj8bk3nKHws-lHift4KDgWlVPOzgU0xtZl8TtAhSfn-twGxJVPza3VKn3_4IkD48kRsaTpELA9JCQtL22OiSUVQPe7aA44nITNdMT_AlXKSsOwXJtkhjc50R4oJh7e5dUpG6vUX2IT20bFhJS6A18yL3R0I8JnOc5-OPCb7NmKvPoB-HinGFh5DgA_EKxRH6zy_17bx6Gd565LSH2UessCPB6zKJKQ',
    photoAlt: 'Evakuasi Warga Terdampak Banjir Demak',
    photoSource: 'BBWS Pemali Juana & Basarnas Semarang',
    stats: {
      hotspots: '2 Tanggul Jebol',
      hotspotsChange: 'Stabil',
      loss: 'Rp 4,5 M',
      lossChange: '+5%',
      personnel: '180 Tim',
      personnelChange: '+18%'
    },
    guide: {
      title: 'Mitigasi Banjir Tanggul Sungai Wulan Karanganyar',
      cause: 'Debit kiriman air Waduk Kedungombo melampaui kapasitas tanggul tanah hingga jebol sepanjang 25 meter.',
      hazards: 'Genangan lambat surut hingga 2 minggu, air terkontaminasi septic tank & limbah pertanian.',
      safeRadius: 'Titik tanggul jalan pantura yang ditinggikan atau lantai 2 bangunan kokoh.',
      protocols: [
        'Segera evakuasi ibu hamil, anak, dan lansia dengan kano/perahu karet BPBD.',
        'Hanya konsumsi air kemasan bersegel atau air olahan penjernih mobil tangki PMI.',
        'Oleskan antiseptik pada kulit kaki untuk mencegah infeksi leptospirosis dan kutu air.'
      ],
      evacRoute: 'Posko Pengungsian: Jembatan Tanggulangin & Terminal Induk Kudus.'
    },
    supplies: [
      { code: 'Bt 1', name: 'Pompa Sedot', subtitle: 'Drainase Cepat', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 2', name: 'Kantong Pasir', subtitle: 'Tanggul Darurat', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 3', name: 'Perahu Karet', subtitle: 'Armada Evakuasi', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'pill' },
      { code: 'Bt 4', name: 'Makanan Siap Saji', subtitle: 'Dapur Umum', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'package' }
    ],
    route: {
      distance: '31 km',
      duration: '± 45 Menit',
      convoy: 'Truk Logistik Amfibi',
      statusBadge: 'Perahu Siaga',
      checkpoints: [
        { id: 1, title: 'Balai Desa Karanganyar', subtitle: 'Dapur Lapangan Tagana', tag: 'Pos Operasi', tagClass: 'bg-emerald-50 text-emerald-700', badgeColor: 'bg-slate-900 text-white' },
        { id: 2, title: 'Tanggul Sungai Wulan Km 3', subtitle: 'Pemasangan Tiang Pancang', tag: 'Zona Perbaikan', tagClass: 'bg-amber-50 text-amber-700', badgeColor: 'bg-amber-500 text-white' }
      ]
    },
    reports: [
      {
        id: 'rep-d1',
        location: 'Karanganyar, Demak',
        title: 'Penguatan Bronjong Kawat Berlangsung',
        desc: 'Alat berat ekskavator long arm BBWS telah menancapkan tiang pancang bambu dan 2.500 karung pasir.',
        time: '1j lalu',
        author: 'BBWS Pemali Juana',
        tag: 'Perbaikan Infrastruktur',
        tagClass: 'bg-blue-50 text-blue-700 border-blue-200'
      }
    ]
  },

  palu: {
    id: 'palu',
    category: 'earthquake',
    name: 'Palu & Donggala',
    province: 'Sulawesi Tengah',
    fullName: 'Gempa Sesar Tektonik',
    fullTitleDisplay: 'Gempa Dangkal M 4.8',
    urgency: 'Waspada Tinggi',
    urgencyClass: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-500/30',
    impact: 'Area: 45 Fasilitas Retak',
    cost: 'Rp 950 Juta',
    gapRecovery: '82% Terpenuhi',
    recoveryPct: 82,
    coords: { top: '44%', left: '56.5%', lat: -0.8917, lng: 119.8707 },
    timestamp: 'Terjadi 6 jam lalu • 09:30 WITA',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBg_OnpzZ9B3N5k5ZmX3vO_hj7vzj8bk3nKHws-lHift4KDgWlVPOzgU0xtZl8TtAhSfn-twGxJVPza3VKn3_4IkD48kRsaTpELA9JCQtL22OiSUVQPe7aA44nITNdMT_AlXKSsOwXJtkhjc50R4oJh7e5dUpG6vUX2IT20bFhJS6A18yL3R0I8JnOc5-OPCb7NmKvPoB-HinGFh5DgA_EKxRH6zy_17bx6Gd565LSH2UessCPB6zKJKQ',
    photoAlt: 'Pemantauan Aktivitas Sesar Palu Koro',
    photoSource: 'Stasiun Geofisika BMKG Palu',
    stats: {
      hotspots: '1 Sesar Aktif',
      hotspotsChange: 'Normal',
      loss: 'Rp 950 Jt',
      lossChange: '-8%',
      personnel: '65 Tim',
      personnelChange: '+4%'
    },
    guide: {
      title: 'Mitigasi Gempa Sesar Palu-Koro',
      cause: 'Aktivitas pergerakan mendatar strike-slip sesar aktif Palu-Koro.',
      hazards: 'Getaran mendadak, potensi likuifaksi pada area tanah pasir jenuh air.',
      safeRadius: 'Area perbukitan stabil dan lapangan bola terbuka.',
      protocols: [
        'Jauhi garis pantai jika gempa terasa kuat lebih dari 20 detik meski belum ada sirine tsunami.',
        'Pastikan jalur keluar rumah bebas dari barang rintangan yang mudah roboh.',
        'Pantau frekuensi radio VHF darurat BPBD Sulawesi Tengah di 145.000 MHz.'
      ],
      evacRoute: 'Titik Kumpul Evakuasi: Halaman TVRI Sulteng & Kompleks Kantor Gubernur.'
    },
    supplies: [
      { code: 'Bt 1', name: 'Tenda Terpal', subtitle: 'Perlindungan', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 2', name: 'Alat Masak', subtitle: 'Dapur Darurat', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'package' }
    ],
    route: {
      distance: '15 km',
      duration: '± 25 Menit',
      convoy: 'Unit Patroli Reaksi Cepat',
      statusBadge: 'Rute Bersih',
      checkpoints: [
        { id: 1, title: 'Jembatan Palu IV', subtitle: 'Pengecekan Struktur Retak', tag: 'Aman Dilalui', tagClass: 'bg-emerald-50 text-emerald-700', badgeColor: 'bg-slate-900 text-white' }
      ]
    },
    reports: [
      {
        id: 'rep-pl1',
        location: 'Kec. Palu Barat',
        title: 'Asesmen Fasilitas Publik Usai',
        desc: 'Struktur jembatan dan puskesmas telah dicek oleh dinas PU-PR dengan kesimpulan aman beroperasi terbatas.',
        time: '2j lalu',
        author: 'Dinas PU-PR Kota Palu',
        tag: 'Inspeksi Selesai',
        tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }
    ]
  },

  jayapura: {
    id: 'jayapura',
    category: 'flood',
    name: 'Sentani, Jayapura',
    province: 'Papua',
    fullName: 'Banjir Luapan Danau',
    fullTitleDisplay: 'Genangan Luapan Danau Sentani',
    urgency: 'Siaga Darurat',
    urgencyClass: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-500/30',
    impact: 'Area: 480 Rumah Rendam',
    cost: 'Rp 1,1 Miliar',
    gapRecovery: '76% Terpenuhi',
    recoveryPct: 76,
    coords: { top: '56%', left: '95%', lat: -2.5694, lng: 140.5167 },
    timestamp: 'Terjadi 2 hari lalu • 16:00 WIT',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBg_OnpzZ9B3N5k5ZmX3vO_hj7vzj8bk3nKHws-lHift4KDgWlVPOzgU0xtZl8TtAhSfn-twGxJVPza3VKn3_4IkD48kRsaTpELA9JCQtL22OiSUVQPe7aA44nITNdMT_AlXKSsOwXJtkhjc50R4oJh7e5dUpG6vUX2IT20bFhJS6A18yL3R0I8JnOc5-OPCb7NmKvPoB-HinGFh5DgA_EKxRH6zy_17bx6Gd565LSH2UessCPB6zKJKQ',
    photoAlt: 'Pemantauan Udara Luapan Danau Sentani',
    photoSource: 'Satgas Kodam XVII Cenderawasih & BPBD Papua',
    stats: {
      hotspots: '4 Distrik Rendam',
      hotspotsChange: '-4%',
      loss: 'Rp 1,1 M',
      lossChange: 'Tetap',
      personnel: '78 Tim',
      personnelChange: '+10%'
    },
    guide: {
      title: 'Mitigasi Luapan Air Danau Sentani & Cycloop',
      cause: 'Hujan deras di lereng Cagar Alam Pegunungan Cycloop menyebabkan sedimentasi dan kenaikan muka danau.',
      hazards: 'Genangan isolir antar kampung terapung, potensi wabah malaria & diare.',
      safeRadius: 'Tinggalkan dermaga kayu, berkumpul di dermaga utama daratan tinggi Sentani Kota.',
      protocols: [
        'Pasang kelambu berinsektisida untuk mencegah gigitan nyamuk Anopheles pasca banjir.',
        'Gunakan pelampung atau life jacket saat menaiki perahu motor evakuasi.',
        'Simpan cadangan air minum masak di wadah tertutup higienis.'
      ],
      evacRoute: 'Pos Terpadu: Stadion Lukas Enembe & Balai Desa Hawai Sentani.'
    },
    supplies: [
      { code: 'Bt 1', name: 'Kano Evakuasi', subtitle: 'Akses Rawa', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 2', name: 'Kelambu Anti Malaria', subtitle: 'Vektor Nyamuk', status: 'Dibutuhkan', urgency: 'Urgensi Tinggi', icon: 'shield' },
      { code: 'Bt 3', name: 'Makanan Kaleng', subtitle: 'Pangan Siap Saji', status: 'Terpenuhi', urgency: 'Urgensi Rendah', icon: 'package' }
    ],
    route: {
      distance: '22 km',
      duration: '± 45 Menit',
      convoy: 'Speedboat Polairud & Truk',
      statusBadge: 'Perairan Siaga',
      checkpoints: [
        { id: 1, title: 'Dermaga Danau Yahim', subtitle: 'Drop Logistik Air', tag: 'Titik Distribusi', tagClass: 'bg-emerald-50 text-emerald-700', badgeColor: 'bg-slate-900 text-white' }
      ]
    },
    reports: [
      {
        id: 'rep-j1',
        location: 'Sentani Timur, Jayapura',
        title: 'Bantuan Medis Polairud Tiba',
        desc: 'Distribusi 400 kelambu dan obat antimalaria dibagikan via perahu ke kampung Asei dan Babrongko.',
        time: '3j lalu',
        author: 'Satpolairud Jayapura',
        tag: 'Penyaluran Selesai',
        tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }
    ]
  }
};
