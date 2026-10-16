import "dotenv/config";
import express from "express";
import path from "node:path";
import { createAdminApi } from "./admin";
import { createAiProxy } from "./aiProxy";
import { createFirmsProxy } from "./firmsProxy";

const app = express();
const demo = process.env.ADMIN_DEMO_MODE === "true";
app.disable("x-powered-by");
app.use(
  "/api/admin",
  createAdminApi({ demo, secure: process.env.NODE_ENV === "production" }),
);
// Server-side proxies keep API keys (Gemini direct key, NASA FIRMS MAP_KEY)
// out of the public browser bundle.
app.use("/api/ai", createAiProxy());
app.use("/api/firms", createFirmsProxy());
app.use(express.static(path.resolve("dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.resolve("dist/index.html"));
});
app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("DisasterWatch server ready"),
);
