// Expanded detail — thin wrapper over the shared DisasterDetailView template.
// Visual output is unchanged; data comes from the per-incident adapter.
import React, { useMemo } from 'react';
import { DisasterIncident } from '../types';
import type { AidRecord, IntelligenceReport } from '../domain/intelligence';
import { DisasterDetailView } from './detail/DisasterDetailView';
import { buildIncidentDetail } from '../services/incidentDetailAdapter';
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
  onOpenNttIntelligence,
}) => {
  void onOpenAIHelpdesk;
  const { detail, timeline } = useMemo(
    () => buildIncidentDetail(disaster, nttCase),
    [disaster, nttCase],
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
          ? { label: 'Buka Intelijen NTT (10 berita, 11 klaim)', onClick: onOpenNttIntelligence }
          : undefined
      }
    />
  );
};
