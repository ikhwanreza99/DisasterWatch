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
