import React from 'react';
import { useI18n, type Lang } from './index';

const OPTIONS: Array<{ value: Lang; label: string; title: string }> = [
  { value: 'id', label: 'ID', title: 'Bahasa Indonesia' },
  { value: 'en', label: 'EN', title: 'English' },
];

/**
 * Compact ID/EN segmented control shown in the top navigation bar, next to the
 * Google service status link. Switching the language updates every translated
 * string in the app.
 */
export const LanguageToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('Pilih bahasa')}
      className={`flex h-9 shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-[#0f1b38]/70 ${className}`}
    >
      {OPTIONS.map((option) => {
        const active = lang === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLang(option.value)}
            aria-pressed={active}
            title={option.title}
            className={`flex h-full items-center justify-center rounded-full px-2.5 text-[11px] font-bold tracking-wide transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-cyan-500 dark:text-slate-950'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageToggle;
