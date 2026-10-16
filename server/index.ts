import "dotenv/config";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { createAdminApi } from "./admin";
import { createAiProxy } from "./aiProxy";
import { createFirmsProxy } from "./firmsProxy";
import { createOriginGuard, createRateLimiter } from "./guards";

const app = express();
app.disable("x-powered-by");
// Behind Firebase Hosting / Cloud Run the real client IP arrives via X-Forwarded-For.
app.set("trust proxy", true);

// Admin API is dev/self-hosted only. Disable it on public Cloud Run deploys
// (ENABLE_ADMIN_API=false) so no privileged endpoint is exposed.
if (process.env.ENABLE_ADMIN_API !== "false") {
  app.use(
    "/api/admin",
    createAdminApi({
      demo: process.env.ADMIN_DEMO_MODE === "true",
      secure: process.env.NODE_ENV === "production",
    }),
  );
}

// Server-side proxies keep API keys (Gemini direct key, NASA FIRMS MAP_KEY)
// out of the public browser bundle. Origin guard + rate limit protect them.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const originGuard = createOriginGuard(allowedOrigins);
app.use("/api/ai", originGuard, createRateLimiter({ windowMs: 60_000, max: 40 }), createAiProxy());
app.use(
  "/api/firms",
  originGuard,
  createRateLimiter({ windowMs: 60_000, max: 300 }),
  createFirmsProxy(),
);

// Public liveness probe. Deliberately unauthenticated and outside the origin
// guard: it exposes nothing but a boolean, and /status uses it to tell whether
// the Cloud Run proxy behind the /api/** rewrite is actually live. Without it a
// missing rewrite returns index.html, which is indistinguishable from a 404.
app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, service: "disasterwatch-api" });
});

// Serve the built frontend when present (self-hosted `npm start`). On Cloud Run
// the frontend is served by Firebase Hosting, so dist/ may not exist.
const distDir = path.resolve("dist");
const indexHtml = path.join(distDir, "index.html");
if (existsSync(indexHtml)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(indexHtml);
  });
}

app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("DisasterWatch server ready"),
);
