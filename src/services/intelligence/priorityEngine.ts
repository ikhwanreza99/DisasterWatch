// Deterministic priority ranking across disasters. No LLM involved.
import type { DisasterIncident } from '../../types';
import type { AidRecord, IntelligenceReport } from '../../domain/intelligence';
import { estimateImpact } from './impactEngine';
import { summarizeGaps } from './aidGapEngine';

export interface PriorityScore {
  disasterId: string;
  score: number; // 0..100
  reasons: string[];
}

export function scoreDisaster(
  d: DisasterIncident,
  reports: IntelligenceReport[],
  aid: AidRecord[],
): PriorityScore {
  const mine = reports.filter((r) => !r.disasterId || r.disasterId === d.id);
  const impact = estimateImpact(mine);
  const gaps = summarizeGaps(d.id, mine, aid);
  const avgGap = gaps.length > 0 ? gaps.reduce((s, g) => s + g.gapPct, 0) / gaps.length : 0;
  const reasons: string[] = [];

  let score = 0;
  // Urgency status (0..35)
  if (/darurat/i.test(d.urgency)) { score += 35; reasons.push('Status Darurat Tinggi'); }
  else if (/siaga/i.test(d.urgency)) { score += 22; reasons.push('Status Siaga'); }
  else { score += 10; reasons.push('Status Waspada'); }
  // Aid gap (0..30)
  const gapPts = Math.min(30, Math.round((avgGap / 100) * 30));
  score += gapPts;
  if (avgGap > 0) reasons.push(`Rata-rata aid gap ${Math.round(avgGap)}%`);
  // Impact urgency (0..20)
  const impPts = Math.round((impact.urgencyScore / 100) * 20);
  score += impPts;
  if (impact.accessibility === 'isolated') { score += 10; reasons.push('Akses terisolir'); }
  else if (impact.accessibility === 'limited') { score += 5; reasons.push('Akses terbatas'); }
  // Corroboration (0..5)
  if (mine.length >= 3) { score += 5; reasons.push(`${mine.length} laporan pendukung`); }
  else if (mine.length >= 1) { score += 2; reasons.push(`${mine.length} laporan`); }

  return { disasterId: d.id, score: Math.min(100, score), reasons: reasons.slice(0, 4) };
}

export function rankDisasters(
  disasters: Record<string, DisasterIncident>,
  reports: IntelligenceReport[],
  aid: AidRecord[],
): PriorityScore[] {
  return Object.values(disasters)
    .map((d) => scoreDisaster(d, reports, aid))
    .sort((a, b) => b.score - a.score);
}
