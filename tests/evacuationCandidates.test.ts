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
  const rows=facilityCandidates([school,{...school,id:'mosque',displayName:{text:'Masjid B'},types:['mosque']}],-2.29,106.06,5000);
  const ranked=rankCandidates(rows,JSON.stringify(rows.map(p=>p.id).reverse()));
  assert.equal(ranked[0],rows[1]);
  assert.throws(()=>rankCandidates(rows,'[-1,999]'));
  assert.throws(()=>rankCandidates(rows,'[-1,-1]'));
  assert.throws(()=>rankCandidates(rows,'[]'));
});
