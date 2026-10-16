// Property 2: Preservation - Non-buggy auth and UI behavior unchanged.
// Source-text and config checks recorded from the baseline (commit 5a6a493). These PASS on
// unfixed code and must keep passing after the fix.
// **Validates: Requirements 2.10, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const readIfExists = (path: string) => (existsSync(new URL(path, root)) ? read(path) : '');

// Observed baseline values.
const POPUP_CLOSED_MESSAGE = 'Login dibatalkan. Silakan coba lagi.';
const MOCK_PROD_MESSAGE = 'Login belum tersedia. Silakan coba lagi setelah layanan login diaktifkan.';

const COOP_SAME_ORIGIN = /Cross-Origin-Opener-Policy["'\s:=,]+(content=)?["']?same-origin(?!-allow-popups)/i;

test('COOP guard: no Cross-Origin-Opener-Policy: same-origin in hosting, dev server, or HTML (2.10, 3.7)', () => {
  const firebase = JSON.parse(read('firebase.json')) as {
    hosting?: { headers?: { headers?: { key: string; value: string }[] }[] } | { headers?: unknown }[];
  };
  const hostings = Array.isArray(firebase.hosting) ? firebase.hosting : [firebase.hosting ?? {}];
  for (const hosting of hostings) {
    const rules = ((hosting as { headers?: unknown }).headers ?? []) as { headers?: { key: string; value: string }[] }[];
    for (const rule of rules) {
      for (const h of rule.headers ?? []) {
        if (h.key.toLowerCase() === 'cross-origin-opener-policy') {
          assert.equal(h.value.trim().toLowerCase(), 'same-origin-allow-popups', 'firebase.json COOP must allow popups');
        }
      }
    }
  }
  assert.doesNotMatch(read('vite.config.ts'), COOP_SAME_ORIGIN, 'vite.config.ts sets COOP same-origin');
  assert.doesNotMatch(read('index.html'), COOP_SAME_ORIGIN, 'index.html sets COOP same-origin');
});

test('Header keeps main controls and a profile fallback (3.7)', () => {
  const header = read('src/components/Header.tsx');
  for (const token of [
    'pl-2',
    'border-l',
    'w-9 h-9 rounded-full',
    'bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500',
    'Laporkan Bencana',
    '<DisasterTicker',
    'isCalendarOpen',
    '<Calendar',
    '<UserRound',
  ]) {
    assert.ok(header.includes(token), `Header.tsx is missing visual token: ${token}`);
  }
});

test('popup-closed text is preserved in the auth error source (3.4)', () => {
  const union = read('src/components/LoginModal.tsx') + readIfExists('src/lib/firebase/authErrors.ts');
  assert.ok(union.includes(POPUP_CLOSED_MESSAGE), 'popup-closed message missing');
});

test('mock mode: anonymous fallback, mockUser emission, and "Login belum tersedia" text (3.2, 3.5)', () => {
  const auth = read('src/lib/firebase/auth.ts');
  assert.match(auth, /signInAnonymously\(auth\)/, 'ensureUser anonymous fallback missing');
  assert.match(auth, /if \(!auth\) return mockUser\(\);/, 'ensureUser mock fallback missing');
  assert.match(auth, /cb\(mockUser\(\)\)/, 'watchUser mockUser() emission missing');
  // Guest-report permission behavior is covered by reportAccess.test.ts.
  const union =
    auth + read('src/components/LoginModal.tsx') + readIfExists('src/lib/firebase/authErrors.ts');
  assert.ok(union.includes(MOCK_PROD_MESSAGE), 'mock-mode production message missing');
  const modal = read('src/components/LoginModal.tsx');
  assert.ok(modal.includes('previewUser()'), 'mock-mode DEV preview path missing');
  assert.ok(modal.includes('isFirebaseConfigured()'), 'preview path must stay gated on Firebase config');
});

test('LoginModal keeps dialog markup and alert region (3.3)', () => {
  const modal = read('src/components/LoginModal.tsx');
  assert.ok(modal.includes('<dialog'), 'LoginModal must keep <dialog> markup');
  assert.ok(modal.includes('role="alert"'), 'LoginModal must keep role="alert"');
  assert.ok(modal.includes('onCancel'), 'LoginModal must keep the onCancel close path');
});

test('config hygiene: .env.example has empty VITE_FIREBASE_* values; workflow uses secrets (3.9)', () => {
  const lines = read('.env.example').split(/\r?\n/);
  const keyLines = lines.filter((l) => /^\s*VITE_FIREBASE_[A-Z_]+\s*=/.test(l));
  assert.ok(keyLines.length > 0, '.env.example lists no VITE_FIREBASE_* keys');
  const withValues = keyLines
    .filter((l) => l.slice(l.indexOf('=') + 1).trim() !== '')
    .map((l) => l.slice(0, l.indexOf('=')).trim()); // key names only, never values
  assert.deepEqual(withValues, [], `.env.example keys with non-empty values: ${withValues.join(', ')}`);

  const workflow = read('.github/workflows/deploy-hosting.yml');
  for (const key of [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ]) {
    const re = new RegExp(`^\\s*${key}:\\s*\\$\\{\\{\\s*secrets\\.${key}\\s*\\}\\}\\s*$`, 'm');
    assert.ok(re.test(workflow), `workflow must source ${key} from secrets.${key}`);
  }
});

test('untouched files keep their default markers (3.8)', () => {
  const map = read('src/components/MapCanvas.tsx');
  assert.ok(
    map.includes('const [localApiLayers, setLocalApiLayers] = useState(false);') && read('src/App.tsx').includes('const [apiLayersEnabled, setApiLayersEnabled] = useState(false);'),
    'API data-layers toggle must default to off',
  );
  assert.ok(
    map.includes('const [showMagmaLegend, setShowMagmaLegend] = useState(false);'),
    'MAGMA legend must default to collapsed',
  );
  assert.ok(map.includes('id="magma-legend"'), 'legend element missing');
  assert.ok(map.includes('left-[3.5rem] sm:left-[4.25rem] lg:left-[4.75rem]'), 'legend position changed');
  assert.ok(
    map.includes('const selectedBmkg = useMemo(() => bmkgEvents.find((e) => e.id === selectedBmkgId) ?? null, [bmkgEvents, selectedBmkgId]);'),
    'BMKG quake selection changed',
  );
  assert.ok(
    map.includes("showBmkg && bmkgStatus !== 'unavailable' && selectedBmkg && ("),
    'BMKG quake popup render condition changed',
  );
  assert.ok(map.includes("{t('Magnitudo:')} <b>M{selectedBmkg.magnitude.toFixed(1)}</b>"), 'BMKG quake popup content changed');
});
