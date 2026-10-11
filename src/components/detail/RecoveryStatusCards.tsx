// Shared recovery-status cards (same visual language as the Cianjur screen).
import React from 'react';
import { Droplets, Zap, Navigation, Radio } from 'lucide-react';
import type { DisasterIncident } from '../../types';

const CONFIG = {
  water: { label: 'Air & Sanitasi', icon: Droplets, accent: 'text-cyan-600', iconBg: 'bg-cyan-50', iconBorder: 'border-cyan-200', progress: 'bg-cyan-500' },
  electricity: { label: 'Listrik', icon: Zap, accent: 'text-amber-600', iconBg: 'bg-amber-50', iconBorder: 'border-amber-200', progress: 'bg-amber-500' },
  access: { label: 'Akses', icon: Navigation, accent: 'text-orange-600', iconBg: 'bg-orange-50', iconBorder: 'border-orange-200', progress: 'bg-orange-500' },
  telecommunication: { label: 'Telekomunikasi', icon: Radio, accent: 'text-violet-600', iconBg: 'bg-violet-50', iconBorder: 'border-violet-200', progress: 'bg-violet-500' },
} as const;

function badge(status: string): string {
  switch (status) {
    case 'Terganggu': return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'Dalam Pemulihan': return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'Hampir Pulih': case 'Pulih': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    default: return 'text-slate-700 bg-slate-50 border-slate-200';
  }
}

export const RecoveryStatusCards: React.FC<{ services: DisasterIncident['recoveryServices'] }> = ({ services }) => {
  if (!services || services.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-[11px] text-slate-500" data-testid="recovery-empty">
        Belum ada data status pemulihan layanan dari sumber yang tersedia.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5" data-testid="recovery-cards">
      {services.map((service) => {
        const config = CONFIG[service.type];
        const Icon = config.icon;
        return (
          <div key={service.type} className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className={`w-8 h-8 rounded-xl border ${config.iconBg} ${config.iconBorder} ${config.accent} flex items-center justify-center shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-slate-900 leading-none">{service.recovery}%</span>
            </div>
            <div className="min-w-0 mb-2.5">
              <span className="text-[14px] font-bold text-slate-900 block break-words">{config.label}</span>
              <span className="text-[9px] text-slate-400 font-medium">Status Recovery</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mb-2.5">
              <div className={`h-full rounded-full ${config.progress} transition-all duration-500`} style={{ width: `${service.recovery}%` }} />
            </div>
            <span className={`inline-flex items-center text-[9px] font-bold px-2 py-1 rounded-md border ${badge(service.status)}`}>
              {service.status}
            </span>
          </div>
        );
      })}
    </div>
  );
};
