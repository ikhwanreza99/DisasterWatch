// Pure Google sign-in flow decisions and redirect login-intent persistence.
// Storage and user agent are passed in so node:test can exercise them.

export type LoginSource = 'report' | 'avatar' | 'ai-helpdesk';

const LOGIN_SOURCES: readonly LoginSource[] = ['report', 'avatar', 'ai-helpdesk'];

/** Popup errors where a full-page redirect is likely to succeed instead. */
export const REDIRECT_FALLBACK_CODES = [
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
] as const;

export function shouldFallbackToRedirect(code: string | undefined): boolean {
  return !!code && (REDIRECT_FALLBACK_CODES as readonly string[]).includes(code);
}

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile/i;
const EMBEDDED_UA = /FBAN|FBAV|Instagram|Line\/|; wv\)|WebView|GSA\//i;

/** Mobile and in-app/embedded browsers go straight to redirect sign-in. */
export function prefersRedirect(userAgent: string): boolean {
  return MOBILE_UA.test(userAgent) || EMBEDDED_UA.test(userAgent);
}

export const LOGIN_INTENT_KEY = 'dw.loginIntent';
export const LOGIN_INTENT_MAX_AGE_MS = 10 * 60_000;

export type IntentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isLoginSource(value: unknown): value is LoginSource {
  return typeof value === 'string' && (LOGIN_SOURCES as readonly string[]).includes(value);
}

export function saveLoginIntent(
  storage: IntentStorage | null,
  source: LoginSource,
  now: number = Date.now(),
): void {
  if (!storage) return;
  try {
    storage.setItem(LOGIN_INTENT_KEY, JSON.stringify({ source, createdAt: now }));
  } catch {
    // Storage blocked (e.g. Safari private mode): degrade to "no intent".
  }
}

export function clearLoginIntent(storage: IntentStorage | null): void {
  if (!storage) return;
  try {
    storage.removeItem(LOGIN_INTENT_KEY);
  } catch {
    // ignore
  }
}

/** Reads and removes the stored intent; returns the source only if valid and 0 <= age <= maxAge. */
export function takeLoginIntent(
  storage: IntentStorage | null,
  now: number = Date.now(),
  maxAgeMs: number = LOGIN_INTENT_MAX_AGE_MS,
): LoginSource | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(LOGIN_INTENT_KEY);
  } catch {
    return null;
  }
  clearLoginIntent(storage);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { source?: unknown; createdAt?: unknown } | null;
    if (!parsed || !isLoginSource(parsed.source) || typeof parsed.createdAt !== 'number') return null;
    const age = now - parsed.createdAt;
    return age >= 0 && age <= maxAgeMs ? parsed.source : null;
  } catch {
    return null;
  }
}
