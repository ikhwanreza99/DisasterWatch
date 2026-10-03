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
  Zap,
  Radio,
} from 'lucide-react';
import { DisasterIncident } from '../types';

interface ExpandedDetailContentProps {
  disaster: DisasterIncident;
  onClose: () => void;
  onOpenAIHelpdesk: () => void;
  onOpenDonationModal: () => void;
  onOpenDisasterBrief: () => void;
}

export const ExpandedDetailContent: React.FC<ExpandedDetailContentProps> = ({
  disaster,
  onClose,
  onOpenAIHelpdesk,
  onOpenDonationModal,
  onOpenDisasterBrief,
}) => {
  const [isRouteVisible, setIsRouteVisible] = useState(true);

  const recoveryServiceConfig = {
    water: {
      label: 'Air & Sanitasi',
      icon: Droplets,
      accent: 'text-cyan-600',
      iconBg: 'bg-cyan-50',
      iconBorder: 'border-cyan-200',
      progress: 'bg-cyan-500',
    },
    electricity: {
      label: 'Listrik',
      icon: Zap,
      accent: 'text-amber-600',
      iconBg: 'bg-amber-50',
      iconBorder: 'border-amber-200',
      progress: 'bg-amber-500',
    },
    access: {
      label: 'Akses',
      icon: Navigation,
      accent: 'text-orange-600',
      iconBg: 'bg-orange-50',
      iconBorder: 'border-orange-200',
      progress: 'bg-orange-500',
    },
    telecommunication: {
      label: 'Telekomunikasi',
      icon: Radio,
      accent: 'text-violet-600',
      iconBg: 'bg-violet-50',
      iconBorder: 'border-violet-200',
      progress: 'bg-violet-500',
    },
  } as const;

  const getRecoveryBadgeClass = (status: string) => {
    switch (status) {
      case 'Terganggu':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'Dalam Pemulihan':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Hampir Pulih':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Pulih':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

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
    <div className="h-full min-h-0 flex flex-col">
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
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 w-full items-stretch flex-1 min-h-0 overflow-hidden h-full pr-1">
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

          {/* Primary Recovery Status Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {disaster.recoveryServices.map((service) => {
              const config = recoveryServiceConfig[service.type];
              const Icon = config.icon;

              return (
                <div
                  key={service.type}
                  className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div
                      className={`w-8 h-8 rounded-xl border ${config.iconBg} ${config.iconBorder} ${config.accent} flex items-center justify-center shrink-0`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <span className="text-lg font-black text-slate-900 leading-none">
                      {service.recovery}%
                    </span>
                  </div>

                  <div className="min-w-0 mb-2.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block truncate">
                      {config.label}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      Status Recovery
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mb-2.5">
                    <div
                      className={`h-full rounded-full ${config.progress} transition-all duration-500`}
                      style={{ width: `${service.recovery}%` }}
                    />
                  </div>

                  <span
                    className={`inline-flex items-center text-[9px] font-bold px-2 py-1 rounded-md border ${getRecoveryBadgeClass(service.status)}`}
                  >
                    {service.status}
                  </span>
                </div>
              );
            })}
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

        {/* Card 2: Laporan Warga & Relawan Terverifikasi */}
        <div className="xl:col-span-6 min-w-0 flex flex-col h-full min-h-0 overflow-hidden pr-1 pb-4">
          <article
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col h-full min-h-0 transition-all hover:shadow-md"
            id="citizenReportsCard"
          >
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 shrink-0">
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
                Semua
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="space-y-3">
                {disaster.reports.map((report) => (
                  <div
                    key={report.id}
                    className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all shrink-0 "
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="font-bold text-slate-900 text-xs">{report.location}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {report.time}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-snug mb-2">{report.desc}</p>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`font-semibold px-2 py-0.5 rounded-full border ${report.tagClass}`}>
                        {report.tag}
                      </span>
                      <span className="text-slate-400 font-medium">{report.author}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3.5 mt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
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
