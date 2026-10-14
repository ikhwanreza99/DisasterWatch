import assert from 'node:assert/strict';
import { test } from 'node:test';
import { realDisasterDataset, canDemoSeedOverwrite } from '../scripts/realDisasterDataset.ts';
import { NTT_CASE_ID } from '../src/domain/nttCase.ts';

test('only sourced current disasters and NTT are labeled REAL, never demo-only cities', () => {
  const docs = realDisasterDataset();
  assert(docs.length > 1);
  assert(docs.every(doc => doc.isMock === false && doc.demoNotice === 'REAL' && doc.sourceUrl.startsWith('https://')));
  assert(docs.some(doc => doc.id === 'padang' && doc.cost === 'Belum tersedia'));
  assert(docs.some(doc => doc.id === NTT_CASE_ID && doc.isArchivedCase));
  assert(!docs.some(doc => ['banjar', 'cianjur', 'demak', 'pekanbaru'].includes(doc.id)));
  assert.equal(new Set(docs.map(doc => doc.id)).size, docs.length);
});
test('demo seeding cannot downgrade real disasters even when REAL or isMock metadata is incomplete', () => {
  assert.equal(canDemoSeedOverwrite({ isMock: false }), false);
  assert.equal(canDemoSeedOverwrite({ demoNotice: 'REAL' }), false);
  assert.equal(canDemoSeedOverwrite({ isMock: true }), true);
  assert.equal(canDemoSeedOverwrite(undefined), true);
});
