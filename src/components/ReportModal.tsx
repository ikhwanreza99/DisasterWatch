import React, { useState, useRef } from 'react';
import { X, Upload, ThumbsUp, Plus } from 'lucide-react';
import { DisasterIncident } from '../types';
import type { IntelligenceReport } from '../domain/intelligence';
import { submitReportPipeline, type PipelineResult } from '../services/pipeline/reportPipeline';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDisaster: DisasterIncident;
  onReportSuccess: (report: any) => void;
  onIntelReport?: (rep: IntelligenceReport) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  activeDisaster,
  onReportSuccess,
  onIntelReport,
}) => {
  const [category, setCategory] = useState(activeDisaster.category);
  const [location, setLocation] = useState(`${activeDisaster.name}, ${activeDisaster.province}`);
  const [urgency, setUrgency] = useState('Darurat Tinggi');
  const [urgentNeeds, setUrgentNeeds] = useState('Masker N95 & Tangki Air');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineResult | null>(null);
  const [submitError, setSubmitError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const rawText = `${description}\nKebutuhan mendesak: ${urgentNeeds}\nTingkat urgensi form: ${urgency}`.trim();
      const result = await submitReportPipeline({
        disasterId: activeDisaster.id,
        sourceType: 'citizen',
        sourceName: 'Warga Pelapor (Modal)',
        rawText: rawText || description,
        locationName: location,
        lat: activeDisaster.coords.lat,
        lng: activeDisaster.coords.lng,
        isMock: true,
      });
      setPipeline(result);
      setIsSubmitted(true);
      onIntelReport?.(result.report);
      onReportSuccess({
        category,
        location,
        urgency,
        urgentNeeds,
        description,
        fileName: file?.name,
      });
    } catch (err) {
      setSubmitError(`Gagal memproses laporan: ${String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setPipeline(null);
    setDescription('');
    setFile(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 transform transition-all relative overflow-hidden">
        {!isSubmitted ? (
          <>
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Buat Laporan Darurat Bencana</h3>
                  <p className="text-xs text-slate-500">Laporkan kejadian darurat atau ajukan penyaluran bantuan</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Bencana</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 text-slate-800 text-xs py-2.5 px-3 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  required
                >
                  <option value="fire">Kebakaran Hutan & Lahan (Karhutla)</option>
                  <option value="flood">Banjir Bandang / Genangan</option>
                  <option value="earthquake">Gempa Bumi / Tanah Longsor</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Wilayah / Titik Acuan</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 text-slate-800 text-xs py-2.5 px-3 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  placeholder="Contoh: Jl. Ahmad Yani Km 14, Kab. Banjar"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tingkat Urgensi</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 text-slate-800 text-xs py-2.5 px-3 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  >
                    <option value="Darurat Tinggi">Darurat Tinggi</option>
                    <option value="Siaga Penuh">Siaga Penuh</option>
                    <option value="Waspada">Waspada</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kebutuhan Mendesak</label>
                  <input
                    type="text"
                    value={urgentNeeds}
                    onChange={(e) => setUrgentNeeds(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 text-slate-800 text-xs py-2.5 px-3 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                    placeholder="Contoh: Masker & Perahu Karet"
                  />
                </div>
              </div>

              {/* Upload Bukti */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Upload Bukti Kejadian (Foto / Video)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0]);
                    }
                  }}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl p-4 text-center cursor-pointer transition-all bg-slate-50/60 hover:bg-orange-50/20 group flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-full bg-white text-slate-600 group-hover:text-orange-600 flex items-center justify-center shadow-xs border border-slate-200 transition-colors">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-slate-800 text-xs mt-1">
                    {file ? (
                      <span className="text-emerald-600 font-bold">✓ Terpilih: {file.name}</span>
                    ) : (
                      'Upload Foto / Video Bukti Kejadian'
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400">Format PNG, JPG, MP4 maksimal 15MB</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan Situasi & Dampak
                </label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 text-slate-800 text-xs py-2 px-3 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  placeholder="Jelaskan kondisi akses jalan, korban terdampak, atau titik api..."
                />
              </div>

              {submitError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700">{submitError}</div>
              )}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  {isSubmitting ? 'Menganalisis AI…' : 'Kirimkan Laporan'}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Sleek Confirmation Screen (with prominent Thumbs-up Vector Icon) */
          <div className="py-8 px-4 text-center flex flex-col items-center justify-center space-y-4 animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xl">
              <ThumbsUp className="w-10 h-10 animate-bounce" />
            </div>

            <div className="space-y-1 max-w-sm">
              <h4 className="text-lg font-bold text-slate-900">Laporan Berhasil Terkirim!</h4>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                Terima kasih. Laporanmu sudah diterima dan akan segera diverifikasi oleh tim penanggulangan darurat TRC & BPBD.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left w-full text-[11px] text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">ID Laporan:</span>
                <span className="font-mono font-bold text-slate-800">{pipeline?.report.id ?? '#REP-pending'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Lokasi:</span>
                <span className="font-semibold text-slate-800">{location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status Validasi:</span>
                <span className="font-semibold text-amber-600">{pipeline?.report.verificationStatus ?? 'Menunggu Validasi TRC'}</span>
              </div>
              {pipeline && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Engine AI:</span>
                    <span className="font-semibold text-slate-800">{pipeline.engine === 'gemini' ? 'Gemini (Firebase AI Logic)' : 'Heuristik lokal'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">AI confidence:</span>
                    <span className="font-semibold text-slate-800">{Math.round((pipeline.report.aiConfidence ?? 0) * 100)}% (indikator AI)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ekstraksi:</span>
                    <span className="font-semibold text-slate-800 text-right max-w-[260px]">
                      {pipeline.report.extractedData?.disasterType} • {pipeline.report.extractedData?.needs.map((n) => n.category).join(', ') || '—'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1">{pipeline.engineNote} {pipeline.storeMessage}</div>
                </>
              )}
            </div>

            <div className="pt-4 flex items-center justify-center gap-3 w-full">
              <button
                onClick={handleReset}
                className="flex-1 px-5 py-2.5 rounded-full border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Buat Laporan Baru
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-6 py-2.5 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
