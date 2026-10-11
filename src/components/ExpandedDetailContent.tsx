// Expanded detail — thin wrapper over the shared DisasterDetailView template.
// Visual output is unchanged; data comes from the per-incident adapter.
import React, { useMemo } from 'react';
import { DisasterIncident } from '../types';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import { DisasterDetailView } from './detail/DisasterDetailView';
import { buildIncidentDetail } from '../services/incidentDetailAdapter';
import { useHumanitarian } from '../services/store/humanitarianRepo';
import type { IncidentArticle } from '../domain/incidentDetail';
import { NTT_CASE_ID } from '../domain/nttCase';
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
  void onOpenAIHelpdesk;
  // Firestore-first humanitarian snapshot (explicit fallback when null).
  const remote = useHumanitarian(disaster.id);
  const { detail, timeline } = useMemo(
    () => buildIncidentDetail(disaster, nttCase, pool, remote),
    [disaster, nttCase, pool, remote],
  );
  return (
    <DisasterDetailView
      mobile={mobile}
      disaster={disaster}
      detail={detail}
      timeline={timeline}
      onOpenRoute={onOpenRoute}
      onClose={onClose}
      onOpenDonationModal={onOpenDonationModal}
      onOpenDisasterBrief={onOpenDisasterBrief}
      intelReports={intelReports}
      aidRecords={aidRecords}
      extraAction={
        disaster.id === NTT_CASE_ID && onOpenNttIntelligence
          ? {
              label: `Analisis Klaim & Sumber NTT (${nttCase?.articles.length ?? 0} berita, ${nttCase?.claims.length ?? 0} klaim)`,
              onClick: onOpenNttIntelligence,
            }
          : undefined
      }
    />
  );
};
