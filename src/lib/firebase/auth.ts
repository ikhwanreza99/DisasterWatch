// Firebase Auth with graceful anonymous + mock fallback.
import {
  Auth,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  type User,
} from 'firebase/auth';
import type { UserIdentity } from '../../domain/intelligence';
import { getFirebaseApp, isFirebaseConfigured } from './config';
import { authErrorCode, REDIRECT_FALLBACK_CODES } from './authErrors';
let cachedAuth: Auth | null = null;
export function getAuthInstance(): Auth | null {
  if (!isFirebaseConfigured()) return null;
  if (cachedAuth) return cachedAuth;
  const app = getFirebaseApp();
  if (!app) return null;
  cachedAuth = getAuth(app);
  return cachedAuth;
}
export function mockUser(): UserIdentity {
  return { uid: 'local-demo-user', isAnonymous: true, displayName: 'Demo User', isMock: true };
}
function toIdentity(u: User): UserIdentity {
  return {
    uid: u.uid,
    isAnonymous: u.isAnonymous,
    displayName: u.displayName ?? undefined,
    email: u.email ?? undefined,
    photoURL: u.photoURL ?? undefined,
    isMock: false,
  };
}
/** Ensure a signed-in user; falls back to mock user when Firebase is unavailable. */
export async function ensureUser(): Promise<UserIdentity> {
  const auth = getAuthInstance();
  if (!auth) return mockUser();
  await auth.authStateReady();
  if (auth.currentUser) return toIdentity(auth.currentUser);
  try {
    const cred = await signInAnonymously(auth);
    return toIdentity(cred.user);
  } catch {
    return mockUser();
  }
}
export function watchUser(cb: (u: UserIdentity) => void): () => void {
  const auth = getAuthInstance();
  if (!auth) {
    cb(mockUser());
    return () => undefined;
  }
  return onAuthStateChanged(auth, (u) => {
    if (u) cb(toIdentity(u));
    else cb(mockUser());
  });
}
/** Touch-first / mobile browsers: popups are unreliable, use full-page redirect. */
export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return coarse && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
/**
 * Google sign-in. Uses a popup on desktop and falls back to a full-page redirect when the
 * popup is blocked or on mobile. Returns 'redirect' when the page is navigating away.
 */
export async function loginWithGoogle(): Promise<UserIdentity | 'redirect'> {
  const auth = getAuthInstance();
  if (!auth) throw new Error('Login belum tersedia. Silakan coba lagi setelah layanan login diaktifkan.');
  auth.languageCode = 'id';
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (isMobileBrowser()) {
    await signInWithRedirect(auth, provider);
    return 'redirect';
  }
  try {
    const result = await signInWithPopup(auth, provider);
    return toIdentity(result.user);
  } catch (cause) {
    const code = authErrorCode(cause);
    if (code && REDIRECT_FALLBACK_CODES.has(code)) {
      await signInWithRedirect(auth, provider);
      return 'redirect';
    }
    throw cause;
  }
}
/** Completes a pending redirect sign-in (call once on load). Rethrows auth errors. */
export async function completeRedirectLogin(): Promise<UserIdentity | null> {
  const auth = getAuthInstance();
  if (!auth) return null;
  const result = await getRedirectResult(auth);
  return result ? toIdentity(result.user) : null;
}
export async function logout(): Promise<void> {
  const auth = getAuthInstance();
  if (auth) await signOut(auth);
}
/** Temporary local preview session; never authenticates with Firebase. */
export function previewUser(): UserIdentity {
  return { uid: 'local-report-preview', isAnonymous: false, displayName: 'Pelapor Demo', isMock: true };
}
export function canReport(user: UserIdentity): boolean {
  return !user.isAnonymous && (!user.isMock || (import.meta.env.DEV && user.uid === 'local-report-preview'));
}
