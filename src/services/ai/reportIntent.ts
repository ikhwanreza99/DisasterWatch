import { isReportCancellation } from './reportControl';
/** Recognise an intention to submit first-hand information, rather than ask about reports. */
export function detectReportIntent(text: string): 'report-disaster' | 'report-needs' | null {
  const value = text.toLowerCase().replace(/[’]/g, "'").trim();
  if (isReportCancellation(value) || /\b(?:tidak|jangan)\s+(?:ingin\s+|mau\s+)?(?:melapor(?:kan)?|lapor)\b/.test(value) || /\b(?:don't|do not|not)\s+(?:want to\s+)?report\b/.test(value)) return null;
  if (/^(?:how|what)\b.*\b(?:report|reporting)\b/.test(value)) return null;
  if (/\b(?:i|we)\s+(?:want to|would like to|will|need to)\s+(?:report|submit a report)\b/.test(value) || /^report (?:a |an )?(?:disaster|flood|earthquake|fire|aid|need)/.test(value)) {
    return /\b(?:aid|needs?|supplies|food|water)\b/.test(value) ? 'report-needs' : 'report-disaster';
  }
  if (/^(?:bagaimana|gimana|apa)\b.*(?:cara|prosedur|syarat)\b.*(?:lapor|melaporkan)/.test(value)) return null;
  const explicit = /^laporan\b/.test(value) || /\b(laporkan|melaporkan)\b|\b(?:saya|aku|kami)\s+(?:ingin\s+|mau\s+|akan\s+)?(?:buat|membuat|kirim|mengirim)\s+laporan\b/.test(value);
  const firsthand = /\b(di sini|disini|di tempat saya|di lokasi saya|di desa kami|kami membutuhkan|kami butuh|saya butuh)\b/.test(value);
  const incident = /banjir|gempa|kebakaran|longsor|bantuan|butuh|kerusakan|jalan rusak|korban/.test(value);
  if (!explicit && !(firsthand && incident)) return null;
  return /\b(bantuan|kebutuhan|butuh|membutuhkan|logistik|sembako)\b/.test(value) ? 'report-needs' : 'report-disaster';
}
