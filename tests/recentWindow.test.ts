import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inRecentWindow, recentWindow } from '../src/services/recentWindow.ts';
import { allCurrentRecords, recentRecords } from '../src/data/currentIncidents.ts';
import { buildIncidentQueries, descriptorFor } from '../src/services/incidentRegistry.ts';
import { classifyRelevance } from '../src/services/incidentNews.ts';
import { currentMedia } from '../src/data/currentMedia.ts';

const now = Date.parse('2026-10-13T23:00:00+07:00');
test('seven WIB dates include today, reject old/future dates and roll at WIB midnight', () => {
  assert.equal(recentWindow(now).startDate, '2026-10-07');
  assert.equal(recentWindow(now).endDate, '2026-10-13');
  assert.equal(inRecentWindow('2026-10-07T00:00:00+07:00', now), true);
  for (const date of ['2026-10-06T23:59:59+07:00', '2026-10-14', 'invalid', '2026-10-13T23:01:00+07:00']) assert.equal(inRecentWindow(date, now), false);
  assert.equal(inRecentWindow('2026-10-07', now), true);
  const tomorrow = Date.parse('2026-10-14T00:00:00+07:00');
  assert.equal(recentWindow(tomorrow).startDate, '2026-10-08');
  assert.equal(inRecentWindow('2026-10-07', tomorrow), false);
});
test('BNPB groups retain only recent reports and recompute group dates without modifying source snapshot', () => {
  const records = recentRecords(allCurrentRecords, now);
  assert(records.length > 0 && records.length < allCurrentRecords.length);
  assert(records.every(r => inRecentWindow(r.date, now) && (r.reports ?? []).every(p => inRecentWindow(p.date, now))));
  assert(allCurrentRecords.some(r => r.reports?.some(p => p.date < '2026-10-07')));
  assert.equal(recentRecords(allCurrentRecords, Date.parse('2027-01-01T12:00:00+07:00')).length, 0);
});
test('Zapi and SerpApi incident queries move with today instead of fixed October dates', () => {
  const d = descriptorFor('padang')!;
  assert(buildIncidentQueries(d, now).every(q => q.includes('after:2026-10-06 before:2026-10-14')));
  assert(buildIncidentQueries(d, Date.parse('2026-10-20T12:00:00+07:00')).every(q => q.includes('after:2026-10-13 before:2026-10-21')));
});
test('old explicitly linked articles cannot bypass the window; recent incident news can match', () => {
  const d = descriptorFor('padang')!;
  const article = { ...currentMedia[0], incidentId: 'padang', publishedAt: '2026-10-06T10:00:00+07:00' };
  assert.equal(classifyRelevance(article, d, now).status, 'REJECTED');
  assert.equal(classifyRelevance({ ...article, incidentId: null, title: 'Banjir Kota Padang Kuranji', publishedAt: '2026-10-13T10:00:00+07:00' }, d, now).status, 'MATCHED');
});
