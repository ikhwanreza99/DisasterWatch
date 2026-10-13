import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCheckRunner } from './automaticChecks.ts';
import type { ServiceCheck } from './model.ts';
const result: ServiceCheck = {id:'x',name:'x',state:'ok',detail:'passed',checkedAt:'2026-10-13T00:00:00Z',scope:'browser'};
test('double mount shares one request; explicit retry and expiry run again', async () => {
  let calls=0, time=0;
  const run=createCheckRunner(async()=>{calls++;return result;},()=>time,100);
  await Promise.all([run('x'),run('x')]); assert.equal(calls,1);
  await run('x'); assert.equal(calls,1);
  await run('x',true); assert.equal(calls,2);
  time=101; await run('x'); assert.equal(calls,3);
});
test('failed request does not prevent next service from running', async()=>{
  const run=createCheckRunner(async id=>{if(id==='bad')throw new Error('failed');return result;});
  const results=await Promise.allSettled([run('bad'),run('good')]);
  assert.equal(results[0].status,'rejected');assert.equal(results[1].status,'fulfilled');
});
