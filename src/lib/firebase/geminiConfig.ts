// Single source of truth for the Gemini model used via Firebase AI Logic.
// Production target: `gemini-3.8-flash` (Gemini 3.x Flash family).
// Override without code changes via `VITE_GEMINI_MODEL` env var.

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export function resolveGeminiModel(): string {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> })?.env?.['VITE_GEMINI_MODEL'];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  } catch {
    // non-Vite context (tests) — fall through to default
  }
  return DEFAULT_GEMINI_MODEL;
}
