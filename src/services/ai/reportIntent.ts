/** Recognise an intention to submit first-hand information, rather than ask about reports. */
export function detectReportIntent(text: string): 'report-disaster' | 'report-needs' | null {
  const value = text.toLowerCase().trim();
  const englishReport = /^(?:i|we) (?:want to |would like to |need to )?(?:report|submit (?:a )?report)\b|^report (?:a |an |the )|^can you (?:help me )?report\b/.test(value);
  const englishNeed = /^(?:i|we) (?:need|require)\b/.test(value);
  if (englishReport || englishNeed) return (/\b(?:aid|assistance|supplies|water|food|medicine|shelter|needs)\b/.test(value) || (englishNeed && !englishReport)) ? 'report-needs' : 'report-disaster';
  if (/^(?:what|which|where|when|why|how|is|are|do|does|can|could)\b/.test(value)) return null;
  // Questions about reporting and explicit refusals must remain informational chat.
  if (/^(?:apa|apakah|bagaimana|gimana|kenapa|mengapa|kapan|berapa|siapa|di mana)\b/.test(value)) return null;
  if (/\b(?:tidak|nggak|enggak|gak|ga|belum)\s+(?:(?:ingin|mau|akan)\s+)?(?:lapor|melapor|melaporkan|laporkan|buat laporan|kirim laporan)\b/.test(value)) return null;
  if (/^(?:bagaimana|gimana|apa)\b.*(?:cara|prosedur|syarat)\b.*(?:lapor|melaporkan)/.test(value)) return null;
  const explicit = /^laporan\b/.test(value) || /\b(laporkan|melaporkan)\b|\b(?:saya|aku|kami)\s+(?:ingin\s+|mau\s+|akan\s+)?(?:buat|membuat|kirim|mengirim)\s+laporan\b/.test(value);
  const firsthand = /\b(di sini|disini|di tempat saya|di lokasi saya|di desa kami|kami membutuhkan|kami butuh|saya butuh)\b/.test(value);
  const incident = /banjir|gempa|kebakaran|longsor|bantuan|butuh|kerusakan|jalan rusak|korban/.test(value);
  if (!explicit && !(firsthand && incident)) return null;
  return /\b(bantuan|kebutuhan|butuh|membutuhkan|logistik|sembako)\b/.test(value) ? 'report-needs' : 'report-disaster';
}
