import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { currentRecords } from '../src/data/currentIncidents';
import { BnpbImpactCard } from '../src/components/detail/BnpbImpactCard';
import { IncidentNewsPanel } from '../src/components/detail/IncidentNewsPanel';
import { currentArticles } from '../src/data/currentIncidents';

test('BNPB impact preserves reported counts, blanks and explicit zero', () => {
  const record = currentRecords.find(r => r.name === 'Bangka Selatan')!;
  const report = record.reports!.find(r => r.date === '2026-10-10')!;
  assert.equal(report.impact!.damagedHomes, 305);
  assert.equal(report.impact!.deaths, null);
  assert.equal(report.impact!.damagedFacilities, 0);
  const markup = renderToStaticMarkup(<BnpbImpactCard incidentId={record.id}/>);
  assert.match(markup, /305/);
  assert.match(markup, /Belum tersedia/);
  assert.doesNotMatch(markup, /Estimasi Dampak/);
});

test('compact news keeps publishers together without source category separators', () => {
  const markup = renderToStaticMarkup(<IncidentNewsPanel incidentName="Padang" compact matched={currentArticles.filter(a => a.incidentId === 'padang')} review={[]} freshness={{lastAttemptAt:null,lastSuccessAt:null,error:null}}/>);
  assert.doesNotMatch(markup, /Dokumentasi BNPB/);
  assert.doesNotMatch(markup, /Berita media/);
  assert.match(markup, /liputan6.com\/regional\/read\/8310406/);
  assert.match(markup, /antaranews.com\/foto\/5780196/);
});
