// Admin-only source-backed upserts. No browser key, deletes, or relabeling demo cities.
import 'dotenv/config';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { realDisasterDataset } from './realDisasterDataset.ts';

async function main() {
  const docs = realDisasterDataset();
  if (new Set(docs.map(doc => doc.id)).size !== docs.length) throw new Error('Duplicate disaster ID');
  console.log(`REAL disasters planned: ${docs.length}; source snapshot + dedicated NTT case`);
  if (process.argv.includes('--dry-run')) { console.log('Dry run: no network or writes'); return; }
  const raw = process.env.FIREBASE_NEWS_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Missing service account');
  const account = JSON.parse(raw);
  if (account.project_id !== 'disasterwatch-61ed5') throw new Error('Unexpected project');
  const app = initializeApp({ credential: cert(account), projectId: account.project_id }, 'sync-real-disasters');
  try {
    const db = getFirestore(app);
    const refs = docs.map(doc => db.collection('disasters').doc(doc.id));
    if (!process.argv.includes('--verify-only')) {
      const existing = await db.getAll(...refs);
      const batch = db.batch();
      docs.forEach((doc, i) => {
        // Replace legacy demo fields only for a sourced city with the same ID.
        // For real docs, preserve additional fields added outside this sync.
        if (existing[i].data()?.isMock === true) batch.set(refs[i], doc);
        else batch.set(refs[i], { ...doc, seedBatch: FieldValue.delete() }, { merge: true });
      });
      await batch.commit();
      console.log(`Upserted ${docs.length} REAL disasters; no deletes; other cities untouched`);
    }
    const readback = await db.getAll(...refs);
    for (let i = 0; i < docs.length; i++) {
      const data = readback[i].data();
      if (data?.demoNotice !== 'REAL' || data?.isMock !== false || data?.sourceUrl !== docs[i].sourceUrl || data?.seedBatch) throw new Error('REAL disaster verification failed');
    }
    console.log(`Readback PASS: ${docs.length} documents demoNotice=REAL, isMock=false, source URL retained, no demo seedBatch`);
  } finally { await deleteApp(app); }
}
main().catch(() => { console.error('REAL disaster sync failed; check service account, project, and Firestore access (no credentials logged)'); process.exitCode = 1; });
