import type { DisasterIncident } from '../../types';

export interface AssistantTurn { sender: 'ai' | 'user'; text: string }
export interface AssistantConversation {
  history?: AssistantTurn[];
  selectedDisasterId?: string;
  mode?: 'chat' | 'learn';
}

const normalize = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Whole place names only: "Bali" must not match "kembali". */
export function incidentAliases(incident: DisasterIncident): string[] {
  return [...new Set([incident.id.replace(/-/g, ' '), incident.name, ...incident.name.split(/\s*&\s*|\s*,\s*/)].map(normalize))]
    .filter(alias => alias.length >= 3);
}

export function findIncidentMatches(text: string, incidents: DisasterIncident[]): DisasterIncident[] {
  const query = ` ${normalize(text)} `;
  return incidents.filter(incident => incidentAliases(incident).some(alias => query.includes(` ${alias} `)));
}

export function recentAssistantHistory(history: AssistantTurn[] = []): AssistantTurn[] {
  return history.slice(-8).map(turn => ({ sender: turn.sender, text: turn.text.slice(0, 1000) }));
}

export function resolveAssistantScope(question: string, incidents: DisasterIncident[], conversation: AssistantConversation = {}) {
  const resolve = (text: string) => {
    if (/\b(seluruh|semua|nasional|indonesia|keseluruhan)\b/i.test(text)) return { incidents: [], global: true, unknownLocation: false };
    const matches = findIncidentMatches(text, incidents);
    if (matches.length) return { incidents: matches, global: false, unknownLocation: false };
    // An explicit new place must not silently inherit the previous incident.
    const unknownLocation = /\bdi\s+(?!(?:sana|sini|situ|lokasi|tempat|mana|atas|bawah|aplikasi|data|dashboard|menu|disasterwatch|lapangan)\b)[\p{L}][\p{L}-]+/iu.test(text);
    return { incidents: [], global: false, unknownLocation };
  };
  const direct = resolve(question);
  if (direct.incidents.length || direct.global || direct.unknownLocation) return direct;
  for (const turn of [...recentAssistantHistory(conversation.history)].reverse()) {
    if (turn.sender !== 'user') continue;
    const previous = resolve(turn.text);
    if (previous.incidents.length || previous.global || previous.unknownLocation) return previous;
  }
  const selected = incidents.find(incident => incident.id === conversation.selectedDisasterId);
  return { incidents: selected ? [selected] : [], global: false, unknownLocation: false };
}

/** Keep the last topic when a follow-up consists only of another known place. */
export function resolveAssistantQuestion(question: string, incidents: DisasterIncident[], history: AssistantTurn[] = []): string {
  const matches = findIncidentMatches(question, incidents);
  if (!matches.length) return question;
  let rest = ` ${normalize(question)} `;
  for (const incident of matches) for (const alias of incidentAliases(incident).sort((a, b) => b.length - a.length)) rest = rest.replaceAll(` ${alias} `, ' ');
  rest = rest.replace(/\b(kalau|bagaimana|gimana|dan|di|untuk|yang|dengan|kota|kabupaten)\b/g, '').trim();
  if (rest) return question;
  const previousTurns = recentAssistantHistory(history);
  for (let index = previousTurns.length - 1; index >= 0; index--) {
    const previous = previousTurns[index];
    if (previous.sender !== 'user') continue;
    return `${resolveAssistantQuestion(previous.text, incidents, previousTurns.slice(0, index))}\nLokasi pada pertanyaan lanjutan: ${question}`;
  }
  return question;
}

export function hasIncidentTypeConflict(question: string, target: DisasterIncident | undefined): boolean {
  if (!target) return false;
  const mentioned = [
    [/\b(?:banjir|flood)\b/i, 'flood'], [/\b(?:gempa|earthquake)\b/i, 'earthquake'],
    [/\b(?:kebakaran|fire)\b/i, 'fire'], [/\b(?:longsor|landslide)\b/i, 'landslide'],
  ] as const;
  const types = mentioned.filter(([pattern]) => pattern.test(question)).map(([, type]) => type);
  return types.length > 0 && !types.some(type => type === target.category);
}
