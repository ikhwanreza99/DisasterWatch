import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, browserSessionPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, collection, doc, query, where, orderBy, documentId, limit, startAfter, getDocs, getDoc, getCountFromServer, runTransaction } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { firebaseEnv, getFirebaseApp } from '../lib/firebase/config';
import { reviewRejection, reviewEvidence } from './reviewPolicy';
import { locationValidation } from '../services/locationValidation';

let adminApp: ReturnType<typeof initializeApp> | null = null;
function context() {
  getFirebaseApp(); // Preserve default Google user session, admin has a separate app.
  if (!adminApp) {
    adminApp = getApps().find(app => app.name === 'disasterwatch-superuser') ?? initializeApp(firebaseEnv(), 'disasterwatch-superuser');
    if (import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY) initializeAppCheck(adminApp, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
  }
  return { auth: getAuth(adminApp), db: getFirestore(adminApp) };
}
async function superuser() {
  const {auth, db} = context();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Silakan login sebagai superuser.'), {status:401});
  if((await user.getIdTokenResult()).claims.superuser!==true) {
    const profile=(await getDoc(doc(db,'users','admin'))).data();
    if(profile?.authUid!==user.uid || profile?.role!=='SUPERUSER' || profile?.accountStatus!=='ACTIVE')throw Object.assign(new Error('Profil superuser belum aktif atau belum terhubung dengan Firebase Auth.'),{status:401});
  }
  return {auth, db, user};
}
export async function firebaseAdminApi(path: string, body?: any): Promise<unknown> {
  if (path === '/login') {
    if (body?.username !== 'admin') throw Object.assign(new Error('Username atau password salah.'), {status:401});
    const {auth} = context();
    await setPersistence(auth, browserSessionPersistence);
    try {
      await signInWithEmailAndPassword(auth, 'admin@disasterwatch-61ed5.local', body.password);
      await superuser();
    } catch { await signOut(auth); throw Object.assign(new Error('Login ditolak. Periksa akun superuser dan Email/Password provider.'), {status:401}); }
    return {username:'admin', demo:false};
  }
  const {auth, db, user} = await superuser();
  if (path === '/ai-usage') {
    const snapshot = await getDocs(query(collection(db,'aiUsage'), orderBy('at','desc'), limit(1000)));
    return snapshot.docs.map(d => ({...d.data(), id:d.id}));
  }
  if (path === '/session') return {username:'admin', demo:false};
  if (path === '/logout') { await signOut(auth); return {ok:true}; }
  if (path === '/health') { await getDocs(query(collection(db,'reports'),limit(1))); return {state:'ok', checkedAt:new Date().toISOString(), detail:'Firebase Auth superuser dan akses Firestore berhasil.'}; }
  const url = new URL(path, 'https://admin.local');
  if (url.pathname === '/records') {
    const name = url.searchParams.get('collection') ?? '';
    if (!['reports','disasters','incidents'].includes(name)) throw new Error('Koleksi tidak valid.');
    const constraints = [];
    const status = url.searchParams.get('status');
    if (status && name === 'reports') constraints.push(where('verificationStatus','==',status));
    const base = query(collection(db,name),...constraints);
    const after = url.searchParams.get('after');
    const page = query(base,orderBy(documentId()),...(after ? [startAfter(after)] : []),limit(51));
    const [rows, count] = await Promise.all([getDocs(page),getCountFromServer(base)]);
    const records = rows.docs.slice(0,50).map(d=>({...d.data(),id:d.id}));
    if(name==='incidents') {
      // Exact IDs only: never join unrelated incidents by city name.
      const linked = await Promise.all(records.map(row=>getDoc(doc(db,'disasters',row.id))));
      return {rows:records.map((row,i)=>({...row,reviewDisaster:linked[i].exists() && linked[i].data()?.isMock===false ? {...linked[i].data(),id:linked[i].id} : null})),total:count.data().count,next:rows.size>50?rows.docs[49].id:null,demo:false};
    }
    return {rows:records,total:count.data().count,next:rows.size>50?rows.docs[49].id:null,demo:false};
  }
  const reject = url.pathname.match(/^\/(reports|disasters)\/([^/]+)\/reject$/);
  if (reject) {
    const name=reject[1], id=decodeURIComponent(reject[2]);
    if (id.includes('/')) throw new Error('ID tidak valid.');
    const evidence=reviewRejection(body?.note,body?.reason,body?.evidenceUrls);
    const audit=doc(collection(db,'reportReviews'));
    const review={reviewedBy:user.uid,reviewedAt:new Date().toISOString(),reviewNote:evidence.note,evidenceUrls:evidence.urls,reviewAuditId:audit.id,rejectionReason:evidence.reason};
    await runTransaction(db,async tx=>{
      const ref=doc(db,name,id), snap=await tx.get(ref), record=snap.data();
      if (!record) throw new Error('Data tidak ditemukan.');
      if (record.isMock===true) throw new Error('Laporan demo tidak dapat digunakan untuk menolak kejadian nyata.');
      const previousStatus=name==='reports'?record.verificationStatus:record.approvalStatus??'PENDING';
      if (previousStatus!==body.expectedStatus || previousStatus==='REJECTED') throw new Error('Status berubah. Muat ulang daftar.');
      const disasterRef=name==='disasters'?ref:doc(db,'disasters',record.disasterId || `reported-${id}`);
      const disasterSnap=name==='disasters'?snap:await tx.get(disasterRef);
      if (disasterSnap.data()?.isMock===true) throw new Error('Titik demo tidak dapat diputuskan sebagai kejadian nyata.');
      if(name==='reports')tx.update(ref,{...review,verificationStatus:'REJECTED',disasterId:disasterRef.id});
      if(disasterSnap.exists())tx.update(disasterRef,{...review,approvalStatus:'REJECTED'});
      else tx.set(disasterRef,{id:disasterRef.id,isMock:false,...review,approvalStatus:'REJECTED'});
      tx.set(audit,{...review,targetCollection:name,targetId:id,disasterId:disasterRef.id,previousStatus,decision:'REJECTED',reportId:name==='reports'?id:null});
    });
    return {...review,verificationStatus:'REJECTED'};
  }
  const approve = url.pathname.match(/^\/(reports|disasters)\/([^/]+)\/approve$/);
  if (approve) {
    const name=approve[1], id=decodeURIComponent(approve[2]);
    if (id.includes('/')) throw new Error('ID tidak valid.');
    const evidence=reviewEvidence(body?.note, body?.evidenceUrls);
    const audit=doc(collection(db,'reportReviews'));
    const reviewedAt=new Date().toISOString();
    const review={reviewedBy:user.uid, reviewedAt, reviewNote:evidence.note, evidenceUrls:evidence.urls, reviewAuditId:audit.id};
    await runTransaction(db,async tx=>{
      const ref=doc(db,name,id); const snap=await tx.get(ref); const record=snap.data();
      if (!record) throw new Error('Data tidak ditemukan.');
      if (record.isMock === true) throw new Error('Data demo tidak dapat disetujui sebagai kejadian nyata.');
      if (name==='disasters' && locationValidation(record).status==='REJECTED') throw new Error('Koordinat tidak sesuai provinsi. Koreksi data lokasi sebelum menyetujui titik ini.');
      const previousStatus=name==='reports'?record.verificationStatus:record.approvalStatus??'PENDING';
      if (previousStatus!==body.expectedStatus || ['VERIFIED','APPROVED','REJECTED'].includes(previousStatus)) throw new Error('Status berubah. Muat ulang daftar.');
      let disasterRef = name==='disasters'?ref:doc(db,'disasters',record.disasterId || `reported-${id}`);
      const disasterSnap=name==='disasters'?snap:await tx.get(disasterRef);
      if(disasterSnap.data()?.approvalStatus==='REJECTED')throw new Error('Titik ini sudah ditolak. Persetujuan laporan lain tidak dapat mengaktifkannya kembali.');
      const createPoint = name==='reports' && !disasterSnap.exists();
      const lat=Number(body.lat??record.location?.lat), lng=Number(body.lng??record.location?.lng);
      const province=typeof body.province==='string'?body.province.trim():record.province??'';
      if (createPoint && (!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90 || lat > 90 || lng < -180 || lng > 180)) throw new Error('Titik baru memerlukan koordinat yang telah diperiksa.');
      if(createPoint && locationValidation({province,lat,lng}).status!=='REGION_CHECKED')throw new Error('Titik baru memerlukan provinsi yang dikenali dan koordinat yang sesuai wilayahnya.');
      if (name==='reports') tx.update(ref,{...review,verificationStatus:'VERIFIED',disasterId:disasterRef.id});
      if (createPoint) {
        const category=['flood','fire','earthquake','landslide','other'].includes(record.extractedData?.disasterType)?record.extractedData.disasterType:'other';
        tx.set(disasterRef,{id:disasterRef.id,name:record.location?.name || 'Lokasi laporan',province,category,fullName:category,fullTitleDisplay:category,urgency:'Disetujui superuser',urgencyClass:'bg-emerald-50 text-emerald-700',impact:'Dampak belum diverifikasi',cost:'Belum tersedia',gapRecovery:'Belum tersedia',recoveryPct:0,recoveryServices:[],coords:{lat,lng},timestamp:reviewedAt,eventDate:record.createdAt?.slice(0,10)??reviewedAt.slice(0,10),photoUrl:'',photoAlt:'',photoSource:'',stats:{hotspots:'Belum tersedia',hotspotsChange:'',loss:'Belum tersedia',lossChange:'',personnel:'Belum tersedia',personnelChange:''},guide:{title:'Informasi kejadian',cause:record.rawText,hazards:'Ikuti arahan BPBD setempat.',safeRadius:'Belum tersedia',protocols:[],evacRoute:'Belum tersedia'},supplies:[],route:{distance:'Belum tersedia',duration:'Belum tersedia',convoy:'Belum tersedia',statusBadge:'Belum tersedia',checkpoints:[]},reports:[],isMock:false,demoNotice:'REAL',sourceUrl:evidence.urls[0],sourceName:'Fact-check superuser',...review,approvalStatus:'APPROVED'});
      } else tx.update(disasterRef,{...review,approvalStatus:'APPROVED'});
      tx.set(audit,{...review,targetCollection:name,targetId:id,disasterId:disasterRef.id,previousStatus,decision:'APPROVED',reportId:name==='reports'?id:null});
    });
    return {...review,verificationStatus:'VERIFIED'};
  }
  const evidenceMatch=url.pathname.match(/^\/evidence\/([^/]+)$/);
  if(evidenceMatch) {
    const id=decodeURIComponent(evidenceMatch[1]);
    const records=await getDocs(query(collection(db,'incidentArticles'),where('incidentId','==',id),limit(30)));
    return {rows:records.docs.map(d=>({id:d.id,...d.data()})).filter((row:any)=>row.discoveredBy!=='threads:keyword-search')};
  }
  throw new Error('Endpoint tidak tersedia.');
}
