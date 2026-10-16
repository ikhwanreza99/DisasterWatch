import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentIncidents } from '../src/data/currentIncidents.ts';
import { asksRecentDisasters, recentDisasterList, recentDisasterContext } from '../src/services/ai/recentDisasterList.ts';

test('assistant uses fourteen WIB calendar days and includes the newly sourced reports', () => {
  const now = Date.parse('2026-10-17T12:00:00+07:00');
  const list = recentDisasterList(currentIncidents, now);
  assert.equal(list.startDate, '2026-10-04');
  assert.equal(list.endDate, '2026-10-17');
  assert.equal(list.latestDate, '2026-10-14');
  assert.ok(list.records.some(record => record.name === 'Pasuruan' && record.date === '2026-10-14'));
  assert.ok(list.records.every(record => record.date >= list.startDate && record.date <= list.endDate));
  assert.match(recentDisasterContext(currentIncidents, now), /belum tentu lengkap/);
});

test('assistant list respects visibility, expiry, missing dates and future dates', () => {
  const incident = currentIncidents.padang;
  const entries = Object.fromEntries([
    { ...incident, id: 'visible', eventDate: '2026-10-04' },
    { ...incident, id: 'expired', eventDate: '2026-10-03' },
    { ...incident, id: 'future', eventDate: '2026-10-18' },
    { ...incident, id: 'undated' },
  ].map(record => [record.id, record]));
  assert.deepEqual(recentDisasterList(entries, Date.parse('2026-10-17T12:00:00+07:00')).records.map(record => record.id), ['visible']);
  assert.equal(recentDisasterList({}, Date.parse('2026-10-17')).latestDate, null);
});

test('recognises the requested fourteen-day list in Indonesian and English', () => {
  for (const question of ['tambahkan bencana 14 hari terakhir sejak hari ini', 'daftar insiden dua minggu', 'disasters in the last 14 days']) assert.ok(asksRecentDisasters(question));
  assert.equal(asksRecentDisasters('bantuan 14 hari'), false);
});
