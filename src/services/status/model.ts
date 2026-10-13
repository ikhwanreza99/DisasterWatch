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
  if (typeof code === 'string' && /^[a-z/-]{1,80}$/i.test(code)) return code;
  const msg = error instanceof Error ? error.message : '';
  if (['Google search not executed', 'Incomplete Google search'].includes(msg)) return msg;
  return msg.match(/HTTP \d{3}/)?.[0] || (msg.includes('timeout') || (error as { name?: string })?.name === 'TimeoutError' ? 'Batas waktu pemeriksaan habis' : 'Permintaan gagal; periksa akses, jaringan, atau kuota');
}
