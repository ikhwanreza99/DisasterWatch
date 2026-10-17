import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../src/i18n/translations';
import { LanguageProvider, loadEnglishTranslations } from '../src/i18n';
import CalculationVerificationPage from '../src/components/CalculationVerificationPage';
import { aidAssumptionText } from '../src/i18n/incidentText';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

/** Decode JS string-literal escapes so keys match the runtime dictionary. */
function unescapeLiteral(raw: string): string {
  return raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|n|r|t|b|f|v|0|'|"|`|\\)/g, (m, g: string) => {
    switch (g) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'b': return '\b';
      case 'f': return '\f';
      case 'v': return '\v';
      case '0': return '\0';
      case "'": return "'";
      case '"': return '"';
      case '`': return '`';
      case '\\': return '\\';
      default:
        if (g[0] === 'x') return String.fromCharCode(parseInt(g.slice(1), 16));
        if (g[0] === 'u' && g[1] === '{') return String.fromCodePoint(parseInt(g.slice(2, -1), 16));
        if (g[0] === 'u') return String.fromCharCode(parseInt(g.slice(1), 16));
        return m;
    }
  });
}

/** Extract literal keys passed to t()/translate() plus statusText rule keys. */
function extractReferencedKeys(files: string[]): Map<string, string> {
  const found = new Map<string, string>();
  const callRe = /\b(?:t|translate)\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const file of files) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    let m: RegExpExecArray | null;
    while ((m = callRe.exec(source))) {
      const key = unescapeLiteral(m[2]);
      if (!found.has(key)) found.set(key, file.replace(process.cwd() + '/', ''));
    }
    if (file.endsWith('statusText.ts')) {
      for (const km of source.matchAll(/\bkey:\s*'((?:\\.|[^'])*)'/g)) {
        const key = unescapeLiteral(km[1]);
        if (!found.has(key)) found.set(key, file.replace(process.cwd() + '/', ''));
      }
    }
  }
  return found;
}

const placeholders = (value: string): string => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every referenced translation key exists in the English dictionary', () => {
  const referenced = extractReferencedKeys(walk(SRC));
  assert.ok(referenced.size > 500, `expected a broad key scan, found ${referenced.size}`);
  const missing = [...referenced.entries()].filter(([key]) => !(key in en));
  assert.deepEqual(
    missing.map(([key, file]) => `${key}  <- ${file}`),
    [],
    'translation key(s) referenced but missing from the English dictionary',
  );
});

test('no English translation value is empty or whitespace-only', () => {
  const empty = Object.entries(en).filter(([, value]) => !value || !String(value).trim());
  assert.deepEqual(empty, []);
});

test('Indonesian key and English value use the same interpolation placeholders', () => {
  const mismatched = Object.entries(en)
    .filter(([key, value]) => placeholders(key) !== placeholders(value))
    .map(([key, value]) => ({ key, id: placeholders(key), expected: placeholders(value), value }));
  assert.deepEqual(mismatched, []);
});

test('aid allocation assumption labels localize without changing units or factors', () => {
  assert.equal(aidAssumptionText('1 paket/30 jiwa', 'en'), '1 package/30 people');
  assert.equal(aidAssumptionText('1 porsi/jiwa · 1 kali makan', 'en'), '1 portion/person · 1 meal');
  assert.equal(aidAssumptionText('1 dus = 24 pcs · 1 pcs/jiwa (isi dari sumber)', 'en'), '1 dus = 24 pcs · 1 piece/person (contents from source)');
  assert.equal(aidAssumptionText('1 paket/30 jiwa', 'id'), '1 paket/30 jiwa');
});

test('/calculation renders Indonesian by default and fully English for the English dictionary', async () => {
  await loadEnglishTranslations();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    // Indonesian (source language): the localised title is shown.
    Reflect.deleteProperty(globalThis, 'window');
    const idHtml = renderToStaticMarkup(
      <LanguageProvider>
        <CalculationVerificationPage />
      </LanguageProvider>,
    );
    assert.match(idHtml, /Mesin Kalkulasi/);
    assert.match(idHtml, /Pusat Verifikasi Kalkulasi/);
    assert.match(idHtml, /Kesiapan Data/);

    // English: every visible heading/card label switches language.
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: { getItem: () => 'en' } },
    });
    const enHtml = renderToStaticMarkup(
      <LanguageProvider>
        <CalculationVerificationPage />
      </LanguageProvider>,
    );
    for (const text of [
      'Calculation Engine',
      'Calculation Verification Center',
      'Formulas Implemented',
      'Tests Passed',
      'Live Calculations',
      'Key calculation results',
      'Data Readiness',
      'Back to map',
      'Simulation example',
    ]) {
      assert.ok(enHtml.includes(text), `expected English calculation page to contain "${text}"`);
    }
    assert.doesNotMatch(enHtml, /Mesin Kalkulasi|Kesiapan Data|Formula Terimplementasi|Uji Lolos|Kalkulasi Live/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
