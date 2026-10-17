import { getLang, type Lang } from './index';

/** Translate generated labels, preserving place names and original source data. */
export function incidentText(text: string, lang: Lang = getLang()): string {
  if (lang !== 'en') return text;
  // Curated incident data labels with embedded numbers (impact cards, etc.).
  const impact: Array<[RegExp, string]> = [
    [/^Area: ([\d.,]+) KK Terdampak$/, 'Area: $1 households affected'],
    [/^Area: ± ?([\d.,]+) Ha Lahan$/, 'Area: ± $1 ha of land'],
    [/^Area: ± ?([\d.,]+) Ha Gambut$/, 'Area: ± $1 ha of peatland'],
    [/^Area: ([\d.,]+) Unit Fasilitas Rusak$/, 'Area: $1 damaged facility units'],
    [/^Area: Genangan ([\d.,]+) Meter$/, 'Area: $1-metre flooding'],
    [/^Area: ([\d.,]+) Fasilitas Retak$/, 'Area: $1 cracked facilities'],
    [/^Area: ([\d.,]+) Rumah Rendam$/, 'Area: $1 flooded homes'],
    [/^([\d.,]+)% Terpenuhi$/, '$1% fulfilled'],
    [/^Lihat catatan provenance \(angka dashboard = demo\)$/, 'See provenance note (dashboard figures = demo)'],
    [/^Kerusakan dalam pendataan \(BNPB sementara: ([\d.,]+) rumah; klaim media berbeda\)$/, 'Damage still being recorded (BNPB provisional: $1 homes; media claims differ)'],
  ];
  for (const [pattern, replacement] of impact) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  const aid = text.match(/^([\d.]+)% terpenuhi · estimasi bantuan \((\d+)\/(\d+) kategori\)$/);
  if (aid) return `${aid[1]}% fulfilled · estimated aid (${aid[2]}/${aid[3]} categories)`;
  return text
    .replace(/\bTerjadi sejak\b/g, 'Occurred since')
    .replace(/\bTerjadi\b/g, 'Occurred')
    .replace(/\bsejak\b/g, 'since')
    .replace(/\bkemarin\b/g, 'yesterday')
    .replace(/\b(\d+) hari lalu\b/g, '$1 days ago')
    .replace(/\b(\d+) jam lalu\b/g, '$1 hours ago')
    .replace(/\bhari lalu\b/g, 'days ago')
    .replace(/\bjam lalu\b/g, 'hours ago')
    .replace(/\bMei\b/g, 'May')
    .replace(/\bAgu\b/g, 'Aug')
    .replace(/\bDes\b/g, 'Dec')
    .replace(/\b(\d+)m lalu\b/g, '$1m ago')
    .replace(/\b(\d+)j lalu\b/g, '$1h ago')
    .replace(/\bOleh:/g, 'By:')
    .replace(/\bLaporan\b/g, 'Reported')
    .replace(/\bDitinjau\b/g, 'Reviewed')
    .replace(/\bOkt\b/g, 'Oct')
    .replace(/\bkasus nyata\b/g, 'real case')
    .replace(/\bKecamatan:/g, 'Districts:')
    .replace(/\bKecamatan\b/g, 'District')
    .replace(/\bKelurahan\b/g, 'Urban village')
    .replace(/\bDesa\b/g, 'Village')
    .replace(/\bDistrik\b/g, 'District')
    .replace(/\bKec\./g, 'Dist.')
    .replace(/\bDs\./g, 'Village')
    .replace(/\bKel\./g, 'Urban village');
}

/**
 * Translate the fixed aid-allocation assumption labels produced by
 * `narrativeAidProgress` (and the one dynamic "boxed aid" variant) while
 * preserving the unit names and numeric factors from the source data.
 */
export function aidAssumptionText(text: string, lang: Lang = getLang()): string {
  if (lang !== 'en') return text;
  switch (text) {
    case '1 pax = 40 pcs · 1 pcs/jiwa':
      return '1 pax = 40 pcs · 1 piece/person';
    case 'Jumlah barang = jiwa terlayani':
      return 'Item count = people served';
    case '1 porsi/jiwa · 1 kali makan':
      return '1 portion/person · 1 meal';
    case '1 paket/30 jiwa':
      return '1 package/30 people';
    case '1 barang/jiwa':
      return '1 item/person';
  }
  const boxed = text.match(/^1 (.+) = (\d+) pcs · 1 pcs\/jiwa( \(isi dari sumber\))?$/);
  if (boxed) {
    return `1 ${boxed[1]} = ${boxed[2]} pcs · 1 piece/person${boxed[3] ? ' (contents from source)' : ''}`;
  }
  return text;
}
