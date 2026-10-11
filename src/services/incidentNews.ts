// Incident-specific news relevance (data-service level, not UI hiding).
// Scoring: alias hit +3 (strong), keyword +1, type-word +0.5 (never sufficient alone).
// Explicit incidentId link forces MATCHED for that incident only.
import { canonicalUrl } from '../domain/nttCase';
import type { IncidentArticle, RelevanceStatus } from '../domain/incidentDetail';
import { typeWordPresent, type IncidentDescriptor } from './incidentRegistry';

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

export function classifyRelevance(article: IncidentArticle, d: IncidentDescriptor, now = Date.now()): RelevanceResult {
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
  if (article.incidentId && article.incidentId !== d.incidentId) {
    return {
      status: 'REJECTED',
      score: 0,
      matchedAliases: [],
      matchedKeywords: [],
      reason: `Explicitly linked to another incident (${article.incidentId}).`,
    };
  }
  const text = `${article.title} ${article.summary ?? ''}`;
  const matchedAliases = d.aliases.filter((a) => new RegExp(`\\b${escapeRegExp(a)}\\b`, 'i').test(text));
  const matchedKeywords = d.keywords.filter((k) => new RegExp(escapeRegExp(k), 'i').test(text));
  const hasType = typeWordPresent(d, text);
  let score = matchedAliases.length * 3 + matchedKeywords.length * 1 + (hasType ? 0.5 : 0);

  // Event-date window (only when the incident has a known date and article has one).
  if (d.eventDate && d.windowDays != null && article.publishedAt) {
    const t = Date.parse(article.publishedAt);
    const e = Date.parse(d.eventDate);
    if (Number.isFinite(t) && Number.isFinite(e)) {
      const days = Math.abs(t - e) / 86400_000;
      if (days <= d.windowDays) score += 1;
      else score -= 2;
    }
  }
  void now;

  if (matchedAliases.length >= 1 && score >= 4) {
    return {
      status: 'MATCHED',
      score,
      matchedAliases,
      matchedKeywords,
      reason: `Location alias (${matchedAliases.slice(0, 3).join(', ')}) + supporting evidence (score ${score}).`,
    };
  }
  if (score >= 2) {
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
