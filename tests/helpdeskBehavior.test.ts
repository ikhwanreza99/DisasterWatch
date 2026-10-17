import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assistantLanguage, assistantLanguageInstruction, responseMatchesLanguage, incidentLabel } from '../src/services/ai/assistantLanguage';
import { asksTodaysDisasters, todaysDisasterList, recentDisasterList } from '../src/services/ai/recentDisasterList';
import { buildAssistantPrompt, fallbackAnswer } from '../src/services/ai/disasterAssistant';
import { buildAssistantSnapshot, renderAssistantContextText } from '../src/services/ai/disasterAssistantContext';
import { currentIncidents } from '../src/data/currentIncidents';
import { nttFallbackAnswer } from '../src/services/ai/nttAssistant';
import { nttCaseSeed, nttArticlesSeed, nttClaimsSeed } from '../src/data/nttCase';

const deps = { disasters: currentIncidents, reports: [], aid: [], dataSources: { incidents: 'mixed', reports: 'firestore', aid: 'firestore' } as const };
const now = Date.parse('2026-10-17T09:00:00+07:00');

test('conversation language follows clear messages and retains language for ambiguous answers', () => {
  assert.equal(assistantLanguage('What disasters happened today?', 'id'), 'en');
  assert.equal(assistantLanguage('Ada bencana apa hari ini?', 'en'), 'id');
  assert.equal(assistantLanguage('Jakarta', 'en'), 'en');
  assert.equal(assistantLanguage('25', 'id'), 'id');
  assert.equal(assistantLanguage('Please answer in Indonesian', 'en'), 'id');
});
test('today is a WIB event date, not an update timestamp or a fourteen-day list', () => {
  const template = currentIncidents.padang;
  const records = Object.fromEntries([
    { ...template, id: 'today', eventDate: '2026-10-17' },
    { ...template, id: 'overnight', eventDate: '2026-10-16T18:00:00Z' },
    { ...template, id: 'yesterday', eventDate: '2026-10-16', timestamp: '2026-10-17' },
    { ...template, id: 'future', eventDate: '2026-10-18' },
  ].map(record => [record.id, record]));
  assert.deepEqual(todaysDisasterList(records, now).records.map(record => record.id).sort(), ['overnight', 'today']);
  assert.equal(asksTodaysDisasters('ada bencana apa hari ini'), true);
  assert.equal(asksTodaysDisasters('What disasters happened today?'), true);
  assert.equal(asksTodaysDisasters('bencana 14 hari terakhir sejak hari ini'), false);
});
test('explicit Firestore event date wins over bundled date for the same ID', () => {
  const data = { padang: { ...currentIncidents.padang, eventDate: '2026-10-17' } };
  assert.equal(recentDisasterList(data, now).records[0].date, '2026-10-17');
});
test('fallback and prompt consistently use the requested language, including generic answers', () => {
  const english = fallbackAnswer('Hello, can you help?', deps, 'en');
  assert.match(english, /APP SNAPSHOT/);
  assert.doesNotMatch(english, /Saya|bencana|wilayah|tercatat|butuh/);
  assert.match(fallbackAnswer('What disasters happened today?', deps, 'en'), /today/);
  assert.match(fallbackAnswer('ada bencana apa hari ini', deps, 'id'), /hari ini/);
  assert.match(fallbackAnswer('disasters in the last 14 days', deps, 'en'), /Flood|Fire|Earthquake|Landslide/);
  const prompt = buildAssistantPrompt('What happened?', deps, { language: 'en', history: [{ sender: 'user', text: 'Tell me about Padang' }] });
  assert.match(prompt, /Reply entirely in English/);
  assert.match(prompt, /Tell me about Padang/);
  assert.doesNotMatch(prompt, /Answer in Bahasa Indonesia|Jawab ringkas dalam Bahasa Indonesia/);
  assert.ok(prompt.length <= 8000, String(prompt.length));
  assert.match(assistantLanguageInstruction('id'), /entirely in Bahasa Indonesia/);
});
test('data provenance reflects sources without labelling every incident as demo', () => {
  const snapshot = buildAssistantSnapshot(deps);
  assert.equal(snapshot.isDemoData, false);
  assert.match(snapshot.provenance, /incidents=mixed; reports=firestore; aid=firestore/);
  assert.doesNotMatch(renderAssistantContextText(snapshot), /data demo\/prototipe, bukan feed/);
  assert.match(renderAssistantContextText(snapshot, 3000), /DATA PROVENANCE/);
});
test('unavailable Firestore data does not masquerade as confirmed zero reports', () => {
  const answer = fallbackAnswer('How many reports are there?', { ...deps, dataSources: { ...deps.dataSources, reports: 'unavailable' } }, 'en');
  assert.match(answer, /not been confirmed/);
  assert.doesNotMatch(answer, /0 reports/);
});
test('NTT fallback uses English even when the underlying sources use Indonesian', () => {
  const answer = nttFallbackAnswer('What happened in Sumba?', { kase: nttCaseSeed, articles: nttArticlesSeed, claims: nttClaimsSeed, mode: 'seed', notice: '' }, 'en');
  assert.match(answer, /earthquake|magnitude/);
  assert.match(answer, /https:\/\//);
  assert.doesNotMatch(answer, /Yang terjadi|Belum tersedia|artikel|klaim|menunggu/);
});

test('mixed-language model prose is rejected while source names and quotations are preserved', () => {
  assert.equal(responseMatchesLanguage('There are two bencana banjir in the data.', 'en'), false);
  assert.equal(responseMatchesLanguage('According to the data, belum tersedia.', 'en'), false);
  assert.equal(responseMatchesLanguage('Menurut data, recorded incidents are unavailable.', 'id'), false);
  assert.equal(responseMatchesLanguage('Source: BNPB. The source says “banjir”.', 'en'), true);
  assert.equal(incidentLabel({fullTitleDisplay: 'Judul kejadian tanpa terjemahan', category: 'flood'}, 'en'), 'Flood');
});
