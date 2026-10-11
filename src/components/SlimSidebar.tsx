import { useMemo } from 'react';
import { useMobileLayout } from './useMobileLayout';
import { buildIncidentDetail } from '../services/incidentDetailAdapter';
import { useIncidentPool } from '../services/incidentPool';
import { filterIncidentNews, reviewQueue } from '../services/incidentNews';
import { IncidentNewsPanel } from './detail/IncidentNewsPanel';
import { MobileSheetHandle } from './MobileSheetHandle';
import React from 'react';
import {
  Compass,
  MessageCircle,
  Flame,
  Waves,
  Activity,
  PanelRightClose,
} from 'lucide-react';
import { DisasterIncident } from '../types';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import type { NttCaseState } from '../services/nttCaseStore';
import { ExpandedDetailContent } from './ExpandedDetailContent';
import { WeatherCard } from './WeatherCard';


interface SlimSidebarProps {
  disaster: DisasterIncident;
  isExpanded: boolean;

  onExpandView: () => void;
  onCollapseView: () => void;

  onOpenAIHelpdesk: () => void;
  onOpenDonationModal: () => void;
  onOpenDisasterBrief: () => void;

  onMinimize: () => void;
  onOpenRoute: () => void;
  onOpenReports?: () => void;
  intelReports?: IntelligenceReport[];
  aidRecords?: AidRecord[];
  nttCase?: NttCaseState | null;
  onOpenNttIntelligence?: () => void;
}

export const SlimSidebar: React.FC<SlimSidebarProps> = ({
  disaster,
  isExpanded,
  onExpandView,
  onCollapseView,
  onOpenAIHelpdesk,
  onOpenDonationModal,
  onOpenDisasterBrief,
  onMinimize,
  onOpenRoute,
  onOpenReports,
  intelReports,
  aidRecords,
  nttCase,
  onOpenNttIntelligence,
}) => {
  const mobile = useMobileLayout();
  const pool = useIncidentPool();
  // Mini card news: incident-filtered (MATCHED only), never the generic national feed.
  const miniNews = useMemo(() => {
    const { detail } = buildIncidentDetail(disaster, nttCase ?? null, pool);
    return {
      matched: filterIncidentNews(detail.articles, detail.incidentId),
      review: reviewQueue(detail.articles, detail.incidentId),
      crawl: detail.crawl,
    };
  }, [disaster, nttCase, pool]);
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
      id="slimHomepageSidebar" data-full-detail={isExpanded && !mobile}
      className={`
        mobile-sheet absolute top-0 right-0 z-30
        h-full
        pointer-events-auto

        transition-[width,background-color,backdrop-filter]
        duration-500
        ease-[cubic-bezier(0.22,1,0.36,1)]

        ${
          isExpanded
            ? `
              w-full sm:w-[calc(100%_-_24px)]
              p-6
              overflow-hidden

              bg-slate-900/55
              backdrop-blur-xl
              backdrop-saturate-150
            `
            : `
              w-full sm:w-[390px]
              sm:max-w-[92vw]

              px-6 py-5

              flex flex-col
              justify-between

              overflow-y-auto

              bg-white/72
              backdrop-blur-xl
              backdrop-saturate-200

              border-l border-white/50
              shadow-[-12px_0_40px_rgba(15,23,42,0.10)]
            `
        }
      `}
    >
      {mobile && <MobileSheetHandle initiallyExpanded />}
      {(isExpanded || mobile) ? (
        <ExpandedDetailContent
          disaster={disaster}
          mobile={mobile}
          onOpenRoute={onOpenRoute}
          onClose={mobile ? onMinimize : onCollapseView}
          onOpenAIHelpdesk={onOpenAIHelpdesk}
          onOpenDonationModal={onOpenDonationModal}
          onOpenDisasterBrief={onOpenDisasterBrief}
          intelReports={intelReports}
          aidRecords={aidRecords}
          nttCase={nttCase}
          pool={pool}
          onOpenNttIntelligence={onOpenNttIntelligence}
        />
      ) : (
        <>
      <div className="space-y-4">
        {/* Header with Expand Option */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${disaster.urgencyClass}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              {disaster.urgency.toUpperCase()}
            </span>

            <span className="text-[11px] text-slate-400">
              Update 3m lalu
            </span>
          </div>

          <button
            onClick={onMinimize}
            className="
              w-8 h-8
              rounded-full
              flex items-center justify-center
              text-slate-400
              hover:text-slate-700
              hover:bg-slate-100
              transition-colors
            "
            aria-label="Minimize sidebar"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      


        {/* Active Disaster Quick Card */}
        <div
          className="
            rounded-[20px]
            border border-slate-200
            bg-white
            p-4
          "
          onClick={onExpandView}
        >
          <div className="flex items-start gap-4 border-b border-slate-100 pb-2">
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${getGradientClass()} shadow-md flex items-center justify-center shrink-0`}
            >
              {getCategoryIcon()}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] font-bold text-slate-900 leading-tight">
                {disaster.fullTitleDisplay}
              </h3>

              <p className="mt-1 text-[13px] font-medium text-slate-500">
                {disaster.name}
              </p>
            </div>
          </div>

          {/* Financial & Gap mini stats */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            {/* Estimasi Dampak */}
            <div
              className="
                rounded-2xl
                bg-slate-50
                border border-slate-100
                px-4 py-4
              "
            >
              <p className="text-[11px] font-medium text-slate-400">
                Estimasi Dampak
              </p>

              <p className="mt-1 text-[18px] font-bold text-slate-900">
                {disaster.cost}
              </p>

              <p className="mt-2 text-[11px] font-medium text-slate-400">
                {disaster.impact}
              </p>
            </div>

            {/* Gap Recovery */}
            <div
              className="
                rounded-2xl
                bg-slate-50
                border border-slate-100
                px-4 py-4
              "
            >
              <p className="text-[11px] font-medium text-slate-400">
                Gap Recovery
              </p>

              <p className="mt-1 text-[18px] font-bold text-slate-900">
                {disaster.gapRecovery}
              </p>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{
                    width: `${disaster.recoveryPct}%`,
                  }}
                />
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

          {/* Disaster details and available evacuation posts */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpandView();
              }}
              className="min-w-0 py-2.5 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            >
              <span>Detail Bencana</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenRoute?.();
              }}
              className="min-w-0 py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            >
              <Compass className="w-4 h-4 shrink-0 text-orange-400" aria-hidden="true" />
              <span>Posko Evakuasi</span>
            </button>
          </div>
        </div>


        {/*Metrics 4 Kebutuhan Primer Utilitas
        <div
          className="
            rounded-[20px]
            border border-slate-200
            bg-white
            p-4
          "
          onClick={onExpandView}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-slate-100">
            <h4 className="mt-2 text-[12px] font-bold text-slate-900">
                Kebutuhan Primer Utilitas
              </h4>
          </div>

          {/* Financial & Gap mini stats 
          <div className="grid grid-cols-2 gap-3">
            
            
            {/* Listrik 
            <div
              className="
                rounded-2xl
                bg-slate-50
                border border-slate-100
                px-4 py-4
              "
            >
            <div className="flex items-center left gap-1.5 mb-1">
              <Zap className="w-4 h-4 text-slate-950" />
              <p className="text-[11px] font-medium text-slate-600">
                Listrik
              </p>
            </div>
              <p className="mt-1 text-[18px] font-bold text-slate-900">
                {disaster.cost}
              </p>

              <p className="mt-2 text-[11px] font-medium text-slate-400">
                {disaster.impact}
              </p>
            </div>


            {/* Air & Sanitasi *
            <div
              className="
                rounded-2xl
                bg-slate-50
                border border-slate-100
                px-4 py-4
              "
            >
            <div className="flex items-center left gap-1.5 mb-1">
              <Droplets className="w-4 h-4 text-slate-950" />
              <p className="text-[11px] font-medium text-slate-600">
                Air & Sanitasi
              </p>
            </div>
              <p className="mt-1 text-[18px] font-bold text-slate-900">
                {disaster.cost}
              </p>

              <p className="mt-2 text-[11px] font-medium text-slate-400">
                {disaster.impact}
              </p>
            </div>


            {/* Telekomunikasi *
            <div
              className="
                rounded-2xl
                bg-slate-50
                border border-slate-100
                px-4 py-4
              "
            >
            <div className="flex items-center left gap-1.5 mb-1">
              <RadioTower className="w-4 h-4 text-slate-950" />
              <p className="text-[11px] font-medium text-slate-600">
                Telekomunikasi
              </p>
            </div>
              <p className="mt-1 text-[18px] font-bold text-slate-900">
                {disaster.cost}
              </p>

              <p className="mt-2 text-[11px] font-medium text-slate-400">
                {disaster.impact}
              </p>
            </div>

            {/* Akses Jalan *
            <div
              className="
                rounded-2xl
                bg-slate-50
                border border-slate-100
                px-4 py-4
              "
            >
            <div className="flex items-center left gap-1.5 mb-1">
              <Lightbulb className="w-4 h-4 text-slate-950" />
              <p className="text-[11px] font-medium text-slate-600">
                Akses Jalan
              </p>
            </div>
              <p className="mt-1 text-[18px] font-bold text-slate-900">
                {disaster.cost}
              </p>

              <p className="mt-2 text-[11px] font-medium text-slate-400">
                {disaster.impact}
              </p>
            </div>
          </div>        
        </div>*/}

        <IncidentNewsPanel
          compact
          incidentName={disaster.name}
          matched={miniNews.matched}
          review={miniNews.review}
          freshness={{ lastAttemptAt: miniNews.crawl.lastAttemptAt, lastSuccessAt: miniNews.crawl.lastSuccessAt, error: miniNews.crawl.error }}
        />

        {/* Cuaca lapangan (Google Weather) — below Update Berita Terkini */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-4" data-purpose="mini-weather">
          <h4 className="text-[14px] font-bold text-slate-900 mb-3">Cuaca Lapangan</h4>
          <WeatherCard
            lat={disaster.coords.lat}
            lng={disaster.coords.lng}
            locationName={disaster.name}
            disasterCategory={disaster.category}
          />
        </div>

      </div>
        

      <div className="pt-3">
        <button
          type="button"
          onClick={onOpenAIHelpdesk}
          className="flex w-full shrink-0 items-center justify-center gap-1.5 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500 hover:brightness-110 text-white rounded-full text-xs font-bold shadow-md shadow-violet-500/25 transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          <span>Tanya DisasterAI</span>
        </button>
      </div>
      </>
    )}
    </aside>
  );
};
