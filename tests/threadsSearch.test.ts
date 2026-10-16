import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseThreads,searchThreads} from '../scripts/providers/threadsSearch.ts';
const now=Date.parse('2026-10-14T12:00:00+07:00');
const post={id:'1',text:'Banjir Kota Padang membutuhkan air bersih.',username:'pelapor',permalink:'https://www.threads.com/@pelapor/post/abc',timestamp:'2026-10-13T10:00:00Z'};
test('Threads only retains safe dated post permalinks and deduplicates',()=>{
  assert.equal(parseThreads({data:[post,post,{...post,permalink:'https://example.org/post'},{...post,permalink:'https://threads.com/@x/post/old',timestamp:'2026-09-30T00:00:00Z'}]},now).length,1);
  assert.throws(()=>parseThreads({error:{message:'private token error'}},now));
});
test('request uses dated RECENT keyword search, and errors never expose the token',async()=>{
  const request=(async(url)=>{const q=new URL(String(url)).searchParams;assert.equal(q.get('search_type'),'RECENT');assert.equal(q.get('access_token'),'test-token');assert.equal(q.get('since'),String(Math.floor(Date.parse('2026-10-01T00:00:00+07:00')/1000)));return new Response(JSON.stringify({data:[post]}));}) as typeof fetch;
  assert.equal((await searchThreads('Padang banjir','test-token',request,now)).length,1);
  await assert.rejects(searchThreads('q','test-token',(async()=>{throw new Error('url?access_token=test-token');}) as typeof fetch,now),{message:'Threads request failed'});
});
