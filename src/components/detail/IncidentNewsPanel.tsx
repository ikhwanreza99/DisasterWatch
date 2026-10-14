import { newsSourceUrl } from '../../services/newsSourceUrl';
// Incident news panel: MATCHED articles by default, REVIEW_REQUIRED in a separate filter.
// Freshness + crawl-error states never block the dashboard.
import React, { useState } from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import { classifyNews, newsCategoryStyles, getNewsInsight } from '../../services/newsClassification';
import type { IncidentArticle } from '../../domain/incidentDetail';

function fmt(iso: string | null): string {
  if (!iso) return 'Tanggal terbit belum tersedia';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Tanggal terbit belum tersedia';
  return new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

interface Props {
  incidentName: string;
  matched: IncidentArticle[];
  review: IncidentArticle[];
  freshness: { lastAttemptAt: string | null; lastSuccessAt: string | null; error: string | null };
  compact?: boolean;
  onExpandView?: () => void;
  onOpenAIHelpdesk?: () => void;
}

export const IncidentNewsPanel: React.FC<Props> = ({ incidentName, matched: matchedInput, review: reviewInput, freshness, compact = false, onExpandView, onOpenAIHelpdesk }) => {
  const matched = matchedInput.filter(a => a.discoveredBy!=='threads:keyword-search' && newsSourceUrl(a.url));
  const review = reviewInput.filter(a => a.discoveredBy!=='threads:keyword-search' && newsSourceUrl(a.url));
  const [showReview, setShowReview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const selected = showReview ? review : matched;
  return (
    <section className={compact ? "min-w-0 overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4" : "bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col h-[min(70vh,640px)] min-h-[360px] shrink-0 transition-all hover:shadow-md"} aria-label={`Berita ${incidentName}`} data-testid="incident-news">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          {compact ? <span className="w-2 h-2 rounded-full bg-emerald-500" /> : <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-xs shrink-0"><Newspaper className="w-4 h-4" /></div>}
          <div><h4 className="text-[14px] font-bold text-slate-900">Update Berita Terkini</h4>
          {!compact && <span className="text-[10px] text-slate-400 font-medium block">Data Laporan Warga, Portal Berita, dan Internet</span>}</div>
        </div>
        {!compact && <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200">{selected.length} Berita</span>}
        {compact && (onExpandView || selected.length > 2) && (
          <button type="button" aria-expanded={expanded} onClick={() => onExpandView ? onExpandView() : setExpanded(!expanded)} className="text-xs font-semibold text-blue-600 shrink-0">
            {expanded ? 'Ringkas' : `Lihat Semua (${selected.length})`}
          </button>
        )}
        {review.length > 0 && (
          <button
            type="button"
            onClick={() => setShowReview((v) => !v)}
            aria-pressed={showReview}
            className="text-xs font-semibold text-blue-600 shrink-0"
          >
            {showReview ? `Kembali (${matched.length})` : `Perlu review (${review.length})`}
          </button>
        )}
      </div>
      {showReview && <p className="mt-2 break-words text-xs leading-relaxed text-slate-500">Kecocokan lemah — dipisahkan dari feed utama, bukan bukti kebenaran.</p>}
      {freshness.error && (
        <p role="status" className="mt-1 text-[10px] text-amber-700">
          {freshness.error} {matched.length > 0 ? 'Menampilkan berita yang sudah tersedia.' : ''}
        </p>
      )}
      {selected.length === 0 && (
        <p role="status" className="mt-3 text-xs leading-relaxed text-slate-500" data-testid="news-empty">
          {showReview ? 'Belum ada artikel untuk ditinjau.' : 'Belum ada berita yang relevan dengan lokasi bencana ini.'}
        </p>
      )}
      <div className={compact ? "mt-3 space-y-2" : "mt-3 flex-1 min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1"}>
        {selected.slice(0, compact && !expanded ? 2 : undefined).map((item) => {
          const report = { title: item.title, desc: item.summary || item.title };
          const category = newsCategoryStyles[classifyNews(report)];
          return (
          <article key={item.url} className={compact ? "min-w-0 rounded-xl bg-slate-50 border border-slate-100 px-3 py-3" : "min-w-0 p-3 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all shrink-0"} data-testid="news-card">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                {!compact && <span className={`w-2 h-2 shrink-0 rounded-full ${category.dot}`} />}
                <span className="font-bold text-slate-900 text-xs">{incidentName}</span>
              </div>
              <time className="text-[10px] text-slate-400 font-medium shrink-0">{fmt(item.publishedAt || item.eventDate || null)}</time>
            </div>
            <p className="break-words text-xs text-slate-600 leading-snug mb-2">{item.summary ? `${item.title} — ${item.summary}` : item.title}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
              {!compact && <span className={`font-semibold px-2 py-0.5 rounded-full border ${category.badge}`}>{getNewsInsight(report)}</span>}
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {!compact && <span className="text-slate-400 font-medium">Sumber: {item.sourceName}</span>}
                <a href={newsSourceUrl(item.url)!} target="_blank" rel="noopener noreferrer" aria-label={`Buka sumber berita: ${item.sourceName}`} className={compact ? "inline-flex items-center gap-1 text-slate-500 font-medium hover:text-blue-600 hover:underline" : "inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 font-semibold text-orange-600 hover:bg-orange-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"}>
                  {compact ? `Sumber: ${item.sourceName}` : 'Buka Sumber'}<ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </div>
          </article>
        );})}
      </div>
      {!compact && onOpenAIHelpdesk && <div className="pt-3.5 mt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
        <button onClick={onOpenAIHelpdesk} className="text-[11px] text-slate-500 font-semibold hover:text-red-600 hover:underline cursor-pointer text-left">Berita tidak Valid? Laporkan</button>
        <button onClick={onOpenAIHelpdesk} className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer">Kirim Laporan Baru</button>
      </div>}
      {[...new Set(selected.map(a => a.googleSearchSuggestions).filter((s): s is string => !!s))].map((html, i) => (
        <iframe key={i} title={`Saran pencarian Google ${i + 1}`} srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" className="mt-3 w-full border-0 shrink-0" />
      ))}
    </section>
  );
};
