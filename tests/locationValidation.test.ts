import assert from 'node:assert/strict';
import {test} from 'node:test';
import {locationValidation} from '../src/services/locationValidation.ts';
import {allCurrentRecords} from '../src/data/currentIncidents.ts';
test('Bojonegoro cannot be placed in Sulawesi and Padang cannot be placed in North Sumatra',()=>{
  assert.equal(locationValidation({province:'Jawa Timur',lat:0.88268,lng:124.46695}).status,'REJECTED');
  assert.equal(locationValidation({province:'Sumatera Barat',lat:1.5758,lng:99.6341}).status,'REJECTED');
  for(const name of ['Bojonegoro','Kota Padang'])assert.equal(locationValidation(allCurrentRecords.find(r=>r.name===name)!).status,'REGION_CHECKED');
  assert(allCurrentRecords.every(r=>locationValidation(r).status!=='REJECTED'));
});
