// Explicit manual probe: one real Gemini call, no prompt/content stored.
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { recordServerUsage } from './recordAiUsage.ts';
const account = JSON.parse(process.env.FIREBASE_NEWS_SERVICE_ACCOUNT || '{}');
if (account.project_id !== 'disasterwatch-61ed5') throw new Error('Missing or mismatched Firestore credentials');
const key = process.env.DISASTERWATCH_GEMINI_SEARCH_KEY;
if (!key) throw new Error('Missing Gemini key');
const app = initializeApp({credential:cert(account),projectId:account.project_id});
try {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({model:'gemini-3.8-flash',input:'Jawab satu kata: OK',store:false}), signal:AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const data = await response.json() as {usage?:{total_input_tokens?:number;total_output_tokens?:number;total_tokens?:number}};
  if (!Number.isSafeInteger(data.usage?.total_tokens)) throw new Error('Provider returned no token metadata');
  const db = getFirestore(app);
  const transport = `Manual probe ${process.env.GITHUB_RUN_ID || Date.now()}`;
  await recordServerUsage(db,{promptTokenCount:data.usage?.total_input_tokens,candidatesTokenCount:data.usage?.total_output_tokens,totalTokenCount:data.usage?.total_tokens},'gemini-3.8-flash',transport);
  const rows = await db.collection('aiUsage').where('transport','==',transport).limit(1).get();
  if (rows.empty) throw new Error('aiUsage readback failed');
  console.log('Verified aiUsage write/readback; actual provider token counts recorded.');
} finally { await deleteApp(app); }
