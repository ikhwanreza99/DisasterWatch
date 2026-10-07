// Maps Firebase Auth error codes to Indonesian user-facing messages (pure, unit-testable).

/** Popup errors where a full-page redirect is likely to succeed instead. */
export const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-environment',
]);

export function authErrorCode(cause: unknown): string | undefined {
  const code = (cause as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && code ? code : undefined;
}

export function authErrorMessage(cause: unknown): string {
  const code = authErrorCode(cause);
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Login dibatalkan. Silakan coba lagi.';
    case 'auth/popup-blocked':
      return 'Popup diblokir browser. Mengalihkan ke halaman login Google…';
    case 'auth/operation-not-allowed':
      return 'Login Google belum diaktifkan di Firebase Console (Authentication → Sign-in method → Google).';
    case 'auth/unauthorized-domain': {
      const host = typeof location !== 'undefined' ? location.hostname : 'ini';
      return `Domain ${host} belum diizinkan. Tambahkan di Firebase Console → Authentication → Settings → Authorized domains.`;
    }
    case 'auth/network-request-failed':
      return 'Koneksi gagal. Periksa internet Anda lalu coba lagi.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan.';
    case 'auth/account-exists-with-different-credential':
      return 'Email ini sudah terdaftar dengan metode login lain.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'Konfigurasi Firebase tidak valid (API key).';
    case 'auth/configuration-not-found':
    case 'auth/auth-domain-config-required':
      return 'Konfigurasi Firebase Auth belum lengkap.';
    case 'auth/internal-error':
      return 'Terjadi kesalahan pada layanan login. Silakan coba lagi.';
    case undefined:
      return cause instanceof Error && cause.message ? cause.message : 'Login belum berhasil. Silakan coba lagi.';
    default:
      return `Login Google belum berhasil (${code}). Silakan coba lagi.`;
  }
}
