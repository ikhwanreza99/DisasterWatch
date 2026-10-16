import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles, Paperclip, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import type { DisasterIncident } from '../types';
import type { AidRecord, IntelligenceReport, UserIdentity } from '../domain/intelligence';
import { canReport } from '../lib/firebase/auth';
import { getFirebaseApp } from '../lib/firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MAJOR_CITIES } from '../services/weather/cityWeather';
import { detectReportIntent } from '../services/ai/reportIntent';
import { askAssistant } from '../services/ai/disasterAssistant';
import { askNttAssistant, isNttQuestion } from '../services/ai/nttAssistant';
import type { NttCaseState } from '../services/nttCaseStore';
import { submitReportPipeline } from '../services/pipeline/reportPipeline';
import { useI18n, t } from '../i18n';
import { findIncidentMatches, resolveAssistantScope } from '../services/ai/assistantConversation';
import {
  attachmentError, buildReportText, getReportQuestions, isReportWorkflow,
  matchReportIncident, needsQuestions, reportQuestions, validateReportAnswers, type WorkflowType,
} from '../services/ai/helpdeskReport';
export { reportQuestions, needsQuestions } from '../services/ai/helpdeskReport';
export type { WorkflowType } from '../services/ai/helpdeskReport';

interface AIHelpdeskPanelProps {
  expanded?: boolean;
  onToggleExpanded?: () => void;
  disaster: DisasterIncident;
  hasContext?: boolean;
  initialMessage?: string;
  initialAttachment?: File;
  initialWorkflow?: WorkflowType;
  user?: UserIdentity;
  onRequireLogin?: () => void;
  onClose: () => void;
  onReportSubmitted?: (reportData: any) => void;
  disasters?: Record<string, DisasterIncident>;
  intelReports?: IntelligenceReport[];
  aidRecords?: AidRecord[];
  onIntelReport?: (rep: IntelligenceReport) => void;
  /** Grounded NTT case (real-data). When present + question is case-specific, it answers from case context. */
  nttCase?: NttCaseState | null;
}
interface Message { id: number; sender: 'ai' | 'user'; text: string }
const attachmentQuestion = 'Apakah Anda memiliki foto atau dokumen pendukung? Lampiran bersifat opsional dan tidak otomatis memverifikasi laporan.';
const regionOptions = ['Sumatera', 'Jawa', 'Sulawesi', 'Sulawesi & Maluku', 'Papua', 'Bali & NTT'];
const updateQuestion = (incident: DisasterIncident) => t('Apa kabar terbaru tentang {title} di {name}? Ceritakan perubahan kondisi, dampak, atau penanganan yang Anda ketahui.', { title: incident.fullTitleDisplay, name: incident.name });
export function postInformation(incidents: DisasterIncident[]): string {
  const posts = incidents.flatMap(incident => incident.route.checkpoints.map(post => ({ post, city: incident.name })));
  if (!posts.length) return t('Belum ada data posko bantuan untuk lokasi tersebut di aplikasi. Coba sebutkan kota/kabupaten lain atau perjelas nama lokasinya.');
  return t('Berikut posko bantuan yang tercatat untuk {cities}:\n\n{list}\n\nData dapat berubah. Kota/kabupaten mana lagi yang ingin Anda cari?', {
    cities: incidents.map(incident => incident.name).join(', '),
    list: posts.map(({ post, city }, index) => `${index + 1}. ${post.name || post.title || t('Posko Bantuan')}\n${t('Lokasi:')} ${post.location ? t(post.location) : post.subtitle ? t(post.subtitle) : city}\n${t('Kapasitas:')} ${post.capacity ? t('{used} / {total} orang', { used: post.capacity.used, total: post.capacity.total }) : t('Belum ada data')}${post.capacityStatus ? ` (${t(post.capacityStatus)})` : ''}${post.aid?.length ? `\n${t('Bantuan:')} ${post.aid.map(item => `${item.name} ${item.quantity}`).join(', ')}` : ''}${post.googleMapsUrl ? `\n${t('Peta:')} ${post.googleMapsUrl}` : ''}`).join('\n\n'),
  });
}
const services: { workflow: WorkflowType; label: string }[] = [
  { workflow: 'report-disaster', label: 'Laporkan Bencana' },
  { workflow: 'report-needs', label: 'Laporkan Bantuan' },
  { workflow: 'find-posts', label: 'Cari Posko Bantuan' },
  { workflow: 'learn-disaster', label: 'Pelajari Bencana' },
];

export function AIHelpdeskPanel({ expanded = false, onToggleExpanded, disaster, hasContext = true, initialMessage, initialAttachment, initialWorkflow = 'menu', user, onRequireLogin, onClose,
  onReportSubmitted, disasters, intelReports = [], aidRecords = [], onIntelReport, nttCase }: AIHelpdeskPanelProps) {
  const { t } = useI18n();
  const context = hasContext ? disaster : undefined;
  const intro = context
    ? t('Halo, saya DisasterAI. Anda sedang melihat {title} di {name}, {province}. Saya bisa membantu melaporkan bencana, melaporkan kebutuhan, atau mempelajari bencana. Konfirmasi lokasi dan jenis bencana saat membuat laporan agar informasi Anda tepat.', { title: context.fullTitleDisplay, name: context.name, province: context.province })
    : t('Halo, saya DisasterAI. Bencana apa dan di mana yang ingin Anda laporkan atau pelajari? Pilih layanan di bawah untuk memulai, lalu kita bahas bersama.');
  const firstQuestion = initialWorkflow === 'report-disaster' ? (context ? updateQuestion(context) : t(reportQuestions[0].text))
    : initialWorkflow === 'report-needs' ? t(needsQuestions[0].text)
    : initialWorkflow === 'find-posts' ? (context ? postInformation([context]) : t('Di kota/kabupaten mana Anda ingin mencari posko bantuan?'))
    : initialWorkflow === 'learn-disaster' ? (context ? t('Apa yang ingin Anda pelajari tentang {title} di {name}?', { title: context.fullTitleDisplay, name: context.name }) : t('Bencana apa dan di mana yang ingin Anda pelajari?')) : null;
  const [messages, setMessages] = useState<Message[]>([{ id: 0, sender: 'ai', text: intro }, ...(firstQuestion ? [{ id: 1, sender: 'ai' as const, text: firstQuestion }] : [])]);
  const [learningContext, setLearningContext] = useState<DisasterIncident | undefined>(context);
  const [nttConversation, setNttConversation] = useState(false);
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [serviceChosen, setServiceChosen] = useState(initialWorkflow !== 'menu');
  const [quickOptions, setQuickOptions] = useState<string[]>(initialWorkflow === 'report-disaster' && !context ? regionOptions : []);
  const [step, setStep] = useState(initialWorkflow === 'report-disaster' && context ? 2 : 0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialWorkflow === 'report-disaster' && context ? { location: `${context.name}, ${context.province}`, category: context.fullTitleDisplay } : {});
  const [stage, setStage] = useState<'questions' | 'attachment' | 'confirm' | 'done'>('questions');
  const [input, setInput] = useState('');
  const [narrative, setNarrative] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(initialAttachment && !attachmentError(initialAttachment) ? initialAttachment : null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const sequence = useRef(2);
  const sending = useRef(false);
  const pendingReport = useRef<
    | { action: 'start'; workflow: WorkflowType; text?: string }
    | { action: 'answer'; text: string }
    | { action: 'submit' }
    | null>(null);
  const locationSuggestionsActive = useRef(false);
  const add = (sender: Message['sender'], text: string) => setMessages(previous => [...previous, { id: sequence.current++, sender, text }]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  const start = (next: WorkflowType, sourceText?: string) => {
    if ((next === 'report-disaster' || next === 'report-needs') && (!user || !canReport(user))) {
      pendingReport.current = { action: 'start', workflow: next, text: sourceText };
      onRequireLogin?.();
      return;
    }
    pendingReport.current = null;
    setServiceChosen(true);
    locationSuggestionsActive.current = next === 'report-disaster' && !context;
    setQuickOptions(next === 'report-disaster' ? (context ? [] : regionOptions) : next === 'report-needs' ? Array.from(new Set([...(context?.supplies.map(item => item.name) ?? []), 'Air bersih', 'Makanan / sembako', 'Obat-obatan', 'Tempat tinggal sementara'])).slice(0, 4) : next === 'learn-disaster' ? ['Kapan bencana terjadi?', 'Berapa kerugian bencana?', 'Berikan kabar terbaru'] : []);
    if (next === 'report-disaster' && !context && navigator.geolocation) navigator.geolocation.getCurrentPosition(position => {
      if (!mounted.current || !locationSuggestionsActive.current) return;
      const { latitude, longitude } = position.coords;
      const nearest = [...MAJOR_CITIES].sort((a, b) => Math.hypot(a.lat - latitude, a.lng - longitude) - Math.hypot(b.lat - latitude, b.lng - longitude))[0];
      if (nearest && Math.hypot(nearest.lat - latitude, nearest.lng - longitude) < 1) setQuickOptions(options => Array.from(new Set([nearest.name, ...options])));
    }, () => {}, { timeout: 8000, maximumAge: 300000 });
    setWorkflow(next);
    setLearningContext(context);
    setNttConversation(false);
    setStep(next === 'report-disaster' && context ? 2 : 0);
    setAnswers(next === 'report-disaster' && context ? { location: `${context.name}, ${context.province}`, category: context.fullTitleDisplay } : {});
    setStage('questions');
    setNarrative(sourceText ?? '');
    setEditingKey(null);
    setInput('');
    add('user', sourceText ?? ({ 'report-disaster': context ? t('Saya ingin melaporkan update bencana {title} di {name}', { title: context.fullTitleDisplay, name: context.name }) : t('Saya ingin melaporkan bencana'), 'report-needs': t('Saya ingin melaporkan kebutuhan bantuan untuk bencana terkait'), 'find-posts': t('Bantu saya mencari Posko Bantuan terdekat'), 'learn-disaster': t('Saya ingin mempelajari bencana lebih lanjut'), menu: '' })[next]);
    add('ai', next === 'report-disaster' ? (context ? updateQuestion(context) : t(reportQuestions[0].text)) : next === 'report-needs' ? t(needsQuestions[0].text)
      : next === 'find-posts' ? (context ? postInformation([context]) : t('Di kota/kabupaten mana Anda ingin mencari posko bantuan?'))
      : context ? t('Mari pelajari {title} di {name}. Anda ingin tahu tentang penyebab, risiko, atau cara melindungi diri?', { title: context.fullTitleDisplay, name: context.name }) : t('Bencana apa dan di mana yang ingin Anda pelajari?'));
  };
  const questions = getReportQuestions(workflow, !!context);
  const summarize = (data: Record<string, string>, file?: File | null) => {
    add('ai', t('Berikut rangkuman {kind} Anda:\n\n{summary}\nDokumen pendukung: {document}\n\nApakah informasi ini sudah benar? Klik “Kirim Laporan”, atau pilih bagian yang ingin diperbaiki.', {
      kind: workflow === 'report-needs' ? t('kebutuhan') : t('laporan bencana'),
      summary: [narrative ? `${t('Keterangan awal')}: ${narrative}` : '', ...questions.map(q => `${t(q.label)}: ${data[q.key] || t('Belum tersedia')}`)].filter(Boolean).join('\n'),
      document: file?.name || t('Tidak ada'),
    }));
    setStage('confirm');
  };
  const finishAttachment = (file?: File | null) => {
    if (busy || stage !== 'attachment' || !isReportWorkflow(workflow)) return;
    if (file) { const error = attachmentError(file); if (error) { add('ai', t(error)); return; } }
    setAttachment(file ?? null);
    add('user', file ? t('Saya melampirkan {name}.', { name: file.name }) : t('Tidak ada dokumen pendukung.'));
    summarize(answers, file);
  };
  const submit = async () => {
    if (sending.current || stage !== 'confirm' || !isReportWorkflow(workflow)) return;
    const missing = validateReportAnswers(answers, questions);
    if (missing) { setEditingKey(missing.key); setStage('questions'); add('ai', t(missing.text)); return; }
    if (!user || !canReport(user)) { pendingReport.current = { action: 'submit' }; onRequireLogin?.(); return; }
    sending.current = true; setBusy(true);
    add('user', t('Kirim laporan.'));
    try {
      let mediaUrl: string | undefined;
      if (attachment) {
        if (user.isMock) mediaUrl = URL.createObjectURL(attachment);
        else {
          const app = getFirebaseApp();
          if (!app) throw new Error(t('Layanan unggah dokumen belum tersedia.'));
          const filePath = ref(getStorage(app), `report-attachments/${user.uid}/${crypto.randomUUID()}/${attachment.name}`);
          await uploadBytes(filePath, attachment);
          mediaUrl = await getDownloadURL(filePath);
        }
      }
      // A user-provided location must not inherit coordinates from an unrelated selected incident.
      const match = matchReportIncident(answers.location, answers.category, Object.values(disasters ?? {}));
      const rawText = buildReportText(workflow, answers, questions, narrative, attachment?.name);
      const result = await submitReportPipeline({ disasterId: match?.id, sourceType: 'citizen', sourceName: user.displayName || 'Warga', rawText,
        locationName: answers.location, categoryHint: answers.category, lat: match?.coords.lat, lng: match?.coords.lng, mediaUrl, isMock: user.isMock });
      onIntelReport?.(result.report);
      if (!onIntelReport && onReportSubmitted) onReportSubmitted({ location: answers.location, category: answers.category, urgency: answers.urgency, desc: rawText, file: attachment?.name });
      if (!mounted.current) return;
      setStage('done'); setWorkflow('menu'); setServiceChosen(false); setQuickOptions([]); setAttachment(null); setAnswers({}); setNarrative(''); setEditingKey(null);
      add('ai', t('{status} Terima kasih sudah melaporkan. {attachment}\n\nApakah ada hal lain yang ingin Anda laporkan atau pelajari?', {
        status: result.storeMode === 'mock' ? t(user.isMock ? 'Laporan tersimpan dalam sesi demo lokal.' : 'Laporan tersimpan sementara dalam sesi lokal. Penyimpanan ke server belum berhasil.') : t('Laporan berhasil disimpan untuk ditinjau.'),
        attachment: attachment ? (user.isMock ? t('Dokumen pendukung tersedia dalam sesi lokal ini.') : t('Dokumen pendukung telah dilampirkan.')) : '',
      }));
    } catch {
      if (mounted.current) add('ai', t('Laporan belum berhasil dikirim. Informasi Anda masih ada di sini. Silakan coba “Kirim Laporan” lagi.'));
    } finally { sending.current = false; if (mounted.current) setBusy(false); }
  };
  const send = async (suggestion?: string) => {
    const text = (suggestion ?? input).trim();
    if (!text || busy || sending.current) return;
    const reportIntent = detectReportIntent(text);
    if (isReportWorkflow(workflow) && (!user || !canReport(user))) {
      pendingReport.current = { action: 'answer', text };
      setInput(text);
      onRequireLogin?.();
      return;
    }
    if (reportIntent && !isReportWorkflow(workflow)) {
      start(reportIntent, text);
      return;
    }
    setInput('');
    pendingReport.current = null;
    setServiceChosen(true);
    locationSuggestionsActive.current = false;
    if ((workflow === 'report-disaster' || workflow === 'report-needs') && stage === 'attachment') {
      if (/^(tidak|nggak|enggak|ga|gak|skip|lewati|belum)/i.test(text)) finishAttachment();
      else { add('user', text); add('ai', t('Silakan lampirkan foto atau dokumen melalui ikon klip, atau pilih “Tanpa Dokumen”.')); }
      return;
    }
    add('user', text);
    setQuickOptions([]);
    if ((workflow === 'report-disaster' || workflow === 'report-needs') && stage === 'questions') {
      if ((editingKey ?? questions[step].key) === 'location' && regionOptions.includes(text)) {
        add('ai', t('Kota/kabupaten mana di {region}? Anda juga bisa mengetik desa atau alamat yang lebih spesifik.', { region: text }));
        return;
      }
      if (editingKey) {
        const corrected = { ...answers, [editingKey]: text };
        setAnswers(corrected); setEditingKey(null); summarize(corrected, attachment);
        return;
      }
      const nextAnswers = { ...answers, [questions[step].key]: text };
      setAnswers(nextAnswers);
      if (step + 1 < questions.length) { setStep(step + 1); add('ai', t(questions[step + 1].text)); }
      else { setStage('attachment'); add('ai', t(attachmentQuestion)); }
      return;
    }
    if ((workflow === 'report-disaster' || workflow === 'report-needs') && stage === 'confirm') {
      add('ai', t('Silakan pilih “Kirim Laporan” jika sudah benar, atau pilih bagian rangkuman yang ingin diperbaiki.')); return;
    }
    sending.current = true; setBusy(true);
    try {
      const available = disasters ?? (context ? { [context.id]: context } : {});
      const conversation = { history: messages, selectedDisasterId: learningContext?.id, mode: workflow === 'learn-disaster' ? 'learn' as const : 'chat' as const };
      const scope = resolveAssistantScope(text, Object.values(available), conversation);
      if (scope.incidents.length === 1) setLearningContext(scope.incidents[0]);
      if (workflow === 'find-posts') {
        // Name matching also handles a city inside a combined label, e.g. Padang.
        const matches = findIncidentMatches(text, Object.values(available));
        add('ai', postInformation(matches.length ? matches : scope.unknownLocation ? [] : scope.incidents));
      } else {
        const directScope = resolveAssistantScope(text, Object.values(available));
        const useNtt = !!nttCase && (isNttQuestion(text) || (!directScope.unknownLocation && !directScope.global && (directScope.incidents.length ? directScope.incidents.some(d => isNttQuestion(d.name)) : nttConversation || scope.incidents.some(d => isNttQuestion(d.name)))));
        setNttConversation(useNtt);
        const result = useNtt
          ? await askNttAssistant(text, nttCase, conversation)
          : await askAssistant(text, { disasters: available, reports: intelReports, aid: aidRecords }, conversation);
        if (mounted.current) add('ai', result.answer);
      }
    } catch { if (mounted.current) add('ai', t('Jawaban belum tersedia. Silakan coba lagi.')); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  };
  useEffect(() => {
    if (!user || !canReport(user) || !pendingReport.current) return;
    const pending = pendingReport.current;
    pendingReport.current = null;
    if (pending.action === 'submit') void submit();
    else if (pending.action === 'answer') void send(pending.text);
    else start(pending.workflow, pending.text);
  }, [user]);
  const draftSent = useRef(false);
  useEffect(() => {
    if (draftSent.current || (!initialMessage && !initialAttachment)) return;
    draftSent.current = true;
    if (initialAttachment) {
      const error = attachmentError(initialAttachment);
      add(error ? 'ai' : 'user', error ? t(error) : t('Lampiran: {name}', { name: initialAttachment.name }));
    }
    if (initialMessage) void send(initialMessage);
    else if (initialAttachment && !attachmentError(initialAttachment)) add('ai', t('File Anda sudah ditambahkan sebagai lampiran laporan. Ceritakan isinya; isi dokumen belum dibaca otomatis.'));
  }, [initialMessage, initialAttachment]);
  const showServices = !serviceChosen;
  return (
    <section className={`absolute z-50 flex flex-col overflow-hidden bg-slate-50 pointer-events-auto ${expanded ? 'inset-0' : 'bottom-3 right-3 w-[min(420px,calc(100%-1.5rem))] h-[min(540px,calc(100%-1.5rem))] rounded-2xl border border-slate-200 shadow-2xl'}`} id="fullHeightAIPanel" aria-label="DisasterAI Helpdesk">
      <header className="flex shrink-0 items-center justify-between gap-3 bg-slate-950 px-5 py-4 text-white">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500"><Sparkles className="h-5 w-5" aria-hidden="true" /></div><div><h3 className="text-sm font-bold">DisasterAI Helpdesk</h3><p className="text-xs text-slate-400">{t('Asisten informasi dan laporan bencana')}</p></div></div>
        <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onToggleExpanded} aria-label={expanded ? t('Kecilkan obrolan') : t('Perluas obrolan ke layar penuh')} className="hidden sm:inline-flex rounded-xl p-2 text-slate-300 hover:bg-white/10">
          {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
        <button type="button" onClick={onClose} aria-label={t('Tutup DisasterAI Helpdesk')} className="rounded-xl p-2 text-slate-300 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
      </header>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-4">
            {messages.map(message => <div key={message.id} className={`flex gap-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.sender === 'ai' && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>}
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.sender === 'user' ? 'rounded-tr-sm bg-violet-600 text-white' : 'rounded-tl-sm border border-slate-200 bg-white text-slate-700'}`}>{message.text}</div>
            </div>)}
          </div>
          {showServices && <div className="flex flex-wrap gap-2 pl-10">{services.map(service => <button key={service.workflow} type="button" disabled={busy} onClick={() => start(service.workflow)} className="rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50">{service.workflow === 'report-disaster' && context ? t('Laporkan Update Bencana') : t(service.label)}</button>)}</div>}
          {quickOptions.length > 0 && <div className="flex flex-wrap gap-2 pl-10">{quickOptions.map(option => <button key={option} type="button" disabled={busy} onClick={() => void send(option)} className="rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50">{t(option)}</button>)}</div>}
          {stage === 'attachment' && <div className="flex flex-wrap gap-2 pl-10">{attachment && <button type="button" onClick={() => finishAttachment(attachment)} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white">{t('Gunakan {name}', { name: attachment.name })}</button>}<button type="button" onClick={() => fileRef.current?.click()} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white">{t('Lampirkan Foto / Dokumen')}</button><button type="button" onClick={() => finishAttachment()} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold">{t('Tanpa Dokumen')}</button></div>}
          {stage === 'confirm' && <div className="flex flex-wrap gap-2 pl-10"><button type="button" disabled={busy} onClick={submit} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{t('Kirim Laporan')}</button>{questions.map(question => <button key={question.key} type="button" disabled={busy} onClick={() => { setEditingKey(question.key); setStage('questions'); setQuickOptions([]); add('ai', t(question.text)); }} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold disabled:opacity-50">{t('Perbaiki {field}', { field: t(question.label) })}</button>)}<button type="button" disabled={busy} onClick={() => { setStage('attachment'); add('ai', t(attachmentQuestion)); }} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold disabled:opacity-50">{t('Ubah Lampiran')}</button></div>}
          {serviceChosen && <button type="button" disabled={busy} onClick={() => { pendingReport.current = null; locationSuggestionsActive.current = false; setWorkflow('menu'); setServiceChosen(false); setStage('questions'); setQuickOptions([]); setInput(''); setEditingKey(null); add('ai', t('Silakan pilih layanan lain atau tulis pertanyaan Anda. Laporan yang belum dikonfirmasi tidak dikirim.')); }} className="self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">{t('Kembali ke layanan')}</button>}
          {busy && <p role="status" className="flex items-center gap-2 pl-10 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{t('DisasterAI sedang memproses…')}</p>}
        </div>
      </div>
      <footer className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
        <form onSubmit={event => { event.preventDefault(); void send(); }} className="mx-auto flex max-w-3xl items-center gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; const error = attachmentError(file); if (error) { add('ai', t(error)); return; } finishAttachment(file); }} />
          {stage === 'attachment' && <button type="button" onClick={() => fileRef.current?.click()} aria-label={t('Lampirkan foto atau dokumen')} className="rounded-full p-2 text-violet-600 hover:bg-violet-50"><Paperclip className="h-5 w-5" /></button>}
          <input aria-label={t('Pesan untuk DisasterAI')} value={input} onChange={event => setInput(event.target.value)} disabled={busy} placeholder={t('Tulis jawaban atau pertanyaan Anda…')} className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          <button type="submit" disabled={busy || !input.trim()} aria-label={t('Kirim pesan')} className="rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500 p-3 text-white disabled:opacity-40"><Send className="h-5 w-5" /></button>
        </form>
        <p className="mx-auto mt-1.5 flex max-w-3xl items-center gap-1.5 px-1 text-[10px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t('Berbasis data DisasterWatch · data demo/prototipe')}</p>
      </footer>
    </section>
  );
}
