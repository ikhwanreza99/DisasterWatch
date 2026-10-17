export type RecordSource = 'loading' | 'firestore' | 'cache' | 'unavailable' | 'local';
export interface AssistantSources {
  // Incidents retain the sourced local dataset even after Firestore moderation loads.
  incidents: RecordSource | 'mixed';
  reports: RecordSource;
  aid: RecordSource;
}
export const UNKNOWN_SOURCES: AssistantSources = { incidents: 'local', reports: 'unavailable', aid: 'unavailable' };
export function sourceContext(sources: AssistantSources = UNKNOWN_SOURCES): string {
  return `DATA PROVENANCE: incidents=${sources.incidents}; reports=${sources.reports}; aid=${sources.aid}. Firestore means a server-confirmed snapshot, not official verification. mixed means sourced bundled incidents plus Firestore moderation/approved records. local means bundled/local records, not necessarily synthetic. cache is not server-confirmed. loading/unavailable means coverage is unknown; zero records does NOT establish zero incidents/reports/aid. This is a bounded app snapshot, not the entire Firebase database. Only records explicitly marked isMock are demo records. Never call all data prototype/demo or fully live without evidence.`;
}

export function sourceLabel(source: AssistantSources[keyof AssistantSources], lang: 'id' | 'en'): string {
  const labels = {
    loading: ['memuat', 'loading'], firestore: ['Firestore (terkonfirmasi server)', 'Firestore (server confirmed)'],
    cache: ['cache (belum terkonfirmasi server)', 'cached (not server confirmed)'], unavailable: ['belum tersedia', 'unavailable'],
    local: ['sumber lokal', 'local sources'], mixed: ['sumber lokal + Firestore', 'local sources + Firestore'],
  };
  return labels[source][lang === 'en' ? 1 : 0];
}
