// Firestore singleton. Returns null in mock mode so callers fall back safely.
import { Firestore, getFirestore } from 'firebase/firestore';
import { getFirebaseApp, isFirebaseConfigured } from './config';

let cachedDb: Firestore | null = null;

export function getDb(): Firestore | null {
  if (!isFirebaseConfigured()) return null;
  if (cachedDb) return cachedDb;
  const app = getFirebaseApp();
  if (!app) return null;
  cachedDb = getFirestore(app);
  return cachedDb;
}

export const COLLECTIONS = {
  disasters: 'disasters',
  reports: 'reports',
  needs: 'needs',
  aid: 'aid',
  locations: 'locations',
} as const;
