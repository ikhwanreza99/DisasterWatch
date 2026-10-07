import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUTH_ERROR_MESSAGES,
  authErrorCode,
  logAuthError,
  mapAuthError,
} from '../src/lib/firebase/authErrors';
import { REDIRECT_FALLBACK_CODES, shouldFallbackToRedirect } from '../src/lib/firebase/authFlow';

const REQUIRED_CODES = [
  'auth/popup-closed-by-user',
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
  'auth/unauthorized-domain',
  'auth/operation-not-allowed',
  'auth/network-request-failed',
  'auth/internal-error',
  'auth/too-many-requests',
  'auth/user-disabled',
  'auth/web-storage-unsupported',
  'auth/account-exists-with-different-credential',
];

test('every required code maps to its own table message', () => {
  for (const code of REQUIRED_CODES) {
    assert.ok(AUTH_ERROR_MESSAGES[code], `missing ${code}`);
    assert.equal(mapAuthError(code), AUTH_ERROR_MESSAGES[code]);
  }
});

test('closed popup keeps the cancelled text; cancelled-popup-request has its own message', () => {
  assert.equal(mapAuthError('auth/popup-closed-by-user'), 'Login dibatalkan. Silakan coba lagi.');
  assert.notEqual(mapAuthError('auth/cancelled-popup-request'), 'Login dibatalkan. Silakan coba lagi.');
});

test('specific messages for disabled provider and unauthorized domain', () => {
  assert.match(mapAuthError('auth/operation-not-allowed'), /belum diaktifkan/);
  assert.match(mapAuthError('auth/unauthorized-domain'), /belum diizinkan/);
});

test('unknown codes are surfaced with the code', () => {
  assert.equal(
    mapAuthError('auth/something-new'),
    'Login Google belum berhasil (kode: auth/something-new). Silakan coba lagi.',
  );
});

test('missing code uses the fallback message or the default', () => {
  assert.equal(mapAuthError(undefined, 'Login belum tersedia.'), 'Login belum tersedia.');
  assert.equal(mapAuthError(undefined), 'Login belum berhasil. Silakan coba lagi.');
});

test('authErrorCode handles non-objects and non-string codes', () => {
  assert.equal(authErrorCode(null), undefined);
  assert.equal(authErrorCode('auth/popup-blocked'), undefined);
  assert.equal(authErrorCode(42), undefined);
  assert.equal(authErrorCode({ code: 7 }), undefined);
  assert.equal(authErrorCode({ code: '' }), undefined);
  assert.equal(authErrorCode({ code: 'auth/internal-error' }), 'auth/internal-error');
});

test('LoginModal mapping keeps plain error messages and maps coded errors', () => {
  // Mirrors LoginModal: mapAuthError(code, cause instanceof Error && !code ? cause.message : undefined)
  const toMessage = (cause: unknown) => {
    const code = authErrorCode(cause);
    return mapAuthError(code, cause instanceof Error && !code ? cause.message : undefined);
  };
  assert.equal(toMessage(new Error('Login belum tersedia.')), 'Login belum tersedia.');
  assert.equal(toMessage(null), 'Login belum berhasil. Silakan coba lagi.');
  assert.equal(toMessage({ code: 'auth/popup-blocked' }), mapAuthError('auth/popup-blocked'));
});

test('logAuthError logs only { code, phase }', () => {
  const original = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => void calls.push(args);
  try {
    logAuthError('auth/popup-blocked', 'popup');
    logAuthError(undefined, 'signout');
  } finally {
    console.warn = original;
  }
  assert.deepEqual(calls, [
    ['[auth] Google sign-in failed', { code: 'auth/popup-blocked', phase: 'popup' }],
    ['[auth] Google sign-in failed', { code: 'unknown', phase: 'signout' }],
  ]);
});

test('redirect fallback codes live in authFlow with the correct codes', () => {
  assert.deepEqual([...REDIRECT_FALLBACK_CODES].sort(), [
    'auth/cancelled-popup-request',
    'auth/operation-not-supported-in-this-environment',
    'auth/popup-blocked',
  ]);
  assert.equal(shouldFallbackToRedirect('auth/popup-closed-by-user'), false);
  assert.equal(shouldFallbackToRedirect('auth/operation-not-supported-in-environment'), false);
});
