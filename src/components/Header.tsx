import React, { useEffect, useState } from 'react';
import { Calendar, ChevronDown, Moon, Sun, Plus, Radio } from 'lucide-react';
import {
  DATE_PRESETS,
  RANGE_LIMITS,
  isCustomSelection,
  makeCustomSelection,
  minSelectableDay,
  selectionLabel,
  toIsoDay,
  validateCustomRange,
  type DateTarget,
} from '../domain/dateRange';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  /** Separate date selections for the FIRMS and MAGMA layers. */
  dates: Record<DateTarget, string>;
  onSelectDate: (target: DateTarget, value: string) => void;
  onOpenReportModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isDarkMode,
  onToggleTheme,
  dates,
  onSelectDate,
  onOpenReportModal,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const presets = DATE_PRESETS;
  // Which layer the picker edits: FIRMS (last 60 days) or MAGMA (archive since 2018).
  const [target, setTarget] = useState<DateTarget>('bmkg');
  const selectedDate = dates[target];
  const limits = RANGE_LIMITS[target];
  const now = new Date();
  const todayIso = toIsoDay(now);
  const minDay = minSelectableDay(limits, now);
  // Custom range inputs: prefill from the target's custom selection, else the last 7 days.
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  useEffect(() => {
    const sel = dates[target];
    if (isCustomSelection(sel)) {
      setCustomFrom(sel.split(':')[1]!);
      setCustomTo(sel.split(':')[2]!);
    } else {
      setCustomFrom(toIsoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)));
      setCustomTo(todayIso);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, isCalendarOpen]);
  const customError = validateCustomRange(customFrom, customTo, limits);
  const bmkgLabel = selectionLabel(dates.bmkg, RANGE_LIMITS.bmkg);
  const firmsLabel = selectionLabel(dates.firms, RANGE_LIMITS.firms);
  const magmaLabel = selectionLabel(dates.magma, RANGE_LIMITS.magma);
  const allSame = bmkgLabel === firmsLabel && firmsLabel === magmaLabel;

  return (
    <header className="relative z-40 flex items-center justify-between gap-2 px-3 sm:px-6 py-2 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b1329]/80 backdrop-blur-xl transition-colors duration-300">
      {/* Brand Identifier (Top-Left) */}
      <div className="flex items-center gap-2.5 pointer-events-auto">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-orange-500 flex items-center justify-center shadow-md shadow-orange-500/20 text-white shrink-0">
          <Radio className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              DisasterWatch
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-cyan-950/60 text-slate-700 dark:text-cyan-300 border border-slate-200 dark:border-cyan-500/30">
              ver.1.0
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-600/30 tracking-wider uppercase">
              SIAGA BENCANA
            </span>
          </div>
        </div>
      </div>

      {/* Date Filter Toolbar & Controls (Top-Right) */}
      <div className="flex items-center gap-1.5 sm:gap-3 pointer-events-auto shrink-0">
        {/* Dark / Light Mode Toggle */}
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-full border border-slate-200/90 dark:border-slate-700/70 bg-slate-50 hover:bg-slate-100 dark:bg-[#0f1b38]/70 dark:hover:bg-[#14234b] text-slate-700 dark:text-slate-200 shadow-xs transition-all text-xs font-semibold cursor-pointer active:scale-95"
          title="Ganti Mode Gelap / Terang"
        >
          {isDarkMode ? (
            <Moon className="w-3.5 h-3.5 text-cyan-400" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-500" />
          )}
          <span className="hidden sm:inline text-xs">{isDarkMode ? 'Dark' : 'Light'}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isDarkMode ? 'bg-cyan-400 shadow-[0_0_8px_#38bdf8]' : 'bg-amber-500'
            }`}
          ></span>
        </button>

        {/* Date Selector Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="flex items-center gap-2 bg-slate-50 dark:bg-[#0f1b38]/70 hover:bg-slate-100 dark:hover:bg-[#14234b] active:scale-95 transition-all text-slate-700 dark:text-slate-200 px-2.5 sm:px-5 py-2 rounded-full font-medium text-xs sm:text-sm shadow-xs border border-slate-200/80 dark:border-slate-700/70"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-cyan-400" />
            {allSame ? (
              <span className="truncate max-w-[64px] sm:max-w-none">{firmsLabel}</span>
            ) : (
              <span className="truncate max-w-[96px] sm:max-w-[260px]" title={`BMKG: ${bmkgLabel} • FIRMS: ${firmsLabel} • MAGMA: ${magmaLabel}`}>
                🌐 {bmkgLabel} · 🔥 {firmsLabel} · 🌋 {magmaLabel}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isCalendarOpen && (
            <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-[#0b1329] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-4 z-50 text-xs transition-all">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-200">
                <span>Pilih Rentang Waktu</span>
                <span className="text-[10px] text-slate-400 dark:text-cyan-400">
                  {now.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                </span>
              </div>
              {/* Which layer this selection applies to */}
              <div className="mb-2">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Berlaku untuk</div>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80" role="radiogroup" aria-label="Layer tanggal">
                  {(
                    [
                      ['bmkg', '🌐 BMKG', bmkgLabel],
                      ['firms', '🔥 FIRMS', firmsLabel],
                      ['magma', '🌋 MAGMA', magmaLabel],
                    ] as const
                  ).map(([key, name, current]) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={target === key}
                      onClick={() => setTarget(key)}
                      className={`px-2 py-1.5 rounded-lg text-center transition-all ${
                        target === key
                          ? 'bg-white dark:bg-slate-950 shadow-sm font-bold text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[11px]">{name}</div>
                      <div className="text-[9px] font-medium opacity-80 truncate">{current}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      onSelectDate(target, preset);
                      setIsCalendarOpen(false);
                    }}
                    className={`px-2 py-1.5 rounded-lg font-medium text-center border transition-all ${
                      selectedDate === preset
                        ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 font-bold border-transparent'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/50'
                    }`}
                  >
                    {preset.split(' ')[0]}
                  </button>
                ))}
              </div>
              {/* Custom date range */}
              <form
                className="mb-3 pt-2 border-t border-slate-100 dark:border-slate-800"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customError) return;
                  onSelectDate(target, makeCustomSelection(customFrom, customTo));
                  setIsCalendarOpen(false);
                }}
              >
                <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Rentang khusus</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="flex flex-col gap-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    Dari
                    <input
                      type="date"
                      value={customFrom}
                      min={minDay}
                      max={customTo || todayIso}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    Sampai
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom || minDay}
                      max={todayIso}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                      required
                    />
                  </label>
                </div>
                {customError ? (
                  <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-400" role="alert">
                    {customError}
                  </div>
                ) : (
                  <div className="mt-1 text-[10px] text-slate-400">
                    {limits.hint}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!!customError}
                  className="mt-2 w-full py-1.5 rounded-lg font-bold bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 disabled:opacity-40 transition-all active:scale-95"
                >
                  Terapkan
                </button>
              </form>
              <div className="text-[11px] text-slate-400 text-center py-1 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800">
                {target === 'magma'
                  ? 'Erupsi & gerakan tanah MAGMA. Laporan gerakan tanah tersedia Jun 2022 – Mei 2023.'
                  : target === 'bmkg'
                    ? 'Gempa BMKG di peta (M5+ & gempa dirasakan).'
                    : 'Titik panas NASA FIRMS.'}
              </div>
            </div>
          )}
        </div>

        {/* Today Preset Button */}
        <button
          onClick={() => {
            onSelectDate('bmkg', 'Today');
            onSelectDate('firms', 'Today');
            onSelectDate('magma', 'Today');
            setIsCalendarOpen(false);
          }}
          className={`hidden min-[400px]:inline-flex px-3 sm:px-5 py-2 rounded-full font-medium text-xs sm:text-sm transition-all shadow-xs border ${
            dates.bmkg === 'Today' && dates.firms === 'Today' && dates.magma === 'Today'
              ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 font-bold border-transparent'
              : 'bg-slate-50 dark:bg-[#0f1b38]/70 hover:bg-slate-100 dark:hover:bg-[#14234b] text-slate-800 dark:text-cyan-300 border-slate-200/80 dark:border-slate-700/70'
          }`}
        >
          Today
        </button>

        {/* Buat Laporan Action Button */}
        <button
          onClick={onOpenReportModal}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs font-bold shadow-md shadow-orange-500/25 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Laporan</span>
        </button>

        {/* Officer Avatar */}
        <div className="hidden lg:flex items-center pl-2 border-l border-slate-200 dark:border-slate-800">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdqrs-0DbJRAPUGx4dUImT0s5p4SsYS0-zoMCyPEVzpOzR2WD6Z4y19fWb2uxDzRC1COP0VkfsUr65VlRMsnW1urpviorq-VQttv9AkKcwaOmlW-guvSx1kZlXJHNDTewBxb1hGKfWPgy63fhaYTqTnHSNxTLa6t3zJvlslo81V9Qppga926cyw572oD98IWAruhDtlkuoq8ZiD9ZqypIPsCQ8vUB9vEdmnhALajbi"
            alt="Koordinator Satgas BNPB"
            className="w-9 h-9 rounded-full object-cover border border-slate-300 dark:border-cyan-500/40 shadow-xs"
          />
        </div>
      </div>
    </header>
  );
};
