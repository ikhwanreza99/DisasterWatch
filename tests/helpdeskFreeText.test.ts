import assert from 'node:assert/strict';
import { test } from 'node:test';
import { disastersData } from '../src/data/disasters';
import { allCurrentRecords } from '../src/data/currentIncidents';
import { asksForIncidentList, normalizeAssistantQuestion } from '../src/services/ai/assistantIntent';
import { resolveAssistantScope } from '../src/services/ai/assistantConversation';
import { buildAssistantPrompt, fallbackAnswer, todayAnswer } from '../src/services/ai/disasterAssistant';
import { detectReportIntent } from '../src/services/ai/reportIntent';
import type { IntelligenceReport } from '../src/domain/intelligence';

const padang = { ...disastersData.padang, name: 'Kota Padang', timestamp: 'Laporan 2026-10-10 · Ditinjau 12 Okt 2026', photoSource: 'BNPB', impact: 'Dampak belum diverifikasi', cost: 'Belum tersedia' };
const demak = { ...padang, id: 'demak', name: 'Demak', province: 'Jawa Tengah' };
const deps = { disasters: { padang, demak }, reports: [] as IntelligenceReport[], aid: [] };

test('user regression: English free-text request returns actual Padang flood details', () => {
  for (const question of ['can you give me detail about flood in Padang', 'can you give me details about flooding in Kota Padang', 'Tolong ceritakan banjir di Padang']) {
    const answer = fallbackAnswer(question, deps);
    assert.match(answer, /Kota Padang/);
    assert.match(answer, /2026-10-10/);
    assert.match(answer, /BNPB/);
    assert.doesNotMatch(answer, /Tanya misalnya|Saya belum dapat memastikan maksud|DATA APLIKASI:/);
    assert.equal(detectReportIntent(question), null);
  }
});
test('source evidence is used only for the matching dated record, not demo id collisions', () => {
  const source = allCurrentRecords.find(record => record.id === 'padang');
  assert(source);
  const answer = fallbackAnswer('Give me details about flood in Padang', deps);
  assert(answer.includes(source.url));
  for (const report of source.reports?.slice(-3) ?? []) assert(answer.includes(report.location));
  const demo = fallbackAnswer('Give me details about flood in Padang', { ...deps, disasters: { padang: { ...padang, timestamp: 'Terjadi sejak 3 hari lalu' } } });
  assert(!demo.includes(source.url));
});
test('cross-region needs questions clear previous Padang scope in either language', () => {
  for (const question of ['which region needs clean water?', 'where is drinking water needed?', 'wilayah mana yang butuh air bersih?']) {
    const scope = resolveAssistantScope(question, [padang, demak], { selectedDisasterId: 'padang' });
    assert.equal(scope.global, true, question);
    const report: IntelligenceReport = { id: 'need', disasterId: 'demak', sourceType: 'citizen', sourceName: 'Warga', rawText: 'Butuh air bersih', location: { name: 'Demak' }, createdAt: '2026-10-16', verificationStatus: 'AI_REVIEWED', isMock: true, extractedData: { disasterType: 'flood', locationName: 'Demak', infrastructureDamage: [], needs: [{ category: 'clean_water', quantity: 500, unit: 'L' }], urgency: 'medium', confidence: 0.6 } };
    const answer = fallbackAnswer(question, { ...deps, reports: [report] }, { selectedDisasterId: 'padang' });
    assert.match(answer, /Demak/);
    assert.match(answer, /500/);
    assert.doesNotMatch(answer, /^Untuk Kota Padang/);
  }
});
test('today means reports dated today in Jakarta, not every app incident', () => {
  assert(asksForIncidentList('is there any disaster today?'));
  assert(asksForIncidentList('ada bencana apa hari ini?'));
  const none = todayAnswer(deps, new Date('2026-10-16T10:00:00Z'));
  assert.match(none, /Belum ada laporan bertanggal hari ini/);
  assert.match(none, /tidak membuktikan/);
  const today = { ...padang, timestamp: 'Laporan 2026-10-17' };
  const answer = todayAnswer({ ...deps, disasters: { padang: today, demak } }, new Date('2026-10-16T18:00:00Z'));
  assert.match(answer, /1 insiden/);
  assert.match(answer, /2026-10-17/);
  assert.doesNotMatch(answer, /Demak/);
  assert.equal(resolveAssistantScope('is there any disaster today?', [padang, demak], { selectedDisasterId: 'padang' }).global, true);
});
test('English unknown places clarify and English city-only follow-ups retain the topic', () => {
  assert.equal(resolveAssistantScope('are there any disasters in Atlantis?', [padang, demak]).unknownLocation, true);
  assert.equal(resolveAssistantScope('detail about flood in Padang, Indonesia', [padang, demak]).incidents[0]?.id, 'padang');
  assert.match(fallbackAnswer('give me details about flood in Atlantis', deps, { selectedDisasterId: 'padang' }), /belum dapat dicocokkan/);
  const answer = fallbackAnswer('what about Demak?', deps, { history: [{ sender: 'user', text: 'How many people were affected in Padang?' }] });
  assert.match(answer, /Demak/);
  assert.match(answer, /belum tersedia/);
});
test('prompt fits the server limit while retaining the latest question and selected language instruction', () => {
  const giant = { ...padang, guide: { ...padang.guide, cause: 'large source '.repeat(2000) } };
  const question = 'can you give me detail about flood in Padang? Latest question sentinel';
  const history = Array.from({ length: 20 }, () => ({ sender: 'user' as const, text: 'old message '.repeat(1000) }));
  const prompt = buildAssistantPrompt(question, { ...deps, disasters: { padang: giant } }, { history });
  assert(prompt.length <= 8000, String(prompt.length));
  assert(prompt.includes(question));
  assert.match(prompt, /BAHASA JAWABAN/);
});
test('reporting intent distinguishes English information inquiries from explicit submissions', () => {
  assert.equal(detectReportIntent('I want to report a flood in Padang'), 'report-disaster');
  assert.equal(detectReportIntent('We need clean water in Padang'), 'report-needs');
  assert.equal(detectReportIntent('How do I report a flood?'), null);
  assert.equal(detectReportIntent('I need to report a flood'), 'report-disaster');
  assert.equal(detectReportIntent('Which region needs clean water?'), null);
  assert.match(normalizeAssistantQuestion('what are the latest flood risks?'), /terbaru.*banjir.*risiko/);
});
