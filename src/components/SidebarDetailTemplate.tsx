import React from 'react';
import {
  X,
  Share2,
  Compass,
  Flame,
  Waves,
  TriangleAlert,
  Activity,
  HeartHandshake,
  Navigation,
  Droplets,
  Newspaper,
  Zap,
  Radio,
} from 'lucide-react';
import { DisasterIncident } from '../types';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import { AidGapCard } from './AidGapCard';

interface SidebarDetailTemplateProps {
  news: React.ReactNode;
  mobile?: boolean;
  onOpenRoute: () => void;
  disaster: DisasterIncident;
  onClose: () => void;
  onOpenAIHelpdesk: () => void;
  onOpenDonationModal: () => void;
  onOpenDisasterBrief: () => void;
  /** Structured reports + aid records for the aid-gap card. */
  intelReports?: IntelligenceReport[];
  aidRecords?: AidRecord[];
}

export const SidebarDetailTemplate: React.FC<SidebarDetailTemplateProps> = ({
  disaster,
  news,
  mobile = false,
  onOpenRoute,
  onClose,
  onOpenAIHelpdesk,
  onOpenDonationModal,
  onOpenDisasterBrief,
  intelReports = [],
  aidRecords = [],
}) => {
  const [failedPhotoUrl, setFailedPhotoUrl] = React.useState<string | null>(null);
  const showPhoto = !!disaster.photoUrl && disaster.photoUrl !== failedPhotoUrl;

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

  const recoveryServices = (Object.keys(recoveryServiceConfig) as Array<keyof typeof recoveryServiceConfig>).map(type => ({
    type, data: disaster.recoveryServices.find(service => service.type === type),
  }));

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
      case 'other':
      case 'landslide':
        return <TriangleAlert className="w-6 h-6 text-white" />;
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
      case 'other':
      case 'landslide':
        return 'from-slate-500 to-slate-700';
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
    <div className="h-full min-h-0 flex-1 flex flex-col">
      {/* Top Bar with Standalone 'Tutup X' Button Outside Boxes at Top-Right */}
      <div className="relative z-50 flex shrink-0 items-center justify-between gap-2 mb-3 px-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-ping"></span>
          <span className={`text-xs font-bold uppercase tracking-wider ${mobile ? 'text-slate-800' : 'text-white'}`}>
            {mobile ? 'Detail Situasi Wilayah' : 'Detail Situasi Wilayah & Jalur Logistik Terbuka'}
          </span>
        </div>

        {/* External Close Button positioned top-right */}
        <button
          onClick={onClose}
          className={`group flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-800 ${mobile ? '' : 'shadow-xl'} border border-slate-200 transition-all active:scale-95 text-xs font-bold cursor-pointer`}
          title="Tutup & Kembali ke Homepage Peta"
        >
          <span>Tutup</span>
          <X className="w-4 h-4 text-slate-500 group-hover:text-rose-600 transition-transform group-hover:rotate-90 duration-200" />
        </button>
      </div>

      {/* Multi-Column Grid (Aligned Top, Presisi) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 w-full items-stretch flex-1 min-h-0 overflow-y-auto xl:overflow-hidden xl:h-full pr-1">
        {/* Left Column: Disaster Overview, Impact & Key Metrics */}
        <div className="xl:col-span-6 space-y-4 min-w-0 xl:overflow-y-auto xl:h-full pb-4">
          {/* Status Card */}
          <article className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
            {!mobile && (
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

            )}

            <div className="flex items-start gap-3.5 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${getGradientClass()} shadow-md flex items-center justify-center p-3 transition-all shrink-0`}
              >
                {getCategoryIcon()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-bold text-slate-900 leading-snug break-words whitespace-normal">
                  {disaster.name}, {disaster.province}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {disaster.fullTitleDisplay}
                </p>
                {mobile && <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  STATUS {disaster.urgency.toUpperCase()}
                </span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-4">
                <span className="text-[11px] font-medium text-slate-400 block">Estimasi Dampak</span>
                <strong className="mt-1 text-[18px] font-bold text-slate-900 block">
                  {disaster.cost}
                </strong>
                <span className="mt-2 text-[11px] font-medium text-slate-400 block">
                  {disaster.impact}
                </span>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-4">
                <span className="text-[11px] font-medium text-slate-400 block">Gap Recovery</span>
                <strong className="mt-1 text-[18px] font-bold text-slate-900 block">
                  {disaster.gapRecovery}
                </strong>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${disaster.recoveryPct}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Field Photo Banner with Source */}
            {showPhoto && <div className="mb-4 relative rounded-xl overflow-hidden border border-slate-200/80 shadow-inner group">
              <img
                src={disaster.photoUrl}
                alt={disaster.photoAlt}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setFailedPhotoUrl(disaster.photoUrl)}
                className="w-full h-36 object-cover transform hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] text-white flex items-center gap-1.5 border border-white/10">
                <Newspaper className="w-3 h-3 text-amber-400" />
                {disaster.photoSourceUrl ? <a href={disaster.photoSourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Dokumentasi: {disaster.photoSource}</a> : <span>Sumber: {disaster.photoSource}</span>}
                {disaster.photoReportDate && <span>· Laporan {new Date(disaster.photoReportDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })}</span>}
              </div>
            </div>}
            {!showPhoto && <div className="mb-4 h-36 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400" data-purpose="field-photo-placeholder">
              <Newspaper className="w-6 h-6" />
              <span className="text-xs font-semibold">Dokumentasi kejadian</span>
              <span className="text-[11px]">Belum tersedia</span>
            </div>}

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenRoute}
                className="flex-1 min-h-11 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Compass className="w-4 h-4 text-white" aria-hidden="true" />
                <span>Lihat Posko Evakuasi</span>
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
            {recoveryServices.map(({ type, data: service }) => {
              const config = recoveryServiceConfig[type];
              const Icon = config.icon;

              return (
                <div
                  key={type}
                  className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div
                      className={`w-8 h-8 rounded-xl border ${config.iconBg} ${config.iconBorder} ${config.accent} flex items-center justify-center shrink-0`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <span className="text-lg font-black text-slate-900 leading-none">
                      {service ? `${service?.recovery ?? 0}%` : '—'}
                    </span>
                  </div>

                  <div className="min-w-0 mb-2.5">
                    <span className="text-[14px] font-bold text-slate-900 block break-words">
                      {config.label}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      Status Recovery
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mb-2.5">
                    <div
                      className={`h-full rounded-full ${config.progress} transition-all duration-500`}
                      style={{ width: `${service?.recovery ?? 0}%` }}
                    />
                  </div>

                  <span
                    className={`inline-flex items-center text-[9px] font-bold px-2 py-1 rounded-md border ${getRecoveryBadgeClass(service?.status ?? 'Belum tersedia')}`}
                  >
                    {service?.status ?? 'Belum tersedia'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Kesenjangan bantuan (kebutuhan vs bantuan tercatat) */}
          <article className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80" data-purpose="detail-aid-gap">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <HeartHandshake className="w-4 h-4" aria-hidden="true" />
              </div>
              <h4 className="text-[14px] font-bold text-slate-900">Kesenjangan Bantuan</h4>
            </div>
            <AidGapCard disasterId={disaster.id} reports={intelReports} aid={aidRecords} />
            <button
              type="button"
              onClick={onOpenDonationModal}
              className="mt-4 w-full py-3 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4 text-white" />
              <span>Salurkan Bantuan / Donasi</span>
            </button>
          </article>
        </div>

        {/* Card 2: Update Berita Terkini */}
        <div className="xl:col-span-6 min-w-0 flex flex-col gap-4 xl:h-full min-h-0 xl:overflow-y-auto pr-1 pb-4">
          {news}

        </div>
      </div>
    </div>
  );
};
