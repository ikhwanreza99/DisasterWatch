import assert from 'node:assert/strict';
import { test } from 'node:test';
import { disastersData } from '../src/data/disasters';
import { buildAssistantPrompt, fallbackAnswer } from '../src/services/ai/disasterAssistant';
import { findIncidentMatches, recentAssistantHistory, resolveAssistantScope } from '../src/services/ai/assistantConversation';
import type { IntelligenceReport } from '../src/domain/intelligence';

const padang = disastersData.padang;
const demak = { ...padang, id: 'demak', name: 'Demak', impact: '10 jiwa', province: 'Jawa Tengah', reports: [] };
const bali = { ...padang, id: 'bali', name: 'Bali', province: 'Bali', impact: '999 jiwa' };
const all = [padang, demak, bali];
const report = (id: string, disasterId: string | undefined, population: number): IntelligenceReport => ({
  id, disasterId, sourceType: 'citizen', sourceName: 'Warga', rawText: 'Laporan', location: { name: disasterId ?? 'Tidak diketahui' }, createdAt: '2026-10-16T00:00:00Z', verificationStatus: 'AI_REVIEWED', isMock: true,
  extractedData: { disasterType: 'flood', locationName: disasterId ?? '-', affectedPopulation: population, infrastructureDamage: [], needs: [], urgency: 'low', confidence: 0.6 },
});
const deps = { disasters: Object.fromEntries(all.map(d => [d.id, d])), reports: [report('a', 'padang', 100), report('b', 'demak', 20), report('unlinked', undefined, 8000)], aid: [] };

test('city aliases match combined incident names without matching unrelated substrings', () => {
  assert.deepEqual(findIncidentMatches('Bagaimana kondisi di Padang?', all).map(d => d.id), ['padang']);
  assert.deepEqual(findIncidentMatches('Saya kembali lagi', all), []);
});
test('location follow-ups retain context and a new city overrides it', () => {
  const history = [{ sender: 'user' as const, text: 'Berapa orang terdampak di Padang?' }];
  assert.match(fallbackAnswer('Bagaimana di Demak?', deps, { history }), /20/);
  assert.doesNotMatch(fallbackAnswer('Bagaimana di Demak?', deps, { history }), /8.000|100 orang/);
  assert.match(fallbackAnswer('Berapa orang terdampak?', deps, { history }), /100/);
});
test('scoped questions exclude unassigned reports and other incidents', () => {
  const answer = fallbackAnswer('Berapa orang terdampak di Demak?', deps);
  assert.match(answer, /20/);
  assert.doesNotMatch(answer, /8.000|999/);
});
test('an unknown explicit place asks for clarification instead of reusing the selected incident', () => {
  assert.match(fallbackAnswer('Berapa orang terdampak di Atlantis?', deps, { selectedDisasterId: 'padang' }), /belum dapat dicocokkan/);
  assert.equal(resolveAssistantScope('Bagaimana di sana?', all, { history: [{ sender: 'user', text: 'Bagaimana kondisi di Atlantis?' }], selectedDisasterId: 'padang' }).unknownLocation, true);
});
test('an explicit national query clears local scope', () => {
  const scope = resolveAssistantScope('Berapa insiden di seluruh Indonesia?', all, { selectedDisasterId: 'padang' });
  assert.equal(scope.global, true);
  assert.match(fallbackAnswer('Berapa insiden di seluruh Indonesia?', deps, { selectedDisasterId: 'padang' }), /3 insiden/);
});
test('learning answers address impact questions and ask for a place when absent', () => {
  assert.match(fallbackAnswer('Berapa orang terdampak?', deps, { mode: 'learn', selectedDisasterId: 'demak' }), /20/);
  assert.match(fallbackAnswer('Apa penyebab banjir?', deps, { mode: 'learn' }), /kota\/kabupaten/);
});
test('missing data is never described as a verified zero', () => {
  const answer = fallbackAnswer('Berapa korban meninggal di Demak?', deps);
  assert.match(answer, /belum mencatat/);
  assert.doesNotMatch(answer, /0 orang|tidak ada korban/);
});
test('Gemini prompt carries bounded history and current scoped facts, including guides', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ sender: 'user' as const, text: `turn-${i}: ${'x'.repeat(1500)}` }));
  assert.equal(recentAssistantHistory(history).length, 8);
  assert.equal(recentAssistantHistory(history)[0].text.length, 1000);
  const prompt = buildAssistantPrompt('Berapa terdampak di Demak?', deps, { history });
  assert.match(prompt, /turn-19/);
  assert.doesNotMatch(prompt, /turn-0:/);
  assert.match(prompt, /20 orang/);
  assert.doesNotMatch(prompt, /8.000|999 orang/);
  assert.match(prompt, /protocols/);
  assert.match(prompt, /bukan sumber fakta/);
});

test('questions asking where to prioritise do not treat "mana" as an untracked city', () => {
  assert.equal(resolveAssistantScope('Di mana wilayah paling prioritas?', all).unknownLocation, false);
});

test('several consecutive city-only follow-ups keep the original topic', () => {
  const history = [{ sender: 'user' as const, text: 'Berapa orang terdampak di Padang?' }, { sender: 'user' as const, text: 'Kalau di Demak?' }];
  assert.match(fallbackAnswer('Kalau di Bali?', deps, { history }), /999/);
});
test('asking about a different disaster type prompts clarification', () => {
  assert.match(fallbackAnswer('Apa penyebab gempa?', deps, { selectedDisasterId: 'demak' }), /Jenis bencana.*berbeda/);
});

test('unavailable local population is not answered as zero, while an explicitly recorded zero remains valid', () => {
  const unknown = { ...demak, impact: 'Belum tersedia' };
  const empty = { disasters: { demak: unknown }, reports: [], aid: [] };
  assert.match(fallbackAnswer('Berapa orang terdampak di Demak?', empty), /belum tersedia/);
  assert.doesNotMatch(fallbackAnswer('Berapa orang terdampak di Demak?', empty), /0 orang/);
  assert.match(fallbackAnswer('Berapa orang terdampak di Demak?', { ...empty, reports: [report('zero', 'demak', 0)] }), /0 orang/);
});
