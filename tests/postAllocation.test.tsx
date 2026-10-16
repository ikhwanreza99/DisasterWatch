import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { postAllocation } from '../src/services/places/postAllocation';
import type { NarrativeFact } from '../src/services/articleNarrative';
import { PostCapacityEstimate } from '../src/components/PostCapacityEstimate';
import { DonationModal } from '../src/components/DonationModal';
import { nttIncident } from '../src/data/nttIncident';
import { LanguageProvider } from '../src/i18n';
const fact=(quantity:number,unit='jiwa',kind:NarrativeFact['kind']='IMPACT'):NarrativeFact=>({kind,quantity,unit,item:'Warga terdampak',sourceUrl:'https://example.org/source',sourceName:'Berita',organization:null,publishedAt:'2026-10-17'});

test('post allocation uses the largest population divided by five, without adding reports or converting households',()=>{
 const facts=[fact(743),fact(753,'orang'),fact(753),fact(10000,'KK'),fact(20000,'liter','CAPACITY'),fact(NaN),fact(-1)];
 const estimate=postAllocation(facts)!;
 assert.equal(estimate.population,753);
 assert.equal(estimate.postCount,5);
 assert.equal(estimate.perPost,151);
 assert.equal(estimate.sources.length,2);
 assert.equal(postAllocation([fact(99,'KK')]),null);
 assert.equal(postAllocation([]),null);
});
test('estimated capacity clearly identifies the assumption and does not claim actual occupancy',()=>{
 const html=renderToStaticMarkup(<LanguageProvider><PostCapacityEstimate estimate={postAllocation([fact(753)])}/></LanguageProvider>);
 assert.match(html,/151 jiwa\/posko \(estimasi\)/);
 assert.match(html,/753 jiwa ÷ 5 posko/);
 assert.match(html,/kapasitas lokasi belum diverifikasi/);
 assert.doesNotMatch(html,/% terisi|Tersedia|Penuh/);
 assert.equal((html.match(/href=/g)??[]).length,1);
});
test('donations display the actual supplied aid-post list rather than a fixed BPBD warehouse',()=>{
 const disaster={...nttIncident,route:{...nttIncident.route,checkpoints:Array.from({length:5},(_,i)=>({id:i+1,name:`Fasum ${i+1}`,location:`Alamat ${i+1}`,recommendation:true,placeId:`place-${i}`,googleMapsUrl:`https://maps.google.com/?q=${i}`}))}};
 const html=renderToStaticMarkup(<LanguageProvider><DonationModal isOpen onClose={()=>{}} disaster={disaster}/></LanguageProvider>);
 for(let i=1;i<=5;i++)assert.ok(html.includes(`Fasum ${i}`));
 assert.equal((html.match(/type="radio"/g)??[]).length,5);
 assert.doesNotMatch(html,/Gudang Satgas|Posko Komando Induk/);
 assert.match(html,/konfirmasi operasional/);
});
test('a donation awaiting posts cannot silently select an invented location',()=>{
 const disaster={...nttIncident,route:{...nttIncident.route,checkpoints:[]}};
 const html=renderToStaticMarkup(<LanguageProvider><DonationModal isOpen onClose={()=>{}} disaster={disaster}/></LanguageProvider>);
 assert.match(html,/Memuat daftar Posko Bantuan/);
 assert.match(html,/<button type="submit" disabled=""/);
});
