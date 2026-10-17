import { allCurrentRecords } from '../../data/currentIncidents';
import type { DisasterIncident } from '../../types';
import { inRecentWindow, recentWindow } from '../recentWindow';

export function recentDisasterList(disasters: Record<string, DisasterIncident>, now = Date.now()) {
  const window = recentWindow(now);
  const records = Object.values(disasters).flatMap(disaster => {
    const source = allCurrentRecords.find(record => record.id === disaster.id);
    const stored = disaster as DisasterIncident & { eventDate?: string };
    const date = stored.eventDate ?? source?.date;
    if (!date || !inRecentWindow(date, now)) return [];
    const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date(Date.parse(date) + 7 * 3600000).toISOString().slice(0, 10);
    return [{ id: disaster.id, name: disaster.name, date: day, type: source?.disasterLabel ?? disaster.fullName }];
  }).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  return { ...window, records, latestDate: records[0]?.date ?? null };
}

export const asksRecentDisasters = (question: string) =>
  /(bencana|insiden|kejadian|disaster|incident)/i.test(question) &&
  /(14\s*(hari|days?)|dua minggu|two weeks|terakhir|sejak hari ini|last fortnight)/i.test(question);

export function recentDisasterContext(disasters: Record<string, DisasterIncident>, now = Date.now()) {
  const list = recentDisasterList(disasters, now);
  return `RENTANG BENCANA: ${list.startDate}–${list.endDate} (14 hari kalender termasuk hari ini, WIB). ${list.records.length} wilayah/jenis bencana tercatat; bukan jumlah kejadian individual atau klaim masih aktif. Tanggal kejadian terbaru tersedia: ${list.latestDate ?? 'belum tersedia'}. Cakupan sumber dapat terlambat dan belum tentu lengkap.\n${list.records.map(record => `- ${record.date}: ${record.name} — ${record.type}`).join('\n')}`;
}

/** Today means the event date in WIB, not the record's last update time. */
export function asksTodaysDisasters(question: string): boolean {
  return /\b(bencana|insiden|kejadian|disasters?|incidents?|floods?|earthquakes?)\b/i.test(question)
    && /\b(hari ini|today)\b/i.test(question)
    && !asksRecentDisasters(question);
}
export function todaysDisasterList(disasters: Record<string, DisasterIncident>, now = Date.now()) {
  const list = recentDisasterList(disasters, now);
  return { date: list.endDate, records: list.records.filter(record => record.date.slice(0, 10) === list.endDate), latestDate: list.latestDate };
}
