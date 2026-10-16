// Padang pilot: source-backed article narratives, no estimated needs or invented loss.
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {cert,initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {fetchNarrative,isNarrativePublisher} from './providers/articleNarrative.ts';
import {extractNarrativeFacts,type NarrativeFact} from '../src/services/articleNarrative.ts';
import {inRecentWindow} from '../src/services/recentWindow.ts';
const sources=[
 {url:'https://sumbar.antaranews.com/berita/782685/pertamina-sumbar-berikan-bantuan-bencana-banjir-di-kota-padang',sourceName:'ANTARA Sumbar',publishedAt:'2026-10-13T15:03:00+07:00',title:'Pertamina Sumbar Berikan Bantuan Bencana Banjir di Kota Padang'},
 {url:'https://www.hukumonline.com/berita/a/bni-salurkan-bantuan-untuk-warga-terdampak-banjir-di-kota-padang-lt6acdf4679cc91',sourceName:'Hukumonline',publishedAt:'2026-10-13',title:'BNI Salurkan Bantuan untuk Warga Terdampak Banjir di Kota Padang'},
 // BNPB/Pusdalops figures for this pilot (displaced people, affected households,
 // flooded homes). Fetched every deploy like the references above, so the reported
 // impact rows survive a changing Firestore candidate list or relevance decision.
 {url:'https://rri.co.id/nasional/2804357/banjir-padang-belum-surut-bnpb-ungkap-jumlah-pengungsi-hingga-kerusakan-rumah',sourceName:'RRI.co.id',publishedAt:'2026-10-12T10:05:00+07:00',title:'Banjir Padang Belum Surut, BNPB Ungkap Jumlah Pengungsi hingga Kerusakan Rumah'},
];
// One retry for a transient network/HTTP failure; a policy rejection is final, so a
// blocked publisher is not fetched twice. A missing article stays unavailable either way.
async function fetchWithRetry(url:string):Promise<string[]|null>{
 for(let attempt=0;attempt<2;attempt++){
  try{return await fetchNarrative(url);}
  catch(error){if(/Publisher not enabled|Invalid article URL/.test(String(error)))return null;}
 }
 return null;
}
async function main(){
 const now=new Date().toISOString();let app;const rows:NarrativeFact[]=[];const checks:Array<{url:string;state:string;facts:number}>=[];
 const raw=process.env.FIREBASE_NEWS_SERVICE_ACCOUNT;
 try{
  const account=raw?JSON.parse(raw):null;
  if(account){if(account.project_id!=='disasterwatch-61ed5')throw new Error('Project mismatch');app=initializeApp({credential:cert(account),projectId:account.project_id},'narratives');}
  const candidates=[...sources];
  if(app){
    const stored=await getFirestore(app).collection('incidentArticles').where('incidentId','==','padang').limit(100).get();
    // Aid/needs/recovery reports plus reported-impact reports (displacement, homes),
    // which carry the figures the narrative card surfaces. Fetchable publishers and
    // impact-titled reports come first: a slot spent on a blocked domain, or on a
    // report with no figures, yields nothing.
    const impactTitle=/terdampak|mengungsi|pengungsi|terjebak|evakuasi|kerusakan|rumah|korban/i;
    const rank=(url:string,title:string)=>Number(!isNarrativePublisher(url))*10+Number(!impactTitle.test(title));
    const eligible=stored.docs.map(doc=>doc.data())
      .filter(r=>r.relevance?.status==='MATCHED'&&r.discoveredBy!=='threads:keyword-search'&&inRecentWindow(r.publishedAt)&&typeof r.url==='string'&&/bantuan|kebutuhan|kerugian|pemulihan|terdampak|mengungsi|pengungsi|terjebak|evakuasi|kerusakan/i.test(r.title??''))
      .sort((a,b)=>rank(a.url,b.title??'')-rank(b.url,a.title??''));
    for(const row of eligible.slice(0,8)){
      if(!candidates.some(s=>s.url===row.url))candidates.push({url:row.url,sourceName:row.sourceName??'Media berita',publishedAt:row.publishedAt,title:row.title});
    }
  }
  // Bounded known publishers only. No redirects, paywall bypass, or full-body storage.
  for(const source of candidates.filter(s=>inRecentWindow(s.publishedAt))){
   const paragraphs=await fetchWithRetry(source.url);
   if(!paragraphs){checks.push({url:source.url,state:'UNAVAILABLE',facts:0});continue;}
   const facts=extractNarrativeFacts({...source,paragraphs});rows.push(...facts);checks.push({url:source.url,state:paragraphs.length?'FETCHED':'EMPTY',facts:facts.length});
  }
  const dataset={version:1,generatedAt:now,incidents:{padang:{incidentId:'padang',facts:rows,checks,notice:'Catatan narasi berita; bukan inventaris terkini atau verifikasi independen. Nilai bantuan berbeda dari kerugian bencana.'}}};
  await mkdir('public/data',{recursive:true});await writeFile('public/data/incident-narratives.json',JSON.stringify(dataset));
  if(app&&rows.length){const db=getFirestore(app),batch=db.batch();for(const fact of rows){const id=createHash('sha256').update(`${fact.sourceUrl}|${fact.kind}|${fact.item}|${fact.unit}|${fact.quantity}`).digest('hex').slice(0,32);batch.set(db.collection('incidentNarratives').doc(id),{...fact,incidentId:'padang',retrievedAt:now,verificationStatus:'UNVERIFIED',isMock:false},{merge:true});}await batch.commit();console.log(`Narrative facts saved: ${rows.length}`);}
  console.log(`Padang narrative extraction: ${rows.length} facts; ${checks.filter(c=>c.state==='UNAVAILABLE').length} unavailable sources`);
 }finally{if(app)await deleteApp(app);}
}
main().catch(()=>{console.error('Narrative collection failed; credentials and article bodies not logged.');process.exitCode=1;});
