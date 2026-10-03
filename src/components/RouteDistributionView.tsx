import React, { useState } from 'react';
import {
  X,
  MapPinned,
  ExternalLink,
  Users,
  Package,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { DisasterIncident, DisasterCheckpoint } from '../types';

interface RouteDistributionViewProps {
  disaster: DisasterIncident;
  onClose: () => void;
  onOpenDonationModal?: () => void;
  onOpenAIHelpdesk?: () => void;
  onViewDisasterDetail?: () => void;
  isDarkMode?: boolean;
}

const getCapacityMeta = (post: DisasterCheckpoint) => {
  const used = post.capacity?.used ?? 0;
  const total = post.capacity?.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  if (!total) {
    return {
      pct: 0,
      label: 'Belum Ada Data',
      textClass: 'text-slate-500 dark:text-slate-400',
      dotClass: 'bg-slate-400',
      barClass: 'bg-slate-400',
    };
  }

  if (pct >= 90) {
    return {
      pct,
      label: 'Hampir Penuh',
      textClass: 'text-rose-600 dark:text-rose-400',
      dotClass: 'bg-rose-500',
      barClass: 'bg-rose-500',
    };
  }

  if (pct >= 70) {
    return {
      pct,
      label: 'Padat',
      textClass: 'text-amber-600 dark:text-amber-400',
      dotClass: 'bg-amber-500',
      barClass: 'bg-amber-500',
    };
  }

  return {
    pct,
    label: 'Tersedia',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    barClass: 'bg-emerald-500',
  };
};

export const RouteDistributionView: React.FC<RouteDistributionViewProps> = ({
  disaster,
  onClose,
}) => {
  const [activePost, setActivePost] = useState<number | null>(null);
  const posts = disaster.route.checkpoints;

  return (
    <aside
      className="absolute top-0 right-0 z-30 h-full w-[430px] max-w-[95vw] overflow-y-auto pointer-events-auto transition-all duration-300 ease-in-out bg-white/90 dark:bg-[#0b1329]/88 backdrop-blur-2xl border-l border-slate-200/80 dark:border-white/10 shadow-2xl animate-fadeIn"
      id="routeDistributionStandaloneView"
    >
      <div className="px-5 py-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-cyan-600 dark:text-cyan-300 flex items-center justify-center shrink-0">
              <MapPinned className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.08em]">
                Posko Bantuan
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                {disaster.name} • {posts.length} Posko Aktif
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100/80 dark:bg-white/[0.06] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer border border-slate-200/70 dark:border-white/10"
            title="Tutup Posko Bantuan"
            aria-label="Tutup Posko Bantuan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-200/80 dark:divide-white/10">
          {posts.map((post, idx) => {
            const isSelected = activePost === post.id;
            const capacity = getCapacityMeta(post);
            const postName = post.name ?? post.title ?? `Posko ${idx + 1}`;
            const location = post.location ?? post.subtitle ?? 'Lokasi posko';
            const supplies = post.aid ?? [];
            const mapsUrl =
              post.googleMapsUrl ??
              (typeof post.lat === 'number' && typeof post.lng === 'number'
                ? `https://www.google.com/maps/search/?api=1&query=${post.lat},${post.lng}`
                : undefined);

            return (
              <section
                key={post.id}
                onClick={() => setActivePost(isSelected ? null : post.id)}
                className={`py-5 transition-colors cursor-pointer ${
                  isSelected ? 'bg-cyan-500/[0.04]' : ''
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-cyan-500/15 border-2 border-cyan-400 text-white dark:text-cyan-300 flex items-center justify-center text-[11px] font-black shrink-0 shadow-sm">
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                          {postName}
                        </h4>
                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {location}
                        </p>
                      </div>

                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-500/10 flex items-center justify-center shrink-0 transition-all"
                          title={`Buka ${postName} di Google Maps`}
                          aria-label={`Buka ${postName} di Google Maps`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                          <Users className="w-3 h-3" />
                          Kapasitas
                        </div>
                        {post.capacity && (
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                            {post.capacity.used} / {post.capacity.total}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${capacity.textClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${capacity.dotClass}`} />
                          {post.capacityStatus ?? capacity.label}
                        </span>
                        {post.capacity && (
                          <span className="text-[9px] text-slate-400">{capacity.pct}% terisi</span>
                        )}
                      </div>

                      <div className="h-1.5 rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${capacity.barClass}`}
                          style={{ width: `${capacity.pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center gap-1.5 mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        <Package className="w-3 h-3" />
                        Bantuan
                      </div>

                      {supplies.length > 0 ? (
                        <div className="space-y-2">
                          {supplies.map((item, supplyIndex) => (
                            <div
                              key={`${post.id}-${item.name}-${supplyIndex}`}
                              className="flex items-center justify-between gap-4 text-[10px]"
                            >
                              <span className="text-slate-600 dark:text-slate-300 truncate">
                                {item.name}
                              </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <AlertTriangle className="w-3 h-3" />
                          Data bantuan belum tersedia
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-white/10 flex items-center gap-1.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Data posko aktif dan terpantau
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
