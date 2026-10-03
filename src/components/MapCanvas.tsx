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
  MapPin,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Waves,
  Flame,
  Mountain,
} from 'lucide-react';
import { DisasterIncident, DisasterCategory } from '../types';

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
  onOpenSidebar?: () => void;
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
}> = ({ activeDisaster, isRouteOpen, routePoints, zoomTrigger, mapType, onZoomChange }) => {
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

  return null;
};

const DisasterCallout: React.FC<{
  incident: DisasterIncident;
  className?: string;
  style?: React.CSSProperties;
}> = ({ incident, className = '', style }) => {
  return (
    <div
      id="activeCallout"
      style={{
        ...style,
        background:
          'linear-gradient(135deg, rgba(15, 35, 64, 0.72) 0%, rgba(18, 46, 82, 0.62) 55%, rgba(11, 30, 55, 0.70) 100%)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        boxShadow:
          '0 16px 40px rgba(2, 12, 27, 0.25), inset 0 1px 0 rgba(255,255,255,0.14)',
      }}
      className={`
        pointer-events-auto
        z-40
        min-w-[300px]
        rounded-2xl
        p-4
        border border-white/20
        text-white
        animate-fadeIn
        overflow-visible
        ${className}
      `}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Glass highlight */}
      <div
        className="
          pointer-events-none
          absolute inset-[1px]
          rounded-[15px]
          bg-gradient-to-br
          from-white/[0.08]
          via-white/[0.02]
          to-transparent
        "
      />

      <div className="relative z-10">
        {/* Location */}
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-bold text-white tracking-tight leading-snug">
            {incident.name}
          </span>

          <span className="shrink-0 text-[10px] text-cyan-300/90 font-mono font-medium">
            {incident.coords.lat.toFixed(2)}°, {incident.coords.lng.toFixed(2)}°
          </span>
        </div>

        {/* Province */}
        <div className="mt-1 text-[11px] text-slate-300/90">
          {incident.province}
        </div>

        {/* Disaster + urgency */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-amber-300">
            {incident.fullName}
          </span>

          <span
            className="
              shrink-0
              inline-flex items-center
              px-2.5 py-1
              rounded-full
              text-[10px] font-bold
              bg-rose-500/20
              text-rose-200
              border border-rose-400/35
            "
          >
            {incident.urgency}
          </span>
        </div>

        {/* Divider */}
        <div className="my-3 h-px bg-gradient-to-r from-white/20 via-white/10 to-transparent" />

        {/* Timestamp */}
        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.65)]" />
          <span>{incident.timestamp}</span>
        </div>
      </div>

      {/* Pointer */}
      <div
        className="
          absolute
          -bottom-[7px]
          left-1/2
          -translate-x-1/2
          w-3.5 h-3.5
          rotate-45
          border-r border-b border-white/20
        "
        style={{
          background: 'rgba(15, 35, 64, 0.70)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      />
    </div>
  );
};

const DisasterMarker: React.FC<{
  category: DisasterIncident['category'];
  isSelected?: boolean;
}> = ({ category, isSelected = false }) => {
  const config = {
    flood: {
      Icon: Waves,
      accent: 'text-sky-300',
      background: 'bg-sky-500',
      ring: 'border-sky-400',
      glow: 'shadow-[0_0_18px_rgba(56,189,248,0.45)]',
    },
    fire: {
      Icon: Flame,
      accent: 'text-orange-200',
      background: 'bg-orange-500',
      ring: 'border-orange-400',
      glow: 'shadow-[0_0_18px_rgba(251,146,60,0.45)]',
    },
    earthquake: {
      Icon: Mountain,
      accent: 'text-rose-200',
      background: 'bg-rose-500',
      ring: 'border-rose-400',
      glow: 'shadow-[0_0_18px_rgba(251,113,133,0.45)]',
    },
  };

  const current =
    config[category as keyof typeof config] ?? config.earthquake;

  const Icon = current.Icon;

  return (
    <div className="relative flex items-center justify-center">
      {isSelected && (
        <>
          <span
            className={`
              absolute
              h-11 w-11
              rounded-full
              border
              ${current.ring}
              opacity-30
              animate-ping
            `}
          />

          <span
            className={`
              absolute
              h-10 w-10
              rounded-full
              border
              ${current.ring}
              bg-slate-950/20
              backdrop-blur-md
            `}
          />
        </>
      )}

      <div
        className={`
          relative
          z-10
          flex items-center justify-center
          rounded-full
          border-2 border-white/80
          ${current.background}
          ${current.glow}
          transition-all duration-200
          ${
            isSelected
              ? 'h-8 w-8 scale-110'
              : 'h-7 w-7 hover:scale-110'
          }
        `}
      >
        <Icon
          className={`
            ${isSelected ? 'h-4 w-4' : 'h-3.5 w-3.5'}
            ${current.accent}
          `}
          strokeWidth={2.5}
        />
      </div>
    </div>
  );
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
  
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [calloutPos, setCalloutPos] = useState<{ x: number; y: number } | null>(null);
  const activeData = disasters[activeDisasterKey];

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
    markersLayerRef.current = mGroup;
    routeLayerRef.current = rGroup;

    map.on('move', updatePos);
    map.on('zoomend', () => {
      onZoomChange(map.getZoom());
      updatePos();
    });

    mapRef.current = map;
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

      const markerConfig = {
        flood: {
          bg: '#0ea5e9',
          stroke: '#7dd3fc',
          icon: `
            <svg viewBox="0 0 24 24" width="14" height="14"
              fill="none" stroke="white" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12c2.5 2 5 2 7.5 0s5-2 7.5 0 5 2 7 0"/>
              <path d="M2 17c2.5 2 5 2 7.5 0s5-2 7.5 0 5 2 7 0"/>
            </svg>
          `,
        },

        fire: {
          bg: '#f97316',
          stroke: '#fdba74',
          icon: `
            <svg viewBox="0 0 24 24" width="14" height="14"
              fill="none" stroke="white" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22c4 0 7-3 7-7
                0-3-2-5-4-7
                0 2-1 3-2 4
                0-4-2-7-5-10
                0 5-3 7-3 12
                0 4 3 8 7 8z"/>
            </svg>
          `,
        },

        earthquake: {
          bg: '#f43f5e',
          stroke: '#fda4af',
          icon: `
            <svg viewBox="0 0 24 24" width="14" height="14"
              fill="none" stroke="white" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 20l6-10 4 6 2-3 6 7H3z"/>
            </svg>
          `,
        },
      };

      const marker =
        markerConfig[
          incident.category as keyof typeof markerConfig
        ] ?? markerConfig.earthquake;

      const html = `
        <div
          style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            width: 44px;
            height: 44px;
          "
        >
          ${
            isSelected
              ? `
                <span
                  style="
                    position: absolute;
                    width: 42px;
                    height: 42px;
                    border-radius: 9999px;
                    border: 1px solid ${marker.stroke};
                    background: ${marker.bg}22;
                    box-shadow: 0 0 20px ${marker.bg}55;
                  "
                ></span>
              `
              : ''
          }

          <span
            style="
              position: relative;
              z-index: 2;
              width: ${isSelected ? '32px' : '28px'};
              height: ${isSelected ? '32px' : '28px'};
              border-radius: 9999px;
              background: ${marker.bg};
              border: 2px solid rgba(255,255,255,0.85);
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 0 18px ${marker.bg}70;
              transition: transform 180ms ease;
            "
          >
            ${marker.icon}
          </span>

          ${
            isSelected
              ? `
                <span
                  style="
                    position: absolute;
                    top: 48px;
                    left: 50%;
                    transform: translateX(-50%);
                    white-space: nowrap;
                    padding: 4px 10px;
                    border-radius: 9999px;
                    background: rgba(2, 6, 23, 0.78);
                    border: 1px solid rgba(255,255,255,0.15);
                    color: white;
                    font-size: 10px;
                    font-weight: 700;
                    backdrop-filter: blur(12px);
                  "
                >
                  ${incident.name.split(',')[0]}
                </span>
              `
              : ''
          }
        </div>
      `;

      const m = L.marker([lat, lng], {
        icon: L.divIcon({
          html,
          className: 'disaster-osm-marker',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        zIndexOffset: isSelected ? 1000 : 100,
      });

      m.on('click', () => {
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
      {calloutPos &&
        activeData &&
        (activeCategory === 'all' || activeData.category === activeCategory) && (
          <DisasterCallout
            incident={activeData}
            className="absolute"
            style={{
              left: `${calloutPos.x}px`,
              top: `${calloutPos.y}px`,
              transform: 'translate(-50%, -125%)',
            }}
          />
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
  onOpenSidebar,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Engine state: start with 'google' if apiKey present, but auto-fallback to 'osm' on RefererNotAllowedMapError
  const [mapEngine, setMapEngine] = useState<MapEngine>(apiKey ? 'google' : 'osm');
  const [googleMapType, setGoogleMapType] = useState<GoogleMapType>('roadmap');
  const [osmTileType, setOsmTileType] = useState<OSMTileType>('osm-standard');
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

  const handleZoomChange = useCallback((_zoom: number) => {
  // Reserved for future zoom-dependent UI
  }, []);

  const handleSelectDisaster = useCallback(
                  (id: string) => {
                    onSelectDisaster(id);
                    onOpenSidebar?.();
                  },
                  [onSelectDisaster, onOpenSidebar]
                );


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
          
                return (
                  <AdvancedMarker
                    key={incident.id}
                    position={{ lat, lng }}
                    zIndex={isSelected ? 9999 : 20}
                    onClick={() => handleSelectDisaster(incident.id)}
                  >
                    <div className="relative flex items-center justify-center">

                      {isSelected && (
                        <DisasterCallout
                          incident={incident}
                          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50"
                        />
                      )}

                      <DisasterMarker
                        category={incident.category}
                        isSelected={isSelected}
                      />

                      {isSelected && (
                        <span
                          className="
                            absolute
                            top-full mt-2
                            whitespace-nowrap
                            rounded-full
                            border border-white/15
                            bg-slate-950/75
                            px-2.5 py-1
                            text-[10px] font-bold
                            text-white
                            shadow-lg
                            backdrop-blur-md
                            pointer-events-none
                          "
                        >
                          {incident.name.split(',')[0]}
                        </span>
                      )}

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
            onSelectDisaster={handleSelectDisaster}
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
          />
        )}
      </div>

      {/* Bottom Bar: Controls & Quick Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-end justify-between px-6 sm:px-8 pb-6 pointer-events-none">
        {/* Bottom Left Map Controls */}
          <div className="pointer-events-auto flex flex-col gap-2">
            {/* Zoom Controls */}
            <div
              className="
                flex flex-col
                overflow-hidden
                rounded-xl
                border border-white/15
                bg-slate-950/70
                backdrop-blur-xl
                shadow-[0_8px_24px_rgba(0,0,0,0.24)]
              "
            >
              <button
                onClick={() => handleZoomAction('in')}
                className="
                  flex h-9 w-9
                  items-center justify-center
                  text-slate-200
                  transition-colors
                  hover:bg-white/10
                  hover:text-white
                  active:bg-white/15
                "
                title="Perbesar Peta"
                aria-label="Perbesar peta"
              >
                <ZoomIn className="h-4 w-4" />
              </button>

              <div className="mx-2 h-px bg-white/10" />

              <button
                onClick={() => handleZoomAction('out')}
                className="
                  flex h-9 w-9
                  items-center justify-center
                  text-slate-200
                  transition-colors
                  hover:bg-white/10
                  hover:text-white
                  active:bg-white/15
                "
                title="Perkecil Peta"
                aria-label="Perkecil peta"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
            </div>

            {/* Reset Map */}
            <button
              onClick={() => handleZoomAction('reset')}
              className="
                flex h-9 w-9
                items-center justify-center
                rounded-xl
                border border-white/15
                bg-slate-950/70
                text-slate-300
                backdrop-blur-xl
                shadow-[0_8px_24px_rgba(0,0,0,0.24)]
                transition-all
                hover:bg-white/10
                hover:text-white
                active:scale-95
              "
              title="Reset ke Indonesia"
              aria-label="Reset peta ke Indonesia"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
      </div>
    </section>
  );
};
