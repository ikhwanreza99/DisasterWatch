import {mkdir,writeFile} from 'node:fs/promises';
import {currentRecords} from '../src/data/currentIncidents.ts';
import {allocateAggregate} from '../src/services/insights/proportionalAllocation.ts';
async function main(){
 const end=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const start=new Date(Date.parse(end+'T00:00:00Z')-6*86400000).toISOString().slice(0,10);
 const sourceUrl=`https://gis.bnpb.go.id/dev/api/summary/?id=13&start=%27${start}%27&end=%27${end}%27`;
 const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error(`BNPB HTTP ${response.status}`);
 const data=await response.json();const summary=data?.[0];if(summary?.wilayah!=='Sumatera Barat')throw new Error('Unexpected scope');
 const points=currentRecords.filter(r=>r.province==='Sumatera Barat'&&(r.startDate??r.date)>=start&&(r.startDate??r.date)<=end).map(r=>{
 const homes=r.reports?.at(-1)?.impact?.damagedHomes;
 return {id:r.id,name:r.name,weight:typeof homes==='number'&&homes>0?homes:1,weightBasis:typeof homes==='number'&&homes>0?'rumah rusak dilaporkan':'bobot minimum 1; dampak belum diketahui'};});
 const parse=(x:unknown)=>x===null||x===undefined||x===''?null: Number.isFinite(Number(x))&&Number(x)>=0&&Number.isInteger(Number(x))?Number(x):null;
 const metrics=Object.fromEntries(['rumah_rusak_berat','rumah_rusak_sedang','rumah_rusak_ringan','menderita_mengungsi'].map(key=>[key,{total:parse(summary[key]),allocations:allocateAggregate(parse(summary[key]),points)}]));
 await mkdir('public/data',{recursive:true});await writeFile('public/data/bnpb-regional.json',JSON.stringify({version:1,generatedAt:new Date().toISOString(),province:summary.wilayah,start,end,sourceUrl,points,metrics,status:'scenario_estimate',method:'reported-damaged-homes-or-minimum-one-v1',coverage:'Hanya titik dalam dataset DisasterWatch pada periode ini; belum seluruh kejadian BNPB. Bobot minimum bukan bukti dampak rendah.'}));
 console.log(`BNPB regional allocation snapshot: ${points.length} candidate points; ${start} to ${end}`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Regional snapshot failed');process.exitCode=1;});
