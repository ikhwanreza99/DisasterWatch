// Deterministic impact estimation from structured extractions.
import type { IntelligenceReport } from '../../domain/intelligence';

export interface ImpactEstimate {
  affectedPopulation: number;
  affectedHouseholds: number;
  infraCount: number;
  infraItems: string[];
  accessibility: 'accessible' | 'limited' | 'isolated';
  urgencyScore: number; // 0..100 deterministic
}

const ISOLATED_RE = /terisolir|tidak bisa dilewati|terputus|jebol|jembatan/i;
const LIMITED_RE = /terendam|longsor|retak|rusak|padam|asap/i;

export function estimateImpact(reports: IntelligenceReport[]): ImpactEstimate {
  let pop = 0;
  let hh = 0;
  const infra = new Set<string>();
  let urgencyHits = 0;
  let total = 0;
  for (const r of reports) {
    const e = r.extractedData;
    if (!e) continue;
    total += 1;
    if (e.affectedPopulation) pop = Math.max(pop, e.affectedPopulation);
    if (e.affectedHouseholds) hh = Math.max(hh, e.affectedHouseholds);
    e.infrastructureDamage.forEach((s) => infra.add(s));
    if (e.urgency === 'critical') urgencyHits += 3;
    else if (e.urgency === 'high') urgencyHits += 2;
    else if (e.urgency === 'medium') urgencyHits += 1;
  }
  const blob = [...infra].join(' ');
  const accessibility = ISOLATED_RE.test(blob) ? 'isolated' : LIMITED_RE.test(blob) ? 'limited' : 'accessible';
  const urgencyScore = total === 0 ? 0 : Math.min(100, Math.round((urgencyHits / (total * 3)) * 100));
  return { affectedPopulation: pop, affectedHouseholds: hh, infraCount: infra.size, infraItems: [...infra].slice(0, 12), accessibility, urgencyScore };
}
