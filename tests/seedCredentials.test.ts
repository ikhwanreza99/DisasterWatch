import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function run(args: string[], account = '') {
  return spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seedFirestore.ts', ...args], {
    encoding: 'utf8',
    env: { ...process.env, FIREBASE_NEWS_SERVICE_ACCOUNT: account, GOOGLE_APPLICATION_CREDENTIALS: '' },
    timeout: 15_000,
  });
}

test('verify-only validates explicit account project before any Firestore read', () => {
  const result = run(['--verify-only'], JSON.stringify({ project_id: 'wrong-project' }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unexpected project/);
  assert.doesNotMatch(result.stderr, /default credentials|MetadataLookupWarning/);
});

test('verify-only without credentials fails explicitly without trying metadata server', () => {
  const result = run(['--verify-only']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No service account/);
  assert.doesNotMatch(result.stderr, /default credentials|MetadataLookupWarning/);
});

test('dry-run remains offline and succeeds without credentials', () => {
  const result = run(['--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no writes, no network/);
});
