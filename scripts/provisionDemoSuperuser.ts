import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Second superuser for judges, at the project owner's request: it holds exactly
// the same privilege as `admin` (custom claim superuser=true), and its password
// is printed on /admin so the approval workflow can be demonstrated without
// handing over the primary account.
//
// Because that password is public, this account can decide live incidents like
// the primary one. Publish it only for the evaluation window and rotate or
// disable it afterwards (set DEMO_ADMIN_PASSWORD, or flip disabled below).
const DEMO_EMAIL = 'admindemo@disasterwatch-61ed5.local';
const DEMO_USERNAME = 'admindemo';
const DEMO_FALLBACK_PASSWORD = 'admindemo123';

async function main() {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Missing provisioning configuration');
  const account = JSON.parse(raw);
  if (account.project_id !== 'disasterwatch-61ed5') throw new Error('Project mismatch');
  const password = process.env.DEMO_ADMIN_PASSWORD || DEMO_FALLBACK_PASSWORD;
  const credential = cert(account);
  const app = initializeApp({ credential, projectId: account.project_id }, 'provision-demo-superuser');
  try {
    // Email/password must stay enabled for the dedicated accounts; Google OAuth is untouched.
    const token = await credential.getAccessToken();
    const response = await fetch('https://identitytoolkit.googleapis.com/admin/v2/projects/disasterwatch-61ed5/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }),
    });
    if (!response.ok) throw new Error(`Provider setup HTTP ${response.status}`);

    const auth = getAuth(app);
    let user;
    try { user = await auth.getUserByEmail(DEMO_EMAIL); }
    catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error; }
    if (user) user = await auth.updateUser(user.uid, { password, disabled: false, displayName: DEMO_USERNAME });
    else user = await auth.createUser({ email: DEMO_EMAIL, password, displayName: DEMO_USERNAME, disabled: false });

    // Identical privilege to the primary superuser, by explicit request.
    await auth.setCustomUserClaims(user.uid, { ...user.customClaims, superuser: true });
    await auth.revokeRefreshTokens(user.uid);
    const verified = await auth.getUser(user.uid);
    if (verified.customClaims?.superuser !== true) throw new Error('Demo superuser readback failed');

    await getFirestore(app).collection('users').doc(user.uid).set({
      username: DEMO_USERNAME,
      role: 'SUPERUSER',
      authProvider: 'firebase-auth',
      authUid: user.uid,
      accountStatus: 'ACTIVE',
      audience: 'evaluation',
      permissions: ['disaster-approval', 'report-approval'],
    }, { merge: true });
    console.log('Demo superuser admindemo created/updated; custom claim superuser=true verified. No password logged.');
  } finally { await deleteApp(app); }
}
main().catch(error => {
  console.error(`Demo superuser provisioning failed: ${String((error as { code?: string }).code ?? '').replace(/[^a-z/-]/gi, '')} ${error instanceof Error ? error.message.match(/HTTP \d{3}/)?.[0] ?? '' : ''}`);
  process.exitCode = 1;
});
