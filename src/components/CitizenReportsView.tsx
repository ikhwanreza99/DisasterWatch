import { MobileSheetHandle } from './MobileSheetHandle';
import React, { useState } from 'react';
import {
  X,
  Camera,
  CheckCircle2,
  Clock,
  User,
  PlusCircle,
  Filter,
  Share2,
  Compass,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { DisasterIncident } from '../types';
import { useI18n } from '../i18n';
import { incidentText } from '../i18n/incidentText';

interface CitizenReportsViewProps {
  disaster: DisasterIncident;
  onClose: () => void;
  onOpenReportModal: () => void;
  onViewDisasterDetail?: () => void;
  onViewRoute?: () => void;
  isDarkMode?: boolean;
}

type ReportFilter = 'all' | 'verified' | 'logistics' | 'access';

export const CitizenReportsView: React.FC<CitizenReportsViewProps> = ({
  disaster,
  onClose,
  onOpenReportModal,
  onViewDisasterDetail,
  onViewRoute,
  isDarkMode = false,
}) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<ReportFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredReports = disaster.reports.filter((rep) => {
    if (filter === 'verified') return rep.tag.toLowerCase().includes('terverifikasi');
    if (filter === 'logistics') return rep.tag.toLowerCase().includes('logistik') || rep.desc.toLowerCase().includes('masker') || rep.desc.toLowerCase().includes('air');
    if (filter === 'access') return rep.tag.toLowerCase().includes('akses') || rep.desc.toLowerCase().includes('jalan') || rep.desc.toLowerCase().includes('jalur');
    return true;
  });

  const handleShareReport = (rep: any) => {
    const text = t('[LAPORAN WARGA TERVERIFIKASI - {name}]\nLokasi: {location}\nJudul: {title}\nInfo: {desc}\nStatus: {tag} ({time})', {
      name: disaster.name,
      location: rep.location,
      title: rep.title,
      desc: rep.desc,
      tag: rep.tag,
      time: rep.time,
    });
    if (navigator.share) {
      navigator.share({ title: rep.title, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopiedId(rep.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <aside
      className="mobile-sheet absolute top-0 right-0 z-30 h-full w-full sm:w-[490px] sm:max-w-[95vw] p-4 sm:p-5 flex flex-col justify-between overflow-y-auto pointer-events-auto transition-all duration-300 ease-in-out bg-white/98 dark:bg-[#0b1329]/98 backdrop-blur-xl border-l border-slate-200/90 dark:border-slate-800/80 shadow-2xl animate-fadeIn"
      id="citizenReportsStandaloneView"
    >
      <MobileSheetHandle />
      <div className="space-y-4">
        {/* Header with Title and Single-Window Close Button */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {t('Laporan Warga Terverifikasi')}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {t('{name} • Divalidasi Posko TRC & BPBD', { name: disaster.name })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-600/30 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {t('{count} Laporan Aktif', { count: disaster.reports.length })}
            </span>

            {/* Standalone Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
              title={t('Tutup & Kembali ke Peta')}
              aria-label={t('Tutup Halaman Laporan Warga')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Bar: Buat Laporan & Filter Pills */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onOpenReportModal}
            className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('Kirim Laporan Kejadian Lapangan Baru')}</span>
          </button>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                filter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-600 dark:border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {t('Semua ({count})', { count: disaster.reports.length })}
            </button>
            <button
              onClick={() => setFilter('verified')}
              className={`px-3 py-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                filter === 'verified'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-600 dark:border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {t('Validasi TRC')}
            </button>
            <button
              onClick={() => setFilter('logistics')}
              className={`px-3 py-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                filter === 'logistics'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-600 dark:border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {t('Logistik')}
            </button>
            <button
              onClick={() => setFilter('access')}
              className={`px-3 py-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                filter === 'access'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-600 dark:border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {t('Jalur & Akses')}
            </button>
          </div>
        </div>

        {/* Reports Feed List */}
        <div className="space-y-3">
          {filteredReports.length === 0 ? (
            <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
              {t('Tidak ada laporan pada kategori ini.')}
            </div>
          ) : (
            filteredReports.map((rep) => (
              <article
                key={rep.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2"
              >
                {/* Top Row: Location, Time & Tag */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                      {rep.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      📍 {rep.location}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${rep.tagClass}`}
                  >
                    {t(rep.tag)}
                  </span>
                </div>

                {/* Description Body */}
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  {rep.desc}
                </p>

                {/* Footer Metadata & Share Action */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {incidentText(rep.time)}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                      {incidentText(rep.author)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleShareReport(rep)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    title={t('Bagikan / Salin Laporan')}
                  >
                    <Share2 className="w-3 h-3" />
                    <span>{copiedId === rep.id ? t('Tersalin!') : t('Bagikan')}</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {/* Bottom Switcher Actions */}
      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        {onViewDisasterDetail && (
          <button
            onClick={onViewDisasterDetail}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-orange-500" />
            <span>{t('Detail Bencana')}</span>
          </button>
        )}
        {onViewRoute && (
          <button
            onClick={onViewRoute}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-blue-500" />
            <span>{t('Rute Distribusi')}</span>
          </button>
        )}
      </div>
    </aside>
  );
};
