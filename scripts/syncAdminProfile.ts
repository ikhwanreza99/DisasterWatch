import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
async function main() {
  const account=JSON.parse(process.env.FIREBASE_NEWS_SERVICE_ACCOUNT??'{}');
  if(account.project_id!=='disasterwatch-61ed5')throw new Error('Project mismatch');
  const app=initializeApp({credential:cert(account),projectId:account.project_id},'admin-profile');
  try {
    const ref=getFirestore(app).collection('users').doc('admin');
    await getFirestore(app).runTransaction(async tx=>{
      const existing=await tx.get(ref);
      if(!existing.exists)tx.set(ref,{username:'admin',role:'SUPERUSER',authProvider:'firebase-auth',accountStatus:'PENDING_AUTH',authUid:null,permissions:['disaster-approval','report-approval'],createdAt:new Date().toISOString()});
    });
    console.log('Firestore users/admin profile exists. No password or password hash is stored in client-readable Firestore.');
  }finally{await deleteApp(app);}
}
main().catch(()=>{console.error('Admin profile sync failed; check Firestore access.');process.exitCode=1;});
