import { assertCompletedGeneration } from '../../services/ai/responseCompletion';
import { recordTokenUsage } from '../../admin/tokenUsage';
// Firebase AI Logic (Gemini) accessor with safe fallback.
// Transport order: Firebase AI Logic first, server-side Gemini proxy second
// (POST /api/ai/generate), local heuristic last. Never throws when unconfigured —
// callers must handle `available === false`.
// Model name lives ONLY in ./geminiConfig.ts (single source of truth).
// SECURITY: the Gemini Developer API key is NEVER inlined into the client.
// It lives server-side (server/aiProxy.ts) and is reached through the same-origin
// proxy, so no API key ships in the public bundle. No extra SDK — plain fetch.
import { isFirebaseConfigured } from './config';
import { resolveGeminiCandidates, resolveGeminiModel } from './geminiConfig';

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
 *
 * Resilience: every generateContent call tries, in order, Firebase AI Logic
 * with each model candidate, then the direct Gemini Developer API with each
 * candidate. The first transport+model that answers wins, so a temporary
 * overload of the primary model (HTTP 503) automatically falls back instead
 * of failing the whole feature.
 */
export async function getGeminiModel(options: { maxOutputTokens?: 512 | 2048; temperature?: 0 } = {}): Promise<{ generateContent: (prompt: string) => Promise<string> } | null> {
  const candidates = resolveGeminiCandidates();
  const maxOutputTokens = options.maxOutputTokens ?? 512;
  const aiLogic = await tryAILogicTransport(maxOutputTokens, options.temperature);
  let lastError: unknown = null;
  return {
    generateContent: async (prompt: string) => {
      if (aiLogic) {
        for (const model of candidates) {
          try {
            return await aiLogic.generate(prompt, model);
          } catch (e) {
            lastError = e;
          }
        }
      }
      // Approved fallback (Phase 18, hardened): the Gemini Developer API is reached
      // through the server-side proxy so the API key is never part of the bundle.
      // When no proxy is deployed (e.g. static hosting without a backend) this throws
      // and the caller uses its deterministic fallback — the feature degrades, never breaks.
      if (proxyState !== 'down') {
        for (const model of candidates) {
          try {
            return await proxyGenerate(prompt, model, maxOutputTokens, options.temperature);
          } catch (e) {
            lastError = e;
          }
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Gemini unavailable on all transports and models.');
    },
  };
}

interface AILogicTransport {
  generate: (prompt: string, model: string) => Promise<string>;
}

async function tryAILogicTransport(maxOutputTokens = 512, temperature?: 0): Promise<AILogicTransport | null> {
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
    const cache = new Map<string, { generateContent: (p: string | unknown) => Promise<{ response: { text: () => string; candidates?: Array<{ finishReason?: string }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } } }> }>();
    const forModel = (name: string) => {
      let m = cache.get(name);
      if (!m) {
        m = (getGenerativeModel as unknown as (ai: unknown, opts: unknown) => {
          generateContent: (p: string | unknown) => Promise<{ response: { text: () => string; candidates?: Array<{ finishReason?: string }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } } }>;
        })(ai, { model: name, generationConfig: { maxOutputTokens, ...(temperature === 0 ? { temperature } : {}) } });
        cache.set(name, m);
      }
      return m;
    };
    return {
      generate: async (prompt: string, model: string) => {
        const res = await forModel(model).generateContent(prompt);
        recordTokenUsage(res.response.usageMetadata, model, 'Firebase AI Logic');
        assertCompletedGeneration(res.response.candidates?.[0]?.finishReason);
        const text = res.response.text();
        if (!text.trim()) throw new Error('Empty model response');
        return text;
      },
    };
  } catch {
    return null;
  }
}

/**
 * Server-side Gemini proxy transport (plain fetch, no extra SDK, no API key in
 * the browser). Calls the same-origin `/api/ai/generate` endpoint implemented in
 * server/aiProxy.ts (dev middleware + Express server). The key never leaves the
 * server. Response parsing tolerates the standard candidates[0].content.parts shape.
 *
 * Once the proxy is proven absent (static hosting rewrites unknown paths to
 * index.html, or the endpoint returns 503/404) we stop retrying it for this
 * session so callers fall straight through to the deterministic fallback.
 */
let proxyState: 'unknown' | 'down' = 'unknown';

async function proxyGenerate(prompt: string, model: string, maxOutputTokens = 512, temperature?: 0): Promise<string> {
  if (proxyState === 'down') throw new Error('Gemini proxy unavailable.');
  const {getAuth}=await import('firebase/auth');
  const {getFirebaseApp}=await import('./config');
  const app = getFirebaseApp();
  let user = app ? getAuth(app).currentUser : null;
  if (app && !user) {
    const { ensureUser } = await import('./auth');
    await ensureUser();
    user = getAuth(app).currentUser;
  }
  if (!user) throw new Error('A valid Firebase session is required for the server AI fallback.');
  const token=await user.getIdToken();
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization:`Bearer ${token}` },
    signal:AbortSignal.timeout(25000),
    body: JSON.stringify({ model, prompt: prompt.slice(0, 8000), maxOutputTokens, temperature }),
  });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Static hosting serves index.html for unknown paths — no proxy here.
    proxyState = 'down';
    throw new Error(`Gemini proxy ${res.status} (unexpected response type).`);
  }
  const data = (await res.json()) as {
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string } | string;
  };
  if (!res.ok) {
    if (res.status === 503 || res.status === 404) proxyState = 'down';
    const message =
      typeof data?.error === 'string' ? data.error : data?.error?.message;
    throw new Error(`Gemini proxy ${res.status}${message ? `: ${message.slice(0, 200)}` : ''}`);
  }
  if (typeof data?.error === 'string' && data.error) {
    throw new Error(`Gemini proxy error: ${data.error.slice(0, 200)}`);
  }
  if (data?.error && typeof data.error === 'object' && data.error.message) {
    throw new Error(`Gemini proxy error: ${data.error.message.slice(0, 200)}`);
  }
  assertCompletedGeneration(data?.candidates?.[0]?.finishReason);
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('');
  if (!text.trim()) throw new Error('Gemini proxy returned empty text.');
  recordTokenUsage(data.usageMetadata, model, 'Gemini Direct (server)');
  return text;
}
