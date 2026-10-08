// Firebase Auth with graceful anonymous + mock fallback.
import { Auth, getAuth, onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import type { UserIdentity } from '../../domain/intelligence';
import { getFirebaseApp, isFirebaseConfigured } from './config';

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

/** Ensure a signed-in user; falls back to mock user when Firebase is unavailable. */
export async function ensureUser(): Promise<UserIdentity> {
  const auth = getAuthInstance();
  if (!auth) return mockUser();
  await auth.authStateReady();
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      isAnonymous: auth.currentUser.isAnonymous,
      displayName: auth.currentUser.displayName ?? undefined,
      photoURL: auth.currentUser.photoURL ?? undefined,
      isMock: false,
    };
  }
  try {
    const cred = await signInAnonymously(auth);
    return { uid: cred.user.uid, isAnonymous: true, isMock: false };
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
    if (u) cb({ uid: u.uid, isAnonymous: u.isAnonymous, displayName: u.displayName ?? undefined, photoURL: u.photoURL ?? undefined, isMock: false });
    else cb(mockUser());
  });
}

export async function loginWithGoogle(): Promise<UserIdentity> {
  const auth = getAuthInstance();
  if (!auth) throw new Error('Login belum tersedia. Silakan coba lagi setelah layanan login diaktifkan.');
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return { uid: result.user.uid, isAnonymous: result.user.isAnonymous,
    displayName: result.user.displayName ?? undefined, photoURL: result.user.photoURL ?? undefined, isMock: false };
}

/** Temporary local preview session; never authenticates with Firebase. */
export function previewUser(): UserIdentity {
  return { uid: 'local-report-preview', isAnonymous: false, displayName: 'Pelapor Demo', isMock: true };
}

export function canReport(user: UserIdentity): boolean {
  return !user.isAnonymous && (!user.isMock || (import.meta.env.DEV && user.uid === 'local-report-preview'));
}
