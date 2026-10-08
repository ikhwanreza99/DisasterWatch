import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { DisasterNewsFeed } from '../services/disasterNews';

const formatDate = (date: string) => new Date(date).toLocaleString('id-ID', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
});
export function DisasterNewsCard({ compact = false }: { compact?: boolean }) {
  const [feed, setFeed] = useState<DisasterNewsFeed | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch('/data/disaster-news.json', { cache: 'no-cache', signal: controller.signal });
        if (!response.ok) throw new Error('unavailable');
        const value = await response.json() as DisasterNewsFeed;
        if (!Array.isArray(value.items) || (value.updatedAt !== null && !Number.isFinite(Date.parse(value.updatedAt)))) throw new Error('invalid');
        setFeed(value); setFailed(false);
      } catch { if (!controller.signal.aborted) setFailed(true); }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 5 * 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  const items = (feed?.items ?? []).filter(item => Number.isFinite(Date.parse(item.publishedAt)) && Date.now() - Date.parse(item.publishedAt) <= 7 * 86400_000 && /^https:\/\//.test(item.url)).slice(0, 15);
  const stale = feed?.updatedAt && Date.now() - Date.parse(feed.updatedAt) > 4 * 3600_000;
  return <section className="rounded-[20px] border border-slate-200 bg-white p-4 min-w-0" aria-label="Update Berita Terkini">
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
      <h4 className="text-sm font-bold text-slate-900">Update Berita Terkini</h4>
      {compact && items.length > 2 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-blue-600 shrink-0">{expanded ? 'Ringkas' : `Lihat Semua (${items.length})`}</button>}
    </div>
    <p className="mt-2 text-[11px] text-slate-500">Bencana Indonesia · Google News via Zapi · Pembaruan 2 jam</p>
    {feed?.updatedAt && <p className="mt-1 text-[10px] text-slate-500">Diperbarui {formatDate(feed.updatedAt)} WIB{stale ? ' · Data belum diperbarui' : ''}</p>}
    {failed && <p role="status" className="mt-3 text-xs text-amber-700">Berita belum dapat diperbarui. {items.length ? 'Menampilkan data terakhir.' : 'Silakan coba lagi nanti.'}</p>}
    {!feed && !failed && <p role="status" className="mt-3 text-xs text-slate-500">Memuat berita…</p>}
    {feed && !items.length && !failed && <p role="status" className="mt-3 text-xs text-slate-500">Belum ada berita terbaru yang tersedia.</p>}
    <div className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto">
      {items.slice(0, compact && !expanded ? 2 : 15).map(item => <article key={item.url} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <time dateTime={item.publishedAt} className="text-[10px] text-slate-500">{formatDate(item.publishedAt)} WIB</time>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs font-semibold leading-relaxed text-slate-800 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600">{item.title}<ExternalLink className="inline ml-1 h-3 w-3" aria-hidden="true" /></a>
        <p className="mt-2 text-[10px] text-slate-500">Sumber: {item.source}</p>
      </article>)}
    </div>
  </section>;
}
