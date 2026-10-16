import type { NarrativeFact } from '../articleNarrative';
import { MAX_CANDIDATES } from './evacuationCandidates';
/** Planning allocation only: never becomes measured occupancy or venue capacity. */
export function postAllocation(facts: NarrativeFact[]) {
 const populations=facts.filter(f=>f.kind==='IMPACT' && /^(jiwa|orang|warga)$/i.test(f.unit.trim()) && Number.isFinite(f.quantity) && f.quantity>0);
 if(!populations.length)return null;
 const population=Math.max(...populations.map(f=>f.quantity));
 return {population,postCount:MAX_CANDIDATES,perPost:Math.round(population/MAX_CANDIDATES),sources:populations.filter(f=>f.quantity===population)};
}
