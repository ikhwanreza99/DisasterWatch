// Property 1: Bug Condition - Google sign-in completes, falls back, or reports the real error.
// Encodes the EXPECTED behavior; it is expected to FAIL on unfixed code.
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9**
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

// Small seeded PRNG (mulberry32) so generated cases are reproducible.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
}

const GENERIC = 'Login Google belum berhasil. Silakan coba lagi.';
const FALLBACK_CODES = [
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
];
const MOBILE_OR_EMBEDDED_UAS: Record<string, string> = {
  'Android Chrome':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'iPhone Safari':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  Instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0',
  'Facebook FBAN':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0]',
  'Android WebView':
    'Mozilla/5.0 (Linux; Android 13; SM-A536E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36',
};
const SOURCES = ['report', 'avatar', 'ai-helpdesk'] as const;

test('2.2 known Firebase codes map to code-specific Indonesian messages', async () => {
  const { mapAuthError } = await import('../src/lib/firebase/authErrors.ts');
  for (const code of [
    'auth/cancelled-popup-request',
    'auth/unauthorized-domain',
    'auth/operation-not-allowed',
    'auth/network-request-failed',
    'auth/internal-error',
    'auth/operation-not-supported-in-this-environment',
  ]) {
    const msg = mapAuthError(code);
    assert.ok(typeof msg === 'string' && msg.length > 0, `empty message for ${code}`);
    assert.notEqual(msg, GENERIC, `generic message for ${code}`);
  }
});

test('2.2 unknown codes produce a message containing the code (seeded)', async () => {
  const { mapAuthError } = await import('../src/lib/firebase/authErrors.ts');
  const next = rng(20240501);
  for (let i = 0; i < 100; i++) {
    const code = `auth/x-${Math.floor(next() * 1e9)}`;
    assert.ok(mapAuthError(code).includes(code), `message for ${code} lacks the code`);
  }
});

test('2.3 fallback codes trigger the redirect fallback', async () => {
  const { shouldFallbackToRedirect } = await import('../src/lib/firebase/authFlow.ts');
  for (const code of FALLBACK_CODES) assert.equal(shouldFallbackToRedirect(code), true, code);
});

test('2.3 mobile and embedded browsers prefer redirect', async () => {
  const { prefersRedirect } = await import('../src/lib/firebase/authFlow.ts');
  for (const [name, ua] of Object.entries(MOBILE_OR_EMBEDDED_UAS)) {
    assert.equal(prefersRedirect(ua), true, name);
  }
});

test('2.4 login intent round-trips once across a redirect (seeded)', async () => {
  const { saveLoginIntent, takeLoginIntent } = await import('../src/lib/firebase/authFlow.ts');
  const next = rng(42);
  for (let i = 0; i < 100; i++) {
    const store = memoryStorage();
    const source = SOURCES[Math.floor(next() * SOURCES.length)];
    const now = 1_700_000_000_000 + Math.floor(next() * 1e10);
    saveLoginIntent(store, source, now);
    assert.equal(takeLoginIntent(store, now + 1000), source);
    assert.equal(takeLoginIntent(store, now + 2000), null);
  }
});

test('1.3/1.4/2.6 auth.ts uses redirect APIs and exports the new flow', () => {
  const src = read('src/lib/firebase/auth.ts');
  const importBlock = src.match(/import\s*\{([^}]*)\}\s*from\s*'firebase\/auth'/)?.[1] ?? '';
  for (const fn of ['signInWithRedirect', 'getRedirectResult']) {
    assert.ok(new RegExp(`\\b${fn}\\b`).test(importBlock), `${fn} not imported`);
    assert.ok(new RegExp(`\\b${fn}\\s*\\(`).test(src), `${fn} not called`);
  }
  for (const name of ['signInWithGoogle', 'consumeRedirectResult', 'signOutUser']) {
    assert.ok(
      new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\b|export\\s+const\\s+${name}\\b`).test(src),
      `${name} not exported`,
    );
  }
});

test('1.5/1.6 header avatar is a button with an Indonesian label and a Keluar action', () => {
  const src = read('src/components/Header.tsx');
  // Scan each <button>…</button> block (attributes may contain `=>`, so no [^>] tricks).
  const buttons = src.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
  const avatarButton = buttons.find((b) => /<img\b/.test(b) && /aria-label=[^\n]*(Masuk|Akun)/.test(b));
  assert.ok(avatarButton, 'avatar <img> is not wrapped in a <button> with an Indonesian aria-label');
  assert.ok(src.includes('Keluar'), 'no Keluar sign-out action');
});

test('1.7/2.9 LoginModal only uses previewUser() after checking isFirebaseConfigured()', () => {
  const src = read('src/components/LoginModal.tsx');
  const previewCall = src.search(/onSuccess\(\s*previewUser\(\)\s*\)/);
  if (previewCall === -1) return; // no preview path at all is acceptable
  const guard = src.slice(Math.max(0, previewCall - 200), previewCall);
  assert.match(guard, /!\s*isFirebaseConfigured\(\)/, 'previewUser() reachable without a !isFirebaseConfigured() guard');
});

test('1.1/1.8/2.8 deploy workflow builds with the same-origin web.app authDomain', () => {
  const src = read('.github/workflows/deploy-hosting.yml');
  const line = src.split('\n').find((l) => /^\s*VITE_FIREBASE_AUTH_DOMAIN\s*:/.test(l));
  assert.ok(line, 'VITE_FIREBASE_AUTH_DOMAIN not set in workflow');
  // Compare without echoing the line in case it references a secret.
  const value = line.split(':').slice(1).join(':').trim().replace(/^['"]|['"]$/g, '');
  assert.ok(value === 'disasterwatch-61ed5.web.app', 'VITE_FIREBASE_AUTH_DOMAIN is not the literal web.app hosting domain');
});
