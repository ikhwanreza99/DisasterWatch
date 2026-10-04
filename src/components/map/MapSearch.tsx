// "Cari area" button + popover with Google Places autocomplete (Indonesia-biased).
// The popover is portalled into the app container (same reason as the Layer panel: the map
// toggle row scrolls horizontally and iOS clips children of scrolling containers).
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import {
  autocompletePlaces,
  getPlace,
  newSessionToken,
  type PlaceResult,
  type PlaceSuggestion,
} from '../../services/places/placeSearch';

interface Props {
  onSelect: (place: PlaceResult) => void;
}

export const MapSearch: React.FC<Props> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useRef(newSessionToken());
  const inputRef = useRef<HTMLInputElement>(null);

  const host =
    typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>('[data-purpose="app-container"]') ?? document.body
      : null;

  // Debounced autocomplete
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      autocompletePlaces(q, session.current, ctrl.signal)
        .then((list) => {
          setItems(list);
          setActive(0);
          setError(list.length ? null : 'Tidak ada hasil');
        })
        .catch((e: unknown) => {
          if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Pencarian gagal');
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const toggle = (anchor: HTMLElement) => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = anchor.getBoundingClientRect();
    const width = window.innerWidth < 640 ? window.innerWidth - 24 : 340;
    setPos({ top: Math.round(r.bottom + 8), left: Math.round(Math.max(12, Math.min(r.left, window.innerWidth - width - 12))) });
    setOpen(true);
  };

  const choose = async (s: PlaceSuggestion | undefined) => {
    if (!s) return;
    setLoading(true);
    setError(null);
    try {
      const place = await getPlace(s.placeId, session.current);
      session.current = newSessionToken(); // session ends with a details call
      onSelect(place);
      setOpen(false);
      setQuery(place.name || s.primary);
      setItems([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat lokasi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => toggle(e.currentTarget)}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-purpose="map-search-button"
        title="Cari area / lokasi di peta"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border shadow-md cursor-pointer transition-all active:scale-95 ${
          open
            ? 'bg-slate-900 text-white border-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-400'
            : 'bg-white/95 dark:bg-[#0b1329]/95 text-slate-800 dark:text-slate-100 border-slate-200/90 dark:border-slate-700/80'
        }`}
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Cari area</span>
      </button>
      {open &&
        host &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Tutup pencarian"
              className="fixed inset-0 z-40 cursor-default bg-transparent"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-label="Cari area"
              data-purpose="map-search-panel"
              style={pos ? { top: pos.top, left: pos.left } : undefined}
              className="fixed z-50 w-[calc(100vw-1.5rem)] sm:w-[340px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1329] shadow-2xl p-2 animate-fadeIn"
            >
              <form
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80"
                onSubmit={(e) => {
                  e.preventDefault();
                  void choose(items[active]);
                }}
              >
                <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActive((i) => Math.min(i + 1, items.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActive((i) => Math.max(i - 1, 0));
                    } else if (e.key === 'Escape') {
                      setOpen(false);
                    }
                  }}
                  placeholder="Cari kota, kecamatan, tempat…"
                  aria-label="Cari area"
                  aria-autocomplete="list"
                  aria-controls="map-search-results"
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                />
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" aria-label="Memuat" />
                ) : query ? (
                  <button
                    type="button"
                    aria-label="Hapus"
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </form>
              {items.length > 0 && (
                <ul id="map-search-results" role="listbox" className="mt-1 max-h-[50vh] overflow-y-auto">
                  {items.map((s, i) => (
                    <li key={s.placeId} role="option" aria-selected={i === active}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => void choose(s)}
                        className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-xl text-left ${
                          i === active ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <MapPin className="w-4 h-4 mt-0.5 text-rose-500 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{s.primary}</span>
                          {s.secondary && (
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">{s.secondary}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {error && <div className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">{error}</div>}
              <div className="px-2.5 pt-1 text-[9px] text-slate-400">Powered by Google Places</div>
            </div>
          </>,
          host,
        )}
    </div>
  );
};
