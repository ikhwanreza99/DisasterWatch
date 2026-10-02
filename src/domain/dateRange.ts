// Shared date-range selection for the header date control.
// The selection stays a plain string (App state + props unchanged):
//   presets: 'Today' | 'Hari ini (24 Jam)' | '7 Hari Terakhir' | '30 Hari Terakhir'
//   custom:  'custom:YYYY-MM-DD:YYYY-MM-DD' (inclusive, local calendar days)
// Every data layer (FIRMS, MAGMA, …) resolves it with resolveDateRange() so they stay in sync.

export const DATE_PRESETS = ['Hari ini (24 Jam)', '7 Hari Terakhir', '30 Hari Terakhir'] as const;

/** Oldest selectable day for a custom range (FIRMS NRT + MAGMA paging limit). */
export const MAX_LOOKBACK_DAYS = 60;
/** Longest custom range (keeps downloads reasonable). */
export const MAX_RANGE_DAYS = 31;

export type RangeKey = 'today' | '24h' | '7d' | '30d' | 'custom';

export interface ResolvedRange {
  key: RangeKey;
  /** Stable cache key, e.g. "7d" or "custom:2026-09-01:2026-09-10". */
  id: string;
  start: Date;
  end: Date;
  /** Calendar days covered (1 for today/24h). */
  days: number;
  /** Short label for chips, e.g. "7 hari", "1–10 Sep". */
  label: string;
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "YYYY-MM-DD" in local time. */
export function toIsoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseIsoDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function makeCustomSelection(from: string, to: string): string {
  return `custom:${from}:${to}`;
}

export function isCustomSelection(sel: string): boolean {
  return sel.startsWith('custom:');
}

function shortDay(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** Validate a custom range; returns an error message (Indonesian) or null. */
export function validateCustomRange(from: string, to: string, now = new Date()): string | null {
  const a = parseIsoDay(from);
  const b = parseIsoDay(to);
  if (!a || !b) return 'Isi tanggal mulai dan selesai.';
  if (a > b) return 'Tanggal mulai harus sebelum tanggal selesai.';
  const today = startOfDay(now);
  if (b > today) return 'Tanggal selesai tidak boleh melewati hari ini.';
  if ((today.getTime() - a.getTime()) / DAY_MS > MAX_LOOKBACK_DAYS) {
    return `Data hanya tersedia ${MAX_LOOKBACK_DAYS} hari terakhir.`;
  }
  if (Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1 > MAX_RANGE_DAYS) {
    return `Rentang maksimal ${MAX_RANGE_DAYS} hari.`;
  }
  return null;
}

export function resolveDateRange(sel: string, now = new Date()): ResolvedRange {
  const today = startOfDay(now);
  if (isCustomSelection(sel)) {
    const [, from, to] = sel.split(':');
    const a = parseIsoDay(from ?? '');
    const b = parseIsoDay(to ?? '');
    if (a && b && !validateCustomRange(from!, to!, now)) {
      const end = new Date(b.getTime() + DAY_MS - 1);
      const days = Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1;
      const label = days === 1 ? shortDay(a) : `${shortDay(a)}–${shortDay(b)}`;
      return { key: 'custom', id: sel, start: a, end: end > now ? now : end, days, label };
    }
    // Invalid/expired custom value → fall back to today.
  }
  const s = sel.toLowerCase();
  if (s.startsWith('30')) {
    return { key: '30d', id: '30d', start: new Date(today.getTime() - 29 * DAY_MS), end: now, days: 30, label: '30 hari' };
  }
  if (s.startsWith('7')) {
    return { key: '7d', id: '7d', start: new Date(today.getTime() - 6 * DAY_MS), end: now, days: 7, label: '7 hari' };
  }
  if (s.includes('24')) {
    return { key: '24h', id: '24h', start: new Date(now.getTime() - DAY_MS), end: now, days: 2, label: '24 jam' };
  }
  return { key: 'today', id: 'today', start: today, end: now, days: 1, label: 'hari ini' };
}

/** Human label for the header button. */
export function selectionLabel(sel: string): string {
  if (!isCustomSelection(sel)) return sel;
  const r = resolveDateRange(sel);
  return r.key === 'custom' ? r.label : 'Today';
}
