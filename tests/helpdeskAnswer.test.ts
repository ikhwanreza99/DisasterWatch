import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerHelpdeskQuestion } from '../src/services/ai/helpdeskAnswer';
import { rankIncidentCandidates } from '../src/services/ai/incidentCandidates';
import { currentIncidents } from '../src/data/currentIncidents';
import { askAssistant, fallbackAnswer, buildAssistantPrompt } from '../src/services/ai/disasterAssistant';
import { buildAssistantSnapshot } from '../src/services/ai/disasterAssistantContext';
const deps = { disasters: currentIncidents, reports: [], aid: [] };

test('today question uses disaster data despite an incorrect selected incident', async () => {
  const result = await answerHelpdeskQuestion('is there any disaster today?', deps, {language:'en'}, {incidentId:'padang'});
  assert.doesNotMatch(result.answer, /aid post|posko/i);
  assert.match(result.answer, /today|date|disaster/i);
});
test('Padang question after cancellation preserves original question and retrieves Padang', async () => {
  const message = 'saya ingin tau detail bencana banjir di padang';
  await answerHelpdeskQuestion(message, deps, {language:'id', history:[{sender:'ai',text:'Laporan dibatalkan. Belum ada data posko bantuan.'}]}, {incidentId:'wrong'}, async (question, scoped, conversation) => {
    assert.equal(question, message);
    assert.deepEqual(Object.keys(scoped.disasters), ['padang']);
    assert.equal(conversation?.language, 'id');
    return {answer:'Detail banjir Padang', engine:'deterministic'};
  });
});
test('location candidates beyond catalog limit are ranked before unrelated selected incident', () => {
  const other = Array.from({length:25}, (_,i) => ({id:`other${i}`,name:`Location ${i}`,category:'flood'}));
  const ranked = rankIncidentCandidates('banjir di Padang', [...other, {id:'padang',name:'Kota Padang',category:'flood'}], 'other0');
  assert.equal(ranked[0].id, 'padang');
  assert.equal(ranked[1].id, 'other0');
});
test('actual aid-post questions retain grounded facilities through the shared answer service', async () => {
  const padang = {...currentIncidents.padang,route:{...currentIncidents.padang.route,checkpoints:[{id:1,name:'Synthetic shelter',location:'Padang',recommendation:true}]}};
  await answerHelpdeskQuestion('Where are aid posts in Padang?', {...deps, disasters:{padang}}, {language:'en'}, {}, async (question, scoped) => {
    const snapshot = buildAssistantSnapshot(scoped);
    assert.equal(snapshot.aidPosts[0].name, 'Synthetic shelter');
    assert.equal(snapshot.aidPosts[0].candidate, true);
    assert.equal(snapshot.aidPosts[0].capacity, 'Unknown');
    assert.match(buildAssistantPrompt(question, scoped, {language:'en'}), /Synthetic shelter/);
    return {answer:'Shelter candidate',engine:'deterministic'};
  });
});

test('model outage still returns the scoped incident title rather than unrelated service guidance', () => {
  const result = fallbackAnswer('saya ingin tau detail bencana banjir di padang', {...deps,disasters:{padang:currentIncidents.padang}}, 'id');
  assert.match(result, /Padang/);
  assert.ok(result.includes(currentIncidents.padang.fullTitleDisplay));
  assert.doesNotMatch(result, /Belum ada data posko/);
});

test('intro-only generation is replaced by factual incident fallback, never shown as finished', async () => {
  let budget: number | undefined;
  const result = await askAssistant('saya ingin tau tentang bencana banjir di Padang', {...deps,disasters:{padang:currentIncidents.padang}}, {language:'id'}, async options => {
    budget = options?.maxOutputTokens;
    return {generateContent:async () => 'Menurut data DisasterWatch saat ini, berikut adalah rincian mengenai bencana banjir di Kota Padang:'};
  });
  assert.equal(budget, 2048);
  assert.equal(result.engine, 'deterministic');
  assert.match(result.answer, /2026-10-10/);
  assert.doesNotMatch(result.answer, /berikut adalah rincian/);
});
test('complete model answer is preserved without arbitrary character clipping', async () => {
  const answer = 'Banjir tercatat di Kota Padang. ' + 'Data tersedia dalam aplikasi. '.repeat(80);
  const result = await askAssistant('Detail banjir Padang', deps, {language:'id'}, async () => ({generateContent:async () => answer}));
  assert.equal(result.answer, answer.trim());
  assert.equal(result.engine, 'gemini');
});
