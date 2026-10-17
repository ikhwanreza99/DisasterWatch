import { askAssistant, type AssistantDeps, type AssistantConversation } from './disasterAssistant';
import { explicitIncidentMatches } from './incidentCandidates';
import { asksRecentDisasters, asksTodaysDisasters } from './recentDisasterList';
import { buildNttContext } from './nttAssistant';
import type { NttCaseState } from '../nttCaseStore';

/** Topic predictions are hints, never permission to replace a user's question with a canned service reply. */
export async function answerHelpdeskQuestion(
  message: string,
  deps: AssistantDeps,
  conversation: AssistantConversation,
  options: { incidentId?: string; nttCase?: NttCaseState | null } = {},
  answer: typeof askAssistant = askAssistant,
) {
  const named = explicitIncidentMatches(message, Object.values(deps.disasters));
  const globalWindow = asksTodaysDisasters(message) || asksRecentDisasters(message);
  const selected = options.incidentId ? deps.disasters[options.incidentId] : undefined;
  const records = named.length ? named : !globalWindow && selected ? [selected] : Object.values(deps.disasters);
  const scoped = { ...deps, disasters: Object.fromEntries(records.map(record => [record.id, record])) };
  const caseRelevant = options.nttCase && records.some(record => record.id === options.nttCase!.kase.caseId);
  return answer(message, scoped, {
    ...conversation,
    additionalContext: caseRelevant ? buildNttContext(options.nttCase!, 1000) : undefined,
  });
}
