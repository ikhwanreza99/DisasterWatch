// Shared date-range selection for the header date control.
// A selection is a plain string:
//   presets: 'Today' | 'Hari ini (24 Jam)' | '7 Hari Terakhir' | '30 Hari Terakhir'
//   custom:  'custom:YYYY-MM-DD:YYYY-MM-DD' (inclusive, local calendar days)
// FIRMS and MAGMA each have their own selection (the header toggles which one is being edited),
// because their sources reach back very differently.
import { t, localeFor } from '../i18n';

export const DATE_PRESETS = ['Hari ini (24 Jam)', '7 Hari Terakhir', '30 Hari Terakhir'] as const;

export type DateTarget = 'bmkg' | 'firms' | 'magma';

export interface RangeLimits {
  /** Oldest selectable day (YYYY-MM-DD), or relative lookback in days. */
  minDay?: string;
  lookbackDays?: number;
  /** Longest custom range in days. */
  maxSpanDays: number;
  /** Human description for the picker hint. */
  hint: string;
}

export const RANGE_LIMITS: Record<DateTarget, RangeLimits> = {
  // BMKG public feeds only list the latest ~30 events (M5+ and felt quakes), roughly the last 3–4 weeks.
  bmkg: {
    lookbackDays: 30,
    maxSpanDays: 31,
    hint: 'BMKG hanya menyediakan ±30 gempa terbaru (M5+ & dirasakan), kira-kira 3–4 minggu terakhir.',
  },
  // NASA FIRMS near-real-time data covers roughly the last 2 months.
  firms: { lookbackDays: 60, maxSpanDays: 31, hint: 'Maks. 31 hari, dalam 60 hari terakhir (batas data NRT NASA).' },
  // MAGMA eruption archive starts May 2018; landslide reports cover 2022–2023.
  magma: { minDay: '2018-05-01', maxSpanDays: 366, hint: 'Maks. 1 tahun, sejak Mei 2018 (arsip MAGMA).' },
};

export type RangeKey = 'today' | '24h' | '7d' | '30d' | 'custom';

export interface ResolvedRange {
  key: RangeKey;
  /** Stable cache key, e.g. "7d" or "custom:2026-09-01:2026-09-10". */
  id: string;
  start: Date;
  end: Date;
  /** Calendar days covered (1 for today, 2 for 24h). */
  days: number;
  /** Short label for chips, e.g. "7 hari", "1–10 Sep 2022". */
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

/** Oldest selectable day for a target, as YYYY-MM-DD. */
export function minSelectableDay(limits: RangeLimits, now = new Date()): string {
  if (limits.minDay) return limits.minDay;
  const t = startOfDay(now);
  return toIsoDay(new Date(t.getFullYear(), t.getMonth(), t.getDate() - (limits.lookbackDays ?? 0)));
}

export function makeCustomSelection(from: string, to: string): string {
  return `custom:${from}:${to}`;
}

export function isCustomSelection(sel: string): boolean {
  return sel.startsWith('custom:');
}

function shortDay(d: Date, withYear: boolean): string {
  return d.toLocaleDateString(localeFor(), withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
}

/** Validate a custom range; returns a localized error message, or null. */
export function validateCustomRange(from: string, to: string, limits: RangeLimits, now = new Date()): string | null {
  const a = parseIsoDay(from);
  const b = parseIsoDay(to);
  if (!a || !b) return t('Isi tanggal mulai dan selesai.');
  if (a > b) return t('Tanggal mulai harus sebelum tanggal selesai.');
  if (b > startOfDay(now)) return t('Tanggal selesai tidak boleh melewati hari ini.');
  const min = parseIsoDay(minSelectableDay(limits, now))!;
  if (a < min) {
    return limits.minDay
      ? t('Data paling awal: {date}.', { date: shortDay(min, true) })
      : t('Data hanya tersedia {days} hari terakhir.', { days: limits.lookbackDays ?? 0 });
  }
  if (Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1 > limits.maxSpanDays) {
    return t('Rentang maksimal {days} hari.', { days: limits.maxSpanDays });
  }
  return null;
}

export function resolveDateRange(sel: string, limits: RangeLimits = RANGE_LIMITS.firms, now = new Date()): ResolvedRange {
  const today = startOfDay(now);
  if (isCustomSelection(sel)) {
    const [, from, to] = sel.split(':');
    const a = parseIsoDay(from ?? '');
    const b = parseIsoDay(to ?? '');
    if (a && b && !validateCustomRange(from!, to!, limits, now)) {
      const end = new Date(b.getTime() + DAY_MS - 1);
      const days = Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1;
      const withYear = a.getFullYear() !== now.getFullYear() || b.getFullYear() !== now.getFullYear();
      // Show the start year too when the range crosses years (e.g. "2 Jan 2022–2 Jan 2023").
      const crossYear = a.getFullYear() !== b.getFullYear();
      const label =
        days === 1 ? shortDay(a, withYear) : `${shortDay(a, crossYear)}–${shortDay(b, withYear || crossYear)}`;
      return { key: 'custom', id: sel, start: a, end: end > now ? now : end, days, label };
    }
    // Invalid/expired custom value → fall back to today.
  }
  const s = sel.toLowerCase();
  if (s.startsWith('30')) {
    return { key: '30d', id: '30d', start: new Date(today.getTime() - 29 * DAY_MS), end: now, days: 30, label: t('30 hari') };
  }
  if (s.startsWith('7')) {
    return { key: '7d', id: '7d', start: new Date(today.getTime() - 6 * DAY_MS), end: now, days: 7, label: t('7 hari') };
  }
  if (s.includes('24')) {
    return { key: '24h', id: '24h', start: new Date(now.getTime() - DAY_MS), end: now, days: 2, label: t('24 jam') };
  }
  return { key: 'today', id: 'today', start: today, end: now, days: 1, label: t('hari ini') };
}

/** Short label for a selection, e.g. "Today", "7 hari", "1 Jun–30 Jun 2022". */
export function selectionLabel(sel: string, limits: RangeLimits): string {
  if (sel === 'Today') return t('Hari ini');
  return resolveDateRange(sel, limits).label;
}
