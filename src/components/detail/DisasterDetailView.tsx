// DisasterDetailView: THE shared disaster-detail template for every incident.
// Same header hierarchy, cards, panels, and states — data comes from the adapter,
// never from hardcoded per-city UI.
import React from 'react';
import { X, HeartHandshake } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { DisasterIncident } from '../../types';
import type { AidRecord, IntelligenceReport } from '../../domain/intelligence';
import { AidGapCard } from '../AidGapCard';
import { IncidentOverviewCard } from './IncidentOverviewCard';
import { RecoveryStatusCards } from './RecoveryStatusCards';
import { IncidentNewsPanel } from './IncidentNewsPanel';
import { AidAndPoskoPanel } from './AidAndPoskoPanel';
import { IncidentOfficialParams } from './IncidentOfficialParams';
import { IncidentClaimsPanel } from './IncidentClaimsPanel';
import { IncidentTimeline, type DetailTimelineEvent } from './IncidentTimeline';
import type { IncidentDetailData } from '../../domain/incidentDetail';
import { filterIncidentNews, reviewQueue } from '../../services/incidentNews';

interface Props {
  mobile?: boolean;
  disaster: DisasterIncident;
  detail: IncidentDetailData;
  timeline: DetailTimelineEvent[];
  onOpenRoute: () => void;
  onClose: () => void;
  onOpenDonationModal: () => void;
  onOpenDisasterBrief: () => void;
  intelReports?: IntelligenceReport[];
  aidRecords?: AidRecord[];
  /** Optional extra action (e.g. NTT deep-dive intelligence). Rendered in existing button style. */
  extraAction?: { label: string; onClick: () => void };
}

export const DisasterDetailView: React.FC<Props> = ({
  disaster,
  detail,
  timeline,
  mobile = false,
  onOpenRoute,
  onClose,
  onOpenDonationModal,
  onOpenDisasterBrief,
  intelReports = [],
  aidRecords = [],
  extraAction,
}) => {
  const { t } = useI18n();
  const matched = filterIncidentNews(detail.articles, detail.incidentId);
  const review = reviewQueue(detail.articles, detail.incidentId);
  return (
    <div className="h-full min-h-0 flex-1 flex flex-col" data-detail-template={detail.incidentId} data-testid="disaster-detail">
      <div className="relative z-50 flex shrink-0 items-center justify-between gap-2 mb-3 px-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-ping"></span>
          <span className={`text-xs font-bold uppercase tracking-wider ${mobile ? 'text-slate-800' : 'text-white'}`}>
            {mobile ? t('Detail Situasi Wilayah') : t('Detail Situasi Wilayah & Jalur Logistik Terbuka')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="group flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-800 shadow-xl border border-slate-200 transition-all active:scale-95 text-xs font-bold cursor-pointer"
          title={t('Tutup & Kembali ke Homepage Peta')}
        >
          <span>{t('Tutup')}</span>
          <X className="w-4 h-4 text-slate-500 group-hover:text-rose-600 transition-transform group-hover:rotate-90 duration-200" />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 w-full items-stretch flex-1 min-h-0 overflow-y-auto xl:overflow-hidden xl:h-full pr-1">
        <div className="xl:col-span-6 space-y-4 min-w-0 xl:overflow-y-auto xl:h-full pb-4">
          <IncidentOverviewCard disaster={disaster} detail={detail} onOpenRoute={onOpenRoute} onOpenBrief={onOpenDisasterBrief} />
          <IncidentOfficialParams params={detail.officialParams} />
          <RecoveryStatusCards services={disaster.recoveryServices} />
          {extraAction && (
            <button
              type="button"
              onClick={extraAction.onClick}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all active:scale-[0.98]"
            >
              {extraAction.label}
            </button>
          )}
          <article className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80" data-purpose="detail-aid-gap">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <HeartHandshake className="w-4 h-4" aria-hidden="true" />
              </div>
              <h4 className="text-[14px] font-bold text-slate-900">{t('Kesenjangan Bantuan')}</h4>
            </div>
            <AidGapCard hazard={disaster.category} disasterId={disaster.id} reports={intelReports} aid={aidRecords} />
            <button
              type="button"
              onClick={onOpenDonationModal}
              className="mt-4 w-full py-3 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4 text-white" />
              <span>{t('Salurkan Bantuan / Donasi')}</span>
            </button>
          </article>
          <IncidentTimeline events={timeline} />
        </div>

        <div className="xl:col-span-6 min-w-0 flex flex-col gap-4 xl:h-full min-h-0 xl:overflow-y-auto pr-1 pb-4">
          <IncidentNewsPanel
            incidentName={disaster.name}
            matched={matched}
            review={review}
            freshness={{ lastAttemptAt: detail.crawl.lastAttemptAt, lastSuccessAt: detail.crawl.lastSuccessAt, error: detail.crawl.error }}
          />
          <AidAndPoskoPanel aid={detail.aidEvents} posko={detail.posko} />
          <IncidentClaimsPanel claims={detail.claims} />
        </div>
      </div>
    </div>
  );
};

// Re-exported so callers migrate to the shared template without hunting imports.
export { IncidentOverviewCard, RecoveryStatusCards, IncidentNewsPanel, AidAndPoskoPanel, IncidentTimeline, IncidentOfficialParams, IncidentClaimsPanel };
export type { DetailTimelineEvent };
