import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAgentDecision, buildAgentPrompt, interpretHelpdeskMessage, validateAgentDecision, type AgentContext } from '../src/services/ai/helpdeskAgent';

const context: AgentContext = {
  workflow: 'report-disaster', stage: 'questions', paused: false, language: 'en',
  answers: { location: 'Jakarta' }, currentField: 'category',
  history: [{ sender: 'user', text: 'Jakarta' }, { sender: 'ai', text: 'What type of disaster would you like to report?' }],
  incidents: [{id: 'jakarta', name: 'Jakarta', category: 'flood'}], selectedIncidentId: 'jakarta', hasAttachment: false,
};
const raw = (action: string, extra = {}) => ({ action, confidence: 0.95, language: 'en', reportType: null, updates: {}, reply: '', topic: 'general', incidentId: null, ...extra });
const parse = (action: string, text: string, extra = {}, ctx = context) => validateAgentDecision(raw(action, extra), text, ctx)!;

test('semantic request carries the draft, question, history and original message into the model', async () => {
  const message = 'On second thought, leave this unfiled; I only wanted to understand what happens next.';
  let prompt = '';
  const result = await interpretHelpdeskMessage(message, context, async input => { prompt = input; return JSON.stringify(raw('cancel_report')); });
  assert.equal(result.available, true);
  assert.ok(prompt.includes(message));
  assert.ok(prompt.includes('"location":"Jakarta"'));
  assert.ok(prompt.includes('"currentField":"category"'));
  assert.ok(prompt.includes('What type of disaster'));
  if (result.available) assert.equal(result.decision.action, 'cancel_report');
});

test('cancellation returned by the model clears the draft at every active report stage', () => {
  for (const stage of ['questions', 'attachment', 'confirm']) {
    const ctx = { ...context, stage };
    const decision = parse('cancel_report', 'I would rather not put this on record.', {}, ctx);
    assert.ok(decision);
    assert.deepEqual(applyAgentDecision(ctx, decision), { workflow: 'menu', answers: {}, paused: false });
  }
});

test('questions, clarification and reviewing never overwrite a pending report field', () => {
  for (const action of ['answer', 'clarify', 'review_report']) {
    const decision = parse(action, 'What counts as a disaster?', { reply: action === 'clarify' ? 'Would you like to ask a question or add details?' : '' });
    const state = applyAgentDecision(context, decision);
    assert.equal(state, context);
    assert.equal(state.answers.category, undefined);
  }
});

test('one message fills multiple semantically extracted fields without losing prior fields', () => {
  const text = 'It was a flood this morning. Two houses were affected.';
  const decision = parse('update_report', text, { updates: {
    category: {value: 'Flood', evidence: 'flood'}, time: {value: 'this morning', evidence: 'this morning'},
    description: {value: 'Two houses were affected.', evidence: 'Two houses were affected.'},
  } });
  assert.ok(decision);
  assert.deepEqual(applyAgentDecision(context, decision).answers, {
    location: 'Jakarta', category: 'Flood', time: 'this morning', description: 'Two houses were affected.',
  });
  assert.deepEqual(context.answers, {location: 'Jakarta'});
});

test('corrections preserve unrelated draft fields, pause and resume preserve all fields', () => {
  const draft = { ...context, answers: {location: 'Jakarta', category: 'Flood', time: 'Yesterday'} };
  const decision = parse('update_report', 'Actually it was in Bekasi.', { updates: {location: {value: 'Bekasi', evidence: 'Bekasi'}} });
  const corrected = applyAgentDecision(draft, decision);
  assert.deepEqual(corrected.answers, {location: 'Bekasi', category: 'Flood', time: 'Yesterday'});
  const paused = applyAgentDecision(corrected, parse('pause_report', 'Can we come back to this later?'));
  assert.equal(paused.paused, true);
  const resumed = applyAgentDecision(paused, parse('resume_report', 'Back to where we left off.'));
  assert.equal(resumed.paused, false);
  assert.deepEqual(resumed.answers, corrected.answers);
});

test('a factual negative is accepted only as an explicit grounded update, never by position', () => {
  const text = 'Nobody needs immediate assistance.';
  const decision = parse('update_report', text, {updates: {urgency: {value: text, evidence: text}}});
  const state = applyAgentDecision(context, decision);
  assert.equal(state.answers.urgency, text);
  assert.equal(state.answers.category, undefined);
});

test('unknown actions, submission attempts, hallucinated fields and unsupported evidence fail closed', () => {
  for (const data of [raw('submit_report'), raw('delete_database'), raw('update_report', {updates: {location: {value: 'Bandung', evidence: 'Bandung'}}}), raw('update_report', {updates: {admin: {value: 'yes', evidence: 'yes'}}}), raw('answer', {updates: {category: {value: 'Flood', evidence: 'flood'}}}), raw('answer', {incidentId: 'invented'}), raw('answer', {confidence: 0.4}), raw('answer', {language: 'fr'})]) {
    assert.equal(validateAgentDecision(data, 'a flood yes', context), null);
  }
});

test('a model outage, malformed JSON or low confidence never falls back to storing the user text', async () => {
  for (const generate of [async () => {throw new Error('unavailable');}, async () => 'not JSON', async () => JSON.stringify(raw('update_report', {confidence: 0.3}))]) {
    assert.deepEqual(await interpretHelpdeskMessage('Something else, actually.', context, generate), {available: false});
    assert.deepEqual(context.answers, {location: 'Jakarta'});
  }
});

test('fresh chat can start a report, inactive drafts cannot cancel and review never submits', () => {
  const chat = {...context, workflow: 'menu', answers: {}};
  assert.equal(validateAgentDecision(raw('cancel_report'), 'Cancel that', chat), null);
  const start = validateAgentDecision(raw('update_report', {reportType: 'report-needs', updates: {items: {value: 'Water', evidence: 'water'}}}), 'Our village needs water.', chat);
  assert.ok(start);
  assert.equal(applyAgentDecision(chat, start).workflow, 'report-needs');
  assert.deepEqual(applyAgentDecision(context, parse('review_report', 'That is all, please send it.')), context);
});

test('attachment decisions are scoped to the attachment stage and report type fields are bounded', () => {
  assert.equal(validateAgentDecision(raw('skip_attachment'), 'No picture', context), null);
  assert.ok(validateAgentDecision(raw('skip_attachment'), 'No picture', {...context, stage: 'attachment'}));
  const wrongFields = parse('update_report', 'Need 25 families', {updates: {victims: {value: '25 families', evidence: '25 families'}}});
  assert.equal(applyAgentDecision(context, wrongFields), context);
});

test('context stays within server prompt budget without silently truncating the latest message', () => {
  const large = {...context, history: Array.from({length: 20}, () => ({sender: 'user' as const, text: 'x'.repeat(800)})), incidents: Array.from({length: 50}, (_, i) => ({id: `incident-${i}`, name: 'Town'.repeat(50), category: 'flood'}))};
  const prompt = buildAgentPrompt('Current user intent', large);
  assert.ok(prompt.length <= 7900, String(prompt.length));
  assert.ok(prompt.includes('Current user intent'));
  assert.throws(() => buildAgentPrompt('x'.repeat(1601), context));
});

test('irrelevant null topic on a report decision normalizes without losing a grounded correction', () => {
 const decision = parse('update_report', 'It was Bekasi.', {topic: null, updates: {location:{value:'Bekasi',evidence:'Bekasi'}}});
 assert.ok(decision);
 assert.equal(decision.topic, 'general');
 assert.equal(applyAgentDecision(context, decision).answers.location, 'Bekasi');
 assert.equal(validateAgentDecision(raw('answer', {topic:null}), 'What happened?', context), null);
});

test('switching to an aid report preserves shared incident details and drops incompatible fields', () => {
 const decision = parse('update_report', 'We need drinking water.', {reportType:'report-needs',updates:{items:{value:'drinking water',evidence:'drinking water'}}});
 const next = applyAgentDecision({...context,answers:{location:'Jakarta',category:'Flood',time:'Yesterday'}},decision);
 assert.deepEqual(next.answers,{location:'Jakarta',category:'Flood',items:'drinking water'});
});
