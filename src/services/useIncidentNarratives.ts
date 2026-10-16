import {fetchSnapshot} from './snapshotCache';
import {useEffect,useState} from 'react';
import {newsSourceUrl} from './newsSourceUrl';
import {inRecentWindow} from './recentWindow';
import type {NarrativeFact} from './articleNarrative';
interface Dataset {version:number;generatedAt:string;incidents:Record<string,{facts:NarrativeFact[]}>}

export function useIncidentNarratives(incidentId:string){
 const [facts,setFacts]=useState<NarrativeFact[]>([]);
 useEffect(()=>{let active=true;setFacts([]);
  fetchSnapshot<Dataset>('/data/incident-narratives.json').then(data=>{if(!active||data.version!==1)return;setFacts((data.incidents?.[incidentId]?.facts??[]).filter(f=>['DISTRIBUTED','NEEDED','CAPACITY','AID_VALUE','LOSS','BENEFICIARIES','IMPACT'].includes(f.kind)&&Number.isFinite(f.quantity)&&f.quantity>0&&typeof f.item==='string'&&typeof f.unit==='string'&&!!newsSourceUrl(f.sourceUrl)&&inRecentWindow(f.publishedAt)));}).catch(()=>{});
  return()=>{active=false;};
 },[incidentId]);return facts;
}
