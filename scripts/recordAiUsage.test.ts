import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import { recordServerUsage } from './recordAiUsage.ts';

test('records only provider counts without content, missing metadata produces no fake usage', async () => {
  const rows: any[] = [];
  const db = {collection: (name: string) => {assert.equal(name,'aiUsage'); return {add:async (row: any) => rows.push(row)};}} as unknown as Firestore;
  await recordServerUsage(db, undefined,'model','crawler');
  await recordServerUsage(db, {totalTokenCount:-1},'model','crawler');
  assert.equal(rows.length,0);
  await recordServerUsage(db, {promptTokenCount:10,candidatesTokenCount:5,totalTokenCount:18},'model','crawler');
  assert.equal(rows[0].total,18); // Provider total may include thinking tokens.
  assert.equal(rows[0].source,'crawler');
  assert.equal(rows[0].input,10);
  assert.equal(rows[0].output,5);
  assert.equal('prompt' in rows[0],false);
  await recordServerUsage(db, {totalTokenCount:3},'model','crawler');
  assert.equal(rows[1].input,null);
});
test('telemetry failure does not discard successful AI output', async () => {
  const db = {collection: () => ({add:async () => {throw new Error('permission-denied');}})} as unknown as Firestore;
  await assert.doesNotReject(recordServerUsage(db,{totalTokenCount:2},'model','crawler'));
});
