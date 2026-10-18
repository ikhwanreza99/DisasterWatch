// Shared presentation layer for news content (article headlines & summaries).
//
// News records are stored and displayed in their original source language
// (Indonesian for the current crawl pipeline). UI labels go through `t()`,
// but source content must never be rewritten — this module resolves the
// DISPLAY text at render time:
//
//   - ID mode: always the original text (status 'original').
//   - EN mode: a verified English translation when one exists — either a
//     curated dictionary entry (the app's supported translation mechanism)
//     or a validated result from the optional async provider seam.
//   - No verified translation: the original text is preserved and the card
//     is explicitly flagged as untranslated — never silently passed off as
//     translated.
//
// An external translation provider is NOT configured by default. The seam
// exists so an approved provider can be wired in later without touching the
// news components; until then English display relies on the curated
// dictionary and degrades safely.

import { getLang, hasEnglish, translateFor, type Lang } from './index';
import type { IncidentArticleTranslation } from '../domain/incidentDetail';

export type NewsTextStatus = 'translated' | 'original' | 'pending' | 'failed';

export interface NewsDisplayText {
  text: string;
  status: NewsTextStatus;
}

/** Optional async translation provider (future approved service). */
export type NewsTranslationProvider = (text: string) => Promise<string>;

let translationProvider: NewsTranslationProvider | null = null;

/**
 * Persisted/validated translation cache: `${lang}::${text}` → translation.
 * Shared by the dictionary path and the provider path so the same headline
 * is never translated twice per session.
 */
const translationCache = new Map<string, string>();

export function setNewsTranslationProvider(provider: NewsTranslationProvider | null): void {
  translationProvider = provider;
  translationCache.clear();
}

export function newsTranslationProviderConfigured(): boolean {
  return translationProvider !== null;
}

/**
 * Synchronous resolution: validated cache first, then the curated English
 * dictionary. Conservative by construction — an entry only counts when the
 * exact source string is a dictionary key AND the English value is non-empty
 * and actually different from the source.
 */
export function newsDisplayText(text: string, lang: Lang = getLang(), persisted?: IncidentArticleTranslation, sourceTitle?: string, sourceSummary?: string | null, field?: 'title' | 'summary'): NewsDisplayText {
  const trimmed = text.trim();
  if (!trimmed) return { text, status: 'original' };
  if (lang === 'en' && persisted?.language === 'en') {
    const translated = field === 'title'
      ? (persisted.titleStatus === 'translated' && persisted.sourceTitle === sourceTitle ? persisted.title : null)
      : (persisted.summaryStatus === 'translated' && persisted.sourceSummary === sourceSummary ? persisted.summary : null);
    if (translated?.trim()) return { text: translated.trim(), status: 'translated' };
  }
  const cacheKey = `${lang}::${trimmed}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return { text: cached, status: 'translated' };
  if (lang === 'en' && hasEnglish(trimmed)) {
    const translated = translateFor('en', trimmed).trim();
    if (translated && translated !== trimmed) {
      translationCache.set(cacheKey, translated);
      return { text: translated, status: 'translated' };
    }
  }
  return { text, status: 'original' };
}

/**
 * Async resolution used when a translation provider is configured. Falls
 * back to the synchronous result when no provider exists, and validates
 * every provider response (non-empty and different from the source) before
 * marking it 'translated'. Failures return 'failed' with the ORIGINAL text —
 * the caller must keep showing the original and may flag the card.
 */
export async function requestNewsTranslation(text: string, lang: Lang = getLang()): Promise<NewsDisplayText> {
  const sync = newsDisplayText(text, lang);
  if (sync.status === 'translated' || lang !== 'en' || !translationProvider) return sync;
  const provider = translationProvider;
  const trimmed = text.trim();
  const cacheKey = `${lang}::${trimmed}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return { text: cached, status: 'translated' };
  try {
    const translated = (await provider(trimmed)).trim();
    if (translated && translated !== trimmed) {
      translationCache.set(cacheKey, translated);
      return { text: translated, status: 'translated' };
    }
    return { text, status: 'failed' };
  } catch {
    return { text, status: 'failed' };
  }
}

/**
 * Conservative source-language cue for the untranslated-content badge.
 * Matches common Indonesian function words only; English sources never
 * match, so an English headline is never mislabeled as Indonesian.
 * Used solely to LABEL original text — never to rewrite it.
 */
const INDONESIAN_MARKERS =
  /\b(yang|di|ke|dari|dan|atau|untuk|dengan|pada|ini|itu|telah|sedang|juga|akan|oleh|karena|agar|namun|lalu|serta|bagi|sampai|tersebut|mengalami|terdampak|menyebabkan|dilaporkan|warga|korban|gempa|banjir|longsor|erupsi|terjadi|akibat|hingga|sejumlah|puluhan|ratusan)\b/i;

export function looksIndonesian(text: string): boolean {
  return INDONESIAN_MARKERS.test(text);
}

const ENGLISH_MARKERS = /\b(the|and|for|with|after|during|in|on|at|to|from|as|officials|residents|floods?|earthquake|landslide|eruption|volcano|evacuated|damaged|kills?|injured|strikes?|hits?|warns?|reports?|says?|aid|reaches|families|homes|roads|province|district)\b/i;
export function looksEnglish(text: string): boolean { return ENGLISH_MARKERS.test(text) && !looksIndonesian(text); }

/**
 * Label shown on untranslated cards in English mode. Null when the text
 * does not look Indonesian, so the badge never lies about the source.
 */
export function newsOriginalLanguageLabel(text: string, lang: Lang = getLang()): string | null {
  if (lang !== 'en' || !looksIndonesian(text)) return null;
  return 'Bahasa Indonesia';
}
