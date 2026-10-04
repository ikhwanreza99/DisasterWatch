import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Radio } from 'lucide-react';
import type { DisasterIncident } from '../types';

// The current incident feed uses Indonesian relative-time labels.
export function incidentAge(timestamp: string): number {
  const relative = timestamp.match(/(\d+)\s*(menit|jam|hari)/i);
  if (relative) return Number(relative[1]) * ({ menit: 1, jam: 60, hari: 1440 }[relative[2].toLowerCase()] ?? 1);
  if (/kemarin/i.test(timestamp)) return 1440;
  if (/baru saja|hari ini/i.test(timestamp)) return 0;
  return Number.POSITIVE_INFINITY;
}

interface DisasterTickerProps {
  disasters: Record<string, DisasterIncident>;
  onHighlight: (id: string | null) => void;
}

export function DisasterTicker({ disasters, onHighlight }: DisasterTickerProps) {
  const items = useMemo(() => Object.values(disasters).sort((a, b) => {
    const age = incidentAge(a.timestamp) - incidentAge(b.timestamp);
    if (age) return age;
    const clock = (text: string) => {
      const match = text.match(/(\d{2}):(\d{2})/);
      return match ? Number(match[1]) * 60 + Number(match[2]) - (/WIT\b/.test(text) ? 120 : /WITA/.test(text) ? 60 : 0) : 0;
    };
    return clock(b.timestamp) - clock(a.timestamp);
  }), [disasters]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const item = items[index % items.length];
  const stopped = paused || hovered;
  const duration = item ? Math.max(16, (item.fullName.length + item.name.length + item.timestamp.length) / 6) : 16;

  useEffect(() => {
    onHighlight(item?.id ?? null);
    return () => onHighlight(null);
  }, [item?.id, onHighlight]);

  useEffect(() => {
    if (stopped || items.length < 2) return;
    const timer = window.setTimeout(() => setIndex((value) => value + 1), duration * 1000);
    return () => window.clearTimeout(timer);
  }, [index, stopped, items.length, duration]);

  if (!item) return null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-slate-700"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      aria-label="Berita bencana terbaru">
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold tracking-wide text-orange-600">
        <Radio className="h-3.5 w-3.5" aria-hidden="true" /> TERKINI
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div key={item.id} className="disaster-news-track text-xs font-semibold"
          style={{ animationDuration: `${duration}s`, animationPlayState: stopped ? 'paused' : 'running' }}>
          {item.fullName} — {item.name}, {item.province} • {item.timestamp} • {item.urgency}
        </div>
      </div>
      <button type="button" onClick={() => setPaused(value => !value)}
        className="shrink-0 rounded-full p-1 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-orange-500"
        aria-label={paused ? 'Lanjutkan berita berjalan' : 'Jeda berita berjalan'} aria-pressed={paused}>
        {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
