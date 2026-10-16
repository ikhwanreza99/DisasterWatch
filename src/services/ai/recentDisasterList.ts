import { allCurrentRecords } from '../../data/currentIncidents';
import type { DisasterIncident } from '../../types';
import { inRecentWindow, recentWindow } from '../recentWindow';

export function recentDisasterList(disasters: Record<string, DisasterIncident>, now = Date.now()) {
  const window = recentWindow(now);
  const records = Object.values(disasters).flatMap(disaster => {
    const source = allCurrentRecords.find(record => record.id === disaster.id);
    const stored = disaster as DisasterIncident & { eventDate?: string };
    const date = source?.date ?? stored.eventDate;
    if (!date || !inRecentWindow(date, now)) return [];
    return [{ id: disaster.id, name: disaster.name, date, type: source?.disasterLabel ?? disaster.fullName }];
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
