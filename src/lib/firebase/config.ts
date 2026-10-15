// Central Firebase configuration. Env-driven, safe fallback to mock mode.
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { AppCheck, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

export interface FirebaseStatus {
  configured: boolean;
  missingKeys: string[];
  mode: 'live' | 'mock';
}

const ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

function readEnv(key: string): string {
  // Vite exposes import.meta.env; guard for non-vite contexts (tests).
  // Keep the literal `import.meta.env` token: Vite's dev server only injects env when it sees it
  // (`import.meta?.env` stays undefined on localhost and forces mock mode).
  try {
    const v: unknown = (import.meta.env as Record<string, unknown> | undefined)?.[key];
    return typeof v === 'string' ? v.trim() : '';
  } catch {
    return '';
  }
}

export function firebaseEnv(): Record<string, string> {
  return {
    apiKey: readEnv('VITE_FIREBASE_API_KEY'),
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('VITE_FIREBASE_APP_ID'),
    measurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID'),
  };
}

export function firebaseStatus(): FirebaseStatus {
  const env = firebaseEnv();
  const missingKeys = (Object.keys(env) as Array<keyof typeof env>)
    .filter((k) => ['apiKey', 'authDomain', 'projectId', 'appId'].includes(k))
    .filter((k) => !env[k])
    .map((k) => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
  return {
    configured: missingKeys.length === 0,
    missingKeys,
    mode: missingKeys.length === 0 ? 'live' : 'mock',
  };
}

export function isFirebaseConfigured(): boolean {
  return firebaseStatus().configured;
}

let cachedApp: FirebaseApp | null = null;
let cachedAppCheck: AppCheck | null = null;
let appCheckInitialized = false;
let appCheckSkippedReason: string | null = null;
let appCheckError: string | null = null;

/** Boolean-only indicator: true when the Enterprise site key is present at build. Never exposes the value. */
export function hasAppCheckSiteKey(): boolean {
  return readEnv('VITE_FIREBASE_APPCHECK_SITE_KEY').length > 0;
}

export interface AppCheckStatus {
  /** Site key present in this bundle (boolean only). */
  siteKeyPresent: boolean;
  initialized: boolean;
  skippedReason: string | null;
  error: string | null;
}

export function appCheckStatus(): AppCheckStatus {
  return {
    siteKeyPresent: hasAppCheckSiteKey(),
    initialized: cachedAppCheck !== null && appCheckInitialized,
    skippedReason: appCheckSkippedReason,
    error: appCheckError,
  };
}

/** App Check instance for the default app (for safe token probing). Null when not initialized. */
export function getAppCheckInstance(): AppCheck | null {
  return cachedAppCheck;
}

function configureAppCheck(app: FirebaseApp): void {
  if (cachedAppCheck || appCheckInitialized) return;
  if (typeof window === 'undefined') {
    appCheckSkippedReason = 'App Check dilewati: tidak ada window (non-browser).';
    return;
  }
  if (!hasAppCheckSiteKey()) {
    appCheckSkippedReason = 'App Check tidak diinisialisasi: site key tidak tersedia di bundle ini.';
    return;
  }
  try {
    cachedAppCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(readEnv('VITE_FIREBASE_APPCHECK_SITE_KEY')),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
    appCheckSkippedReason = null;
    appCheckError = null;
  } catch (e) {
    // initializeAppCheck throws when called twice per app; never crash app init.
    // Store a redacted message only (no keys/tokens).
    const raw = e instanceof Error ? e.message : String(e);
    appCheckError = redactDiagnosticText(raw).slice(0, 160) || 'Inisialisasi App Check gagal.';
    try {
      console.warn('[AppCheck]', appCheckError);
    } catch {
      /* console unavailable */
    }
  }
}

/**
 * Probe App Check token issuance without ever exposing the token value.
 * Returns ok:true when a token could be minted; otherwise ok:false + redacted reason.
 */
export async function probeAppCheckToken(): Promise<{ ok: boolean; detail: string }> {
  const status = appCheckStatus();
  if (!status.initialized || !cachedAppCheck) {
    return {
      ok: false,
      detail: status.error ?? status.skippedReason ?? 'App Check belum terinisialisasi.',
    };
  }
  try {
    const { getToken } = await import('firebase/app-check');
    const result = await getToken(cachedAppCheck, false);
    const issued = typeof result?.token === 'string' && result.token.length > 0;
    return issued
      ? { ok: true, detail: 'Token App Check berhasil diterbitkan (nilai tidak ditampilkan).' }
      : { ok: false, detail: 'App Check tidak mengembalikan token.' };
  } catch (e) {
    return { ok: false, detail: redactDiagnosticText(e instanceof Error ? e.message : String(e)).slice(0, 200) || 'Gagal memperoleh token App Check.' };
  }
}

/** Redact key/token-like material from diagnostic strings. */
export function redactDiagnosticText(input: string): string {
  return input
    .replace(/AIza[0-9A-Za-z\-_]{10,}/g, '[KEY]')
    .replace(/eyJ[0-9A-Za-z\-_.]{10,}/g, '[TOKEN]')
    .replace(/(api[_-]?key|token|site[_-]?key)\s*[:=]\s*['"]?[^'"\s,}]{8,}['"]?/gi, '$1=[REDACTED]')
    .slice(0, 500);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0]!;
    configureAppCheck(cachedApp);
    return cachedApp;
  }
  cachedApp = initializeApp(firebaseEnv());
  configureAppCheck(cachedApp);
  return cachedApp;
}
