import React from 'react';
import { Flame, Waves, Activity, LayoutGrid } from 'lucide-react';
import { DisasterCategory } from '../types';

interface CategoryFilterBarProps {
  activeCategory: DisasterCategory | 'all';
  onSelectCategory: (cat: DisasterCategory | 'all') => void;
  isDarkMode: boolean;
}

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  activeCategory,
  onSelectCategory,
  isDarkMode,
}) => {
  return (
    <div
      className="absolute left-6 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2.5 p-2 bg-white/95 dark:bg-[#0b1329]/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-700/70 shadow-xl pointer-events-auto select-none transition-colors duration-300"
      data-purpose="category-filter-bar"
    >
      {/* All */}
      <button
        onClick={() => onSelectCategory('all')}
        className={`cat-filter-btn group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xs ${
          activeCategory === 'all'
            ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 font-bold shadow-md'
            : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/50'
        }`}
        title="Semua Bencana"
      >
        <LayoutGrid className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="absolute left-16 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-md z-30">
          Semua Bencana
        </span>
      </button>

      {/* Fire */}
      <button
        onClick={() => onSelectCategory('fire')}
        className={`cat-filter-btn group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xs ${
          activeCategory === 'fire'
            ? 'bg-amber-500 text-white shadow-lg shadow-orange-500/30 ring-2 ring-amber-400'
            : 'bg-slate-50 hover:bg-orange-50 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 hover:text-orange-500 dark:text-slate-300 dark:hover:text-amber-400 border border-slate-200/80 dark:border-slate-700/50'
        }`}
        title="Kebakaran Hutan & Lahan"
      >
        <Flame className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="absolute left-16 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-md z-30">
          Kebakaran Hutan & Lahan
        </span>
      </button>

      {/* Flood */}
      <button
        onClick={() => onSelectCategory('flood')}
        className={`cat-filter-btn group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xs ${
          activeCategory === 'flood'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400'
            : 'bg-slate-50 hover:bg-blue-50 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 hover:text-blue-500 dark:text-slate-300 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-700/50'
        }`}
        title="Banjir & Genangan"
      >
        <Waves className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="absolute left-16 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-md z-30">
          Banjir & Cuaca Ekstrem
        </span>
      </button>

      {/* Earthquake */}
      <button
        onClick={() => onSelectCategory('earthquake')}
        className={`cat-filter-btn group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xs ${
          activeCategory === 'earthquake'
            ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400'
            : 'bg-slate-50 hover:bg-rose-50 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 hover:text-rose-500 dark:text-slate-300 dark:hover:text-rose-400 border border-slate-200/80 dark:border-slate-700/50'
        }`}
        title="Gempa Bumi & Geologi"
      >
        <Activity className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="absolute left-16 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-md z-30">
          Gempa Bumi & Keretakan
        </span>
      </button>
    </div>
  );
};
