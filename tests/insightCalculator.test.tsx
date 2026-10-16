import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InsightCalculator } from '../src/components/detail/InsightCalculator';
import { SidebarDetailTemplate } from '../src/components/SidebarDetailTemplate';
import { LanguageProvider } from '../src/i18n';
import { disastersData } from '../src/data/disasters';

test('the impact calculator is a labelled simulation that never invents results', () => {
  const markup = renderToStaticMarkup(
    <LanguageProvider>
      <InsightCalculator incidentId="padang" />
    </LanguageProvider>,
  );
  assert.match(markup, /Perhitungan dampak &amp; kebutuhan/);
  assert.match(markup, /Simulasi — bukan data resmi/);
  // Empty inputs must surface as "Belum tersedia", never as a computed number.
  assert.match(markup, /Belum tersedia/);
  // Interpolation resolves the method version and the incident area.
  assert.match(markup, /disaster-insights-v1\.0/);
  assert.match(markup, /Area: padang/);
  assert.doesNotMatch(markup, /\{version\}|\{area\}/);
  // The Padang demo baseline (Rp 3,8 Miliar, 54%, 45/62/48/61) must not leak in.
  assert.doesNotMatch(markup, /3,8/);
  assert.doesNotMatch(markup, />54%</);
  assert.doesNotMatch(markup, />45%</);
});

test('the scenario calculator stays hidden in the detail panel', () => {
  const markup = renderToStaticMarkup(
    <LanguageProvider>
      <SidebarDetailTemplate
        news={<div />}
        disaster={disastersData.padang}
        onOpenRoute={() => {}}
        onClose={() => {}}
        onOpenAIHelpdesk={() => {}}
        onOpenDonationModal={() => {}}
        onOpenDisasterBrief={() => {}}
      />
    </LanguageProvider>,
  );
  assert.match(markup, /Kesenjangan Bantuan/);
  assert.doesNotMatch(markup, /data-testid="insight-calculator"/);
  assert.doesNotMatch(markup, /Perhitungan dampak/);
});
