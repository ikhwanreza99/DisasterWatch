import type { DisasterIncident } from '../../types';
import { asksForIncidentList, normalizeAssistantQuestion } from './assistantIntent';

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
    const matches = findIncidentMatches(text, incidents);
    if (matches.length) return { incidents: matches, global: false, unknownLocation: false };
    if (/\b(nasional|indonesia|nationwide|nationally)\b/i.test(text)) return { incidents: [], global: true, unknownLocation: false };
    // Resolve explicit new places before broad words such as "any disaster" or "where".
    const unknownLocation = /\bdi\s+(?!(?:sana|sini|situ|lokasi|tempat|mana|atas|bawah|aplikasi|data|dashboard|menu|disasterwatch|lapangan)\b)[\p{L}][\p{L}-]+/iu.test(text) || /\b(?:in|at|near)\s+(?!(?:the|this|that|there|here|my|our|an|a|general|detail)\b)[\p{L}][\p{L}-]+/iu.test(text);
    if (!unknownLocation && (asksForIncidentList(text) || /\b(seluruh|semua|keseluruhan|all|across)\b|\b(?:which|what) (?:region|area|city|cities|district)s?\b|\bwhere\b|(?:wilayah|daerah|kota) mana/i.test(text))) return { incidents: [], global: true, unknownLocation: false };
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
  rest = rest.replace(/\b(kalau|bagaimana|gimana|dan|di|untuk|yang|dengan|kota|kabupaten|what|how|about|in|at|and|for|city|district)\b/g, '').trim();
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
  const types = mentioned.filter(([pattern]) => pattern.test(normalizeAssistantQuestion(question))).map(([, type]) => type);
  return types.length > 0 && !types.some(type => type === target.category);
}
