import React, { useState } from 'react';
import { Flame, Waves, Activity, LayoutGrid, ListFilter, X } from 'lucide-react';
import { CategoryFilter, DisasterCategory } from '../types';

interface CategoryFilterBarProps {
  mobile?: boolean;
  activeCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
  isDarkMode: boolean;
}

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  mobile = false,
  activeCategory,
  onSelectCategory,
  isDarkMode,
}) => {
  const [open, setOpen] = useState(false);
  if (mobile) {
    const choices = [
      { id: 'all', label: 'Semua', Icon: LayoutGrid },
      { id: 'fire', label: 'Api', Icon: Flame },
      { id: 'flood', label: 'Banjir', Icon: Waves },
      { id: 'earthquake', label: 'Gempa', Icon: Activity },
    ] as const;
    return <div className="mobile-filter-menu sm:hidden">
      {open && <div id="mobile-disaster-options" className="mobile-filter-options" role="group" aria-label="Jenis bencana">
        {choices.map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={activeCategory === id}
          onClick={() => onSelectCategory(id)} className={activeCategory === id ? 'selected' : ''}>
          <Icon size={17} aria-hidden="true" /><span>{label}</span>
        </button>)}
      </div>}
      <button type="button" className="mobile-filter-toggle" aria-label={open ? 'Tutup filter bencana' : 'Buka filter bencana'}
        aria-expanded={open} aria-controls="mobile-disaster-options" onClick={() => setOpen(value => !value)}>
        {open ? <X size={20} /> : <ListFilter size={20} />}
      </button>
    </div>;
  }
  return (
    <div
      className={`${mobile ? 'mobile-category-dock sm:hidden' : 'hidden sm:flex'} absolute left-3 sm:left-6 top-[3.75rem] sm:top-16 z-30 flex flex-row sm:flex-col [@media(max-height:560px)]:flex-row gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 bg-white/95 dark:bg-[#0b1329]/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-xl pointer-events-auto select-none transition-colors duration-300`}
      data-purpose="category-filter-bar"
    >
      {/* All */}
      <button
        onClick={() => onSelectCategory('all')}
        aria-pressed={activeCategory === 'all'}
        className={`cat-filter-btn group relative w-11 h-11 rounded-xl flex flex-col sm:flex-row items-center justify-center transition-all active:scale-95 shadow-xs ${
          activeCategory === 'all'
            ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 font-bold shadow-md'
            : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/50'
        }`}
        title="Tampilkan semua bencana"
      >
        <LayoutGrid className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="text-[9px] leading-tight sm:absolute sm:left-16 sm:px-2.5 sm:py-1 sm:rounded-md sm:bg-slate-900 sm:text-white sm:text-[11px] font-medium whitespace-nowrap sm:opacity-0 pointer-events-none sm:group-hover:opacity-100 transition-opacity sm:shadow-md z-30">
          <span className="sm:hidden">Semua</span><span className="hidden sm:inline">Semua Bencana</span>
        </span>
      </button>

      {/* Fire */}
      <button
        onClick={() => onSelectCategory('fire')}
        className={`cat-filter-btn group relative w-11 h-11 rounded-xl flex flex-col sm:flex-row items-center justify-center transition-all active:scale-95 shadow-xs ${
          activeCategory === 'fire'
            ? 'bg-amber-500 text-white shadow-lg shadow-orange-500/30 ring-2 ring-amber-400'
            : 'bg-slate-50 hover:bg-orange-50 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 hover:text-orange-500 dark:text-slate-300 dark:hover:text-amber-400 border border-slate-200/80 dark:border-slate-700/50'
        }`}
        title="Kebakaran Hutan & Lahan"
      >
        <Flame className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="text-[9px] leading-tight sm:absolute sm:left-16 sm:px-2.5 sm:py-1 sm:rounded-md sm:bg-slate-900 sm:text-white sm:text-[11px] font-medium whitespace-nowrap sm:opacity-0 pointer-events-none sm:group-hover:opacity-100 transition-opacity sm:shadow-md z-30">
          <span className="sm:hidden">Api</span><span className="hidden sm:inline">Kebakaran Hutan & Lahan</span>
        </span>
      </button>

      {/* Flood */}
      <button
        onClick={() => onSelectCategory('flood')}
        className={`cat-filter-btn group relative w-11 h-11 rounded-xl flex flex-col sm:flex-row items-center justify-center transition-all active:scale-95 shadow-xs ${
          activeCategory === 'flood'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400'
            : 'bg-slate-50 hover:bg-blue-50 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 hover:text-blue-500 dark:text-slate-300 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-700/50'
        }`}
        title="Banjir & Genangan"
      >
        <Waves className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="text-[9px] leading-tight sm:absolute sm:left-16 sm:px-2.5 sm:py-1 sm:rounded-md sm:bg-slate-900 sm:text-white sm:text-[11px] font-medium whitespace-nowrap sm:opacity-0 pointer-events-none sm:group-hover:opacity-100 transition-opacity sm:shadow-md z-30">
          <span className="sm:hidden">Banjir</span><span className="hidden sm:inline">Banjir & Cuaca Ekstrem</span>
        </span>
      </button>

      {/* Earthquake */}
      <button
        onClick={() => onSelectCategory('earthquake')}
        className={`cat-filter-btn group relative w-11 h-11 rounded-xl flex flex-col sm:flex-row items-center justify-center transition-all active:scale-95 shadow-xs ${
          activeCategory === 'earthquake'
            ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400'
            : 'bg-slate-50 hover:bg-rose-50 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 hover:text-rose-500 dark:text-slate-300 dark:hover:text-rose-400 border border-slate-200/80 dark:border-slate-700/50'
        }`}
        title="Gempa Bumi & Geologi"
      >
        <Activity className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="text-[9px] leading-tight sm:absolute sm:left-16 sm:px-2.5 sm:py-1 sm:rounded-md sm:bg-slate-900 sm:text-white sm:text-[11px] font-medium whitespace-nowrap sm:opacity-0 pointer-events-none sm:group-hover:opacity-100 transition-opacity sm:shadow-md z-30">
          <span className="sm:hidden">Gempa</span><span className="hidden sm:inline">Gempa Bumi & Keretakan</span>
        </span>
      </button>
    </div>
  );
};
