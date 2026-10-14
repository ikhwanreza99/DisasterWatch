import { newsSourceUrl } from '../services/newsSourceUrl';
export function reviewEvidence(note: unknown, urls: unknown): { note: string; urls: string[] } {
  if (typeof note !== 'string' || note.trim().length < 10 || note.trim().length > 1000 || !Array.isArray(urls) || !urls.length || urls.length > 5) throw new Error('Isi catatan fact-check minimal 10 karakter dan 1–5 tautan bukti HTTPS.');
  const safe = urls.map(newsSourceUrl);
  if (safe.some(url => !url)) throw new Error('Tautan bukti harus berupa URL sumber HTTPS yang valid.');
  return { note: note.trim(), urls: [...new Set(safe as string[])] };
}
