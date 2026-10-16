import test from 'node:test';
import assert from 'node:assert/strict';
import {facilityCandidates,rankCandidates,placeInRegion,isAmbiguousAnchor,anchorQueries,areaWords} from '../src/services/places/evacuationCandidates.ts';
const school={id:'school-1',displayName:{text:'Sekolah A'},types:['school'],location:{latitude:-2.29,longitude:106.07}};
test('uses only real, nearby eligible facilities and preserves unknown capacity',()=>{
  const rows=facilityCandidates([school,school,{...school,id:'far',location:{latitude:-7,longitude:112}}, {...school,id:'closed',businessStatus:'CLOSED_PERMANENTLY'},{...school,id:'restaurant',types:['restaurant']}],-2.29,106.06,5000);
  assert.equal(rows.length,1);
  assert.equal(rows[0].name,'Sekolah A');
  assert.equal(rows[0].lat,school.location.latitude);
  assert.equal(rows[0].recommendation,true);
  assert.equal(rows[0].capacity,undefined);
  assert.ok(rows[0].distanceMeters!>1000 && rows[0].distanceMeters!<1200);
  assert.ok(rows[0].googleMapsUrl?.includes('query_place_id=school-1'));
});
test('Gemini cannot inject an invented facility or replace coordinates',()=>{
  const rows=facilityCandidates([school,{...school,id:'mosque',displayName:{text:'Masjid B'},types:['mosque'],location:{latitude:-2.288,longitude:106.068}}],-2.29,106.06,5000);
  const ranked=rankCandidates(rows,JSON.stringify(rows.map(p=>p.id).reverse()));
  assert.equal(ranked[0],rows[1]);
  assert.throws(()=>rankCandidates(rows,'[-1,999]'));
  assert.throws(()=>rankCandidates(rows,'[-1,-1]'));
  assert.throws(()=>rankCandidates(rows,'[]'));
});
test('shared provider coordinates collapse to one marker and the list is capped at five',()=>{
  // Reproduces Padang: eight distinct venues returned at the same coordinate.
  const stacked=Array.from({length:8},(_,i)=>({...school,id:`stack-${i}`,displayName:{text:`Venue ${i}`},location:{latitude:-0.9471496,longitude:100.4171886}}));
  // Distinct places further out (~220 m apart) must still be offered.
  const spread=Array.from({length:12},(_,i)=>({...school,id:`spread-${i}`,displayName:{text:`Fasum ${i}`},location:{latitude:-0.9471496+i*0.002,longitude:100.4171886+i*0.002}}));
  const rows=facilityCandidates([...stacked,...spread],-0.9471,100.4172,5000);
  assert.equal(rows.length,5);
  assert.equal(new Set(rows.map(r=>`${r.lat},${r.lng}`)).size,rows.length);
  assert.equal(rows.filter(r=>(r.name??'').startsWith('Venue')).length,1);
  assert.ok(rows.every((r,i,a)=>i===0||r.distanceMeters!>=a[i-1].distanceMeters!));
});
test('a cluster stacked on the reference is flagged for re-anchoring to the reported area',()=>{
  // Padang: the stored coordinate is a plus-code shared by ~20 venues, all within metres.
  const stacked=Array.from({length:8},(_,i)=>({...school,id:`stack-${i}`,location:{latitude:-0.9471496,longitude:100.4171886}}));
  assert.equal(isAmbiguousAnchor(facilityCandidates(stacked,-0.9471,100.4172,5000)),true);
  const area='Kecamatan: ( 3 Kecamatan /6 Kelurahan ) Kec. Kuranji Kel. Kuranji Kec. Koto Tangah Kel. Koto Panjang Ikua Koto';
  assert.deepEqual(areaWords(area).slice(0,3),['Kuranji','Kuranji','Koto']);
  assert.deepEqual(anchorQueries(area,'Kota Padang','Sumatera Barat'),['Kecamatan Kuranji, Kota Padang, Sumatera Barat']);
  // Real, distinct facilities are not treated as an ambiguous anchor.
  const spread=facilityCandidates([{...school,id:'near',location:{latitude:-0.9021716,longitude:100.3976638}}],-0.9471,100.4172,5000);
  assert.equal(isAmbiguousAnchor(spread),false);
  assert.deepEqual(anchorQueries('Simpang Rimba, Kabupaten Bangka Selatan','Bangka Selatan','Bangka Belitung'),['Simpang Rimba, Bangka Selatan, Bangka Belitung','Simpang, Bangka Selatan, Bangka Belitung']);
  assert.deepEqual(anchorQueries('','Kota Padang','Sumatera Barat'),[]);
});
test('nearby facilities must match the disaster regency, not only its province',()=>{
  const inCentral={...school,addressComponents:[{longText:'Kabupaten Bangka Tengah',types:['administrative_area_level_2']}]};
  assert.equal(placeInRegion(inCentral,'Bangka Selatan'),false);
  assert.equal(placeInRegion({...inCentral,addressComponents:[{longText:'Kabupaten Bangka Selatan',types:['administrative_area_level_2']}]},'Bangka Selatan'),true);
  assert.equal(placeInRegion({...school,formattedAddress:'Simpang Rimba, Kabupaten Bangka Selatan'},'Bangka Selatan'),true);
});
