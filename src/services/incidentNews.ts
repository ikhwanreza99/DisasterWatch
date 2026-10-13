import { inRecentWindow } from './recentWindow';
import { NTT_CASE_ID } from '../domain/nttCase';
// Incident-specific news relevance (data-service level, not UI hiding).
// STRICT, fail-closed rules:
// - A generic disaster keyword (gempa/banjir/...) alone is NEVER sufficient.
// - Province-only matching NEVER qualifies (province names are not aliases).
// - A broad-area alias (Sumba, Bima, Lombok, ...) alone is NEVER sufficient:
//   MATCHED needs a strong (distinctive) alias plus supporting evidence, or two
//   distinct broad aliases plus supporting evidence.
// - Supporting evidence = distinctive keyword, a second distinct alias, or
//   (disaster-type word AND in-window publication date).
// - Explicit incidentId link from a trusted record decides immediately (per-incident).
// - Being returned by a location query does NOT mark an article relevant;
//   every candidate is classified and only MATCHED enters the default feed.
import { canonicalUrl } from '../domain/nttCase';
import type { IncidentArticle, RelevanceStatus } from '../domain/incidentDetail';
import { CURRENT_DESCRIPTORS, typeWordPresent, type IncidentDescriptor } from './incidentRegistry';

export interface RelevanceResult {
  status: RelevanceStatus;
  score: number;
  matchedAliases: string[];
  matchedKeywords: string[];
  reason: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inEventWindow(d: IncidentDescriptor, publishedAt: string | null): boolean | null {
  if (!d.eventDate || d.windowDays == null || !publishedAt) return null;
  const t = Date.parse(publishedAt);
  const e = Date.parse(d.eventDate);
  if (!Number.isFinite(t) || !Number.isFinite(e)) return null;
  return Math.abs(t - e) / 86400_000 <= d.windowDays;
}

export function classifyRelevance(article: IncidentArticle, d: IncidentDescriptor, now = Date.now()): RelevanceResult {
  // Incident identity takes precedence over missing dates: other cases never enter review.
  if (article.incidentId && article.incidentId !== d.incidentId) {
    return { status: 'REJECTED', score: 0, matchedAliases: [], matchedKeywords: [], reason: `Explicitly linked to another incident (${article.incidentId}).` };
  }
  const isArchivedNttSource = article.incidentId === NTT_CASE_ID && d.incidentId === NTT_CASE_ID;
  const reportingDate = article.publishedAt ?? (article.sourceType === 'OFFICIAL' ? article.eventDate : null);
  if (!isArchivedNttSource && reportingDate && !inRecentWindow(reportingDate, now)) {
    return { status: 'REJECTED', score: 0, matchedAliases: [], matchedKeywords: [], reason: 'Di luar 7 hari terakhir (WIB) atau tanggal tidak valid.' };
  }
  if (!isArchivedNttSource && !reportingDate) {
    return { status: 'REVIEW_REQUIRED', score: 0, matchedAliases: [], matchedKeywords: [], reason: 'Tanggal belum tersedia untuk membuktikan rentang 7 hari terakhir.' };
  }
  // Explicit link from a trusted record decides immediately (per-incident).
  if (article.incidentId && article.incidentId === d.incidentId) {
    return {
      status: 'MATCHED',
      score: 10,
      matchedAliases: [],
      matchedKeywords: [],
      reason: 'Explicit incident link from trusted source record.',
    };
  }
  const text = `${article.title} ${article.summary ?? ''}`;
  if (d.incidentId === 'padang' && /padang\s*(panjang|sidempuan|sidimpuan|pariaman|lawas)/i.test(text) && !/kota padang|pesisir selatan|kuranji/i.test(text)) {
    return { status: 'REJECTED', score: 0, matchedAliases: [], matchedKeywords: [], reason: 'Nama Padang merujuk lokasi lain.' };
  }
  const broad = new Set(d.broadAliases.map((a) => a.toLowerCase()));
  const matchedAliases = d.aliases.filter((a) => new RegExp(`\\b${escapeRegExp(a)}\\b`, 'i').test(text));
  const strongAliases = matchedAliases.filter((a) => !broad.has(a.toLowerCase()));
  const weakAliases = matchedAliases.filter((a) => broad.has(a.toLowerCase()));
  const distinctAliases = new Set(matchedAliases.map((a) => a.toLowerCase())).size;
  const matchedKeywords = d.keywords.filter((k) => new RegExp(escapeRegExp(k), 'i').test(text));
  const hasType = typeWordPresent(d, text);
  const windowHit = inEventWindow(d, article.publishedAt);
  if (CURRENT_DESCRIPTORS.some(c => c.incidentId === d.incidentId) && (!hasType || !article.publishedAt)) {
    return { status: 'REVIEW_REQUIRED', score: 0, matchedAliases, matchedKeywords, reason: 'Jenis bencana atau tanggal laporan belum cocok dengan kejadian terbaru.' };
  }
  // Supporting evidence beyond a bare place-name mention.
  const recentOngoing = inRecentWindow(article.publishedAt, now);
  const supported =
    matchedKeywords.length >= 1 || distinctAliases >= 2 || (hasType && (windowHit === true || recentOngoing));
  const score = matchedAliases.length * 3 + matchedKeywords.length * 1 + (hasType ? 0.5 : 0) + (windowHit === true ? 1 : windowHit === false ? -2 : 0);
  void now;

  // MATCHED: strong alias + support, or two distinct broad aliases + support.
  // A single broad alias (even with type word + date) stays out of the default feed.
  if (strongAliases.length >= 1 && supported) {
    return {
      status: 'MATCHED',
      score,
      matchedAliases,
      matchedKeywords,
      reason: `Strong location alias (${strongAliases.slice(0, 3).join(', ')}) + supporting evidence (score ${score}).`,
    };
  }
  if (distinctAliases >= 2 && weakAliases.length >= 1 && strongAliases.length === 0 && supported) {
    return {
      status: 'MATCHED',
      score,
      matchedAliases,
      matchedKeywords,
      reason: `Two distinct broad-area aliases (${matchedAliases.slice(0, 3).join(', ')}) + supporting evidence (score ${score}).`,
    };
  }
  if (strongAliases.length >= 1 || (weakAliases.length >= 1 && hasType) || (matchedKeywords.length >= 1 && (hasType || weakAliases.length >= 1))) {
    return {
      status: 'REVIEW_REQUIRED',
      score,
      matchedAliases,
      matchedKeywords,
      reason: `Weak evidence (score ${score}) — needs human review, kept out of main feed.`,
    };
  }
  return {
    status: 'REJECTED',
    score,
    matchedAliases,
    matchedKeywords,
    reason: hasType
      ? 'Only generic disaster-type word matched — insufficient evidence of incident relevance.'
      : 'No incident location, keyword, or type evidence.',
  };
}

export function classifyForIncident(
  article: IncidentArticle,
  d: IncidentDescriptor,
  now = Date.now(),
): IncidentArticle {
  const r = classifyRelevance(article, d, now);
  return {
    ...article,
    incidentRelevance: {
      incidentId: d.incidentId,
      status: r.status,
      score: r.score,
      matchedAliases: r.matchedAliases,
      matchedKeywords: r.matchedKeywords,
      reason: r.reason,
      classifiedAt: new Date(now).toISOString(),
    },
  };
}

/** Default incident feed: MATCHED only. Deduplicated by canonical URL (first wins). */
export function filterIncidentNews(articles: IncidentArticle[], incidentId: string): IncidentArticle[] {
  const seen = new Set<string>();
  const out: IncidentArticle[] = [];
  for (const a of articles) {
    if (a.incidentRelevance?.incidentId !== incidentId) continue;
    if (a.incidentRelevance.status !== 'MATCHED') continue;
    if (!(incidentId === NTT_CASE_ID && a.incidentId === NTT_CASE_ID) && !inRecentWindow(a.publishedAt ?? (a.sourceType === 'OFFICIAL' ? a.eventDate : null))) continue;
    const key = canonicalUrl(a.url) ?? a.url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out.sort((x, y) => {
    const tx = x.publishedAt ? Date.parse(x.publishedAt) : NaN;
    const ty = y.publishedAt ? Date.parse(y.publishedAt) : NaN;
    if (Number.isFinite(tx) && Number.isFinite(ty)) return ty - tx;
    if (Number.isFinite(ty)) return 1;
    if (Number.isFinite(tx)) return -1;
    return 0;
  });
}

export function reviewQueue(articles: IncidentArticle[], incidentId: string): IncidentArticle[] {
  return articles.filter(
    (a) => a.incidentRelevance?.incidentId === incidentId && a.incidentRelevance.status === 'REVIEW_REQUIRED',
  );
}
