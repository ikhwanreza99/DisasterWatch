import { FloodAreas } from './map/FloodAreas';
import { activeFloodAreas, areaPaths, areaColor, type FloodArea } from '../services/flood/areas';
import { apiLayerVisibility } from '../domain/apiLayerVisibility';
import { useFlood } from '../services/flood/useFlood';
import { currentSeverity, floodLevels, type FloodGauge } from '../services/flood/data';
import { FloodPanel } from './map/FloodPanel';
import { DisasterTicker } from './DisasterTicker';
import { useMobileLayout } from './useMobileLayout';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Circle,
  Polygon,
  Polyline,
  useMap,
} from '@vis.gl/react-google-maps';
import L from 'leaflet';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Zap,
  Compass,
  Camera,
  PanelRightOpen,
  Eye,
  MapPin,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  X,
  Info,
  EyeOff,
  LocateFixed,
  Loader2,
} from 'lucide-react';
import { CategoryFilter, DisasterIncident, DisasterCategory } from '../types';
import { BMKG_SOURCE_URL, uniqueAreaNames, type EarthquakeEvent, type BmkgWeatherWarning } from '../services/bmkg';
import { BMKG_SHAKEMAP_BASE, buildBmkgPopupHtml, buildBmkgWeatherPopupHtml, formatQuakeTime } from './map/bmkgPopup';
import { FIRMS_SOURCE_URL, type FireHotspot, type FirmsStatus, type FirmsProgress } from '../services/firms';
import { GoogleFireOverlay } from './map/GoogleFireOverlay';
import { MapChatComposer } from './MapChatComposer';
import { MapSearch } from './map/MapSearch';
import { DisasterCallout, DisasterMarker, disasterMarkerHtml } from './map/disasterMarkers';
import type { PlaceResult } from '../services/places/placeSearch';
import { useCityWeather, type CityWeather } from '../services/weather/cityWeather';
import { useCityAirQuality, type CityAirQuality } from '../services/airquality/cityAirQuality';
import type { AirQualityNow } from '../services/airquality/googleAirQuality';
import {
  useMagma,
  MAGMA_LANDSLIDE_URL,
  MAGMA_VOLCANO_URL,
  VOLCANO_LEVEL_COLOR,
  VOLCANO_LEVEL_LABEL,
  type LandslideReport,
  type MagmaData,
  type Volcano,
} from '../services/magma';
import { useVaac, VAAC_SOURCE_URL, type AshAdvisory } from '../services/vaac';
import { useMagmaEruptions, MAGMA_ERUPTIONS_URL, type EruptionNotice } from '../services/magma/eruptions';
import type { ResolvedRange } from '../domain/dateRange';
import { useI18n, translate, localeFor } from '../i18n';

const ASH_FILL = '#64748b';
function FloodCamera({ gauge }: { gauge: FloodGauge | null }) {
  const map = useMap();
  useEffect(() => { if (map && gauge) { map.panTo({ lat: gauge.lat, lng: gauge.lng }); map.setZoom(8); } }, [map, gauge]);
  return null;
}
const ASH_FCST = '#94a3b8';

function formatUtc(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Date(t).toLocaleString(localeFor(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : iso;
}

/** FL070 → "±2,1 km" (flight level = hundreds of feet). */
function flToKm(levels: string | null): string {
  const m = levels?.match(/FL(\d{3})$/);
  return m ? ` (±${((Number(m[1]) * 100 * 0.3048) / 1000).toLocaleString(localeFor(), { maximumFractionDigits: 1 })} km)` : '';
}

function ashPopupHtml(a: AshAdvisory): string {
  const c = a.current;
  return (
    `<div style="font-size:12px;line-height:1.45;max-width:270px">` +
    `<div style="font-weight:800">${translate('🌫 ABU VULKANIK — G. {name}', { name: escHtml(a.volcano) })}</div>` +
    (a.terminated
      ? `<div><b>${translate('Advisory diakhiri')}</b> (${translate('abu diperkirakan sudah hilang')})</div>`
      : c && c.polygon.length >= 3
        ? `<div>${translate('Awan abu')} (${c.label === 'OBS' ? translate('teramati') : translate('estimasi')}): <b>${escHtml(c.levels ?? '-')}</b>${flToKm(c.levels)}${c.movement ? ` • ${escHtml(c.movement)}` : ''}</div>`
        : `<div>${translate('Awan abu tidak teridentifikasi di citra satelit')}</div>`) +
    (a.forecasts.length ? `<div style="color:#64748b">${translate('Prakiraan sebaran: {labels} (garis putus-putus)', { labels: a.forecasts.map((f) => escHtml(f.label)).join(', ') })}</div>` : '') +
    `<div style="color:#64748b">${translate('Diterbitkan: {date}', { date: formatUtc(a.issuedAt) })}${a.advisoryNr ? ` • No. ${escHtml(a.advisoryNr)}` : ''}</div>` +
    (a.infoSource ? `<div style="color:#64748b;font-size:11px">${translate('Info: {source}', { source: escHtml(a.infoSource) })}</div>` : '') +
    `<a href="${VAAC_SOURCE_URL}" target="_blank" rel="noopener noreferrer" style="color:#475569">Source: Darwin VAAC (BOM)</a>` +
    `</div>`
  );
}

/**
 * Triangle volcano icon colored by PVMBG activity level (current status).
 * Pulsing ring + count badge = eruption notices inside the selected date range.
 */
function volcanoMarkerHtml(v: Volcano, eruptionCount = 0): string {
  const c = VOLCANO_LEVEL_COLOR[v.level];
  const size = v.level >= 3 ? 22 : v.level === 2 ? 18 : 14;
  const ring =
    eruptionCount > 0
      ? `<span class="absolute inset-0 -m-1 rounded-full animate-ping" style="background:${c};opacity:.35"></span>`
      : '';
  const badge =
    eruptionCount > 0
      ? `<span class="absolute -top-2 -right-3 min-w-4 h-4 px-1 rounded-full bg-rose-600 border border-white text-white text-[9px] font-black leading-[14px] text-center">${eruptionCount > 99 ? '99+' : eruptionCount}</span>`
      : '';
  return (
    `<div class="relative flex items-center justify-center cursor-pointer transform -translate-x-1/2 -translate-y-1/2" style="width:${size}px;height:${size}px">` +
    ring +
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="position:relative;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))">` +
    `<path d="M12 3 L22 21 H2 Z" fill="${c}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>` +
    badge +
    `</div>`
  );
}

function formatEruptionDay(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(localeFor(), { day: '2-digit', month: 'short' }) : iso;
}

/** "N erupsi (7 hari)" + latest few notices. */
function eruptionListHtml(notices: EruptionNotice[], rangeLabel: string): string {
  if (notices.length === 0) return `<div style="color:#64748b">${translate('Tidak ada laporan erupsi ({range})', { range: escHtml(rangeLabel) })}</div>`;
  const rows = notices
    .slice(0, 5)
    .map(
      (n) =>
        `<li>${formatEruptionDay(n.at)} ${escHtml(n.localTime)}${n.ashColumnM ? ` • ${translate('kolom abu ±{n} m', { n: n.ashColumnM.toLocaleString(localeFor()) })}` : ''}</li>`,
    )
    .join('');
  return (
    `<div style="margin-top:2px"><b style="color:#e11d48">${translate('{count} erupsi', { count: notices.length })}</b> (${escHtml(rangeLabel)})</div>` +
    `<ul style="margin:2px 0 0 14px;padding:0;list-style:disc;color:#475569">${rows}</ul>` +
    (notices.length > 5 ? `<div style="color:#64748b">${translate('+{count} lainnya', { count: notices.length - 5 })}</div>` : '')
  );
}

function volcanoPopupHtml(v: Volcano, notices: EruptionNotice[] = [], rangeLabel = ''): string {
  return (
    `<div style="font-size:12px;line-height:1.45">` +
    `<div style="font-weight:800">${translate('🌋 G. {name}', { name: escHtml(v.name) })}</div>` +
    `<div>${translate('Status:')} <b style="color:${VOLCANO_LEVEL_COLOR[v.level]}">${translate(VOLCANO_LEVEL_LABEL[v.level])}</b></div>` +
    `<div>${escHtml(v.regency)}, ${escHtml(v.province)}${v.elevationM ? ` • ${v.elevationM} ${translate('mdpl')}` : ''}</div>` +
    eruptionListHtml(notices, rangeLabel) +
    (v.noticeNumber ? `<div style="color:#64748b">${translate('Laporan: {number}', { number: escHtml(v.noticeNumber) })}${v.hasVona ? ` ${translate('• VONA tersedia')}` : ''}</div>` : '') +
    `<a href="${notices.length ? MAGMA_ERUPTIONS_URL : MAGMA_VOLCANO_URL}" target="_blank" rel="noopener noreferrer" style="color:#b45309">Source: MAGMA Indonesia (PVMBG)</a>` +
    `</div>`
  );
}

/** Group eruption notices by volcano name (case-insensitive). */
// `Map` in this file is the Google Maps component, so use the built-in explicitly.
function groupEruptions(notices: EruptionNotice[]): globalThis.Map<string, EruptionNotice[]> {
  const m = new globalThis.Map<string, EruptionNotice[]>();
  for (const n of notices) {
    const k = n.volcano.toLowerCase();
    const arr = m.get(k);
    if (arr) arr.push(n);
    else m.set(k, [n]);
  }
  return m;
}

export interface FocusTarget {
  lat: number;
  lng: number;
  zoom: number;
  /** Bumped on every request so re-focusing the same point still pans. */
  seq: number;
}

export interface MyLocation {
  lat: number;
  lng: number;
  accuracyM: number;
}

function searchedPlacePopupHtml(p: PlaceResult): string {
  return (
    `<div style="font-size:12px;line-height:1.45">` +
    `<div style="font-weight:800">📍 ${escHtml(p.name)}</div>` +
    (p.address ? `<div style="color:#64748b">${escHtml(p.address)}</div>` : '') +
    `<div style="color:#64748b;font-size:11px">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</div>` +
    `</div>`
  );
}

// Declutter at low zoom: city weather chips and Level I volcanoes only appear when zoomed in.
const CITY_WEATHER_MIN_ZOOM = 6;
const NORMAL_VOLCANO_MIN_ZOOM = 7;

/** Level II+ or erupting volcanoes always show; Level I (Normal) only from NORMAL_VOLCANO_MIN_ZOOM. */
function shouldShowVolcano(v: Volcano, eruptionCount: number, zoom: number): boolean {
  return v.level >= 2 || eruptionCount > 0 || zoom >= NORMAL_VOLCANO_MIN_ZOOM;
}

/** True when a landslide report date (YYYY-MM-DD, local) falls inside the range. */
function landslideInRange(l: LandslideReport, start: Date, end: Date): boolean {
  const t = new Date(`${l.date}T12:00:00`).getTime();
  return Number.isFinite(t) && t >= start.getTime() - 12 * 3600_000 && t <= end.getTime() + 12 * 3600_000;
}

function landslidePopupHtml(l: LandslideReport): string {
  return (
    `<div style="font-size:12px;line-height:1.45">` +
    `<div style="font-weight:800">${translate('⛰ GERAKAN TANAH')}</div>` +
    `<div><b>${escHtml(l.regency)}</b>, ${escHtml(l.province)}</div>` +
    (l.movementType ? `<div>${translate('Jenis:')} <b>${escHtml(l.movementType)}</b>${l.material ? ` (${escHtml(l.material)})` : ''}</div>` : '') +
    (l.zone ? `<div>${translate('Zona kerentanan:')} <b>${escHtml(l.zone)}</b></div>` : '') +
    `<div style="color:#64748b">${translate('Tanggal kejadian: {date}', { date: escHtml(l.date) })}</div>` +
    `<a href="${MAGMA_LANDSLIDE_URL}" target="_blank" rel="noopener noreferrer" style="color:#b45309">Source: MAGMA Indonesia (PVMBG)</a>` +
    `</div>`
  );
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Compact map chip: icon + temperature + city name. */
function cityWeatherChipHtml(c: CityWeather, air?: AirQualityNow | null): string {
  const w = c.weather;
  const badge = air
    ? `<span class="ml-0.5 rounded-full px-1.5 py-[1px] text-[10px] font-black text-white" style="background:${escHtml(air.color)}" title="UAQI: ${escHtml(air.aqiDisplay)}${air.category ? ` — ${escHtml(air.category)}` : ''}">${escHtml(air.aqiDisplay)}</span>`
    : '';
  return (
    `<div class="flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-white/95 border border-sky-300 shadow-md whitespace-nowrap cursor-pointer transform -translate-x-1/2 -translate-y-1/2">` +
    `<img src="${escHtml(w.iconUrl)}" alt="" class="w-5 h-5" />` +
    `<span class="text-[11px] font-black text-slate-900">${Math.round(w.temperature)}°</span>` +
    `<span class="text-[10px] font-semibold text-slate-600">${escHtml(c.name)}</span>` +
    badge +
    `</div>`
  );
}

function cityWeatherPopupHtml(c: CityWeather, air?: AirQualityNow | null): string {
  const w = c.weather;
  return (
    `<div style="font-size:12px;line-height:1.45">` +
    `<div style="font-weight:800">⛅ ${escHtml(c.name)}</div>` +
    `<div><b>${Math.round(w.temperature)}°C</b> ${translate('(terasa {temp}°C)', { temp: Math.round(w.feelsLike) })} • ${escHtml(w.conditionText)}</div>` +
    `<div>${translate('Hujan:')} <b>${w.rainProbability}%</b> • ${translate('Kelembapan:')} <b>${w.humidity}%</b> • ${translate('Angin:')} <b>${Math.round(w.windSpeed)} ${translate('km/j')}</b></div>` +
    (air
      ? `<div style="margin-top:2px">🌫 ${translate('Kualitas udara (UAQI):')} <b style="color:${escHtml(air.color)}">${escHtml(air.aqiDisplay)}</b>${air.category ? ` ${escHtml(air.category)}` : ''} • ${translate('makin tinggi makin baik')}` +
        (air.dominantPollutant ? ` • ${translate('polutan dominan')}: <b>${escHtml(air.dominantPollutant.toUpperCase())}</b>` : '') +
        `</div>`
      : '') +
    `<div style="color:#64748b;font-size:11px">Source: Google Weather${air ? ' · Google Air Quality' : ''}</div>` +
    `</div>`
  );
}

function fireRadius(frp: number): number {
  return frp >= 50 ? 5 : frp >= 15 ? 3.5 : 2.5;
}

function fireColor(frp: number): string {
  if (frp >= 50) return '#dc2626';
  if (frp >= 15) return '#f97316';
  return '#facc15';
}

function formatFireTime(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Date(t).toLocaleString(localeFor(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : iso;
}

function buildFirePopupHtml(h: FireHotspot): string {
  return (
    `<div style="font-size:12px;line-height:1.45">` +
    `<div style="font-weight:800;letter-spacing:.03em">${translate('🔥 TITIK PANAS (HOTSPOT)')}</div>` +
    `<div>FRP: <b>${h.frp.toFixed(1)} MW</b> • Confidence: <b>${h.confidence}</b></div>` +
    `<div>${translate('Koordinat:')} <b>${h.latitude.toFixed(3)}, ${h.longitude.toFixed(3)}</b></div>` +
    (h.count > 1 ? `<div><b>${h.count}</b> ${translate('deteksi di area ±1 km')}</div>` : '') +
    `<div style="color:#64748b">${translate('Deteksi: {time}', { time: formatFireTime(h.acquiredAt) })} • ${h.daynight === 'N' ? translate('malam') : translate('siang')} • ${h.sensor}</div>` +
    `<div style="color:#64748b;font-size:11px;margin-top:2px">${translate('Deteksi satelit, belum terverifikasi lapangan.')}</div>` +
    `<a href="${FIRMS_SOURCE_URL}" target="_blank" rel="noopener noreferrer" style="color:#ea580c">Source: NASA FIRMS</a>` +
    `</div>`
  );
}

function CenteredDisasterMarker({ onClick, ...props }: React.ComponentProps<typeof AdvancedMarker>) {
  const map = useMap();
  return <AdvancedMarker {...props} onClick={event => {
    if (map && props.position && window.matchMedia('(max-width: 639px)').matches) {
      const lat = typeof props.position.lat === 'function' ? props.position.lat() : props.position.lat;
      const lng = typeof props.position.lng === 'function' ? props.position.lng() : props.position.lng;
      map.setZoom(Math.max(map.getZoom() ?? 5, 7));
      map.panTo({ lat, lng });
      map.panBy(0, -Math.min(130, map.getDiv().clientHeight * 0.25));
    }
    onClick?.(event);
  }} />;
}

interface MapCanvasProps {
  mobileFilterSlot?: React.ReactNode;
  mapActionSlot?: React.ReactNode;
  onHighlightDisaster?: (id: string | null) => void;
  disasters: Record<string, DisasterIncident>;
  activeDisasterKey: string;
  onSelectDisaster: (id: string) => void;
  activeCategory: CategoryFilter;
  isDarkMode: boolean;
  onExpandView: () => void;
  onOpenAIHelpdesk: () => void;
  onStartAIChat?: (message: string, file?: File) => void;
  isExpanded: boolean;
  /** Incident currently announced by the header news ticker (highlighted on the map). */
  highlightedDisasterKey?: string | null;
  /** Selected evacuation post (Posko) — synced with the Posko list view. */
  selectedPostId?: NonNullable<DisasterIncident['route']>['checkpoints'][number]['id'] | null;
  onSelectPost?: (id: NonNullable<DisasterIncident['route']>['checkpoints'][number]['id']) => void;
  isSidebarMinimized?: boolean;
  onToggleSidebar?: () => void;
  isDetailOpen?: boolean;
  onToggleDetail?: () => void;
  onOpenDetail?: () => void;
  isRouteOpen?: boolean;
  onToggleRoute?: () => void;
  onOpenRoute?: () => void;
  isReportsOpen?: boolean;
  onToggleReports?: () => void;
  onOpenReports?: () => void;
  isWeatherOpen?: boolean;
  onOpenWeather?: () => void;
  onCloseWeather?: () => void;
  /** BMKG V1 layer — separate from Disaster incidents, never auto-converted. */
  bmkgEvents?: EarthquakeEvent[];
  bmkgStatus?: 'idle' | 'loading' | 'ready' | 'unavailable';
  /** NASA FIRMS active-fire hotspots (satellite detections, not verified incidents). */
  /** Label of the BMKG date selection, e.g. "hari ini" (bmkgEvents are already filtered to it). */
  bmkgRangeLabel?: string;
  firmsHotspots?: FireHotspot[];
  firmsStatus?: FirmsStatus['state'];
  firmsProgress?: FirmsProgress;
  onRetryFirms?: () => void;
  /** Short label of the active FIRMS range, e.g. "7 hari". */
  firmsRangeLabel?: string;
  /** Header date selection; MAGMA eruption notices follow it. */
  selectedDate?: string;
  firmsSensors?: string;
  /** BMKG weather warnings (only ACTIVE rendered on the primary map layer). */
  bmkgWeather?: BmkgWeatherWarning[];
  weatherStatus?: 'idle' | 'loading' | 'ready' | 'unavailable';
}

type MapEngine = 'google' | 'osm';
type GoogleMapType = 'roadmap' | 'hybrid' | 'terrain';
type OSMTileType = 'osm-standard' | 'osm-hot' | 'osm-dark';

// Dark Mode Styling for Google Maps Roadmap
const darkGoogleMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#091122' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#091122' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7488a6' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d5e1f2' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d5e1f2' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0b1d28' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4b756e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#182845' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#131e33' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2b3f66' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2d47' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#e5ecf6' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#16223b' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d5e1f2' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#060b17' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3e5879' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#060b17' }],
  },
];

// Inner controller for Google Maps camera
const GoogleMapCameraController: React.FC<{
  activeDisaster: DisasterIncident | undefined;
  isRouteOpen: boolean;
  routePoints: google.maps.LatLngLiteral[];
  selectedPostPoint?: google.maps.LatLngLiteral | null;
  zoomTrigger: { action: 'in' | 'out' | 'reset'; id: number } | null;
  mapType: GoogleMapType;
  onZoomChange: (zoom: number) => void;
  weatherFocusCoords?: { lat: number; lng: number } | null;
  focusTarget?: FocusTarget | null;
}> = ({ activeDisaster, isRouteOpen, routePoints, selectedPostPoint, zoomTrigger, mapType, onZoomChange, weatherFocusCoords, focusTarget }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('zoom_changed', () => {
      const z = map.getZoom();
      if (typeof z === 'number') {
        onZoomChange(z);
      }
    });
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, onZoomChange]);

  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(mapType);
  }, [map, mapType]);

  useEffect(() => {
    if (!map || !activeDisaster || !activeDisaster.coords) return;
    const { lat, lng } = activeDisaster.coords;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    map.panTo({ lat, lng });
    if (window.matchMedia('(max-width: 639px)').matches) map.panBy(0, -Math.min(130, map.getDiv().clientHeight * 0.25));
    const currentZ = map.getZoom() || 5;
    if (currentZ < 7) {
      map.setZoom(7);
    }
  }, [map, activeDisaster?.id]);

  useEffect(() => {
    if (!map || !isRouteOpen || routePoints.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    routePoints.forEach((pt) => bounds.extend(pt));
    if (typeof activeDisaster?.coords?.lat === 'number' && typeof activeDisaster?.coords?.lng === 'number') {
      bounds.extend({ lat: activeDisaster.coords.lat, lng: activeDisaster.coords.lng });
    }
    const rightPad = window.matchMedia('(max-width: 639px)').matches ? 60 : 460;
    map.fitBounds(bounds, { top: 90, bottom: 90, left: 90, right: rightPad });
  }, [map, isRouteOpen, routePoints, activeDisaster?.coords?.lat, activeDisaster?.coords?.lng]);

  useEffect(() => {
    if (!map || !isRouteOpen || !selectedPostPoint) return;
    map.panTo(selectedPostPoint);
    if ((map.getZoom() || 12) < 14) map.setZoom(14);
  }, [map, isRouteOpen, selectedPostPoint]);

  useEffect(() => {
    if (!map || !zoomTrigger) return;
    if (zoomTrigger.action === 'in') {
      map.setZoom((map.getZoom() || 5) + 1);
    } else if (zoomTrigger.action === 'out') {
      map.setZoom(Math.max(4, (map.getZoom() || 5) - 1));
    } else if (zoomTrigger.action === 'reset') {
      map.panTo({ lat: -2.5, lng: 118.0 });
      map.setZoom(5);
    }
  }, [map, zoomTrigger]);

  // Pan to weather focus coordinates when user clicks "Fokus Peta" in WeatherDetailSidebar
  useEffect(() => {
    if (!map || !weatherFocusCoords) return;
    map.panTo(weatherFocusCoords);
    const z = map.getZoom() || 5;
    if (z < 9) map.setZoom(9);
  }, [map, weatherFocusCoords]);

  // Pan/zoom to a searched place or the user's location
  useEffect(() => {
    if (!map || !focusTarget) return;
    map.panTo({ lat: focusTarget.lat, lng: focusTarget.lng });
    map.setZoom(focusTarget.zoom);
  }, [map, focusTarget]);

  return null;
};

// OpenStreetMap Component
const OSMMapRenderer: React.FC<{
  floodAreas: FloodArea[];
  floodGauges: FloodGauge[];
  selectedFlood: FloodGauge | null;
  onSelectFlood: (id: string) => void;
  disasters: Record<string, DisasterIncident>;
  activeDisasterKey: string;
  onSelectDisaster: (id: string) => void;
  activeCategory: CategoryFilter;
  isDarkMode: boolean;
  tileType: OSMTileType;
  isRouteOpen: boolean;
  zoomTrigger: { action: 'in' | 'out' | 'reset'; id: number } | null;
  onZoomChange: (zoom: number) => void;
  onOpenDetail?: () => void;
  onExpandView: () => void;
  onOpenRoute?: () => void;
  onToggleRoute?: () => void;
  onOpenReports?: () => void;
  onToggleReports?: () => void;
  bmkgEvents?: EarthquakeEvent[];
  bmkgStatus?: 'idle' | 'loading' | 'ready' | 'unavailable';
  showBmkg?: boolean;
  firmsHotspots?: FireHotspot[];
  showFirms?: boolean;
  bmkgWeather?: BmkgWeatherWarning[];
  weatherStatus?: 'idle' | 'loading' | 'ready' | 'unavailable';
  showWeather?: boolean;
  showBmkgWeather?: boolean;
  cityWeather?: CityWeather[];
  cityAir?: CityAirQuality[];
  magma?: MagmaData | null;
  showMagma?: boolean;
  ashAdvisories?: AshAdvisory[];
  showAsh?: boolean;
  magmaEruptions?: EruptionNotice[];
  magmaRange?: ResolvedRange | null;
  /** Current map zoom (drives zoom-based decluttering). */
  zoomLevel?: number;
  highlightedDisasterKey?: string | null;
  selectedPostId?: NonNullable<DisasterIncident['route']>['checkpoints'][number]['id'] | null;
  onSelectPost?: (id: NonNullable<DisasterIncident['route']>['checkpoints'][number]['id']) => void;
  focusTarget?: FocusTarget | null;
  searchedPlace?: PlaceResult | null;
  myLocation?: MyLocation | null;
}> = ({
  floodAreas,
  floodGauges,
  selectedFlood,
  onSelectFlood,
  disasters,
  activeDisasterKey,
  onSelectDisaster,
  activeCategory,
  isDarkMode,
  tileType,
  isRouteOpen,
  zoomTrigger,
  onZoomChange,
  onOpenDetail,
  onExpandView,
  onOpenRoute,
  onToggleRoute,
  onOpenReports,
  onToggleReports,
  bmkgEvents = [],
  bmkgStatus = 'idle',
  showBmkg = true,
  firmsHotspots = [],
  showFirms = true,
  bmkgWeather = [],
  weatherStatus = 'idle',
  showWeather = true,
  showBmkgWeather = true,
  cityWeather = [],
  cityAir = [],
  magma = null,
  showMagma = false,
  ashAdvisories = [],
  showAsh = false,
  magmaEruptions = [],
  magmaRange = null,
  zoomLevel = 5,
  highlightedDisasterKey = null,
  selectedPostId = null,
  onSelectPost,
  focusTarget = null,
  searchedPlace = null,
  myLocation = null,
}) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const bmkgLayerRef = useRef<L.LayerGroup | null>(null);
  const firmsLayerRef = useRef<L.LayerGroup | null>(null);
  // Canvas renderer: thousands of hotspots without thousands of DOM nodes.
  const firmsRendererRef = useRef<L.Canvas | null>(null);
  const weatherLayerRef = useRef<L.LayerGroup | null>(null);
  const cityWeatherLayerRef = useRef<L.LayerGroup | null>(null);
  const magmaLayerRef = useRef<L.LayerGroup | null>(null);
  const ashLayerRef = useRef<L.LayerGroup | null>(null);
  const placeLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [calloutPos, setCalloutPos] = useState<{ x: number; y: number } | null>(null);
  const activeData = disasters[activeDisasterKey];
  // User can dismiss the callout with the X button; re-opens on next marker click.
  const [calloutClosed, setCalloutClosed] = useState(true);
  // Bumped every time the Leaflet map is (re)created so imperative layers
  // (BMKG) re-render without any user action after a map reset.
  const [mapEpoch, setMapEpoch] = useState(0);
  useEffect(() => {
    if (!mapRef.current) return;
    const group = L.layerGroup().addTo(mapRef.current);
    floodGauges.forEach(g => {
      L.circleMarker([g.lat, g.lng], { radius: selectedFlood?.id === g.id ? 12 : 8, color: '#fff', weight: 3,
        fillColor: floodLevels[currentSeverity(g)].color, fillOpacity: 1 })
        .on('click', () => onSelectFlood(g.id)).addTo(group);
    });
    return () => { group.remove(); };
  }, [floodGauges, selectedFlood, onSelectFlood, mapEpoch]);
  useEffect(() => {
    if (!mapRef.current) return;
    const group = L.layerGroup().addTo(mapRef.current);
    floodAreas.forEach(area => areaPaths(area.kml).forEach(rings => {
      L.polygon(rings.map(ring => ring.map(p => [p.lat, p.lng] as [number, number])), {
        color: areaColor(area), weight: 1.5, fillOpacity: area.kind === 'notification' ? 0.06 : 0.2, interactive: false,
      }).addTo(group);
    }));
    return () => { group.remove(); };
  }, [floodAreas, mapEpoch]);
  useEffect(() => { if (selectedFlood) mapRef.current?.flyTo([selectedFlood.lat, selectedFlood.lng], 8); }, [selectedFlood, mapEpoch]);

  const getTileConfig = useCallback((type: OSMTileType, dark: boolean) => {
    if (type === 'osm-hot') {
      return {
        url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">HOT</a>',
      };
    }
    if (type === 'osm-dark' || (type === 'osm-standard' && dark)) {
      return {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      };
    }
    return {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };
  }, []);

  // Keep the camera and map instance alive when the selected incident changes.
  const calloutIncidentRef = useRef(activeData);
  const updatePos = useCallback(() => {
    const incident = calloutIncidentRef.current;
    if (!mapRef.current || !incident?.coords) {
      setCalloutPos(null);
      return;
    }
    const { lat, lng } = incident.coords;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    const pt = mapRef.current.latLngToContainerPoint([lat, lng]);
    setCalloutPos({ x: pt.x, y: pt.y });
  }, []);
  useEffect(() => {
    calloutIncidentRef.current = activeData;
    updatePos();
  }, [activeData, updatePos]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-2.5, 118.0],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: true,
      maxBounds: [
        [-13.5, 92.0],
        [9.0, 143.0],
      ],
    });

    const cfg = getTileConfig(tileType, isDarkMode);
    const tileLayer = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Fires added first so incident/BMKG markers stay on top.
    firmsRendererRef.current = L.canvas({ padding: 0.3 });
    firmsLayerRef.current = L.layerGroup().addTo(map);
    const mGroup = L.layerGroup().addTo(map);
    const rGroup = L.layerGroup().addTo(map);
    const bGroup = L.layerGroup().addTo(map);
    const wGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = mGroup;
    routeLayerRef.current = rGroup;
    bmkgLayerRef.current = bGroup;
    weatherLayerRef.current = wGroup;
    cityWeatherLayerRef.current = L.layerGroup().addTo(map);
    magmaLayerRef.current = L.layerGroup().addTo(map);
    ashLayerRef.current = L.layerGroup().addTo(map);
    placeLayerRef.current = L.layerGroup().addTo(map);

    map.on('move', updatePos);
    // The disaster callout floats above the map panes; hide it while a layer popup is open
    // so it never covers the popup (one popup at a time).
    map.on('popupopen', () => setCalloutClosed(true));
    map.on('zoomend', () => {
      onZoomChange(map.getZoom());
      updatePos();
    });

    mapRef.current = map;
    setMapEpoch((e) => e + 1);
    const resizeTimer = setTimeout(() => {
      if (mapRef.current !== map) return;
      map.invalidateSize();
      updatePos();
    }, 150);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [getTileConfig, isDarkMode, tileType, updatePos, onZoomChange]);

  // Update tiles
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const cfg = getTileConfig(tileType, isDarkMode);
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 }).addTo(map);
  }, [tileType, isDarkMode, getTileConfig]);

  // Zoom triggers
  useEffect(() => {
    if (!mapRef.current || !zoomTrigger) return;
    if (zoomTrigger.action === 'in') mapRef.current.zoomIn();
    else if (zoomTrigger.action === 'out') mapRef.current.zoomOut();
    else if (zoomTrigger.action === 'reset') mapRef.current.flyTo([-2.5, 118.0], 5, { duration: 1.0 });
  }, [zoomTrigger]);

  // Render markers & circle
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;
    const map = mapRef.current;
    const mGroup = markersLayerRef.current;
    mGroup.clearLayers();

    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }

    Object.values(disasters).forEach((incident) => {
      const isVisible = activeCategory === 'all' || incident.category === activeCategory;
      if (!isVisible) return;
      const { lat, lng } = incident.coords;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const isSelected = incident.id === activeDisasterKey;
      const html = disasterMarkerHtml(incident, isSelected || incident.id === highlightedDisasterKey);

      const m = L.marker([lat, lng], {
        icon: L.divIcon({ html, className: 'disaster-osm-marker', iconSize: [0, 0] }),
        zIndexOffset: isSelected ? 1000 : 100,
      });

      m.on('click', () => {
        map.closePopup(); // close any open layer popup before showing the disaster callout
        setCalloutClosed(false);
        onSelectDisaster(incident.id);
        const zoom = Math.max(map.getZoom(), 7);
        const offset = window.matchMedia('(max-width: 639px)').matches ? Math.min(130, map.getSize().y * 0.25) : 0;
        const center = map.unproject(map.project([lat, lng], zoom).subtract([0, offset]), zoom);
        map.flyTo(center, zoom, { duration: 0.6 });
      });
      mGroup.addLayer(m);

      if (isSelected) {
        circleRef.current = L.circle([lat, lng], {
          radius: incident.category === 'earthquake' ? 25000 : 18000,
          color: incident.category === 'flood' ? '#0ea5e9' : incident.category === 'fire' ? '#f59e0b' : '#e11d48',
          fillColor: incident.category === 'flood' ? '#0ea5e9' : incident.category === 'fire' ? '#f59e0b' : '#e11d48',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '6, 8',
        }).addTo(map);
      }
    });

    updatePos();
  }, [disasters, activeCategory, activeDisasterKey, onSelectDisaster, updatePos, highlightedDisasterKey]);

  // BMKG earthquake layer (separate from Disaster incidents; distinct cyan style)
  useEffect(() => {
    if (!mapRef.current || !bmkgLayerRef.current) return;
    const bGroup = bmkgLayerRef.current;
    bGroup.clearLayers();
    if (!showBmkg || bmkgStatus === 'unavailable') return;
    bmkgEvents.forEach((e) => {
      if (!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) return;
      const mag = e.magnitude.toFixed(1);
      const html =
        `<div class="relative flex items-center justify-center cursor-pointer group transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform">` +
        `<span class="min-w-9 h-7 px-1.5 rounded-full bg-cyan-600 border-2 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-white text-[10px] font-black group-hover:ring-4 group-hover:ring-cyan-300/40 transition-all">M${mag}</span>` +
        `</div>`;
      const m = L.marker([e.latitude, e.longitude], {
        icon: L.divIcon({ html, className: 'bmkg-osm-marker', iconSize: [40, 28], iconAnchor: [20, 14] }),
        zIndexOffset: 500,
        title: t('Gempa BMKG M{mag} — {region}', { mag, region: e.region }),
        alt: t('Gempa BMKG M{mag} — {region}', { mag, region: e.region }),
        keyboard: true,
      });
      m.on('add', () => {
        const el = m.getElement();
        el?.setAttribute('role', 'button');
        el?.setAttribute('aria-label', t('Gempa BMKG M{mag}, {region}. Buka detail', { mag, region: e.region }));
      });
      m.bindPopup(buildBmkgPopupHtml(e), { maxWidth: 300, closeButton: true, className: 'bmkg-popup' });
      bGroup.addLayer(m);
    });
  }, [bmkgEvents, showBmkg, bmkgStatus, mapEpoch]);

  // NASA FIRMS hotspot layer (canvas circle markers, colored by FRP)
  useEffect(() => {
    const fGroup = firmsLayerRef.current;
    if (!mapRef.current || !fGroup) return;
    fGroup.clearLayers();
    if (!showFirms) return;
    const renderer = firmsRendererRef.current ?? undefined;
    // Draw weakest first so strong fires paint on top.
    for (let i = firmsHotspots.length - 1; i >= 0; i--) {
      const h = firmsHotspots[i]!;
      const color = fireColor(h.frp);
      L.circleMarker([h.latitude, h.longitude], {
        renderer,
        radius: fireRadius(h.frp),
        color: '#7c2d12',
        weight: 0.6,
        fillColor: color,
        fillOpacity: 0.85,
      })
        .bindPopup(buildFirePopupHtml(h), { maxWidth: 280, closeButton: true, className: 'bmkg-popup' })
        .addTo(fGroup);
    }
  }, [firmsHotspots, showFirms, mapEpoch]);
  // BMKG weather warning polygons — ACTIVE warnings only, valid polygons only.
  // Records with unparseable polygons stay in the card/list but draw nothing.
  useEffect(() => {
    if (!mapRef.current || !weatherLayerRef.current) return;
    const wGroup = weatherLayerRef.current;
    wGroup.clearLayers();
    if (!showBmkgWeather || weatherStatus === 'unavailable') return;
    bmkgWeather.forEach((w) => {
      if (w.status !== 'ACTIVE') return;
      w.areas.forEach((a) => {
        if (a.polygon.length < 3) return;
        const latlngs = a.polygon.map(([lat, lng]) => [lat, lng] as [number, number]);
        const poly = L.polygon(latlngs, {
          color: '#f97316',
          fillColor: '#f97316',
          fillOpacity: 0.15,
          weight: 2,
        });
        poly.bindPopup(buildBmkgWeatherPopupHtml(w), { maxWidth: 300, closeButton: true, className: 'bmkg-popup' });
        poly.bindTooltip(t('BMKG ⛈ {event} — {area}', { event: w.event, area: a.name ?? 'Indonesia' }), { sticky: true });
        wGroup.addLayer(poly);
      });
    });
  }, [bmkgWeather, showBmkgWeather, weatherStatus, mapEpoch]);

  // Major-city weather + air-quality chips (only while CUACA layer is ON)
  useEffect(() => {
    const cGroup = cityWeatherLayerRef.current;
    if (!mapRef.current || !cGroup) return;
    cGroup.clearLayers();
    if (!showWeather || zoomLevel < CITY_WEATHER_MIN_ZOOM) return;
    const airByCity: Record<string, AirQualityNow | undefined> = {};
    for (const a of cityAir) airByCity[a.id] = a.air;
    cityWeather.forEach((c) => {
      const air = airByCity[c.id] ?? null;
      L.marker([c.lat, c.lng], {
        icon: L.divIcon({ html: cityWeatherChipHtml(c, air), className: 'city-weather-marker', iconSize: [0, 0] }),
        zIndexOffset: 300,
        title: air ? t('Cuaca & kualitas udara {name}', { name: c.name }) : t('Cuaca {name}', { name: c.name }),
      })
        .bindPopup(cityWeatherPopupHtml(c, air), { maxWidth: 280, closeButton: true, className: 'bmkg-popup' })
        .addTo(cGroup);
    });
  }, [cityWeather, cityAir, showWeather, mapEpoch, zoomLevel]);

  // MAGMA layer: volcano activity levels + gerakan tanah reports (PVMBG)
  useEffect(() => {
    const g = magmaLayerRef.current;
    if (!mapRef.current || !g) return;
    g.clearLayers();
    if (!showMagma || !magma) return;
    const byVolcano = groupEruptions(magmaEruptions);
    magma.landslides.filter((l) => !magmaRange || landslideInRange(l, magmaRange.start, magmaRange.end)).forEach((l) => {
      L.marker([l.latitude, l.longitude], {
        icon: L.divIcon({
          html: `<div class="w-5 h-5 rounded-md bg-amber-800 border-2 border-white shadow flex items-center justify-center text-[10px] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer">⛰</div>`,
          className: 'magma-landslide-marker',
          iconSize: [0, 0],
        }),
        zIndexOffset: 350,
        title: t('Gerakan tanah — {name}', { name: l.regency }),
      })
        .bindPopup(landslidePopupHtml(l), { maxWidth: 280, closeButton: true, className: 'bmkg-popup' })
        .addTo(g);
    });
    magma.volcanoes.forEach((v) => {
      const notices = byVolcano.get(v.name.toLowerCase()) ?? [];
      if (!shouldShowVolcano(v, notices.length, zoomLevel)) return;
      L.marker([v.latitude, v.longitude], {
        icon: L.divIcon({ html: volcanoMarkerHtml(v, notices.length), className: 'magma-volcano-marker', iconSize: [0, 0] }),
        zIndexOffset: 400 + v.level * 10 + (notices.length ? 50 : 0),
        title: `${t('G. {name} — {level}', { name: v.name, level: t(VOLCANO_LEVEL_LABEL[v.level]) })}${notices.length ? ` • ${t('{count} erupsi', { count: notices.length })}` : ''}`,
      })
        .bindPopup(volcanoPopupHtml(v, notices, magmaRange?.label ?? ''), { maxWidth: 280, closeButton: true, className: 'bmkg-popup' })
        .addTo(g);
    });
  }, [magma, showMagma, mapEpoch, magmaEruptions, magmaRange, zoomLevel]);

  // Searched place + "my location" markers
  useEffect(() => {
    const g = placeLayerRef.current;
    if (!mapRef.current || !g) return;
    g.clearLayers();
    if (myLocation) {
      L.circle([myLocation.lat, myLocation.lng], {
        radius: myLocation.accuracyM,
        color: '#2563eb',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
      }).addTo(g);
      L.marker([myLocation.lat, myLocation.lng], {
        icon: L.divIcon({
          html: '<span class="block w-4 h-4 rounded-full bg-blue-600 border-[3px] border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2"></span>',
          className: 'my-location-marker',
          iconSize: [0, 0],
        }),
        zIndexOffset: 2000,
        title: t('Lokasi saya'),
      })
        .bindPopup(`<div style="font-size:12px"><b>${t('Lokasi saya')}</b><br/>${t('Akurasi ±{accuracy} m', { accuracy: Math.round(myLocation.accuracyM) })}</div>`, {
          closeButton: true,
          className: 'bmkg-popup',
        })
        .addTo(g);
    }
    if (searchedPlace) {
      L.marker([searchedPlace.lat, searchedPlace.lng], {
        icon: L.divIcon({
          html: '<span class="block text-2xl leading-none drop-shadow transform -translate-x-1/2 -translate-y-full">📍</span>',
          className: 'searched-place-marker',
          iconSize: [0, 0],
        }),
        zIndexOffset: 1900,
        title: searchedPlace.name,
      })
        .bindPopup(searchedPlacePopupHtml(searchedPlace), { closeButton: true, className: 'bmkg-popup' })
        .addTo(g);
    }
  }, [searchedPlace, myLocation, mapEpoch]);

  // Fly to a searched place or the user's location
  useEffect(() => {
    if (!mapRef.current || !focusTarget) return;
    mapRef.current.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom, { duration: 1.0 });
  }, [focusTarget]);

  // Darwin VAAC volcanic-ash clouds: current (filled) + forecasts (dashed)
  useEffect(() => {
    const g = ashLayerRef.current;
    if (!mapRef.current || !g) return;
    g.clearLayers();
    if (!showAsh) return;
    ashAdvisories.forEach((a) => {
      const html = ashPopupHtml(a);
      a.forecasts.forEach((f) =>
        L.polygon(f.polygon, { color: ASH_FCST, weight: 1.5, dashArray: '5, 6', fillOpacity: 0.05 })
          .bindPopup(html, { maxWidth: 290, closeButton: true, className: 'bmkg-popup' })
          .addTo(g),
      );
      if (a.current && a.current.polygon.length >= 3) {
        L.polygon(a.current.polygon, { color: '#334155', weight: 2, fillColor: ASH_FILL, fillOpacity: 0.4 })
          .bindPopup(html, { maxWidth: 290, closeButton: true, className: 'bmkg-popup' })
          .addTo(g);
      }
      L.marker(a.summit, {
        icon: L.divIcon({
          html: `<div class="w-6 h-6 rounded-full bg-slate-700 border-2 border-white shadow flex items-center justify-center text-[11px] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer${a.terminated ? ' opacity-50' : ''}">🌫</div>`,
          className: 'ash-summit-marker',
          iconSize: [0, 0],
        }),
        zIndexOffset: 450,
        title: t('Abu vulkanik — G. {name}', { name: a.volcano }),
      })
        .bindPopup(html, { maxWidth: 290, closeButton: true, className: 'bmkg-popup' })
        .addTo(g);
    });
  }, [ashAdvisories, showAsh, mapEpoch]);

  // Route drawing
  useEffect(() => {
    if (!mapRef.current || !routeLayerRef.current) return;
    const map = mapRef.current;
    const rGroup = routeLayerRef.current;
    rGroup.clearLayers();

    if (!isRouteOpen || !activeData || !activeData.route) return;
    const checkpoints = (activeData.route.checkpoints || []).slice(0, 5);
    const pts: [number, number][] = [];

    checkpoints.forEach((cp, idx) => {
      let lat = cp.lat;
      let lng = cp.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        lat = activeData.coords.lat - 0.2 + idx * 0.1;
        lng = activeData.coords.lng - 0.2 + idx * 0.1;
      }
      pts.push([lat, lng]);

      const isSelPost = cp.id === selectedPostId;
      const cpMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div class="flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"><div class="${
            isSelPost ? 'w-8 h-8 bg-orange-500 border-white text-white ring-4 ring-orange-400/40' : 'w-6 h-6 bg-slate-900 border-orange-400 text-orange-300'
          } rounded-full border-2 font-black text-[10px] flex items-center justify-center shadow-lg">${idx + 1}</div></div>`,
          iconSize: [0, 0],
        }),
        zIndexOffset: isSelPost ? 900 : 800,
        title: cp.name ?? cp.title ?? t('Posko {n}', { n: idx + 1 }),
      });
      cpMarker.on('click', () => onSelectPost?.(cp.id));
      rGroup.addLayer(cpMarker);
    });

    if (pts.length >= 2 && !checkpoints.some(cp=>cp.recommendation)) {
      rGroup.addLayer(L.polyline(pts, { color: '#ea580c', weight: 8, opacity: 0.35 }));
      rGroup.addLayer(L.polyline(pts, { color: '#f97316', weight: 3.5, opacity: 0.95, dashArray: '8, 8' }));
    }
  }, [isRouteOpen, activeData, selectedPostId, onSelectPost, t]);

  useEffect(() => {
    if (!mapRef.current || !isRouteOpen || !activeData || !activeData.route) return;
    const checkpoints = (activeData.route.checkpoints || []).slice(0, 5);
    const pts: [number, number][] = checkpoints
      .filter((cp): cp is typeof cp & { lat: number; lng: number } => typeof cp.lat === 'number' && typeof cp.lng === 'number')
      .map((cp) => [cp.lat, cp.lng]);
    if (typeof activeData.coords.lat === 'number' && typeof activeData.coords.lng === 'number') {
      pts.push([activeData.coords.lat, activeData.coords.lng]);
    }
    if (pts.length > 0) {
      const rightPad = window.matchMedia('(max-width: 639px)').matches ? 60 : 460;
      mapRef.current.fitBounds(L.latLngBounds(pts), {
        paddingTopLeft: [90, 90],
        paddingBottomRight: [rightPad, 90],
        animate: true,
        duration: 1.0,
      });
    }
  }, [isRouteOpen, activeData]);

  useEffect(() => {
    if (!mapRef.current || !isRouteOpen || selectedPostId === null || !activeData?.route) return;
    const cp = (activeData.route.checkpoints || []).slice(0, 5).find((item) => item.id === selectedPostId);
    if (cp && typeof cp.lat === 'number' && typeof cp.lng === 'number') {
      mapRef.current.flyTo([cp.lat, cp.lng], Math.max(mapRef.current.getZoom(), 14), { duration: 0.8 });
    }
  }, [isRouteOpen, selectedPostId, activeData]);

  return (
    <>
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-0" />
      {calloutPos && !calloutClosed && activeData && (activeCategory === 'all' || activeData.category === activeCategory) && (
        <DisasterCallout
          incident={activeData}
          onViewDetail={onExpandView}
          onClose={() => setCalloutClosed(true)}
          className="absolute z-40"
          style={{ left: `${calloutPos.x}px`, top: `${calloutPos.y}px`, transform: 'translate(-50%, calc(-100% - 30px))' }}
        />
      )}
    </>
  );
};

export const MapCanvas: React.FC<MapCanvasProps> = ({
  mobileFilterSlot,
  mapActionSlot,
  onHighlightDisaster,
  disasters,
  activeDisasterKey,
  onSelectDisaster,
  activeCategory,
  isDarkMode,
  onExpandView,
  onOpenAIHelpdesk,
  onStartAIChat,
  isExpanded,
  isSidebarMinimized = false,
  onToggleSidebar,
  isDetailOpen = false,
  onToggleDetail,
  onOpenDetail,
  isRouteOpen = false,
  onToggleRoute,
  onOpenRoute,
  isReportsOpen = false,
  onToggleReports,
  onOpenReports,
  isWeatherOpen = false,
  onOpenWeather,
  onCloseWeather,
  bmkgEvents = [],
  bmkgStatus = 'idle',
  bmkgRangeLabel = 'hari ini',
  firmsHotspots = [],
  firmsStatus = 'idle',
  firmsProgress = { completed: 0, total: 0, failed: 0 },
  onRetryFirms,
  firmsRangeLabel = '',
  firmsSensors = '',
  selectedDate = 'Today',
  highlightedDisasterKey = null,
  selectedPostId = null,
  onSelectPost,
  bmkgWeather = [],
  weatherStatus = 'idle',
}) => {
  const mobile = useMobileLayout();
  const { t, locale } = useI18n();
  const [showMobileNews, setShowMobileNews] = useState(true);
  const [firmsNoticeOpen, setFirmsNoticeOpen] = useState(true);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  // Master switch for every API data map layer (bottom-left toggle). ON by default; category selects the visible sources.
  const [showApiLayers, setShowApiLayers] = useState(true);
  const showFlood = showApiLayers && (activeCategory === 'flood' || activeCategory === 'all');
  const flood = useFlood(showFlood);
  const [selectedFloodId, setSelectedFloodId] = useState<string | null>(null);
  const [showNormalFlood, setShowNormalFlood] = useState(true);
  const floodGauges = useMemo(() => showFlood ? (flood.data?.gauges ?? []).filter(g => showNormalFlood || currentSeverity(g) !== 'NO_FLOODING') : [], [showFlood, flood.data, showNormalFlood]);
  const [showFlashAreas, setShowFlashAreas] = useState(true);
  const [showRiverAreas, setShowRiverAreas] = useState(true);
  const [areaNow, setAreaNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setAreaNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const visibleFloodAreas = useMemo(() => showFlood ? activeFloodAreas(flood.data?.areas ?? [], areaNow, showFlashAreas, showRiverAreas, selectedFloodId ?? undefined) : [], [showFlood, flood.data, areaNow, showFlashAreas, showRiverAreas, selectedFloodId]);
  const selectedFlood = floodGauges.find(g => g.id === selectedFloodId) ?? null;
  useEffect(() => { setSelectedFloodId(null); }, [activeCategory]);
  const { showBmkg, showFirms, showWeather, showBmkgWeather, showMagma, showAsh } = apiLayerVisibility(activeCategory, showApiLayers);
  const [selectedBmkgId, setSelectedBmkgId] = useState<string | null>(null);
  const selectedBmkg = useMemo(() => bmkgEvents.find((e) => e.id === selectedBmkgId) ?? null, [bmkgEvents, selectedBmkgId]);
  // Time of the last BMKG marker click: lets the map's outside-click handler ignore that same click.
  const lastMarkerClickRef = useRef(0);
  const [selectedFire, setSelectedFire] = useState<FireHotspot | null>(null);
  // Close a stale popup when the date range (dataset) changes.
  useEffect(() => setSelectedFire(null), [firmsHotspots]);
  const [gCalloutClosed, setGCalloutClosed] = useState(true);
  // Coordinates to pan/fly to when user clicks "Fokus Peta" in WeatherDetailSidebar
  const [weatherFocusCoords, setWeatherFocusCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedWeatherId, setSelectedWeatherId] = useState<string | null>(null);
  const activeWeather = useMemo(
    () => bmkgWeather.filter((w) => w.status === 'ACTIVE'),
    [bmkgWeather],
  );
  const selectedWeather = activeWeather.find((w) => w.id === selectedWeatherId) ?? null;
  // Major-city weather points: always fetched; visibility follows the API layer toggle.
  const cityWx = useCityWeather(true);
  // Major-city air quality (UAQI), merged into the same chip. Fetched only while
  // the CUACA layer is visible so Air Quality API usage tracks the weather layer.
  const cityAirWx = useCityAirQuality(showWeather);
  const cityAirById = useMemo(() => {
    const rec: Record<string, AirQualityNow | undefined> = {};
    for (const a of cityAirWx.cities) rec[a.id] = a.air;
    return rec;
  }, [cityAirWx.cities]);
  // MAGMA (PVMBG): always fetched; visibility follows the API layer toggle.
  // MAGMA legend is collapsed by default; (i) button next to zoom controls toggles it.
  const [showMagmaLegend, setShowMagmaLegend] = useState(false);
  const magmaFeed = useMagma(true);
  const [selectedMagma, setSelectedMagma] = useState<
    { kind: 'volcano'; v: Volcano } | { kind: 'landslide'; l: LandslideReport } | null
  >(null);
  // Darwin VAAC volcanic ash: always fetched; visibility follows the API layer toggle.
  const ash = useVaac(true);
  const [selectedAsh, setSelectedAsh] = useState<AshAdvisory | null>(null);
  const activeAshCount = ash.advisories.filter((a) => !a.terminated).length;
  useEffect(() => {
    if (firmsStatus === 'loading' || firmsProgress.failed > 0) setFirmsNoticeOpen(true);
  }, [firmsStatus, firmsProgress.failed]);
  // MAGMA eruption notices ("Informasi Letusan") follow the header date range.
  const eruptions = useMagmaEruptions(true, selectedDate);
  const eruptionsByVolcano = useMemo(() => groupEruptions(eruptions.notices), [eruptions.notices]);
  const magmaCounts = useMemo(() => {
    const vs = magmaFeed.data?.volcanoes ?? [];
    return {
      total: vs.length,
      elevated: vs.filter((v) => v.level >= 2).length,
      eruptions: eruptions.notices.length,
      eruptingVolcanoes: eruptionsByVolcano.size,
    };
  }, [magmaFeed.data, eruptions.notices.length, eruptionsByVolcano]);
  const visibleLandslides = useMemo(
    () => (magmaFeed.data?.landslides ?? []).filter((l) => landslideInRange(l, eruptions.range.start, eruptions.range.end)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [magmaFeed.data, eruptions.range.id],
  );
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  // Only one map popup at a time (Google engine): the most recently opened one wins.
  type PopupKind = 'disaster' | 'fire' | 'bmkg' | 'weather' | 'magma' | 'ash' | 'city';
  const closeOtherPopups = useCallback((keep: PopupKind) => {
    if (keep !== 'fire') setSelectedFire(null);
    if (keep !== 'bmkg') setSelectedBmkgId(null);
    if (keep !== 'weather') setSelectedWeatherId(null);
    if (keep !== 'magma') setSelectedMagma(null);
    if (keep !== 'ash') setSelectedAsh(null);
    if (keep !== 'city') setSelectedCityId(null);
    if (keep !== 'disaster') setGCalloutClosed(true);
  }, []);
  useEffect(() => { if (selectedFire) closeOtherPopups('fire'); }, [selectedFire, closeOtherPopups]);
  useEffect(() => { if (selectedBmkgId) closeOtherPopups('bmkg'); }, [selectedBmkgId, closeOtherPopups]);
  useEffect(() => { if (selectedWeatherId) closeOtherPopups('weather'); }, [selectedWeatherId, closeOtherPopups]);
  useEffect(() => { if (selectedMagma) closeOtherPopups('magma'); }, [selectedMagma, closeOtherPopups]);
  useEffect(() => { if (selectedAsh) closeOtherPopups('ash'); }, [selectedAsh, closeOtherPopups]);
  useEffect(() => { if (selectedCityId) closeOtherPopups('city'); }, [selectedCityId, closeOtherPopups]);
  // Dismiss selections from layers that no longer belong to the active category.
  useEffect(() => {
    if (!showBmkg) setSelectedBmkgId(null);
    if (!showFirms) setSelectedFire(null);
    if (!showBmkgWeather) setSelectedWeatherId(null);
    if (!showWeather) setSelectedCityId(null);
    if (!showMagma) { setSelectedMagma(null); setShowMagmaLegend(false); }
    if (!showAsh) setSelectedAsh(null);
  }, [showBmkg, showFirms, showBmkgWeather, showWeather, showMagma, showAsh]);
  const toggleApiLayers = useCallback(() => {
    setShowApiLayers((on) => {
      if (on) {
        // Hiding the layers: close any popup that belongs to them.
        setSelectedBmkgId(null);
        setSelectedFire(null);
        setSelectedWeatherId(null);
        setSelectedMagma(null);
        setSelectedAsh(null);
        setSelectedCityId(null);
        setShowMagmaLegend(false);
      }
      return !on;
    });
  }, []);
  // Compact summary of the layers that are ON (shown next to the Layer button).
  const activeLayerChips = [
    showBmkg && {
      key: 'bmkg',
      icon: '🌐',
      value: String(bmkgEvents.length),
      title: t('Gempa BMKG ({range}): {count}', { range: bmkgRangeLabel, count: bmkgEvents.length }),
    },
    showFirms && {
      key: 'firms',
      icon: '🔥',
      value: firmsHotspots.length.toLocaleString(locale),
      title: t('Titik panas FIRMS ({range}): {count}', { range: firmsRangeLabel, count: firmsHotspots.length.toLocaleString(locale) }),
    },
    showMagma && {
      key: 'magma',
      icon: '🌋',
      value: String(eruptions.notices.length),
      title: t('Erupsi MAGMA ({range}): {count}', { range: eruptions.range.label, count: eruptions.notices.length }),
    },
    showAsh && { key: 'ash', icon: '🌫', value: String(activeAshCount), title: t('Advisory abu vulkanik aktif: {count}', { count: activeAshCount }) },
  ].filter((c): c is { key: string; icon: string; value: string; title: string } => !!c);

  // Engine state: start with 'google' if apiKey present, but auto-fallback to 'osm' on RefererNotAllowedMapError
  const [mapEngine, setMapEngine] = useState<MapEngine>(apiKey ? 'google' : 'osm');
  const [googleMapType, setGoogleMapType] = useState<GoogleMapType>('roadmap');
  const [osmTileType, setOsmTileType] = useState<OSMTileType>('osm-standard');
  const [showLayerSelector, setShowLayerSelector] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [mapTypeMenuPos, setMapTypeMenuPos] = useState<{ top: number; left: number } | null>(null);
  // Area search + "my location"
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [searchedPlace, setSearchedPlace] = useState<PlaceResult | null>(null);
  const [myLocation, setMyLocation] = useState<MyLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [showPlacePopup, setShowPlacePopup] = useState(false);
  const focusOn = useCallback((lat: number, lng: number, zoom: number) => {
    setFocusTarget((prev) => ({ lat, lng, zoom, seq: (prev?.seq ?? 0) + 1 }));
  }, []);
  const handlePlaceSelect = useCallback(
    (p: PlaceResult) => {
      setSearchedPlace(p);
      setShowPlacePopup(true);
      focusOn(p.lat, p.lng, p.zoom);
    },
    [focusOn],
  );
  const locateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocateError(t('Browser tidak mendukung lokasi.'));
      return;
    }
    if (!window.isSecureContext) {
      setLocateError(t('Lokasi butuh HTTPS (atau localhost).'));
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy };
        setMyLocation(loc);
        focusOn(loc.lat, loc.lng, pos.coords.accuracy > 2000 ? 11 : 14);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? t('Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini.')
            : err.code === err.TIMEOUT
              ? t('Waktu habis saat mencari lokasi.')
              : t('Lokasi tidak tersedia.'),
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [focusOn, t]);
  useEffect(() => {
    if (!locateError) return;
    const t = setTimeout(() => setLocateError(null), 6000);
    return () => clearTimeout(t);
  }, [locateError]);
  // Popover menus are portalled out of the horizontally scrolling toggle row: on iOS Safari a
  // scrolling container clips even position:fixed children. The app container keeps `.dark`.
  const overlayHost =
    typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>('[data-purpose="app-container"]') ?? document.body
      : null;
  // The toggle row scrolls horizontally (overflow clips absolute children), so the panel is
  // position:fixed and anchored to the clicked button's on-screen rect.
  const [layerPanelPos, setLayerPanelPos] = useState<{ top: number; left: number } | null>(null);
  const openLayerPanel = useCallback(
    (anchor: HTMLElement) => {
      if (showLayerPanel) {
        setShowLayerPanel(false);
        return;
      }
      const r = anchor.getBoundingClientRect();
      const width = window.innerWidth < 640 ? window.innerWidth - 24 : 320;
      setLayerPanelPos({ top: Math.round(r.bottom + 8), left: Math.round(Math.max(12, Math.min(r.left, window.innerWidth - width - 12))) });
      setShowLayerPanel(true);
    },
    [showLayerPanel],
  );
  useEffect(() => {
    if (!showLayerPanel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowLayerPanel(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showLayerPanel]);
  const [currentZoom, setCurrentZoom] = useState(5);
  const [zoomTrigger, setZoomTrigger] = useState<{
    action: 'in' | 'out' | 'reset';
    id: number;
  } | null>(null);

  // Authentication error detection for Google Maps (e.g. RefererNotAllowedMapError)
  const [hasAuthError, setHasAuthError] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [dismissBanner, setDismissBanner] = useState(false);

  const authorizedDomain = typeof window !== 'undefined'
    ? `${window.location.origin}/*`
    : 'https://*.run.app/*';

  useEffect(() => {
    const handleAuthFailure = () => {
      setHasAuthError(true);
      // Automatically fallback to OpenStreetMap so the user's map never breaks
      setMapEngine('osm');
    };

    window.addEventListener('gmp-auth-failure', handleAuthFailure);
    return () => {
      window.removeEventListener('gmp-auth-failure', handleAuthFailure);
    };
  }, []);

  const handleCopyDomain = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(authorizedDomain);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const handleRetryGoogleMaps = () => {
    setHasAuthError(false);
    setMapEngine('google');
  };

  const activeData = disasters[activeDisasterKey];

  // Route checkpoint points for Google Maps (max 5 per disaster)
  const googleRoutePoints = useMemo<google.maps.LatLngLiteral[]>(() => {
    if (!isRouteOpen || !activeData || !activeData.route) return [];
    const checkpoints = (activeData.route.checkpoints || []).slice(0, 5);
    return checkpoints.map((cp, idx) => {
      if (typeof cp.lat === 'number' && typeof cp.lng === 'number') {
        return { lat: cp.lat, lng: cp.lng };
      }
      const baseLat = activeData.coords.lat;
      const baseLng = activeData.coords.lng;
      return {
        lat: baseLat - 0.2 + idx * 0.1,
        lng: baseLng - 0.2 + idx * 0.1,
      };
    });
  }, [isRouteOpen, activeData]);

  const selectedGooglePostPoint = useMemo<google.maps.LatLngLiteral | null>(() => {
    if (!isRouteOpen || selectedPostId === null || !activeData?.route) return null;
    const cp = (activeData.route.checkpoints || []).slice(0, 5).find((item) => item.id === selectedPostId);
    return cp && typeof cp.lat === 'number' && typeof cp.lng === 'number' ? { lat: cp.lat, lng: cp.lng } : null;
  }, [isRouteOpen, selectedPostId, activeData]);

  const handleZoomAction = (action: 'in' | 'out' | 'reset') => {
    setZoomTrigger({ action, id: Date.now() });
  };

  const handleZoomChange = useCallback((zoom: number) => {
    setCurrentZoom(zoom);
  }, []);

  return (
    <section
      className="col-span-12 h-full overflow-hidden flex flex-col justify-between relative bg-[#070d18] select-none"
      data-purpose="map-viewport"
    >
      {/* Informative RefererNotAllowedMapError Notification Banner */}
      {hasAuthError && !dismissBanner && (
        <div className="relative z-50 bg-amber-500/15 border-b border-amber-500/40 backdrop-blur-xl px-4 py-2.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-xl animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div className="truncate">
              <span className="font-bold text-white">Google Maps RefererNotAllowedMapError: </span>
              <span className="text-amber-200">
                {t('Kunci API Anda dibatasi HTTP Referrer. Tambahkan domain berikut di Google Cloud Console:')}{' '}
              </span>
              <code className="bg-black/40 text-amber-300 px-1.5 py-0.5 rounded-md font-mono font-bold border border-amber-500/30">
                {authorizedDomain}
              </code>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyDomain}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold border border-amber-500/30 cursor-pointer active:scale-95 transition-all"
              title={t('Salin domain untuk ditambahkan di Google Cloud Console')}
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? t('Tersalin!') : t('Salin Domain')}</span>
            </button>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-white/10 cursor-pointer transition-all"
            >
              <span>{t('Buka Google Cloud')}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={handleRetryGoogleMaps}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer active:scale-95 transition-all shadow-xs"
              title={t('Coba hubungkan kembali ke Google Maps')}
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t('Coba Lagi')}</span>
            </button>
            <button
              onClick={() => setDismissBanner(true)}
              className="text-slate-400 hover:text-white px-1.5 py-0.5 cursor-pointer ml-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Map Surface: Google Maps or OpenStreetMap Fallback */}
      <div className="w-full h-full absolute inset-0 z-0">
        {mapEngine === 'google' && apiKey && !hasAuthError ? (
          <APIProvider
            apiKey={apiKey}
            language={locale.startsWith('en') ? 'en' : 'id'}
            region="ID"
            libraries={['places', 'geometry']}
          >
            <Map
              id="disaster-watch-map"
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
              defaultCenter={{ lat: -2.5, lng: 118.0 }}
              defaultZoom={5}
              minZoom={4}
              maxZoom={18}
              gestureHandling="greedy"
              disableDefaultUI={true}
              styles={isDarkMode && googleMapType === 'roadmap' ? darkGoogleMapStyles : undefined}
              onClick={() => {
                // Outside click closes the BMKG quake popup (ignore the click that just opened it).
                if (Date.now() - lastMarkerClickRef.current > 50) setSelectedBmkgId(null);
              }}
            >
              <GoogleMapCameraController
                activeDisaster={activeData}
                isRouteOpen={isRouteOpen}
                routePoints={googleRoutePoints}
                selectedPostPoint={selectedGooglePostPoint}
                zoomTrigger={zoomTrigger}
                mapType={googleMapType}
                onZoomChange={handleZoomChange}
                weatherFocusCoords={weatherFocusCoords}
                focusTarget={focusTarget}
              />

              <FloodCamera gauge={selectedFlood}/>
              <FloodAreas areas={visibleFloodAreas}/>
              {floodGauges.map(g => <AdvancedMarker key={`flood-${g.id}`} position={{ lat: g.lat, lng: g.lng }} onClick={() => setSelectedFloodId(g.id)} zIndex={selectedFloodId === g.id ? 1100 : 800}>
                <button aria-label={t('Prakiraan sungai {name}: {level}', { name: g.name, level: t(floodLevels[currentSeverity(g)].label) })} className="w-7 h-7 rounded-full border-[3px] border-white shadow-lg" style={{background: floodLevels[currentSeverity(g)].color}}/>
              </AdvancedMarker>)}

              {/* Hazard Impact Perimeter */}
              {activeData &&
                (activeCategory === 'all' || activeData.category === activeCategory) && (
                  <Circle
                    center={{
                      lat: activeData.coords.lat,
                      lng: activeData.coords.lng,
                    }}
                    radius={activeData.category === 'earthquake' ? 25000 : 18000}
                    strokeColor={
                      activeData.category === 'flood'
                        ? '#0ea5e9'
                        : activeData.category === 'fire'
                        ? '#f59e0b'
                        : '#e11d48'
                    }
                    strokeOpacity={0.8}
                    strokeWeight={2}
                    fillColor={
                      activeData.category === 'flood'
                        ? '#0ea5e9'
                        : activeData.category === 'fire'
                        ? '#f59e0b'
                        : '#e11d48'
                    }
                    fillOpacity={0.12}
                  />
                )}

              {/* Evacuation / Distribution Route Polyline */}
              {isRouteOpen && googleRoutePoints.length > 0 && (
                <>
                  {!activeData?.route.checkpoints.some(cp=>cp.recommendation) && <>
                  <Polyline
                    path={googleRoutePoints}
                    strokeColor="#ea580c"
                    strokeOpacity={0.4}
                    strokeWeight={8}
                  />
                  <Polyline
                    path={googleRoutePoints}
                    strokeColor="#f97316"
                    strokeOpacity={0.95}
                    strokeWeight={4}
                  />
                  </>}
                  {googleRoutePoints.map((pt, idx) => (
                    <AdvancedMarker
                      key={`gcp-${idx}`}
                      position={pt}
                      zIndex={activeData?.route?.checkpoints?.[idx]?.id === selectedPostId ? 600 : 500}
                      title={activeData?.route?.checkpoints?.[idx]?.name ?? t('Posko {n}', { n: idx + 1 })}
                      onClick={() => {
                        const id = activeData?.route?.checkpoints?.[idx]?.id;
                        if (id !== undefined) onSelectPost?.(id);
                      }}
                    >
                      <div className="flex items-center justify-center cursor-pointer">
                        <div
                          className={`rounded-full border-2 font-black text-[10px] flex items-center justify-center shadow-xl ${
                            activeData?.route?.checkpoints?.[idx]?.id === selectedPostId
                              ? 'w-8 h-8 bg-orange-500 border-white text-white ring-4 ring-orange-400/40'
                              : 'w-6 h-6 bg-slate-900 border-orange-400 text-orange-300'
                          }`}
                        >
                          {idx + 1}
                        </div>
                      </div>
                    </AdvancedMarker>
                  ))}
                </>
              )}

              {/* Disaster Incident Advanced Markers */}
              {Object.values(disasters).map((incident) => {
                const isVisible =
                  activeCategory === 'all' || incident.category === activeCategory;
                if (!isVisible) return null;
                const { lat, lng } = incident.coords;
                if (typeof lat !== 'number' || typeof lng !== 'number') return null;

                const isSelected = incident.id === activeDisasterKey;
                return (
                  <CenteredDisasterMarker
                    key={incident.id}
                    position={{ lat, lng }}
                    zIndex={isSelected ? 9999 : 20}
                    onClick={() => {
                      closeOtherPopups('disaster');
                      setGCalloutClosed(false);
                      onSelectDisaster(incident.id);
                    }}
                  >
                    <div className="relative flex items-center justify-center">
                      {isSelected && !gCalloutClosed && (
                        <DisasterCallout
                          incident={incident}
                          onViewDetail={onExpandView}
                          onClose={() => setGCalloutClosed(true)}
                          className="absolute bottom-[3.25rem] left-1/2 -translate-x-1/2 z-50"
                        />
                      )}
                      <DisasterMarker incident={incident} isSelected={isSelected || incident.id === highlightedDisasterKey} />
                    </div>
                  </CenteredDisasterMarker>
                );
              })}

              {/* NASA FIRMS hotspots — one canvas overlay for all points, popup for the clicked one */}
              {showFirms && (
                <GoogleFireOverlay
                  hotspots={firmsHotspots}
                  color={fireColor}
                  radius={fireRadius}
                  onSelect={setSelectedFire}
                />
              )}
              {showFirms && selectedFire && (
                <AdvancedMarker
                  position={{ lat: selectedFire.latitude, lng: selectedFire.longitude }}
                  zIndex={10003}
                >
                  <div
                    className="pointer-events-auto mb-2 min-w-[250px] rounded-2xl p-3 shadow-2xl border border-orange-300/40 bg-slate-900/95 text-white"
                    data-purpose="firms-popup"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black tracking-wide">{t('🔥 TITIK PANAS')}</div>
                      <button
                        type="button"
                        aria-label={t('Tutup popup')}
                        title={t('Tutup')}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedFire(null);
                        }}
                        className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[11px]">FRP: <b>{selectedFire.frp.toFixed(1)} MW</b> • Confidence: <b>{selectedFire.confidence}</b></div>
                    {selectedFire.count > 1 && (
                      <div className="text-[11px]"><b>{selectedFire.count}</b> {t('deteksi di area ±1 km')}</div>
                    )}
                    <div className="text-[11px]">{t('Koordinat:')} <b>{selectedFire.latitude.toFixed(3)}, {selectedFire.longitude.toFixed(3)}</b></div>
                    <div className="text-[10px] text-slate-400">{t('Deteksi: {time}', { time: formatFireTime(selectedFire.acquiredAt) })} • {selectedFire.sensor}</div>
                    <div className="text-[10px] text-slate-400">{t('Deteksi satelit, belum terverifikasi lapangan.')}</div>
                    <a href={FIRMS_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-[11px] text-orange-300 underline">
                      Source: NASA FIRMS
                    </a>
                  </div>
                </AdvancedMarker>
              )}

              {/* BMKG Earthquake layer — distinct cyan markers, separate from Disaster incidents */}
              {showBmkg &&
                bmkgStatus !== 'unavailable' &&
                bmkgEvents.map((e) => {
                  if (!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) return null;
                  const isSel = e.id === selectedBmkgId;
                  const label = t('Gempa BMKG M{mag} — {region}', { mag: e.magnitude.toFixed(1), region: e.region });
                  return (
                    <AdvancedMarker
                      key={e.id}
                      position={{ lat: e.latitude, lng: e.longitude }}
                      zIndex={isSel ? 10004 : 40}
                      title={label}
                      onClick={() => {
                        lastMarkerClickRef.current = Date.now();
                        setSelectedBmkgId(e.id);
                      }}
                    >
                      <div className="relative flex items-center justify-center" data-purpose="bmkg-marker" data-bmkg-id={e.id} aria-label={label}>
                        <span className="min-w-9 h-7 px-1.5 rounded-full bg-cyan-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-black">
                          M{e.magnitude.toFixed(1)}
                        </span>
                      </div>
                    </AdvancedMarker>
                );
              })}
              {/* BMKG quake popup — separate marker (no onClick) so clicks inside don't toggle it */}
              {showBmkg && bmkgStatus !== 'unavailable' && selectedBmkg && (
                <AdvancedMarker
                  position={{ lat: selectedBmkg.latitude, lng: selectedBmkg.longitude }}
                  zIndex={10004}
                  // Lift via the anchor (not a margin) so the marker host doesn't cover the chip below.
                  anchorTop="calc(-100% - 36px)"
                >
                  <div
                    className="pointer-events-auto min-w-[250px] max-w-[290px] rounded-2xl p-3 shadow-2xl border border-cyan-300/40 bg-slate-900/95 text-white"
                    data-purpose="bmkg-popup"
                    role="dialog"
                    aria-label={t('Detail gempa BMKG')}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-black tracking-wide">{t('🌐 GEMPA BUMI · BMKG')}</div>
                      <button
                        type="button"
                        aria-label={t('Tutup popup')}
                        title={t('Tutup')}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedBmkgId(null);
                        }}
                        className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[11px]">{t('Magnitudo:')} <b>M{selectedBmkg.magnitude.toFixed(1)}</b> • {t('Kedalaman:')} <b>{selectedBmkg.depthKm} km</b></div>
                    <div className="text-[11px]">{t('Wilayah:')} <b>{selectedBmkg.region}</b></div>
                    <div className="text-[11px]">{t('Waktu:')} <b>{formatQuakeTime(selectedBmkg.eventTime)}</b></div>
                    <div className="text-[11px]">
                      {t('Koordinat:')} <b>{selectedBmkg.latitude.toFixed(2)}, {selectedBmkg.longitude.toFixed(2)}</b>
                    </div>
                    {selectedBmkg.potential && <div className="text-[11px]">{t('Potensi:')} <b>{selectedBmkg.potential}</b></div>}
                    {selectedBmkg.feltArea && <div className="text-[11px]">{t('Dirasakan:')} <b>{selectedBmkg.feltArea}</b></div>}
                    {selectedBmkg.mmi && (
                      <a
                        href={`${BMKG_SHAKEMAP_BASE}${encodeURIComponent(selectedBmkg.mmi)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[11px] text-cyan-300 underline"
                      >
                        {t('Lihat shakemap')}
                      </a>
                    )}
                    <a
                      href={BMKG_SOURCE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[11px] text-cyan-300 underline"
                    >
                      Source: BMKG — data.bmkg.go.id/gempabumi
                    </a>
                  </div>
                </AdvancedMarker>
              )}

              {/* BMKG weather warning polygons — ACTIVE only, valid polygons only */}
              {showBmkgWeather &&
                weatherStatus !== 'unavailable' &&
                activeWeather.flatMap((w) =>
                  w.areas.flatMap((a, ai) => {
                    if (a.polygon.length < 3) return [];
                    const paths = a.polygon.map(([lat, lng]) => ({ lat, lng }));
                    const key = `${w.id}-a${ai}`;
                    const isSel = w.id === selectedWeatherId;
                    return [
                      <Polygon
                        key={key}
                        paths={paths}
                        strokeColor="#f97316"
                        strokeOpacity={0.9}
                        strokeWeight={isSel ? 4 : 2}
                        fillColor="#f97316"
                        fillOpacity={isSel ? 0.3 : 0.15}
                        onClick={() => setSelectedWeatherId(isSel ? null : w.id)}
                      />,
                    ];
                  }),
                )}

              {/* Darwin VAAC volcanic-ash clouds: current (filled) + forecasts (dashed outline) */}
              {showAsh &&
                ash.advisories.flatMap((a) => [
                  ...a.forecasts.map((f) => (
                    <Polygon
                      key={`ashf-${a.id}-${f.label}`}
                      paths={f.polygon.map(([lat, lng]) => ({ lat, lng }))}
                      strokeColor={ASH_FCST}
                      strokeOpacity={0.9}
                      strokeWeight={1.5}
                      fillColor={ASH_FCST}
                      fillOpacity={0.05}
                      onClick={() => setSelectedAsh(a)}
                    />
                  )),
                  ...(a.current && a.current.polygon.length >= 3
                    ? [
                        <Polygon
                          key={`ashc-${a.id}`}
                          paths={a.current.polygon.map(([lat, lng]) => ({ lat, lng }))}
                          strokeColor="#334155"
                          strokeOpacity={1}
                          strokeWeight={2}
                          fillColor={ASH_FILL}
                          fillOpacity={0.4}
                          onClick={() => setSelectedAsh(a)}
                        />,
                      ]
                    : []),
                  <AdvancedMarker
                    key={`ashm-${a.id}`}
                    position={{ lat: a.summit[0], lng: a.summit[1] }}
                    zIndex={45}
                    title={t('Abu vulkanik — G. {name}', { name: a.volcano })}
                    onClick={() => setSelectedAsh(a)}
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-slate-700 border-2 border-white shadow flex items-center justify-center text-[11px] cursor-pointer ${a.terminated ? 'opacity-50' : ''}`}
                    >
                      🌫
                    </div>
                  </AdvancedMarker>,
                ])}
              {showAsh && selectedAsh && (
                <AdvancedMarker position={{ lat: selectedAsh.summit[0], lng: selectedAsh.summit[1] }} zIndex={10001}>
                  <div
                    className="pointer-events-auto mb-7 min-w-[250px] max-w-[290px] rounded-2xl p-3 shadow-2xl border border-slate-300/40 bg-slate-900/95 text-white"
                    data-purpose="ash-popup"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-black tracking-wide">{t('🌫 ABU VULKANIK — G. {name}', { name: selectedAsh.volcano })}</div>
                      <button
                        type="button"
                        aria-label={t('Tutup popup')}
                        title={t('Tutup')}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedAsh(null);
                        }}
                        className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {selectedAsh.terminated ? (
                      <div className="text-[11px]"><b>{t('Advisory diakhiri')}</b> ({t('abu diperkirakan sudah hilang')})</div>
                    ) : selectedAsh.current && selectedAsh.current.polygon.length >= 3 ? (
                      <div className="text-[11px]">
                        {t('Awan abu')} ({selectedAsh.current.label === 'OBS' ? t('teramati') : t('estimasi')}): <b>{selectedAsh.current.levels ?? '-'}</b>
                        {flToKm(selectedAsh.current.levels)}
                        {selectedAsh.current.movement ? ` • ${selectedAsh.current.movement}` : ''}
                      </div>
                    ) : (
                      <div className="text-[11px]">{t('Awan abu tidak teridentifikasi di citra satelit')}</div>
                    )}
                    {selectedAsh.forecasts.length > 0 && (
                      <div className="text-[10px] text-slate-400">
                        {t('Prakiraan sebaran: {labels} (garis putus-putus)', { labels: selectedAsh.forecasts.map((f) => f.label).join(', ') })}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400">
                      {t('Diterbitkan: {date}', { date: formatUtc(selectedAsh.issuedAt) })}
                      {selectedAsh.advisoryNr ? ` • No. ${selectedAsh.advisoryNr}` : ''}
                    </div>
                    {selectedAsh.infoSource && <div className="text-[10px] text-slate-400">{t('Info: {source}', { source: selectedAsh.infoSource })}</div>}
                    <a href={VAAC_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-300 underline">
                      Source: Darwin VAAC (BOM)
                    </a>
                  </div>
                </AdvancedMarker>
              )}

              {/* MAGMA (PVMBG): gerakan tanah + volcano activity levels */}
              {showMagma &&
                visibleLandslides.map((l) => (
                  <AdvancedMarker
                    key={`ls-${l.id}`}
                    position={{ lat: l.latitude, lng: l.longitude }}
                    zIndex={35}
                    title={t('Gerakan tanah — {name}', { name: l.regency })}
                    onClick={() => setSelectedMagma({ kind: 'landslide', l })}
                  >
                    <div className="w-5 h-5 rounded-md bg-amber-800 border-2 border-white shadow flex items-center justify-center text-[10px] cursor-pointer">
                      ⛰
                    </div>
                  </AdvancedMarker>
                ))}
              {showMagma &&
                magmaFeed.data?.volcanoes
                  .filter((v) => shouldShowVolcano(v, eruptionsByVolcano.get(v.name.toLowerCase())?.length ?? 0, currentZoom))
                  .map((v) => (
                  <AdvancedMarker
                    key={`gv-${v.code}`}
                    position={{ lat: v.latitude, lng: v.longitude }}
                    zIndex={40 + v.level}
                    title={t('G. {name} — {level}', { name: v.name, level: t(VOLCANO_LEVEL_LABEL[v.level]) })}
                    onClick={() => setSelectedMagma({ kind: 'volcano', v })}
                  >
                    {/* Marker HTML is built from parsed numeric/enum fields only (no free text). */}
                    <div
                      dangerouslySetInnerHTML={{
                        __html: volcanoMarkerHtml(v, eruptionsByVolcano.get(v.name.toLowerCase())?.length ?? 0).replace(
                          'transform -translate-x-1/2 -translate-y-1/2',
                          '',
                        ),
                      }}
                    />
                  </AdvancedMarker>
                ))}
              {showMagma && selectedMagma && (
                <AdvancedMarker
                  position={
                    selectedMagma.kind === 'volcano'
                      ? { lat: selectedMagma.v.latitude, lng: selectedMagma.v.longitude }
                      : { lat: selectedMagma.l.latitude, lng: selectedMagma.l.longitude }
                  }
                  zIndex={10002}
                >
                  <div
                    className="pointer-events-auto mb-6 min-w-[240px] max-w-[280px] rounded-2xl p-3 shadow-2xl border border-amber-300/40 bg-slate-900/95 text-white"
                    data-purpose="magma-popup"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-black tracking-wide">
                        {selectedMagma.kind === 'volcano' ? t('🌋 G. {name}', { name: selectedMagma.v.name }) : t('⛰ GERAKAN TANAH')}
                      </div>
                      <button
                        type="button"
                        aria-label={t('Tutup popup')}
                        title={t('Tutup')}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedMagma(null);
                        }}
                        className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {selectedMagma.kind === 'volcano' ? (
                      <>
                        <div className="text-[11px]">
                          {t('Status:')}{' '}
                          <b style={{ color: VOLCANO_LEVEL_COLOR[selectedMagma.v.level] }}>{t(VOLCANO_LEVEL_LABEL[selectedMagma.v.level])}</b>
                        </div>
                        <div className="text-[11px]">
                          {selectedMagma.v.regency}, {selectedMagma.v.province}
                          {selectedMagma.v.elevationM ? ` • ${selectedMagma.v.elevationM} ${t('mdpl')}` : ''}
                        </div>
                        {(() => {
                          const list = eruptionsByVolcano.get(selectedMagma.v.name.toLowerCase()) ?? [];
                          if (list.length === 0) {
                            return (
                              <div className="text-[10px] text-slate-400">{t('Tidak ada laporan erupsi ({range})', { range: eruptions.range.label })}</div>
                            );
                          }
                          return (
                            <div className="text-[11px] mt-0.5">
                              <b className="text-rose-400">{t('{count} erupsi', { count: list.length })}</b> ({eruptions.range.label})
                              <ul className="list-disc ml-4 text-[10px] text-slate-300">
                                {list.slice(0, 5).map((n) => (
                                  <li key={n.id}>
                                    {formatEruptionDay(n.at)} {n.localTime}
                                    {n.ashColumnM ? ` • ${t('kolom abu ±{n} m', { n: n.ashColumnM.toLocaleString(locale) })}` : ''}
                                  </li>
                                ))}
                              </ul>
                              {list.length > 5 && <div className="text-[10px] text-slate-400">{t('+{count} lainnya', { count: list.length - 5 })}</div>}
                            </div>
                          );
                        })()}
                        {selectedMagma.v.noticeNumber && (
                          <div className="text-[10px] text-slate-400">
                            {t('Laporan: {number}', { number: selectedMagma.v.noticeNumber })}
                            {selectedMagma.v.hasVona ? ` ${t('• VONA tersedia')}` : ''}
                          </div>
                        )}
                        <a href={MAGMA_VOLCANO_URL} target="_blank" rel="noopener noreferrer" className="text-[11px] text-amber-300 underline">
                          Source: MAGMA Indonesia (PVMBG)
                        </a>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px]"><b>{selectedMagma.l.regency}</b>, {selectedMagma.l.province}</div>
                        {selectedMagma.l.movementType && (
                          <div className="text-[11px]">
                            {t('Jenis:')} <b>{selectedMagma.l.movementType}</b>
                            {selectedMagma.l.material ? ` (${selectedMagma.l.material})` : ''}
                          </div>
                        )}
                        {selectedMagma.l.zone && <div className="text-[11px]">{t('Zona kerentanan:')} <b>{selectedMagma.l.zone}</b></div>}
                        <div className="text-[10px] text-slate-400">{t('Tanggal kejadian: {date}', { date: selectedMagma.l.date })}</div>
                        <a href={MAGMA_LANDSLIDE_URL} target="_blank" rel="noopener noreferrer" className="text-[11px] text-amber-300 underline">
                          Source: MAGMA Indonesia (PVMBG)
                        </a>
                      </>
                    )}
                  </div>
                </AdvancedMarker>
              )}

              {/* My location (blue dot + accuracy circle) */}
              {myLocation && (
                <>
                  <Circle
                    center={{ lat: myLocation.lat, lng: myLocation.lng }}
                    radius={myLocation.accuracyM}
                    strokeColor="#2563eb"
                    strokeWeight={1}
                    fillColor="#3b82f6"
                    fillOpacity={0.12}
                  />
                  <AdvancedMarker position={{ lat: myLocation.lat, lng: myLocation.lng }} zIndex={10010} title={t('Lokasi saya')}>
                    <span className="block w-4 h-4 rounded-full bg-blue-600 border-[3px] border-white shadow-lg" data-purpose="my-location-marker" />
                  </AdvancedMarker>
                </>
              )}
              {/* Searched place pin + popup */}
              {searchedPlace && (
                <AdvancedMarker
                  position={{ lat: searchedPlace.lat, lng: searchedPlace.lng }}
                  zIndex={10011}
                  title={searchedPlace.name}
                  onClick={() => setShowPlacePopup((v) => !v)}
                >
                  <div className="relative flex flex-col items-center" data-purpose="searched-place-marker">
                    {showPlacePopup && (
                      <div
                        className="pointer-events-auto absolute bottom-9 left-1/2 -translate-x-1/2 min-w-[220px] max-w-[280px] rounded-2xl p-3 shadow-2xl border border-rose-300/40 bg-slate-900/95 text-white"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-black">📍 {searchedPlace.name}</div>
                          <button
                            type="button"
                            aria-label={t('Tutup popup')}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setShowPlacePopup(false);
                            }}
                            className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {searchedPlace.address && <div className="text-[11px] text-slate-300">{searchedPlace.address}</div>}
                        <div className="text-[10px] text-slate-400 font-mono">
                          {searchedPlace.lat.toFixed(4)}, {searchedPlace.lng.toFixed(4)}
                        </div>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSearchedPlace(null);
                          }}
                          className="mt-1 text-[10px] text-rose-300 underline"
                        >
                          {t('Hapus penanda')}
                        </button>
                      </div>
                    )}
                    <span className="text-2xl leading-none drop-shadow cursor-pointer">📍</span>
                  </div>
                </AdvancedMarker>
              )}

              {/* Major-city weather chips (CUACA layer ON only) */}
              {showWeather &&
                currentZoom >= CITY_WEATHER_MIN_ZOOM &&
                cityWx.cities.map((c) => {
                  const isSel = c.id === selectedCityId;
                  const w = c.weather;
                  const air = cityAirById[c.id] ?? null;
                  return (
                    <AdvancedMarker
                      key={`city-${c.id}`}
                      position={{ lat: c.lat, lng: c.lng }}
                      zIndex={isSel ? 10005 : 25}
                      title={air ? t('Cuaca & kualitas udara {name}', { name: c.name }) : t('Cuaca {name}', { name: c.name })}
                      onClick={() => setSelectedCityId(isSel ? null : c.id)}
                    >
                      <div className="relative flex items-center justify-center" data-purpose="city-weather-marker">
                        {isSel && (
                          <div
                            className="pointer-events-auto absolute bottom-9 left-1/2 -translate-x-1/2 z-50 min-w-[230px] rounded-2xl p-3 shadow-2xl border border-sky-300/40 bg-slate-900/95 text-white"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-black tracking-wide">⛅ {c.name}</div>
                              <button
                                type="button"
                                aria-label={t('Tutup popup')}
                                title={t('Tutup')}
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setSelectedCityId(null);
                                }}
                                className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-[11px]">
                              <b>{Math.round(w.temperature)}°C</b> {t('(terasa {temp}°C)', { temp: Math.round(w.feelsLike) })} • {w.conditionText}
                            </div>
                            <div className="text-[11px]">
                              {t('Hujan:')} <b>{w.rainProbability}%</b> • {t('Lembap:')} <b>{w.humidity}%</b> • {t('Angin:')} <b>{Math.round(w.windSpeed)} {t('km/j')}</b>
                            </div>
                            {air && (
                              <div className="text-[11px]">
                                🌫 {t('Kualitas udara (UAQI):')} <b style={{ color: air.color }}>{air.aqiDisplay}</b>
                                {air.category ? ` ${air.category}` : ''}
                                {` • ${t('makin tinggi makin baik')}`}
                                {air.dominantPollutant ? ` • ${t('polutan dominan')}: ${air.dominantPollutant.toUpperCase()}` : ''}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400">
                              Source: Google Weather{air ? ' · Google Air Quality' : ''}
                            </div>
                          </div>
                        )}
                        <span className="flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-white/95 border border-sky-300 shadow-md whitespace-nowrap cursor-pointer">
                          <img src={w.iconUrl} alt="" className="w-5 h-5" />
                          <span className="text-[11px] font-black text-slate-900">{Math.round(w.temperature)}°</span>
                          <span className="text-[10px] font-semibold text-slate-600">{c.name}</span>
                          {air && (
                            <span
                              className="ml-0.5 rounded-full px-1.5 py-[1px] text-[10px] font-black text-white"
                              style={{ background: air.color }}
                              title={`UAQI: ${air.aqiDisplay}${air.category ? ` — ${air.category}` : ''}`}
                            >
                              {air.aqiDisplay}
                            </span>
                          )}
                        </span>
                      </div>
                    </AdvancedMarker>
                  );
                })}

              {/* Selected weather warning callout */}
              {showBmkgWeather && selectedWeather && (
                <AdvancedMarker
                  position={{
                    lat: selectedWeather.areas.find((a) => a.polygon.length > 0)?.polygon[0]?.[0] ?? -2.5,
                    lng: selectedWeather.areas.find((a) => a.polygon.length > 0)?.polygon[0]?.[1] ?? 118.0,
                  }}
                  zIndex={10006}
                  title={t('BMKG ⛈ {event}', { event: selectedWeather.event })}
                  onClick={() => setSelectedWeatherId(null)}
                >
                  <div className="relative flex items-center justify-center" data-purpose="bmkg-weather-callout">
                    <div
                      className="pointer-events-auto absolute bottom-10 left-1/2 -translate-x-1/2 z-50 min-w-[260px] rounded-2xl p-3 shadow-2xl border border-orange-300/40 bg-slate-900/95 text-white"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-black tracking-wide">BMKG WEATHER WARNING</div>
                        <button
                          type="button"
                          aria-label={t('Tutup popup')}
                          title={t('Tutup')}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelectedWeatherId(null);
                          }}
                          className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-300">Source: <b>BMKG</b> (official nowcast)</div>
                      <div className="text-[11px]">Event: <b>{selectedWeather.event}</b></div>
                      <div className="text-[11px]">{selectedWeather.headline}</div>
                      <div className="text-[11px]">
                        Area: <b>{uniqueAreaNames(selectedWeather).join(', ') || 'Indonesia'}</b>
                      </div>
                      <div className="text-[10px] text-slate-400">Effective: {selectedWeather.effective}</div>
                      <div className="text-[10px] text-slate-400">Expires: {selectedWeather.expires}</div>
                      <a
                        href={selectedWeather.web || selectedWeather.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-orange-300 underline"
                      >
                        Source: BMKG — nowcast detail
                      </a>
                    </div>
                    <span className="w-6 h-6 rounded-full bg-orange-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-[11px]">
                      ⛈
                    </span>
                  </div>
                </AdvancedMarker>
              )}
            </Map>
          </APIProvider>
        ) : (
          <OSMMapRenderer
            floodAreas={visibleFloodAreas}
            floodGauges={floodGauges}
            selectedFlood={selectedFlood}
            onSelectFlood={setSelectedFloodId}
            disasters={disasters}
            activeDisasterKey={activeDisasterKey}
            onSelectDisaster={onSelectDisaster}
            activeCategory={activeCategory}
            isDarkMode={isDarkMode}
            tileType={osmTileType}
            isRouteOpen={isRouteOpen}
            zoomTrigger={zoomTrigger}
            onZoomChange={handleZoomChange}
            onOpenDetail={onOpenDetail}
            onExpandView={onExpandView}
            onOpenRoute={onOpenRoute}
            onToggleRoute={onToggleRoute}
            onOpenReports={onOpenReports}
            onToggleReports={onToggleReports}
            bmkgEvents={bmkgEvents}
            bmkgStatus={bmkgStatus}
            showBmkg={showBmkg}
            firmsHotspots={firmsHotspots}
            showFirms={showFirms}
            bmkgWeather={bmkgWeather}
            weatherStatus={weatherStatus}
            showWeather={showWeather}
            showBmkgWeather={showBmkgWeather}
            cityWeather={cityWx.cities}
            cityAir={cityAirWx.cities}
            magma={magmaFeed.data}
            showMagma={showMagma}
            ashAdvisories={ash.advisories}
            showAsh={showAsh}
            magmaEruptions={eruptions.notices}
            magmaRange={eruptions.range}
            zoomLevel={currentZoom}
            highlightedDisasterKey={highlightedDisasterKey}
            selectedPostId={selectedPostId}
            onSelectPost={onSelectPost}
            focusTarget={focusTarget}
            searchedPlace={searchedPlace}
            myLocation={myLocation}
          />
        )}
      </div>

      {showFlood && (activeCategory === 'flood' || selectedFlood) && <FloodPanel
        data={flood.data} state={flood.state} selected={selectedFlood} onSelect={setSelectedFloodId}
        mapType={googleMapType} onMapType={setGoogleMapType} googleAvailable={mapEngine === 'google' && !!apiKey && !hasAuthError}
        showFlashAreas={showFlashAreas} onShowFlashAreas={setShowFlashAreas} showRiverAreas={showRiverAreas} onShowRiverAreas={setShowRiverAreas}
        showNormal={showNormalFlood} onShowNormal={setShowNormalFlood} refresh={flood.refresh}
      />}
      <div className="relative z-30 pointer-events-none">
      {mobile && showMobileNews && onHighlightDisaster && (
        <div className="mobile-news-capsule">
          <DisasterTicker disasters={disasters} onHighlight={onHighlightDisaster} />
          <button type="button" className="mobile-news-close" aria-label={t('Tutup berita berjalan')} onClick={() => setShowMobileNews(false)}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {showFirms && firmsNoticeOpen && (firmsStatus === 'loading' || firmsStatus === 'unavailable' || firmsProgress.failed > 0) && (
        <div className="pointer-events-auto absolute top-20 left-16 right-3 sm:left-24 sm:right-auto z-50 max-w-sm rounded-xl border border-orange-200 bg-white/95 p-3 shadow-lg text-xs text-slate-700" role="status" aria-live="polite">
          <div className="flex items-start justify-between gap-2 font-semibold">
            <div className="flex items-center gap-2">
              {firmsStatus === 'loading' && <Loader2 className="h-4 w-4 animate-spin shrink-0 text-orange-500" aria-hidden="true" />}
              <span>{firmsStatus === 'loading' ? t('Memuat hotspot NASA FIRMS…') : firmsStatus === 'unavailable' ? t('NASA FIRMS belum tersedia') : t('Hotspot FIRMS tersedia sebagian')}</span>
            </div>
            <button type="button" onClick={() => setFirmsNoticeOpen(false)} className="-mr-1 -mt-1 rounded p-1 text-slate-400 hover:bg-orange-50 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-orange-500" aria-label={t('Tutup status FIRMS')} title={t('Tutup')}>×</button>
          </div>
          {firmsStatus === 'loading' && firmsProgress.total > 0 && <>
            <progress className="mt-2 w-full accent-orange-500" max={firmsProgress.total} value={firmsProgress.completed} aria-label={t('Progres permintaan FIRMS')} />
            <p>{t('{done}/{total} permintaan selesai · {loaded} titik dimuat', { done: firmsProgress.completed, total: firmsProgress.total, loaded: firmsHotspots.length.toLocaleString(locale) })}</p>
          </>}
          {firmsProgress.failed > 0 && <p className="mt-1">{t('{count} permintaan gagal atau melewati batas waktu.', { count: firmsProgress.failed })}</p>}
          {firmsStatus !== 'loading' && onRetryFirms && <button type="button" onClick={onRetryFirms} className="mt-2 inline-flex items-center rounded-lg bg-orange-600 px-3 py-1.5 font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">{t('Muat ulang FIRMS')}</button>}
        </div>
      )}

      {/* Top Left Header Overlay: Active Engine Pill & Layer Switcher */}
      <div className="map-top-toolbar relative z-30 pt-3 sm:pt-4 px-3 sm:px-6 pointer-events-none flex items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar [&>*]:shrink-0 -mx-1 px-1 py-1">
          <MapSearch onSelect={handlePlaceSelect} />
        </div>

        {mobileFilterSlot}

        {/* Floating Restore Pill on the top right when sidebar is minimized AND NO panel is open */}
        {isSidebarMinimized &&
          !isExpanded &&
          !isRouteOpen &&
          !isDetailOpen &&
          !isReportsOpen && (
            <button
              onClick={onToggleSidebar}
              className="pointer-events-auto shrink-0 hidden sm:flex items-center gap-2 bg-white/95 dark:bg-[#0b1329]/90 hover:bg-white text-slate-800 dark:text-slate-200 px-3 md:px-4 py-2 rounded-full font-bold text-xs shadow-xl border border-slate-200/90 dark:border-slate-700/70 backdrop-blur-md transition-all active:scale-95 group cursor-pointer hover:shadow-2xl animate-fadeIn"
              title={t('Buka / Tampilkan Sidebar Menu')}
            >
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              <span className="hidden md:inline">{t('Buka Menu Sidebar')}</span>
              <PanelRightOpen className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
      </div>

      </div>

      {/* Bottom Bar: Controls & Quick Action Buttons */}
      {/* Same row on every screen size: zoom column bottom-left, action buttons bottom-right (aligned to the bottom edge). */}
      <div className="map-bottom-bar relative z-30 flex flex-row items-end justify-between gap-2 px-3 sm:px-6 lg:px-8 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-6 pointer-events-none">
        {/* MAGMA legend — right of the zoom column, bottom-aligned; toggled with the (i) button */}
        {showMagma && showMagmaLegend && (
          <div
            id="magma-legend" className="pointer-events-auto absolute left-[3.5rem] sm:left-[4.25rem] lg:left-[4.75rem] bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_3.5rem)] sm:bottom-[5rem] md:bottom-6 z-40 w-56 max-w-[calc(100vw-4.25rem)] sm:max-w-[calc(100vw-5.5rem)] max-h-[38vh] overflow-y-auto rounded-2xl border border-slate-200/90 dark:border-slate-700/70 bg-white/95 dark:bg-[#0b1329]/95 backdrop-blur-md p-3 shadow-lg text-[11px] text-slate-700 dark:text-slate-200 animate-fadeIn"
            data-purpose="magma-legend"
            role="region"
            aria-label={t('Legenda MAGMA')}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('Legenda MAGMA')}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400">PVMBG</span>
                <button
                  type="button"
                  onClick={() => setShowMagmaLegend(false)}
                  aria-label={t('Tutup legenda MAGMA')}
                  title={t('Tutup legenda')}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">{t('Tingkat aktivitas gunung api')}</div>
            <ul className="space-y-1 mb-2">
              {([4, 3, 2, 1] as const).map((lvl) => (
                <li key={lvl} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3 L22 21 H2 Z" fill={VOLCANO_LEVEL_COLOR[lvl]} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  <span>{t(VOLCANO_LEVEL_LABEL[lvl])}</span>
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span className="relative flex h-3.5 w-3.5 items-center justify-center" aria-hidden="true">
                  <span className="absolute inset-0 rounded-full bg-orange-500/40 animate-ping"></span>
                  <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                </span>
                <span>{t('Berdenyut = ada erupsi ({range})', { range: eruptions.range.label })}</span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="min-w-4 h-4 px-1 rounded-full bg-rose-600 border border-white text-white text-[9px] font-black leading-[14px] text-center"
                  aria-hidden="true"
                >
                  3
                </span>
                <span>{t('Jumlah laporan erupsi')}</span>
              </li>
              <li className="text-[10px] text-slate-400">
                {t('Level I (Normal) tampil mulai zoom {zoom}, kecuali ada erupsi.', { zoom: NORMAL_VOLCANO_MIN_ZOOM })}
              </li>
            </ul>
            <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/80 dark:border-slate-700/60">
              <span className="w-4 h-4 rounded bg-amber-800 border border-white shadow-xs flex items-center justify-center text-[8px]" aria-hidden="true">⛰</span>
              <span>
                {t('Laporan gerakan tanah')}{' '}
                <span className="text-[10px] text-slate-400">{t('(data Jun 2022 – Mei 2023: {count} di rentang ini)', { count: visibleLandslides.length })}</span>
              </span>
            </div>
          </div>
        )}
        {locateError && (
          <div
            role="status"
            className="pointer-events-auto absolute left-3 sm:left-6 lg:left-8 bottom-full mb-2 z-40 max-w-[calc(100vw-1.5rem)] px-3 py-2 rounded-xl bg-slate-900/95 text-white text-[11px] shadow-lg animate-fadeIn"
          >
            📍 {locateError}
          </div>
        )}
        {/* Bottom Left Map Controls (Zoom & Scale) */}
        <div className="pointer-events-auto flex items-end gap-3 sm:gap-4">
          {/* Map controls: zoom group + reset / my location / MAGMA legend (glass, vertical) */}
          <div className="flex flex-col gap-2" data-purpose="map-zoom-controls">
            <span className="w-11 text-center text-xs font-bold tabular-nums text-slate-800 [text-shadow:0_1px_3px_rgba(255,255,255,0.95)]" aria-label={t('Zoom peta {zoom}x', { zoom: currentZoom })}>{currentZoom}x</span>
            <div data-purpose="map-zoom-button-group" className="flex w-fit flex-col self-start overflow-hidden rounded-xl border border-white/15 bg-slate-950/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
              <button
                type="button"
                onClick={() => handleZoomAction('in')}
                className="flex h-11 w-11 items-center justify-center text-slate-200 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 cursor-pointer"
                title={t('Perbesar peta')}
                aria-label={t('Perbesar peta')}
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <div className="mx-2 h-px bg-white/10" />
              <button
                type="button"
                onClick={() => handleZoomAction('out')}
                className="flex h-11 w-11 items-center justify-center text-slate-200 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 cursor-pointer"
                title={t('Perkecil peta')}
                aria-label={t('Perkecil peta')}
              >
                <ZoomOut className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleZoomAction('reset')}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-all hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer text-slate-300"
              title={t('Reset ke Indonesia')}
              aria-label={t('Reset peta ke Indonesia')}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={locateMe}
              disabled={locating}
              aria-label={t('Tampilkan lokasi saya')}
              title={locateError ?? t('Lokasi saya')}
              data-purpose="locate-me"
              className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-all hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer ${myLocation ? 'text-blue-300 ring-1 ring-blue-400/60' : 'text-slate-300'}`}
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            </button>
            <div className="flex gap-2">
              {/* Master on/off for all API data layers (BMKG, cuaca, FIRMS, MAGMA, VAAC) */}
              <button
                type="button"
                onClick={toggleApiLayers}
                aria-pressed={showApiLayers}
                aria-label={showApiLayers ? t('Sembunyikan layer data API') : t('Tampilkan layer data API')}
                title={showApiLayers ? t('Sembunyikan layer data API') : t('Tampilkan layer data API')}
                data-purpose="api-layers-toggle"
                className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-all hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${showApiLayers ? 'text-emerald-300 ring-1 ring-emerald-400/60' : 'text-slate-400'}`}
              >
                {showApiLayers ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
              </button>
              {showMagma && (
                <button
                  type="button"
                  onClick={() => setShowMagmaLegend((v) => !v)}
                  aria-expanded={showMagmaLegend}
                  aria-controls="magma-legend"
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-all hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer ${showMagmaLegend ? 'text-amber-300 ring-1 ring-amber-400/60' : 'text-slate-300'}`}
                  title={showMagmaLegend ? t('Sembunyikan legenda MAGMA') : t('Tampilkan legenda MAGMA')}
                  data-purpose="magma-legend-toggle"
                >
                  <Info className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>


        </div>


        <div className="map-bottom-actions pointer-events-auto min-w-0 flex flex-col items-stretch gap-2">
          {!isExpanded && !isRouteOpen && !isReportsOpen && isSidebarMinimized && onStartAIChat && <MapChatComposer onSend={onStartAIChat} />}
          {mapActionSlot}
        </div>

      </div>

    </section>
  );
};
