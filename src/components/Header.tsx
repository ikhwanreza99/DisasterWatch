import React, { useState } from 'react';
import { DisasterTicker } from './DisasterTicker';
import type { DisasterIncident } from '../types';
import { Calendar, ChevronDown } from 'lucide-react';

interface HeaderProps {
  disasters: Record<string, DisasterIncident>;
  onHighlightDisaster: (id: string | null) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenReportModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  disasters,
  onHighlightDisaster,
  selectedDate,
  onSelectDate,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const presets = [
    'Today',
    '7 Hari Terakhir',
    '30 Hari Terakhir',
  ];

  return (
    <header
      className="
        relative z-40
        flex flex-wrap items-center justify-between gap-4
        px-8 py-4

        bg-white
        border-b border-slate-200/70
      "
    >
      {/* Brand */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-slate-900">
            DisasterWatch
          </h1>

          <span
            className="
              px-2.5 py-1
              rounded-full
              bg-slate-100
              border border-slate-200
              text-[11px] font-semibold
              text-slate-500
            "
          >
            ver.1.0
          </span>
        </div>
      </div>

      <div className="order-last w-full min-w-0 md:order-none md:w-auto md:flex-1 md:px-4">
        <DisasterTicker disasters={disasters} onHighlight={onHighlightDisaster} />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Date Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCalendarOpen((prev) => !prev)}
            className="
              flex items-center gap-3
              px-5 py-2
              rounded-full
              bg-white
              border border-slate-200
              text-sm font-semibold
              text-slate-600
              shadow-sm
              hover:bg-slate-50
              transition-colors
            "
          >
            <Calendar className="w-4 h-4 text-slate-500" />

            <span>{selectedDate}</span>

            <ChevronDown
              className={`
                w-4 h-4
                text-slate-400
                transition-transform
                ${isCalendarOpen ? 'rotate-180' : ''}
              `}
            />
          </button>

          {/* Dropdown */}
          {isCalendarOpen && (
            <div
              className="
                absolute right-0 top-full mt-2
                w-52
                rounded-2xl
                border border-slate-200
                bg-white
                p-2
                shadow-xl
              "
            >
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    onSelectDate(preset);
                    setIsCalendarOpen(false);
                  }}
                  className={`
                    w-full
                    px-3 py-2.5
                    rounded-xl
                    text-left
                    text-sm
                    transition-colors
                    ${
                      selectedDate === preset
                        ? 'bg-slate-100 font-semibold text-slate-900'
                        : 'text-slate-600 hover:bg-slate-50'
                    }
                  `}
                >
                  {preset}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Today Shortcut */}
        <button
          type="button"
          onClick={() => {
            onSelectDate('Today');
            setIsCalendarOpen(false);
          }}
          className="
            px-6 py-2
            rounded-full
            bg-white
            border border-slate-200
            text-sm font-semibold
            text-slate-700
            shadow-sm
            hover:bg-slate-50
            transition-colors
          "
        >
          Today
        </button>
      </div>
    </header>
  );
};