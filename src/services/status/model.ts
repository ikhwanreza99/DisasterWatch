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
export function stale(check: ServiceCheck, now = Date.now()): boolean {
  return !!check.checkedAt && (!Number.isFinite(Date.parse(check.checkedAt)) || now - Date.parse(check.checkedAt) > 24 * 3600_000);
}
export function safeStatusError(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  const status = (error as { customErrorData?: { status?: unknown } })?.customErrorData?.status;
  if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599) return `${typeof code === 'string' && /^[a-z/-]{1,80}$/i.test(code) ? code + ' · ' : ''}HTTP ${status}`;
  if (typeof code === 'string' && /^[a-z/-]{1,80}$/i.test(code)) return code;
  const msg = error instanceof Error ? error.message : '';
  if (['Google search not executed', 'Incomplete Google search'].includes(msg)) return msg;
  return msg.match(/HTTP \d{3}/)?.[0] || (msg.includes('timeout') || (error as { name?: string })?.name === 'TimeoutError' ? 'Batas waktu pemeriksaan habis' : 'Permintaan gagal; periksa akses, jaringan, atau kuota');
}

export function statusAdvice(check: ServiceCheck): string | null {
  if (check.state !== 'error') return null;
  if (check.detail.includes('permission-denied')) return 'Periksa Firestore Rules untuk koleksi incidentArticles. Backend Admin dan browser memakai jalur akses yang berbeda.';
  if (check.detail.includes('HTTP 429')) return 'Periksa kuota, rate limit, dan billing proyek API di Google AI Studio / Google Cloud. Tunggu batas reset sebelum menguji ulang.';
  if (check.detail.includes('HTTP 503')) return 'Layanan sedang tidak tersedia atau sibuk. Coba ulang nanti; periksa status global Google AI.';
  if (check.detail.includes('HTTP 401')) return 'Periksa autentikasi API key, konfigurasi Firebase AI Logic, dan App Check pada proyek ini.';
  if (check.detail.includes('HTTP 403')) return 'Periksa API yang diaktifkan, pembatasan API key/referrer, App Check, dan izin proyek.';
  if (check.detail.includes('HTTP 404')) return 'Periksa nama model atau endpoint yang didukung proyek ini.';
  return null;
}
