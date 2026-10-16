import { useEffect, useRef, useState } from 'react';
import type { DisasterCheckpoint, DisasterIncident } from '../../types';
import { recommendEvacuation } from './recommendEvacuation';
import { MAX_CANDIDATES } from './evacuationCandidates';

/** Shared by Posko Bantuan and donations; recommendation requests share the cache. */
export function useEvacuationPosts(disaster: DisasterIncident, onPosts?: (id: string, posts: DisasterCheckpoint[]) => void, enabled = true) {
 const reported = disaster.route.checkpoints.some(p => !p.recommendation);
 const [state,setState] = useState({id:disaster.id,posts:disaster.route.checkpoints.slice(0,MAX_CANDIDATES),loading:enabled&&!reported,error:false,method:null as 'gemini'|'distance'|null,anchorNote:null as string|null,radius:5000});
 const [retry,setRetry] = useState(0);
 const notify = useRef(onPosts); notify.current=onPosts;
 useEffect(()=>{
  let active=true;
  const initial=disaster.route.checkpoints.slice(0,MAX_CANDIDATES);
  setState({id:disaster.id,posts:initial,loading:enabled&&!reported,error:false,method:null,anchorNote:null,radius:5000});
  if(!enabled || reported)return;
  const receive=(posts:DisasterCheckpoint[])=>{
   if(!active)return;
   setState(previous=>({...previous,posts}));
   notify.current?.(disaster.id,posts);
  };
  recommendEvacuation(disaster,receive).then(result=>{
   if(!active)return;
   setState({id:disaster.id,...result,loading:false,error:false});
   notify.current?.(disaster.id,result.posts);
  }).catch(()=>{if(active)setState(previous=>({...previous,error:true,loading:false}));});
  return()=>{active=false;};
 },[disaster.id,disaster.coords.lat,disaster.coords.lng,reported,enabled,retry]);
 const current=state.id===disaster.id?state:{...state,posts:disaster.route.checkpoints.slice(0,MAX_CANDIDATES),loading:true,error:false};
 return {...current,...(reported?{posts:disaster.route.checkpoints.slice(0,MAX_CANDIDATES)}:{}),hasReportedPosts:reported,refresh:()=>setRetry(n=>n+1)};
}
