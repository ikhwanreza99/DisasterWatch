import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Menu,
  Send,
  Headset,
  Sparkles,
  AlertTriangle,
  Package,
  BookOpen,
  ThumbsUp,
  CheckCircle2,
  Upload,
  ArrowRight,
} from 'lucide-react';
import { DisasterIncident } from '../types';

interface AIHelpdeskPanelProps {
  disaster: DisasterIncident;
  onClose: () => void;
  onReportSubmitted?: (reportData: any) => void;
}

type WorkflowType = 'menu' | 'report-disaster' | 'report-needs' | 'learn-disaster';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

export const AIHelpdeskPanel: React.FC<AIHelpdeskPanelProps> = ({
  disaster,
  onClose,
  onReportSubmitted,
}) => {
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowType>('menu');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');

  // Workflow 1: Laporkan Bencana State
  const [reportLocation, setReportLocation] = useState(`${disaster.name}, ${disaster.province}`);
  const [reportCategory, setReportCategory] = useState(disaster.category);
  const [reportUrgency, setReportUrgency] = useState('Darurat Tinggi');
  const [reportDesc, setReportDesc] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Workflow 2: Laporkan Kebutuhan State
  const [needsItems, setNeedsItems] = useState({
    masker: true,
    tangkiAir: true,
    obat: false,
    sembako: false,
  });
  const [customNeeds, setCustomNeeds] = useState('');
  const [victimsCount, setVictimsCount] = useState('');
  const [roadCondition, setRoadCondition] = useState('Truk Besar Dapat Lewat');
  const [needsNotes, setNeedsNotes] = useState('');
  const [needsSuccess, setNeedsSuccess] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReportLocation(`${disaster.name}, ${disaster.province}`);
    setReportCategory(disaster.category);
  }, [disaster]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentWorkflow, reportSuccess, needsSuccess]);

  const handleSendChat = (textToSend?: string) => {
    const text = textToSend || inputText.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');

    setTimeout(() => {
      let reply = `Terkait **${disaster.name}** (${disaster.fullTitleDisplay}), status saat ini adalah **${disaster.urgency}**. Tim reaksi cepat dan relawan siaga penuh di pos komando induk.`;
      const q = text.toLowerCase();

      if (q.includes('lapor') || q.includes('kejadian') || q.includes('bencana')) {
        reply = `Untuk melaporkan kejadian darurat atau sebaran titik bencana terbaru, Anda dapat memilih alur **1. Laporkan Bencana** di atas untuk mengunggah eviden foto dan keterangan langsung.`;
      } else if (q.includes('butuh') || q.includes('logistik') || q.includes('air') || q.includes('bantuan')) {
        reply = `Kebutuhan logistik mendesak untuk ${disaster.name} meliputi ${disaster.supplies.map((s) => s.name).join(', ')}. Silakan daftarkan lewat menu **2. Laporkan Kebutuhan**.`;
      } else if (q.includes('rute') || q.includes('evakuasi') || q.includes('jalan') || q.includes('aman')) {
        reply = `${disaster.guide.evacRoute} ${disaster.guide.safeRadius}`;
      } else if (q.includes('posko') || q.includes('medis')) {
        reply = `Posko rujukan darurat berada di area aman dengan jarak terverifikasi ${disaster.route.distance} (${disaster.route.duration}). Tenaga medis dan obat ISPA siaga.`;
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: reply,
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 450);
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReportSuccess(true);
    if (onReportSubmitted) {
      onReportSubmitted({
        location: reportLocation,
        category: reportCategory,
        urgency: reportUrgency,
        desc: reportDesc,
        file: reportFile?.name,
      });
    }
  };

  const handleNeedsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNeedsSuccess(true);
  };

  return (
    <div
      className="absolute inset-0 bg-white z-50 flex flex-col justify-between transition-all duration-300 pointer-events-auto"
      id="fullHeightAIPanel"
    >
      {/* AI Panel Header */}
      <div className="px-5 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-orange-500 to-cyan-400 p-[1.5px] shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-amber-400">
              <Headset className="w-4 h-4 text-amber-400" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full border-2 border-slate-950 flex items-center justify-center text-[7px] text-slate-950 font-black">
              ✦
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold tracking-tight text-white">
                DisasterAI Helpdesk Assistant
              </h3>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <span>Siaga Bencana RI</span> •{' '}
              <span className="text-cyan-300 font-semibold" id="aiActiveContextBanner">
                Konteks: {disaster.name}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Menu Utama Button */}
          <button
            onClick={() => {
              setCurrentWorkflow('menu');
              setReportSuccess(false);
              setNeedsSuccess(false);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-[10px] font-semibold text-slate-300 hover:text-white border border-slate-700/80 transition-all flex items-center gap-1 cursor-pointer"
            title="Kembali ke 3 Pilihan Menu Utama"
          >
            <Menu className="w-3 h-3" />
            <span>Menu Utama</span>
          </button>
          {/* Close Panel Button */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-slate-700/80 cursor-pointer"
            title="Tutup Chatbot & Kembali ke Dasbor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div ref={scrollRef} className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/70 text-xs">
        {/* Welcome Bot Bubble */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-amber-400 flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm border border-slate-800">
            <Headset className="w-4 h-4 text-amber-400" />
          </div>
          <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200/90 shadow-sm text-slate-800 max-w-[94%] space-y-2">
            <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Halo! Selamat Datang di DisasterAI Helpdesk</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              Saya asisten digital tanggap darurat BNPB & BMKG terpadu. Silakan pilih aksi cepat di bawah untuk respon terkoordinasi langsung ke posko komando satgas lapangan:
            </p>
          </div>
        </div>

        {/* WORKFLOW HUB: 3 Main Options */}
        {currentWorkflow === 'menu' && (
          <div className="space-y-2.5 pt-1 animate-fadeIn">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Pilih Alur Layanan AI:
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Satgas Aktif 24/7
              </span>
            </div>

            {/* Option 1: Laporkan Bencana */}
            <button
              onClick={() => {
                setCurrentWorkflow('report-disaster');
                setReportSuccess(false);
              }}
              className="w-full p-3.5 bg-white hover:bg-orange-50/60 rounded-2xl border border-slate-200 hover:border-orange-300 shadow-xs hover:shadow-md transition-all text-left group flex items-start gap-3.5 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs group-hover:text-orange-600 transition-colors">
                    1. Laporkan Bencana
                  </span>
                  <span className="text-[10px] text-orange-500 font-semibold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                    Form Multi-Tahap
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Validasi keparahan, akses jalan, jumlah jiwa rentan & penerbitan Tiket Reaksi Cepat BNPB.
                </p>
              </div>
            </button>

            {/* Option 2: Laporkan Kebutuhan */}
            <button
              onClick={() => {
                setCurrentWorkflow('report-needs');
                setNeedsSuccess(false);
              }}
              className="w-full p-3.5 bg-white hover:bg-blue-50/60 rounded-2xl border border-slate-200 hover:border-blue-300 shadow-xs hover:shadow-md transition-all text-left group flex items-start gap-3.5 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Package className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs group-hover:text-blue-600 transition-colors">
                    2. Laporkan Kebutuhan
                  </span>
                  <span className="text-[10px] text-blue-500 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Logistik & Medis
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Kebutuhan oksigen/ISPA, air minum, logistik balita/lansia, serta penetapan posko drop-off.
                </p>
              </div>
            </button>

            {/* Option 3: Pelajari Bencana */}
            <button
              onClick={() => setCurrentWorkflow('learn-disaster')}
              className="w-full p-3.5 bg-white hover:bg-emerald-50/60 rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all text-left group flex items-start gap-3.5 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs group-hover:text-emerald-600 transition-colors">
                    3. Pelajari Bencana
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Edukasi & ISPU
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Pemantauan ISPU real-time, protokol masker N95, peta zona aman, dan kontak darurat BPBD.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* WORKFLOW 1: LAPORKAN BENCANA */}
        {currentWorkflow === 'report-disaster' && (
          <div className="space-y-3 animate-fadeIn">
            {!reportSuccess ? (
              <div className="bg-white rounded-2xl p-4 border border-orange-200 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">
                        Formulir Lapor Kejadian Bencana
                      </h4>
                      <p className="text-[10px] text-slate-400">Verifikasi langsung ke satgas penanggulangan</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentWorkflow('menu')}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md"
                  >
                    Batal
                  </button>
                </div>

                <form onSubmit={handleReportSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                      Nama Lokasi / Wilayah
                    </label>
                    <input
                      type="text"
                      required
                      value={reportLocation}
                      onChange={(e) => setReportLocation(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                      placeholder="Contoh: Dusun Timur RT 03, Kab. Banjar"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                        Jenis Bencana
                      </label>
                      <select
                        value={reportCategory}
                        onChange={(e) => setReportCategory(e.target.value as any)}
                        className="w-full text-xs rounded-xl border border-slate-300 px-2.5 py-2 focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="fire">Kebakaran Hutan / Gambut</option>
                        <option value="flood">Banjir Bandang / Genangan</option>
                        <option value="earthquake">Gempa Bumi / Keretakan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                        Tingkat Darurat
                      </label>
                      <select
                        value={reportUrgency}
                        onChange={(e) => setReportUrgency(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 px-2.5 py-2 focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="Darurat Tinggi">Darurat Tinggi</option>
                        <option value="Siaga Penuh">Siaga Penuh</option>
                        <option value="Waspada">Waspada</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                      Deskripsi Singkat Dampak
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={reportDesc}
                      onChange={(e) => setReportDesc(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900"
                      placeholder="Jelaskan kondisi akses jalan, perkiraan korban, atau arah sebaran api/air..."
                    />
                  </div>

                  {/* Upload Evidence */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                      Upload Eviden / Bukti Foto
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setReportFile(e.target.files[0]);
                        }
                      }}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-orange-400 bg-slate-50/70 hover:bg-orange-50/30 rounded-xl p-3 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1"
                    >
                      <Upload className="w-5 h-5 text-orange-500" />
                      <span className="text-[11px] font-semibold text-slate-700">
                        {reportFile ? (
                          <span className="text-emerald-600 font-bold">
                            ✓ Terlampir: {reportFile.name}
                          </span>
                        ) : (
                          'Pilih Foto / Video dari Perangkat'
                        )}
                      </span>
                      <span className="text-[9px] text-slate-400">JPG, PNG, atau MP4 (Maks 15MB)</span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentWorkflow('menu')}
                      className="px-4 py-2 rounded-xl text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Kirimkan Laporan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Sleek Confirmation Screen with Prominent Thumbs-up Vector Icon */
              <div className="bg-emerald-50/90 rounded-2xl p-5 border border-emerald-200 shadow-sm text-center space-y-3 animate-fadeIn">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border-2 border-emerald-300 shadow-inner">
                  <ThumbsUp className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                    Menunggu Verifikasi Agent TRC
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">
                    Laporan Berhasil Masuk Antrian!
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                    Terima kasih. Laporanmu di <strong>{reportLocation}</strong> sudah diterima dan akan diverifikasi lebih lanjut oleh tim/agent penanggulangan bencana.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setReportSuccess(false);
                      setCurrentWorkflow('menu');
                    }}
                    className="px-4 py-2 rounded-xl text-[11px] font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
                  >
                    Kembali ke Menu Awal
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
                  >
                    Tutup & Pantau Peta
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WORKFLOW 2: LAPORKAN KEBUTUHAN */}
        {currentWorkflow === 'report-needs' && (
          <div className="space-y-3 animate-fadeIn">
            {!needsSuccess ? (
              <div className="bg-white rounded-2xl p-4 border border-blue-200 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">
                        Asesmen & Kebutuhan Darurat
                      </h4>
                      <p className="text-[10px] text-slate-400">Sinkronisasi armada distribusi logistik posko</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentWorkflow('menu')}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md"
                  >
                    Batal
                  </button>
                </div>

                <form onSubmit={handleNeedsSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                      Kebutuhan Paling Urgent Saat Ini
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50/50 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={needsItems.masker}
                          onChange={(e) =>
                            setNeedsItems({ ...needsItems, masker: e.target.checked })
                          }
                          className="rounded text-blue-600"
                        />
                        <span>Masker N95 / Karbon</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50/50 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={needsItems.tangkiAir}
                          onChange={(e) =>
                            setNeedsItems({ ...needsItems, tangkiAir: e.target.checked })
                          }
                          className="rounded text-blue-600"
                        />
                        <span>Tangki Air Bersih</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50/50 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={needsItems.obat}
                          onChange={(e) =>
                            setNeedsItems({ ...needsItems, obat: e.target.checked })
                          }
                          className="rounded text-blue-600"
                        />
                        <span>Obat ISPA & Mata</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50/50 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={needsItems.sembako}
                          onChange={(e) =>
                            setNeedsItems({ ...needsItems, sembako: e.target.checked })
                          }
                          className="rounded text-blue-600"
                        />
                        <span>Tenda & Sembako</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={customNeeds}
                      onChange={(e) => setCustomNeeds(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900"
                      placeholder="Kebutuhan tambahan: (cth: Genset, Perahu karet, Makanan bayi)"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                        Estimasi Korban Terdampak
                      </label>
                      <input
                        type="text"
                        required
                        value={victimsCount}
                        onChange={(e) => setVictimsCount(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900"
                        placeholder="Contoh: ± 120 KK / 350 Jiwa"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                        Kondisi Akses Jalan
                      </label>
                      <select
                        value={roadCondition}
                        onChange={(e) => setRoadCondition(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 px-2.5 py-2 focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="Truk Besar Dapat Lewat">Truk Dapat Lewat</option>
                        <option value="Hanya Motor / Jalan Kaki">Hanya Motor / Jalan Kaki</option>
                        <option value="Terisolir / Butuh Perahu">Terisolir / Butuh Perahu</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                      Keterangan Prioritas Bantuan & Posko Terdekat
                    </label>
                    <textarea
                      rows={2}
                      value={needsNotes}
                      onChange={(e) => setNeedsNotes(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900"
                      placeholder="Sebutkan kontak PJ posko atau rincian krisis mendesak..."
                    />
                  </div>

                  <div className="pt-1 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentWorkflow('menu')}
                      className="px-4 py-2 rounded-xl text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Kirim Kebutuhan Mendesak</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-blue-50/90 rounded-2xl p-5 border border-blue-200 shadow-sm text-center space-y-3 animate-fadeIn">
                <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center border-2 border-blue-300 shadow-inner">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Tercatat di Dispatcher Posko
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">
                    Permintaan Logistik Didaftarkan
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                    Kebutuhan darurat Anda berhasil diteruskan ke tim pengatur logistik tanggap darurat BNPB & Satgas Terpadu wilayah aktif.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setNeedsSuccess(false);
                      setCurrentWorkflow('menu');
                    }}
                    className="px-4 py-2 rounded-xl text-[11px] font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
                  >
                    Kembali ke Menu Awal
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
                  >
                    Tutup Chat
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WORKFLOW 3: PELAJARI BENCANA & PANDUAN MITIGASI */}
        {currentWorkflow === 'learn-disaster' && (
          <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-sm space-y-3.5 animate-fadeIn">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">{disaster.guide.title}</h4>
                  <p className="text-[10px] text-slate-400">Panduan Resmi BNPB & BMKG Terpadu</p>
                </div>
              </div>
              <button
                onClick={() => setCurrentWorkflow('menu')}
                className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md cursor-pointer"
              >
                Pilihan Lain
              </button>
            </div>

            {/* Penyebab & Potensi Bahaya */}
            <div className="space-y-2 text-xs">
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
                <div className="font-bold text-amber-900 flex items-center gap-1.5 text-[11px] mb-1">
                  <span>⚠️</span> Penyebab & Dinamika
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">{disaster.guide.cause}</p>
              </div>

              <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200/80">
                <div className="font-bold text-rose-900 flex items-center gap-1.5 text-[11px] mb-1">
                  <span>☣️</span> Potensi Bahaya Utama
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">{disaster.guide.hazards}</p>
              </div>
            </div>

            {/* Radius Aman */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-800 text-[11px] block mb-0.5">
                Jangkauan & Radius Zona Aman:
              </span>
              <p className="text-slate-600 text-[11px]">{disaster.guide.safeRadius}</p>
            </div>

            {/* Protokol Perlindungan */}
            <div className="space-y-1.5">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <span>🛡️</span> Protokol Perlindungan Mandiri:
              </div>
              <ul className="space-y-1.5 pl-0.5">
                {disaster.guide.protocols.map((protocol, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{protocol}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Jalur Evakuasi */}
            <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs flex items-start gap-2">
              <span className="text-emerald-700 mt-0.5">📍</span>
              <div>
                <strong className="text-emerald-900 font-bold block text-[11px]">
                  Rute Jalur Evakuasi Terbuka:
                </strong>
                <p className="text-emerald-800 text-[11px] mt-0.5 font-medium">
                  {disaster.guide.evacRoute}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                onClick={() => setCurrentWorkflow('menu')}
                className="px-4 py-2 rounded-xl text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Pilih Opsi Lain
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
              >
                Selesai & Kembali
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Chat Messages Stream */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : ''}`}
          >
            {msg.sender === 'ai' && (
              <div className="w-7 h-7 rounded-xl bg-slate-900 text-amber-400 flex-shrink-0 flex items-center justify-center text-[10px] font-bold shadow-xs">
                AI
              </div>
            )}
            <div
              className={`p-3.5 rounded-2xl shadow-xs max-w-[85%] text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-none'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Quick Suggestion Pills */}
        <div className="pt-2">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 px-1">
            Pertanyaan Cepat Satgas:
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleSendChat('Rute evakuasi dan jalur logistik aman saat ini')}
              className="px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              🚗 Rute & Jalur Aman
            </button>
            <button
              onClick={() => handleSendChat('Daftar posko medis terdekat dan ketersediaan ambulans')}
              className="px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              🏥 Posko Medis Terdekat
            </button>
            <button
              onClick={() => handleSendChat('Protokol keselamatan asap dan masker respirator')}
              className="px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              😷 Protokol Masker N95
            </button>
          </div>
        </div>
      </div>

      {/* Bottom AI Input Bar */}
      <div className="p-3.5 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendChat();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ketik pertanyaan untuk asisten tanggap darurat..."
            className="flex-1 text-xs border border-slate-300 rounded-full px-4 py-2.5 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none bg-slate-50/50"
          />
          <button
            type="submit"
            className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white flex items-center justify-center shadow-md transition-all shrink-0 cursor-pointer"
            title="Kirim Pesan"
          >
            <Send className="w-3.5 h-3.5 transform" />
          </button>
        </form>
      </div>
    </div>
  );
};
