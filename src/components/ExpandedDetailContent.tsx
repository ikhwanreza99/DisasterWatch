// Expanded detail — thin wrapper over the shared DisasterDetailView template.
// Visual output is unchanged; data comes from the per-incident adapter.
import React, { useMemo } from 'react';
import { DisasterIncident } from '../types';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import { SidebarDetailTemplate } from './SidebarDetailTemplate';
import { IncidentNewsPanel } from './detail/IncidentNewsPanel';
import { filterIncidentNews, reviewQueue } from '../services/incidentNews';
import { buildIncidentDetail } from '../services/incidentDetailAdapter';
import { useHumanitarian } from '../services/store/humanitarianRepo';
import type { IncidentArticle } from '../domain/incidentDetail';
import type { NttCaseState } from '../services/nttCaseStore';

interface ExpandedDetailContentProps {
  mobile?: boolean;
  onOpenRoute: () => void;
  disaster: DisasterIncident;
  onClose: () => void;
  onOpenAIHelpdesk: () => void;
  onOpenDonationModal: () => void;
  onOpenDisasterBrief: () => void;
  intelReports?: IntelligenceReport[];
  aidRecords?: AidRecord[];
  nttCase?: NttCaseState | null;
pool?: IncidentArticle[];
  onOpenNttIntelligence?: () => void;
}
 
export const ExpandedDetailContent: React.FC<ExpandedDetailContentProps> = ({
  disaster,
  mobile = false,
  onOpenRoute,
  onClose,
  onOpenAIHelpdesk,
  onOpenDonationModal,
  onOpenDisasterBrief,
  intelReports = [],
  aidRecords = [],
  nttCase = null,
  pool = [],
  onOpenNttIntelligence,
}) => {
  // Firestore-first humanitarian snapshot (explicit fallback when null).
  const remote = useHumanitarian(disaster.id);
  const { detail } = useMemo(
    () => buildIncidentDetail(disaster, nttCase, pool, remote),
    [disaster, nttCase, pool, remote],
  );
  return (
    <SidebarDetailTemplate
      mobile={mobile}
      disaster={disaster}
      onOpenRoute={onOpenRoute}
      onClose={onClose}
      onOpenAIHelpdesk={onOpenAIHelpdesk}
      onOpenDonationModal={onOpenDonationModal}
      onOpenDisasterBrief={onOpenDisasterBrief}
      intelReports={intelReports}
      aidRecords={aidRecords}
      news={<IncidentNewsPanel
        incidentName={disaster.name}
        onOpenAIHelpdesk={onOpenAIHelpdesk}
        matched={filterIncidentNews(detail.articles, detail.incidentId)}
        review={reviewQueue(detail.articles, detail.incidentId)}
        freshness={{ lastAttemptAt: detail.crawl.lastAttemptAt, lastSuccessAt: detail.crawl.lastSuccessAt, error: detail.crawl.error }}
      />}
    />
  );
};
