// Regression guard: Gemini Developer API secret must never reach the browser bundle.
// Scans source + (if present) dist output WITHOUT printing secret values.
// Report contains only: file name, finding type, line numbers — never matched values.
//
// Detection logic lives in geminiSecretScan.ts (pure + unit-tested); this file
// only walks the repo, applies the detectors, and exits non-zero on findings.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  classifyBundleText,
  classifyEnvExampleLine,
  classifySrcLine,
  classifyWorkflowLine,
  isGeminiKeySetInEnv,
  isTestFile,
  type Finding,
} from './geminiSecretScan';

const ROOT = join(import.meta.dirname, '..');
const findings: Finding[] = [];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.git') continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function add(absPath: string, type: string, lineNo: number) {
  const rel = relative(ROOT, absPath);
  let f = findings.find((x) => x.file === rel && x.type === type);
  if (!f) {
    f = { file: rel, type, lines: [] };
    findings.push(f);
  }
  if (lineNo > 0 && !f.lines.includes(lineNo)) f.lines.push(lineNo);
}

for (const file of walk(join(ROOT, 'src'))) {
  if (!/\.(ts|tsx|js|jsx)$/.test(file) || isTestFile(file)) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((ln, i) => {
      for (const t of classifySrcLine(ln)) add(file, t, i + 1);
    });
}

for (const file of walk(join(ROOT, '.github', 'workflows'))) {
  if (!/\.yml$/.test(file)) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((ln, i) => {
      for (const t of classifyWorkflowLine(ln)) add(file, t, i + 1);
    });
}

const envExample = join(ROOT, '.env.example');
if (existsSync(envExample)) {
  readFileSync(envExample, 'utf8')
    .split('\n')
    .forEach((ln, i) => {
      for (const t of classifyEnvExampleLine(ln)) add(envExample, t, i + 1);
    });
}

if (isGeminiKeySetInEnv(process.env)) {
  findings.push({ file: '(environment)', type: 'VITE_GEMINI_API_KEY_SET_AT_BUILD_TIME', lines: [] });
}

const dist = join(ROOT, 'dist', 'assets');
if (existsSync(dist)) {
  for (const file of walk(dist)) {
    if (!/\.js$/.test(file)) continue;
    for (const t of classifyBundleText(readFileSync(file, 'utf8'))) add(file, t, 0);
  }
} else {
  console.log('[checkNoGeminiSecret] dist/ not present — bundle scan skipped (run after `npm run build`).');
}

if (findings.length > 0) {
  console.error('[checkNoGeminiSecret] FAIL — forbidden Gemini secret usage detected:');
  for (const f of findings.sort((a, b) => a.file.localeCompare(b.file))) {
    const where = f.lines.filter((n) => n > 0).sort((a, b) => a - b).join(',');
    console.error(`  - ${f.file} :: ${f.type}${where ? ` :: line(s) ${where}` : ''}`);
  }
  console.error(`[checkNoGeminiSecret] ${findings.length} finding(s). Remove browser Gemini-key usage; use Firebase AI Logic.`);
  process.exit(1);
} else {
  console.log('[checkNoGeminiSecret] PASS — no Gemini Developer secret in browser source/bundle.');
}
