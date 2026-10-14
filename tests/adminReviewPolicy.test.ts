import assert from 'node:assert/strict';
import {test} from 'node:test';
import {reviewEvidence} from '../src/admin/reviewPolicy.ts';
test('approval requires a fact-check note and 1–5 public HTTPS sources',()=>{
  assert.deepEqual(reviewEvidence('Lokasi dan tanggal cocok dengan BNPB.', ['https://bnpb.go.id/berita/banjir#foto']),{note:'Lokasi dan tanggal cocok dengan BNPB.',urls:['https://bnpb.go.id/berita/banjir']});
  for(const [note,urls] of [['',[]],['Catatan fact-check lengkap',[]],['Catatan fact-check lengkap',['http://example.org']],['Catatan fact-check lengkap',['https://localhost/x']],['Catatan fact-check lengkap',Array(6).fill('https://example.org')]] as Array<[string,string[]]>)assert.throws(()=>reviewEvidence(note,urls));
});
