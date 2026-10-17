import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { AidRecord, IntelligenceReport } from '../../domain/intelligence';
import { COLLECTIONS, getDb } from '../../lib/firebase/firestore';
import type { RecordSource } from '../ai/assistantSources';

/** Bounded live reads; no synthetic reports or aid are substituted on failure. */
export function subscribeOperationalRecords(callbacks: {
  reports: (records: IntelligenceReport[]) => void;
  aid: (records: AidRecord[]) => void;
  status: (collection: 'reports' | 'aid', status: RecordSource) => void;
}): () => void {
  const db = getDb();
  if (!db) {
    callbacks.status('reports', 'unavailable');
    callbacks.status('aid', 'unavailable');
    return () => {};
  }
  const reports = onSnapshot(query(collection(db, COLLECTIONS.reports), orderBy('createdAt', 'desc'), limit(200)), { includeMetadataChanges: true }, snapshot => {
    callbacks.reports(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as IntelligenceReport).filter(record => record.isMock === false && typeof record.rawText === 'string' && !!record.location?.name && !!record.verificationStatus));
    callbacks.status('reports', snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites ? 'cache' : 'firestore');
  }, () => callbacks.status('reports', 'unavailable'));
  const aid = onSnapshot(query(collection(db, COLLECTIONS.aid), orderBy('receivedAt', 'desc'), limit(200)), { includeMetadataChanges: true }, snapshot => {
    callbacks.aid(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as AidRecord).filter(record => record.isMock === false && !!record.disasterId && Number.isFinite(record.quantity) && !!record.needCategory));
    callbacks.status('aid', snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites ? 'cache' : 'firestore');
  }, () => callbacks.status('aid', 'unavailable'));
  return () => { reports(); aid(); };
}
