/** Recognise an intention to submit first-hand information, rather than ask about reports. */
export function detectReportIntent(text: string): 'report-disaster' | 'report-needs' | null {
  const value = text.toLowerCase();
  if (/^(?:bagaimana|gimana|apa)\b.*(?:cara|prosedur|syarat)\b.*(?:lapor|melaporkan)/.test(value)) return null;
  const explicit = /^laporan\b/.test(value) || /\b(laporkan|melaporkan)\b|\b(?:saya|aku|kami)\s+(?:ingin\s+|mau\s+|akan\s+)?(?:buat|membuat|kirim|mengirim)\s+laporan\b/.test(value);
  const firsthand = /\b(di sini|disini|di tempat saya|di lokasi saya|di desa kami|kami membutuhkan|kami butuh|saya butuh)\b/.test(value);
  const incident = /banjir|gempa|kebakaran|longsor|bantuan|butuh|kerusakan|jalan rusak|korban/.test(value);
  if (!explicit && !(firsthand && incident)) return null;
  return /\b(bantuan|kebutuhan|butuh|membutuhkan|logistik|sembako)\b/.test(value) ? 'report-needs' : 'report-disaster';
}
