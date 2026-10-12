// Incident news panel: MATCHED articles by default, REVIEW_REQUIRED in a separate filter.
// Freshness + crawl-error states never block the dashboard.
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { IncidentArticle } from '../../domain/incidentDetail';

const VERIF: Record<string, string> = {
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  AI_REVIEWED: 'bg-amber-50 text-amber-700 border-amber-200',
  UNVERIFIED: 'bg-slate-100 text-slate-600 border-slate-200',
  CONFLICTING: 'bg-rose-50 text-rose-700 border-rose-200',
};

function fmt(iso: string | null): string {
  if (!iso) return 'Waktu terbit tidak tersedia';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Waktu terbit tidak tersedia';
  return new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

interface Props {
  incidentName: string;
  matched: IncidentArticle[];
  review: IncidentArticle[];
  freshness: { lastAttemptAt: string | null; lastSuccessAt: string | null; error: string | null };
  compact?: boolean;
}

export const IncidentNewsPanel: React.FC<Props> = ({ incidentName, matched, review, freshness, compact = false }) => {
  const [showReview, setShowReview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const list = (showReview ? review : matched).slice(0, compact && !expanded ? 2 : 15);
  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 min-w-0" aria-label={`Berita ${incidentName}`} data-testid="incident-news">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h4 className="text-sm font-bold text-slate-900">{compact ? 'Update Berita Terkini' : `Berita ${incidentName}`}</h4>
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
      <p className="mt-2 text-[11px] text-slate-500">
        {showReview
          ? 'Kecocokan lemah — dipisahkan dari feed utama, bukan bukti kebenaran.'
          : `${incidentName} · ${matched.length} berita sesuai lokasi dan jenis bencana.`}
      </p>
      {freshness.lastSuccessAt && (
        <p className="mt-1 text-[10px] text-slate-500">Diperbarui {fmt(freshness.lastSuccessAt)} WIB</p>
      )}
      {freshness.error && (
        <p role="status" className="mt-1 text-[10px] text-amber-700">
          {freshness.error} {matched.length > 0 ? 'Menampilkan berita yang sudah tersedia.' : ''}
        </p>
      )}
      {list.length === 0 && (
        <p role="status" className="mt-3 text-xs text-slate-500" data-testid="news-empty">
          {showReview
            ? 'Belum ada artikel yang memerlukan review untuk insiden ini.'
            : 'Belum ada berita yang relevan dengan lokasi bencana ini.'}
        </p>
      )}
      <div className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto">
        {list.map((item) => (
          <article key={item.url} className="rounded-xl border border-slate-100 bg-slate-50 p-3" data-testid="news-card">
            <time className="text-[10px] text-slate-500">{fmt(item.publishedAt)} WIB</time>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs font-semibold leading-relaxed text-slate-800 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600">
              {item.title}<ExternalLink className="inline ml-1 h-3 w-3" aria-hidden="true" />
            </a>
            {item.summary && <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.summary}</p>}
            <p className="mt-2 text-[10px] text-slate-500">
              Sumber: {item.sourceName} · {item.sourceType} · {item.contentStatus}
              {item.incidentRelevance && item.incidentRelevance.matchedAliases.length > 0
                ? ` · cocok: ${item.incidentRelevance.matchedAliases.slice(0, 3).join(', ')}`
                : ''}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};
