// Firestore persistence with local/mock fallback. Never throws to UI.
import { collection, doc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import type { AidRecord, IntelligenceReport } from '../../domain/intelligence';
import { disastersData } from '../../data/disasters';
import type { DisasterIncident } from '../../types';
import { COLLECTIONS, getDb } from '../../lib/firebase/firestore';

export interface StoreStatus {
  mode: 'live' | 'mock';
  message: string;
}

const memReports: IntelligenceReport[] = [];
const memAid: AidRecord[] = [];

/**
 * Firestore docs were seeded before the Posko / recovery-status fields existed.
 * Fill anything missing from the local demo record so newer UI never reads undefined.
 */
function withLocalDefaults(v: DisasterIncident): DisasterIncident {
  const local = disastersData[v.id];
  const fsCheckpoints = v.route?.checkpoints ?? [];
  // Prefer local checkpoints when the Firestore ones predate the Posko fields (no `name`).
  const hasPostFields = fsCheckpoints.some((c) => c.name || c.capacity);
  return {
    ...(local ?? {}),
    ...v,
    recoveryServices: v.recoveryServices ?? local?.recoveryServices ?? [],
    route:
      v.route && (hasPostFields || !local?.route)
        ? { ...v.route, checkpoints: fsCheckpoints }
        : (local?.route ?? v.route),
  } as DisasterIncident;
}

export async function loadDisasters(): Promise<{ data: Record<string, DisasterIncident>; status: StoreStatus }> {
  const db = getDb();
  if (!db) {
    return { data: disastersData, status: { mode: 'mock', message: 'Firestore belum dikonfigurasi — memakai data demo lokal.' } };
  }
  try {
    const snap = await getDocs(query(collection(db, COLLECTIONS.disasters), orderBy('name'), limit(50)));
    if (snap.empty) return { data: disastersData, status: { mode: 'mock', message: 'Firestore kosong — memakai data demo lokal.' } };
    // Start from the local demo dataset (same 7 incidents as feat/homepage-slicing), then layer
    // Firestore on top. Seeded demo docs (isMock) are older copies of the local dataset, so the
    // local record wins for those; real (non-mock) Firestore incidents always win / get added.
    const out: Record<string, DisasterIncident> = { ...disastersData };
    snap.forEach((d) => {
      const v = d.data() as DisasterIncident & { isMock?: boolean };
      if (!v || !v.id) return;
      if (v.isMock && disastersData[v.id]) return;
      out[v.id] = withLocalDefaults(v);
    });
    return Object.keys(out).length > 0
      ? { data: out, status: { mode: 'live', message: `Memuat ${Object.keys(out).length} insiden dari Firestore.` } }
      : { data: disastersData, status: { mode: 'mock', message: 'Firestore kosong — memakai data demo lokal.' } };
  } catch (e) {
    return { data: disastersData, status: { mode: 'mock', message: `Gagal memuat Firestore (${String(e)}). Fallback lokal.` } };
  }
}

export async function saveReport(report: IntelligenceReport): Promise<StoreStatus> {
  memReports.unshift(report);
  const db = getDb();
  if (!db) return { mode: 'mock', message: 'Laporan disimpan lokal (mock).' };
  try {
    await setDoc(doc(db, COLLECTIONS.reports, report.id), report);
    return { mode: 'live', message: `Laporan ${report.id} tersimpan di Firestore.` };
  } catch (e) {
    return { mode: 'mock', message: `Firestore gagal (${String(e)}). Tersimpan lokal.` };
  }
}

export async function saveAid(aid: AidRecord): Promise<StoreStatus> {
  memAid.unshift(aid);
  const db = getDb();
  if (!db) return { mode: 'mock', message: 'Bantuan tercatat lokal (mock).' };
  try {
    await setDoc(doc(db, COLLECTIONS.aid, aid.id), aid);
    return { mode: 'live', message: `Bantuan ${aid.id} tersimpan di Firestore.` };
  } catch (e) {
    return { mode: 'mock', message: `Firestore gagal (${String(e)}). Tercatat lokal.` };
  }
}

export async function listRecentReports(disasterId?: string, max = 20): Promise<IntelligenceReport[]> {
  const db = getDb();
  if (db) {
    try {
      const snap = await getDocs(query(collection(db, COLLECTIONS.reports), orderBy('createdAt', 'desc'), limit(max)));
      const rows = snap.docs.map((d) => d.data() as IntelligenceReport);
      return disasterId ? rows.filter((r) => !r.disasterId || r.disasterId === disasterId) : rows;
    } catch {
      // fall through to memory
    }
  }
  const rows = memReports.filter((r) => !disasterId || !r.disasterId || r.disasterId === disasterId);
  return rows.slice(0, max);
}

export function listLocalAid(disasterId?: string): AidRecord[] {
  return disasterId ? memAid.filter((a) => a.disasterId === disasterId) : [...memAid];
}
