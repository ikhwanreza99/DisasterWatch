// Deterministic aid-gap math. NEVER ask Gemini to do this arithmetic.
import type { AidRecord, IntelligenceReport } from '../../domain/intelligence';

export interface AidGap {
  category: string;
  estimated: number;
  received: number;
  unit: string;
  gap: number;
  gapPct: number;
}

/** Pure function — unit-testable. */
export function calculateAidGap(estimatedNeed: number, aidReceived: number): { gap: number; gapPct: number } {
  const est = Math.max(0, estimatedNeed || 0);
  const rec = Math.max(0, aidReceived || 0);
  const gap = Math.max(0, est - rec);
  const gapPct = est > 0 ? Math.round((gap / est) * 1000) / 10 : 0;
  return { gap, gapPct };
}

const DEFAULT_UNITS: Record<string, string> = {
  clean_water: 'L',
  food: 'paket',
  medicine: 'paket',
  shelter: 'unit',
  mask: 'pcs',
  boat: 'unit',
  genset: 'unit',
  clothing: 'paket',
};

/**
 * Estimate needs from intelligence reports (deterministic heuristics):
 * - affectedPopulation × standard per-capita (water 15L, food 3 paket, medicine 0.2, shelter 0.25)
 * - explicit quantities in extracted needs override proportionally when present
 */
export function estimateNeedsFromReports(reports: IntelligenceReport[]): Array<{ category: string; estimated: number; unit: string }> {
  let pop = 0;
  let households = 0;
  const explicit = new Map<string, { qty: number; unit: string }>();
  for (const r of reports) {
    const e = r.extractedData;
    if (!e) continue;
    if (e.affectedPopulation) pop = Math.max(pop, e.affectedPopulation);
    if (e.affectedHouseholds) households = Math.max(households, e.affectedHouseholds);
    for (const n of e.needs) {
      if (typeof n.quantity === 'number' && n.quantity > 0) {
        const prev = explicit.get(n.category);
        explicit.set(n.category, { qty: Math.max(prev?.qty ?? 0, n.quantity), unit: n.unit ?? DEFAULT_UNITS[n.category] ?? 'unit' });
      }
    }
  }
  const base = pop > 0 ? pop : households > 0 ? households * 4 : 0;
  const out = new Map<string, { estimated: number; unit: string }>();
  if (base > 0) {
    out.set('clean_water', { estimated: base * 15, unit: 'L' });
    out.set('food', { estimated: base * 3, unit: 'paket' });
    out.set('medicine', { estimated: Math.ceil(base * 0.2), unit: 'paket' });
    out.set('shelter', { estimated: Math.ceil(base / 4), unit: 'unit' });
  }
  explicit.forEach((v, k) => out.set(k, { estimated: v.qty, unit: v.unit }));
  return [...out.entries()].map(([category, v]) => ({ category, ...v }));
}

export function sumReceived(aid: AidRecord[], category: string): { qty: number; unit: string } {
  const rows = aid.filter((a) => a.needCategory === category);
  const qty = rows.reduce((s, a) => s + (a.quantity || 0), 0);
  return { qty, unit: rows[0]?.unit ?? DEFAULT_UNITS[category] ?? 'unit' };
}

/** Full gap table for one disaster. Deterministic. */
export function summarizeGaps(
  _disasterId: string,
  reports: IntelligenceReport[],
  aid: AidRecord[],
  disasterAid?: AidRecord[],
): AidGap[] {
  const estimates = estimateNeedsFromReports(reports);
  const pool = [...aid, ...(disasterAid ?? [])];
  return estimates.map((e) => {
    const rec = sumReceived(pool, e.category);
    const { gap, gapPct } = calculateAidGap(e.estimated, rec.qty);
    return { category: e.category, estimated: e.estimated, received: rec.qty, unit: e.unit, gap, gapPct };
  });
}
