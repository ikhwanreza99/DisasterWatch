import express from "express";

/**
 * Server-side NASA FIRMS proxy (self-hosted / `npm start`).
 *
 * The dev server already proxies `/api/firms` (see vite.config.ts). This module
 * provides the same behaviour for the Express server so the FIRMS MAP_KEY stays
 * on the server instead of being inlined into the public bundle via `VITE_*`.
 *
 * Expected path shape: {SOURCE}/{bbox}/{days}/{start}
 *   e.g. VIIRS_SNPP_NRT/92,-13.5,143,9/5/2026-10-01
 */
const FIRMS_ENDPOINT = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
// Source + bbox (4 numbers) + days (1-2 digits) + start date (YYYY-MM-DD).
const FIRMS_PATH = /^[A-Za-z0-9_-]+\/(-?[\d.]+,){3}-?[\d.]+\/\d{1,2}\/\d{4}-\d{2}-\d{2}$/;

export function readFirmsServerKey(env: NodeJS.ProcessEnv = process.env): string {
  return (env.NASA_FIRMS_MAP_KEY || "").trim();
}

export interface FirmsProxyOptions {
  key?: string;
  fetchImpl?: typeof fetch;
}

export function createFirmsProxy(options: FirmsProxyOptions = {}) {
  const app = express();
  const fetchImpl = options.fetchImpl ?? fetch;
  app.disable("x-powered-by");

  app.get("/*", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const key = (options.key ?? readFirmsServerKey()).trim();
    if (!key) {
      res.status(503).json({ error: "FIRMS proxy not configured." });
      return;
    }
    const path = String((req.params as Record<string, string>)[0] || "").replace(/^\/+/, "");
    if (!FIRMS_PATH.test(path) || !['VIIRS_SNPP_NRT','VIIRS_NOAA20_NRT','VIIRS_NOAA21_NRT','MODIS_NRT'].includes(path.split('/')[0]) || path.split('/')[1]!=='92,-13.5,143,9' || Number(path.split('/')[2])<1 || Number(path.split('/')[2])>5) {
      res.status(400).json({ error: "Invalid FIRMS path." });
      return;
    }
    try {
      const upstream = await fetchImpl(`${FIRMS_ENDPOINT}/${encodeURIComponent(key)}/${path}`, {signal:AbortSignal.timeout(25000),redirect:"error"});
      const text = await upstream.text();
      if(!upstream.ok||!text.startsWith('latitude,')||text.includes(key)){res.status(502).json({error:'FIRMS upstream unavailable.'});return;}
      res.status(200).type("text/csv").send(text);
    } catch (error) {
      // Log a key-safe reason (never the URL, which contains the MAP_KEY).
      const reason = error instanceof Error ? error.message.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]") : "unknown error";
      console.error("[firms-proxy]", reason);
      res.status(502).json({ error: "FIRMS upstream unavailable." });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Endpoint tidak ditemukan." });
  });
  return app;
}
