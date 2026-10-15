import {useEffect,useState} from 'react';
import {newsSourceUrl} from './newsSourceUrl';
import {inRecentWindow} from './recentWindow';
import type {NarrativeFact} from './articleNarrative';
interface Dataset {version:number;generatedAt:string;incidents:Record<string,{facts:NarrativeFact[]}>}
let request:Promise<Dataset>|null=null;
export function useIncidentNarratives(incidentId:string){
 const [facts,setFacts]=useState<NarrativeFact[]>([]);
 useEffect(()=>{let active=true;setFacts([]);
  request??=fetch('/data/incident-narratives.json',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw new Error('Unavailable');return r.json();});
  request.then(data=>{if(!active||data.version!==1)return;setFacts((data.incidents?.[incidentId]?.facts??[]).filter(f=>['DISTRIBUTED','NEEDED','CAPACITY','AID_VALUE','LOSS','BENEFICIARIES'].includes(f.kind)&&Number.isFinite(f.quantity)&&f.quantity>0&&typeof f.item==='string'&&typeof f.unit==='string'&&!!newsSourceUrl(f.sourceUrl)&&inRecentWindow(f.publishedAt)));}).catch(()=>{request=null;});
  return()=>{active=false;};
 },[incidentId]);return facts;
}
