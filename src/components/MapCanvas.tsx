import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Layers,
  MapPin,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  X,
} from 'lucide-react';
import { DisasterIncident, DisasterCategory } from '../types';
import { uniqueAreaNames, type EarthquakeEvent, type BmkgWeatherWarning } from '../services/bmkg';
import { buildBmkgPopupHtml, buildBmkgWeatherPopupHtml } from './map/bmkgPopup';
import { FIRMS_SOURCE_URL, type FireHotspot, type FirmsStatus } from '../services/firms';
import { GoogleFireOverlay } from './map/GoogleFireOverlay';
import { useCityWeather, type CityWeather } from '../services/weather/cityWeather';
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

const ASH_FILL = '#64748b';
const ASH_FCST = '#94a3b8';

function formatUtc(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : iso;
}

/** FL070 → "±2,1 km" (flight level = hundreds of feet). */
function flToKm(levels: string | null): string {
  const m = levels?.match(/FL(\d{3})$/);
  return m ? ` (±${((Number(m[1]) * 100 * 0.3048) / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km)` : '';
}

function ashPopupHtml(a: AshAdvisory): string {
  const c = a.current;
  return (
    `<div style="font-size:12px;line-height:1.45;max-width:270px">` +
    `<div style="font-weight:800">🌫 ABU VULKANIK — G. ${escHtml(a.volcano)}</div>` +
    (a.terminated
      ? `<div><b>Advisory diakhiri</b> (abu diperkirakan sudah hilang)</div>`
      : c && c.polygon.length >= 3
        ? `<div>Awan abu (${c.label === 'OBS' ? 'teramati' : 'estimasi'}): <b>${escHtml(c.levels ?? '-')}</b>${flToKm(c.levels)}${c.movement ? ` • ${escHtml(c.movement)}` : ''}</div>`
        : `<div>Awan abu tidak teridentifikasi di citra satelit</div>`) +
    (a.forecasts.length ? `<div style="color:#64748b">Prakiraan sebaran: ${a.forecasts.map((f) => escHtml(f.label)).join(', ')} (garis putus-putus)</div>` : '') +
    `<div style="color:#64748b">Diterbitkan: ${formatUtc(a.issuedAt)}${a.advisoryNr ? ` • No. ${escHtml(a.advisoryNr)}` : ''}</div>` +
    (a.infoSource ? `<div style="color:#64748b;font-size:11px">Info: ${escHtml(a.infoSource)}</div>` : '') +
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
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : iso;
}

/** "N erupsi (7 hari)" + latest few notices. */
function eruptionListHtml(notices: EruptionNotice[], rangeLabel: string): string {
  if (notices.length === 0) return `<div style="color:#64748b">Tidak ada laporan erupsi (${escHtml(rangeLabel)})</div>`;
  const rows = notices
    .slice(0, 5)
    .map(
      (n) =>
        `<li>${formatEruptionDay(n.at)} ${escHtml(n.localTime)}${n.ashColumnM ? ` • kolom abu ±${n.ashColumnM.toLocaleString('id-ID')} m` : ''}</li>`,
    )
    .join('');
  return (
    `<div style="margin-top:2px"><b style="color:#e11d48">${notices.length} erupsi</b> (${escHtml(rangeLabel)})</div>` +
    `<ul style="margin:2px 0 0 14px;padding:0;list-style:disc;color:#475569">${rows}</ul>` +
    (notices.length > 5 ? `<div style="color:#64748b">+${notices.length - 5} lainnya</div>` : '')
  );
}

function volcanoPopupHtml(v: Volcano, notices: EruptionNotice[] = [], rangeLabel = ''): string {
  return (
    `<div style="font-size:12px;line-height:1.45">` +
    `<div style="font-weight:800">🌋 G. ${escHtml(v.name)}</div>` +
    `<div>Status: <b style="color:${VOLCANO_LEVEL_COLOR[v.level]}">${VOLCANO_LEVEL_LABEL[v.level]}</b></div>` +
    `<div>${escHtml(v.regency)}, ${escHtml(v.province)}${v.elevationM ? ` • ${v.elevationM} mdpl` : ''}</div>` +
    eruptionListHtml(notices, rangeLabel) +
    (v.noticeNumber ? `<div style="color:#64748b">Laporan: ${escHtml(v.noticeNumber)}${v.hasVona ? ' • VONA tersedia' : ''}</div>` : '') +
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

/** True when a landslide report date (YYYY-MM-DD, local) falls inside the range. */
function landslideInRange(l: LandslideReport, start: Date, end: Date): boolean {
  const t = new Date(`${l.date}T12:00:00`).getTime();
  return Number.isFinite(t) && t >= start.getTime() - 12 * 3600_000 && t <= end.getTime() + 12 * 3600_000;
}

function landslidePopupHtml(l: LandslideReport): string {
  return (
    `<div style="font-size:12px;line-height:1.45">` +
    `<div style="font-weight:800">⛰ GERAKAN TANAH</div>` +
    `<div><b>${escHtml(l.regency)}</b>, ${escHtml(l.province)}</div>` +
    (l.movementType ? `<div>Jenis: <b>${escHtml(l.movementType)}</b>${l.material ? ` (${escHtml(l.material)})` : ''}</div>` : '') +
    (l.zone ? `<div>Zona kerentanan: <b>${escHtml(l.zone)}</b></div>` : '') +
    `<div style="color:#64748b">Tanggal kejadian: ${escHtml(l.date)}</div>` +
    `<a href="${MAGMA_LANDSLIDE_URL}" target="_blank" rel="noopener noreferrer" style="color:#b45309">Source: MAGMA Indonesia (PVMBG)</a>` +
    `</div>`
  );
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Compact map chip: icon + temperature + city name. */
function cityWeatherChipHtml(c: CityWeather): string {
  const w = c.weather;
  return (
    `<div class="flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-white/95 border border-sky-300 shadow-md whitespace-nowrap cursor-pointer transform -translate-x-1/2 -translate-y-1/2">` +
    `<img src="${escHtml(w.iconUrl)}" alt="" class="w-5 h-5" />` +
    `<span class="text-[11px] font-black text-slate-900">${Math.round(w.temperature)}°</span>` +
    `<span class="text-[10px] font-semibold text-slate-600">${escHtml(c.name)}</span>` +
    `</div>`
  );
}

function cityWeatherPopupHtml(c: CityWeather): string {
  const w = c.weather;
  return (
    `<div style="font-size:12px;line-height:1.45">` +
    `<div style="font-weight:800">⛅ ${escHtml(c.name)}</div>` +
    `<div><b>${Math.round(w.temperature)}°C</b> (terasa ${Math.round(w.feelsLike)}°C) • ${escHtml(w.conditionText)}</div>` +
    `<div>Hujan: <b>${w.rainProbability}%</b> • Kelembapan: <b>${w.humidity}%</b> • Angin: <b>${Math.round(w.windSpeed)} km/j</b></div>` +
    `<div style="color:#64748b;font-size:11px">Source: Google Weather</div>` +
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
    ? new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : iso;
}

function buildFirePopupHtml(h: FireHotspot): string {
  return (
    `<div style="font-size:12px;line-height:1.45">` +
    `<div style="font-weight:800;letter-spacing:.03em">🔥 TITIK PANAS (HOTSPOT)</div>` +
    `<div>FRP: <b>${h.frp.toFixed(1)} MW</b> • Confidence: <b>${h.confidence}</b></div>` +
    `<div>Koordinat: <b>${h.latitude.toFixed(3)}, ${h.longitude.toFixed(3)}</b></div>` +
    (h.count > 1 ? `<div><b>${h.count}</b> deteksi di area ±1 km</div>` : '') +
    `<div style="color:#64748b">Deteksi: ${formatFireTime(h.acquiredAt)} • ${h.daynight === 'N' ? 'malam' : 'siang'} • ${h.sensor}</div>` +
    `<div style="color:#64748b;font-size:11px;margin-top:2px">Deteksi satelit, belum terverifikasi lapangan.</div>` +
    `<a href="${FIRMS_SOURCE_URL}" target="_blank" rel="noopener noreferrer" style="color:#ea580c">Source: NASA FIRMS</a>` +
    `</div>`
  );
}
import { WeatherCard } from './WeatherCard';
import { WeatherDetailSidebar } from './WeatherDetailSidebar';

interface MapCanvasProps {
  disasters: Record<string, DisasterIncident>;
  activeDisasterKey: string;
  onSelectDisaster: (id: string) => void;
  activeCategory: DisasterCategory | 'all';
  isDarkMode: boolean;
  onExpandView: () => void;
  onOpenAIHelpdesk: () => void;
  isExpanded: boolean;
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
  firmsHotspots?: FireHotspot[];
  firmsStatus?: FirmsStatus['state'];
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
  zoomTrigger: { action: 'in' | 'out' | 'reset'; id: number } | null;
  mapType: GoogleMapType;
  onZoomChange: (zoom: number) => void;
  weatherFocusCoords?: { lat: number; lng: number } | null;
}> = ({ activeDisaster, isRouteOpen, routePoints, zoomTrigger, mapType, onZoomChange, weatherFocusCoords }) => {
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
    const currentZ = map.getZoom() || 5;
    if (currentZ < 7) {
      map.setZoom(7);
    }
  }, [map, activeDisaster?.id]);

  useEffect(() => {
    if (!map || !isRouteOpen || routePoints.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    routePoints.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds, { top: 90, bottom: 90, left: 90, right: 90 });
  }, [map, isRouteOpen, routePoints]);

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

  return null;
};

// OpenStreetMap Component
const OSMMapRenderer: React.FC<{
  disasters: Record<string, DisasterIncident>;
  activeDisasterKey: string;
  onSelectDisaster: (id: string) => void;
  activeCategory: DisasterCategory | 'all';
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
  cityWeather?: CityWeather[];
  magma?: MagmaData | null;
  showMagma?: boolean;
  ashAdvisories?: AshAdvisory[];
  showAsh?: boolean;
  magmaEruptions?: EruptionNotice[];
  magmaRange?: ResolvedRange | null;
}> = ({
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
  cityWeather = [],
  magma = null,
  showMagma = false,
  ashAdvisories = [],
  showAsh = false,
  magmaEruptions = [],
  magmaRange = null,
}) => {
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
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [calloutPos, setCalloutPos] = useState<{ x: number; y: number } | null>(null);
  const activeData = disasters[activeDisasterKey];
  // User can dismiss the callout with the X button; re-opens on next marker click.
  const [calloutClosed, setCalloutClosed] = useState(false);
  useEffect(() => setCalloutClosed(false), [activeDisasterKey]);
  // Bumped every time the Leaflet map is (re)created so imperative layers
  // (BMKG) re-render without any user action after a map reset.
  const [mapEpoch, setMapEpoch] = useState(0);

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

  const updatePos = useCallback(() => {
    if (!mapRef.current || !activeData || !activeData.coords) {
      setCalloutPos(null);
      return;
    }
    const { lat, lng } = activeData.coords;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    const pt = mapRef.current.latLngToContainerPoint([lat, lng]);
    setCalloutPos({ x: pt.x, y: pt.y });
  }, [activeData]);

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

    map.on('move', updatePos);
    map.on('zoomend', () => {
      onZoomChange(map.getZoom());
      updatePos();
    });

    mapRef.current = map;
    setMapEpoch((e) => e + 1);
    setTimeout(() => {
      map.invalidateSize();
      updatePos();
    }, 150);

    return () => {
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
      let categoryBg = 'bg-rose-600';
      let icon = '🌋';
      if (incident.category === 'flood') {
        categoryBg = 'bg-sky-500';
        icon = '🌊';
      } else if (incident.category === 'fire') {
        categoryBg = 'bg-amber-500';
        icon = '🔥';
      }

      const html = isSelected
        ? `<div class="relative flex items-center justify-center cursor-pointer transform -translate-x-1/2 -translate-y-1/2">
            <span class="w-10 h-10 rounded-full bg-amber-400/30 border-2 border-amber-400 flex items-center justify-center pulse-selected">
              <span class="w-7 h-7 rounded-full bg-amber-500 border-2 border-slate-900 shadow-2xl flex items-center justify-center text-white font-bold text-xs">${icon}</span>
            </span>
            <span class="absolute -bottom-6 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900/90 text-amber-300 border border-amber-400/40 shadow-md whitespace-nowrap pointer-events-none">${incident.name.split(',')[0]}</span>
          </div>`
        : `<div class="relative flex items-center justify-center cursor-pointer group transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform">
            <span class="w-7 h-7 rounded-full ${categoryBg} border-2 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-white text-[11px] group-hover:ring-4 group-hover:ring-white/30 transition-all">${icon}</span>
            <span class="opacity-0 group-hover:opacity-100 absolute -bottom-6 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900/90 text-white border border-white/20 shadow-md whitespace-nowrap pointer-events-none transition-opacity">${incident.name.split(',')[0]}</span>
          </div>`;

      const m = L.marker([lat, lng], {
        icon: L.divIcon({ html, className: 'disaster-osm-marker', iconSize: [32, 32], iconAnchor: [16, 16] }),
        zIndexOffset: isSelected ? 1000 : 100,
      });

      m.on('click', () => {
        setCalloutClosed(false);
        onSelectDisaster(incident.id);
        map.flyTo([lat, lng], Math.max(map.getZoom(), 7), { duration: 1.0 });
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
  }, [disasters, activeCategory, activeDisasterKey, onSelectDisaster, updatePos]);

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
        title: `BMKG M${mag} — ${e.region}`,
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
    if (!showWeather || weatherStatus === 'unavailable') return;
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
        poly.bindTooltip(`BMKG ⛈ ${w.event} — ${a.name ?? 'Indonesia'}`, { sticky: true });
        wGroup.addLayer(poly);
      });
    });
  }, [bmkgWeather, showWeather, weatherStatus, mapEpoch]);

  // Major-city weather chips (only while CUACA layer is ON)
  useEffect(() => {
    const cGroup = cityWeatherLayerRef.current;
    if (!mapRef.current || !cGroup) return;
    cGroup.clearLayers();
    if (!showWeather) return;
    cityWeather.forEach((c) => {
      L.marker([c.lat, c.lng], {
        icon: L.divIcon({ html: cityWeatherChipHtml(c), className: 'city-weather-marker', iconSize: [0, 0] }),
        zIndexOffset: 300,
        title: `Cuaca ${c.name}`,
      })
        .bindPopup(cityWeatherPopupHtml(c), { maxWidth: 260, closeButton: true, className: 'bmkg-popup' })
        .addTo(cGroup);
    });
  }, [cityWeather, showWeather, mapEpoch]);

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
        title: `Gerakan tanah — ${l.regency}`,
      })
        .bindPopup(landslidePopupHtml(l), { maxWidth: 280, closeButton: true, className: 'bmkg-popup' })
        .addTo(g);
    });
    magma.volcanoes.forEach((v) => {
      const notices = byVolcano.get(v.name.toLowerCase()) ?? [];
      L.marker([v.latitude, v.longitude], {
        icon: L.divIcon({ html: volcanoMarkerHtml(v, notices.length), className: 'magma-volcano-marker', iconSize: [0, 0] }),
        zIndexOffset: 400 + v.level * 10 + (notices.length ? 50 : 0),
        title: `G. ${v.name} — ${VOLCANO_LEVEL_LABEL[v.level]}${notices.length ? ` • ${notices.length} erupsi` : ''}`,
      })
        .bindPopup(volcanoPopupHtml(v, notices, magmaRange?.label ?? ''), { maxWidth: 280, closeButton: true, className: 'bmkg-popup' })
        .addTo(g);
    });
  }, [magma, showMagma, mapEpoch, magmaEruptions, magmaRange]);

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
        title: `Abu vulkanik — G. ${a.volcano}`,
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
    const checkpoints = activeData.route.checkpoints || [];
    const pts: [number, number][] = [];

    checkpoints.forEach((cp, idx) => {
      let lat = cp.lat;
      let lng = cp.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        lat = activeData.coords.lat - 0.2 + idx * 0.1;
        lng = activeData.coords.lng - 0.2 + idx * 0.1;
      }
      pts.push([lat, lng]);

      const cpMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div class="flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2"><div class="w-6 h-6 rounded-full bg-slate-900 border-2 border-orange-400 text-orange-300 font-black text-[10px] flex items-center justify-center shadow-lg">${idx + 1}</div></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        zIndexOffset: 800,
      });
      rGroup.addLayer(cpMarker);
    });

    if (pts.length >= 2) {
      rGroup.addLayer(L.polyline(pts, { color: '#ea580c', weight: 8, opacity: 0.35 }));
      rGroup.addLayer(L.polyline(pts, { color: '#f97316', weight: 3.5, opacity: 0.95, dashArray: '8, 8' }));
      map.fitBounds(L.latLngBounds(pts), { padding: [90, 90], animate: true, duration: 1.0 });
    }
  }, [isRouteOpen, activeData]);

  return (
    <>
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-0" />
      {calloutPos && !calloutClosed && activeData && (activeCategory === 'all' || activeData.category === activeCategory) && (
        <div
          id="activeCallout"
          style={{
            left: `${calloutPos.x}px`,
            top: `${calloutPos.y}px`,
            transform: 'translate(-50%, -125%)',
          }}
          className="pointer-events-auto absolute z-40 min-w-[280px] map-glass-callout rounded-2xl p-3.5 shadow-2xl border border-white/20 text-white animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-xs">
              {activeData.urgency}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>{activeData.timestamp}</span>
            </span>
            <button
              type="button"
              aria-label="Tutup popup"
              title="Tutup"
              onClick={(e) => {
                e.stopPropagation();
                setCalloutClosed(true);
              }}
              className="ml-2 w-5 h-5 shrink-0 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="text-base font-black text-white tracking-tight leading-snug truncate">{activeData.name}</div>
          <div className="text-[11px] text-slate-300 mb-1.5 flex items-center justify-between">
            <span>{activeData.province}</span>
            <span className="text-[10px] text-cyan-300 font-mono font-medium">
              {activeData.coords.lat.toFixed(2)}°, {activeData.coords.lng.toFixed(2)}°
            </span>
          </div>
          <div className="text-xs font-semibold text-amber-300 mb-2">{activeData.fullName}</div>
          <div className="pt-2 border-t border-white/15 flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDetail) onOpenDetail();
                else onExpandView();
              }}
              className="flex-1 py-1.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Zap className="w-3 h-3 text-white fill-white" />
              <span>Detail</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenRoute) onOpenRoute();
                else if (onToggleRoute) onToggleRoute();
              }}
              className="flex-1 py-1.5 px-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Compass className="w-3 h-3" />
              <span>Rute</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenReports) onOpenReports();
                else if (onToggleReports) onToggleReports();
              }}
              className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Camera className="w-3 h-3" />
              <span>Laporan</span>
            </button>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 map-glass-callout border-b border-r border-white/20 transform rotate-45"></div>
        </div>
      )}
    </>
  );
};

export const MapCanvas: React.FC<MapCanvasProps> = ({
  disasters,
  activeDisasterKey,
  onSelectDisaster,
  activeCategory,
  isDarkMode,
  onExpandView,
  onOpenAIHelpdesk,
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
  firmsHotspots = [],
  firmsStatus = 'idle',
  firmsRangeLabel = '',
  firmsSensors = '',
  selectedDate = 'Today',
  bmkgWeather = [],
  weatherStatus = 'idle',
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [showBmkg, setShowBmkg] = useState(true);
  const [selectedBmkgId, setSelectedBmkgId] = useState<string | null>(null);
  const [showFirms, setShowFirms] = useState(false);
  const [selectedFire, setSelectedFire] = useState<FireHotspot | null>(null);
  // Close a stale popup when the date range (dataset) changes.
  useEffect(() => setSelectedFire(null), [firmsHotspots]);
  const [gCalloutClosed, setGCalloutClosed] = useState(false);
  useEffect(() => setGCalloutClosed(false), [activeDisasterKey]);
  // Coordinates to pan/fly to when user clicks "Fokus Peta" in WeatherDetailSidebar
  const [weatherFocusCoords, setWeatherFocusCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showWeather, setShowWeather] = useState(true);
  const [selectedWeatherId, setSelectedWeatherId] = useState<string | null>(null);
  const activeWeather = useMemo(
    () => bmkgWeather.filter((w) => w.status === 'ACTIVE'),
    [bmkgWeather],
  );
  const selectedWeather = activeWeather.find((w) => w.id === selectedWeatherId) ?? null;
  // Major-city weather points: fetched only while the CUACA layer is ON.
  const cityWx = useCityWeather(showWeather);
  // MAGMA (PVMBG): off by default; fetched only when toggled ON.
  const [showMagma, setShowMagma] = useState(false);
  const magmaFeed = useMagma(showMagma);
  const [selectedMagma, setSelectedMagma] = useState<
    { kind: 'volcano'; v: Volcano } | { kind: 'landslide'; l: LandslideReport } | null
  >(null);
  // Darwin VAAC volcanic ash: off by default; fetched only when toggled ON.
  const [showAsh, setShowAsh] = useState(false);
  const ash = useVaac(showAsh);
  const [selectedAsh, setSelectedAsh] = useState<AshAdvisory | null>(null);
  const activeAshCount = ash.advisories.filter((a) => !a.terminated).length;
  // MAGMA eruption notices ("Informasi Letusan") follow the header date range.
  const eruptions = useMagmaEruptions(showMagma, selectedDate);
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

  // Engine state: start with 'google' if apiKey present, but auto-fallback to 'osm' on RefererNotAllowedMapError
  const [mapEngine, setMapEngine] = useState<MapEngine>(apiKey ? 'google' : 'osm');
  const [googleMapType, setGoogleMapType] = useState<GoogleMapType>('roadmap');
  const [osmTileType, setOsmTileType] = useState<OSMTileType>('osm-standard');
  const [showLayerSelector, setShowLayerSelector] = useState(false);
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

  // Route checkpoint points for Google Maps
  const googleRoutePoints = useMemo<google.maps.LatLngLiteral[]>(() => {
    if (!isRouteOpen || !activeData || !activeData.route) return [];
    const checkpoints = activeData.route.checkpoints || [];
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
                Kunci API Anda dibatasi HTTP Referrer. Tambahkan domain berikut di Google Cloud Console:{' '}
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
              title="Salin domain untuk ditambahkan di Google Cloud Console"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Tersalin!' : 'Salin Domain'}</span>
            </button>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-white/10 cursor-pointer transition-all"
            >
              <span>Buka Google Cloud</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={handleRetryGoogleMaps}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer active:scale-95 transition-all shadow-xs"
              title="Coba hubungkan kembali ke Google Maps"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Coba Lagi</span>
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
            language="id"
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
            >
              <GoogleMapCameraController
                activeDisaster={activeData}
                isRouteOpen={isRouteOpen}
                routePoints={googleRoutePoints}
                zoomTrigger={zoomTrigger}
                mapType={googleMapType}
                onZoomChange={handleZoomChange}
                weatherFocusCoords={weatherFocusCoords}
              />

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
              {isRouteOpen && googleRoutePoints.length >= 2 && (
                <>
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
                  {googleRoutePoints.map((pt, idx) => (
                    <AdvancedMarker key={`gcp-${idx}`} position={pt} zIndex={500}>
                      <div className="flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer">
                        <div className="w-6 h-6 rounded-full bg-slate-900 border-2 border-orange-400 text-orange-300 font-black text-[10px] flex items-center justify-center shadow-xl">
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
                let categoryBg = 'bg-rose-600';
                let categoryIcon = '🌋';
                if (incident.category === 'flood') {
                  categoryBg = 'bg-sky-500';
                  categoryIcon = '🌊';
                } else if (incident.category === 'fire') {
                  categoryBg = 'bg-amber-500';
                  categoryIcon = '🔥';
                }

                return (
                  <AdvancedMarker
                    key={incident.id}
                    position={{ lat, lng }}
                    zIndex={isSelected ? 9999 : 20}
                    onClick={() => {
                      setGCalloutClosed(false);
                      onSelectDisaster(incident.id);
                    }}
                  >
                    <div className="relative flex items-center justify-center">
                      {isSelected && !gCalloutClosed && (
                        <div
                          id="activeCallout"
                          className="pointer-events-auto absolute bottom-12 left-1/2 -translate-x-1/2 z-50 min-w-[280px] map-glass-callout rounded-2xl p-3.5 shadow-2xl border border-white/20 text-white animate-fadeIn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-xs">
                              {incident.urgency}
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                              <span>{incident.timestamp}</span>
                            </span>
                            <button
                              type="button"
                              aria-label="Tutup popup"
                              title="Tutup"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGCalloutClosed(true);
                              }}
                              className="ml-2 w-5 h-5 shrink-0 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-base font-black text-white tracking-tight leading-snug truncate">{incident.name}</div>
                          <div className="text-[11px] text-slate-300 mb-1.5 flex items-center justify-between">
                            <span>{incident.province}</span>
                            <span className="text-[10px] text-cyan-300 font-mono font-medium">
                              {incident.coords.lat.toFixed(2)}°, {incident.coords.lng.toFixed(2)}°
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-amber-300 mb-2">{incident.fullName}</div>
                          <div className="pt-2 border-t border-white/15 flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenDetail) onOpenDetail();
                                else onExpandView();
                              }}
                              className="flex-1 py-1.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              <Zap className="w-3 h-3 text-white fill-white" />
                              <span>Detail</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenRoute) onOpenRoute();
                                else if (onToggleRoute) onToggleRoute();
                              }}
                              className="flex-1 py-1.5 px-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              <Compass className="w-3 h-3" />
                              <span>Rute</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenReports) onOpenReports();
                                else if (onToggleReports) onToggleReports();
                              }}
                              className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Laporan</span>
                            </button>
                          </div>
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 map-glass-callout border-b border-r border-white/20 transform rotate-45"></div>
                        </div>
                      )}

                      {isSelected ? (
                        <div className="relative flex items-center justify-center cursor-pointer">
                          <span className="w-10 h-10 rounded-full bg-amber-400/30 border-2 border-amber-400 flex items-center justify-center pulse-selected">
                            <span className="w-7 h-7 rounded-full bg-amber-500 border-2 border-slate-900 shadow-2xl flex items-center justify-center text-white font-bold text-xs">
                              {categoryIcon}
                            </span>
                          </span>
                          <span className="absolute -bottom-6 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900/90 text-amber-300 border border-amber-400/40 shadow-md whitespace-nowrap pointer-events-none">
                            {incident.name.split(',')[0]}
                          </span>
                        </div>
                      ) : (
                        <div className="relative flex items-center justify-center cursor-pointer group hover:scale-110 transition-transform">
                          <span
                            className={`w-7 h-7 rounded-full ${categoryBg} border-2 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-white text-[11px] group-hover:ring-4 group-hover:ring-white/30 transition-all`}
                          >
                            {categoryIcon}
                          </span>
                          <span className="opacity-0 group-hover:opacity-100 absolute -bottom-6 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900/90 text-white border border-white/20 shadow-md whitespace-nowrap pointer-events-none transition-opacity">
                            {incident.name.split(',')[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  </AdvancedMarker>
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
                  zIndex={9997}
                >
                  <div
                    className="pointer-events-auto mb-2 min-w-[250px] rounded-2xl p-3 shadow-2xl border border-orange-300/40 bg-slate-900/95 text-white"
                    data-purpose="firms-popup"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black tracking-wide">🔥 TITIK PANAS</div>
                      <button
                        type="button"
                        aria-label="Tutup popup"
                        title="Tutup"
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
                      <div className="text-[11px]"><b>{selectedFire.count}</b> deteksi di area ±1 km</div>
                    )}
                    <div className="text-[11px]">Koordinat: <b>{selectedFire.latitude.toFixed(3)}, {selectedFire.longitude.toFixed(3)}</b></div>
                    <div className="text-[10px] text-slate-400">Deteksi: {formatFireTime(selectedFire.acquiredAt)} • {selectedFire.sensor}</div>
                    <div className="text-[10px] text-slate-400">Deteksi satelit, belum terverifikasi lapangan.</div>
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
                  return (
                    <AdvancedMarker
                      key={e.id}
                      position={{ lat: e.latitude, lng: e.longitude }}
                      zIndex={isSel ? 9998 : 30}
                      title={`BMKG M${e.magnitude} — ${e.region}`}
                      onClick={() => setSelectedBmkgId(isSel ? null : e.id)}
                    >
                      <div className="relative flex items-center justify-center" data-purpose="bmkg-marker" data-bmkg-id={e.id}>
                        {isSel && (
                          <div
                            className="pointer-events-auto absolute bottom-10 left-1/2 -translate-x-1/2 z-50 min-w-[260px] rounded-2xl p-3 shadow-2xl border border-cyan-300/40 bg-slate-900/95 text-white"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-black tracking-wide">EARTHQUAKE</div>
                              <button
                                type="button"
                                aria-label="Tutup popup"
                                title="Tutup"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setSelectedBmkgId(null);
                                }}
                                className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-[11px] text-slate-300">Source: <b>BMKG</b></div>
                            <div className="text-[11px]">Magnitude: <b>M{e.magnitude}</b> • Depth: <b>{e.depthKm} km</b></div>
                            <div className="text-[11px]">Location: <b>{e.region}</b></div>
                            <div className="text-[10px] text-slate-400">Time: {e.eventTime}</div>
                            {e.feltArea && <div className="text-[11px]">Felt area: <b>{e.feltArea}</b></div>}
                            {e.mmi && <div className="text-[11px]">MMI: <b>{e.mmi}</b></div>}
                            <a
                              href="https://data.bmkg.go.id/gempabumi/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-cyan-300 underline"
                            >
                              Source: BMKG — data.bmkg.go.id/gempabumi
                            </a>
                          </div>
                        )}
                        <span className="min-w-9 h-7 px-1.5 rounded-full bg-cyan-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-black">
                          M{e.magnitude.toFixed(1)}
                        </span>
                      </div>
                    </AdvancedMarker>
                );
              })}

              {/* BMKG weather warning polygons — ACTIVE only, valid polygons only */}
              {showWeather &&
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
                    title={`Abu vulkanik — G. ${a.volcano}`}
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
                <AdvancedMarker position={{ lat: selectedAsh.summit[0], lng: selectedAsh.summit[1] }} zIndex={9994}>
                  <div
                    className="pointer-events-auto mb-7 min-w-[250px] max-w-[290px] rounded-2xl p-3 shadow-2xl border border-slate-300/40 bg-slate-900/95 text-white"
                    data-purpose="ash-popup"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-black tracking-wide">🌫 ABU VULKANIK — G. {selectedAsh.volcano}</div>
                      <button
                        type="button"
                        aria-label="Tutup popup"
                        title="Tutup"
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
                      <div className="text-[11px]"><b>Advisory diakhiri</b> (abu diperkirakan sudah hilang)</div>
                    ) : selectedAsh.current && selectedAsh.current.polygon.length >= 3 ? (
                      <div className="text-[11px]">
                        Awan abu ({selectedAsh.current.label === 'OBS' ? 'teramati' : 'estimasi'}): <b>{selectedAsh.current.levels ?? '-'}</b>
                        {flToKm(selectedAsh.current.levels)}
                        {selectedAsh.current.movement ? ` • ${selectedAsh.current.movement}` : ''}
                      </div>
                    ) : (
                      <div className="text-[11px]">Awan abu tidak teridentifikasi di citra satelit</div>
                    )}
                    {selectedAsh.forecasts.length > 0 && (
                      <div className="text-[10px] text-slate-400">
                        Prakiraan sebaran: {selectedAsh.forecasts.map((f) => f.label).join(', ')} (garis putus-putus)
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400">
                      Diterbitkan: {formatUtc(selectedAsh.issuedAt)}
                      {selectedAsh.advisoryNr ? ` • No. ${selectedAsh.advisoryNr}` : ''}
                    </div>
                    {selectedAsh.infoSource && <div className="text-[10px] text-slate-400">Info: {selectedAsh.infoSource}</div>}
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
                    title={`Gerakan tanah — ${l.regency}`}
                    onClick={() => setSelectedMagma({ kind: 'landslide', l })}
                  >
                    <div className="w-5 h-5 rounded-md bg-amber-800 border-2 border-white shadow flex items-center justify-center text-[10px] cursor-pointer">
                      ⛰
                    </div>
                  </AdvancedMarker>
                ))}
              {showMagma &&
                magmaFeed.data?.volcanoes.map((v) => (
                  <AdvancedMarker
                    key={`gv-${v.code}`}
                    position={{ lat: v.latitude, lng: v.longitude }}
                    zIndex={40 + v.level}
                    title={`G. ${v.name} — ${VOLCANO_LEVEL_LABEL[v.level]}`}
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
                  zIndex={9995}
                >
                  <div
                    className="pointer-events-auto mb-6 min-w-[240px] max-w-[280px] rounded-2xl p-3 shadow-2xl border border-amber-300/40 bg-slate-900/95 text-white"
                    data-purpose="magma-popup"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-black tracking-wide">
                        {selectedMagma.kind === 'volcano' ? `🌋 G. ${selectedMagma.v.name}` : '⛰ GERAKAN TANAH'}
                      </div>
                      <button
                        type="button"
                        aria-label="Tutup popup"
                        title="Tutup"
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
                          Status:{' '}
                          <b style={{ color: VOLCANO_LEVEL_COLOR[selectedMagma.v.level] }}>{VOLCANO_LEVEL_LABEL[selectedMagma.v.level]}</b>
                        </div>
                        <div className="text-[11px]">
                          {selectedMagma.v.regency}, {selectedMagma.v.province}
                          {selectedMagma.v.elevationM ? ` • ${selectedMagma.v.elevationM} mdpl` : ''}
                        </div>
                        {(() => {
                          const list = eruptionsByVolcano.get(selectedMagma.v.name.toLowerCase()) ?? [];
                          if (list.length === 0) {
                            return (
                              <div className="text-[10px] text-slate-400">Tidak ada laporan erupsi ({eruptions.range.label})</div>
                            );
                          }
                          return (
                            <div className="text-[11px] mt-0.5">
                              <b className="text-rose-400">{list.length} erupsi</b> ({eruptions.range.label})
                              <ul className="list-disc ml-4 text-[10px] text-slate-300">
                                {list.slice(0, 5).map((n) => (
                                  <li key={n.id}>
                                    {formatEruptionDay(n.at)} {n.localTime}
                                    {n.ashColumnM ? ` • kolom abu ±${n.ashColumnM.toLocaleString('id-ID')} m` : ''}
                                  </li>
                                ))}
                              </ul>
                              {list.length > 5 && <div className="text-[10px] text-slate-400">+{list.length - 5} lainnya</div>}
                            </div>
                          );
                        })()}
                        {selectedMagma.v.noticeNumber && (
                          <div className="text-[10px] text-slate-400">
                            Laporan: {selectedMagma.v.noticeNumber}
                            {selectedMagma.v.hasVona ? ' • VONA tersedia' : ''}
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
                            Jenis: <b>{selectedMagma.l.movementType}</b>
                            {selectedMagma.l.material ? ` (${selectedMagma.l.material})` : ''}
                          </div>
                        )}
                        {selectedMagma.l.zone && <div className="text-[11px]">Zona kerentanan: <b>{selectedMagma.l.zone}</b></div>}
                        <div className="text-[10px] text-slate-400">Tanggal kejadian: {selectedMagma.l.date}</div>
                        <a href={MAGMA_LANDSLIDE_URL} target="_blank" rel="noopener noreferrer" className="text-[11px] text-amber-300 underline">
                          Source: MAGMA Indonesia (PVMBG)
                        </a>
                      </>
                    )}
                  </div>
                </AdvancedMarker>
              )}

              {/* Major-city weather chips (CUACA layer ON only) */}
              {showWeather &&
                cityWx.cities.map((c) => {
                  const isSel = c.id === selectedCityId;
                  const w = c.weather;
                  return (
                    <AdvancedMarker
                      key={`city-${c.id}`}
                      position={{ lat: c.lat, lng: c.lng }}
                      zIndex={isSel ? 9996 : 25}
                      title={`Cuaca ${c.name}`}
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
                                aria-label="Tutup popup"
                                title="Tutup"
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
                              <b>{Math.round(w.temperature)}°C</b> (terasa {Math.round(w.feelsLike)}°C) • {w.conditionText}
                            </div>
                            <div className="text-[11px]">
                              Hujan: <b>{w.rainProbability}%</b> • Lembap: <b>{w.humidity}%</b> • Angin: <b>{Math.round(w.windSpeed)} km/j</b>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Source: Google Weather
                            </div>
                          </div>
                        )}
                        <span className="flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-white/95 border border-sky-300 shadow-md whitespace-nowrap cursor-pointer">
                          <img src={w.iconUrl} alt="" className="w-5 h-5" />
                          <span className="text-[11px] font-black text-slate-900">{Math.round(w.temperature)}°</span>
                          <span className="text-[10px] font-semibold text-slate-600">{c.name}</span>
                        </span>
                      </div>
                    </AdvancedMarker>
                  );
                })}

              {/* Selected weather warning callout */}
              {selectedWeather && (
                <AdvancedMarker
                  position={{
                    lat: selectedWeather.areas.find((a) => a.polygon.length > 0)?.polygon[0]?.[0] ?? -2.5,
                    lng: selectedWeather.areas.find((a) => a.polygon.length > 0)?.polygon[0]?.[1] ?? 118.0,
                  }}
                  zIndex={9997}
                  title={`BMKG ⛈ ${selectedWeather.event}`}
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
                          aria-label="Tutup popup"
                          title="Tutup"
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
            cityWeather={cityWx.cities}
            magma={magmaFeed.data}
            showMagma={showMagma}
            ashAdvisories={ash.advisories}
            showAsh={showAsh}
            magmaEruptions={eruptions.notices}
            magmaRange={eruptions.range}
          />
        )}
      </div>

      {/* Top Left Header Overlay: Active Engine Pill & Layer Switcher */}
      <div className="relative z-30 pt-3 sm:pt-4 px-3 sm:px-6 pointer-events-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar [&>*]:shrink-0 -mx-1 px-1 py-1">
          {/* Active Engine Indicator Pill */}
          <div className="flex items-center gap-2 bg-white/95 dark:bg-[#0b1329]/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/90 dark:border-slate-700/80 shadow-md">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                mapEngine === 'google' && !hasAuthError ? 'bg-blue-500' : 'bg-emerald-500'
              }`}
            ></span>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              <span>{mapEngine === 'google' && !hasAuthError ? 'Google Maps API' : 'OpenStreetMap Live'}</span>
              <span
                className={`hidden lg:inline text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${
                  mapEngine === 'google' && !hasAuthError
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20'
                    : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                }`}
              >
                {mapEngine === 'google' && !hasAuthError ? 'Satelit & Vektor' : 'Peta Cadangan Aman'}
              </span>
            </span>
          </div>

          {/* BMKG official layer toggle */}
          <div className="relative">
            <button
              onClick={() => setShowBmkg((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border shadow-md cursor-pointer transition-all active:scale-95 ${
                showBmkg
                  ? 'bg-cyan-600 text-white border-cyan-500'
                  : 'bg-white/95 dark:bg-[#0b1329]/95 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80'
              }`}
              title="Tampilkan/sembunyikan lapisan gempa BMKG (sumber resmi)"
              data-purpose="bmkg-layer-toggle"
              data-bmkg-visible={showBmkg}
            >
              <span>🌐</span>
              <span>
                {bmkgStatus === 'unavailable'
                  ? 'BMKG N/A'
                  : bmkgStatus === 'ready'
                    ? `BMKG: ${bmkgEvents.length}`
                    : 'BMKG…'}
              </span>
              <span className="text-[9px] opacity-80">{showBmkg ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* NASA FIRMS hotspot layer toggle */}
          <div className="relative">
            <button
              onClick={() => setShowFirms((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border shadow-md cursor-pointer transition-all active:scale-95 ${
                showFirms
                  ? 'bg-orange-600 text-white border-orange-500'
                  : 'bg-white/95 dark:bg-[#0b1329]/95 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80'
              }`}
              title={`Titik panas NASA FIRMS • ${firmsRangeLabel} • ${firmsSensors}. Rentang mengikuti pilihan tanggal di header.`}
              data-purpose="firms-layer-toggle"
              aria-pressed={showFirms}
            >
              <span>🔥</span>
              <span>
                {firmsStatus === 'unavailable'
                  ? 'FIRMS N/A'
                  : firmsStatus === 'ready'
                    ? `FIRMS ${firmsRangeLabel}: ${firmsHotspots.length.toLocaleString('id-ID')}`
                    : `FIRMS ${firmsRangeLabel}…`}
              </span>
              <span className="text-[9px] opacity-80">{showFirms ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* MAGMA (PVMBG) layer toggle: volcano levels + gerakan tanah */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMagma((v) => !v);
                setSelectedMagma(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border shadow-md cursor-pointer transition-all active:scale-95 ${
                showMagma
                  ? 'bg-amber-700 text-white border-amber-600'
                  : 'bg-white/95 dark:bg-[#0b1329]/95 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80'
              }`}
              title={
                magmaFeed.status.state === 'unavailable'
                  ? `MAGMA tidak tersedia: ${magmaFeed.status.reason}`
                  : 'Gunung api (tingkat aktivitas) & gerakan tanah — MAGMA Indonesia, PVMBG Badan Geologi'
              }
              data-purpose="magma-layer-toggle"
              aria-pressed={showMagma}
            >
              <span>🌋</span>
              <span>
                {!showMagma
                  ? 'MAGMA'
                  : magmaFeed.status.state === 'unavailable'
                    ? 'MAGMA N/A'
                    : magmaFeed.status.state === 'ready'
                      ? eruptions.status.state === 'loading'
                        ? `MAGMA ${eruptions.range.label}: memuat erupsi…`
                        : `MAGMA ${eruptions.range.label}: ${magmaCounts.eruptions} erupsi • ${magmaCounts.elevated} ≥ Waspada`
                      : 'MAGMA…'}
              </span>
              <span className="text-[9px] opacity-80">{showMagma ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Darwin VAAC volcanic-ash layer toggle */}
          <div className="relative">
            <button
              onClick={() => {
                setShowAsh((v) => !v);
                setSelectedAsh(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border shadow-md cursor-pointer transition-all active:scale-95 ${
                showAsh
                  ? 'bg-slate-700 text-white border-slate-600'
                  : 'bg-white/95 dark:bg-[#0b1329]/95 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80'
              }`}
              title={
                ash.status.state === 'unavailable'
                  ? `Abu vulkanik tidak tersedia: ${ash.status.reason}`
                  : `Awan abu vulkanik — Volcanic Ash Advisory dari Darwin VAAC (BOM), pusat resmi ICAO untuk wilayah Indonesia${
                      ash.fetchedAt ? ` • data per ${formatUtc(ash.fetchedAt)}` : ''
                    }`
              }
              data-purpose="ash-layer-toggle"
              aria-pressed={showAsh}
            >
              <span>🌫</span>
              <span>
                {!showAsh
                  ? 'ABU VULKANIK'
                  : ash.status.state === 'unavailable'
                    ? 'ABU N/A'
                    : ash.status.state === 'ready'
                      ? `ABU: ${activeAshCount} aktif`
                      : 'ABU…'}
              </span>
              <span className="text-[9px] opacity-80">{showAsh ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* BMKG weather warning layer toggle */}
          <div className="relative">
            <button
              onClick={() => setShowWeather((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border shadow-md cursor-pointer transition-all active:scale-95 ${
                showWeather
                  ? 'bg-orange-500 text-white border-orange-400'
                  : 'bg-white/95 dark:bg-[#0b1329]/95 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80'
              }`}
              title={
                cityWx.error
                  ? `Cuaca kota (Google Weather): ${cityWx.error}`
                  : 'Tampilkan/sembunyikan peringatan cuaca BMKG + cuaca kota besar (Google Weather)'
              }
              data-purpose="bmkg-weather-toggle"
              data-bmkg-weather-visible={showWeather}
            >
              <span>⛈</span>
              <span>
                {cityWx.loading
                  ? 'CUACA…'
                  : `CUACA: ${cityWx.cities.length} kota${weatherStatus === 'ready' ? ` • ${activeWeather.length} peringatan` : ''}`}
              </span>
              <span className="text-[9px] opacity-80">{showWeather ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowLayerSelector(!showLayerSelector)}
              className="flex items-center gap-1.5 bg-white/95 dark:bg-[#0b1329]/95 hover:bg-white text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-slate-200/90 dark:border-slate-700/80 shadow-md cursor-pointer transition-all active:scale-95"
              title="Ganti Pilihan Mesin atau Lapisan Peta"
            >
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span>
                {mapEngine === 'google' && !hasAuthError
                  ? googleMapType === 'roadmap'
                    ? 'Google: Peta Jalan'
                    : googleMapType === 'hybrid'
                    ? 'Google: Satelit'
                    : 'Google: Medan'
                  : osmTileType === 'osm-standard'
                  ? 'OSM Standar'
                  : osmTileType === 'osm-hot'
                  ? 'OSM Bencana (HOT)'
                  : 'OSM Mode Gelap'}
              </span>
            </button>

            {showLayerSelector && (
              <div className="fixed sm:absolute left-3 sm:left-0 mt-2 w-56 max-h-[60vh] overflow-y-auto bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-2xl z-50 animate-fadeIn">
                {/* Google Maps Section */}
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Google Maps Platform
                </div>
                <button
                  onClick={() => {
                    setMapEngine('google');
                    setGoogleMapType('roadmap');
                    setHasAuthError(false);
                    setShowLayerSelector(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    mapEngine === 'google' && googleMapType === 'roadmap' && !hasAuthError
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Peta Jalan (Roadmap)</span>
                  {mapEngine === 'google' && googleMapType === 'roadmap' && !hasAuthError && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setMapEngine('google');
                    setGoogleMapType('hybrid');
                    setHasAuthError(false);
                    setShowLayerSelector(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    mapEngine === 'google' && googleMapType === 'hybrid' && !hasAuthError
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Satelit Citra (Hybrid)</span>
                  {mapEngine === 'google' && googleMapType === 'hybrid' && !hasAuthError && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setMapEngine('google');
                    setGoogleMapType('terrain');
                    setHasAuthError(false);
                    setShowLayerSelector(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    mapEngine === 'google' && googleMapType === 'terrain' && !hasAuthError
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Peta Medan (Terrain)</span>
                  {mapEngine === 'google' && googleMapType === 'terrain' && !hasAuthError && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  )}
                </button>

                <div className="h-px bg-slate-200 dark:bg-slate-700/60 my-1.5"></div>

                {/* OpenStreetMap Section */}
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  OpenStreetMap (Cadangan Bebas Quota)
                </div>
                <button
                  onClick={() => {
                    setMapEngine('osm');
                    setOsmTileType('osm-standard');
                    setShowLayerSelector(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    mapEngine === 'osm' && osmTileType === 'osm-standard'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>OSM Standar</span>
                  {mapEngine === 'osm' && osmTileType === 'osm-standard' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setMapEngine('osm');
                    setOsmTileType('osm-hot');
                    setShowLayerSelector(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    mapEngine === 'osm' && osmTileType === 'osm-hot'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>OSM Bencana (HOT)</span>
                  {mapEngine === 'osm' && osmTileType === 'osm-hot' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setMapEngine('osm');
                    setOsmTileType('osm-dark');
                    setShowLayerSelector(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    mapEngine === 'osm' && osmTileType === 'osm-dark'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>OSM Mode Gelap</span>
                  {mapEngine === 'osm' && osmTileType === 'osm-dark' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Google Weather Live Pill for Currently Selected Incident */}
          {activeData && typeof activeData.coords?.lat === 'number' && (
            <div
              className="cursor-pointer transition-transform hover:scale-105 active:scale-95 hidden md:block"
              onClick={() => onOpenWeather?.()}
              title={`Cuaca lapangan Google di ${activeData.name} — Klik untuk detail cuaca & titik peta`}
            >
              <WeatherCard
                lat={activeData.coords.lat}
                lng={activeData.coords.lng}
                locationName={activeData.name}
                disasterCategory={activeData.category}
                compact={true}
              />
            </div>
          )}
        </div>

        {/* Floating Restore Pill on the top right when sidebar is minimized AND NO panel is open */}
        {isSidebarMinimized &&
          !isExpanded &&
          !isRouteOpen &&
          !isDetailOpen &&
          !isReportsOpen && (
            <button
              onClick={onToggleSidebar}
              className="shrink-0 flex items-center gap-2 bg-white/95 dark:bg-[#0b1329]/90 hover:bg-white text-slate-800 dark:text-slate-200 px-3 md:px-4 py-2 rounded-full font-bold text-xs shadow-xl border border-slate-200/90 dark:border-slate-700/70 backdrop-blur-md transition-all active:scale-95 group cursor-pointer hover:shadow-2xl animate-fadeIn"
              title="Buka / Tampilkan Sidebar Menu"
            >
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              <span className="hidden md:inline">Buka Menu Sidebar</span>
              <PanelRightOpen className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
      </div>

      {/* Bottom Bar: Controls & Quick Action Buttons */}
      <div className="relative z-30 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-end sm:justify-between px-3 sm:px-6 lg:px-8 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-6 pointer-events-auto">
        {/* MAGMA legend — bottom-left, directly above the zoom controls (only while MAGMA is ON) */}
        {showMagma && (
          <div
            className="absolute left-3 sm:left-6 lg:left-8 bottom-full mb-2 w-48 sm:w-56 max-h-[45vh] overflow-y-auto rounded-2xl border border-slate-200/90 dark:border-slate-700/70 bg-white/95 dark:bg-[#0b1329]/95 backdrop-blur-md p-3 shadow-lg text-[11px] text-slate-700 dark:text-slate-200 animate-fadeIn"
            data-purpose="magma-legend"
            role="region"
            aria-label="Legenda MAGMA"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Legenda MAGMA</span>
              <span className="text-[9px] text-slate-400">PVMBG</span>
            </div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Tingkat aktivitas gunung api</div>
            <ul className="space-y-1 mb-2">
              {([4, 3, 2, 1] as const).map((lvl) => (
                <li key={lvl} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3 L22 21 H2 Z" fill={VOLCANO_LEVEL_COLOR[lvl]} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  <span>{VOLCANO_LEVEL_LABEL[lvl]}</span>
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span className="relative flex h-3.5 w-3.5 items-center justify-center" aria-hidden="true">
                  <span className="absolute inset-0 rounded-full bg-orange-500/40 animate-ping"></span>
                  <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                </span>
                <span>Berdenyut = ada erupsi ({eruptions.range.label})</span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="min-w-4 h-4 px-1 rounded-full bg-rose-600 border border-white text-white text-[9px] font-black leading-[14px] text-center"
                  aria-hidden="true"
                >
                  3
                </span>
                <span>Jumlah laporan erupsi</span>
              </li>
            </ul>
            <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/80 dark:border-slate-700/60">
              <span className="w-4 h-4 rounded bg-amber-800 border border-white shadow-xs flex items-center justify-center text-[8px]" aria-hidden="true">⛰</span>
              <span>Laporan gerakan tanah</span>
            </div>
          </div>
        )}

        {/* Bottom Left Map Controls (Zoom & Scale) */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center bg-white/95 dark:bg-[#0b1329]/90 backdrop-blur-md p-1.5 rounded-full border border-slate-200/90 dark:border-slate-700/70 shadow-md gap-1">
            <button
              onClick={() => handleZoomAction('in')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs transition-all cursor-pointer"
              title="Perbesar Peta (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoomAction('out')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs transition-all cursor-pointer"
              title="Perkecil Peta (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoomAction('reset')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center shadow-xs transition-all text-xs font-semibold ml-0.5 cursor-pointer"
              title="Reset Peta ke Tampilan Penuh Indonesia"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Zoom To Active Location / Center Info */}
          <div className="hidden md:flex items-center bg-white/95 dark:bg-[#0b1329]/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200/90 dark:border-slate-700/70 shadow-md text-xs font-medium text-slate-600 dark:text-slate-300 gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                mapEngine === 'google' && !hasAuthError ? 'bg-blue-400' : 'bg-emerald-400'
              }`}
            ></span>
            <span>Zoom: {currentZoom}x</span>
            {activeData && (
              <span className="ml-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                <span>{activeData.name.split(',')[0]}</span>
              </span>
            )}
          </div>
        </div>

        {/* Bottom Action Pill: Detail Bencana, Rute Distribusi, Laporan Warga & AI Helpdesk */}
        {!isExpanded && (
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2.5">
            <button
              onClick={onToggleDetail || onExpandView}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 md:px-4 py-2.5 rounded-full shadow-md border backdrop-blur-md transition-all active:scale-95 text-xs font-bold cursor-pointer ${
                isDetailOpen
                  ? 'bg-amber-500 text-white border-amber-400 ring-2 ring-amber-400/40 shadow-amber-500/30'
                  : 'bg-white/95 dark:bg-[#0b1329]/90 hover:bg-white text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/70'
              }`}
              title="Buka / Tutup Detail Bencana"
            >
              <Zap
                className={`w-4 h-4 ${
                  isDetailOpen ? 'text-white fill-white' : 'text-amber-500 fill-amber-500'
                }`}
              />
              <span className="hidden md:inline">Detail Bencana</span>
              {isDetailOpen && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              )}
            </button>

            <button
              onClick={onToggleRoute}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 md:px-4 py-2.5 rounded-full shadow-md border backdrop-blur-md transition-all active:scale-95 text-xs font-bold cursor-pointer ${
                isRouteOpen
                  ? 'bg-orange-500 text-white border-orange-400 ring-2 ring-orange-400/40 shadow-orange-500/30'
                  : 'bg-white/95 dark:bg-[#0b1329]/90 hover:bg-white text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/70'
              }`}
              title="Buka / Tutup Halaman Rute Distribusi"
            >
              <Compass
                className={`w-4 h-4 ${isRouteOpen ? 'text-white' : 'text-orange-500'}`}
              />
              <span className="hidden md:inline">Rute Distribusi</span>
              {isRouteOpen && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              )}
            </button>

            <button
              onClick={onToggleReports}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 md:px-4 py-2.5 rounded-full shadow-md border backdrop-blur-md transition-all active:scale-95 text-xs font-bold cursor-pointer ${
                isReportsOpen
                  ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-600/30'
                  : 'bg-white/95 dark:bg-[#0b1329]/90 hover:bg-white text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/70'
              }`}
              title="Buka / Tutup Laporan Warga Lapangan"
            >
              <Camera
                className={`w-4 h-4 ${isReportsOpen ? 'text-white' : 'text-emerald-500'}`}
              />
              <span className="hidden md:inline">Laporan Warga</span>
              {isReportsOpen && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              )}
            </button>

            <button
              onClick={onOpenAIHelpdesk}
              className="flex items-center gap-1.5 sm:gap-2 px-3 md:px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg transition-all active:scale-95 text-xs font-bold cursor-pointer border border-white/10"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span><span className="md:hidden">AI Lapor</span><span className="hidden md:inline">AI Helpdesk & Lapor</span></span>
            </button>
          </div>
        )}
      </div>

      {/* Weather Detail Sidebar — opens when user clicks weather pill */}
      {isWeatherOpen && activeData && typeof activeData.coords?.lat === 'number' && (
        <WeatherDetailSidebar
          location={{
            lat: activeData.coords.lat,
            lng: activeData.coords.lng,
            name: activeData.name,
            province: activeData.province,
            category: activeData.category,
          }}
          disaster={activeData}
          onClose={() => onCloseWeather?.()}
          onFocusMap={(coords) => setWeatherFocusCoords(coords)}
          isDarkMode={isDarkMode}
        />
      )}
    </section>
  );
};
