import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LanguageProvider, loadEnglishTranslations } from '../src/i18n';
import {
  newsDisplayText,
  newsOriginalLanguageLabel,
  newsTranslationProviderConfigured,
  looksIndonesian,
  requestNewsTranslation,
  setNewsTranslationProvider,
} from '../src/i18n/newsText';
import { IncidentNewsPanel } from '../src/components/detail/IncidentNewsPanel';
import type { IncidentArticle } from '../src/domain/incidentDetail';

// Fixtures mirror the production screenshot (Padang flood coverage). The
// English strings below are the curated dictionary entries — NOT fabricated
// provider output; provider behavior is mocked separately.
const ID_TITLE = 'Pembersihan material banjir bandang di Padang';
const EN_TITLE = 'Cleanup of flash-flood debris in Padang';
const ID_TITLE_2_REAL = 'Bantuan Pascabanjir Padang Menjangkau 250 Keluarga di Koto Tangah dan Kuranji';
const EN_TITLE_2 = 'Post-flood aid for Padang reaches 250 families in Koto Tangah and Kuranji';
const ID_TITLE_3 = 'KemenPU Percepatan Pemulihan Fasum dan Permukiman Terdampak Banjir di Padang';
const ID_SUMMARY = 'Pembersihan material banjir bandang di Padang dilaporkan oleh tim TRC setempat.';
const UNTREATED_ID_TITLE = 'Luapan air rendam jalan utama di kota Padang';

const fixture = (over: Partial<IncidentArticle> & { title: string }): IncidentArticle => ({
  url: 'https://www.infopublik.id/berita/2026/pembersihan-banjir-padang',
  sourceName: 'InfoPublik',
  sourceType: 'NEWS_MEDIA',
  publishedAt: '2026-10-14T08:00:00+07:00',
  retrievedAt: '2026-10-15T08:00:00+07:00',
  summary: ID_SUMMARY,
  contentStatus: 'METADATA_ONLY',
  incidentId: 'padang',
  discoveredBy: 'reviewed-publisher-metadata',
  ...over,
});

function renderWithLang(lang: 'id' | 'en', node: React.ReactElement): string {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: () => lang }, addEventListener() {}, removeEventListener() {}, location: { href: 'http://x/', pathname: '/' } },
  });
  try {
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

const panelNode = (articles: IncidentArticle[]) => (
  <IncidentNewsPanel
    incidentName="Banjir Padang"
    matched={articles}
    review={[]}
    freshness={{ lastAttemptAt: null, lastSuccessAt: '2026-10-15T08:00:00+07:00', error: null }}
  />
);

test('Indonesian headline displays in Indonesian when ID is selected', async () => {
  await loadEnglishTranslations();
  const display = newsDisplayText(ID_TITLE, 'id');
  assert.equal(display.text, ID_TITLE);
  assert.equal(display.status, 'original');
  const html = renderWithLang('id', panelNode([fixture({ title: ID_TITLE })]));
  assert.match(html, /Pembersihan material banjir bandang di Padang/);
  assert.doesNotMatch(html, /Cleanup of flash-flood debris/);
});

test('Indonesian headline displays its curated English translation when EN is selected', async () => {
  await loadEnglishTranslations();
  const display = newsDisplayText(ID_TITLE, 'en');
  assert.equal(display.status, 'translated');
  assert.equal(display.text, EN_TITLE);
  const html = renderWithLang('en', panelNode([fixture({ title: ID_TITLE })]));
  // The headline itself renders in English (the summary stays original —
  // flagged by the language badge).
  assert.match(html, />Cleanup of flash-flood debris in Padang — /);
  assert.match(html, /Bahasa Indonesia/);
});

test('switching ID -> EN updates the news panel content without a reload', async () => {
  await loadEnglishTranslations();
  const articles = [fixture({ title: ID_TITLE }), fixture({ title: ID_TITLE_2_REAL })];
  const idHtml = renderWithLang('id', panelNode(articles));
  assert.match(idHtml, /Pembersihan material banjir bandang di Padang/);
  assert.match(idHtml, /Bantuan Pascabanjir Padang Menjangkau 250 Keluarga/);
  // Same panel, new language (what a language toggle re-renders):
  const enHtml = renderWithLang('en', panelNode(articles));
  assert.match(enHtml, />Cleanup of flash-flood debris in Padang — /);
  assert.match(enHtml, />Post-flood aid for Padang reaches 250 families in Koto Tangah and Kuranji — /);
  // Headlines render English; untranslated summaries stay original + flagged.
  assert.match(enHtml, /Bahasa Indonesia/);
});

test('switching EN -> ID restores the original Indonesian content', async () => {
  await loadEnglishTranslations();
  const articles = [fixture({ title: ID_TITLE })];
  const enHtml = renderWithLang('en', panelNode(articles));
  assert.match(enHtml, /Cleanup of flash-flood debris in Padang/);
  const idHtml = renderWithLang('id', panelNode(articles));
  assert.match(idHtml, /Pembersihan material banjir bandang di Padang/);
  assert.doesNotMatch(idHtml, /Cleanup of flash-flood debris/);
});

test('original headlines, source attribution, and source URLs remain unchanged', async () => {
  await loadEnglishTranslations();
  const articles = [fixture({ title: ID_TITLE })];
  renderWithLang('id', panelNode(articles));
  renderWithLang('en', panelNode(articles));
  assert.equal(articles[0].title, ID_TITLE);
  assert.equal(articles[0].summary, ID_SUMMARY);
  assert.equal(articles[0].url, 'https://www.infopublik.id/berita/2026/pembersihan-banjir-padang');
  const enHtml = renderWithLang('en', panelNode(articles));
  // Provenance (publisher name + original URL) survives translation.
  assert.match(enHtml, /InfoPublik/);
  assert.match(enHtml, /https:\/\/www\.infopublik\.id\/berita\/2026\/pembersihan-banjir-padang/);
});

test('an already-English headline is not unnecessarily translated or mislabeled', async () => {
  await loadEnglishTranslations();
  const englishHeadline = 'Flash flooding reported in Padang';
  const display = newsDisplayText(englishHeadline, 'en');
  assert.equal(display.text, englishHeadline);
  assert.equal(display.status, 'original');
  assert.equal(newsOriginalLanguageLabel(englishHeadline, 'en'), null);
  assert.equal(looksIndonesian(englishHeadline), false);
  assert.equal(looksIndonesian(ID_TITLE), true);
});

test('a missing translation never produces an empty headline and is explicitly labeled', async () => {
  await loadEnglishTranslations();
  const display = newsDisplayText(UNTREATED_ID_TITLE, 'en');
  assert.equal(display.status, 'original');
  assert.equal(display.text, UNTREATED_ID_TITLE);
  assert.ok(display.text.trim().length > 0);
  // UI flags the original language instead of pretending it translated.
  assert.equal(newsOriginalLanguageLabel(UNTREATED_ID_TITLE, 'en'), 'Bahasa Indonesia');
  const html = renderWithLang('en', panelNode([fixture({ title: UNTREATED_ID_TITLE, summary: null })]));
  assert.match(html, />Luapan air rendam jalan utama di kota Padang</);
  assert.match(html, /Bahasa Indonesia/);
  assert.doesNotMatch(html, /Menerjemahkan/);
});

test('translation-provider failure falls back safely to the original text', async () => {
  await loadEnglishTranslations();
  setNewsTranslationProvider(async () => { throw new Error('provider down'); });
  try {
    const failure = await requestNewsTranslation(ID_TITLE_3, 'en');
    assert.equal(failure.status, 'failed');
    assert.equal(failure.text, ID_TITLE_3);
    // Invalid provider output (empty or echo of the source) is never accepted.
    setNewsTranslationProvider(async () => '   ');
    const empty = await requestNewsTranslation(ID_TITLE_3, 'en');
    assert.equal(empty.status, 'failed');
    assert.equal(empty.text, ID_TITLE_3);
    setNewsTranslationProvider(async () => ID_TITLE_3);
    const echo = await requestNewsTranslation(ID_TITLE_3, 'en');
    assert.equal(echo.status, 'failed');
    assert.equal(echo.text, ID_TITLE_3);
  } finally {
    setNewsTranslationProvider(null);
  }
  assert.equal(newsTranslationProviderConfigured(), false);
  // Without a provider the dictionary path still works and untranslated
  // headlines keep the original text.
  const fallback = newsDisplayText(ID_TITLE_3, 'en');
  assert.equal(fallback.status, 'original');
  assert.equal(fallback.text, ID_TITLE_3);
});

test('cached and newly loaded records follow the selected language without repeat work', async () => {
  await loadEnglishTranslations();
  let providerCalls = 0;
  setNewsTranslationProvider(async (text) => {
    providerCalls += 1;
    return `Translated: ${text}`;
  });
  try {
    const first = await requestNewsTranslation(ID_TITLE_3, 'en');
    assert.equal(first.status, 'translated');
    assert.equal(first.text, `Translated: ${ID_TITLE_3}`);
    const cached = newsDisplayText(ID_TITLE_3, 'en');
    assert.equal(cached.text, `Translated: ${ID_TITLE_3}`);
    assert.equal(providerCalls, 1, 'repeat resolution must reuse the cached translation');

    // A newly loaded record (never seen before) resolves through the same path.
    const fresh = await requestNewsTranslation(UNTREATED_ID_TITLE, 'en');
    assert.equal(fresh.text, `Translated: ${UNTREATED_ID_TITLE}`);
    assert.equal(providerCalls, 2);

    // The panel reuses the warmed cache on render — no extra provider work.
    const enHtml = renderWithLang('en', panelNode([fixture({ title: ID_TITLE_3 })]));
    assert.match(enHtml, new RegExp(`Translated: ${ID_TITLE_3.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.equal(providerCalls, 2, 'render must reuse cached translations');
    const idHtml = renderWithLang('id', panelNode([fixture({ title: ID_TITLE_3 })]));
    assert.match(idHtml, new RegExp(ID_TITLE_3.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    setNewsTranslationProvider(null);
  }
});

test('translation preserves quantities, dates, and location names', async () => {
  await loadEnglishTranslations();
  const display = newsDisplayText(ID_TITLE_2_REAL, 'en');
  assert.equal(display.status, 'translated');
  assert.equal(display.text, EN_TITLE_2);
  for (const preserved of ['250', 'Koto Tangah', 'Kuranji', 'Padang']) {
    assert.ok(display.text.includes(preserved), `expected "${preserved}" preserved in "${display.text}"`);
  }
});

test('news cards remain usable while a translation is pending', async () => {
  await loadEnglishTranslations();
  let resolveTranslation: (value: string) => void = () => {};
  setNewsTranslationProvider(() => new Promise<string>((resolve) => { resolveTranslation = resolve; }));
  try {
    const html = renderWithLang('en', panelNode([fixture({ title: ID_TITLE_3 })]));
    // Pending state: original content stays visible, card renders, source intact.
    assert.match(html, new RegExp(ID_TITLE_3.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, /Translating/);
    assert.match(html, /Open Source/);
  } finally {
    setNewsTranslationProvider(null);
    resolveTranslation('ignored');
  }
});

test('every news surface renders headlines through the shared presentation module', () => {
  const surfaces = [
    'src/components/detail/IncidentNewsPanel.tsx',
    'src/components/DisasterNewsCard.tsx',
    'src/components/CitizenReportsView.tsx',
    'src/components/NttCaseView.tsx',
    'src/admin/AdminPage.tsx',
  ];
  for (const file of surfaces) {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    assert.match(source, /newsText/, `${file} must use the shared news presentation module`);
  }
  // The Latest News Update panel itself must not render raw article titles.
  const panel = readFileSync(join(process.cwd(), 'src/components/detail/IncidentNewsPanel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /\{item\.title\}/);
  assert.doesNotMatch(panel, /\{item\.summary\}/);
});
