import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyBundleText,
  classifyEnvExampleLine,
  classifySrcLine,
  classifyWorkflowLine,
  isGeminiKeySetInEnv,
  isTestFile,
} from './geminiSecretScan.ts';

// All fixtures below are synthetic. No real credentials are used anywhere.

test('code reads of VITE_GEMINI_API_KEY are flagged', () => {
  assert.deepEqual(classifySrcLine("const k = import.meta.env.VITE_GEMINI_API_KEY || '';"), [
    'CODE_READS_VITE_GEMINI_API_KEY',
  ]);
  assert.deepEqual(classifySrcLine("const v = env?.['VITE_GEMINI_API_KEY'];"), ['CODE_READS_VITE_GEMINI_API_KEY']);
});

test('SECURITY comments mentioning the variable are not flagged', () => {
  assert.deepEqual(classifySrcLine('// reference VITE_GEMINI_API_KEY — that variable must not exist.'), []);
  assert.deepEqual(classifySrcLine('# SECURITY: VITE_GEMINI_API_KEY is no longer used.'), []);
});

test('direct Gemini transport markers in src are flagged', () => {
  assert.ok(classifySrcLine("headers: { 'x-goog-api-key': key },").includes('BROWSER_SENDS_X_GOOG_API_KEY'));
  assert.ok(
    classifySrcLine("fetch('https://generativelanguage.googleapis.com/v1beta/models/x:generateContent')").includes(
      'BROWSER_DIRECT_GENERATIVELANGUAGE_CALL',
    ),
  );
});

test('Firebase public config is NOT classified as a Gemini secret', () => {
  // Firebase web API key (public client config) must not false-positive.
  assert.deepEqual(classifySrcLine("const k = import.meta.env.VITE_FIREBASE_API_KEY || '';"), []);
  assert.deepEqual(classifySrcLine("apiKey: readEnv('VITE_FIREBASE_API_KEY'),"), []);
  assert.deepEqual(classifySrcLine("const k = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';"), []);
  // A public-looking AIza value on its own is not a finding (we never match key values).
  assert.deepEqual(classifySrcLine("// config apiKey: AIzaFakePublicClientConfigValue0123456789"), []);
});

test('test fixtures are exempt from the file walk', () => {
  assert.equal(isTestFile('src/services/status/model.test.ts'), true);
  assert.equal(isTestFile('src/lib/firebase/ai.ts'), false);
});

test('workflow build-env injection is flagged, comments are not', () => {
  assert.deepEqual(classifyWorkflowLine('          VITE_GEMINI_API_KEY: ${{ secrets.VITE_GEMINI_API_KEY }}'), [
    'WORKFLOW_INJECTS_VITE_GEMINI_API_KEY',
  ]);
  assert.deepEqual(classifyWorkflowLine('# SECURITY: VITE_GEMINI_API_KEY is no longer used.'), []);
  assert.deepEqual(classifyWorkflowLine('          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}'), []);
});

test('.env.example must not define the variable', () => {
  assert.deepEqual(classifyEnvExampleLine('VITE_GEMINI_API_KEY='), ['ENV_EXAMPLE_DEFINES_VITE_GEMINI_API_KEY']);
  assert.deepEqual(classifyEnvExampleLine('# VITE_GEMINI_API_KEY='), []);
  assert.deepEqual(classifyEnvExampleLine('# SECURITY: Do NOT use VITE_GEMINI_API_KEY.'), []);
});

test('build-time env guard trips only when the secret var is set', () => {
  assert.equal(isGeminiKeySetInEnv({}), false);
  assert.equal(isGeminiKeySetInEnv({ VITE_GEMINI_API_KEY: '' }), false);
  assert.equal(isGeminiKeySetInEnv({ VITE_GEMINI_API_KEY: '   ' }), false);
  assert.equal(isGeminiKeySetInEnv({ VITE_GEMINI_API_KEY: 'synthetic-placeholder' }), true);
});

test('bundle markers flag the removed transport without touching vendor SDK strings', () => {
  assert.deepEqual(classifyBundleText('foo Gemini Direct bar'), ['BUNDLE_CONTAINS_REMOVED_DIRECT_TRANSPORT']);
  assert.deepEqual(classifyBundleText('foo VITE_GEMINI_API_KEY bar'), ['BUNDLE_CONTAINS_GEMINI_KEY_VAR']);
  // Vendor Firebase SDK internals must not false-positive.
  assert.deepEqual(classifyBundleText('fetch("https://generativelanguage.googleapis.com/v1beta")'), []);
  assert.deepEqual(classifyBundleText('headers:{"x-goog-api-key":k}'), []);
});
