import { inRecentWindow, recentWindow } from '../../src/services/recentWindow.ts';
import { newsSourceUrl } from '../../src/services/newsSourceUrl.ts';
export interface ThreadsHit {id:string;url:string;text:string;username:string;publishedAt:string}
export function parseThreads(data: {data?:Array<{id?:unknown;text?:unknown;username?:unknown;permalink?:unknown;timestamp?:unknown}>;error?:unknown}, now=Date.now()): ThreadsHit[] {
  if(data.error || !Array.isArray(data.data))throw new Error('Invalid Threads response');
  const seen=new Set<string>();
  return data.data.flatMap(item=>{
    const url=newsSourceUrl(item.permalink);
    if(!url || !['www.threads.net','threads.net','www.threads.com','threads.com'].includes(new URL(url).hostname) || typeof item.text!=='string' || !item.text.trim() || typeof item.timestamp!=='string' || !inRecentWindow(item.timestamp,now) || seen.has(url))return [];
    seen.add(url);
    return [{id:String(item.id??''),url,text:item.text.trim().slice(0,400),username:typeof item.username==='string'?item.username.slice(0,100):'Threads',publishedAt:new Date(item.timestamp).toISOString()}];
  }).slice(0,20);
}
export async function searchThreads(q:string, token:string, request:typeof fetch=fetch, now=Date.now()):Promise<ThreadsHit[]> {
  const window=recentWindow(now); const url=new URL('https://graph.threads.net/v1.0/keyword_search');
  for(const [key,value] of Object.entries({q,search_type:'RECENT',limit:'20',fields:'id,text,username,permalink,timestamp',since:String(Math.floor(window.startMs/1000)),until:String(Math.floor(now/1000)),access_token:token}))url.searchParams.set(key,value);
  let response:Response;
  try {response=await request(url,{signal:AbortSignal.timeout(20_000)});}catch{throw new Error('Threads request failed');}
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return parseThreads(await response.json(),now);
}
