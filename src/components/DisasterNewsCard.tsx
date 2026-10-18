import { inRecentWindow } from '../services/recentWindow';
import { newsSourceUrl } from '../services/newsSourceUrl';
import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { NEWS_REFRESH_MS, type DisasterNewsFeed } from '../services/disasterNews';
import { useI18n, localeFor } from '../i18n';
import { newsDisplayText, newsOriginalLanguageLabel } from '../i18n/newsText';

const formatDate = (date: string) => new Date(date).toLocaleString(localeFor(), {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
});
export function DisasterNewsCard({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n();
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
  const items = (feed?.items ?? []).filter(item => newsSourceUrl(item.url) && inRecentWindow(item.publishedAt) && /^https:\/\//.test(item.url)).slice(0, 15);
  const stale = feed?.updatedAt && Date.now() - Date.parse(feed.updatedAt) > NEWS_REFRESH_MS + 6 * 3600_000;
  return <section className="rounded-[20px] border border-slate-200 bg-white p-4 min-w-0" aria-label={t('Update Berita Terkini')}>
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
      <h4 className="text-sm font-bold text-slate-900">{t('Update Berita Terkini')}</h4>
      {compact && items.length > 2 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-blue-600 shrink-0">{expanded ? t('Ringkas') : t('Lihat Semua ({count})', { count: items.length })}</button>}
    </div>
    <p className="mt-2 text-[11px] text-slate-500">{t('Bencana Indonesia · Diperbarui setiap 5 hari')}</p>
    {feed && items.length > 0 && <p className="mt-1 text-[10px] text-slate-500">{t('{count} dari maksimal 15 berita terbaru tersedia', { count: items.length })}</p>}
    {feed?.updatedAt && <p className="mt-1 text-[10px] text-slate-500">{t('Diperbarui {date}', { date: formatDate(feed.updatedAt) })}{stale ? ` · ${t('Data belum diperbarui')}` : ''}</p>}
    {failed && <p role="status" className="mt-3 text-xs text-amber-700">{t('Berita belum dapat diperbarui.')} {items.length ? t('Menampilkan data terakhir.') : t('Silakan coba lagi nanti.')}</p>}
    {!feed && !failed && <p role="status" className="mt-3 text-xs text-slate-500">{t('Memuat berita…')}</p>}
    {feed && !items.length && !failed && <p role="status" className="mt-3 text-xs text-slate-500">{t('Belum ada berita terbaru yang tersedia.')}</p>}
    <div className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto">
      {items.slice(0, compact && !expanded ? 2 : 15).map(item => {
        const titleDisplay = newsDisplayText(item.title, lang);
        const originalLabel = lang === 'en' && titleDisplay.status !== 'translated' ? newsOriginalLanguageLabel(item.title, lang) : null;
        return <article key={item.url} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <time dateTime={item.publishedAt} className="text-[10px] text-slate-500">{formatDate(item.publishedAt)}</time>
        <a href={newsSourceUrl(item.url)!} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs font-semibold leading-relaxed text-slate-800 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600">{titleDisplay.text}<ExternalLink className="inline ml-1 h-3 w-3" aria-hidden="true" /></a>
        <p className="mt-2 text-[10px] text-slate-500">{t('Sumber: {source}', { source: item.source })}{originalLabel && <span className="ml-1 font-medium text-slate-400">{originalLabel}</span>}</p>
      </article>;
      })}
    </div>
  </section>;
}
