import { cert, initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Second superuser for judges, at the project owner's request: it holds exactly
// the same privilege as `admin` (custom claim superuser=true), and its password
// is printed on /admin so the approval workflow can be demonstrated without
// handing over the primary account.
//
// Because that password is public, this account can decide live incidents like
// the primary one. Publish it only for the evaluation window and rotate or
// disable it afterwards (set DEMO_ADMIN_PASSWORD, or disable the user).
//
// Credentials: the hosting deploy account can release rules and hosting but
// lacks Firebase Authentication Admin, which is what this job needs. Rather than
// assume, every supplied credential is probed and the first capable one is used.
// Secret material is never logged; only the name of the env var and an outcome.
const PROJECT_ID = 'disasterwatch-61ed5';
const DEMO_EMAIL = 'admindemo@disasterwatch-61ed5.local';
const DEMO_USERNAME = 'admindemo';
const DEMO_FALLBACK_PASSWORD = 'admindemo123';

const codeOf = (error: unknown) => String((error as { code?: string }).code ?? (error instanceof Error ? error.message : error))
  .replace(/[^a-z0-9/. _-]/gi, '').slice(0, 120);

function credentialCandidates() {
  const primary = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  const fallback = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_FALLBACK;
  const list: Array<{ label: string; raw: string }> = [];
  if (primary) list.push({ label: 'FIREBASE_ADMIN_SERVICE_ACCOUNT', raw: primary });
  if (fallback && fallback !== primary) list.push({ label: 'FIREBASE_ADMIN_SERVICE_ACCOUNT_FALLBACK', raw: fallback });
  return list;
}

async function main() {
  const candidates = credentialCandidates();
  if (!candidates.length) throw new Error('phase=credential no service account was supplied');
  const password = process.env.DEMO_ADMIN_PASSWORD || DEMO_FALLBACK_PASSWORD;
  const apps: App[] = [];
  const report: string[] = [];
  let chosen: { app: App; credential: ReturnType<typeof cert> } | null = null;
  try {
    for (const [index, candidate] of candidates.entries()) {
      let account: { project_id?: string };
      try { account = JSON.parse(candidate.raw); }
      catch { report.push(`${candidate.label}=unparseable-json`); continue; }
      if (account.project_id !== PROJECT_ID) { report.push(`${candidate.label}=wrong-project`); continue; }
      const credential = cert(account as Parameters<typeof cert>[0]);
      const app = initializeApp({ credential, projectId: PROJECT_ID }, `provision-demo-${index}`);
      apps.push(app);
      // One-page read is enough to prove the Firebase Authentication Admin role.
      try {
        await getAuth(app).listUsers(1);
        report.push(`${candidate.label}=auth-admin-ok`);
        if (!chosen) chosen = { app, credential };
      } catch (error) { report.push(`${candidate.label}=${codeOf(error)}`); }
    }
    console.log(`credential probe: ${report.join(', ')}`);
    if (!chosen) throw new Error(`phase=credential no service account can administer Firebase Auth (${report.join(', ')})`);
    const { app, credential } = chosen;

    let phase = 'provider-config';
    try {
      // Best effort. Email/Password is already enabled for the primary `admin`
      // account, and a service account can hold Auth user permissions without the
      // project-config permission, so a 403 here must not block account creation.
      try {
        const token = await credential.getAccessToken();
        const response = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }),
        });
        if (!response.ok) console.warn(`Provider config skipped (HTTP ${response.status}); Email/Password is already enabled for admin.`);
      } catch (error) {
        console.warn(`Provider config skipped: ${codeOf(error)}`);
      }

      phase = 'auth-user';
      const auth = getAuth(app);
      let user;
      try { user = await auth.getUserByEmail(DEMO_EMAIL); }
      catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error; }
      if (user) user = await auth.updateUser(user.uid, { password, disabled: false, displayName: DEMO_USERNAME });
      else user = await auth.createUser({ email: DEMO_EMAIL, password, displayName: DEMO_USERNAME, disabled: false });

      // Identical privilege to the primary superuser, by explicit request.
      phase = 'custom-claim';
      await auth.setCustomUserClaims(user.uid, { ...user.customClaims, superuser: true });
      await auth.revokeRefreshTokens(user.uid);
      const verified = await auth.getUser(user.uid);
      if (verified.customClaims?.superuser !== true) throw new Error('custom claim readback did not return superuser=true');

      // The claim is what rules and the client check, so the profile is a
      // convenience record for the users collection, not a gate. A missing
      // datastore permission must not undo an account that already works.
      phase = 'profile';
      try {
        await getFirestore(app).collection('users').doc(user.uid).set({
          username: DEMO_USERNAME,
          role: 'SUPERUSER',
          authProvider: 'firebase-auth',
          authUid: user.uid,
          accountStatus: 'ACTIVE',
          audience: 'evaluation',
          permissions: ['disaster-approval', 'report-approval'],
        }, { merge: true });
      } catch (error) {
        console.warn(`Profile document skipped: ${codeOf(error)} (the superuser claim is already set, so login still works).`);
      }
      console.log(`Demo superuser admindemo provisioned; uid ${user.uid}; custom claim superuser=true verified. No password logged.`);
    } catch (error) {
      throw new Error(`phase=${phase} ${codeOf(error)}`);
    }
  } finally {
    for (const app of apps) await deleteApp(app);
  }
}

main().catch(error => {
  console.error(`Demo superuser provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
