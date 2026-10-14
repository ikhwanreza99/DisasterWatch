// End-to-end pipeline: raw report → extraction → validation → persistence.
import type { IntelligenceReport, SourceType, VerificationStatus } from '../../domain/intelligence';
import { newId, nowIso } from '../../domain/intelligence';
import { extractDisasterInfo } from '../ai/disasterExtraction';
import { validateReport } from '../ai/disasterValidation';
import { listRecentReports, saveReport } from '../store/disasterStore';
import { getAuthInstance } from '../../lib/firebase/auth';
import { isFirebaseConfigured } from '../../lib/firebase/config';

export interface SubmitReportInput {
  disasterId?: string;
  sourceType: SourceType;
  sourceName: string;
  rawText: string;
  locationName: string;
  lat?: number;
  lng?: number;
  mediaUrl?: string;
  sourceUrl?: string;
  newsInsight?: string;
  newsCategory?: import('../../types').NewsCategory;
  isMock?: boolean;
}

export interface PipelineResult {
  report: IntelligenceReport;
  engine: 'gemini' | 'heuristic';
  engineNote: string;
  supportingCount: number;
  storeMessage: string;
  storeMode: 'live' | 'mock';
}

export async function submitReportPipeline(input: SubmitReportInput): Promise<PipelineResult> {
  const user = getAuthInstance()?.currentUser;
  if (isFirebaseConfigured() && (!user || !user.providerData.some(provider => provider.providerId === 'google.com'))) throw new Error('Login Google diperlukan sebelum mengirim laporan bencana.');
  const { extraction, engine, note } = await extractDisasterInfo(input.rawText, {
    locationHint: input.locationName,
  });

  const candidate: IntelligenceReport = {
    id: newId('REP'),
    ...(user ? { reporterUid: user.uid } : {}),
    disasterId: input.disasterId,
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    rawText: input.rawText,
    mediaUrl: input.mediaUrl,
    sourceUrl: input.sourceUrl,
    newsInsight: input.newsInsight,
    newsCategory: input.newsCategory,
    location: { name: input.locationName, lat: input.lat, lng: input.lng },
    createdAt: nowIso(),
    verificationStatus: 'AI_REVIEWED' as VerificationStatus,
    aiConfidence: extraction.confidence,
    extractedData: extraction,
    isMock: user ? false : input.isMock ?? true,
  };

  const existing = await listRecentReports(input.disasterId, 50);
  const validation = validateReport(candidate, existing);
  candidate.verificationStatus = validation.status;
  candidate.aiConfidence = validation.aiConfidence;
  if (validation.conflictNotes) {
    candidate.extractedData = { ...extraction, conflictNotes: validation.conflictNotes };
  }

  const store = await saveReport(candidate);
  return {
    report: candidate,
    engine,
    engineNote: note,
    supportingCount: validation.supportingCount,
    storeMessage: store.message,
    storeMode: store.mode,
  };
}
