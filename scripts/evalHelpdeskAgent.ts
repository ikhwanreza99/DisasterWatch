/** Manual live semantic evaluation. Synthetic conversations only; no Firestore writes. */
import { interpretHelpdeskMessage, applyAgentDecision, type AgentContext, type AgentAction } from '../src/services/ai/helpdeskAgent';
import { resolveGeminiCandidates } from '../src/lib/firebase/geminiConfig';

const key = process.env.GEMINI_API_KEY || process.env.DISASTERWATCH_GEMINI_SEARCH_KEY;
if (!key) throw new Error('A server-side Gemini key is required for live evaluation.');
const base: AgentContext = { workflow: 'report-disaster', stage: 'questions', paused: false, language: 'en', answers: {location: 'Jakarta'}, currentField: 'category', history: [{sender: 'user', text: 'I want to report a disaster.'}, {sender: 'ai', text: 'Where did it happen?'}, {sender: 'user', text: 'Jakarta'}, {sender: 'ai', text: 'What type of disaster would you like to report?'}], incidents: [], hasAttachment: false };
const cases: Array<{name: string; message: string; actions: AgentAction[]; context?: Partial<AgentContext>; fields?: Record<string, string>; unchanged?: boolean; topic?: string}> = [
  {name:'routing today English', message:'is there any disaster today?', actions:['answer'], topic:'general', context:{workflow:'menu',answers:{},history:[],currentField:undefined}},
  {name:'routing Padang after cancel', message:'saya ingin tau detail bencana banjir di padang', actions:['answer'], topic:'general', context:{workflow:'menu',answers:{},currentField:undefined,history:[{sender:'ai',text:'Laporan dibatalkan. Silakan pilih layanan lain.'}],incidents:[{id:'padang',name:'Kota Padang',category:'flood'}]}},
  {name:'routing leave aid posts', message:'What disasters happened today?', actions:['answer'], topic:'general', context:{workflow:'find-posts',answers:{},currentField:undefined,history:[{sender:'ai',text:'There is no aid post data for that location.'}]}},
  {name:'routing actual aid posts', message:'Where can I find an aid post or shelter in Padang?', actions:['answer'], topic:'aid_posts', context:{workflow:'menu',answers:{},currentField:undefined,history:[],incidents:[{id:'padang',name:'Kota Padang',category:'flood'}]}},
  {name: 'withdraw paraphrase', message: 'On second thought, I would rather leave this unfiled.', actions: ['cancel_report']},
  {name: 'Indonesian withdrawal', message: 'Kayaknya urungkan dulu deh, saya nggak mau bikin laporan lagi.', actions: ['cancel_report']},
  {name: 'question interrupts pending type', message: 'Before we continue, what exactly qualifies as a disaster?', actions: ['answer']},
  {name: 'negative factual response', message: 'Nobody needs immediate help; everyone has reached shelter.', actions: ['update_report'], context: {currentField: 'urgency', answers: {location: 'Jakarta', category: 'Flood', time: 'This morning', description: 'Two houses affected'}, history: [{sender: 'ai', text: 'How urgent is the situation? Is anyone in need of immediate help?'}]}, fields: {urgency: ''}},
  {name: 'correction rather than new type', message: 'I got the location wrong, it was Bekasi rather than Jakarta.', actions: ['update_report'], fields: {location: 'Bekasi'}},
  {name: 'multiple facts in one response', message: 'A flood this morning; two houses have water inside.', actions: ['update_report'], fields: {category: '', time: '', description: ''}},
  {name: 'pause without discarding', message: 'Hold onto what I told you. Can we pick this up after lunch?', actions: ['pause_report']},
  {name: 'resume contextual reference', message: 'All right, back to where we left off.', actions: ['resume_report'], context: {paused: true}},
  {name: 'inquiry about reporting is not a report', message: 'How would I report a damaged road?', actions: ['answer'], context: {workflow: 'menu', answers: {}, history: [], currentField: undefined}},
  {name: 'new multi-field needs report', message: 'We need to report an aid shortage: 40 families in Bekasi need drinking water urgently.', actions: ['update_report'], context: {workflow: 'menu', answers: {}, history: [], currentField: undefined}, fields: {location: 'Bekasi', items: '', victims: '', urgency: ''}},
  {name: 'decline attachment without cancellation', message: 'I have nothing to attach, just go ahead with the details I gave you.', actions: ['skip_attachment', 'review_report'], context: {stage: 'attachment', currentField: undefined, answers: {location:'Jakarta',category:'Flood',time:'This morning',description:'Two houses affected',urgency:'No immediate help needed'}}, unchanged: true},
  {name: 'complete report with negative urgency', message: 'I would like to report a flood in Jakarta this morning. Water entered two houses. Everyone is safe and nobody needs immediate rescue.', actions: ['update_report'], context: {workflow: 'menu', answers: {}, history: [], currentField: undefined}, fields: {location:'Jakarta', category:'', time:'', description:'', urgency:''}},
  {name: 'negation of cancellation', message: 'Please keep my report, I am not asking you to cancel it.', actions: ['clarify', 'resume_report', 'update_report', 'pause_report'], unchanged: true},
];
let passed = 0;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let selectedModel: string | undefined;
let lastOutput = "";
async function generate(prompt: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let limited = false;
  for (const model of [...new Set([...(selectedModel ? [selectedModel] : []), ...resolveGeminiCandidates()])]) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': key!}, signal: AbortSignal.timeout(25000), body: JSON.stringify({contents: [{parts: [{text: prompt}]}], generationConfig: {maxOutputTokens: 2048, temperature: 0}}) });
    if (!response.ok) { if (response.status === 429) limited = true; console.log(`Provider status ${response.status} for ${model}`); continue; }
    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((part: {text?: string}) => part.text ?? '').join('');
    if (text) { selectedModel = model; lastOutput = text; return text; }
  }
    if (!limited || attempt === 1) break;
    await delay(60000);
  }
  throw new Error('No configured model available');
}
for (const item of cases.filter(item => !process.env.AGENT_EVAL_CASE || item.name.includes(process.env.AGENT_EVAL_CASE))) {
  // Manual live evaluations are paced to respect per-model provider quotas.
  await delay(16000);
  lastOutput = ''; 
  const context = {...base, ...item.context};
  const result = await interpretHelpdeskMessage(item.message, context, generate);
  let ok = result.available && item.actions.includes(result.decision.action);
  if (ok && result.available && item.topic) ok = result.decision.topic === item.topic;
  if (ok && result.available && item.fields) {
    const next = applyAgentDecision(context, result.decision);
    for (const [field, expected] of Object.entries(item.fields)) {
      const value = next.answers[field] ?? '';
      if (!value || (expected && !value.toLowerCase().includes(expected.toLowerCase()))) ok = false;
    }
  }
  if (!ok && lastOutput && process.env.AGENT_EVAL_DEBUG === 'true') console.log('Synthetic decision output:', lastOutput.slice(0, 2500));
  if (ok && result.available && item.unchanged) ok = JSON.stringify(applyAgentDecision(context, result.decision).answers) === JSON.stringify(context.answers);
  if (ok) passed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${item.name}: ${result.available ? result.decision.action : 'unavailable/invalid'}`);
}
console.log(`Live semantic evaluation: ${passed}/${cases.filter(item => !process.env.AGENT_EVAL_CASE || item.name.includes(process.env.AGENT_EVAL_CASE)).length} passed`);
process.exitCode = passed === cases.filter(item => !process.env.AGENT_EVAL_CASE || item.name.includes(process.env.AGENT_EVAL_CASE)).length ? 0 : 1;
