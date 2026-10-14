import { recordTokenUsage } from '../../admin/tokenUsage';
// Firebase AI Logic (Gemini) accessor with safe fallback.
// Transport order: Firebase AI Logic first, direct Gemini Developer API key second,
// local heuristic last. Never throws when unconfigured — callers must handle `available === false`.
// Model name lives ONLY in ./geminiConfig.ts (single source of truth).
// The direct key is read ONLY from VITE_GEMINI_API_KEY (local .env, never committed,
// never hardcoded). No additional SDK is used — direct transport is plain fetch.
import { isFirebaseConfigured } from './config';
import { resolveGeminiModel } from './geminiConfig';

export interface AIBackendStatus {
  available: boolean;
  reason: string;
  mode: 'firebase-ai' | 'heuristic-fallback';
  /** Resolved Gemini model name (from geminiConfig.ts / VITE_GEMINI_MODEL). */
  model: string;
}

export function aiBackendStatus(): AIBackendStatus {
  if (!isFirebaseConfigured()) {
    return {
      available: false,
      reason: 'Firebase env not configured — using local heuristic extraction.',
      mode: 'heuristic-fallback',
      model: resolveGeminiModel(),
    };
  }
  return {
    available: true,
    reason: `Firebase AI Logic (Gemini ${resolveGeminiModel()}) via Firebase project.`,
    mode: 'firebase-ai',
    model: resolveGeminiModel(),
  };
}

/**
 * Lazily create a Gemini generative model via Firebase AI Logic.
 * Dynamic import keeps the bundle light and avoids crashing in mock mode.
 * Returns null when unavailable.
 */
export async function getGeminiModel(): Promise<{ generateContent: (prompt: string) => Promise<string> } | null> {
  const viaAILogic = await tryAILogicModel();
  if (viaAILogic) return viaAILogic;
  // Approved fallback (Phase 18): direct Gemini Developer API when AI Logic is
  // blocked (e.g. App Check enforcement). Same interface, same model, same callers.
  const viaDirect = await tryDirectModel();
  if (viaDirect) return viaDirect;
  return null;
}

function readEnvKey(key: string): string {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> })?.env?.[key];
    return typeof v === 'string' ? v.trim() : '';
  } catch {
    return '';
  }
}

async function tryAILogicModel(): Promise<{ generateContent: (prompt: string) => Promise<string> } | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const { getFirebaseApp } = await import('./config');
    const app = getFirebaseApp();
    if (!app) return null;
    // firebase/ai is the current Firebase AI Logic entrypoint (renamed from @firebase/vertexai).
    const aiModule = await import('firebase/ai');
    const { getAI, getGenerativeModel, GoogleAIBackend } = aiModule as unknown as Record<string, (...a: never[]) => never>;
    const ai = (getAI as unknown as (app: unknown, opts?: unknown) => unknown)(app, {
      backend: new (GoogleAIBackend as unknown as new () => unknown)(),
    });
    const model = (getGenerativeModel as unknown as (ai: unknown, opts: unknown) => {
      generateContent: (p: string | unknown) => Promise<{ response: { text: () => string; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } } }>;
    })(ai, { model: resolveGeminiModel() });
    return {
      generateContent: async (prompt: string) => {
        const res = await model.generateContent(prompt);
        recordTokenUsage(res.response.usageMetadata, resolveGeminiModel(), 'Firebase AI Logic');
        return res.response.text();
      },
    };
  } catch {
    return null;
  }
}

/**
 * Direct Gemini Developer API transport (plain fetch, no extra SDK).
 * Key comes ONLY from VITE_GEMINI_API_KEY env — never hardcoded, never logged.
 * Response parsing tolerates the standard candidates[0].content.parts shape.
 */
async function tryDirectModel(): Promise<{ generateContent: (prompt: string) => Promise<string> } | null> {
  const key = readEnvKey('VITE_GEMINI_API_KEY');
  if (!key) return null;
  const model = resolveGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  return {
    generateContent: async (prompt: string) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt.slice(0, 8000) }] }] }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Gemini Direct ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ''}`);
      }
      const data = (await res.json()) as {
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        error?: { message?: string };
      };
      if (data?.error?.message) throw new Error(`Gemini Direct error: ${data.error.message.slice(0, 200)}`);
      const text = (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
        .join('');
      if (!text.trim()) throw new Error('Gemini Direct returned empty text.');
      recordTokenUsage(data.usageMetadata, model, 'Gemini Direct');
      return text;
    },
  };
}
