// "Kebutuhan Paling Urgent" card (design from feat/homepage-slicing).
// Shared by the mini sidebar and the expanded disaster detail.
import React from 'react';
import { Droplets, HeartHandshake, Package, Pill, Shield } from 'lucide-react';
import type { DisasterIncident } from '../types';

interface Props {
  disaster: DisasterIncident;
  onOpenDonationModal: () => void;
  className?: string;
}

export const UrgentNeedsCard: React.FC<Props> = ({ disaster, onOpenDonationModal, className = '' }) => (
  <article
    className={`bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col transition-all hover:shadow-md ${className}`}
    data-purpose="urgent-needs"
  >
    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3.5 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping"></span>
        <h4 className="text-xs font-bold text-slate-900 tracking-tight uppercase">Kebutuhan Paling Urgent</h4>
      </div>
      <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          <span>Urgensi Tinggi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          <span>Urgensi Rendah</span>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2.5 mb-4">
      {(disaster.supplies ?? []).map((item) => {
        const isHigh = item.urgency === 'Urgensi Tinggi';
        return (
          <div
            key={item.code ?? item.name}
            className="p-3 bg-slate-50/90 rounded-2xl border border-slate-100 flex items-center gap-3 min-w-0"
          >
            <div
              className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border ${
                isHigh ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-orange-50 border-orange-200 text-orange-600'
              }`}
            >
              {item.name.toLowerCase().includes('masker') ? (
                <Shield className="w-4 h-4" />
              ) : item.name.toLowerCase().includes('air') ? (
                <Droplets className="w-4 h-4" />
              ) : item.name.toLowerCase().includes('obat') ? (
                <Pill className="w-4 h-4" />
              ) : (
                <Package className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 leading-tight truncate">{item.name}</div>
              <span className="text-[10px] text-slate-400 font-medium block truncate">{item.subtitle}</span>
            </div>
          </div>
        );
      })}
    </div>

    <button
      type="button"
      onClick={onOpenDonationModal}
      className="w-full py-3 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
    >
      <HeartHandshake className="w-4 h-4 text-white" />
      <span>Salurkan Bantuan / Donasi</span>
    </button>
  </article>
);
