// Maps Firebase Auth error codes to Indonesian user-facing messages.
// Pure string table: no `firebase` or `import.meta` imports, so node:test can load it.
import { translate } from '../../i18n';

export const AUTH_UNAVAILABLE_MESSAGE =
  'Login belum tersedia. Silakan coba lagi setelah layanan login diaktifkan.';

const DEFAULT_FALLBACK_MESSAGE = 'Login belum berhasil. Silakan coba lagi.';

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/popup-closed-by-user': 'Login dibatalkan. Silakan coba lagi.',
  'auth/popup-blocked': 'Popup diblokir browser. Kami alihkan ke halaman login Google…',
  'auth/cancelled-popup-request':
    'Permintaan login sebelumnya dibatalkan. Mengalihkan ke halaman login Google…',
  'auth/operation-not-supported-in-this-environment':
    'Browser ini tidak mendukung popup login. Mengalihkan ke halaman login Google…',
  'auth/unauthorized-domain':
    'Domain ini belum diizinkan untuk login Google. Hubungi admin DisasterWatch.',
  'auth/operation-not-allowed':
    'Login Google belum diaktifkan untuk aplikasi ini. Hubungi admin DisasterWatch.',
  'auth/network-request-failed': 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.',
  'auth/internal-error':
    'Terjadi gangguan pada layanan login. Silakan coba lagi beberapa saat lagi.',
  'auth/too-many-requests': 'Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.',
  'auth/user-disabled': 'Akun ini dinonaktifkan. Hubungi admin DisasterWatch.',
  'auth/web-storage-unsupported':
    'Browser memblokir penyimpanan data. Aktifkan cookie/penyimpanan situs lalu coba lagi.',
  'auth/account-exists-with-different-credential':
    'Email ini sudah terdaftar dengan metode login lain.',
};

/** Indonesian message for a Firebase Auth error code. Unknown codes include the code. */
export function mapAuthError(code: string | undefined, fallbackMessage?: string): string {
  if (!code) return fallbackMessage ?? DEFAULT_FALLBACK_MESSAGE;
  if (Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, code)) {
    return AUTH_ERROR_MESSAGES[code];
  }
  return translate('Login Google belum berhasil (kode: {code}). Silakan coba lagi.', { code });
}

/** Safely reads a non-empty string `code` from a thrown value. */
export function authErrorCode(cause: unknown): string | undefined {
  if (typeof cause !== 'object' || cause === null) return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === 'string' && code ? code : undefined;
}

export type AuthErrorPhase = 'popup' | 'redirect' | 'redirect-result' | 'signout';

/** Logs only the error code and phase; never the error object, customData, emails or tokens. */
export function logAuthError(code: string | undefined, phase: AuthErrorPhase): void {
  console.warn('[auth] Google sign-in failed', { code: code ?? 'unknown', phase });
}
