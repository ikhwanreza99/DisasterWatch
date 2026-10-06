import type { CitizenReport, NewsCategory } from '../types';

export const newsCategoryStyles = {
  positive: { label: 'Berita Positif', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  negative: { label: 'Berita Negatif', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' },
  needs: { label: 'Berita Kebutuhan', dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
} satisfies Record<NewsCategory, { label: string; dot: string; badge: string }>;

/** Explicit editorial classification takes precedence over the legacy text fallback.
 * Unmet needs take priority when one update contains several kinds of news.
 * Verification status is deliberately excluded: it does not describe news sentiment.
 */
export function classifyNews(report: Pick<CitizenReport, 'newsCategory' | 'title' | 'desc'>): NewsCategory {
  if (report.newsCategory && report.newsCategory in newsCategoryStyles) return report.newsCategory;
  const text = `${report.title ?? ''} ${report.desc}`.toLowerCase();
  if (/\b(butuh|membutuhkan|dibutuhkan|kekurangan|kehabisan)\b|belum (?:terpenuhi|tersedia|menerima)|kebutuhan mendesak/.test(text)) return 'needs';
  if (/korban jiwa|meninggal|orang hilang|kerugian|\b(rusak|terputus|tertutup|terhalang|runtuh|terganggu)\b/.test(text)) return 'negative';
  if (/\b(pemulihan|pulih|diterima|dikirim|pengiriman|disalurkan|dibagikan|didirikan|aman|perbaikan|penanganan)\b/.test(text)) return 'positive';
  return 'negative';
}

/** Only allow navigable web sources, including for data loaded from external stores. */
export function getNewsSource(report: Pick<CitizenReport, 'sourceUrl' | 'sourceName' | 'sourceType'>): { url: string; name: string } | null {
  if (!report.sourceUrl) return null;
  // Older portal records only carry a URL; explicitly direct reports never get a link.
  if (report.sourceType && !['media', 'internet', 'social'].includes(report.sourceType)) return null;
  try {
    const url = new URL(report.sourceUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return { url: url.href, name: report.sourceName?.trim() || url.hostname };
  } catch {
    return null;
  }
}

/** Short editorial insights can be supplied by a source; legacy updates use content cues. */
export function getNewsInsight(report: Pick<CitizenReport, 'newsInsight' | 'newsCategory' | 'title' | 'desc'>): string {
  const editorial = report.newsInsight?.trim();
  if (editorial && editorial.split(/\s+/).length >= 2 && editorial.split(/\s+/).length <= 3) return editorial;
  const text = `${report.title ?? ''} ${report.desc}`.toLowerCase();
  const category = classifyNews(report);
  if (category === 'needs') {
    if (/masker/.test(text)) return 'Butuh Masker Tambahan';
    if (/air|tangki/.test(text)) return 'Butuh Air Bersih';
    if (/obat|medis/.test(text)) return 'Butuh Bantuan Medis';
    if (/makanan|pangan|sembako/.test(text)) return 'Butuh Pasokan Pangan';
    return 'Kebutuhan Belum Terpenuhi';
  }
  if (category === 'negative') {
    if (/korban jiwa|meninggal/.test(text)) return 'Korban Jiwa Tercatat';
    if (/orang hilang/.test(text)) return 'Warga Masih Hilang';
    if (/visibilitas|jarak pandang|kabut asap/.test(text)) return 'Visibilitas Terganggu';
    if (/akses|jalan|jembatan/.test(text)) return 'Akses Jalan Terganggu';
    if (/kerugian/.test(text)) return 'Kerugian Bencana Tercatat';
    return 'Dampak Bencana Dilaporkan';
  }
  if (/diterima/.test(text)) return 'Bantuan Telah Diterima';
  if (/disalurkan|dibagikan|distribusi/.test(text)) return 'Bantuan Tersalurkan';
  if (/dikirim|pengiriman/.test(text)) return 'Bantuan Dalam Pengiriman';
  if (/tenda|pengungsian/.test(text)) return 'Pengungsian Telah Disiapkan';
  if (/perbaikan|tiang pancang/.test(text)) return 'Perbaikan Infrastruktur Berlangsung';
  if (/aman|inspeksi/.test(text)) return 'Infrastruktur Aman Digunakan';
  return 'Pemulihan Sedang Berlangsung';
}
