import React, { useState } from 'react';
import {
  X,
  Share2,
  Compass,
  Flame,
  Waves,
  Activity,
  HeartHandshake,
  Navigation,
  Download,
  AlertCircle,
  Shield,
  Droplets,
  Pill,
  Package,
  Camera,
} from 'lucide-react';
import { DisasterIncident } from '../types';

interface ExpandedDetailOverlayProps {
  disaster: DisasterIncident;
  onClose: () => void;
  onOpenAIHelpdesk: () => void;
  onOpenDonationModal: () => void;
  onOpenDisasterBrief: () => void;
}

export const ExpandedDetailOverlay: React.FC<ExpandedDetailOverlayProps> = ({
  disaster,
  onClose,
  onOpenAIHelpdesk,
  onOpenDonationModal,
  onOpenDisasterBrief,
}) => {
  const [isRouteVisible, setIsRouteVisible] = useState(true);

  const getCategoryIcon = () => {
    switch (disaster.category) {
      case 'fire':
        return <Flame className="w-6 h-6 text-white" />;
      case 'flood':
        return <Waves className="w-6 h-6 text-white" />;
      case 'earthquake':
        return <Activity className="w-6 h-6 text-white" />;
    }
  };

  const getGradientClass = () => {
    switch (disaster.category) {
      case 'fire':
        return 'from-amber-500 to-orange-500 shadow-orange-500/20';
      case 'flood':
        return 'from-blue-500 to-cyan-500 shadow-blue-500/20';
      case 'earthquake':
        return 'from-rose-500 to-red-500 shadow-rose-500/20';
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `DisasterWatch: ${disaster.name}`,
          text: `Status ${disaster.urgency}: ${disaster.fullTitleDisplay} di ${disaster.name}.`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Tautan pantauan bencana berhasil disalin ke clipboard!');
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 p-4 sm:p-6 overflow-hidden flex flex-col justify-between pointer-events-auto transition-all duration-300 animate-fadeIn"
      style={{
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(14px)',
      }}
    >
      {/* Top Bar with Standalone 'Tutup X' Button Outside Boxes at Top-Right */}
      <div className="relative z-50 flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-ping"></span>
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Detail Situasi Wilayah & Jalur Logistik Terbuka
          </span>
        </div>

        {/* External Close Button positioned top-right */}
        <button
          onClick={onClose}
          className="group flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-800 shadow-xl border border-slate-200 transition-all active:scale-95 text-xs font-bold cursor-pointer"
          title="Tutup & Kembali ke Homepage Peta"
        >
          <span>Tutup</span>
          <X className="w-4 h-4 text-slate-500 group-hover:text-rose-600 transition-transform group-hover:rotate-90 duration-200" />
        </button>
      </div>

      {/* Multi-Column Grid (Aligned Top, Presisi) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 w-full items-start flex-1 overflow-hidden h-full pr-1">
        {/* Left Column: Disaster Overview, Impact & Key Metrics */}
        <div className="xl:col-span-6 space-y-4 min-w-0 overflow-y-auto h-full pb-4">
          {/* Status Card */}
          <article className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  STATUS {disaster.urgency.toUpperCase()}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Update 3m lalu</span>
              </div>
              <button
                onClick={onOpenDisasterBrief}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 flex items-center justify-center transition-all text-xs shrink-0"
                title="Detail Teknis Satgas"
              >
                i
              </button>
            </div>

            <div className="flex items-start gap-3.5 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${getGradientClass()} shadow-md flex items-center justify-center p-3 transition-all shrink-0`}
              >
                {getCategoryIcon()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 leading-snug break-words whitespace-normal">
                  {disaster.name}, {disaster.province}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {disaster.fullTitleDisplay}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-100">
                <span className="text-slate-400 block font-medium text-[11px]">Estimasi Dampak</span>
                <strong className="text-slate-900 font-bold text-base block mt-0.5">
                  {disaster.cost}
                </strong>
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                  {disaster.impact}
                </span>
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-100">
                <span className="text-slate-400 block font-medium text-[11px]">Gap Recovery</span>
                <strong className="text-slate-800 font-bold text-sm block mt-0.5">
                  {disaster.gapRecovery}
                </strong>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${disaster.recoveryPct}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Field Photo Banner with Source */}
            <div className="mb-4 relative rounded-xl overflow-hidden border border-slate-200/80 shadow-inner group">
              <img
                src={disaster.photoUrl}
                alt={disaster.photoAlt}
                className="w-full h-36 object-cover transform hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] text-white flex items-center gap-1.5 border border-white/10">
                <Camera className="w-3 h-3 text-amber-400" />
                <span>Sumber: {disaster.photoSource}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRouteVisible(!isRouteVisible)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${
                  isRouteVisible
                    ? 'bg-slate-900 hover:bg-slate-800 ring-2 ring-orange-500 shadow-orange-500/20'
                    : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/25'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>{isRouteVisible ? 'Rute Distribusi Bantuan Aktif' : 'Tampilkan Rute Distribusi'}</span>
              </button>
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center border border-slate-200/80 transition-all shrink-0"
                title="Bagikan Titik Lokasi"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </article>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs text-center hover:border-slate-300 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                Titik Panas
              </span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {disaster.stats.hotspots}
              </div>
              <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md mt-1">
                {disaster.stats.hotspotsChange}
              </span>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs text-center hover:border-slate-300 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                Kerugian Total
              </span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {disaster.stats.loss}
              </div>
              <span className="inline-flex items-center text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md mt-1">
                {disaster.stats.lossChange}
              </span>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs text-center hover:border-slate-300 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                Personel SAR
              </span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {disaster.stats.personnel}
              </div>
              <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md mt-1">
                {disaster.stats.personnelChange}
              </span>
            </div>
          </div>

          {/* Kebutuhan Paling Urgent Card */}
          <article className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col transition-all hover:shadow-md">
            <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping"></span>
                <h4 className="text-xs font-bold text-slate-900 tracking-tight uppercase">
                  Kebutuhan Paling Urgent
                </h4>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Urgensi Tinggi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span>Urgensi Rendah</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {disaster.supplies.map((item) => {
                const isHigh = item.urgency === 'Urgensi Tinggi';
                return (
                  <div
                    key={item.code}
                    className="p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center gap-2.5"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isHigh
                          ? 'bg-rose-50 border-rose-200 text-rose-600'
                          : 'bg-orange-50 border-orange-200 text-orange-600'
                      }`}
                    >
                      {item.name.toLowerCase().includes('masker') ? (
                        <Shield className="w-4 h-4" />
                      ) : item.name.toLowerCase().includes('air') ? (
                        <Droplets className="w-4 h-4" />
                      ) : item.name.toLowerCase().includes('obat') ? (
                        <Pill className="w-4 h-4" />
                      ) : (
                        <Package className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 leading-tight truncate">
                        {item.name}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={onOpenDonationModal}
              className="w-full py-3 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4 text-white" />
              <span>Salurkan Bantuan / Donasi</span>
            </button>
          </article>
        </div>

        {/* Right Column: Rute Distribusi & Laporan Warga */}
        <div className="xl:col-span-6 min-w-0 flex flex-col space-y-4 overflow-y-auto h-full pr-1 pb-4">
          {/* Card 1: Rute Distribusi Bantuan Terverifikasi */}
          {isRouteVisible && (
            <article
              className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col transition-all"
              id="routeDistributionCard"
            >
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 tracking-tight uppercase">
                      Rute Distribusi Bantuan Terverifikasi
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      Kawal Logistik, Jalur Aman & Pantauan Rute
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{' '}
                    {disaster.route.statusBadge}
                  </span>
                  <button
                    onClick={() => setIsRouteVisible(false)}
                    className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all"
                    title="Tutup Rute Distribusi"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Estimated Duration, Distance & Convoy */}
              <div className="p-3 bg-gradient-to-r from-orange-50 via-amber-50 to-slate-50 rounded-2xl border border-orange-200/70 flex items-center justify-between text-xs mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    Estimasi Durasi & Jarak:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-white font-bold text-orange-600 shadow-xs border border-orange-200 text-[11px]">
                    {disaster.route.distance} • {disaster.route.duration}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {disaster.route.convoy}
                  </span>
                </div>
              </div>

              {/* Route Steps Timeline */}
              <div className="space-y-2.5 overflow-y-auto pr-1 text-xs max-h-[300px]">
                {disaster.route.checkpoints.map((cp, idx) => {
                  const isLast = idx === disaster.route.checkpoints.length - 1;
                  return (
                    <div key={cp.id} className="flex items-start gap-3 relative">
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm ring-4 ring-slate-100 ${cp.badgeColor}`}
                        >
                          {cp.id}
                        </div>
                        {!isLast && <div className="w-0.5 h-10 bg-slate-200 my-0.5"></div>}
                      </div>
                      <div className="flex-1 bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-[11px]">
                            {cp.title}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cp.tagClass}`}
                          >
                            {cp.tag}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          {cp.subtitle}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions: Navigasi & Rute Offline */}
              <div className="pt-3.5 mt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => alert('Membuka GPS Navigasi Taktis Tim TRC/SAR...')}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Buka Navigasi Tim SAR</span>
                </button>
                <button
                  onClick={() =>
                    alert(
                      'Mengunduh Peta Rute Offline PDF & Kontak Frekuensi Radio (145.200 MHz)...'
                    )
                  }
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-semibold text-xs flex items-center gap-1 border border-slate-200 transition-all cursor-pointer"
                  title="Unduh Panduan Rute Off-grid"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Rute Offline</span>
                </button>
              </div>
            </article>
          )}

          {/* Card 2: Laporan Warga & Relawan Terverifikasi */}
          <article
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col transition-all hover:shadow-md"
            id="citizenReportsCard"
          >
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900 tracking-tight uppercase">
                      Laporan Warga Terverifikasi
                    </h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                      {disaster.reports.length} Laporan Aktif
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Divalidasi Petugas Posko TRC & BPBD Lapangan
                  </span>
                </div>
              </div>
              <button
                onClick={onOpenAIHelpdesk}
                className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>Semua</span>
              </button>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
              {disaster.reports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="font-bold text-slate-900 text-xs">{rep.location}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {rep.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug mb-2">{rep.desc}</p>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`font-semibold px-2 py-0.5 rounded-full border ${rep.tagClass}`}>
                      {rep.tag}
                    </span>
                    <span className="text-slate-400 font-medium">{rep.author}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3.5 mt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                Pusat Pengaduan Darurat Warga
              </span>
              <button
                onClick={onOpenAIHelpdesk}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Kirim Laporan Baru</span>
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};
