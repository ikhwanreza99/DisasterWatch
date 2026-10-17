import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractServiceCounts } from '../src/services/extraction/needsRecovery';

// Groundwork only: the conservative evidence parser is NOT wired into
// extractRecovery or the crawl pipeline. These tests pin its never-invent
// behavior so a future wiring review has a fixed contract.
test('extraction: explicit affected counts with units are captured', () => {
  const r = extractServiceCounts(
    'PLN: 400 pelanggan terdampak padam di Kecamatan Tapan',
    'Sebanyak 300 pelanggan sudah menyala kembali.',
  );
  assert.equal(r.affected, 400);
  assert.equal(r.affectedUnit, 'pelanggan');
  assert.equal(r.restored, 300);
  assert.equal(r.restoredUnit, 'pelanggan');
});

test('extraction: road kilometres with passability verbs', () => {
  const r = extractServiceCounts('Jalan putus', '2 km ruas jalan terputus, 1 km sudah dapat dilalui kembali.');
  assert.equal(r.affected, 2);
  assert.equal(r.affectedUnit, 'km');
  assert.equal(r.restored, 1);
  assert.equal(r.restoredUnit, 'km');
});

test('extraction: no verb or unknown unit yields nulls, never guesses', () => {
  const bare = extractServiceCounts('Laporan harian', 'Ada 500 paket bantuan dan 12 relawan di posko.');
  assert.deepEqual(bare, { affected: null, affectedUnit: null, restored: null, restoredUnit: null });
  const nounit = extractServiceCounts('Update', '150 terdampak, 20 pulih.');
  assert.deepEqual(nounit, { affected: null, affectedUnit: null, restored: null, restoredUnit: null });
});

test('extraction: negated quantities are skipped', () => {
  const r = extractServiceCounts('Info', 'Tidak ada pelanggan padam; 10 pelanggan terdampak di Desa B.');
  assert.equal(r.affected, 10);
});

test('extraction: first explicit evidence wins; nothing is summed', () => {
  const r = extractServiceCounts('Update', '100 pelanggan terdampak, lalu 50 pelanggan terdampak susulan.');
  assert.equal(r.affected, 100);
});
