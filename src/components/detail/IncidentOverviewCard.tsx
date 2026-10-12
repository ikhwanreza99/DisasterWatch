import { BnpbImpactCard } from './BnpbImpactCard';
// Shared incident overview card (header hierarchy, status badge, impact/recovery, photo, posko action).
// Same layout for every incident — only data changes.
import React from 'react';
import { Compass, Share2, Flame, Waves, Activity, Newspaper, TriangleAlert } from 'lucide-react';
import type { DisasterIncident } from '../../types';
import type { IncidentDetailData } from '../../domain/incidentDetail';

function CategoryIcon({ category }: { category: DisasterIncident['category'] }) {
  if (category === 'fire') return <Flame className="w-6 h-6 text-white" />;
  if (category === 'flood') return <Waves className="w-6 h-6 text-white" />;
  if (category === 'other' || category === 'landslide') return <TriangleAlert className="w-6 h-6 text-white" />;
  return <Activity className="w-6 h-6 text-white" />;
}

function gradient(category: DisasterIncident['category']): string {
  if (category === 'fire') return 'from-amber-500 to-orange-500 shadow-orange-500/20';
  if (category === 'flood') return 'from-blue-500 to-cyan-500 shadow-blue-500/20';
  return 'from-rose-500 to-red-500 shadow-rose-500/20';
}

interface Props {
  disaster: DisasterIncident;
  detail: IncidentDetailData;
  onOpenRoute: () => void;
  onOpenBrief?: () => void;
}

export const IncidentOverviewCard: React.FC<Props> = ({ disaster, detail, onOpenRoute, onOpenBrief }) => {
  const share = () => {
    if (navigator.share) {
      navigator.share({
        title: `DisasterWatch: ${disaster.name}`,
        text: `Status ${disaster.urgency}: ${disaster.fullTitleDisplay} di ${disaster.name}.`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Tautan pantauan bencana berhasil disalin ke clipboard!');
    }
  };
  return (
    <article className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow" data-testid="incident-overview">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            STATUS {disaster.urgency.toUpperCase()}
          </span>

        </div>
        {onOpenBrief && (
          <button
            onClick={onOpenBrief}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 flex items-center justify-center transition-all text-xs shrink-0"
            title="Detail Teknis Satgas"
          >
            i
          </button>
        )}
      </div>

      <div className="flex items-start gap-3.5 mb-4">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${gradient(disaster.category)} shadow-md flex items-center justify-center p-3 transition-all shrink-0`}>
          <CategoryIcon category={disaster.category} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-bold text-slate-900 leading-snug break-words whitespace-normal">
            {disaster.name}, {disaster.province}
          </h3>
          <p className="text-xs font-semibold text-slate-500 mt-1">{disaster.fullTitleDisplay}</p>
        </div>
      </div>

      <BnpbImpactCard incidentId={disaster.id} />

      {disaster.photoUrl ? (
        <div className="mb-4 relative rounded-xl overflow-hidden border border-slate-200/80 shadow-inner group">
          <img src={disaster.photoUrl} alt={disaster.photoAlt} className="w-full h-36 object-cover transform hover:scale-105 transition-transform duration-500" />
          <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] text-white flex items-center gap-1.5 border border-white/10">
            <Newspaper className="w-3 h-3 text-amber-400" />
            <span>Sumber: {disaster.photoSource}</span>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-slate-200 p-3 text-[11px] text-slate-400">
          Belum ada foto lapangan terverifikasi. {disaster.photoSource ? `Atribusi: ${disaster.photoSource}.` : ''}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={onOpenRoute} className="flex-1 min-h-11 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
          <Compass className="w-4 h-4 text-white" aria-hidden="true" />
          <span>Lihat Posko Evakuasi</span>
        </button>
        <button onClick={share} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center border border-slate-200/80 transition-all shrink-0" title="Bagikan Titik Lokasi">
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
};
