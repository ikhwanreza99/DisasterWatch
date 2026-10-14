import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {IncidentNewsPanel} from '../src/components/detail/IncidentNewsPanel';
import type {IncidentArticle} from '../src/domain/incidentDetail';
test('Threads has its own segment and cannot appear as an ordinary news article by default',()=>{
  const social:IncidentArticle={url:'https://www.threads.com/@poster/post/abc',title:'Contoh unggahan Threads untuk pengujian',sourceName:'Threads · @poster',sourceType:'OTHER',publishedAt:'2026-10-14T00:00:00Z',retrievedAt:'2026-10-14T01:00:00Z',summary:null,contentStatus:'METADATA_ONLY',incidentId:'padang',discoveredBy:'threads:keyword-search'};
  const html=renderToStaticMarkup(<IncidentNewsPanel incidentName="Padang" matched={[social]} review={[]} freshness={{lastAttemptAt:null,lastSuccessAt:null,error:null}} compact/>);
  assert(html.includes('Sosmed · Threads (1)'));
  assert(!html.includes(social.title));
});
