// Thin wrapper: renders Leaflet MapCanvas by default.
// Google branch renders a clearly-labeled placeholder that still exposes the same callbacks,
// so App never crashes when a Maps key is present but @googlemaps libs are not installed.
import React from 'react';
import { MapCanvas } from '../MapCanvas';
import type { DisasterCategory, DisasterIncident } from '../../types';
import { resolveMapProvider } from './mapTypes';

type Props = React.ComponentProps<typeof MapCanvas> & {
  providerOverride?: 'leaflet' | 'google';
};

export const MapProvider: React.FC<Props> = (props) => {
  const kind = props.providerOverride ?? resolveMapProvider();
  if (kind === 'leaflet') {
    return <MapCanvas {...props} />;
  }
  return (
    <section className="col-span-12 h-full overflow-hidden flex flex-col relative bg-slate-900 select-none" data-purpose="map-viewport-google-stub">
      <div className="p-6 text-white text-xs">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 mb-3">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold">Google Maps provider terdeteksi (stub) — fallback ke Leaflet agar demo stabil</span>
        </div>
        <p className="text-slate-300 max-w-lg leading-relaxed">
          Kunci <code>VITE_GOOGLE_MAPS_API_KEY</code> ditemukan, tetapi implementasi Google Maps penuh belum diaktifkan
          agar tidak merusak UI. Peta Leaflet tetap dirender di bawah sebagai fallback kompetisi yang andal.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <MapCanvas {...props} />
      </div>
    </section>
  );
};

export type { DisasterCategory, DisasterIncident };
