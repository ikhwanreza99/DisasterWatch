import React from 'react';
import {
  X,
  Flame,
  Waves,
  Activity,
  HeartHandshake,
  Shield,
  Droplets,
  Pill,
  Package,
  Compass,
  Camera,
  Share2,
  Info,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { DisasterIncident } from '../types';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import { AidGapCard } from './AidGapCard';
import { WeatherCard } from './WeatherCard';
import { estimateImpact } from '../services/intelligence/impactEngine';

interface DisasterDetailViewProps {
  disaster: DisasterIncident;
  onClose: () => void;
  onOpenDonationModal: () => void;
  onOpenDisasterBrief: () => void;
  onViewRoute?: () => void;
  onViewReports?: () => void;
  isDarkMode?: boolean;
  intelReports?: IntelligenceReport[];
  aidRecords?: AidRecord[];
}

export const DisasterDetailView: React.FC<DisasterDetailViewProps> = ({
  disaster,
  onClose,
  onOpenDonationModal,
  onOpenDisasterBrief,
  onViewRoute,
  onViewReports,
  isDarkMode = false,
  intelReports = [],
  aidRecords = [],
}) => {
  const mine = intelReports.filter((r) => !r.disasterId || r.disasterId === disaster.id);
  const impact = estimateImpact(mine);
  const verified = mine.filter((r) => r.verificationStatus === 'VERIFIED').length;
  const conflicting = mine.filter((r) => r.verificationStatus === 'CONFLICTING').length;
  const getCategoryIcon = () => {
    switch (disaster.category) {
      case 'fire':
        return <Flame className="w-5 h-5 text-white" />;
      case 'flood':
        return <Waves className="w-5 h-5 text-white" />;
      case 'earthquake':
        return <Activity className="w-5 h-5 text-white" />;
    }
  };

  const getGradientClass = () => {
    switch (disaster.category) {
      case 'fire':
        return 'from-amber-500 to-orange-500 shadow-orange-500/25';
      case 'flood':
        return 'from-blue-500 to-cyan-500 shadow-blue-500/25';
      case 'earthquake':
        return 'from-rose-500 to-red-500 shadow-rose-500/25';
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
      alert('Tautan pantauan bencana berhasil disalin!');
    }
  };

  return (
    <aside
      className="absolute top-0 right-0 z-30 h-full w-[490px] max-w-[95vw] p-4 sm:p-5 flex flex-col justify-between overflow-y-auto pointer-events-auto transition-all duration-300 ease-in-out bg-white/98 dark:bg-[#0b1329]/98 backdrop-blur-xl border-l border-slate-200/90 dark:border-slate-800/80 shadow-2xl animate-fadeIn"
      id="disasterDetailStandaloneView"
    >
      <div className="space-y-4">
        {/* Header with Title and Single-Window Close Button */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping"></span>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Detail Situasi Wilayah Bencana
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Pembaruan Terverifikasi Posko Terpadu BNPB & BMKG
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer"
              title="Bagikan Tautan"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {/* Standalone Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
              title="Tutup & Kembali ke Peta"
              aria-label="Tutup Detail Bencana"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Card: Urgency, Location, and Cost/Gap */}
        <article className="bg-white dark:bg-slate-900/70 rounded-2xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-700/50">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                STATUS {disaster.urgency.toUpperCase()}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Update 3m lalu</span>
            </div>
            <button
              onClick={onOpenDisasterBrief}
              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-all text-xs cursor-pointer"
              title="Detail Teknis Satgas"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-start gap-3 mb-3.5">
            <div
              className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${getGradientClass()} flex items-center justify-center shrink-0 p-2.5`}
            >
              {getCategoryIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                {disaster.name}, {disaster.province}
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {disaster.fullTitleDisplay}
              </p>
            </div>
          </div>

          {/* Estimasi Dampak & Gap Recovery */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-3.5">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block font-medium text-[10px]">Estimasi Dampak</span>
              <strong className="text-slate-900 dark:text-white font-bold text-sm block mt-0.5">
                {disaster.cost}
              </strong>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mt-0.5 truncate">
                {disaster.impact}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block font-medium text-[10px]">Gap Pemulihan</span>
              <strong className="text-slate-800 dark:text-amber-400 font-bold text-sm block mt-0.5">
                {disaster.gapRecovery}
              </strong>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${disaster.recoveryPct}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Foto Lapangan Terkini */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm group">
            <img
              src={disaster.photoUrl}
              alt={disaster.photoAlt}
              className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                <span>Foto Lapangan Terkini</span>
              </div>
              <span className="text-[9px] text-white/80 font-mono truncate max-w-[190px]">
                {disaster.photoSource}
              </span>
            </div>
          </div>
        </article>

        {/* Live Weather Situation (Google Maps Platform Weather API) */}
        <WeatherCard
          lat={disaster.coords.lat}
          lng={disaster.coords.lng}
          locationName={disaster.name}
          disasterCategory={disaster.category}
        />

        {/* 3 Metric Cards: Titik Panas, Kerugian, Personel SAR */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white dark:bg-slate-900/70 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-800 text-center shadow-xs">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide block">
              Titik Panas
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {disaster.stats.hotspots}
            </div>
            <span className="inline-flex items-center text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded mt-0.5">
              {disaster.stats.hotspotsChange}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900/70 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-800 text-center shadow-xs">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide block">
              Kerugian
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {disaster.stats.loss}
            </div>
            <span className="inline-flex items-center text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-1 py-0.5 rounded mt-0.5">
              {disaster.stats.lossChange}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900/70 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-800 text-center shadow-xs">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide block">
              Personel SAR
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {disaster.stats.personnel}
            </div>
            <span className="inline-flex items-center text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded mt-0.5">
              {disaster.stats.personnelChange}
            </span>
          </div>
        </div>

        {/* Kebutuhan Paling Urgent Card */}
        <article className="bg-white dark:bg-slate-900/70 rounded-2xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Kebutuhan Paling Urgent
              </h4>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">Stok & Suplai Posko</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
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

          <button
            onClick={onOpenDonationModal}
            className="w-full py-2.5 px-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <HeartHandshake className="w-4 h-4 text-white" />
            <span>Salurkan Bantuan / Donasi</span>
          </button>
        </article>

        {/* AI Intelligence: impact + validation (additive, existing style kept) */}
        <article className="bg-white dark:bg-slate-900/70 rounded-2xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">Intelijen AI (Terstruktur)</h4>
            <span className="text-[10px] text-slate-400 font-semibold">{mine.length} laporan dianalisis</span>
          </div>
          {mine.length === 0 ? (
            <p className="text-[11px] text-slate-500 leading-relaxed">Belum ada laporan intelijen untuk lokasi ini. Data di bawah memakai data posko statis.</p>
          ) : (
            <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
              <div>Terdampak (est.): <strong>{impact.affectedPopulation > 0 ? `${impact.affectedPopulation.toLocaleString('id-ID')} jiwa` : '—'}</strong> • Akses: <strong>{impact.accessibility}</strong></div>
              <div>Terverifikasi: <strong>{verified}</strong> • Konflik: <strong className={conflicting > 0 ? 'text-rose-600' : ''}>{conflicting}</strong>{conflicting > 0 ? ' — perlu verifikasi TRC' : ''}</div>
              {impact.infraItems.length > 0 && <div className="leading-relaxed">Infrastruktur: {impact.infraItems.slice(0, 3).join('; ')}</div>}
              <div className="text-[10px] text-slate-400">Confidence AI = indikator model, bukan konfirmasi resmi.</div>
            </div>
          )}
          <AidGapCard disasterId={disaster.id} reports={intelReports} aid={aidRecords} />
        </article>

        {/* Panduan Mitigasi & Radius Aman */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Radius & Protokol Evakuasi Mandiri:</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[10px]">
            {disaster.guide.safeRadius} • {disaster.guide.evacRoute}
          </p>
        </div>
      </div>

      {/* Single Window Navigation Footer to other sections */}
      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        {onViewRoute && (
          <button
            onClick={onViewRoute}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Compass className="w-3.5 h-3.5 text-orange-400" />
            <span>Rute Distribusi</span>
          </button>
        )}
        {onViewReports && (
          <button
            onClick={onViewReports}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-500" />
            <span>Laporan Warga ({disaster.reports.length})</span>
          </button>
        )}
      </div>
    </aside>
  );
};
