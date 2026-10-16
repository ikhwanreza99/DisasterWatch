import test from 'node:test';
import assert from 'node:assert/strict';
import {facilityCandidates,rankCandidates} from '../src/services/places/evacuationCandidates.ts';
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
test('nearby facilities must match the disaster regency, not only its province',async()=>{
  const {placeInRegion}=await import('../src/services/places/evacuationCandidates.ts');
  const inCentral={...school,addressComponents:[{longText:'Kabupaten Bangka Tengah',types:['administrative_area_level_2']}]};
  assert.equal(placeInRegion(inCentral,'Bangka Selatan'),false);
  assert.equal(placeInRegion({...inCentral,addressComponents:[{longText:'Kabupaten Bangka Selatan',types:['administrative_area_level_2']}]},'Bangka Selatan'),true);
  assert.equal(placeInRegion({...school,formattedAddress:'Simpang Rimba, Kabupaten Bangka Selatan'},'Bangka Selatan'),true);
});
