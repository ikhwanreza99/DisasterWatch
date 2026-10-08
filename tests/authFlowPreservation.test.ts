// Property 2: Preservation - pure auth-flow helpers keep non-buggy behavior unchanged.
// Targets the pure APIs added in task 3.1 (authErrors.ts mapAuthError/logAuthError and
// authFlow.ts). On unfixed code these fail only because the module/exports do not exist yet.
// **Validates: Requirements 3.4**
import assert from 'node:assert/strict';
import { test } from 'node:test';

type Storage3 = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

type AuthErrorsModule = {
  mapAuthError: (code: string | undefined, fallbackMessage?: string) => string;
  logAuthError: (code: string | undefined, phase: 'popup' | 'redirect' | 'redirect-result' | 'signout') => void;
};
type LoginSource = 'report' | 'avatar' | 'ai-helpdesk';
type AuthFlowModule = {
  REDIRECT_FALLBACK_CODES: readonly string[];
  shouldFallbackToRedirect: (code: string | undefined) => boolean;
  prefersRedirect: (userAgent: string) => boolean;
  saveLoginIntent: (storage: Storage3 | null, source: LoginSource, now?: number) => void;
  takeLoginIntent: (storage: Storage3 | null, now?: number, maxAgeMs?: number) => LoginSource | null;
  clearLoginIntent: (storage: Storage3 | null) => void;
};

async function loadErrors(): Promise<AuthErrorsModule> {
  const mod = (await import('../src/lib/firebase/authErrors.ts')) as Partial<AuthErrorsModule>;
  assert.equal(typeof mod.mapAuthError, 'function', 'authErrors.ts must export mapAuthError');
  assert.equal(typeof mod.logAuthError, 'function', 'authErrors.ts must export logAuthError');
  return mod as AuthErrorsModule;
}

async function loadFlow(): Promise<AuthFlowModule> {
  const path = '../src/lib/firebase/authFlow.ts';
  const mod = (await import(path)) as Partial<AuthFlowModule>;
  for (const name of ['shouldFallbackToRedirect', 'prefersRedirect', 'saveLoginIntent', 'takeLoginIntent', 'clearLoginIntent'] as const) {
    assert.equal(typeof mod[name], 'function', `authFlow.ts must export ${name}`);
  }
  return mod as AuthFlowModule;
}

// Seeded PRNG (mulberry32) for reproducible generated cases.
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

function memoryStorage(): Storage3 & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

const INTENT_KEY = 'dw.loginIntent';
const SOURCES: LoginSource[] = ['report', 'avatar', 'ai-helpdesk'];
const MAX_AGE = 10 * 60_000;
const FALLBACK = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
]);

const DESKTOP_UAS: Record<string, string> = {
  'Desktop Chrome':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Desktop Firefox': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Desktop Safari':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Desktop Edge':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
};

test('shouldFallbackToRedirect is false for popup-closed-by-user and random non-fallback codes (3.4)', async () => {
  const { shouldFallbackToRedirect } = await loadFlow();
  assert.equal(shouldFallbackToRedirect('auth/popup-closed-by-user'), false);
  assert.equal(shouldFallbackToRedirect(undefined), false);
  const next = rng(2024);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz-';
  for (let i = 0; i < 200; i++) {
    let suffix = '';
    const len = 1 + Math.floor(next() * 30);
    for (let j = 0; j < len; j++) suffix += alphabet[Math.floor(next() * alphabet.length)];
    const code = `auth/${suffix}`;
    if (FALLBACK.has(code)) continue;
    assert.equal(shouldFallbackToRedirect(code), false, `unexpected fallback for ${code}`);
  }
});

test('prefersRedirect is false for desktop browsers (popup-first preserved)', async () => {
  const { prefersRedirect } = await loadFlow();
  for (const [name, ua] of Object.entries(DESKTOP_UAS)) {
    assert.equal(prefersRedirect(ua), false, `${name} should stay popup-first`);
  }
});

test("mapAuthError('auth/popup-closed-by-user') keeps the existing text (3.4)", async () => {
  const { mapAuthError } = await loadErrors();
  assert.equal(mapAuthError('auth/popup-closed-by-user'), 'Login dibatalkan. Silakan coba lagi.');
});

test('intent helpers never throw on bad storage or bad data and return null', async () => {
  const { saveLoginIntent, takeLoginIntent, clearLoginIntent } = await loadFlow();
  const throwing: Storage3 = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
  const now = 1_700_000_000_000;
  for (const storage of [throwing, null]) {
    assert.doesNotThrow(() => saveLoginIntent(storage, 'report', now));
    assert.equal(takeLoginIntent(storage, now), null);
    assert.doesNotThrow(() => clearLoginIntent(storage));
  }
  const cases: Record<string, string> = {
    malformed: '{not json',
    unknownSource: JSON.stringify({ source: 'hacker', createdAt: now }),
    expired: JSON.stringify({ source: 'report', createdAt: now - MAX_AGE - 1 }),
  };
  for (const [name, raw] of Object.entries(cases)) {
    const s = memoryStorage();
    s.setItem(INTENT_KEY, raw);
    assert.equal(takeLoginIntent(s, now), null, `${name} intent should yield null`);
    assert.equal(s.getItem(INTENT_KEY), null, `${name} intent should be cleared`);
  }
});

test('takeLoginIntent returns source iff 0 <= delta <= maxAge and always clears the key', async () => {
  const { saveLoginIntent, takeLoginIntent } = await loadFlow();
  const next = rng(77);
  for (let i = 0; i < 300; i++) {
    const s = memoryStorage();
    const source = SOURCES[Math.floor(next() * SOURCES.length)];
    const createdAt = 1_600_000_000_000 + Math.floor(next() * 1e11);
    // Mix of negative, in-range, boundary and expired deltas.
    const pick = next();
    const delta =
      pick < 0.15 ? -1 - Math.floor(next() * MAX_AGE)
      : pick < 0.25 ? MAX_AGE
      : pick < 0.3 ? 0
      : pick < 0.65 ? Math.floor(next() * MAX_AGE)
      : MAX_AGE + 1 + Math.floor(next() * MAX_AGE);
    saveLoginIntent(s, source, createdAt);
    const expected = delta >= 0 && delta <= MAX_AGE ? source : null;
    assert.equal(takeLoginIntent(s, createdAt + delta, MAX_AGE), expected, `delta=${delta}`);
    assert.equal(s.getItem(INTENT_KEY), null, 'key must be cleared after take');
  }
});

test('random save/take/clear interleavings yield at most one non-null take per save', async () => {
  const { saveLoginIntent, takeLoginIntent, clearLoginIntent } = await loadFlow();
  const next = rng(9001);
  for (let run = 0; run < 100; run++) {
    const s = memoryStorage();
    let now = 1_700_000_000_000;
    let saves = 0;
    let hits = 0;
    let pending = false;
    for (let step = 0; step < 30; step++) {
      now += Math.floor(next() * 1000);
      const op = next();
      if (op < 0.35) {
        saveLoginIntent(s, SOURCES[Math.floor(next() * SOURCES.length)], now);
        saves++;
        pending = true;
      } else if (op < 0.85) {
        const got = takeLoginIntent(s, now);
        if (got !== null) {
          assert.ok(pending, 'take returned a source with no pending save');
          hits++;
        }
        pending = false;
      } else {
        clearLoginIntent(s);
        pending = false;
      }
    }
    assert.ok(hits <= saves, `hits=${hits} saves=${saves}`);
  }
});

test('logAuthError logs only { code, phase }', async () => {
  const { logAuthError } = await loadErrors();
  const original = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => void calls.push(args);
  try {
    logAuthError('auth/unauthorized-domain', 'popup');
    logAuthError(undefined, 'redirect-result');
  } finally {
    console.warn = original;
  }
  assert.equal(calls.length, 2);
  for (const args of calls) {
    const objects = args.filter((a) => typeof a === 'object' && a !== null) as Record<string, unknown>[];
    assert.equal(objects.length, 1, 'exactly one structured payload expected');
    assert.deepEqual(Object.keys(objects[0]).sort(), ['code', 'phase']);
    for (const a of args) assert.ok(!(a instanceof Error), 'error objects must not be logged');
  }
  const first = calls[0].find((a) => typeof a === 'object') as Record<string, unknown>;
  assert.deepEqual(first, { code: 'auth/unauthorized-domain', phase: 'popup' });
});
