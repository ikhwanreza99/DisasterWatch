import React from 'react';
import {
  Maximize2,
  Compass,
  ArrowRight,
  Flame,
  Waves,
  Activity,
  Sparkles,
  Headset,
  PanelRightClose,
} from 'lucide-react';
import { DisasterIncident } from '../types';

interface SlimSidebarProps {
  disaster: DisasterIncident;
  onExpandView: () => void;
  onOpenAIHelpdesk: () => void;
  onOpenDisasterBrief: () => void;
  onMinimize: () => void;
  onOpenRoute?: () => void;
  onOpenReports?: () => void;
}

export const SlimSidebar: React.FC<SlimSidebarProps> = ({
  disaster,
  onExpandView,
  onOpenAIHelpdesk,
  onOpenDisasterBrief,
  onMinimize,
  onOpenRoute,
  onOpenReports,
}) => {
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
        return 'from-amber-500 to-orange-500 shadow-orange-500/20';
      case 'flood':
        return 'from-blue-500 to-cyan-500 shadow-blue-500/20';
      case 'earthquake':
        return 'from-rose-500 to-red-500 shadow-rose-500/20';
    }
  };

  return (
    <aside
      className="absolute top-0 right-0 z-30 h-full w-[420px] max-w-[92vw] p-5 flex flex-col justify-between overflow-y-auto pointer-events-auto transition-all duration-300 ease-in-out bg-white/85 dark:bg-[#0b1329]/90 backdrop-blur-xl border-l border-slate-200/90 dark:border-slate-800/80 shadow-2xl"
      id="slimHomepageSidebar"
    >
      <div className="space-y-4">
        {/* Header with Expand Option */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${disaster.urgencyClass}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
              {disaster.urgency.toUpperCase()}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Update 3m lalu</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenDisasterBrief}
              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center text-xs font-semibold cursor-pointer transition-colors"
              title="Detail Teknis Satgas"
            >
              i
            </button>
            <button
              onClick={onExpandView}
              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs transition-all cursor-pointer"
              title="Perluas Detail Multi-kolom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onMinimize}
              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-xs transition-all cursor-pointer"
              title="Minimize / Sembunyikan Sidebar"
              aria-label="Minimize sidebar"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Active Disaster Quick Card */}
        <div
          className="bg-white dark:bg-slate-900/70 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-orange-300 dark:hover:border-cyan-500/40 transition-colors"
          onClick={onExpandView}
        >
          <div className="flex items-start gap-3 mb-3">
            <div
              className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${getGradientClass()} shadow-md flex items-center justify-center p-2.5 shrink-0`}
            >
              {getCategoryIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                {disaster.name}
              </h3>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {disaster.fullTitleDisplay}
              </p>
            </div>
          </div>

          {/* Financial & Gap mini stats */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block font-medium text-[10px]">Estimasi Dampak</span>
              <strong className="text-slate-900 dark:text-white font-bold text-sm block mt-0.5">
                {disaster.cost}
              </strong>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block truncate">
                {disaster.impact}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block font-medium text-[10px]">Gap Recovery</span>
              <strong className="text-slate-800 dark:text-amber-400 font-bold text-sm block mt-0.5">
                {disaster.gapRecovery}
              </strong>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${disaster.recoveryPct}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Disaster Field Photo */}
          <div className="mt-3 mb-3 relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm group">
            <img
              src={disaster.photoUrl}
              alt={disaster.photoAlt}
              className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 flex items-center justify-between text-white">
              <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                <span>Foto Lapangan Terkini</span>
              </div>
              <span className="text-[9px] text-white/80 font-mono truncate max-w-[170px]">
                {disaster.photoSource}
              </span>
            </div>
          </div>

          {/* Primary Action: Rute Evakuasi / Distribusi */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenRoute) {
                onOpenRoute();
              } else {
                onExpandView();
              }
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Compass className="w-4 h-4 text-orange-400" />
            <span>Rute Evakuasi Mandiri & Logistik</span>
          </button>
        </div>

        {/* Quick Metrics (3 Cards) */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white dark:bg-slate-900/70 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[9px] font-semibold text-slate-400 uppercase block">Titik Panas</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {disaster.stats.hotspots}
            </div>
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded">
              {disaster.stats.hotspotsChange}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900/70 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[9px] font-semibold text-slate-400 uppercase block">Kerugian</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {disaster.stats.loss}
            </div>
            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-1 py-0.5 rounded">
              {disaster.stats.lossChange}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900/70 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[9px] font-semibold text-slate-400 uppercase block">Tim SAR</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {disaster.stats.personnel}
            </div>
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded">
              {disaster.stats.personnelChange}
            </span>
          </div>
        </div>

        {/* Snippet: Laporan Warga Terverifikasi */}
        <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Laporan Warga Terverifikasi
              </h4>
            </div>
            <button
              onClick={() => {
                if (onOpenReports) {
                  onOpenReports();
                } else {
                  onExpandView();
                }
              }}
              className="text-[10px] text-blue-600 dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
            >
              Lihat Semua
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {disaster.reports.slice(0, 2).map((rep) => (
              <div
                key={rep.id}
                className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800"
              >
                <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {rep.tag}
                  </span>
                  <span>{rep.time}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-snug">
                  {rep.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Slim Trigger: Laporkan Bencana / AI Helpdesk */}
      <div className="pt-3">
        <button
          onClick={onOpenAIHelpdesk}
          className="w-full group relative overflow-hidden rounded-2xl p-[2px] shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/35 active:scale-[0.98] transition-all duration-300"
          title="Buka Asisten AI Tanggap Bencana & Pelaporan"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-cyan-500 rounded-2xl animate-pulse"></span>
          <div className="relative flex items-center justify-between px-4 py-3 rounded-[14px] bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white transition-all duration-300 group-hover:bg-opacity-90">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-cyan-400 p-[1.5px] shadow-md flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                  <Headset className="w-4 h-4 text-amber-400" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gradient-to-br from-cyan-300 to-amber-300 rounded-full flex items-center justify-center">
                  <Sparkles className="w-2 h-2 text-slate-950" />
                </div>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black tracking-wide text-white group-hover:text-amber-300 transition-colors">
                    Laporkan Bencana
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                    AI Helpdesk
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 font-medium truncate max-w-[190px]">
                  Bantuan Cepat, Logistik & Edukasi
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>
      </div>
    </aside>
  );
};
