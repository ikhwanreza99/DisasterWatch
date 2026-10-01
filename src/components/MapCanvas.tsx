import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Circle,
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
import type { EarthquakeEvent } from '../services/bmkg';
import { buildBmkgPopupHtml } from './map/bmkgPopup';
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const bmkgLayerRef = useRef<L.LayerGroup | null>(null);
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

    const mGroup = L.layerGroup().addTo(map);
    const rGroup = L.layerGroup().addTo(map);
    const bGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = mGroup;
    routeLayerRef.current = rGroup;
    bmkgLayerRef.current = bGroup;

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
          <div className="text-sm font-bold text-white tracking-tight leading-snug mb-0.5 flex items-center justify-between">
            <span className="truncate pr-2">{activeData.name}</span>
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] text-cyan-300 font-mono font-medium">
                {activeData.coords.lat.toFixed(2)}°, {activeData.coords.lng.toFixed(2)}°
              </span>
              <button
                type="button"
                aria-label="Tutup popup"
                title="Tutup"
                onClick={(e) => {
                  e.stopPropagation();
                  setCalloutClosed(true);
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
          <div className="text-[11px] text-slate-300 mb-1.5">{activeData.province}</div>
          <div className="flex items-center justify-between text-xs font-medium mb-2">
            <span className="text-amber-300 font-semibold">{activeData.fullName}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-xs">
              {activeData.urgency}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300 mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>{activeData.timestamp}</span>
          </div>
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
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [showBmkg, setShowBmkg] = useState(true);
  const [selectedBmkgId, setSelectedBmkgId] = useState<string | null>(null);
  const [gCalloutClosed, setGCalloutClosed] = useState(false);
  useEffect(() => setGCalloutClosed(false), [activeDisasterKey]);
  // Coordinates to pan/fly to when user clicks "Fokus Peta" in WeatherDetailSidebar
  const [weatherFocusCoords, setWeatherFocusCoords] = useState<{ lat: number; lng: number } | null>(null);

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
                          <div className="text-sm font-bold text-white tracking-tight leading-snug mb-0.5 flex items-center justify-between">
                            <span className="truncate pr-2">{incident.name}</span>
                            <span className="flex items-center gap-1.5">
                              <span className="text-[10px] text-cyan-300 font-mono font-medium">
                                {incident.coords.lat.toFixed(2)}°, {incident.coords.lng.toFixed(2)}°
                              </span>
                              <button
                                type="button"
                                aria-label="Tutup popup"
                                title="Tutup"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGCalloutClosed(true);
                                }}
                                className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 mb-1.5">{incident.province}</div>
                          <div className="flex items-center justify-between text-xs font-medium mb-2">
                            <span className="text-amber-300 font-semibold">{incident.fullName}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-xs">
                              {incident.urgency}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300 mb-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            <span>{incident.timestamp}</span>
                          </div>
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
          />
        )}
      </div>

      {/* Top Left Header Overlay: Active Engine Pill & Layer Switcher */}
      <div className="relative z-30 pt-4 px-6 pointer-events-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
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
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${
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
              <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-2xl z-50 animate-fadeIn">
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
              className="flex items-center gap-2 bg-white/95 dark:bg-[#0b1329]/90 hover:bg-white text-slate-800 dark:text-slate-200 px-4 py-2 rounded-full font-bold text-xs shadow-xl border border-slate-200/90 dark:border-slate-700/70 backdrop-blur-md transition-all active:scale-95 group cursor-pointer hover:shadow-2xl animate-fadeIn"
              title="Buka / Tampilkan Sidebar Menu"
            >
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              <span>Buka Menu Sidebar</span>
              <PanelRightOpen className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
      </div>

      {/* Bottom Bar: Controls & Quick Action Buttons */}
      <div className="relative z-30 flex items-center justify-between px-6 sm:px-8 pb-6 pointer-events-auto">
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
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              onClick={onToggleDetail || onExpandView}
              className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 rounded-full shadow-md border backdrop-blur-md transition-all active:scale-95 text-xs font-bold cursor-pointer ${
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
              <span>Detail Bencana</span>
              {isDetailOpen && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              )}
            </button>

            <button
              onClick={onToggleRoute}
              className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 rounded-full shadow-md border backdrop-blur-md transition-all active:scale-95 text-xs font-bold cursor-pointer ${
                isRouteOpen
                  ? 'bg-orange-500 text-white border-orange-400 ring-2 ring-orange-400/40 shadow-orange-500/30'
                  : 'bg-white/95 dark:bg-[#0b1329]/90 hover:bg-white text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/70'
              }`}
              title="Buka / Tutup Halaman Rute Distribusi"
            >
              <Compass
                className={`w-4 h-4 ${isRouteOpen ? 'text-white' : 'text-orange-500'}`}
              />
              <span>Rute Distribusi</span>
              {isRouteOpen && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              )}
            </button>

            <button
              onClick={onToggleReports}
              className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 rounded-full shadow-md border backdrop-blur-md transition-all active:scale-95 text-xs font-bold cursor-pointer ${
                isReportsOpen
                  ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-600/30'
                  : 'bg-white/95 dark:bg-[#0b1329]/90 hover:bg-white text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/70'
              }`}
              title="Buka / Tutup Laporan Warga Lapangan"
            >
              <Camera
                className={`w-4 h-4 ${isReportsOpen ? 'text-white' : 'text-emerald-500'}`}
              />
              <span>Laporan Warga</span>
              {isReportsOpen && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              )}
            </button>

            <button
              onClick={onOpenAIHelpdesk}
              className="flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg transition-all active:scale-95 text-xs font-bold cursor-pointer border border-white/10"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>AI Helpdesk & Lapor</span>
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
