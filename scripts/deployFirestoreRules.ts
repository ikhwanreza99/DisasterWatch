import { cert } from 'firebase-admin/app';
import { readFile } from 'node:fs/promises';
async function main() {
  const account=JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT??'{}');
  if(account.project_id!=='disasterwatch-61ed5')throw new Error('Project mismatch');
  console.log(`Rules service account: ${account.client_email}`);
  const token=await cert(account).getAccessToken();
  const headers={Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'};
  const base='https://firebaserules.googleapis.com/v1/projects/disasterwatch-61ed5';
  const rules=await readFile('firestore.rules','utf8');
  const test=await fetch(`${base}:test`,{method:'POST',headers,body:JSON.stringify({source:{files:[{name:'firestore.rules',content:rules}]}})});
  if(!test.ok) {
    const failure=await test.json() as {error?:{status?:string;details?:Array<{reason?:string}>}};
    console.log(`Rules access: ${failure.error?.status??'unknown'}; reasons: ${failure.error?.details?.map(detail=>detail.reason).filter(Boolean).join(', ')??'none'}`);
    throw new Error(`Rules validation HTTP ${test.status}`);
  }
  const validation=await test.json() as {issues?:Array<{severity?:string;description?:string}>};
  const errors=validation.issues?.filter(issue=>issue.severity==='ERROR')??[];
  if(errors.length){console.log(errors.map(issue=>issue.description).join('\n'));throw new Error('Rules validation failed');}
  const created=await fetch(`${base}/rulesets`,{method:'POST',headers,body:JSON.stringify({source:{files:[{name:'firestore.rules',content:rules}]}})});
  if(!created.ok)throw new Error(`Rules creation HTTP ${created.status}`);
  const ruleset=await created.json() as {name:string};
  const release=await fetch(`${base}/releases/cloud.firestore`,{method:'PATCH',headers,body:JSON.stringify({release:{name:'projects/disasterwatch-61ed5/releases/cloud.firestore',rulesetName:ruleset.name},updateMask:'rulesetName'})});
  if(!release.ok)throw new Error(`Rules release HTTP ${release.status}`);
  console.log('Firestore rules validated and released: Google-only report submissions and audited superuser approval.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Rules deployment failed');process.exitCode=1;});
