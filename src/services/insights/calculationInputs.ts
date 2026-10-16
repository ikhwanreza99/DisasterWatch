// Adapter: Firestore/humanitarian docs -> deterministic calculation inputs.
// Firestore is the source of truth; this layer never invents quantities.
// - Nulls preserved (missing never becomes zero).
// - Duplicate doc ids / fact refs counted once.
// - Scope (unit/area/period) must match before any comparison.
// - Distribution EVENTS are never treated as usable stock.
// - Reported/inferred/potential tiers preserved via classifyNeedTier.
import type {
  IncidentAidEventDoc,
  IncidentAidNeedDoc,
  IncidentClaimDoc,
  IncidentRecoveryDoc,
} from '../../domain/humanitarian';
import { classifyNeedTier } from './formulas';

export interface LiveInputAvailability {
  incidentId:string;
  needsDocs:number;
  needsWithQuantities:number;
  recoveryDocs:number;
  recoveryWithCounts:number;
  claimsDocs:number;
  aidEventDocs:number;
  tiers:{confirmed:number;inferred:number;potential:number};
  notice:string;
  /** Why a live calculation is still withheld (missing-input reasons). */
  blockers:string[];
  /** Evidence refs available for tracing (doc ids + source urls). */
  evidenceRefs:string[];
}

function dedup<T>(items:T[],key:(t:T)=>string):T[]{
  const seen=new Set<string>();const out:T[]=[];
  for(const it of items){const k=key(it);if(seen.has(k))continue;seen.add(k);out.push(it);}
  return out;
}

/** Summarise what Firestore currently offers for one incident — no arithmetic here. */
export function summariseLiveInputs(incidentId:string,args:{
  needs:IncidentAidNeedDoc[];recovery:IncidentRecoveryDoc[];
  claims:IncidentClaimDoc[];aidEvents:IncidentAidEventDoc[];
}):LiveInputAvailability{
  const needs=dedup(args.needs.filter(n=>n.incidentId===incidentId&&n.id),n=>n.id);
  const recovery=dedup(args.recovery.filter(r=>r.incidentId===incidentId&&r.id),r=>r.id);
  const claims=dedup(args.claims.filter(c=>c.incidentId===incidentId&&c.id),c=>c.id);
  const aidEvents=dedup(args.aidEvents.filter(e=>e.incidentId===incidentId&&e.id),e=>e.id);
  let confirmed=0,inferred=0,potential=0;
  for(const n of needs){
    const t=classifyNeedTier(n.status,n.verificationStatus);
    if(t==='confirmed')confirmed++;else if(t==='inferred')inferred++;else potential++;
  }
  const needsWithQuantities=needs.filter(n=>typeof n.quantityNeeded==='number'&&Number.isFinite(n.quantityNeeded)&&n.unit).length;
  const recoveryWithCounts=recovery.filter(r=>typeof r.affectedCount==='number'&&Number.isFinite(r.affectedCount)&&r.unit).length;
  const blockers:string[]=[];
  if(needs.length===0)blockers.push('no needs docs for this incident');
  else if(needsWithQuantities===0)blockers.push('needs docs exist but carry no quantified demand (quantityNeeded/unit missing) — demand withheld');
  if(recoveryWithCounts===0)blockers.push('recovery docs carry no affected/restored counts — utility rates withheld');
  if(claims.length>0)blockers.push(`${claims.length} claim(s) kept as reported evidence; conflicting values never auto-merged into inputs`);
  if(aidEvents.length>0)blockers.push(`${aidEvents.length} aid EVENT(s) are reported movement, not usable stock — excluded from forecast stock`);
  const evidenceRefs=[
    ...needs.slice(0,5).map(n=>n.id),
    ...recovery.slice(0,5).map(r=>r.id),
    ...claims.slice(0,5).map(c=>c.sourceUrl).filter(Boolean) as string[],
  ];
  const notice=needs.length+recovery.length+claims.length+aidEvents.length===0
    ?'No Firestore humanitarian docs for this incident — calculator stays in simulation mode.'
    :'Firestore docs found, but none yet supply the full scoped inputs (same unit/area/period + usable stock + stages). Live results withheld; simulation below is explicit.';
  return {incidentId,needsDocs:needs.length,needsWithQuantities,recoveryDocs:recovery.length,
    recoveryWithCounts,claimsDocs:claims.length,aidEventDocs:aidEvents.length,
    tiers:{confirmed,inferred,potential},notice,blockers,evidenceRefs};
}
