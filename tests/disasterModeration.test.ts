import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDisasterDecisions} from '../src/services/disasterModeration.ts';
import {reviewRejection} from '../src/admin/reviewPolicy.ts';
test('rejection overrides bundled and approved markers, without mutating originals',()=>{
  const bundled={padang:{name:'Padang'},ntt:{name:'NTT'}};
  const approved={padang:{name:'Padang approved'},newPoint:{name:'New'}};
  const visible=applyDisasterDecisions(bundled,approved,['padang','ntt']);
  assert.deepEqual(Object.keys(visible),['newPoint']);
  assert.equal(bundled.padang.name,'Padang');
  assert.equal(applyDisasterDecisions(visible,approved,['padang']).padang,undefined);
});
test('rejection requires a stated reason and fact-check note, optional public evidence',()=>{
  assert.deepEqual(reviewRejection('BPBD memastikan tidak ada bencana di lokasi ini.','NO_DISASTER',[]),{note:'BPBD memastikan tidak ada bencana di lokasi ini.',reason:'NO_DISASTER',urls:[]});
  assert.throws(()=>reviewRejection('singkat','HOAX',[]));
  assert.throws(()=>reviewRejection('Catatan pemeriksaan lengkap','OTHER',[]));
  assert.throws(()=>reviewRejection('Catatan pemeriksaan lengkap','HOAX',['https://localhost/a']));
});
