import type { TranslationParams } from './index';

type Translator = (key: string, params?: TranslationParams) => string;

interface StatusTextRule {
  pattern: RegExp;
  key: string;
  params: (match: RegExpMatchArray, translate: Translator) => TranslationParams;
}

const rules: StatusTextRule[] = [
  {
    pattern: /^Dataset · (\d+) hari terakhir$/,
    key: 'Dataset · {days} hari terakhir',
    params: match => ({ days: match[1] }),
  },
  {
    pattern: /^Rentang (.+?)–(.+?) WIB \(termasuk hari ini\)\. BNPB snapshot tersaring: ([\d,]+) wilayah, ([\d,]+) laporan\. Snapshot BNPB masih memerlukan impor sumber terbaru; filter bukan bukti pengambilan data baru\.$/,
    key: 'Rentang {start}–{end} WIB (termasuk hari ini). BNPB snapshot tersaring: {regions} wilayah, {reports} laporan. Snapshot BNPB masih memerlukan impor sumber terbaru; filter bukan bukti pengambilan data baru.',
    params: match => ({ start: match[1], end: match[2], regions: match[3], reports: match[4] }),
  },
  {
    pattern: /^Aktif; model (.+)\. Key tersedia di backend\.$/,
    key: 'Aktif; model {model}. Key tersedia di backend.',
    params: match => ({ model: match[1] }),
  },
  {
    pattern: /^Google News berhasil: ([\d,]+) artikel, ([\d,]+) bertanggal\. Uji ini tidak menulis artikel atau melewati gate crawler\.$/,
    key: 'Google News berhasil: {count} artikel, {dated} bertanggal. Uji ini tidak menulis artikel atau melewati gate crawler.',
    params: match => ({ count: match[1], dated: match[2] }),
  },
  {
    pattern: /^Permintaan Gemini selesai dengan Google Search: ([\d,]+) sumber berkutip\. Uji ini tidak menulis artikel ke Firestore dan tidak melewati gate crawler\.$/,
    key: 'Permintaan Gemini selesai dengan Google Search: {count} sumber berkutip. Uji ini tidak menulis artikel ke Firestore dan tidak melewati gate crawler.',
    params: match => ({ count: match[1] }),
  },
  {
    pattern: /^Terakhir: (.+?)\. (Sudah jatuh tempo|Tertahan interval 1 hari)\. Artikel Gemini tersimpan: ([\d,]+); seluruh artikel: ([\d,]+)\.(?: Run sukses: (.+)\.)?$/,
    key: 'Terakhir: {outcome}. {schedule}. Artikel Gemini tersimpan: {geminiCount}; seluruh artikel: {articleCount}{runAt}',
    params: (match, translate) => ({
      outcome: translate(match[1]),
      schedule: translate(match[2]),
      geminiCount: match[3],
      articleCount: match[4],
      runAt: match[5] ? ` Run sukses: ${match[5]}.` : '',
    }),
  },
  {
    pattern: /^Tersimpan ([\d,]+) artikel Gemini\. Sampel ([\d,]+): ([\d,]+) sesuai kejadian, ([\d,]+) perlu review\. Tanpa tanggal publikasi yang cocok, hasil Gemini masuk review dan tidak otomatis tampil di feed utama\.$/,
    key: 'Tersimpan {count} artikel Gemini. Sampel {sample}: {matched} sesuai kejadian, {review} perlu review. Tanpa tanggal publikasi yang cocok, hasil Gemini masuk review dan tidak otomatis tampil di feed utama.',
    params: match => ({ count: match[1], sample: match[2], matched: match[3], review: match[4] }),
  },
  {
    pattern: /^Tersimpan ([\d,]+) artikel\. Sampel ([\d,]+): ([\d,]+) sesuai kejadian, ([\d,]+) perlu review\. Berita digabung dengan sumber lain setelah pemeriksaan lokasi dan tanggal\.$/,
    key: 'Tersimpan {count} artikel. Sampel {sample}: {matched} sesuai kejadian, {review} perlu review. Berita digabung dengan sumber lain setelah pemeriksaan lokasi dan tanggal.',
    params: match => ({ count: match[1], sample: match[2], matched: match[3], review: match[4] }),
  },
  {
    pattern: /^Snapshot produksi: ([\d,]+) gauge Indonesia\.$/,
    key: 'Snapshot produksi: {count} gauge Indonesia.',
    params: match => ({ count: match[1] }),
  },
  {
    pattern: /^Metadata foto tersedia untuk ([\d,]+)\/([\d,]+) titik\. Memuat sumber dan tanggal laporan; keberhasilan render gambar di browser belum diuji oleh snapshot ini\.$/,
    key: 'Metadata foto tersedia untuk {available}/{total} titik. Memuat sumber dan tanggal laporan; keberhasilan render gambar di browser belum diuji oleh snapshot ini.',
    params: match => ({ available: match[1], total: match[2] }),
  },
  {
    pattern: /^([\d,]+) foto dari folder BNPB yang bisa diakses\. Folder privat\/hasil kosong memakai fallback berita\.$/,
    key: '{count} foto dari folder BNPB yang bisa diakses. Folder privat/hasil kosong memakai fallback berita.',
    params: match => ({ count: match[1] }),
  },
  {
    pattern: /^Autocomplete dan Place Details berhasil; ([\d,]+) saran\.$/,
    key: 'Autocomplete dan Place Details berhasil; {count} saran.',
    params: match => ({ count: match[1] }),
  },
  {
    pattern: /^Respons Air Quality API valid untuk Jakarta; UAQI (.+) \((.+)\)\.$/,
    key: 'Respons Air Quality API valid untuk Jakarta; UAQI {aqi} ({category}).',
    params: (match, translate) => ({ aqi: match[1], category: translate(match[2]) }),
  },
  {
    pattern: /^Baca Firestore dari server berhasil; sampel ([\d,]+) artikel\.$/,
    key: 'Baca Firestore dari server berhasil; sampel {count} artikel.',
    params: match => ({ count: match[1] }),
  },
];

export function translateStatusText(value: string, translate: Translator): string {
  const exact = translate(value);
  if (exact !== value) return exact;

  for (const rule of rules) {
    const match = value.match(rule.pattern);
    if (match) return translate(rule.key, rule.params(match, translate));
  }
  return value;
}
