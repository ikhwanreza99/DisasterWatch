// Deterministic validation: duplicate/conflict detection + verification transitions.
import type { IntelligenceReport, VerificationStatus } from '../../domain/intelligence';

export interface ValidationOutcome {
  status: VerificationStatus;
  aiConfidence: number;
  supportingCount: number;
  conflictNotes?: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s: string): Set<string> {
  return new Set(norm(s).split(' ').filter((w) => w.length > 3));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((w) => { if (b.has(w)) inter += 1; });
  return inter / (a.size + b.size - inter);
}

/** Find reports likely about the same place/event. Pure local heuristic for prototype. */
export function findSupportingReports(candidate: IntelligenceReport, existing: IntelligenceReport[]): IntelligenceReport[] {
  const candTokens = tokens(`${candidate.location.name} ${candidate.rawText}`);
  return existing.filter((r) => {
    if (r.id === candidate.id) return false;
    if (candidate.disasterId && r.disasterId && candidate.disasterId !== r.disasterId) return false;
    const samePlace = norm(r.location.name) === norm(candidate.location.name);
    const sim = jaccard(candTokens, tokens(`${r.location.name} ${r.rawText}`));
    return samePlace || sim > 0.35;
  });
}

/** Detect conflicting urgency/type claims between candidate and supporters. */
export function detectConflicts(candidate: IntelligenceReport, supporters: IntelligenceReport[]): string | undefined {
  const urg = new Set(supporters.map((s) => s.extractedData?.urgency).filter(Boolean));
  if (candidate.extractedData?.urgency) urg.add(candidate.extractedData.urgency);
  const types = new Set(supporters.map((s) => s.extractedData?.disasterType).filter(Boolean));
  if (candidate.extractedData?.disasterType) types.add(candidate.extractedData.disasterType);
  const notes: string[] = [];
  if (urg.has('critical') && urg.has('low')) notes.push('Klaim urgensi bertentangan (critical vs low).');
  if (types.size > 1) notes.push(`Klasifikasi bencana berbeda: ${[...types].join(', ')}.`);
  return notes.length > 0 ? notes.join(' ') : undefined;
}

export function validateReport(candidate: IntelligenceReport, existing: IntelligenceReport[]): ValidationOutcome {
  const supporters = findSupportingReports(candidate, existing);
  const conflictNotes = detectConflicts(candidate, supporters);
  const base = candidate.aiConfidence ?? candidate.extractedData?.confidence ?? 0.5;
  // Slight boost with corroboration, capped — deterministic, explainable.
  const boosted = Math.min(0.97, base + Math.min(0.15, supporters.length * 0.05));
  let status: VerificationStatus = 'AI_REVIEWED';
  if (conflictNotes) status = 'CONFLICTING';
  else if (supporters.length >= 2 && boosted >= 0.75) status = 'VERIFIED';
  else if (supporters.length === 0 && boosted < 0.4) status = 'UNVERIFIED';
  return { status, aiConfidence: Math.round(boosted * 100) / 100, supportingCount: supporters.length, conflictNotes };
}
