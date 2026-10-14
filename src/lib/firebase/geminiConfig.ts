// Single source of truth for the Gemini models used via Firebase AI Logic.
// Production target: `gemini-3.8-flash` (Gemini 3.x Flash family).
// Override without code changes via `VITE_GEMINI_MODEL` env var.
//
// Automatic fallback: when the primary model is temporarily unavailable
// (e.g. HTTP 503 overload, verified Oct 2026 — only gemini-3.5-flash-lite
// answered 200 while 3.8/3.7/3.6/3.1-flash all returned 503), callers try
// GEMINI_FALLBACK_MODELS in order. Keep this list short and verified.

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/** Known-good fallback models, tried in order when the primary is unavailable. */
export const GEMINI_FALLBACK_MODELS: readonly string[] = ['gemini-3.5-flash-lite'];

export function resolveGeminiModel(): string {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> })?.env?.['VITE_GEMINI_MODEL'];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  } catch {
    // non-Vite context (tests) — fall through to default
  }
  return DEFAULT_GEMINI_MODEL;
}

/**
 * Ordered model candidates: primary first, then verified fallbacks.
 * Deduplicated so an explicit VITE_GEMINI_MODEL equal to a fallback
 * is only tried once. Callers must try candidates in order and use
 * the first that answers successfully.
 */
export function resolveGeminiCandidates(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [resolveGeminiModel(), ...GEMINI_FALLBACK_MODELS]) {
    const trimmed = name.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}
