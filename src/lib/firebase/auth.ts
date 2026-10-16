import { mockUser, canReport } from './identity';
export { mockUser, isGoogleUser, canReport } from './identity';
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
import { AUTH_UNAVAILABLE_MESSAGE, authErrorCode, logAuthError, mapAuthError } from './authErrors';
import {
  clearLoginIntent,
  prefersRedirect,
  saveLoginIntent,
  shouldFallbackToRedirect,
  takeLoginIntent,
  type IntentStorage,
  type LoginSource,
} from './authFlow';

let cachedAuth: Auth | null = null;
export function getAuthInstance(): Auth | null {
  if (!isFirebaseConfigured()) return null;
  if (cachedAuth) return cachedAuth;
  const app = getFirebaseApp();
  if (!app) return null;
  cachedAuth = getAuth(app);
  return cachedAuth;
}
/** Single mapper from a Firebase user to the app identity. */
export function toIdentity(u: User): UserIdentity {
  return {
    uid: u.uid,
    isAnonymous: u.isAnonymous,
    displayName: u.displayName ?? undefined,
    email: u.email ?? undefined,
    photoURL: u.photoURL ?? undefined,
    isMock: false,
  };
}

/** sessionStorage if available; Safari private mode / sandboxed frames may throw on access. */
function intentStorage(): IntentStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export type RedirectResultOutcome = {
  user: UserIdentity | null;
  source: LoginSource | null;
  error?: { code?: string; message: string };
};

let redirectResultPromise: Promise<RedirectResultOutcome> | null = null;

/**
 * Reads a pending Google redirect sign-in. Memoized: getRedirectResult runs at most once per
 * page load (StrictMode double effects share the same promise). Never throws.
 */
export function consumeRedirectResult(): Promise<RedirectResultOutcome> {
  if (redirectResultPromise) return redirectResultPromise;
  redirectResultPromise = (async (): Promise<RedirectResultOutcome> => {
    const auth = getAuthInstance();
    if (!auth) return { user: null, source: null };
    try {
      const result = await getRedirectResult(auth);
      if (!result) {
        takeLoginIntent(intentStorage()); // discard any stale intent
        return { user: null, source: null };
      }
      return { user: toIdentity(result.user), source: takeLoginIntent(intentStorage()) };
    } catch (cause) {
      const code = authErrorCode(cause);
      logAuthError(code, 'redirect-result');
      return {
        user: null,
        source: takeLoginIntent(intentStorage()),
        error: { code, message: mapAuthError(code) },
      };
    }
  })();
  return redirectResultPromise;
}

/** Ensure a signed-in user; falls back to mock user when Firebase is unavailable. */
export async function ensureUser(): Promise<UserIdentity> {
  const auth = getAuthInstance();
  if (!auth) return mockUser();
  // Finish any pending Google redirect before an anonymous session could race it.
  await consumeRedirectResult();
  await auth.authStateReady();
  if (auth.currentUser) return toIdentity(auth.currentUser);
  try {
    const cred = await signInAnonymously(auth);
    return toIdentity(cred.user);
  } catch {
    return mockUser();
  }
}
/** Reporting needs a Firebase identity, not a Google account. Never fake a live session. */
export async function ensureReportUser(): Promise<UserIdentity> {
  const user = await ensureUser();
  if (isFirebaseConfigured() && !canReport(user)) {
    throw new Error('Sesi pelaporan anonim belum tersedia. Silakan coba lagi.');
  }
  return user;
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

export type GoogleSignInOutcome =
  | { status: 'signed-in'; user: UserIdentity }
  | { status: 'redirecting' };

async function redirectSignIn(auth: Auth, provider: GoogleAuthProvider, source: LoginSource): Promise<GoogleSignInOutcome> {
  saveLoginIntent(intentStorage(), source);
  try {
    await signInWithRedirect(auth, provider);
    return { status: 'redirecting' };
  } catch (cause) {
    clearLoginIntent(intentStorage());
    logAuthError(authErrorCode(cause), 'redirect');
    throw cause;
  }
}

/**
 * Google sign-in. Popup first on desktop (signInWithPopup is the first await, preserving the
 * click's user activation); redirect-first on mobile/embedded browsers, and redirect fallback
 * for popup-blocked / cancelled / unsupported popup errors. Other errors are rethrown.
 */
export async function signInWithGoogle(source: LoginSource): Promise<GoogleSignInOutcome> {
  const auth = getAuthInstance();
  if (!auth) throw new Error(AUTH_UNAVAILABLE_MESSAGE);
  auth.languageCode = 'id';
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (prefersRedirect(ua)) return redirectSignIn(auth, provider, source);
  try {
    const result = await signInWithPopup(auth, provider);
    clearLoginIntent(intentStorage());
    return { status: 'signed-in', user: toIdentity(result.user) };
  } catch (cause) {
    const code = authErrorCode(cause);
    logAuthError(code, 'popup');
    if (shouldFallbackToRedirect(code)) return redirectSignIn(auth, provider, source);
    throw cause;
  }
}

/** Signs out of Google and restores the anonymous (or mock) identity. */
export async function signOutUser(): Promise<UserIdentity> {
  const auth = getAuthInstance();
  if (!auth) return mockUser();
  try {
    await signOut(auth);
  } catch (cause) {
    logAuthError(authErrorCode(cause), 'signout');
    throw cause;
  }
  clearLoginIntent(intentStorage());
  return ensureUser();
}

/** Temporary local preview session; never authenticates with Firebase. */
export function previewUser(): UserIdentity {
  return { uid: 'local-report-preview', isAnonymous: false, displayName: 'Pelapor Demo', isMock: true };
}
