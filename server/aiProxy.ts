import {getAuth} from 'firebase-admin/auth';
import {getApps,initializeApp,applicationDefault} from 'firebase-admin/app';
import express from "express";

/**
 * Server-side Gemini proxy.
 *
 * The browser must never hold the Gemini Developer API key: Vite inlines every
 * `VITE_*` variable into the public bundle, so the key would be downloadable by
 * anyone. Instead the client calls `POST /api/ai/generate` with `{ model, prompt }`
 * and this handler attaches the key server-side.
 *
 * Key resolution (server-only, NEVER prefixed with VITE_):
 *   GEMINI_API_KEY → GEMINI_DIRECT_API_KEY → DISASTERWATCH_GEMINI_SEARCH_KEY
 *
 * Returns 503 when no key is configured so the client can fall back cleanly.
 */
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_PROMPT_CHARS = 8000;
const MAX_OUTPUT_TOKENS = 512;

export function readGeminiServerKey(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.GEMINI_API_KEY ||
    env.GEMINI_DIRECT_API_KEY ||
    env.DISASTERWATCH_GEMINI_SEARCH_KEY ||
    ""
  ).trim();
}

export interface AiProxyOptions {
  key?: string;
  fetchImpl?: typeof fetch;
  authenticate?: (token:string)=>Promise<string>;
}

export function createAiProxy(options: AiProxyOptions = {}) {
  const app = express();
  const fetchImpl = options.fetchImpl ?? fetch;
  app.use(express.json({ limit: "32kb" }));
  app.disable("x-powered-by");

  const attempts=new Map<string,{at:number;count:number}>();
  app.post("/generate", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const key = (options.key ?? readGeminiServerKey()).trim();
    if (!key) {
      res.status(503).json({ error: "Gemini proxy not configured." });
      return;
    }
    const token=req.headers.authorization?.match(/^Bearer ([^ ]+)$/)?.[1];
    if(!token){res.status(401).json({error:'Sign in required.'});return;}
    let uid:string;
    try{uid=await (options.authenticate??(async token=>{if(!getApps().length)initializeApp({credential:applicationDefault()});const claims=await getAuth().verifyIdToken(token);if(claims.firebase.sign_in_provider==='anonymous')throw new Error('Anonymous not allowed');return claims.uid;}))(token);}catch{res.status(401).json({error:'Authentication failed.'});return;}
    const now=Date.now();const limit=attempts.get(uid);if(limit&&now-limit.at<60000){if(limit.count>=10){res.status(429).json({error:'Rate limit exceeded.'});return;}limit.count++;}else {if(attempts.size>=10000)attempts.clear();attempts.set(uid,{at:now,count:1});}
    const model = typeof req.body?.model === "string" ? req.body.model.trim() : "";
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
    if (!/^gemini-[a-z0-9.-]{1,60}$/.test(model) || !prompt.trim() || prompt.length>MAX_PROMPT_CHARS) {
      res.status(400).json({ error: "model and prompt are required." });
      return;
    }
    try {
      const upstream = await fetchImpl(
        `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          signal: AbortSignal.timeout(20000),
          redirect: "error",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt.slice(0, MAX_PROMPT_CHARS) }] }],
            generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
          }),
        },
      );
      if(!upstream.ok){res.status(upstream.status===429?429:502).json({error:'AI upstream request failed.'});return;}
      const body = await upstream.text();
      if(body.includes(key)){res.status(502).json({error:'Invalid upstream response.'});return;}
      res.status(upstream.status).type("application/json").send(body);
    } catch {
      res.status(502).json({ error: "Gemini upstream unavailable." });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Endpoint tidak ditemukan." });
  });
  return app;
}
