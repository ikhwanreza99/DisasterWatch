import { getLang, type Lang } from './index';

/** Translate generated labels, preserving place names and original source data. */
export function incidentText(text: string, lang: Lang = getLang()): string {
  if (lang !== 'en') return text;
  const aid = text.match(/^([\d.]+)% terpenuhi · estimasi bantuan \((\d+)\/(\d+) kategori\)$/);
  if (aid) return `${aid[1]}% fulfilled · estimated aid (${aid[2]}/${aid[3]} categories)`;
  return text
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
