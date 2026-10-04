// PHASE 17B — one-time local Admin-SDK seed for DisasterWatch demo dataset.
// SERVER-SIDE ONLY. Never import from src/ browser code. Never commit credentials.
// - Source of truth: src/data/seedDemo.ts (normalized, NOT replaced) + src/data/disasters.ts
// - Deterministic IDs, frozen timestamps, batch upserts (idempotent: reruns overwrite).
// - Every doc: isMock:true + seedBatch:'disasterwatch-demo-v1' (DEMO/MOCK labeled).
// - Auth: GOOGLE_APPLICATION_CREDENTIALS -> service-account file OUTSIDE the repo.
// - Usage: npm run seed:firestore [-- --dry-run] [-- --verify-only]
import { existsSync, statSync } from 'node:fs';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type WriteBatch } from 'firebase-admin/firestore';
import { disastersData } from '../src/data/disasters.js';
import { DEMO_SCENARIO_ID, demoAid, demoReports } from '../src/data/seedDemo.js';

const PROJECT_ID = 'disasterwatch-61ed5';
const SEED_BATCH = 'disasterwatch-demo-v1';
// Frozen demo clock — deterministic across runs (do NOT use Date.now() here).
const SEED_AT = '2026-09-20T08:00:00.000Z';
const T = (minsAgo: number) => new Date(new Date(SEED_AT).getTime() - minsAgo * 60_000).toISOString();
const DEMO_NOTICE = 'DEMO/MOCK — dataset simulasi kompetisi, bukan feed resmi BNPB/BMKG.';

// --- Normalized existing seed (freeze relative timestamps by deterministic ID) ---
const FROZEN_REPORT_TS: Record<string, number> = {
  'REP-DEMO-01': 42, 'REP-DEMO-02': 65, 'REP-DEMO-03': 95, 'REP-DEMO-04': 130,
};
const FROZEN_AID_TS: Record<string, number> = {
  'AID-DEMO-01': 120, 'AID-DEMO-02': 110, 'AID-DEMO-03': 100, 'AID-DEMO-04': 90,
};
const baseReports = demoReports.map((r) => ({
  ...r,
  createdAt: T(FROZEN_REPORT_TS[r.id] ?? 60),
  isMock: true as const,
  seedBatch: SEED_BATCH,
}));
const baseAid = demoAid.map((a) => ({
  ...a,
  receivedAt: T(FROZEN_AID_TS[a.id] ?? 100),
  isMock: true as const,
  seedBatch: SEED_BATCH,
}));

// --- Extension (same scenario/places/vocabulary) to reach 17B targets ---
// New reports: mix UNVERIFIED / AI_REVIEWED / VERIFIED / CONFLICTING. Indonesian, DEMO-labeled.
const extraReports = [
  {
    id: 'REP-DEMO-05', disasterId: DEMO_SCENARIO_ID, sourceType: 'citizen', sourceName: 'Warga Gajah (DEMO)',
    rawText: 'INFO DEMO: Kabarnya ada genangan di gang belakang Desa Gajah, belum sempat cek langsung. Mungkin butuh info lanjutan dari posko.',
    location: { name: 'Gajah, Demak', lat: -6.9032, lng: 110.6781 }, createdAt: T(150),
    verificationStatus: 'UNVERIFIED', aiConfidence: 0.32,
    extractedData: { disasterType: 'flood', locationName: 'Gajah, Demak', affectedHouseholds: null, affectedPopulation: null, infrastructureDamage: [], needs: [], urgency: 'low', confidence: 0.32 },
    isMock: true, seedBatch: SEED_BATCH,
  },
  {
    id: 'REP-DEMO-06', disasterId: DEMO_SCENARIO_ID, sourceType: 'field', sourceName: 'Relawan Sayung (DEMO)',
    rawText: 'INFO DEMO: Genangan lutut orang dewasa di Sayung, sekitar 60 keluarga bertahan di lantai dua. Butuh air bersih dan selimut.',
    location: { name: 'Sayung, Demak', lat: -6.9271, lng: 110.6234 }, createdAt: T(170),
    verificationStatus: 'AI_REVIEWED', aiConfidence: 0.71,
    extractedData: { disasterType: 'flood', locationName: 'Sayung, Demak', affectedHouseholds: 60, affectedPopulation: 240, infrastructureDamage: ['rumah terdampak genangan'], needs: [{ category: 'clean_water', quantity: null, unit: null }, { category: 'shelter', quantity: null, unit: null }], urgency: 'medium', confidence: 0.71 },
    isMock: true, seedBatch: SEED_BATCH,
  },
  {
    id: 'REP-DEMO-07', disasterId: DEMO_SCENARIO_ID, sourceType: 'field', sourceName: 'TRC BPBD Jateng (DEMO)',
    rawText: 'INFO DEMO: Pompa sedot kedua tiba di Tanggul Sungai Wulan Km 3. 2500 karung pasir terpasang 60%. Minta tambahan 1000 karung dan 2 perahu karet.',
    location: { name: 'Tanggul Sungai Wulan Km 3', lat: -6.901, lng: 110.645 }, createdAt: T(185),
    verificationStatus: 'VERIFIED', aiConfidence: 0.9,
    extractedData: { disasterType: 'flood', locationName: 'Tanggul Sungai Wulan Km 3', affectedHouseholds: 120, affectedPopulation: 480, infrastructureDamage: ['tanggul jebol'], needs: [{ category: 'boat', quantity: 2, unit: 'unit' }], urgency: 'critical', confidence: 0.9 },
    isMock: true, seedBatch: SEED_BATCH,
  },
  {
    id: 'REP-DEMO-08', disasterId: DEMO_SCENARIO_ID, sourceType: 'citizen', sourceName: 'Warga Karanganyar (DEMO-konflik)',
    rawText: 'INFO DEMO: Menurut saya air di Karanganyar cuma selutut dan surut, tidak separah kabar. Tidak perlu perahu, warga baik-baik saja.',
    location: { name: 'Karanganyar, Demak', lat: -6.8944, lng: 110.6385 }, createdAt: T(200),
    verificationStatus: 'CONFLICTING', aiConfidence: 0.44,
    extractedData: { disasterType: 'flood', locationName: 'Karanganyar, Demak', affectedHouseholds: 20, affectedPopulation: 80, infrastructureDamage: [], needs: [], urgency: 'low', confidence: 0.44, conflictNotes: 'Klaim urgensi bertentangan (critical vs low) dengan REP-DEMO-01/02/04.' },
    isMock: true, seedBatch: SEED_BATCH,
  },
  {
    id: 'REP-DEMO-09', disasterId: DEMO_SCENARIO_ID, sourceType: 'media', sourceName: 'Grup WA Warga (DEMO, belum terverifikasi)',
    rawText: 'INFO DEMO (broadcast, kebenaran belum pasti): Katanya jembatan Tanggulangin putus total dan ada kebakaran posko — mohon konfirmasi TRC sebelum disebar.',
    location: { name: 'Jembatan Tanggulangin', lat: -6.898, lng: 110.651 }, createdAt: T(210),
    verificationStatus: 'CONFLICTING', aiConfidence: 0.28,
    extractedData: { disasterType: 'other', locationName: 'Jembatan Tanggulangin', affectedHouseholds: null, affectedPopulation: null, infrastructureDamage: ['akses jalan terputus'], needs: [], urgency: 'high', confidence: 0.28, conflictNotes: 'Klasifikasi bencana berbeda: flood vs other; butuh verifikasi TRC.' },
    isMock: true, seedBatch: SEED_BATCH,
  },
  {
    id: 'REP-DEMO-10', disasterId: DEMO_SCENARIO_ID, sourceType: 'media', sourceName: 'Akun Medsos (DEMO, rumor)',
    rawText: 'INFO DEMO: Beredar kabar tanggul jebol 100 meter dan ribuan KK hanyut — angka belum terkonfirmasi, jangan disebar dulu.',
    location: { name: 'Demak (kabar medsos)', lat: -6.8944, lng: 110.6385 }, createdAt: T(225),
    verificationStatus: 'UNVERIFIED', aiConfidence: 0.21,
    extractedData: { disasterType: 'flood', locationName: 'Demak (kabar medsos)', affectedHouseholds: null, affectedPopulation: null, infrastructureDamage: [], needs: [], urgency: 'medium', confidence: 0.21 },
    isMock: true, seedBatch: SEED_BATCH,
  },
  {
    id: 'REP-DEMO-11', disasterId: DEMO_SCENARIO_ID, sourceType: 'aid', sourceName: 'Dapur Umum Tagana (DEMO)',
    rawText: 'INFO DEMO: Distribusi tahap 2 ke Terminal Kudus: 300 paket makanan dan 40 paket obat diare diserahkan ke koordinator posko.',
    location: { name: 'Terminal Induk Kudus (Posko)', lat: -6.813, lng: 110.841 }, createdAt: T(240),
    verificationStatus: 'VERIFIED', aiConfidence: 0.87,
    extractedData: { disasterType: 'flood', locationName: 'Terminal Induk Kudus', affectedHouseholds: 90, affectedPopulation: 360, infrastructureDamage: [], needs: [{ category: 'food', quantity: null, unit: null }], urgency: 'medium', confidence: 0.87 },
    isMock: true, seedBatch: SEED_BATCH,
  },
  {
    id: 'REP-DEMO-12', disasterId: 'padang', sourceType: 'field', sourceName: 'TRC BPBD Sumbar (DEMO)',
    rawText: 'INFO DEMO: Banjir bandang Batang Kuranji, 3 aliran meluap. Posko Unand menampung 150 keluarga. Butuh masker, tangki air, dan obat ISPA.',
    location: { name: 'Kuranji, Padang', lat: -0.9515, lng: 100.3543 }, createdAt: T(255),
    verificationStatus: 'AI_REVIEWED', aiConfidence: 0.74,
    extractedData: { disasterType: 'flood', locationName: 'Kuranji, Padang', affectedHouseholds: 150, affectedPopulation: 600, infrastructureDamage: ['akses jalan terputus'], needs: [{ category: 'mask', quantity: null, unit: null }, { category: 'clean_water', quantity: null, unit: null }, { category: 'medicine', quantity: null, unit: null }], urgency: 'high', confidence: 0.74 },
    isMock: true, seedBatch: SEED_BATCH,
  },
] as typeof baseReports;

const extraAid = [
  { id: 'AID-DEMO-05', disasterId: DEMO_SCENARIO_ID, needCategory: 'shelter', quantity: 40, unit: 'unit', sourceName: 'BPBD Jateng (DEMO)', receivedAt: T(80), isMock: true, seedBatch: SEED_BATCH },
  { id: 'AID-DEMO-06', disasterId: DEMO_SCENARIO_ID, needCategory: 'food', quantity: 300, unit: 'paket', sourceName: 'Dapur Umum Tagana (DEMO)', receivedAt: T(70), isMock: true, seedBatch: SEED_BATCH },
  { id: 'AID-DEMO-07', disasterId: DEMO_SCENARIO_ID, needCategory: 'clean_water', quantity: 1500, unit: 'L', sourceName: 'PDAM Demak (DEMO)', receivedAt: T(60), isMock: true, seedBatch: SEED_BATCH },
] as typeof baseAid;

// Needs snapshot mirrors aidGapEngine math for demak (pop max 800):
// water 800*15=12000 (aid 8500 -> gap 3500), food 800*3=2400 (aid 1250 -> gap 1150),
// medicine ceil(800*.2)=160 (aid 120 -> gap 40), shelter 800/4=200 (aid 40 -> gap 160),
// boat explicit max(4,2,2)=4 (aid 2 -> gap 2). Deterministic, DEMO-labeled.
const needsDocs = [
  { id: 'NEED-DEMO-01', disasterId: DEMO_SCENARIO_ID, category: 'clean_water', estimated: 12000, unit: 'L', source: 'derived-from-REP-DEMO-01..04 + aidGapEngine v1 (DEMO)', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
  { id: 'NEED-DEMO-02', disasterId: DEMO_SCENARIO_ID, category: 'food', estimated: 2400, unit: 'paket', source: 'derived-from-REP-DEMO-01..04 + aidGapEngine v1 (DEMO)', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
  { id: 'NEED-DEMO-03', disasterId: DEMO_SCENARIO_ID, category: 'medicine', estimated: 160, unit: 'paket', source: 'derived-from-REP-DEMO reports (DEMO)', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
  { id: 'NEED-DEMO-04', disasterId: DEMO_SCENARIO_ID, category: 'shelter', estimated: 200, unit: 'unit', source: 'derived-from-REP-DEMO reports (DEMO)', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
  { id: 'NEED-DEMO-05', disasterId: DEMO_SCENARIO_ID, category: 'boat', estimated: 4, unit: 'unit', source: 'explicit-max from REP-DEMO-02/07 (DEMO)', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
];

const locationDocs = [
  { id: 'LOC-DEMO-01', disasterId: DEMO_SCENARIO_ID, name: 'Karanganyar, Demak', lat: -6.8944, lng: 110.6385, kind: 'village', note: 'DEMO', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
  { id: 'LOC-DEMO-02', disasterId: DEMO_SCENARIO_ID, name: 'Tanggul Sungai Wulan Km 3', lat: -6.901, lng: 110.645, kind: 'infrastructure', note: 'DEMO', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
  { id: 'LOC-DEMO-03', disasterId: DEMO_SCENARIO_ID, name: 'Terminal Induk Kudus (Posko)', lat: -6.813, lng: 110.841, kind: 'shelter-post', note: 'DEMO', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
  { id: 'LOC-DEMO-04', disasterId: DEMO_SCENARIO_ID, name: 'Sayung, Demak', lat: -6.9271, lng: 110.6234, kind: 'village', note: 'DEMO', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
  { id: 'LOC-DEMO-05', disasterId: DEMO_SCENARIO_ID, name: 'Gajah, Demak', lat: -6.9032, lng: 110.6781, kind: 'village', note: 'DEMO', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
  { id: 'LOC-DEMO-06', disasterId: 'padang', name: 'Kuranji, Padang', lat: -0.9515, lng: 100.3543, kind: 'command-post', note: 'DEMO', isMock: true, seedBatch: SEED_BATCH, updatedAt: SEED_AT },
];

// All demo incidents (kept in sync with src/data/disasters.ts / feat/homepage-slicing).
const DISASTER_KEYS = Object.keys(disastersData) as (keyof typeof disastersData)[];
const disasterDocs = DISASTER_KEYS.map((k) => ({ ...disastersData[k], isMock: true, seedBatch: SEED_BATCH, seededAt: SEED_AT, demoNotice: DEMO_NOTICE }));

const plan: Array<{ col: string; docs: Array<Record<string, unknown> & { id: string }> }> = [
  { col: 'disasters', docs: disasterDocs as unknown as Array<Record<string, unknown> & { id: string }> },
  { col: 'locations', docs: locationDocs },
  { col: 'reports', docs: [...baseReports, ...extraReports] as unknown as Array<Record<string, unknown> & { id: string }> },
  { col: 'needs', docs: needsDocs },
  { col: 'aid', docs: [...baseAid, ...extraAid] as unknown as Array<Record<string, unknown> & { id: string }> },
];

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const verifyOnly = args.has('--verify-only');
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '';

  console.log(`target project : ${PROJECT_ID}`);
  console.log(`seed batch     : ${SEED_BATCH}`);
  console.log(`seed clock     : ${SEED_AT} (frozen)`);
  for (const g of plan) console.log(`plan ${g.col.padEnd(10)} : ${g.docs.length} docs (deterministic IDs)`);
  console.log(`credentials    : GOOGLE_APPLICATION_CREDENTIALS=${gac || '(unset)'}`);
  if (!dryRun && !verifyOnly) {
    if (!gac) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set. Place the service-account file OUTSIDE the repo and export its absolute path.');
    if (!existsSync(gac)) throw new Error(`Credential file not found at GOOGLE_APPLICATION_CREDENTIALS path (checked existence only, contents never printed).`);
    const st = statSync(gac);
    if (!st.isFile()) throw new Error('GOOGLE_APPLICATION_CREDENTIALS does not point to a regular file.');
    console.log('credentials    : file exists (contents never printed)');
  }

  if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });

  if (dryRun) {
    console.log('dry-run        : no writes, no network (dataset assembly only)');
    // In-memory sanity: deterministic IDs unique, demo metadata present, statuses mixed.
    const ids = new Set<string>();
    for (const g of plan) {
      for (const d of g.docs) {
        if (ids.has(`${g.col}/${d.id}`)) throw new Error(`duplicate ID ${g.col}/${d.id}`);
        ids.add(`${g.col}/${d.id}`);
        if (d.isMock !== true || d.seedBatch !== SEED_BATCH) throw new Error(`missing demo metadata on ${g.col}/${d.id}`);
      }
    }
    const statuses = new Set((plan.find((g) => g.col === 'reports')?.docs ?? []).map((d) => d.verificationStatus));
    for (const s of ['UNVERIFIED', 'AI_REVIEWED', 'VERIFIED', 'CONFLICTING']) {
      if (!statuses.has(s)) throw new Error(`status ${s} missing from reports`);
    }
    console.log(`dry-run        : ${ids.size} unique IDs, demo metadata OK, all 4 statuses present`);
    return;
  }
  const db = getFirestore();

  if (!verifyOnly) {
    // Idempotent upserts only for our deterministic demo IDs. Never delete; never touch other docs.
    const BATCH_LIMIT = 400;
    let batches = 0;
    let batch: WriteBatch = db.batch();
    let pending = 0;
    const commit = async () => { if (pending > 0) { await batch.commit(); batches += 1; batch = db.batch(); pending = 0; } };
    for (const g of plan) {
      for (const d of g.docs) {
        batch.set(db.collection(g.col).doc(d.id), d, { merge: false });
        pending += 1;
        if (pending >= BATCH_LIMIT) await commit();
      }
    }
    await commit();
    console.log(`writes         : upserted demo docs in ${batches} batch(es), no deletes`);
  }

  // Read-only verification (counts + 9 checks).
  const counts: Record<string, number> = {};
  for (const g of plan) {
    const snap = await db.collection(g.col).get();
    counts[g.col] = snap.size;
  }
  console.log(`counts         : ${plan.map((g) => `${g.col}=${counts[g.col]}`).join(' ')}`);
  const repSnap = await db.collection('reports').get();
  const reps = repSnap.docs.map((d: { data: () => Record<string, unknown> }) => d.data());
  const has = (s: string) => reps.some((r) => r.verificationStatus === s);
  const demoMeta = repSnap.docs.filter((d: { data: () => Record<string, unknown> }) => d.data().seedBatch === SEED_BATCH).length;
  const aidSnap = await db.collection('aid').get();
  const needSnap = await db.collection('needs').get();
  const disSnap = await db.collection('disasters').get();
  const checks: Array<[string, boolean]> = [
    ['>=1 disaster', disSnap.size >= 1],
    ['>=1 VERIFIED report', has('VERIFIED')],
    ['>=1 AI_REVIEWED report', has('AI_REVIEWED')],
    ['>=1 CONFLICTING report', has('CONFLICTING')],
    ['>=1 UNVERIFIED report', has('UNVERIFIED')],
    ['>=1 need', needSnap.size >= 1],
    ['>=1 aid', aidSnap.size >= 1],
    ['demo metadata (seedBatch on reports)', demoMeta === repSnap.size && repSnap.size > 0],
    ['deterministic IDs stable (REP-DEMO-01, AID-DEMO-01 present)', (await db.collection('reports').doc('REP-DEMO-01').get()).exists && (await db.collection('aid').doc('AID-DEMO-01').get()).exists],
  ];
  for (const [name, ok] of checks) console.log(`check ${ok ? 'PASS' : 'FAIL'} : ${name}`);
  // Aid-gap sanity (water): estimated 12000 vs received 8500 -> gap 3500.
  const waterAid = aidSnap.docs.map((d: { data: () => Record<string, unknown> }) => d.data()).filter((a: Record<string, unknown>) => a.needCategory === 'clean_water').reduce((s: number, a: Record<string, unknown>) => s + Number(a.quantity ?? 0), 0);
  console.log(`aid-gap water: estimated=12000 received=${waterAid} gap=${12000 - waterAid} (expect gap>0)`);
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length > 0) { console.error(`VERIFICATION FAILED: ${failed.length} check(s)`); process.exit(1); }
  console.log(verifyOnly || dryRun ? 'verify-only    : done (no writes)' : 'seed           : done, verification PASS');
}

main().catch((e) => { console.error(`SEED FAILED: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
