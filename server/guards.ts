import type { NextFunction, Request, Response } from "express";

/**
 * Reject cross-origin browser calls when an allow-list is configured.
 * Requests without an `Origin` header (same-origin GET, server-to-server,
 * Firebase Hosting rewrite) are allowed through.
 *
 * NOTE: an Origin/Referer check raises the bar for drive-by abuse but is not a
 * substitute for authentication. For full protection, verify a Firebase App
 * Check token server-side.
 */
export function createOriginGuard(allowed: string[]) {
  const set = new Set(allowed.filter(Boolean));
  return (req: Request, res: Response, next: NextFunction) => {
    if (!set.size) {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (typeof origin === "string" && origin && !set.has(origin)) {
      res.status(403).json({ error: "Origin not allowed." });
      return;
    }
    next();
  };
}

/**
 * Minimal in-memory fixed-window rate limiter, keyed by client IP.
 * Protects the public API proxies (Gemini, FIRMS) from abusive bursts.
 * Per-instance state is intentional: Cloud Run may run several instances.
 */
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    if (hits.size > 5000) {
      for (const [key, entry] of hits) if (now > entry.reset) hits.delete(key);
    }
    const entry = hits.get(ip);
    if (!entry || now > entry.reset) {
      hits.set(ip, { count: 1, reset: now + opts.windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.status(429).json({ error: "Terlalu banyak permintaan. Coba lagi nanti." });
      return;
    }
    next();
  };
}
