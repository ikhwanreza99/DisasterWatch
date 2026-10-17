/** Location retrieval only: this does not classify a user's conversational intent. */
export interface IncidentIdentity { id: string; name: string; category: string }
const words = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]+/gu) ?? [];
const administrativeLabels = new Set(['kota', 'kabupaten', 'kab', 'city', 'regency']);
export function explicitIncidentMatches<T extends IncidentIdentity>(message: string, incidents: T[]): T[] {
  const query = new Set(words(message));
  return incidents.filter(incident => {
    const name = words(incident.name).filter(word => !administrativeLabels.has(word));
    return name.length > 0 && name.every(word => query.has(word));
  });
}
export function rankIncidentCandidates<T extends IncidentIdentity>(message: string, incidents: T[], selectedId?: string): T[] {
  const matches = new Set(explicitIncidentMatches(message, incidents).map(incident => incident.id));
  const priority = (incident: T) => matches.has(incident.id) ? 2 : incident.id === selectedId ? 1 : 0;
  return [...incidents].sort((a, b) => priority(b) - priority(a));
}
