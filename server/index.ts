import "dotenv/config";
import express from "express";
import path from "node:path";
import { createAdminApi } from "./admin";

const app = express();
const demo = process.env.ADMIN_DEMO_MODE === "true";
app.disable("x-powered-by");
app.use(
  "/api/admin",
  createAdminApi({ demo, secure: process.env.NODE_ENV === "production" }),
);
app.use(express.static(path.resolve("dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.resolve("dist/index.html"));
});
app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("DisasterWatch server ready"),
);
