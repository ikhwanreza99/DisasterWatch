import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider, loadEnglishTranslations, translate, useI18n } from '../src/i18n';

function Labels() {
 const { t, locale } = useI18n();
 return <span>{locale}: {t('Laporkan Bencana')} · {t('Memuat peta…')}</span>;
}

test('Indonesian renders immediately and saved English renders translated after dictionary load', async () => {
 assert.match(renderToStaticMarkup(<LanguageProvider><Labels /></LanguageProvider>), /id-ID: Laporkan Bencana/);
 await loadEnglishTranslations();
 const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
 Object.defineProperty(globalThis, 'window', {configurable:true,value:{localStorage:{getItem:()=> 'en'}}});
 try {
  const html = renderToStaticMarkup(<LanguageProvider><Labels /></LanguageProvider>);
  assert.match(html, /en-US:/);
  assert.match(html, /Loading map/);
  assert.doesNotMatch(html, /Laporkan Bencana|Memuat peta/);
  assert.equal(translate('Memuat peta…'), 'Loading map…');
 } finally {
  if (original) Object.defineProperty(globalThis, 'window', original);
  else Reflect.deleteProperty(globalThis, 'window');
 }
});

test('new browser visits default to English while a saved Indonesian choice is retained', async () => {
  await loadEnglishTranslations();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: { getItem: () => null } },
    });
    const defaultHtml = renderToStaticMarkup(<LanguageProvider><Labels /></LanguageProvider>);
    assert.match(defaultHtml, /en-US:/);
    assert.match(defaultHtml, /Report a Disaster/);

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: { getItem: () => 'id' } },
    });
    const savedHtml = renderToStaticMarkup(<LanguageProvider><Labels /></LanguageProvider>);
    assert.match(savedHtml, /id-ID:/);
    assert.match(savedHtml, /Laporkan Bencana/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});


test('generated incident labels translate without changing Indonesian source data or location names', async () => {
  const { incidentText } = await import('../src/i18n/incidentText.ts');
  const recovery = '41.2% terpenuhi · estimasi bantuan (5/9 kategori)';
  assert.equal(incidentText(recovery, 'en'), '41.2% fulfilled · estimated aid (5/9 categories)');
  assert.equal(incidentText(recovery, 'id'), recovery);
  assert.equal(incidentText('Laporan 2026-10-06 · Ditinjau 12 Okt 2026', 'en'), 'Reported 2026-10-06 · Reviewed 12 Oct 2026');
  assert.equal(incidentText('Kecamatan: Kec. Watukumpul Ds. Tanah Merah', 'en'), 'Districts: Dist. Watukumpul Village Tanah Merah');
  const { en } = await import('../src/i18n/translations.ts');
  assert.equal(en['Tanah Longsor'], 'Landslide');
  assert.equal(en['Jawa Tengah'], 'Central Java');
  assert.equal(en['jiwa'], 'people');
});

test('dynamic status report text is translated while retaining live counts and dates', async () => {
  const { translateStatusText } = await import('../src/i18n/statusText.ts');
  const { en } = await import('../src/i18n/translations.ts');
  const english = (key: string, params?: Record<string, string | number | null | undefined>) =>
    (en[key] ?? key).replace(/\{(\w+)\}/g, (token, name: string) => {
      const value = params?.[name];
      return value === undefined || value === null ? token : String(value);
    });

  assert.equal(
    translateStatusText('Dataset · 14 hari terakhir', english),
    'Dataset · last 14 days',
  );
  assert.equal(
    translateStatusText(
      'Tersimpan 1267 artikel. Sampel 500: 146 sesuai kejadian, 132 perlu review. Berita digabung dengan sumber lain setelah pemeriksaan lokasi dan tanggal.',
      english,
    ),
    '1267 articles stored. Sample of 500: 146 match incidents, 132 need review. News is merged with other sources after location and date checks.',
  );
  assert.equal(
    translateStatusText(
      'Respons Air Quality API valid untuk Jakarta; UAQI 32 (Kualitas udara rendah).',
      english,
    ),
    'Valid Air Quality API response for Jakarta; UAQI 32 (Low air pollution).',
  );
  assert.equal(
    translateStatusText(
      'Terakhir: SUCCESS. Tertahan interval 5 hari. Artikel Gemini tersimpan: 100; seluruh artikel: 500.',
      english,
    ),
    'Last run: SUCCESS. Held by the 5-day interval. Gemini articles stored: 100; all articles: 500',
  );
});
