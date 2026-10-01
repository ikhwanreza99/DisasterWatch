// Central Firebase configuration. Env-driven, safe fallback to mock mode.
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';

export interface FirebaseStatus {
  configured: boolean;
  missingKeys: string[];
  mode: 'live' | 'mock';
}

const ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

function readEnv(key: string): string {
  // Vite exposes import.meta.env; guard for non-vite contexts (tests).
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> })?.env?.[key];
    return typeof v === 'string' ? v.trim() : '';
  } catch {
    return '';
  }
}

export function firebaseEnv(): Record<string, string> {
  return {
    apiKey: readEnv('VITE_FIREBASE_API_KEY'),
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('VITE_FIREBASE_APP_ID'),
    measurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID'),
  };
}

export function firebaseStatus(): FirebaseStatus {
  const env = firebaseEnv();
  const missingKeys = (Object.keys(env) as Array<keyof typeof env>)
    .filter((k) => ['apiKey', 'authDomain', 'projectId', 'appId'].includes(k))
    .filter((k) => !env[k])
    .map((k) => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
  return {
    configured: missingKeys.length === 0,
    missingKeys,
    mode: missingKeys.length === 0 ? 'live' : 'mock',
  };
}

export function isFirebaseConfigured(): boolean {
  return firebaseStatus().configured;
}

let cachedApp: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0]!;
    return cachedApp;
  }
  cachedApp = initializeApp(firebaseEnv());
  return cachedApp;
}
