import 'dotenv/config';
// Guard: fail if a server-only secret value ended up in the published bundle.
// Vite inlines every VITE_* variable, so server-only secrets must never be
// referenced with that prefix. Run after `vite build` (CI: after the Build step).
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Server-only env var names (never VITE_-prefixed). Only names whose value is
// present in this environment are checked, so this is safe to run anywhere.
const SERVER_ONLY = [
  "NASA_FIRMS_MAP_KEY",
  "VITE_NASA_FIRMS_MAP_KEY",
  "VITE_GEMINI_DIRECT_API_KEY",
  "VITE_GEMINI_API_KEY",
  "DISASTERWATCH_GEMINI_KEY",
  "FIREBASE_NEWS_SERVICE_ACCOUNT",
  "FIREBASE_ADMIN_SERVICE_ACCOUNT",
  "ZAPI_API_KEY",
  "GOOGLE_FLOOD_API_KEY",
  "DISASTERWATCH_GEMINI_SEARCH_KEY",
  "GEMINI_API_KEY",
  "GEMINI_DIRECT_API_KEY",
  "ADMIN_PASSWORD",
  "SERPAPI_API_KEY",
  "THREADS_ACCESS_TOKEN",
  "BNPB_DRIVE_API_KEY",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let files: string[] = [];
try {
  files = walk("dist").filter((f) => /\.(js|css|html|json)$/.test(f));
} catch {
  console.error("checkBundleSecrets: no dist/ found — run `npm run build` first.");
  process.exit(1);
}

const hits: string[] = [];
for(const file of files){const body=readFileSync(file,'utf8');if(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(body)||/"private_key"\s*:\s*"-----BEGIN/.test(body))hits.push(`PRIVATE_KEY → ${file}`);}

const namesChecked: string[] = [];
for (const name of SERVER_ONLY) {
  const value = (process.env[name] || "").trim();
  if (value.length < 8) continue;
  namesChecked.push(name);
  for (const file of files) {
    if (readFileSync(file, "utf8").includes(value)) hits.push(`${name} → ${file}`);
  }
}

if (hits.length) {
  console.error("Server-only secret leaked into the published bundle:");
  for (const hit of hits) console.error(`  - ${hit}`);
  process.exit(1);
}
// Publish build-time evidence for the status page (/data/security.json).
// Counts and a boolean only — never a secret value, and not the name list.
const evidence = {
  version: 1,
  generatedAt: new Date().toISOString(),
  revision: process.env.GITHUB_SHA || null,
  bundleSecrets: { clean: true, filesScanned: files.length, namesChecked: namesChecked.length },
};
for (const dir of ["dist/data", "public/data"]) {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "security.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  } catch {
    // Non-fatal: this file only feeds the status page.
  }
}

console.log(`checkBundleSecrets: clean (${files.length} files scanned).`);
