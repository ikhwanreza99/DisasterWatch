import test from 'node:test';
import assert from 'node:assert/strict';
import { narrativeAidProgress } from '../src/services/narrativeAidProgress';
import type { NarrativeFact } from '../src/services/articleNarrative';
const fact = (kind: NarrativeFact['kind'], item: string, quantity: number, unit: string): NarrativeFact => ({ kind, item, quantity, unit, sourceUrl: 'https://example.org/padang', sourceName: 'Berita', publishedAt: '2026-10-13', organization: 'BNI' });
test('equal allocation uses largest population, not sum, and caps progress', () => {
 const facts = [fact('IMPACT', 'Warga terdampak', 753, 'jiwa'), fact('IMPACT', 'Pengungsi', 672, 'orang'), fact('IMPACT', 'KK', 900, 'kk'), fact('DISTRIBUTED', 'nasi siap konsumsi', 400, 'bungkus')];
 const [estimate] = narrativeAidProgress(facts);
 assert.equal(estimate.population, 753);
 assert.equal(estimate.pct.toFixed(1), '53.1');
 assert.equal(estimate.required - estimate.received, 353);
 assert.equal(narrativeAidProgress([...facts, fact('DISTRIBUTED', 'selimut', 900, 'pcs')])[1].pct, 100);
});
test('capacity and unknown population do not become servings', () => {
 const facts = [fact('IMPACT', 'Warga terdampak', 753, 'jiwa'), fact('CAPACITY', 'air bersih', 8000, 'liter')];
 assert.deepEqual(narrativeAidProgress(facts), []);
 assert.deepEqual(narrativeAidProgress([fact('DISTRIBUTED', 'nasi siap konsumsi', 400, 'bungkus')]), []);
});
test('duplicate reports do not inflate deliveries', () => {
 const delivery = fact('DISTRIBUTED', 'nasi siap konsumsi', 400, 'bungkus');
 assert.equal(narrativeAidProgress([fact('IMPACT', 'Warga', 753, 'jiwa'), delivery, {...delivery, sourceUrl: 'https://example.org/other'}]).length, 1);
});

test('packages use 30 people, boxes use 40 pieces, and source contents override the assumption', () => {
 const population = fact('IMPACT', 'Warga', 753, 'jiwa');
 const rows = narrativeAidProgress([population, fact('DISTRIBUTED', 'sembako', 10, 'paket'), fact('DISTRIBUTED', 'air mineral', 2, 'box'), fact('DISTRIBUTED', 'air mineral isi 24 botol', 2, 'dus')]);
 assert.equal(rows[0].received, 300);
 assert.equal(rows[0].pct.toFixed(1), '39.8');
 assert.equal(rows[1].received, 80);
 assert.equal(rows[2].received, 48);
 assert.match(rows[0].assumption, /30 jiwa/);
});
test('ready meals remain one serving and age-specific aid stays listed without general-population progress', () => {
 const rows = narrativeAidProgress([fact('IMPACT', 'Warga', 753, 'jiwa'), fact('DISTRIBUTED', 'nasi siap konsumsi', 400, 'paket'), fact('DISTRIBUTED', 'baju bayi', 20, 'paket')]);
 assert.equal(rows.length, 1);
 assert.equal(rows[0].received, 400);
 assert.equal(rows[0].allocationUnit, 'porsi');
});
