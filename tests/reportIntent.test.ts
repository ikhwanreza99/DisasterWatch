import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectReportIntent } from '../src/services/ai/reportIntent';

test('information inquiries do not request report login', () => {
  for (const text of ['Bagaimana mitigasi banjir?', 'Apa laporan terbaru di Demak?', 'Bagaimana cara melaporkan bencana?', 'Bagaimana cuaca di sini?']) {
    assert.equal(detectReportIntent(text), null);
  }
});
test('disaster, aid, and other first-hand reports are recognised', () => {
  assert.equal(detectReportIntent('Saya ingin melaporkan banjir'), 'report-disaster');
  assert.equal(detectReportIntent('Saya ingin melaporkan bantuan'), 'report-needs');
  assert.equal(detectReportIntent('Kami membutuhkan air bersih'), 'report-needs');
  assert.equal(detectReportIntent('Laporan jalan rusak di desa'), 'report-disaster');
});
