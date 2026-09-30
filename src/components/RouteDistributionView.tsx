import React, { useState } from 'react';
import {
  X,
  Compass,
  Navigation,
  Download,
  CheckCircle2,
  Clock,
  Truck,
  Shield,
  Droplets,
  Pill,
  Package,
  HeartHandshake,
  Camera,
  Radio,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { DisasterIncident } from '../types';

interface RouteDistributionViewProps {
  disaster: DisasterIncident;
  onClose: () => void;
  onOpenDonationModal?: () => void;
  onOpenAIHelpdesk?: () => void;
  onViewDisasterDetail?: () => void;
  isDarkMode?: boolean;
}

export const RouteDistributionView: React.FC<RouteDistributionViewProps> = ({
  disaster,
  onClose,
  onOpenDonationModal,
  onOpenAIHelpdesk,
  onViewDisasterDetail,
  isDarkMode = false,
}) => {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [navigating, setNavigating] = useState(false);

  const handleStartNavigation = () => {
    setNavigating(true);
    setTimeout(() => {
      alert(
        `[NAVIGASI TIM SAR DIAKTIFKAN]\nMemandu rute aman bebas hambatan menuju ${disaster.name} via ${
          disaster.route.checkpoints[1]?.title || 'Jalur Poros Utama'
        }.\nFrekuensi Radio HT Darurat: 145.200 MHz.`
      );
      setNavigating(false);
    }, 400);
  };

  const handleDownloadOffline = () => {
    alert(
      `[PETA RUTE OFFLINE DIDOWNLOAD]\nFile: Rute_Distribusi_${disaster.id.toUpperCase()}_BNPB.pdf (1.8 MB)\nTermasuk koordinat posko darurat, titik sumber air, dan peta elevasi jalan.`
    );
  };

  return (
    <aside
      className="absolute top-0 right-0 z-30 h-full w-[490px] max-w-[95vw] p-4 sm:p-5 flex flex-col justify-between overflow-y-auto pointer-events-auto transition-all duration-300 ease-in-out bg-white/98 dark:bg-[#0b1329]/98 backdrop-blur-xl border-l border-slate-200/90 dark:border-slate-800/80 shadow-2xl animate-fadeIn"
      id="routeDistributionStandaloneView"
    >
      <div className="space-y-4">
        {/* Header with Title, Status Badge, and Dedicated Close Button */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/25 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Rute Distribusi Bantuan
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {disaster.name} • Kawal Logistik & Jalur Aman
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-600/30 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {disaster.route.statusBadge}
            </span>

            {/* Standalone Close Button (No dual sidebar, cleanly returns to full map) */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
              title="Tutup Halaman Rute & Kembali ke Peta Penuh"
              aria-label="Tutup Halaman Rute"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Route Banner: Durasi, Jarak & Konvoi */}
        <div className="p-3.5 bg-gradient-to-r from-orange-50 via-amber-50 to-slate-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 rounded-2xl border border-orange-200/80 dark:border-orange-500/30 shadow-xs flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                Estimasi Durasi & Jarak:
              </span>
              <strong className="text-slate-900 dark:text-white font-bold text-xs">
                {disaster.route.distance} • {disaster.route.duration}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <Truck className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
              {disaster.route.convoy}
            </span>
          </div>
        </div>

        {/* Step-by-Step Checkpoints Timeline */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Urutan Titik Perjalanan (Checkpoints):
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {disaster.route.checkpoints.length} Posko Terhubung
            </span>
          </div>

          <div className="space-y-2">
            {disaster.route.checkpoints.map((cp, idx) => {
              const isLast = idx === disaster.route.checkpoints.length - 1;
              const isSelected = activeStep === cp.id;

              return (
                <div
                  key={cp.id}
                  onClick={() => setActiveStep(isSelected ? null : cp.id)}
                  className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-orange-50/60 dark:bg-slate-800 border-orange-300 dark:border-orange-500 shadow-xs'
                      : 'bg-white dark:bg-slate-900/70 hover:bg-slate-50/80 dark:hover:bg-slate-850 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col items-center shrink-0 mt-0.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shadow-sm ring-4 ${
                        cp.id === 1
                          ? 'bg-slate-900 text-white ring-slate-100 dark:ring-slate-800'
                          : cp.id === 2
                          ? 'bg-blue-600 text-white ring-blue-50 dark:ring-blue-950'
                          : cp.id === 3
                          ? 'bg-amber-500 text-white ring-amber-50 dark:ring-amber-950'
                          : 'bg-rose-500 text-white ring-rose-50 dark:ring-rose-950'
                      }`}
                    >
                      {cp.id}
                    </div>
                    {!isLast && <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-800 my-1"></div>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5 mb-0.5">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-snug truncate">
                        {cp.title}
                      </h4>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${cp.tagClass}`}
                      >
                        {cp.tag}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {cp.subtitle}
                    </p>

                    {isSelected && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Jalur Telah Divalidasi Patroli
                        </span>
                        <span className="font-mono text-[9px]">Koordinat TRC Valid</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation & Offline Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleStartNavigation}
            disabled={navigating}
            className="flex-1 py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-orange-400" />
            <span>{navigating ? 'Menghubungkan GPS...' : 'Buka Navigasi Tim SAR'}</span>
          </button>

          <button
            onClick={handleDownloadOffline}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            title="Unduh Peta Rute Offline PDF & Kontak Frekuensi Radio"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Rute Offline</span>
          </button>
        </div>

        {/* Card: Kebutuhan Paling Urgent di Titik Tujuan */}
        <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Kebutuhan Urgent di Posko
              </h4>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">Tujuan Distribusi</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {disaster.supplies.map((item) => {
              const isHigh = item.urgency === 'Urgensi Tinggi';
              return (
                <div
                  key={item.code}
                  className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center gap-2"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      isHigh
                        ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/60 dark:border-rose-800'
                        : 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950/60 dark:border-orange-800'
                    }`}
                  >
                    {item.name.toLowerCase().includes('masker') ? (
                      <Shield className="w-3.5 h-3.5" />
                    ) : item.name.toLowerCase().includes('air') ? (
                      <Droplets className="w-3.5 h-3.5" />
                    ) : item.name.toLowerCase().includes('obat') ? (
                      <Pill className="w-3.5 h-3.5" />
                    ) : (
                      <Package className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                      {item.name}
                    </div>
                    <span className="text-[9px] text-slate-400 block truncate">
                      {item.subtitle}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {onOpenDonationModal && (
            <button
              onClick={onOpenDonationModal}
              className="w-full py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Salurkan Bantuan / Donasi ke Jalur Ini</span>
            </button>
          )}
        </div>

        {/* Card: Laporan Warga Terverifikasi di Sepanjang Rute */}
        <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                Laporan Warga di Sepanjang Rute
              </h4>
            </div>
            {onOpenAIHelpdesk && (
              <button
                onClick={onOpenAIHelpdesk}
                className="text-[10px] text-blue-600 dark:text-cyan-400 font-semibold hover:underline"
              >
                Kirim Laporan
              </button>
            )}
          </div>

          <div className="space-y-2">
            {disaster.reports.slice(0, 2).map((rep) => (
              <div
                key={rep.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-xs"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-slate-900 dark:text-white text-[11px] truncate">
                    {rep.location}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700/50 px-1.5 py-0.5 rounded">
                    Terverifikasi
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                  {rep.desc}
                </p>
                <div className="flex items-center justify-between mt-1 text-[9px] text-slate-400">
                  <span>{rep.time}</span>
                  <span>{rep.author}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security / Radio Frequency Briefing */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <Radio className="w-3.5 h-3.5 text-orange-500" />
            <span>Instruksi Komando Pengawalan:</span>
          </div>
          <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Armada logistik wajib menyalakan lampu hazard, batas laju 40 km/jam saat kabut/hujan, dan melapor setiap 15 menit melalui frekuensi HT 145.200 MHz.
          </p>
        </div>
      </div>

      {/* Footer Switcher to Full Detail Overview if needed */}
      {onViewDisasterDetail && (
        <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onViewDisasterDetail}
            className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Lihat Seluruh Detail Situasi & Kerugian</span>
          </button>
        </div>
      )}
    </aside>
  );
};
