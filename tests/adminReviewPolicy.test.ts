import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isFinalReviewStatus, reviewEvidence} from '../src/admin/reviewPolicy.ts';
test('final review decisions cannot be changed',()=>{
  for(const status of ['VERIFIED','REJECTED','APPROVED'])assert.equal(isFinalReviewStatus(status),true);
  for(const status of ['UNVERIFIED','AI_REVIEWED','CONFLICTING','PENDING'])assert.equal(isFinalReviewStatus(status),false);
});
test('approval requires a fact-check note and 1–3 public HTTPS sources',()=>{
  assert.deepEqual(reviewEvidence('Lokasi dan tanggal cocok dengan BNPB.', ['https://bnpb.go.id/berita/banjir#foto']),{note:'Lokasi dan tanggal cocok dengan BNPB.',urls:['https://bnpb.go.id/berita/banjir']});
  for(const [note,urls] of [['',[]],['Catatan fact-check lengkap',[]],['Catatan fact-check lengkap',['http://example.org']],['Catatan fact-check lengkap',['https://localhost/x']],['Catatan fact-check lengkap',Array(4).fill('https://example.org')]] as Array<[string,string[]]>)assert.throws(()=>reviewEvidence(note,urls));
});
