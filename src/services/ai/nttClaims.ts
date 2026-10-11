// NTT claim helpers — extraction is NOT verification.
// Heuristic extraction only emits claims explicitly supported by article metadata.
// Gemini reuse: summaries via existing getGeminiModel (no second client, no hardcoded keys).
import { getGeminiModel } from '../../lib/firebase/ai';
import type { CaseArticle, CaseClaim } from '../../domain/nttCase';
import { NTT_CASE_ID } from '../../domain/nttCase';

const CLAIM_TYPES = ['damage', 'casualties', 'shaking', 'tsunami_assessment', 'aftershocks', 'evacuation', 'official_update'] as const;

/** Derive topic tags from title/summary without inventing content. */
export function topicsFromText(title: string, summary: string | null): string[] {
  const t = `${title} ${summary ?? ''}`.toLowerCase();
  const out = new Set<string>();
  if (/tsunami/.test(t)) out.add('tsunami_assessment');
  if (/susulan|aftershock/.test(t)) out.add('aftershocks');
  if (/mmi|guncang|dirasakan|getaran/.test(t)) out.add('shaking');
  if (/rusak|rumah|bangunan|fasilitas|sekolah|gereja/.test(t)) out.add('damage');
  if (/luka|meninggal|tewas|korban/.test(t)) out.add('casualties');
  if (/evakuasi|mengungsi|pengungsi|keluar rumah|keluar gereja/.test(t)) out.add('evacuation');
  if (/bmkg|bnpb|bupati|parameter|update|rilis/.test(t)) out.add('official_update');
  return [...out];
}

export function claimTypes(): readonly string[] {
  return CLAIM_TYPES;
}

/**
 * Optional Gemini summary of REAL source material only.
 * Returns null when Gemini unavailable — callers keep the manual summary.
 */
export async function geminiSummarizeArticle(article: CaseArticle): Promise<string | null> {
  const source = `${article.title}\n\n${article.summary ?? ''}\n\n${article.originalSnippet ?? ''}`.slice(0, 2000);
  if (source.trim().length < 20) return null;
  try {
    const model = await getGeminiModel();
    if (!model) return null;
    const out = await model.generateContent(
      `Ringkas FAKTA dari materi sumber berikut dalam 2-3 kalimat Bahasa Indonesia. Jangan tambah angka/korban/kerusakan yang tidak tertulis. Bedakan fakta resmi vs klaim media.\n\nSUMBER (${article.sourceName}, ${article.url}):\n${source}`,
    );
    return out && out.trim().length > 10 ? out.trim().slice(0, 600) : null;
  } catch {
    return null;
  }
}

/** Group conflicting damage claims so the UI keeps them visibly separate (never summed). */
export function conflictingDamageClaims(claims: CaseClaim[]): CaseClaim[] {
  return claims.filter((c) => c.claimType === 'damage' && c.verificationStatus === 'CONFLICTING');
}

export { NTT_CASE_ID };
