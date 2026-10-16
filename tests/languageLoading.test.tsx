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
