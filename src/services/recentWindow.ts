// Seven calendar days including today, in WIB.
const DAY = 86_400_000;
const WIB = 7 * 3_600_000;
export function recentWindow(now = Date.now()) {
  const today = new Date(now + WIB).toISOString().slice(0, 10);
  const midnight = Date.parse(`${today}T00:00:00+07:00`);
  const startMs = midnight - 6 * DAY;
  const endMs = midnight + DAY;
  return { startMs, endMs, startDate: new Date(startMs + WIB).toISOString().slice(0, 10), endDate: today,
    afterDate: new Date(startMs - DAY + WIB).toISOString().slice(0, 10), beforeDate: new Date(endMs + WIB).toISOString().slice(0, 10) };
}
export function inRecentWindow(value: string | null | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const time = Date.parse(dateOnly ? `${value}T00:00:00+07:00` : value);
  const { startMs, endMs } = recentWindow(now);
  return Number.isFinite(time) && time >= startMs && time < endMs && (dateOnly || time <= now);
}
