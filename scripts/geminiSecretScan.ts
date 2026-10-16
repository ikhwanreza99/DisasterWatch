// Pure, testable detectors for the Gemini-secret regression guard.
// No I/O here beyond what callers pass in; no secret values are ever printed.
// See checkNoGeminiSecret.ts (CLI wrapper) and geminiSecretScan.test.ts.
export interface Finding {
  file: string;
  type: string;
  lines: number[];
}

/** Test fixtures (*.test.*) legitimately contain fake key-like strings. */
export function isTestFile(path: string): boolean {
  return /\.test\.[tj]sx?$/.test(path);
}

function stripLineComment(line: string): string {
  // Only treat // as a comment when not part of a URL scheme (https://…).
  return line.replace(/(^|[\s;{}(,])\/\/.*$/, '$1');
}

/**
 * Classify one source line from src/. Returns finding types (possibly empty).
 * SECURITY comments are ignored (comments stripped before matching).
 * Firebase public config (VITE_FIREBASE_*, AIza… values) never matches:
 * this guard only targets the Gemini Developer secret mechanisms.
 */
export function classifySrcLine(line: string): string[] {
  const out: string[] = [];
  const code = stripLineComment(line);
  if (
    /import\.meta[\s\S]{0,40}VITE_GEMINI_API_KEY/.test(code) ||
    /env\s*(\?\.)?\s*\[\s*['"]VITE_GEMINI_API_KEY['"]\s*\]/.test(code)
  ) {
    out.push('CODE_READS_VITE_GEMINI_API_KEY');
  }
  if (code.includes('x-goog-api-key')) out.push('BROWSER_SENDS_X_GOOG_API_KEY');
  if (code.includes('generativelanguage.googleapis.com')) {
    out.push('BROWSER_DIRECT_GENERATIVELANGUAGE_CALL');
  }
  return out;
}

/** Classify one workflow line (comments stripped). Catches build-env injection. */
export function classifyWorkflowLine(line: string): string[] {
  // YAML comments start at line start or after whitespace.
  const code = line.replace(/(^|\s)#.*$/, '$1');
  if (/^\s*VITE_GEMINI_API_KEY\s*:/.test(code) || code.includes('secrets.VITE_GEMINI_API_KEY')) {
    return ['WORKFLOW_INJECTS_VITE_GEMINI_API_KEY'];
  }
  return [];
}

/** .env.example must never define the variable (a SECURITY comment is fine). */
export function classifyEnvExampleLine(line: string): string[] {
  return /^\s*VITE_GEMINI_API_KEY\s*=/.test(line) ? ['ENV_EXAMPLE_DEFINES_VITE_GEMINI_API_KEY'] : [];
}

/**
 * Classify built-JS text. Flags the inlined variable name (Vite only inlines
 * vars that code actually reads). Generic 'x-goog-api-key' / endpoint strings
 * are intentionally NOT flagged: the official Firebase AI Logic SDK
 * legitimately contains them. The 'Gemini Direct' transport label is also NOT
 * flagged: it now names the authenticated same-origin server proxy
 * (server/aiProxy.ts), which ships no key in the bundle.
 */
export function classifyBundleText(text: string): string[] {
  const out: string[] = [];
  if (text.includes('VITE_GEMINI_API_KEY')) out.push('BUNDLE_CONTAINS_GEMINI_KEY_VAR');
  return out;
}

/** True when the build environment would cause Vite to inline a Gemini secret. */
export function isGeminiKeySetInEnv(env: Record<string, string | undefined>): boolean {
  return (env.VITE_GEMINI_API_KEY ?? '').trim().length > 0;
}
