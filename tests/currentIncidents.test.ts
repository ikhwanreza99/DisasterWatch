import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentArticles, currentIncidents, currentRecords } from '../src/data/currentIncidents.ts';
import { ACTIVE_NEWS_IDS, descriptorFor } from '../src/services/incidentRegistry.ts';
import { classifyRelevance } from '../src/services/incidentNews.ts';

test('every current location retains its report source and a crawl target', () => {
  for (const record of currentRecords) {
    assert.ok(ACTIVE_NEWS_IDS.includes(record.id));
    assert.ok(descriptorFor(record.id));
    assert.ok(record.url.startsWith('https://'));
    assert.equal(currentIncidents[record.id].route.checkpoints.length, 0);
    assert.equal(currentIncidents[record.id].cost, 'Belum tersedia');
  }
  assert.ok(!currentIncidents.cianjur);
  assert.ok(!currentIncidents['lombok-2018-08-05']);
});

test('current news requires matching location, disaster type and reporting date', () => {
  const descriptor = descriptorFor('merauke-2026-10')!;
  const candidate = { ...currentArticles[0], incidentId: null, title: 'Karhutla Merauke Tanah Miring', summary: null, publishedAt: '2026-10-10T00:00:00Z' };
  const now = Date.parse('2026-10-12T12:00:00Z');
  assert.equal(classifyRelevance(candidate, descriptor, now).status, 'MATCHED');
  for (const override of [{ publishedAt: '2024-10-10T00:00:00Z' }, { publishedAt: null }, { publishedAt: '2026-10-13T00:00:00Z' }, { title: 'Banjir Merauke Tanah Miring' }, { title: 'Karhutla Palembang' }]) {
    assert.notEqual(classifyRelevance({ ...candidate, ...override }, descriptor, now).status, 'MATCHED');
  }
});

test('all 86 BNPB reports are represented without losing dates or disaster types', async () => {
  const { NATIONAL_REPORT_COUNT } = await import('../src/data/currentIncidents.ts');
  assert.equal(NATIONAL_REPORT_COUNT, 86);
  assert.equal(currentRecords.length, 62);
  assert.equal(new Set(currentRecords.map(r => r.id)).size, currentRecords.length);
  for (const record of currentRecords) {
    assert.ok(record.lat >= -11 && record.lat <= 6 && record.lng >= 95 && record.lng <= 141);
    for (const report of record.reports ?? []) assert.ok(report.date >= '2026-10-01' && report.date <= '2026-10-12');
  }
  assert.ok(currentRecords.some(r => r.category === 'other' && r.disasterLabel === 'Kekeringan'));
  assert.ok(currentRecords.some(r => r.category === 'landslide'));
});

test('news displays calendar dates without hours and searches additional publishers', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { IncidentNewsPanel } = await import('../src/components/detail/IncidentNewsPanel.tsx');
  const { buildIncidentQueries } = await import('../src/services/incidentRegistry.ts');
  const html = renderToStaticMarkup(React.createElement(IncidentNewsPanel, {
    incidentName: 'Palembang', matched: [currentArticles.find(a => a.incidentId === 'palembang-2026-10')!], review: [],
    freshness: {lastAttemptAt: null, lastSuccessAt: null, error: null},
  }));
  assert.ok(html.includes('1 Okt 2026'));
  assert.ok(!html.includes('11:21') && !html.includes('WIB'));
  const queries = buildIncidentQueries(descriptorFor('palembang-2026-10')!).join(' ');
  for (const source of ['detik.com', 'rri.co.id', 'antaranews.com', 'kompas.com']) assert.ok(queries.includes(source));
});

test('Merauke news contains dated publisher articles, never BNPB table summaries or unrelated fires', () => {
  const articles = currentArticles.filter(a => a.incidentId === 'merauke-2026-10');
  assert.ok(articles.some(a => a.sourceName === 'RRI' && a.publishedAt?.startsWith('2026-10-04') && a.url.includes('/2786507/')));
  assert.ok(currentArticles.every(a => (a.publishedAt || a.eventDate) && !a.url.includes('/tabel/pencarian.php')));
  const unrelated = { ...articles[0], incidentId: null, title: 'Kebakaran pasar Merauke', summary: 'Korsleting mesin diesel membakar rumah.' };
  assert.notEqual(classifyRelevance(unrelated, descriptorFor('merauke-2026-10')!, Date.parse('2026-10-12T12:00:00Z')).status, 'MATCHED');
});
