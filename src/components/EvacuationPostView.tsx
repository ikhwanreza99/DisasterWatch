import { MobileSheetHandle } from './MobileSheetHandle';
import { recommendEvacuation } from '../services/places/recommendEvacuation';
import React, { useEffect, useRef, useState } from 'react';
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

interface EvacuationPostViewProps {
  disaster: DisasterIncident;
  onClose: () => void;
  onOpenDonationModal?: () => void;
  onOpenAIHelpdesk?: () => void;
  onViewDisasterDetail?: () => void;
  isDarkMode?: boolean;
  selectedPostId: DisasterCheckpoint['id'] | null;
  onSelectPost: (id: DisasterCheckpoint['id']) => void;
  onSuggestedPosts?: (incidentId:string,posts:DisasterCheckpoint[]) => void;
}

const getCapacityMeta = (post: DisasterCheckpoint) => {
  const used = post.capacity?.used ?? 0;
  const total = post.capacity?.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  if (!total) {
    return {
      pct: 0,
      label: 'Belum Ada Data',
      textClass: 'text-slate-500',
      dotClass: 'bg-slate-400',
      barClass: 'bg-slate-400',
    };
  }

  if (pct >= 90) {
    return {
      pct,
      label: pct >= 100 ? 'Penuh' : 'Hampir Penuh',
      textClass: 'text-rose-600',
      dotClass: 'bg-rose-500',
      barClass: 'bg-rose-500',
    };
  }

  if (pct >= 70) {
    return {
      pct,
      label: 'Padat',
      textClass: 'text-amber-600',
      dotClass: 'bg-amber-500',
      barClass: 'bg-amber-500',
    };
  }

  return {
    pct,
    label: 'Tersedia',
    textClass: 'text-emerald-600',
    dotClass: 'bg-emerald-500',
    barClass: 'bg-emerald-500',
  };
};

export const EvacuationPostView: React.FC<EvacuationPostViewProps> = ({
  disaster,
  onClose,
  selectedPostId,
  onSelectPost,
  onSuggestedPosts,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<DisasterCheckpoint['id'], HTMLElement>());
  const posts = disaster.route.checkpoints;
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [method,setMethod]=useState<'gemini'|'distance'|null>(null);
  const [anchorNote,setAnchorNote]=useState<string|null>(null);
  const [radius,setRadius]=useState(5000);
  const [retry,setRetry]=useState(0);
  const onSuggestedRef=useRef(onSuggestedPosts);
  onSuggestedRef.current=onSuggestedPosts;
  const hasReportedPosts=posts.some(p=>!p.recommendation);
  useEffect(()=>{
    let active=true;
    setError('');setMethod(null);setAnchorNote(null);
    if(hasReportedPosts){setLoading(false);return;}
    setLoading(true);
    recommendEvacuation(disaster,posts=>{if(active)onSuggestedRef.current?.(disaster.id,posts);}).then(result=>{
      if(!active)return;
      setMethod(result.method);setRadius(result.radius);setAnchorNote(result.anchorNote);
      onSuggestedRef.current?.(disaster.id,result.posts);
    }).catch(()=>{if(active)setError('Pencarian fasum belum berhasil. Periksa Places API (New), izin API key, dan koneksi.');}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[disaster.id,disaster.coords.lat,disaster.coords.lng,hasReportedPosts,retry]);

  useEffect(() => {
    const container = scrollRef.current;
    const card = selectedPostId === null ? undefined : cardRefs.current.get(selectedPostId);
    if (!container || !card) return;
    const box = container.getBoundingClientRect();
    const target = card.getBoundingClientRect();
    const offset = target.top < box.top ? target.top - box.top - 12
      : target.bottom > box.bottom ? target.bottom - box.bottom + 12 : 0;
    if (offset) container.scrollTo({
      top: container.scrollTop + offset,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [selectedPostId, disaster.id]);

  return (
    <aside
      className="mobile-sheet absolute top-0 right-0 z-30 h-full w-[430px] max-w-[95vw] overflow-hidden flex flex-col pointer-events-auto transition-all duration-300 ease-in-out bg-white/75 backdrop-blur-2xl border-l border-white/60 shadow-2xl animate-fadeIn"
      id="evacuationPostView" aria-label="Posko Bantuan"
    >
      <MobileSheetHandle />
      <div className="px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-cyan-600 flex items-center justify-center shrink-0">
              <MapPinned className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.08em]">
                Posko Bantuan
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500 font-medium truncate">
                {disaster.name} • {posts.length} {hasReportedPosts ? 'Posko' : 'Usulan fasum'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100/80 hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer border border-slate-200/70"
            title="Tutup Posko Bantuan"
            aria-label="Tutup Posko Bantuan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
      {!hasReportedPosts && <div className="mx-5 mb-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-[11px] leading-relaxed text-amber-900">
        <strong>Usulan lokasi posko</strong>
        <p>Fasum terdekat dari koordinat laporan. Belum ditetapkan sebagai posko aktif; kapasitas dan keamanan perlu pemeriksaan BPBD.</p>
        {anchorNote && <p className="mt-2 font-semibold">{anchorNote}</p>}
        {method && <p className="mt-1">{method==='gemini'?'Urutan dibantu Gemini':'Urutan berdasarkan jarak; Gemini belum tersedia'} · radius {radius/1000} km · jarak garis lurus.</p>}
      </div>}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">
        {loading && <p role="status" className="mb-3 rounded-xl bg-cyan-50 p-3 text-xs text-cyan-800">Mencari fasum terdekat dan meminta pertimbangan Gemini…</p>}
        {error && <div role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}<button className="mt-2 block font-bold underline" onClick={()=>setRetry(v=>v+1)}>Coba lagi</button></div>}
        {!loading && !error && posts.length===0 && <p role="status" className="text-xs text-slate-500">Belum ditemukan fasum yang sesuai dalam radius 15 km. Periksa koordinat laporan atau cari lokasi melalui BPBD setempat.</p>}
        <div className="space-y-3">
          {posts.map((post, idx) => {
            const isSelected = selectedPostId === post.id;
            const capacity = getCapacityMeta(post);
            // Temporary presentation adapter for the legacy route data.
            const rawName = (post.name ?? post.title ?? '').replace(/^(?:Titik Awal|Titik Akhir|Checkpoint\s*\d*)\s*:\s*/i, '').trim();
            const postName = post.recommendation ? rawName : /^posko\b/i.test(rawName) ? rawName
              : `Posko ${rawName.replace(/^(?:Jalur Poros|Pos Aju|Desa)\s*/i, '') || idx + 1}`;
            const location = post.location ?? 'Lokasi belum tersedia';
            const description = post.subtitle;
            const supplies = post.aid ?? [];
            const mapsUrl =
              post.googleMapsUrl ??
              (typeof post.lat === 'number' && typeof post.lng === 'number'
                ? `https://www.google.com/maps/search/?api=1&query=${post.lat},${post.lng}`
                : undefined);

            return (
              <section
                key={post.id}
                ref={(node) => { if (node) cardRefs.current.set(post.id, node); else cardRefs.current.delete(post.id); }}
                onClick={() => onSelectPost(post.id)}
                className={`p-4 rounded-2xl border shadow-sm transition-all duration-200 cursor-pointer ${
                  isSelected ? 'bg-cyan-50/85 border-cyan-400 ring-1 ring-cyan-300/60 shadow-md'
                    : 'bg-white/65 border-slate-200/70 hover:bg-white/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-cyan-400 text-white flex items-center justify-center text-[11px] font-black shrink-0 shadow-sm">
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4>
                          <button type="button" onClick={(event) => { event.stopPropagation(); onSelectPost(post.id); }}
                            aria-pressed={isSelected}
                            className="text-left text-xs font-bold text-slate-900 leading-snug rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                            {postName}
                          </button>
                        </h4>
                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                          {location}
                        </p>
                      </div>

                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white/70 text-slate-500 hover:text-cyan-600 hover:border-cyan-400/40 hover:bg-cyan-500/10 flex items-center justify-center shrink-0 transition-all"
                          title={`Buka ${postName} di Google Maps`}
                          aria-label={`Buka ${postName} di Google Maps`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {post.recommendation && <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]"><span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">Usulan · {post.facilityType}</span><span className="rounded-full bg-cyan-50 px-2 py-1 text-cyan-700">{((post.distanceMeters??0)/1000).toFixed(1)} km dari lokasi acuan</span><span className="text-slate-500">Sumber: Google Maps</span></div>}
                    {description && <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{description}</p>}
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                          <Users className="w-3 h-3" />
                          Kapasitas
                        </div>
                        {post.capacity && (
                          <span className="text-[10px] font-semibold text-slate-600 tabular-nums">
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

                      <div className="h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
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
                              <span className="text-slate-600 truncate">
                                {item.name}
                              </span>
                              <span className="font-semibold text-slate-800 whitespace-nowrap">
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
                      <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center gap-1.5 text-[9px] font-semibold text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" />
                        {post.recommendation ? 'Usulan fasum dipilih di peta' : 'Posko dipilih di peta'}
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
