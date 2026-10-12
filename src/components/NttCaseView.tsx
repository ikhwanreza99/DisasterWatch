import { newsSourceUrl } from '../services/newsSourceUrl';
// NTT earthquake case view — integrates into existing dashboard styling.
// Sections: A header, B map note (map itself stays in MapProvider), C overview,
// D news feed, E timeline, F claims. Plus grounded mini Q&A (reuses Gemini client).
import React, { useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, X, ShieldCheck, AlertTriangle, HelpCircle, FileText } from 'lucide-react';
import type { CaseArticle, NttVerificationStatus } from '../domain/nttCase';
import { formatUnknown } from '../domain/nttCase';
import { buildNttTimeline, countNtt, type NttCaseState } from '../services/nttCaseStore';
import { askNttAssistant } from '../services/ai/nttAssistant';

const VERIF_BADGE: Record<NttVerificationStatus, string> = {
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  AI_REVIEWED: 'bg-amber-50 text-amber-700 border-amber-200',
  UNVERIFIED: 'bg-slate-100 text-slate-600 border-slate-200',
  CONFLICTING: 'bg-rose-50 text-rose-700 border-rose-200',
};

function fmtTime(iso: string | null): string {
  if (!iso) return 'Tanggal belum tersedia';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Tanggal belum tersedia';
  return new Date(t).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  });
}

function ArticleCard({ a }: { a: CaseArticle }) {
  const sourceUrl = newsSourceUrl(a.url);
  if (!sourceUrl) return null;
  return (
    <article className="rounded-xl border border-slate-100 bg-slate-50 p-3" data-case-article={a.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold text-slate-500">{a.sourceName}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${VERIF_BADGE[a.verificationStatus]}`}>
          {a.verificationStatus}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
          {a.sourceType} · {a.contentStatus}
        </span>
      </div>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block text-xs font-semibold leading-relaxed text-slate-800 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        {a.title}
        <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden="true" />
      </a>
      {a.summary && <p className="mt-1 text-xs leading-relaxed text-slate-600">{a.summary}</p>}
      <p className="mt-2 text-[10px] text-slate-500">
        Terbit: {a.publishedAt ? fmtTime(a.publishedAt) : 'tidak tersedia'} · Diambil: {fmtTime(a.retrievedAt)}
      </p>
      {a.locationMentions.length > 0 && (
        <p className="mt-1 text-[10px] text-slate-500">Lokasi: {a.locationMentions.join(', ')}</p>
      )}
      {a.topics.length > 0 && (
        <p className="mt-0.5 text-[10px] text-slate-500">Topik: {a.topics.join(', ')}</p>
      )}
      <p className="mt-0.5 text-[10px] italic text-slate-400">{a.verificationNotes}</p>
    </article>
  );
}

interface Props {
  state: NttCaseState;
  refreshing: boolean;
  onRefresh: () => void;
  onClose: () => void;
}

export const NttCaseView: React.FC<Props> = ({ state, refreshing, onRefresh, onClose }) => {
  const counts = countNtt(state);
  const timeline = useMemo(() => buildNttTimeline(state), [state]);
  const [srcFilter, setSrcFilter] = useState<'ALL' | 'OFFICIAL' | 'NEWS_MEDIA'>('ALL');
  const [verifFilter, setVerifFilter] = useState<'ALL' | NttVerificationStatus>('ALL');
  const [topicFilter, setTopicFilter] = useState<string>('ALL');
  const [q, setQ] = useState('');
  const [qa, setQa] = useState<string | null>(null);
  const [qaBusy, setQaBusy] = useState(false);

  const topics = useMemo(() => {
    const s = new Set<string>();
    state.articles.forEach((a) => a.topics.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [state.articles]);

  const filtered = state.articles.filter(
    (a) =>
      (srcFilter === 'ALL' || a.sourceType === srcFilter) &&
      (verifFilter === 'ALL' || a.verificationStatus === verifFilter) &&
      (topicFilter === 'ALL' || a.topics.includes(topicFilter)),
  );

  const damageClaims = state.claims.filter((c) => c.claimType === 'damage');
  const casualtyClaims = state.claims.filter((c) => c.claimType === 'casualties');

  const ask = async () => {
    const text = q.trim();
    if (!text || qaBusy) return;
    setQaBusy(true);
    try {
      const r = await askNttAssistant(text, state);
      setQa(r.answer);
    } catch {
      setQa('Jawaban belum tersedia. Data kasus di atas tetap dapat diakses.');
    } finally {
      setQaBusy(false);
    }
  };

  const [initial, update] = state.kase.revisions;

  return (
    <section aria-label="Kasus Gempa NTT" className="absolute bottom-3 right-3 top-3 z-40 flex w-[min(460px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="shrink-0 bg-slate-950 px-4 py-3 text-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Kasus nyata · bukan demo</p>
            <h3 className="text-sm font-bold">Sumba Barat Daya, NTT — M6,1 (update M5,9)</h3>
            <p className="text-[11px] text-slate-300">4 Okt 2026 · 05:55:52 WIB · Tidak berpotensi tsunami (BMKG)</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup kasus NTT" className="rounded-xl p-2 text-slate-300 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          Revisi dipertahankan terpisah: awal M6,1/10 km vs update M5,9/30 km · Update data: {fmtTime(state.kase.lastCrawlAt)}
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {/* C. Intelligence overview */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <h4 className="text-xs font-bold text-slate-900">Ringkasan intelijen</h4>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl bg-white p-2"><dt className="text-slate-500">Parameter awal</dt><dd className="font-bold">M{initial?.magnitude} · {initial?.depthKm} km</dd></div>
            <div className="rounded-xl bg-white p-2"><dt className="text-slate-500">Parameter update</dt><dd className="font-bold">M{update?.magnitude} · {update?.depthKm} km</dd></div>
            <div className="rounded-xl bg-white p-2"><dt className="text-slate-500">Artikel</dt><dd className="font-bold">{counts.articles} ({counts.official} resmi)</dd></div>
            <div className="rounded-xl bg-white p-2"><dt className="text-slate-500">Klaim / konflik</dt><dd className="font-bold">{counts.claims} / {counts.conflicting} konflik</dd></div>
            <div className="rounded-xl bg-white p-2"><dt className="text-slate-500">Menunggu verifikasi</dt><dd className="font-bold">{counts.awaiting}</dd></div>
            <div className="rounded-xl bg-white p-2"><dt className="text-slate-500">Crawl terakhir</dt><dd className="font-bold">{counts.lastCrawlAt ? fmtTime(counts.lastCrawlAt) : '—'}</dd></div>
            <div className="rounded-xl bg-white p-2"><dt className="text-slate-500">Korban meninggal</dt><dd className="font-bold">{formatUnknown(null)}</dd></div>
            <div className="rounded-xl bg-white p-2"><dt className="text-slate-500">Pengungsi resmi</dt><dd className="font-bold">{formatUnknown(null)}</dd></div>
          </dl>
          <p className="mt-2 text-[10px] text-slate-500">
            Korban luka: 1 ringan (BNPB). Kerusakan: klaim konflik 20 vs 26 vs 56+13 — lihat panel klaim, jangan dijumlah.
          </p>
          <p className="mt-1 text-[10px] text-slate-500">{state.notice}</p>
        </div>

        {/* Map note (section B): marker lives in MapProvider via incident dict */}
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-[11px] text-slate-700">
          <p className="font-bold text-slate-900">Konteks peta</p>
          <p className="mt-1">
            Episenter resmi (update): 9,84 LS, 118,90 BT — marker insiden NTT tampil di peta utama bersama marker gempa BMKG.
            Klik marker untuk sumber + provenance. Tidak ada poligon dampak buatan.
          </p>
        </div>

        {/* D. News feed */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-1 text-xs font-bold text-slate-900"><FileText className="h-4 w-4" /> Feed berita ({filtered.length}/{state.articles.length})</h4>
            <button
              type="button" onClick={onRefresh} disabled={refreshing}
              className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Menyegarkan…' : 'Refresh'}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {(['ALL', 'OFFICIAL', 'NEWS_MEDIA'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setSrcFilter(v)}
                className={`rounded-full border px-2.5 py-1 font-semibold ${srcFilter === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
                {v === 'ALL' ? 'Semua' : v === 'OFFICIAL' ? 'Resmi' : 'Media'}
              </button>
            ))}
            <select aria-label="Filter verifikasi" value={verifFilter} onChange={(e) => setVerifFilter(e.target.value as typeof verifFilter)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px]">
              {['ALL', 'VERIFIED', 'AI_REVIEWED', 'UNVERIFIED', 'CONFLICTING'].map((v) => (
                <option key={v} value={v}>{v === 'ALL' ? 'Semua status' : v}</option>
              ))}
            </select>
            <select aria-label="Filter topik" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px]">
              <option value="ALL">Semua topik</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="mt-2 space-y-2">
            {filtered.map((a) => <ArticleCard key={a.id} a={a} />)}
            {filtered.length === 0 && <p className="text-xs text-slate-500">Tidak ada artikel untuk filter ini.</p>}
          </div>
        </div>

        {/* E. Timeline */}
        <div className="rounded-2xl border border-slate-200 p-3">
          <h4 className="text-xs font-bold text-slate-900">Timeline insiden</h4>
          <ol className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
            {timeline.map((e) => (
              <li key={e.id} className="text-[11px]">
                <p className="font-bold text-slate-800">
                  <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600">{e.kind}</span>
                  {e.label}
                </p>
                <p className="text-slate-500">{e.at ? fmtTime(e.at) : 'Waktu publikasi tidak tersedia'} · {e.detail}</p>
                {e.sourceUrl && (
                  <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Buka sumber
                  </a>
                )}
              </li>
            ))}
          </ol>
        </div>

        {/* F. Claims */}
        <div className="rounded-2xl border border-slate-200 p-3">
          <h4 className="flex items-center gap-1 text-xs font-bold text-slate-900"><ShieldCheck className="h-4 w-4" /> Klaim & verifikasi</h4>
          <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            Ekstraksi AI bukan verifikasi. Angka konflik dipertahankan per sumber — jangan dijumlah.
          </p>
          <h5 className="mt-2 text-[11px] font-bold text-slate-800">Kerusakan (konflik)</h5>
          <ul className="mt-1 space-y-1.5">
            {damageClaims.map((c) => (
              <li key={c.claimId} className="rounded-xl bg-slate-50 p-2 text-[11px]">
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${VERIF_BADGE[c.verificationStatus]}`}>{c.verificationStatus}</span>
                <p className="mt-1 text-slate-700">{c.claimText}</p>
                <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Sumber</a>
              </li>
            ))}
          </ul>
          <h5 className="mt-2 text-[11px] font-bold text-slate-800">Korban</h5>
          <ul className="mt-1 space-y-1.5">
            {casualtyClaims.map((c) => (
              <li key={c.claimId} className="rounded-xl bg-slate-50 p-2 text-[11px]">
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${VERIF_BADGE[c.verificationStatus]}`}>{c.verificationStatus}</span>
                <p className="mt-1 text-slate-700">{c.claimText}</p>
                <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Sumber</a>
              </li>
            ))}
            <li className="flex items-start gap-1 rounded-xl bg-slate-50 p-2 text-[11px] text-slate-600">
              <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Korban meninggal: Belum tersedia (bukan nol). Pengungsi resmi: Belum tersedia.
            </li>
          </ul>
          <details className="mt-2 text-[11px]">
            <summary className="cursor-pointer font-semibold text-slate-700">Semua klaim ({state.claims.length})</summary>
            <ul className="mt-1 space-y-1.5">
              {state.claims.map((c) => (
                <li key={c.claimId} className="rounded-xl bg-slate-50 p-2">
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${VERIF_BADGE[c.verificationStatus]}`}>{c.verificationStatus}</span>
                  <span className="ml-1 text-[10px] text-slate-500">{c.claimType} · {c.extractionStatus}</span>
                  <p className="mt-1 text-slate-700">{c.claimText}</p>
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Sumber</a>
                </li>
              ))}
            </ul>
          </details>
        </div>

        {/* Mini grounded Q&A */}
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
          <h4 className="text-xs font-bold text-slate-900">Tanya kasus NTT (grounded)</h4>
          <form onSubmit={(e) => { e.preventDefault(); void ask(); }} className="mt-2 flex gap-1.5">
            <input
              aria-label="Pertanyaan kasus NTT"
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder='Cth: "Apakah ada laporan kerusakan?"'
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-400"
            />
            <button type="submit" disabled={qaBusy || !q.trim()} className="rounded-full bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
              {qaBusy ? '…' : 'Tanya'}
            </button>
          </form>
          {qa && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{qa}</p>}
          {!qa && <p className="mt-1 text-[10px] text-slate-500">Jawaban mengutip link sumber aktual; yang tidak ada disebut "Belum tersedia".</p>}
        </div>
      </div>
    </section>
  );
};
