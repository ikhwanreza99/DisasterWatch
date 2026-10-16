import assert from 'node:assert/strict';
import { test } from 'node:test';
import { disastersData } from '../src/data/disasters';
import { attachmentError, buildReportText, getReportQuestions, matchReportIncident, validateReportAnswers } from '../src/services/ai/helpdeskReport';
import { heuristicExtract } from '../src/services/ai/disasterExtraction';
import { detectReportIntent } from '../src/services/ai/reportIntent';

test('report questions collect all required fields, including context updates', () => {
  const normal = getReportQuestions('report-disaster', false);
  const update = getReportQuestions('report-disaster', true);
  assert.deepEqual(new Set(normal.map(q => q.key)), new Set(update.map(q => q.key)));
  assert.equal(update[2].key, 'description');
  assert.equal(update[3].key, 'time');
  const answers = Object.fromEntries(normal.map(q => [q.key, 'Jawaban']));
  assert.equal(validateReportAnswers(answers, normal), undefined);
  assert.equal(validateReportAnswers({ ...answers, location: '  ' }, normal)?.key, 'location');
});
test('needs reports retain quantities, recipients and distribution contact questions', () => {
  assert.deepEqual(getReportQuestions('report-needs', false).map(q => q.key), ['items', 'location', 'category', 'victims', 'access', 'urgency']);
});
test('reports link only to an unambiguous matching city and disaster category', () => {
  const demak = { ...disastersData.padang, id: 'demak', name: 'Demak' };
  const bali = { ...demak, id: 'bali', name: 'Bali' };
  assert.equal(matchReportIncident('Desa A, Demak', 'Banjir', [demak])?.id, 'demak');
  assert.equal(matchReportIncident('Demak', 'Gempa', [demak]), undefined);
  assert.equal(matchReportIncident('Atlantis', 'Banjir', [demak]), undefined);
  assert.equal(matchReportIncident('Saya kembali ke desa', 'Banjir', [bali]), undefined);
  assert.equal(matchReportIncident('Demak dan Bali', 'Banjir', [demak, bali]), undefined);
  assert.equal(matchReportIncident('Padang', 'Banjir', [disastersData.padang]), undefined);
});
test('initial and later attachments share file size and type validation', () => {
  assert.equal(attachmentError({ type: 'image/png', size: 5 * 1024 * 1024 }), null);
  assert.match(attachmentError({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })!, /5 MB/);
  assert.match(attachmentError({ type: 'text/html', size: 10 })!, /JPG/);
});
test('report questions and refusals do not start submission workflows', () => {
  for (const question of ['Apa yang harus saya laporkan?', 'Apakah ada yang melaporkan banjir di Demak?', 'Saya tidak mau melaporkan banjir', '  Bagaimana cara melaporkan bencana?']) assert.equal(detectReportIntent(question), null, question);
  assert.equal(detectReportIntent('Saya ingin melaporkan banjir di Demak'), 'report-disaster');
});
test('offline extraction does not fabricate disaster types or population counts', () => {
  const other = heuristicExtract('Tetapi kami membutuhkan bantuan untuk 10 keluarga', 'Demak');
  assert.equal(other.disasterType, 'other');
  assert.equal(other.affectedHouseholds, 10);
  assert.equal(other.affectedPopulation, null);
  assert.equal(heuristicExtract('Terjadi kebakaran, 20 orang terdampak').disasterType, 'fire');
  assert.equal(heuristicExtract('Banjir, 20 orang terdampak').affectedPopulation, 20);
});

test('offline extraction preserves explicit supply amounts and Indonesian number formats', () => {
  for (const [text, expected] of [
    ['Butuh air bersih 300 liter untuk 12 keluarga', { category: 'clean_water', quantity: 300, unit: 'liter' }],
    ['Kami membutuhkan 1.200 liter air bersih', { category: 'clean_water', quantity: 1200, unit: 'liter' }],
    ['Beras 2,5 kg', { category: 'food', quantity: 2.5, unit: 'kg' }],
    ['Masker 20 lembar', { category: 'mask', quantity: 20, unit: 'lembar' }],
  ] as const) assert.deepEqual(heuristicExtract(text).needs[0], expected);
  assert.equal(heuristicExtract('12 keluarga butuh air bersih').needs[0].quantity, null);
  assert.equal(heuristicExtract('1.200 orang terdampak').affectedPopulation, 1200);
  assert.deepEqual(heuristicExtract('Tetapi jembatan masih aman, tanggul juga aman').infrastructureDamage, []);
});
test('confirmed corrections override original notes in the extraction sent to persistence', () => {
  const questions = getReportQuestions('report-needs', false);
  const answers = { items: 'Air bersih 300 liter', location: 'Demak', category: 'Gempa', victims: '15 keluarga', access: 'Akses terbuka', urgency: 'Mendesak' };
  const text = buildReportText('report-needs', answers, questions, 'Banjir, 12 keluarga membutuhkan 200 liter air bersih');
  assert.match(text, /12 keluarga membutuhkan 200 liter/); // Preserved for human review.
  const extraction = heuristicExtract(text, answers.location, answers.category);
  assert.equal(extraction.affectedHouseholds, 15);
  assert.equal(extraction.disasterType, 'earthquake');
  assert.equal(extraction.needs[0].quantity, 300);
});
