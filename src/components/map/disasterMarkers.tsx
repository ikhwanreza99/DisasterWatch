// Disaster incident marker + callout design (ported from feat/homepage-slicing prototype):
// coloured circle with a white line icon per category, and a frosted-glass callout.
// Used by both map engines: React components for Google AdvancedMarker, HTML strings for Leaflet.
import React from 'react';
import { X } from 'lucide-react';
import type { DisasterIncident } from '../../types';
import { useI18n } from '../../i18n';

type Category = DisasterIncident['category'];

interface MarkerStyle {
  bg: string;
  stroke: string;
  /** Inner SVG markup (white strokes on the coloured circle). */
  svg: string;
}

const SVG_OPEN =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

export const DISASTER_MARKER_STYLE: Record<Category, MarkerStyle> = {
  landslide: { bg: '#a16207', stroke: '#facc15', svg: `${SVG_OPEN}<path d="M3 20L12 4l9 16H3zM12 9v5m0 3v1"/></svg>` },
  other: { bg: '#64748b', stroke: '#cbd5e1', svg: `${SVG_OPEN}<path d="M12 3L2 21h20L12 3zM12 9v5m0 3v1"/></svg>` },
  flood: {
    bg: '#0ea5e9',
    stroke: '#7dd3fc',
    svg: `${SVG_OPEN}<path d="M2 12c2.5 2 5 2 7.5 0s5-2 7.5 0 5 2 7 0"/><path d="M2 17c2.5 2 5 2 7.5 0s5-2 7.5 0 5 2 7 0"/></svg>`,
  },
  fire: {
    bg: '#f97316',
    stroke: '#fdba74',
    svg: `${SVG_OPEN}<path d="M12 22c4 0 7-3 7-7 0-3-2-5-4-7 0 2-1 3-2 4 0-4-2-7-5-10 0 5-3 7-3 12 0 4 3 8 7 8z"/></svg>`,
  },
  earthquake: {
    bg: '#f43f5e',
    stroke: '#fda4af',
    svg: `${SVG_OPEN}<path d="M3 20l6-10 4 6 2-3 6 7H3z"/></svg>`,
  },
};

export function markerStyleFor(category: Category): MarkerStyle {
  return DISASTER_MARKER_STYLE[category as keyof typeof DISASTER_MARKER_STYLE] ?? DISASTER_MARKER_STYLE.earthquake;
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Leaflet divIcon HTML (44×44 box centred on the point). */
export function disasterMarkerHtml(incident: DisasterIncident, isSelected: boolean): string {
  const m = markerStyleFor(incident.category);
  const size = isSelected ? 32 : 28;
  const halo = isSelected
    ? `<span style="position:absolute;width:42px;height:42px;border-radius:9999px;border:1px solid ${m.stroke};background:${m.bg}22;box-shadow:0 0 20px ${m.bg}55"></span>`
    : '';
  const label = isSelected
    ? `<span style="position:absolute;top:48px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:4px 10px;border-radius:9999px;background:rgba(2,6,23,.78);border:1px solid rgba(255,255,255,.15);color:#fff;font-size:10px;font-weight:700;backdrop-filter:blur(12px);pointer-events:none">${escHtml(incident.name.split(',')[0] ?? '')}</span>`
    : `<span class="opacity-0 group-hover:opacity-100 transition-opacity" style="position:absolute;top:40px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:3px 8px;border-radius:6px;background:rgba(2,6,23,.85);color:#fff;font-size:10px;font-weight:600;pointer-events:none">${escHtml(incident.name.split(',')[0] ?? '')}</span>`;
  return (
    `<div class="group" style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;width:44px;height:44px;transform:translate(-50%,-50%)">` +
    halo +
    `<span style="position:relative;z-index:2;width:${size}px;height:${size}px;border-radius:9999px;background:${m.bg};border:2px solid rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px ${m.bg}70;transition:transform 180ms ease">${m.svg}</span>` +
    label +
    `</div>`
  );
}

/** Google AdvancedMarker content (same look as the Leaflet HTML). */
export const DisasterMarker: React.FC<{ incident: DisasterIncident; isSelected: boolean }> = ({ incident, isSelected }) => {
  const m = markerStyleFor(incident.category);
  const size = isSelected ? 32 : 28;
  return (
    <div className="group relative flex items-center justify-center cursor-pointer" style={{ width: 44, height: 44 }}>
      {isSelected && (
        <>
          <span
            className="absolute rounded-full animate-ping opacity-30"
            style={{ width: 44, height: 44, border: `1px solid ${m.stroke}` }}
          />
          <span
            className="absolute rounded-full"
            style={{ width: 42, height: 42, border: `1px solid ${m.stroke}`, background: `${m.bg}22`, boxShadow: `0 0 20px ${m.bg}55` }}
          />
        </>
      )}
      <span
        className={`relative z-10 flex items-center justify-center rounded-full transition-transform ${isSelected ? '' : 'group-hover:scale-110'}`}
        style={{ width: size, height: size, background: m.bg, border: '2px solid rgba(255,255,255,.85)', boxShadow: `0 0 18px ${m.bg}70` }}
        dangerouslySetInnerHTML={{ __html: m.svg }}
      />
      <span
        className={`absolute whitespace-nowrap pointer-events-none text-white text-[10px] ${
          isSelected
            ? 'top-12 px-2.5 py-1 rounded-full font-bold border border-white/15 backdrop-blur-md'
            : 'top-10 px-2 py-0.5 rounded-md font-semibold opacity-0 group-hover:opacity-100 transition-opacity'
        }`}
        style={{ background: isSelected ? 'rgba(2,6,23,.78)' : 'rgba(2,6,23,.85)' }}
      >
        {incident.name.split(',')[0]}
      </span>
    </div>
  );
};

/** Frosted-glass incident callout: name + coords, province, type + urgency, time. */
export const DisasterCallout: React.FC<{
  incident: DisasterIncident;
  onClose: () => void;
  onViewDetail?: () => void;
  className?: string;
  style?: React.CSSProperties;
}> = ({ incident, onClose, onViewDetail, className = '', style }) => {
  const { t } = useI18n();
  return (
  <div
    id="activeCallout"
    role="dialog"
    aria-label={t('Info bencana {name}', { name: incident.name })}
    style={{
      ...style,
      background:
        'linear-gradient(135deg, rgba(15,35,64,.72) 0%, rgba(18,46,82,.62) 55%, rgba(11,30,55,.70) 100%)',
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      boxShadow: '0 16px 40px rgba(2,12,27,.25), inset 0 1px 0 rgba(255,255,255,.14)',
    }}
    className={`pointer-events-auto min-w-[280px] max-w-[calc(100vw-1.5rem)] rounded-2xl p-4 border border-white/20 text-white animate-fadeIn ${className}`}
    onClick={(e) => e.stopPropagation()}
  >
    {/* glass highlight */}
    <div className="pointer-events-none absolute inset-[1px] rounded-[15px] bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent" />
    <div className="relative z-10">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-bold tracking-tight leading-snug">{incident.name}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-cyan-300/90 font-mono font-medium">
            {incident.coords.lat.toFixed(2)}°, {incident.coords.lng.toFixed(2)}°
          </span>
          <button
            type="button"
            aria-label={t('Tutup popup')}
            title={t('Tutup')}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      </div>
      <div className="mt-1 text-[11px] text-slate-300/90">{incident.province}</div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-amber-300">{incident.fullName}</span>
        <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-200 border border-rose-400/35">
          {t(incident.urgency)}
        </span>
      </div>
      <div className="my-3 h-px bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-300">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.65)]" />
        <span>{incident.timestamp}</span>
      </div>
    </div>
    {onViewDetail && <button type="button" onClick={event => { event.stopPropagation(); onViewDetail(); }} className="sm:hidden relative z-10 mt-3 min-h-11 w-full rounded-xl bg-white/15 px-4 text-xs font-bold hover:bg-white/25">{t('Lihat detail')}</button>}
    {/* pointer */}
    <div
      className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-r border-b border-white/20"
      style={{ background: 'rgba(15,35,64,.70)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
    />
  </div>
  );
};
