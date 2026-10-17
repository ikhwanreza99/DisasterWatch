import { getLang, type Lang } from '../../i18n';

/** Ambiguous answers (city names, numbers, yes/no) retain the conversation language. */
export function assistantLanguage(text: string, previous: Lang = getLang()): Lang {
  if (/\b(in english|speak english|answer in english|use english)\b/i.test(text)) return 'en';
  if (/\b(bahasa indonesia|in indonesian)\b/i.test(text)) return 'id';
  const id = text.match(/\b(saya|aku|kami|ingin|mau|tidak|jadi|batal|laporkan|melaporkan|bencana|apa|hari|ini|berapa|butuh|bantuan|tolong|jangan|bagaimana|terjadi|banjir|gempa|di|mana)\b/gi)?.length ?? 0;
  const en = text.match(/\b(i|we|want|would|please|cancel|stop|report|reporting|disaster|disasters|what|today|how|where|need|help|flood|earthquake|don't|never|mind|english)\b/gi)?.length ?? 0;
  return en > id ? 'en' : id > en ? 'id' : previous;
}

export function assistantLanguageInstruction(lang: Lang): string {
  return `Reply entirely in ${lang === 'en' ? 'English' : 'Bahasa Indonesia'}. Translate descriptions, labels, units and disaster terminology into that language. Keep place names, source names, URLs, identifiers and direct source quotations unchanged. Do not mix languages merely because source records use another language.`;
}

// Helpdesk is loaded lazily; its language dictionary must be ready even when
// an English message is sent while the surrounding UI uses Indonesian.
import { en } from '../../i18n/translations';
import { interpolate, type TranslationParams } from '../../i18n';
export function translateAssistant(lang: Lang, key: string, params?: TranslationParams): string {
  return interpolate(lang === 'en' ? en[key] ?? key : key, params);
}

/** Reject obvious untranslated model prose; source quotations and names remain intact. */
export function responseMatchesLanguage(text: string, language: Lang): boolean {
  const prose = text.replace(/https?:\/\/\S+/g, '').replace(/"[^"]*"|“[^”]*”/g, '');
  if (language === 'en' && /\b(bencana|banjir|gempa|terdampak|kebutuhan|menurut|belum tersedia|yang merupakan|meninggal|kebakaran|orang terdampak)\b/i.test(prose)) return false;
  if (language === 'id' && /\b(according to|currently|affected people|not available|earthquake|flood|disaster data|recorded incidents)\b/i.test(prose)) return false;
  return assistantLanguage(prose, language) === language;
}

export function incidentLabel(incident: { fullTitleDisplay: string; category: string }, language: Lang): string {
  const translated = translateAssistant(language, incident.fullTitleDisplay);
  if (language === 'id' || translated !== incident.fullTitleDisplay) return translated;
  return ({ flood: 'Flood', fire: 'Fire', earthquake: 'Earthquake', landslide: 'Landslide' } as Record<string, string>)[incident.category] ?? 'Disaster';
}
