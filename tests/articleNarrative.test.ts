import test from 'node:test';
import assert from 'node:assert/strict';
import {extractNarrativeFacts,reportedGap} from '../src/services/articleNarrative.ts';
import {narrativeParagraphs} from '../scripts/providers/articleNarrative.ts';
const base={url:'https://example.org/padang',sourceName:'Media',publishedAt:'2026-10-13',title:'Bantuan BNI untuk banjir Kota Padang'};
test('multiple items keep original units and tank capacity is not distributed water',()=>{
 const facts=extractNarrativeFacts({...base,paragraphs:['Banjir di Kota Padang. Bantuan tersebut, 60 dus air mineral, 60 karung beras 10 kg,300 pcs selimut.', 'Bantuan juga mencakup 400 bungkus nasi siap konsumsi serta satu tangki berkapasitas 8.000 liter air bersih.']});
 assert.ok(facts.some(f=>f.kind==='DISTRIBUTED'&&f.quantity===400&&f.unit==='bungkus'));
 assert.ok(facts.some(f=>f.quantity===60&&f.unit==='karung'&&f.item==='beras 10 kg'));
 assert.ok(facts.some(f=>f.kind==='CAPACITY'&&f.quantity===8000));
 assert.ok(!facts.some(f=>f.kind==='DISTRIBUTED'&&f.quantity===8000));
 assert.equal(reportedGap(facts,'air bersih','liter'),null);
});
test('aid value is never a monetary loss estimate; other cities are rejected',()=>{
 const input={...base,paragraphs:['Banjir Kota Padang. Bantuan tersebut diperkirakan senilai Rp100 juta.']};
 const facts=extractNarrativeFacts(input);
 assert.equal(facts[0].kind,'AID_VALUE');assert.equal(facts[0].quantity,100000000);
 assert.deepEqual(extractNarrativeFacts({...input,title:'Banjir Padang Panjang'}),[]);
});
test('scripts and navigation never contribute narrative quantities',()=>{
 const paragraphs=narrativeParagraphs('<script><p>Bantuan 999 dus air mineral dari iklan.</p></script><article><p>Bantuan Kota Padang disalurkan kepada warga setempat.</p></article>');
 assert.equal(paragraphs.length,1);assert.ok(!paragraphs[0].includes('999'));
});
