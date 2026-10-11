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

export type WorkflowType = 'menu' | 'report-disaster' | 'report-needs' | 'find-posts' | 'learn-disaster';
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
interface Question { key: string; text: string }
const attachmentQuestion = 'Apakah anda memiliki foto atau dokumen pendukung. Dokumen ini akan memberikan validasi lebih pada laporan anda dan menambah akurasi kami dalam merekam data';
export const reportQuestions: Question[] = [
  { key: 'location', text: 'Di mana bencana terjadi? Sebutkan kota/kabupaten dan lokasi yang lebih spesifik, seperti desa atau alamat.' },
  { key: 'category', text: 'Jenis bencana apa yang ingin Anda laporkan?' },
  { key: 'time', text: 'Kapan bencana terjadi? Sebutkan tanggal dan perkiraan waktunya.' },
  { key: 'description', text: 'Ceritakan kondisi di lokasi dan dampak yang Anda lihat, termasuk warga yang terdampak.' },
  { key: 'urgency', text: 'Seberapa mendesak kondisinya? Apakah ada warga yang masih membutuhkan pertolongan segera?' },
];
export const needsQuestions: Question[] = [
  { key: 'items', text: 'Bantuan apa yang dibutuhkan? Sebutkan jenis, jumlah, dan satuannya jika diketahui.' },
  { key: 'location', text: 'Di mana bantuan dibutuhkan? Sebutkan kota/kabupaten serta nama posko, desa, atau alamat.' },
  { key: 'category', text: 'Kebutuhan ini terkait bencana apa?' },
  { key: 'victims', text: 'Berapa orang atau keluarga yang membutuhkan bantuan tersebut?' },
  { key: 'access', text: 'Bagaimana akses menuju lokasi dan siapa kontak yang bisa dihubungi untuk penyaluran bantuan?' },
  { key: 'urgency', text: 'Kebutuhan mana yang paling mendesak dan kapan bantuan diperlukan?' },
];
const regionOptions = ['Sumatera', 'Jawa', 'Sulawesi', 'Sulawesi & Maluku', 'Papua', 'Bali & NTT'];
const updateQuestion = (incident: DisasterIncident) => `Apa kabar terbaru tentang ${incident.fullTitleDisplay} di ${incident.name}? Ceritakan perubahan kondisi, dampak, atau penanganan yang Anda ketahui.`;
export function postInformation(incidents: DisasterIncident[]): string {
  const posts = incidents.flatMap(incident => incident.route.checkpoints.map(post => ({ post, city: incident.name })));
  if (!posts.length) return 'Belum ada data posko bantuan untuk lokasi tersebut di aplikasi. Coba sebutkan kota/kabupaten lain atau perjelas nama lokasinya.';
  return `Berikut posko bantuan yang tercatat untuk ${incidents.map(incident => incident.name).join(', ')}:\n\n${posts.map(({ post, city }, index) => `${index + 1}. ${post.name || post.title || 'Posko Bantuan'}\nLokasi: ${post.location || post.subtitle || city}\nKapasitas: ${post.capacity ? `${post.capacity.used} / ${post.capacity.total} orang` : 'Belum ada data'}${post.capacityStatus ? ` (${post.capacityStatus})` : ''}${post.aid?.length ? `\nBantuan: ${post.aid.map(item => `${item.name} ${item.quantity}`).join(', ')}` : ''}${post.googleMapsUrl ? `\nPeta: ${post.googleMapsUrl}` : ''}`).join('\n\n')}\n\nData dapat berubah. Kota/kabupaten mana lagi yang ingin Anda cari?`;
}
const services: { workflow: WorkflowType; label: string }[] = [
  { workflow: 'report-disaster', label: 'Laporkan Bencana' },
  { workflow: 'report-needs', label: 'Laporkan Bantuan' },
  { workflow: 'find-posts', label: 'Cari Posko Bantuan' },
  { workflow: 'learn-disaster', label: 'Pelajari Bencana' },
];

export function AIHelpdeskPanel({ expanded = false, onToggleExpanded, disaster, hasContext = true, initialMessage, initialAttachment, initialWorkflow = 'menu', user, onRequireLogin, onClose,
  onReportSubmitted, disasters, intelReports = [], aidRecords = [], onIntelReport, nttCase }: AIHelpdeskPanelProps) {
  const context = hasContext ? disaster : undefined;
  const intro = context
    ? `Halo, saya DisasterAI. Anda sedang melihat ${context.fullTitleDisplay} di ${context.name}, ${context.province}. Saya bisa membantu melaporkan bencana, melaporkan kebutuhan, atau mempelajari bencana. Konfirmasi lokasi dan jenis bencana saat membuat laporan agar informasi Anda tepat.`
    : 'Halo, saya DisasterAI. Bencana apa dan di mana yang ingin Anda laporkan atau pelajari? Pilih layanan di bawah untuk memulai, lalu kita bahas bersama.';
  const firstQuestion = initialWorkflow === 'report-disaster' ? (context ? updateQuestion(context) : reportQuestions[0].text)
    : initialWorkflow === 'report-needs' ? needsQuestions[0].text
    : initialWorkflow === 'find-posts' ? (context ? postInformation([context]) : 'Di kota/kabupaten mana Anda ingin mencari posko bantuan?')
    : initialWorkflow === 'learn-disaster' ? (context ? `Apa yang ingin Anda pelajari tentang ${context.fullTitleDisplay} di ${context.name}?` : 'Bencana apa dan di mana yang ingin Anda pelajari?') : null;
  const [messages, setMessages] = useState<Message[]>([{ id: 0, sender: 'ai', text: intro }, ...(firstQuestion ? [{ id: 1, sender: 'ai' as const, text: firstQuestion }] : [])]);
  const [learningContext, setLearningContext] = useState<DisasterIncident | undefined>(context);
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [serviceChosen, setServiceChosen] = useState(initialWorkflow !== 'menu');
  const [quickOptions, setQuickOptions] = useState<string[]>(initialWorkflow === 'report-disaster' && !context ? regionOptions : []);
  const [step, setStep] = useState(initialWorkflow === 'report-disaster' && context ? 2 : 0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialWorkflow === 'report-disaster' && context ? { location: `${context.name}, ${context.province}`, category: context.fullTitleDisplay } : {});
  const [stage, setStage] = useState<'questions' | 'attachment' | 'confirm' | 'done'>('questions');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(initialAttachment ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const sequence = useRef(2);
  const sending = useRef(false);
  const pendingReport = useRef<{ workflow: WorkflowType; text?: string } | null>(null);
  const locationSuggestionsActive = useRef(false);
  const add = (sender: Message['sender'], text: string) => setMessages(previous => [...previous, { id: sequence.current++, sender, text }]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  const start = (next: WorkflowType) => {
    if ((next === 'report-disaster' || next === 'report-needs') && (!user || !canReport(user))) {
      pendingReport.current = { workflow: next };
      onRequireLogin?.();
      return;
    }
    setServiceChosen(true);
    locationSuggestionsActive.current = next === 'report-disaster' && !context;
    setQuickOptions(next === 'report-disaster' ? (context ? [] : regionOptions) : next === 'report-needs' ? Array.from(new Set([...(context?.supplies.map(item => item.name) ?? []), 'Air bersih', 'Makanan / sembako', 'Obat-obatan', 'Tempat tinggal sementara'])).slice(0, 4) : next === 'learn-disaster' ? ['Kapan bencana terjadi?', 'Berapa kerugian bencana?', 'Berikan kabar terbaru'] : []);
    if (next === 'report-disaster' && !context && navigator.geolocation) navigator.geolocation.getCurrentPosition(position => {
      if (!mounted.current || !locationSuggestionsActive.current) return;
      const { latitude, longitude } = position.coords;
      const nearest = [...MAJOR_CITIES].sort((a, b) => Math.hypot(a.lat - latitude, a.lng - longitude) - Math.hypot(b.lat - latitude, b.lng - longitude))[0];
      if (nearest && Math.hypot(nearest.lat - latitude, nearest.lng - longitude) < 1) setQuickOptions(options => Array.from(new Set([nearest.name, ...options])));
    }, () => {}, { timeout: 8000, maximumAge: 300000 });
    setWorkflow(next); setLearningContext(context); setStep(next === 'report-disaster' && context ? 2 : 0); setAnswers(next === 'report-disaster' && context ? { location: `${context.name}, ${context.province}`, category: context.fullTitleDisplay } : {}); setStage('questions'); setAttachment(initialAttachment ?? null); setInput('');
    add('user', ({ 'report-disaster': context ? `Saya ingin melaporkan update bencana ${context.fullTitleDisplay} di ${context.name}` : 'Saya ingin melaporkan bencana', 'report-needs': 'Saya ingin melaporkan kebutuhan bantuan untuk bencana terkait', 'find-posts': 'Bantu saya mencari Posko Bantuan terdekat', 'learn-disaster': 'Saya ingin mempelajari bencana lebih lanjut', menu: '' })[next]);
    add('ai', next === 'report-disaster' ? (context ? updateQuestion(context) : reportQuestions[0].text) : next === 'report-needs' ? needsQuestions[0].text
      : next === 'find-posts' ? (context ? postInformation([context]) : 'Di kota/kabupaten mana Anda ingin mencari posko bantuan?')
      : context ? `Mari pelajari ${context.fullTitleDisplay} di ${context.name}. Anda ingin tahu tentang penyebab, risiko, atau cara melindungi diri?` : 'Bencana apa dan di mana yang ingin Anda pelajari?');
  };
  const questions = workflow === 'report-needs' ? needsQuestions : context ? [reportQuestions[0], reportQuestions[1], reportQuestions[3], reportQuestions[2], reportQuestions[4]] : reportQuestions;
  const summarize = (data: Record<string, string>, file?: File | null) => {
    add('ai', `Berikut rangkuman ${workflow === 'report-needs' ? 'kebutuhan' : 'laporan bencana'} Anda:\n\n${questions.map(q => `${({ location: 'Lokasi', category: 'Jenis bencana', time: 'Waktu', description: 'Kondisi dan dampak', urgency: 'Urgensi', items: 'Kebutuhan', victims: 'Penerima bantuan', access: 'Akses dan kontak' } as Record<string, string>)[q.key]}: ${data[q.key]}`).join('\n')}\nDokumen pendukung: ${file?.name || 'Tidak ada'}\n\nApakah informasi ini sudah benar? Klik “Kirim Laporan”, atau “Perbaiki Laporan” untuk mengulang.`);
    setStage('confirm');
  };
  const finishAttachment = (file?: File | null) => {
    setAttachment(file ?? null);
    add('user', file ? `Saya melampirkan ${file.name}.` : 'Tidak ada dokumen pendukung.');
    summarize(answers, file);
  };
  const submit = async () => {
    if (sending.current) return;
    if (!user || !canReport(user)) { onRequireLogin?.(); return; }
    sending.current = true; setBusy(true);
    add('user', 'Kirim laporan.');
    try {
      let mediaUrl: string | undefined;
      if (attachment) {
        if (user.isMock) mediaUrl = URL.createObjectURL(attachment);
        else {
          const app = getFirebaseApp();
          if (!app) throw new Error('Layanan unggah dokumen belum tersedia.');
          const filePath = ref(getStorage(app), `report-attachments/${user.uid}/${crypto.randomUUID()}/${attachment.name}`);
          await uploadBytes(filePath, attachment);
          mediaUrl = await getDownloadURL(filePath);
        }
      }
      // A user-provided location must not inherit coordinates from an unrelated selected incident.
      const match = Object.values(disasters ?? {}).find(d => answers.location.toLocaleLowerCase().includes(d.name.toLocaleLowerCase()));
      const rawText = `${workflow === 'report-needs' ? 'Laporan kebutuhan bantuan' : 'Laporan bencana'}\n${questions.map(q => `${q.key}: ${answers[q.key]}`).join('\n')}\nDokumen: ${attachment?.name || 'Tidak ada'}`;
      const result = await submitReportPipeline({ disasterId: match?.id, sourceType: 'citizen', sourceName: user.displayName || 'Warga', rawText,
        locationName: answers.location, lat: match?.coords.lat, lng: match?.coords.lng, mediaUrl, isMock: user.isMock });
      onIntelReport?.(result.report);
      if (!onIntelReport && onReportSubmitted) onReportSubmitted({ location: answers.location, category: answers.category, urgency: answers.urgency, desc: rawText, file: attachment?.name });
      if (!mounted.current) return;
      setStage('done');
      add('ai', `${result.storeMode === 'mock' ? 'Laporan tersimpan dalam sesi demo lokal.' : 'Laporan berhasil disimpan untuk ditinjau.'} Terima kasih sudah melaporkan. ${attachment ? (user.isMock ? 'Dokumen pendukung tersedia dalam sesi lokal ini.' : 'Dokumen pendukung telah dilampirkan.') : ''}\n\nApakah ada hal lain yang ingin Anda laporkan atau pelajari?`);
    } catch {
      if (mounted.current) add('ai', 'Laporan belum berhasil dikirim. Informasi Anda masih ada di sini. Silakan coba “Kirim Laporan” lagi.');
    } finally { sending.current = false; if (mounted.current) setBusy(false); }
  };
  const send = async (suggestion?: string) => {
    const text = (suggestion ?? input).trim();
    if (!text || busy || sending.current) return;
    const reportIntent = detectReportIntent(text);
    if ((reportIntent || workflow === 'report-disaster' || workflow === 'report-needs') && (!user || !canReport(user))) {
      pendingReport.current = { workflow: reportIntent ?? workflow, text };
      setInput(text);
      onRequireLogin?.();
      return;
    }
    if (reportIntent && workflow !== 'report-disaster' && workflow !== 'report-needs') {
      add('user', text);
      start(reportIntent);
      return;
    }
    setInput('');
    setServiceChosen(true);
    locationSuggestionsActive.current = false;
    if ((workflow === 'report-disaster' || workflow === 'report-needs') && stage === 'attachment') {
      if (/^(tidak|nggak|enggak|ga|gak|skip|lewati|belum)/i.test(text)) finishAttachment();
      else { add('user', text); add('ai', 'Silakan lampirkan foto atau dokumen melalui ikon klip, atau pilih “Tanpa Dokumen”.'); }
      return;
    }
    add('user', text);
    setQuickOptions([]);
    if ((workflow === 'report-disaster' || workflow === 'report-needs') && stage === 'questions') {
      if (questions[step].key === 'location' && regionOptions.includes(text)) {
        add('ai', `Kota/kabupaten mana di ${text}? Anda juga bisa mengetik desa atau alamat yang lebih spesifik.`);
        return;
      }
      const nextAnswers = { ...answers, [questions[step].key]: text };
      setAnswers(nextAnswers);
      if (step + 1 < questions.length) { setStep(step + 1); add('ai', questions[step + 1].text); }
      else { setStage('attachment'); add('ai', attachmentQuestion); }
      return;
    }
    if ((workflow === 'report-disaster' || workflow === 'report-needs') && stage === 'confirm') {
      add('ai', 'Silakan pilih “Kirim Laporan” jika sudah benar, atau “Perbaiki Laporan” untuk mengulang informasi.'); return;
    }
    sending.current = true; setBusy(true);
    try {
      const available = disasters ?? (context ? { [context.id]: context } : {});
      const target = Object.values(available).find(d => text.toLowerCase().includes(d.name.toLowerCase()) || text.toLowerCase().includes(d.id.toLowerCase())) ?? learningContext;
      if (workflow === 'find-posts') {
        const query = text.toLocaleLowerCase();
        const matches = Object.values(available).filter(d => query.includes(d.id.toLocaleLowerCase()) || query.includes(d.name.toLocaleLowerCase()) || d.name.toLocaleLowerCase().includes(query));
        add('ai', postInformation(matches));
      } else if (workflow === 'learn-disaster' && target) {
        setLearningContext(target);
        const guide = target.guide;
        const topic = text.toLowerCase();
        const answer = /kapan|waktu/.test(topic) ? `Waktu yang tercatat untuk insiden ini: ${target.timestamp}.` : /kerugian|biaya/.test(topic) ? `Estimasi kerugian/dampak yang tercatat: ${target.cost}. Dampak: ${target.impact}.` : /kabar|terbaru/.test(topic) ? `Berikut laporan terakhir yang tersedia di aplikasi:\n${target.reports.slice(0, 3).map(report => `${report.time}: ${report.desc}`).join('\n') || 'Belum ada laporan terbaru.'}\nInformasi ini berasal dari data aplikasi, bukan pembaruan berita langsung.` : /penyebab/.test(topic) ? guide.cause : /risiko|bahaya/.test(topic) ? guide.hazards : /evakuasi|posko/.test(topic) ? guide.evacRoute
          : /lindung|aman|mitigasi/.test(topic) ? guide.protocols.join('\n') : `${guide.cause}\n\nRisiko yang perlu diperhatikan: ${guide.hazards}`;
        add('ai', `Untuk ${target.fullTitleDisplay} di ${target.name}:\n\n${answer}\n\nBagian mana yang ingin Anda bahas lebih lanjut: risiko, perlindungan diri, atau evakuasi?`);
      } else if (workflow === 'learn-disaster' && !target) {
        const knownType = /banjir|gempa|kebakaran/i.test(text);
        if (knownType) {
          const result = await askAssistant(`Bantu pengguna mempelajari bencana melalui percakapan. Pertanyaan: ${text}. Jangan menganggap lokasi dalam data sebagai lokasi pengguna. Jika lokasi belum jelas, tanyakan kota atau kabupaten. Jelaskan hanya informasi yang didukung data dan ajak pengguna bertanya lebih lanjut.`, { disasters: available, reports: intelReports, aid: aidRecords });
          if (mounted.current) add('ai', result.answer);
        } else add('ai', 'Bencana apa yang ingin Anda pelajari, misalnya banjir, gempa, atau kebakaran? Sebutkan juga kota/kabupatennya agar saya dapat memilih konteks yang sesuai.');
      } else {
        // Case-specific NTT questions answer from persisted case data (grounded, with source links).
        const result = nttCase && isNttQuestion(text)
          ? await askNttAssistant(text, nttCase)
          : await askAssistant(text, { disasters: available, reports: intelReports, aid: aidRecords });
        if (mounted.current) add('ai', result.answer);
      }
    } catch { if (mounted.current) add('ai', 'Jawaban belum tersedia. Silakan coba lagi.'); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  };
  useEffect(() => {
    if (!user || !canReport(user) || !pendingReport.current) return;
    const pending = pendingReport.current;
    pendingReport.current = null;
    if (pending.text) add('user', pending.text);
    start(pending.workflow);
  }, [user]);
  const draftSent = useRef(false);
  useEffect(() => {
    if (draftSent.current || (!initialMessage && !initialAttachment)) return;
    draftSent.current = true;
    if (initialAttachment) add('user', `Lampiran: ${initialAttachment.name}`);
    if (initialMessage) void send(initialMessage);
    else add('ai', 'File Anda sudah ditambahkan. Apa yang ingin Anda laporkan atau pelajari dari dokumen ini?');
  }, [initialMessage, initialAttachment]);
  const showServices = !serviceChosen;
  return (
    <section className={`absolute z-50 flex flex-col overflow-hidden bg-slate-50 pointer-events-auto ${expanded ? 'inset-0' : 'bottom-3 right-3 w-[min(420px,calc(100%-1.5rem))] h-[min(540px,calc(100%-1.5rem))] rounded-2xl border border-slate-200 shadow-2xl'}`} id="fullHeightAIPanel" aria-label="DisasterAI Helpdesk">
      <header className="flex shrink-0 items-center justify-between gap-3 bg-slate-950 px-5 py-4 text-white">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500"><Sparkles className="h-5 w-5" aria-hidden="true" /></div><div><h3 className="text-sm font-bold">DisasterAI Helpdesk</h3><p className="text-xs text-slate-400">Asisten informasi dan laporan bencana</p></div></div>
        <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onToggleExpanded} aria-label={expanded ? 'Kecilkan obrolan' : 'Perluas obrolan ke layar penuh'} className="hidden sm:inline-flex rounded-xl p-2 text-slate-300 hover:bg-white/10">
          {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
        <button type="button" onClick={onClose} aria-label="Tutup DisasterAI Helpdesk" className="rounded-xl p-2 text-slate-300 hover:bg-white/10"><X className="h-5 w-5" /></button>
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
          {showServices && <div className="flex flex-wrap gap-2 pl-10">{services.map(service => <button key={service.workflow} type="button" disabled={busy} onClick={() => start(service.workflow)} className="rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50">{service.workflow === 'report-disaster' && context ? 'Laporkan Update Bencana' : service.label}</button>)}</div>}
          {quickOptions.length > 0 && <div className="flex flex-wrap gap-2 pl-10">{quickOptions.map(option => <button key={option} type="button" disabled={busy} onClick={() => void send(option)} className="rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50">{option}</button>)}</div>}
          {stage === 'attachment' && <div className="flex flex-wrap gap-2 pl-10">{attachment && <button type="button" onClick={() => finishAttachment(attachment)} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white">Gunakan {attachment.name}</button>}<button type="button" onClick={() => fileRef.current?.click()} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white">Lampirkan Foto / Dokumen</button><button type="button" onClick={() => finishAttachment()} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold">Tanpa Dokumen</button></div>}
          {stage === 'confirm' && <div className="flex flex-wrap gap-2 pl-10"><button type="button" disabled={busy} onClick={submit} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Kirim Laporan</button><button type="button" disabled={busy} onClick={() => start(workflow)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold disabled:opacity-50">Perbaiki Laporan</button></div>}
          {busy && <p role="status" className="flex items-center gap-2 pl-10 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />DisasterAI sedang memproses…</p>}
        </div>
      </div>
      <footer className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
        <form onSubmit={event => { event.preventDefault(); void send(); }} className="mx-auto flex max-w-3xl items-center gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > 5 * 1024 * 1024) { add('ai', 'Ukuran dokumen maksimal 5 MB. Pilih file yang lebih kecil.'); return; } if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) { add('ai', 'Gunakan foto JPG, PNG, WebP, atau dokumen PDF.'); return; } finishAttachment(file); }} />
          {stage === 'attachment' && <button type="button" onClick={() => fileRef.current?.click()} aria-label="Lampirkan foto atau dokumen" className="rounded-full p-2 text-violet-600 hover:bg-violet-50"><Paperclip className="h-5 w-5" /></button>}
          <input aria-label="Pesan untuk DisasterAI" value={input} onChange={event => setInput(event.target.value)} disabled={busy} placeholder="Tulis jawaban atau pertanyaan Anda…" className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Kirim pesan" className="rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500 p-3 text-white disabled:opacity-40"><Send className="h-5 w-5" /></button>
        </form>
        <p className="mx-auto mt-1.5 flex max-w-3xl items-center gap-1.5 px-1 text-[10px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Berbasis data DisasterWatch · data demo/prototipe</p>
      </footer>
    </section>
  );
}
