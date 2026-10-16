import { recordTokenUsage } from '../../admin/tokenUsage';
// Firebase AI Logic (Gemini) accessor — sole browser transport.
// SECURITY: no Gemini Developer API key is used in browser code.
// All browser Gemini requests go through Firebase AI Logic (authenticated
// via the Firebase project's public config + App Check). Never import or
// reference VITE_GEMINI_API_KEY — that variable must not exist.
import { isFirebaseConfigured } from './config';
import { resolveGeminiCandidates, resolveGeminiModel } from './geminiConfig';

export interface AIBackendStatus {
  available: boolean;
  reason: string;
  mode: 'firebase-ai' | 'heuristic-fallback';
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
 *
 * Resilience: tries each model candidate in order via Firebase AI Logic.
 * The first model that answers wins, so a temporary overload of the primary
 * model (HTTP 503) automatically falls back to the next candidate.
 */
export async function getGeminiModel(): Promise<{ generateContent: (prompt: string) => Promise<string> } | null> {
  const candidates = resolveGeminiCandidates();
  const aiLogic = await tryAILogicTransport();
  if (!aiLogic) return null;
  let lastError: unknown = null;
  return {
    generateContent: async (prompt: string) => {
      for (const model of candidates) {
        try {
          return await aiLogic.generate(prompt, model);
        } catch (e) {
          lastError = e;
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Gemini unavailable on all models via Firebase AI Logic.');
    },
  };
}

interface AILogicTransport {
  generate: (prompt: string, model: string) => Promise<string>;
}

async function tryAILogicTransport(): Promise<AILogicTransport | null> {
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
    const cache = new Map<string, { generateContent: (p: string | unknown) => Promise<{ response: { text: () => string; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } } }> }>();
    const forModel = (name: string) => {
      let m = cache.get(name);
      if (!m) {
        m = (getGenerativeModel as unknown as (ai: unknown, opts: unknown) => {
          generateContent: (p: string | unknown) => Promise<{ response: { text: () => string; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } } }>;
        })(ai, { model: name, generationConfig: { maxOutputTokens: 512 } });
        cache.set(name, m);
      }
      return m;
    };
    return {
      generate: async (prompt: string, model: string) => {
        const res = await forModel(model).generateContent(prompt);
        recordTokenUsage(res.response.usageMetadata, model, 'Firebase AI Logic');
        const text = res.response.text();
        if (!text.trim()) throw new Error('Empty model response');
        return text;
      },
    };
  } catch {
    return null;
  }
}


