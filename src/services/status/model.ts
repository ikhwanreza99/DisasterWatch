import { translate } from '../../i18n';

export type ServiceState = 'ok' | 'error' | 'configured' | 'disabled' | 'unknown' | 'empty' | 'checking';
export interface ServiceCheck {
  id: string; name: string; state: ServiceState; detail: string;
  checkedAt: string | null; scope: 'browser' | 'backend' | 'snapshot';
}
export interface StatusSnapshot {
  version: 1; generatedAt: string; revision: string; services: ServiceCheck[];
  searchProbe?: ServiceCheck;
}
export const stateLabels: Record<ServiceState, string> = {
  ok: 'Berhasil diuji', error: 'Gagal', configured: 'Terpasang · belum diuji',
  disabled: 'Nonaktif', unknown: 'Belum diketahui', empty: 'Berhasil · data kosong', checking: 'Memeriksa',
};
export function isStatusVisible(check: ServiceCheck): boolean {
  if (check.state === 'configured' || check.state === 'unknown') return false;
  return !(check.id === 'gemini-direct' && check.state === 'disabled');
}
export function stale(check: ServiceCheck, now = Date.now()): boolean {
  return !!check.checkedAt && (!Number.isFinite(Date.parse(check.checkedAt)) || now - Date.parse(check.checkedAt) > 24 * 3600_000);
}
export function safeStatusError(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  const status = (error as { customErrorData?: { status?: unknown } })?.customErrorData?.status;
  // Terse by design: only SDK code + numeric HTTP status, never raw provider message/body.
  // Raw snippets live only in redacted fetch bodies (safeErrorSnippet), not here.
  if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599) return `${typeof code === 'string' && /^[a-z/-]{1,80}$/i.test(code) ? code + ' · ' : ''}HTTP ${status}`;
  if (typeof code === 'string' && /^[a-z/-]{1,80}$/i.test(code)) return code;
  const msg = error instanceof Error ? error.message : '';
  if (['Google search not executed', 'Incomplete Google search'].includes(msg)) return msg;
  return msg.match(/HTTP \d{3}/)?.[0] || (msg.includes('timeout') || (error as { name?: string })?.name === 'TimeoutError' ? 'Batas waktu pemeriksaan habis' : 'Permintaan gagal; periksa akses, jaringan, atau kuota');
}

/** Redact key/token-like material from status strings. Never logs or returns raw secrets. */
export function redactStatusText(input: string): string {
  return input
    .replace(/AIza[0-9A-Za-z\-_]{10,}/g, '[KEY]')
    .replace(/eyJ[0-9A-Za-z\-_.]{10,}/g, '[TOKEN]')
    .replace(/(api[_-]?key|token|site[_-]?key)\s*[:=]\s*['"]?[^'"\s,}]{8,}['"]?/gi, '$1=[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Success note for Gemini candidate loops. Concise by design: names the model
 * that actually answered; when a fallback was used, adds a short secondary
 * note WITHOUT the primary model's raw error payload.
 */
export function fallbackNote(used: string, primary: string): string {
  if (used === primary) return translate('menggunakan {model}, tanpa fallback.', { model: used });
  return translate('menggunakan {model}. Model utama dilewati; fallback berhasil digunakan.', { model: used });
}

/** True only for non-empty, non-whitespace model text. Empty output is never success. */
export function isNonEmptyModelText(text: unknown): boolean {
  return typeof text === 'string' && text.trim().length > 0;
}

/** True when a Gemini `generateContent` payload holds at least one non-empty text part. */
export function hasValidGeminiCandidates(data: unknown): boolean {
  const candidates = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> } | null)?.candidates;
  return (
    Array.isArray(candidates) &&
    candidates.some(
      (c) => Array.isArray(c?.content?.parts) && c.content.parts.some((p) => isNonEmptyModelText(p?.text)),
    )
  );
}

export function statusAdvice(check: ServiceCheck): string | null {
  if (check.state !== 'error') return null;
  if (check.id === 'maps')
    return 'Peta tidak selesai dimuat dalam 20 detik. Pastikan Maps JavaScript API aktif, key VITE_GOOGLE_MAPS_API_KEY mengizinkan origin situs ini, serta billing dan kuota tersedia. Jika muncul 403 App Check/reCAPTCHA, periksa site key dan domain yang diizinkan.';
  if (check.id === 'google-search-probe' && check.detail.includes('HTTP 403'))
    return 'Uji Google Search ditolak (HTTP 403). Pastikan secret DISASTERWATCH_GEMINI_SEARCH_KEY valid, Gemini API aktif di proyek key tersebut, dan pembatasan key mengizinkan request dari GitHub Actions.';
  if (check.id.startsWith('serpapi-')) return check.detail.includes('HTTP 429')
    ? 'Periksa kuota dan batas request akun SerpApi. Tunggu sebelum menjalankan uji kembali.'
    : 'Periksa GitHub Secret SERPAPI_API_KEY, akun SerpApi, dan status layanannya. Setelah mengganti key, jalankan workflow hosting dengan check_serpapi.';
  if (check.detail.includes('permission-denied')) return 'Periksa Firestore Rules untuk koleksi incidentArticles. Backend Admin dan browser memakai jalur akses yang berbeda.';
  if (check.detail.includes('HTTP 429')) return 'Periksa kuota, rate limit, dan billing proyek API di Google AI Studio / Google Cloud. Tunggu batas reset sebelum menguji ulang.';
  if (check.detail.includes('HTTP 503')) return 'Layanan sedang tidak tersedia atau sibuk. Coba ulang nanti; periksa status global Google AI.';
  if (check.detail.includes('HTTP 401')) return 'Periksa autentikasi API key, konfigurasi Firebase AI Logic, dan App Check pada proyek ini.';
  if (check.detail.includes('HTTP 403')) return 'Periksa API yang diaktifkan, pembatasan API key/referrer, App Check, dan izin proyek.';
  if (check.detail.includes('HTTP 404')) return 'Periksa nama model atau endpoint yang didukung proyek ini.';
  return null;
}
