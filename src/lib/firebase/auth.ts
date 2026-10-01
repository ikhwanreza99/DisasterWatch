// Firebase Auth with graceful anonymous + mock fallback.
import { Auth, getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
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
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      isAnonymous: auth.currentUser.isAnonymous,
      displayName: auth.currentUser.displayName ?? undefined,
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
    if (u) cb({ uid: u.uid, isAnonymous: u.isAnonymous, displayName: u.displayName ?? undefined, isMock: false });
    else cb(mockUser());
  });
}
