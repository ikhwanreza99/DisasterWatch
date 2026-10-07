import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authErrorMessage, REDIRECT_FALLBACK_CODES } from '../src/lib/firebase/authErrors';

test('disabled Google provider explains the Firebase Console fix', () => {
  const msg = authErrorMessage({ code: 'auth/operation-not-allowed' });
  assert.match(msg, /belum diaktifkan/);
  assert.match(msg, /Sign-in method → Google/);
});

test('unauthorized domain points to Authorized domains', () => {
  assert.match(authErrorMessage({ code: 'auth/unauthorized-domain' }), /Authorized domains/);
});

test('closed popup is reported as cancelled', () => {
  assert.equal(authErrorMessage({ code: 'auth/popup-closed-by-user' }), 'Login dibatalkan. Silakan coba lagi.');
});

test('unknown codes are surfaced instead of a generic failure', () => {
  assert.match(authErrorMessage({ code: 'auth/something-new' }), /\(auth\/something-new\)/);
});

test('plain errors keep their message; unknown values get a fallback', () => {
  assert.equal(authErrorMessage(new Error('Login belum tersedia.')), 'Login belum tersedia.');
  assert.equal(authErrorMessage(null), 'Login belum berhasil. Silakan coba lagi.');
});

test('popup-blocked style codes trigger the redirect fallback', () => {
  assert.ok(REDIRECT_FALLBACK_CODES.has('auth/popup-blocked'));
  assert.ok(REDIRECT_FALLBACK_CODES.has('auth/cancelled-popup-request'));
  assert.ok(!REDIRECT_FALLBACK_CODES.has('auth/popup-closed-by-user'));
});
