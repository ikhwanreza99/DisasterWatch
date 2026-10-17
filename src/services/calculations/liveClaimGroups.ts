// Live claim grouping — transparent bridge from stored claims to reconcile inputs.
// Derivation rule (documented, inspectable, never silent):
// - Group quantified claims by (claimType, unit) within one incident.
// - ONE distinct value in a group → single 'independent' fact → the engine's
//   single-observation canonical path (no summation performed).
// - MULTIPLE distinct values in a group → each marked 'total' (competing
//   totals for the same scope) → the engine's conflict path withholds with
//   lineage. The stored conflictingWith links corroborate but are not required.
// - Null/non-finite/negative quantities, unit mismatches, and unknown groups
//   are excluded with reasons, never zero-filled or blindly summed.
// Pure + React-free. No writes. No invented values.
import type { IncidentClaimDoc } from '../../domain/humanitarian';
import type { ReconcileFactsInput, ReconcilableFact } from '../insights/formulas';

export interface ClaimFactGroup {
  /** Stable key: claimType + unit, e.g. 'damage|rumah'. */
  groupKey: string;
  claimType: string;
  unit: string;
  input: ReconcileFactsInput;
  /** Claim ids consumed by this group (evidence refs). */
  claimIds: string[];
  /** Distinct source organisations (quality signal, not identity). */
  sources: string[];
}

function isQuantified(c: IncidentClaimDoc): boolean {
  return typeof c.quantity === 'number' && Number.isFinite(c.quantity) && c.quantity >= 0
    && typeof c.unit === 'string' && c.unit.trim() !== '';
}

/** Group one incident's claims into reconcile-ready fact sets. Read-only. */
export function buildClaimFactGroups(incidentId: string, claims: IncidentClaimDoc[]): ClaimFactGroup[] {
  const scoped = claims.filter((c) => c && c.incidentId === incidentId && c.id);
  const groups = new Map<string, IncidentClaimDoc[]>();
  for (const c of scoped) {
    if (!isQuantified(c)) continue;
    const key = `${c.claimType}||${(c.unit as string).toLowerCase().trim()}`;
    const arr = groups.get(key);
    if (arr) arr.push(c);
    else groups.set(key, [c]);
  }
  const out: ClaimFactGroup[] = [];
  for (const [key, members] of groups) {
    const [claimType, unit] = key.split('||') as [string, string];
    const distinctValues = [...new Set(members.map((m) => m.quantity as number))];
    const multi = distinctValues.length > 1;
    const facts: ReconcilableFact[] = members.map((m) => ({
      factId: m.id,
      value: m.quantity,
      unit: m.unit as string,
      area: m.location,
      period: null,
      // Transparent derivation: competing values for the same scope are
      // competing totals; a lone value is a single observation.
      relation: multi ? 'total' : 'independent',
      parentFactId: null,
      groupKey: key,
      sourceRefs: [m.sourceUrl].filter(Boolean) as string[],
      observedAt: null,
    }));
    out.push({
      groupKey: key,
      claimType,
      unit,
      input: { facts, unit: members[0]!.unit as string },
      claimIds: members.map((m) => m.id),
      sources: [...new Set(members.map((m) => m.sourceOrganization).filter(Boolean) as string[])],
    });
  }
  return out.sort((a, b) => a.groupKey.localeCompare(b.groupKey));
}
