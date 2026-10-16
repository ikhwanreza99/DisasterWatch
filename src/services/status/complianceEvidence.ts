import type { ServiceCheck } from './model';

export type EvidenceState = 'met' | 'pending' | 'untested' | 'checking' | 'failed' | 'disabled';
/** A completed failed/skipped probe must never masquerade as an unrun probe. */
export function complianceEvidence(check: ServiceCheck | undefined): EvidenceState {
  if (!check) return 'untested';
  if (check.state === 'checking') return 'checking';
  if (check.state === 'error') return 'failed';
  if (check.state === 'disabled') return 'disabled';
  if (check.state === 'ok' && check.checkedAt) return 'met';
  if (check.state === 'empty' && check.checkedAt) return 'pending';
  return 'untested';
}
