import { newsSourceUrl } from '../services/newsSourceUrl';
import { translate } from '../i18n';
export function isFinalReviewStatus(status: unknown): boolean {
  return ['VERIFIED', 'REJECTED', 'APPROVED'].includes(String(status));
}

export function reviewEvidence(note: unknown, urls: unknown): { note: string; urls: string[] } {
  if (typeof note !== 'string' || note.trim().length < 10 || note.trim().length > 1000 || !Array.isArray(urls) || !urls.length || urls.length > 3) throw new Error(translate('Isi catatan fact-check minimal 10 karakter dan 1–3 tautan bukti HTTPS.'));
  const safe = urls.map(newsSourceUrl);
  if (safe.some(url => !url)) throw new Error(translate('Tautan bukti harus berupa URL sumber HTTPS yang valid.'));
  return { note: note.trim(), urls: [...new Set(safe as string[])] };
}

export function reviewRejection(note: unknown, reason: unknown, urls: unknown) {
  if (typeof note !== 'string' || note.trim().length < 10 || note.trim().length > 1000 || !['HOAX','NO_DISASTER'].includes(String(reason))) throw new Error(translate('Pilih alasan penolakan dan isi catatan fact-check minimal 10 karakter.'));
  if (!Array.isArray(urls) || urls.length > 5) throw new Error(translate('Maksimal 5 tautan bukti.'));
  const safe = urls.map(newsSourceUrl);
  if (safe.some(url => !url)) throw new Error(translate('Tautan bukti harus berupa URL HTTPS yang valid.'));
  return {note:note.trim(), reason:String(reason), urls:[...new Set(safe as string[])]};
}
