/**
 * DisasterWatch i18n.
 *
 * The default (and source) language is Indonesian. Every user-visible string is
 * passed through `t()`, whose key is the Indonesian text itself. Switching the
 * language to English looks the key up in the dictionary in ./translations.ts and
 * returns the English string; when a key is missing it safely falls back to the
 * Indonesian source string.
 *
 * Usage inside a component:
 *   const { t } = useI18n();
 *   <button title={t('Laporkan Bencana')}>{t('Laporkan Bencana')}</button>
 *
 * Usage outside React (services, plain modules):
 *   import { t } from '../i18n';
 *   const label = t('Belum tersedia');
 *
 * Interpolation uses `{name}` placeholders:
 *   t('{n} jiwa', { n: 12 })  ->  "12 people"
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
// Indonesian uses the source keys; download English only when selected.
let en: Record<string, string> | null = null;
let englishPromise: Promise<void> | null = null;
export function loadEnglishTranslations(): Promise<void> {
  return englishPromise ??= import('./translations').then(module => { en = module.en; });
}

export type Lang = 'id' | 'en';
export type TranslationParams = Record<string, string | number | undefined | null>;

const STORAGE_KEY = 'dw:lang';

/** Normalize an HTML `<html lang>` value into a supported language. */
function normalizeLang(value: string | null | undefined): Lang | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('id') || lower.startsWith('in')) return 'id';
  return null;
}

function readInitialLang(): Lang {
  if (typeof window === 'undefined') return 'id';
  try {
    const stored = normalizeLang(window.localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    /* storage unavailable (private mode) */
  }
  // Default to the app's source language (Indonesian); the toggle switches to English.
  return 'id';
}

/** Replace `{placeholder}` tokens in a template with the supplied values. */
export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Module-level current language, kept in sync by the provider so that plain
 * (non-React) modules can translate with the standalone `t()` helper.
 */
let activeLang: Lang = 'id';

export function getLang(): Lang {
  return activeLang;
}

/** Locale tag for `Intl`/`toLocale*` formatting. */
export function localeFor(lang: Lang = activeLang): string {
  return lang === 'en' ? 'en-US' : 'id-ID';
}

/** Translate a key using the current language. Safe outside React. */
export function t(key: string, params?: TranslationParams): string {
  const raw = activeLang === 'en' ? en?.[key] ?? key : key;
  return interpolate(raw, params);
}

/** Alias with an explicit, intention-revealing name for non-React callers. */
export const translate = t;

interface I18nContextValue {
  lang: Lang;
  locale: string;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: string, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'id',
  locale: 'id-ID',
  setLang: () => {},
  toggleLang: () => {},
  t: (key: string) => key,
});

const TITLES: Record<Lang, string> = {
  id: 'DisasterWatch - Sistem Informasi Tanggap Darurat Bencana RI',
  en: 'DisasterWatch - Indonesian Disaster Emergency Response Information System',
};

function syncDocumentLanguage(lang: Lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.title = TITLES[lang];
  const description =
    lang === 'en'
      ? 'Indonesian Disaster Emergency Response Information System - real-time interactive disaster monitoring platform across the archipelago, logistics and evacuation route mapping, verified citizen reporting, and the DisasterAI emergency response assistant.'
      : 'Sistem Informasi Tanggap Darurat Bencana RI - Platform pemantauan bencana interaktif real-time se-Nusantara, pemetaan rute distribusi logistik dan evakuasi, pelaporan warga terverifikasi, serta asisten tanggap darurat DisasterAI.';
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', description);
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(readInitialLang);
  // Suspend on a saved EN preference too: no partially translated first render.
  if (lang === 'en' && !en) throw loadEnglishTranslations();

  // Keep the module-level language in sync before children render so that plain
  // `t()` calls made during render use the correct language.
  activeLang = lang;

  useEffect(() => {
    activeLang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable (private mode) */
    }
    syncDocumentLanguage(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggleLang = useCallback(() => setLangState((prev) => (prev === 'id' ? 'en' : 'id')), []);
  const translateKey = useCallback(
    (key: string, params?: TranslationParams) => {
      const raw = lang === 'en' ? en?.[key] ?? key : key;
      return interpolate(raw, params);
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, locale: localeFor(lang), setLang, toggleLang, t: translateKey }),
    [lang, setLang, toggleLang, translateKey],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export default { LanguageProvider, useI18n, t, translate, getLang, localeFor };
