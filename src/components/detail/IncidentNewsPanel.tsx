import { newsSourceUrl } from '../../services/newsSourceUrl';
// Incident news panel: MATCHED articles by default, REVIEW_REQUIRED in a separate filter.
// Freshness + crawl-error states never block the dashboard.
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
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
}

export const IncidentNewsPanel: React.FC<Props> = ({ incidentName, matched: matchedInput, review: reviewInput, freshness, compact = false }) => {
  const matched = matchedInput.filter(a => newsSourceUrl(a.url));
  const review = reviewInput.filter(a => newsSourceUrl(a.url));
  const [showReview, setShowReview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const selected = showReview ? review : matched;
  const groups = [
    { title: 'Dokumentasi BNPB', items: selected.filter(a => a.discoveredBy === 'bnpb-documentation') },
    { title: 'Berita media', items: selected.filter(a => a.discoveredBy !== 'bnpb-documentation') },
  ].filter(group => group.items.length > 0);
  return (
    <section className="min-w-0 overflow-hidden rounded-[20px] border border-slate-200 bg-white p-3 sm:p-4" aria-label={`Berita ${incidentName}`} data-testid="incident-news">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-100 pb-3">
        <h4 className="min-w-0 break-words text-sm font-bold text-slate-900">{compact ? 'Update Berita Terkini' : `Berita ${incidentName}`}</h4>
        {compact && (showReview ? review : matched).length > 2 && (
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-blue-600 shrink-0">
            {expanded ? 'Ringkas' : `Lihat Semua (${(showReview ? review : matched).length})`}
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
      <p className="mt-2 break-words text-xs leading-relaxed text-slate-500">
        {showReview
          ? 'Kecocokan lemah — dipisahkan dari feed utama, bukan bukti kebenaran.'
          : `${incidentName} · ${matched.length} berita sesuai lokasi dan jenis bencana.`}
      </p>
      {freshness.lastSuccessAt && (
        <p className="mt-1 text-[10px] text-slate-500">Diperbarui {fmt(freshness.lastSuccessAt)}</p>
      )}
      {freshness.error && (
        <p role="status" className="mt-1 text-[10px] text-amber-700">
          {freshness.error} {matched.length > 0 ? 'Menampilkan berita yang sudah tersedia.' : ''}
        </p>
      )}
      {groups.length === 0 && (
        <p role="status" className="mt-3 text-xs leading-relaxed text-slate-500" data-testid="news-empty">
          {showReview ? 'Belum ada artikel untuk ditinjau.' : 'Belum ada berita yang relevan dengan lokasi bencana ini.'}
        </p>
      )}
      <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto overscroll-contain">
        {groups.map(group => <div key={group.title} className="min-w-0">
          <h5 className="py-1 text-xs font-bold text-slate-700">{group.title} ({group.items.length})</h5>
          <div className="space-y-2">
          {group.items.slice(0, compact && !expanded ? 2 : 15).map((item) => (
          <article key={item.url} className="min-w-0 break-words rounded-xl border border-slate-100 bg-slate-50 p-3" data-testid="news-card">
            <time className="text-[10px] text-slate-500">{item.eventDate ? `Tanggal kejadian: ${fmt(item.eventDate)}` : fmt(item.publishedAt)}</time>
            <a href={newsSourceUrl(item.url)!} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs font-semibold leading-relaxed text-slate-800 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600">
              {item.title}<ExternalLink className="inline ml-1 h-3 w-3" aria-hidden="true" />
            </a>
            {item.summary && <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.summary}</p>}
            <p className="mt-2 text-[10px] text-slate-500">
              Sumber: {item.sourceName}
              {item.incidentRelevance && item.incidentRelevance.matchedAliases.length > 0
                ? ` · cocok: ${item.incidentRelevance.matchedAliases.slice(0, 3).join(', ')}`
                : ''}
            </p>
          </article>
        ))}</div></div>)}
      </div>
    </section>
  );
};
