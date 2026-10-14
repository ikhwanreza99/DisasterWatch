// A stored rejection takes precedence over bundled or previously approved data.
export function applyDisasterDecisions<T>(current: Record<string,T>, approved: Record<string,T>, rejectedIds: string[]): Record<string,T> {
  const next={...current,...approved};
  for(const id of rejectedIds) delete next[id];
  return next;
}
