import {newsSourceUrl} from '../../src/services/newsSourceUrl.ts';
const PUBLISHERS=['antaranews.com','hukumonline.com','rri.co.id','bnpb.go.id','padang.go.id','bni.co.id','pertamina.com'];
const decode=(text:string)=>text.replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function narrativeParagraphs(html:string):string[]{
  const clean=html.replace(/<(script|style|nav|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  const body=clean.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]??clean;
  return [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>decode(m[1])).filter(t=>t.length>=30&&t.length<=5000&&!/baca juga|berlangganan sekarang|anda bosan baca/i.test(t));
}
export async function fetchNarrative(url:string):Promise<string[]> {
  const safe=newsSourceUrl(url);if(!safe)throw new Error('Invalid article URL');
  const host=new URL(safe).hostname;
  if(!PUBLISHERS.some(d=>host===d||host.endsWith(`.${d}`)))throw new Error('Publisher not enabled');
  const response=await fetch(safe,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'text/html'}});
  if(!response.ok||!response.headers.get('content-type')?.includes('text/html')||!response.body)throw new Error(`Article HTTP ${response.status}`);
  const reader=response.body.getReader();const decoder=new TextDecoder();let size=0,html='';
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1500000)throw new Error('Article too large');html+=decoder.decode(part.value,{stream:true});}}finally{await reader.cancel();}
  return narrativeParagraphs(html);
}
