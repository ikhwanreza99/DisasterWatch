import type { DisasterIncident } from '../types';
import { useIncidentNarratives } from './useIncidentNarratives';
import { aggregateAidProgress } from './narrativeAidProgress';
import { HAZARD_NEEDS } from './insights/formulas';

export function useAidRecovery(incident: DisasterIncident) {
 const facts = useIncidentNarratives(incident.id);
 const baseline = [...(incident.category === 'flood' ? ['drainage'] : []), ...(HAZARD_NEEDS[incident.category] ?? ['clean_water','food','medicine','shelter'])];
 const summary = aggregateAidProgress(facts, baseline);
 if (summary.pct === null) return incident;
 const water = summary.waterPct === null ? [] : [{ type: 'water' as const, recovery: Number(summary.waterPct.toFixed(1)), status: 'Dalam Pemulihan' as const }];
 return { ...incident, gapRecovery: `${summary.pct.toFixed(1)}% terpenuhi · estimasi bantuan (${summary.populated}/${summary.total} kategori)`, recoveryPct: summary.pct,
  recoveryServices: [...incident.recoveryServices.filter(s => s.type !== 'water' || !water.length), ...water] };
}
