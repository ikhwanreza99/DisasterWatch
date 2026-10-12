import type { IncidentCrawlRunDoc } from '../domain/humanitarian';
export function incidentFreshness(id: string, runs: IncidentCrawlRunDoc[]) {
  const relevant = runs.filter(r => r.perIncident?.some(p => p.incidentId === id))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const latest = relevant[0];
  const success = relevant.find(r => ['SUCCESS', 'SUCCESS_EMPTY'].includes(r.outcome) && !r.errorCode);
  return {
    lastAttemptAt: latest?.startedAt ?? null,
    lastSuccessAt: success ? success.finishedAt ?? success.startedAt : null,
    error: latest && (latest.outcome === 'PROVIDER_FAILED' || latest.errorCode) ? 'Pembaruan berita belum selesai. Silakan periksa kembali nanti.' : null,
  };
}
