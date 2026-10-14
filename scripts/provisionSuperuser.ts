import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
  const raw=process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  const password=process.env.ADMIN_INITIAL_PASSWORD;
  if(!raw || !password) throw new Error('Missing provisioning configuration');
  const account=JSON.parse(raw);
  if(account.project_id!=='disasterwatch-61ed5')throw new Error('Project mismatch');
  const credential=cert(account);
  const app=initializeApp({credential,projectId:account.project_id},'provision-superuser');
  try {
    // Enable email/password for this dedicated account; Google OAuth stays enabled.
    const token=await credential.getAccessToken();
    const response=await fetch('https://identitytoolkit.googleapis.com/admin/v2/projects/disasterwatch-61ed5/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired',{
      method:'PATCH',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},
      body:JSON.stringify({signIn:{email:{enabled:true,passwordRequired:true}}}),
    });
    if(!response.ok)throw new Error(`Provider setup HTTP ${response.status}`);
    const auth=getAuth(app);const email='admin@disasterwatch-61ed5.local';
    let user;
    try { user=await auth.getUserByEmail(email); }
    catch(error) { if((error as {code?:string}).code!=='auth/user-not-found')throw error; }
    if(user) user=await auth.updateUser(user.uid,{password,disabled:false,displayName:'admin'});
    else user=await auth.createUser({email,password,displayName:'admin',disabled:false});
    await auth.setCustomUserClaims(user.uid,{...user.customClaims,superuser:true});
    await auth.revokeRefreshTokens(user.uid);
    const verified=await auth.getUser(user.uid);
    if(verified.customClaims?.superuser!==true)throw new Error('Superuser readback failed');
    await getFirestore(app).collection('users').doc('admin').set({username:'admin',role:'SUPERUSER',authProvider:'firebase-auth',authUid:user.uid,accountStatus:'ACTIVE',permissions:['disaster-approval','report-approval']},{merge:true});
    console.log('Superuser admin created/updated; custom claim superuser=true verified. No password logged.');
  } finally {await deleteApp(app);}
}
main().catch(error=>{console.error(`Superuser provisioning failed: ${String((error as {code?:string}).code??'').replace(/[^a-z/-]/gi,'')} ${error instanceof Error ? error.message.match(/HTTP \d{3}/)?.[0]??'' : ''}`);process.exitCode=1;});
