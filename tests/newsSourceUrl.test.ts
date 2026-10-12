import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {newsSourceUrl} from '../src/services/newsSourceUrl.ts';
import {IncidentNewsPanel} from '../src/components/detail/IncidentNewsPanel.tsx';
import {currentMedia} from '../src/data/currentMedia.ts';

test('publisher links remain direct and explicit redirect links are unwrapped', () => {
  const source = currentMedia[0].url;
  assert.equal(newsSourceUrl(source), source);
  assert.equal(newsSourceUrl(`https://www.google.com/url?url=${encodeURIComponent(source)}`), source);
  for (const value of ['https://news.google.com/rss/articles/opaque', 'javascript:alert(1)', 'https://user:password@example.com/a', 'https://127.0.0.1/a', 'broken']) assert.equal(newsSourceUrl(value), null);
});
test('each reviewed media headline opens its own publisher URL in a new tab', () => {
  for (const item of currentMedia) {
    const html = renderToStaticMarkup(React.createElement(IncidentNewsPanel, {
      incidentName: 'Test', matched: [item], review: [], freshness: {lastAttemptAt:null,lastSuccessAt:null,error:null},
    }));
    assert.ok(html.includes(`href="${item.url}"`));
    assert.ok(html.includes('target="_blank"'));
    assert.ok(html.includes('rel="noopener noreferrer"'));
    assert.ok(html.includes(item.title));
  }
});

test('BNPB title links to the documentation for its own report and labels the event date', async () => {
  const {currentArticles, currentRecords} = await import('../src/data/currentIncidents.ts');
  const record = currentRecords.find(r => r.id === 'merauke-2026-10')!;
  const report = record.reports!.find(r => r.documentationUrl)!;
  const card = currentArticles.find(a => a.incidentId === record.id && a.discoveredBy === 'bnpb-documentation')!;
  assert.equal(card.url, report.documentationUrl);
  assert.ok(card.url.startsWith('https://drive.google.com/'));
  assert.equal(card.publishedAt, null);
  const html = renderToStaticMarkup(React.createElement(IncidentNewsPanel, {
    incidentName: record.name, matched: [card], review: [], freshness: {lastAttemptAt:null,lastSuccessAt:null,error:null},
  }));
  assert.ok(html.includes(`href="${card.url}"`));
  assert.ok(html.includes('Tanggal kejadian: 9 Okt 2026'));
  assert.ok(!html.includes('Tanggal terbit belum tersedia'));
});
