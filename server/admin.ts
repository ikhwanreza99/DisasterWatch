import express from "express";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { demoReports } from "../src/data/seedDemo";
import { disastersData } from "../src/data/disasters";

const COOKIE = "dw_admin";
const TTL = 8 * 60 * 60 * 1000;
const hash = (value: string) => createHash("sha256").update(value).digest();
const equal = (a: string, b: string) => timingSafeEqual(hash(a), hash(b));

export function createAdminApi(options: {
  demo: boolean;
  password?: string;
  secure?: boolean;
}) {
  const app = express();
  const sessions = new Map<string, number>();
  const attempts = new Map<string, { count: number; until: number }>();
  const reports = structuredClone(demoReports).map((r) => ({
    ...r,
    reviewedBy: undefined as string | undefined,
    reviewedAt: undefined as string | undefined,
  }));
  const password =
    options.password ?? process.env.ADMIN_PASSWORD ?? "Disaster123";
  const db = () =>
    getFirestore(
      getApps().find((a) => a.name === "disasterwatch-admin") ??
        initializeApp(
          { credential: applicationDefault() },
          "disasterwatch-admin",
        ),
    );
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    // Custom same-origin header prevents cross-site form posts; no CORS is enabled.
    if (req.method !== "GET" && req.get("X-DisasterWatch-Admin") !== "1") {
      res.status(403).json({ error: "Permintaan tidak diizinkan." });
      return;
    }
    next();
  });
  const cookie = (req: express.Request) =>
    req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1) ?? "";
  const clear = (res: express.Response) =>
    res.clearCookie(COOKIE, {
      path: "/api/admin",
      httpOnly: true,
      sameSite: "strict",
      secure: options.secure ?? false,
    });
  app.post("/login", (req, res) => {
    const now = Date.now();
    for (const [key, expires] of sessions)
      if (expires <= now) sessions.delete(key);
    for (const [key, value] of attempts)
      if (value.until <= now) attempts.delete(key);
    const ip = req.ip ?? "unknown";
    const attempt = attempts.get(ip) ?? { count: 0, until: now + 15 * 60_000 };
    if (attempt.count >= 10) {
      res
        .status(429)
        .json({ error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." });
      return;
    }
    if (
      typeof req.body?.username !== "string" ||
      typeof req.body?.password !== "string" ||
      !equal(req.body.username, "Admin") ||
      !equal(req.body.password, password)
    ) {
      attempts.set(ip, { ...attempt, count: attempt.count + 1 });
      res.status(401).json({ error: "Username atau password salah." });
      return;
    }
    attempts.delete(ip);
    sessions.delete(cookie(req));
    const token = randomBytes(32).toString("hex");
    sessions.set(token, now + TTL);
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: options.secure ?? false,
      path: "/api/admin",
      maxAge: TTL,
    });
    res.json({ username: "Admin", demo: options.demo });
  });
  app.use((req, res, next) => {
    const token = cookie(req);
    if ((sessions.get(token) ?? 0) <= Date.now()) {
      sessions.delete(token);
      clear(res);
      res.status(401).json({ error: "Silakan login kembali." });
      return;
    }
    next();
  });
  app.get("/session", (_req, res) => {
    res.json({ username: "Admin", demo: options.demo });
  });
  app.post("/logout", (req, res) => {
    sessions.delete(cookie(req));
    clear(res);
    res.json({ ok: true });
  });
  app.get("/records", async (req, res, next) => {
    try {
      const name = req.query.collection;
      if (!["reports", "disasters", "incidents"].includes(String(name))) {
        res.status(400).json({ error: "Koleksi tidak valid." });
        return;
      }
      const after = typeof req.query.after === "string" ? req.query.after : "";
      if (after.includes("/") || after.length > 1500) {
        res.status(400).json({ error: "Cursor tidak valid." });
        return;
      }
      const filter = req.query.status;
      if (
        filter &&
        (name !== "reports" ||
          !["UNVERIFIED", "AI_REVIEWED", "VERIFIED", "CONFLICTING"].includes(
            String(filter),
          ))
      ) {
        res.status(400).json({ error: "Filter tidak valid." });
        return;
      }
      if (options.demo) {
        let rows: any[] =
          name === "reports"
            ? reports
            : name === "disasters"
              ? Object.values(disastersData)
              : [];
        if (filter) rows = rows.filter((r) => r.verificationStatus === filter);
        res.json({ rows, next: null, total: rows.length, demo: true });
        return;
      }
      let base: FirebaseFirestore.Query = db().collection(String(name));
      if (filter) base = base.where("verificationStatus", "==", filter);
      let page = base.orderBy(FieldPath.documentId()).limit(51);
      if (after) page = page.startAfter(after);
      const [snapshot, count] = await Promise.all([
        page.get(),
        base.count().get(),
      ]);
      res.json({
        rows: snapshot.docs
          .slice(0, 50)
          .map((d) => ({ ...d.data(), id: d.id })),
        next: snapshot.size > 50 ? snapshot.docs[49].id : null,
        total: count.data().count,
        demo: false,
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/reports/:id/approve", async (req, res, next) => {
    try {
      const id = req.params.id;
      const note =
        typeof req.body?.note === "string" ? req.body.note.trim() : "";
      if (
        !id ||
        id.includes("/") ||
        note.length > 1000 ||
        !["UNVERIFIED", "AI_REVIEWED", "CONFLICTING"].includes(
          req.body?.expectedStatus,
        )
      ) {
        res.status(400).json({ error: "Data persetujuan tidak valid." });
        return;
      }
      const review = {
        verificationStatus: "VERIFIED" as const,
        reviewedBy: "Admin",
        reviewedAt: new Date().toISOString(),
        reviewNote: note,
      };
      if (options.demo) {
        const report = reports.find((r) => r.id === id);
        if (!report) {
          res.status(404).json({ error: "Laporan tidak ditemukan." });
          return;
        }
        if (report.verificationStatus !== req.body.expectedStatus) {
          res
            .status(409)
            .json({ error: "Status laporan berubah. Muat ulang daftar." });
          return;
        }
        Object.assign(report, review);
      } else {
        const ref = db().collection("reports").doc(id);
        await db().runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists)
            throw Object.assign(new Error("Laporan tidak ditemukan."), {
              status: 404,
            });
          if (snap.data()?.verificationStatus !== req.body.expectedStatus)
            throw Object.assign(
              new Error("Status laporan berubah. Muat ulang daftar."),
              { status: 409 },
            );
          tx.update(ref, review);
          tx.create(db().collection("reportReviews").doc(), {
            reportId: id,
            previousStatus: snap.data()?.verificationStatus,
            ...review,
          });
        });
      }
      res.json(review);
    } catch (error) {
      next(error);
    }
  });
  app.get("/health", async (_req, res) => {
    const checkedAt = new Date().toISOString();
    if (options.demo) {
      res.json({
        state: "disabled",
        checkedAt,
        detail: "Mode demo lokal. Database produksi tidak dihubungi.",
      });
      return;
    }
    try {
      await db().collection("reports").limit(1).get();
      res.json({
        state: "ok",
        checkedAt,
        detail: "Koneksi server ke Firestore berhasil diuji.",
      });
    } catch {
      res.json({
        state: "error",
        checkedAt,
        detail:
          "Firestore tidak dapat diakses. Periksa kredensial server dan jaringan.",
      });
    }
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "Endpoint tidak ditemukan." });
  });
  app.use(
    (
      error: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = [400, 404, 409, 413].includes(error.status)
        ? error.status
        : 503;
      res
        .status(status)
        .json({
          error:
            status === 503
              ? "Data gagal diakses. Periksa koneksi dan konfigurasi server, lalu coba lagi."
              : status === 404 || status === 409
                ? error.message
                : "Permintaan tidak valid.",
        });
    },
  );
  return app;
}
