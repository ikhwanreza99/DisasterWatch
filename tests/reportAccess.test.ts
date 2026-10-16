import { initialAiWorkflow } from '../src/services/appEntry';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { canReport, mockUser } from '../src/lib/firebase/identity';
import { AIHelpdeskPanel } from '../src/components/AIHelpdeskPanel';
import { currentIncidents } from '../src/data/currentIncidents';
import { LanguageProvider } from '../src/i18n';
test('real anonymous sessions and existing Google sessions can report', () => {
 assert.equal(canReport({uid:'guest-1',isAnonymous:true,isMock:false}),true);
 assert.equal(canReport({uid:'google-1',isAnonymous:false,isMock:false}),true);
 assert.equal(canReport({uid:'',isAnonymous:true,isMock:false}),false);
 assert.equal(canReport(mockUser()),false);
});
test('a signed-out visitor sees the first report question without a login gate', () => {
 const html=renderToStaticMarkup(React.createElement(LanguageProvider,null,React.createElement(AIHelpdeskPanel,{
  disaster:currentIncidents.padang,hasContext:false,initialWorkflow:'report-disaster',user:mockUser(),onClose:()=>{},
 })));
 assert.match(html,/Di mana bencana terjadi/);
 assert.doesNotMatch(html,/Masuk dengan Google/);
});

test('public helpdesk and report URLs select the correct initial workflow',()=>{
 assert.equal(initialAiWorkflow('/helpdesk'),'menu');
 assert.equal(initialAiWorkflow('/lapor/'),'report-disaster');
 assert.equal(initialAiWorkflow('/'),null);
 assert.equal(initialAiWorkflow('/status'),null);
});
