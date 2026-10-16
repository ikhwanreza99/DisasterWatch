// Public detections only; NASA MAP_KEY is never written to the snapshot or logs.
import {mkdir,writeFile} from 'node:fs/promises';
async function main(){
 const key=process.env.NASA_FIRMS_MAP_KEY?.trim();if(!key)throw new Error('FIRMS server key not configured');
 const start=new Date(Date.now()-4*86400000).toISOString().slice(0,10);
 const sources:Record<string,string>={};
 for(const source of ['VIIRS_SNPP_NRT','VIIRS_NOAA20_NRT','VIIRS_NOAA21_NRT','MODIS_NRT'])try{
  const r:Response=await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/92,-13.5,143,9/5/${start}`,{signal:AbortSignal.timeout(25000),redirect:'error'});
  if(!r.ok)continue;const csv:string=await r.text();if(csv.startsWith('latitude,')&&!csv.includes(key)&&csv.length<20e6)sources[source]=csv;
 }catch{/* Failure is reported only as a count. */}
 if(!Object.keys(sources).length)throw new Error('No FIRMS sources available');
 await mkdir('public/data',{recursive:true});await writeFile('public/data/firms.json',JSON.stringify({version:1,generatedAt:new Date().toISOString(),start,end:new Date().toISOString().slice(0,10),sources}));
 console.log(`FIRMS public snapshot: ${Object.keys(sources).length}/4 sources; no key included`);
}
main().catch(()=>{console.error('FIRMS snapshot unavailable; no credentials logged');process.exitCode=1;});
