import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Flame,
  Waves,
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
}

type TileLayerType = 'osm-standard' | 'osm-hot' | 'osm-dark';

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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const hazardCircleRef = useRef<L.Circle | null>(null);

  const [activeCalloutPos, setActiveCalloutPos] = useState<{ x: number; y: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(5);
  const [tileType, setTileType] = useState<TileLayerType>('osm-standard');
  const [showTileSelector, setShowTileSelector] = useState<boolean>(false);

  const activeData = disasters[activeDisasterKey];

  // Tile layer configurations
  const getTileConfig = useCallback((type: TileLayerType, dark: boolean) => {
    if (type === 'osm-hot') {
      return {
        url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>',
        maxZoom: 19,
      };
    }
    if (type === 'osm-dark' || (type === 'osm-standard' && dark)) {
      return {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      };
    }
    return {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    };
  }, []);

  // Update Callout screen position from active marker lat/lng
  const updateCalloutPosition = useCallback(() => {
    if (!mapInstanceRef.current || !activeData || !activeData.coords) {
      setActiveCalloutPos(null);
      return;
    }
    const lat = activeData.coords.lat;
    const lng = activeData.coords.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      setActiveCalloutPos(null);
      return;
    }

    const containerPoint = mapInstanceRef.current.latLngToContainerPoint([lat, lng]);
    setActiveCalloutPos({ x: containerPoint.x, y: containerPoint.y });
  }, [activeData]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Indonesia archipelago
    const initialCenter: [number, number] = [-2.5, 118.0];
    const initialZoom = 5;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false, // We use custom bottom bar zoom controls
      attributionControl: true,
      maxBounds: [
        [-13.5, 92.0], // Southwest bounds (Sumatra/Indian Ocean)
        [9.0, 143.0],  // Northeast bounds (Papua/Pacific Ocean)
      ],
      maxBoundsViscosity: 0.8,
    });

    // Initial tile layer
    const tileConfig = getTileConfig(tileType, isDarkMode);
    const tileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Layer groups for markers & route overlays
    const markersGroup = L.layerGroup().addTo(map);
    const routeGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    routeLayerRef.current = routeGroup;

    // Listeners for position syncing & zoom
    map.on('move', () => {
      updateCalloutPosition();
    });
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
      updateCalloutPosition();
    });

    mapInstanceRef.current = map;

    // Initial callout position update after map renders
    setTimeout(() => {
      map.invalidateSize();
      updateCalloutPosition();
    }, 150);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [getTileConfig, isDarkMode, tileType, updateCalloutPosition]);

  // Handle tile layer change or dark mode toggle
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const tileConfig = getTileConfig(tileType, isDarkMode);

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newTileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  }, [tileType, isDarkMode, getTileConfig]);

  // Invalidate map size when layout/panels change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        updateCalloutPosition();
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [isDetailOpen, isRouteOpen, isReportsOpen, isSidebarMinimized, isExpanded, updateCalloutPosition]);

  // Render Disaster Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;

    markersGroup.clearLayers();

    // Remove existing hazard circle
    if (hazardCircleRef.current) {
      map.removeLayer(hazardCircleRef.current);
      hazardCircleRef.current = null;
    }

    Object.values(disasters).forEach((incident) => {
      const isVisible = activeCategory === 'all' || incident.category === activeCategory;
      if (!isVisible) return;

      const { lat, lng } = incident.coords;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const isSelected = incident.id === activeDisasterKey;

      // Color scheme according to category
      let categoryBg = 'bg-rose-600';
      let categoryBorder = 'border-rose-400';
      let categoryPulse = 'rgba(225, 29, 72, 0.5)';
      let categoryIconHtml = '🌋';

      if (incident.category === 'flood') {
        categoryBg = 'bg-sky-500';
        categoryBorder = 'border-sky-300';
        categoryPulse = 'rgba(14, 165, 233, 0.5)';
        categoryIconHtml = '🌊';
      } else if (incident.category === 'fire') {
        categoryBg = 'bg-amber-500';
        categoryBorder = 'border-amber-300';
        categoryPulse = 'rgba(245, 158, 11, 0.5)';
        categoryIconHtml = '🔥';
      }

      // Custom HTML Marker matching high-tech styling
      const markerHtml = isSelected
        ? `
          <div class="relative flex items-center justify-center cursor-pointer transform -translate-x-1/2 -translate-y-1/2">
            <span class="w-10 h-10 rounded-full bg-amber-400/30 border-2 border-amber-400 flex items-center justify-center pulse-selected">
              <span class="w-7 h-7 rounded-full bg-amber-500 border-2 border-slate-900 shadow-2xl flex items-center justify-center text-white font-bold text-xs">
                ${categoryIconHtml}
              </span>
            </span>
            <span class="absolute -bottom-6 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900/90 text-amber-300 border border-amber-400/40 shadow-md whitespace-nowrap pointer-events-none">
              ${incident.name.split(',')[0]}
            </span>
          </div>
        `
        : `
          <div class="relative flex items-center justify-center cursor-pointer group transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform">
            <span class="w-7 h-7 rounded-full ${categoryBg} border-2 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-white text-[11px] group-hover:ring-4 group-hover:ring-white/30 transition-all">
              ${categoryIconHtml}
            </span>
            <span class="opacity-0 group-hover:opacity-100 absolute -bottom-6 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900/90 text-white border border-white/20 shadow-md whitespace-nowrap pointer-events-none transition-opacity">
              ${incident.name.split(',')[0]}
            </span>
          </div>
        `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'disaster-osm-marker',
        iconSize: isSelected ? [40, 40] : [28, 28],
        iconAnchor: isSelected ? [20, 20] : [14, 14],
      });

      const marker = L.marker([lat, lng], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : 100,
      });

      marker.on('click', () => {
        onSelectDisaster(incident.id);
        map.flyTo([lat, lng], Math.max(map.getZoom(), 7), {
          duration: 1.0,
          easeLinearity: 0.25,
        });
      });

      markersGroup.addLayer(marker);

      // Add emergency perimeter circle for selected incident
      if (isSelected) {
        const hazardCircle = L.circle([lat, lng], {
          radius: incident.category === 'earthquake' ? 25000 : 18000,
          color: incident.category === 'flood' ? '#0ea5e9' : incident.category === 'fire' ? '#f59e0b' : '#e11d48',
          fillColor: incident.category === 'flood' ? '#0ea5e9' : incident.category === 'fire' ? '#f59e0b' : '#e11d48',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '6, 8',
        }).addTo(map);

        hazardCircleRef.current = hazardCircle;
      }
    });

    updateCalloutPosition();
  }, [disasters, activeCategory, activeDisasterKey, onSelectDisaster, updateCalloutPosition]);

  // Draw Evacuation / Distribution Route when Route View is active
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;
    const map = mapInstanceRef.current;
    const routeGroup = routeLayerRef.current;

    routeGroup.clearLayers();

    if (!isRouteOpen || !activeData || !activeData.route) return;

    // Collect route checkpoint points
    const checkpoints = activeData.route.checkpoints || [];
    const routePoints: [number, number][] = [];

    checkpoints.forEach((cp, idx) => {
      let lat = cp.lat;
      let lng = cp.lng;

      // Fallback relative points if checkpoint lat/lng not set
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        const baseLat = activeData.coords.lat;
        const baseLng = activeData.coords.lng;
        lat = baseLat - 0.25 + idx * 0.12;
        lng = baseLng - 0.25 + idx * 0.12;
      }

      routePoints.push([lat, lng]);

      // Checkpoint waypoint marker
      const cpMarkerHtml = `
        <div class="flex items-center justify-center cursor-pointer transform -translate-x-1/2 -translate-y-1/2">
          <div class="w-6 h-6 rounded-full bg-slate-900 border-2 border-orange-400 text-orange-300 font-black text-[10px] flex items-center justify-center shadow-lg">
            ${idx + 1}
          </div>
        </div>
      `;

      const cpIcon = L.divIcon({
        html: cpMarkerHtml,
        className: 'route-checkpoint-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const cpMarker = L.marker([lat, lng], { icon: cpIcon, zIndexOffset: 800 });
      cpMarker.bindTooltip(`<b>${cp.title}</b><br/><span style="font-size:11px">${cp.tag}</span>`, {
        direction: 'top',
        className: 'route-tooltip',
      });
      routeGroup.addLayer(cpMarker);
    });

    if (routePoints.length >= 2) {
      // Glow background line
      const glowLine = L.polyline(routePoints, {
        color: '#ea580c',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
      });

      // Main dashed route line
      const mainLine = L.polyline(routePoints, {
        color: '#f97316',
        weight: 3.5,
        opacity: 0.95,
        dashArray: '8, 8',
        lineCap: 'round',
      });

      routeGroup.addLayer(glowLine);
      routeGroup.addLayer(mainLine);

      // Fit bounds to show the entire route with padding
      const bounds = L.latLngBounds(routePoints);
      map.fitBounds(bounds, {
        padding: [100, 100],
        maxZoom: 10,
        animate: true,
        duration: 1.2,
      });
    }
  }, [isRouteOpen, activeData]);

  // Zoom handlers
  const handleZoom = (dir: 'in' | 'out') => {
    if (!mapInstanceRef.current) return;
    if (dir === 'in') {
      mapInstanceRef.current.zoomIn();
    } else {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleReset = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([-2.5, 118.0], 5, {
      duration: 1.0,
    });
  };

  const handleFlyToDisaster = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([lat, lng], 8, {
      duration: 1.0,
    });
  };

  return (
    <section
      className="col-span-12 h-full overflow-hidden flex flex-col justify-between relative bg-slate-900 select-none"
      data-purpose="map-viewport"
    >
      {/* Leaflet Map Canvas Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full absolute inset-0 z-0"
        style={{ background: isDarkMode ? '#070d18' : '#e2e8f0' }}
      />

      {/* Top Left OpenStreetMap Badge / Layer Switcher */}
      <div className="relative z-30 pt-4 px-6 pointer-events-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* OSM Active Indicator Pill */}
          <div className="flex items-center gap-2 bg-white/95 dark:bg-[#0b1329]/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/90 dark:border-slate-700/80 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              <span>OpenStreetMap Live</span>
              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                Peta Nusantara
              </span>
            </span>
          </div>

          {/* Map Layer Mode Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowTileSelector(!showTileSelector)}
              className="flex items-center gap-1.5 bg-white/95 dark:bg-[#0b1329]/95 hover:bg-white text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-slate-200/90 dark:border-slate-700/80 shadow-md cursor-pointer transition-all active:scale-95"
              title="Ganti Lapisan Peta OpenStreetMap"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-500" />
              <span>
                {tileType === 'osm-standard'
                  ? 'OSM Standar'
                  : tileType === 'osm-hot'
                  ? 'OSM Bencana (HOT)'
                  : 'OSM Mode Gelap'}
              </span>
            </button>

            {showTileSelector && (
              <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 shadow-2xl z-50 animate-fadeIn">
                <button
                  onClick={() => {
                    setTileType('osm-standard');
                    setShowTileSelector(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    tileType === 'osm-standard'
                      ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>OSM Standar</span>
                  {tileType === 'osm-standard' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>}
                </button>
                <button
                  onClick={() => {
                    setTileType('osm-hot');
                    setShowTileSelector(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    tileType === 'osm-hot'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>OSM Bencana (HOT)</span>
                  </span>
                  {tileType === 'osm-hot' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>}
                </button>
                <button
                  onClick={() => {
                    setTileType('osm-dark');
                    setShowTileSelector(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    tileType === 'osm-dark'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>OSM Mode Gelap</span>
                  {tileType === 'osm-dark' && <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Floating Restore Pill on the top right when sidebar is minimized AND NO panel is open */}
        {isSidebarMinimized && !isExpanded && !isRouteOpen && !isDetailOpen && !isReportsOpen && (
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

      {/* Floating Glass Tooltip Anchored onto Active Pin */}
      {activeCalloutPos && activeData && (activeCategory === 'all' || activeData.category === activeCategory) && (
        <div
          id="activeCallout"
          style={{
            left: `${activeCalloutPos.x}px`,
            top: `${activeCalloutPos.y}px`,
            transform: 'translate(-50%, -125%)',
          }}
          className="pointer-events-auto absolute z-40 transition-transform duration-75 min-w-[280px] map-glass-callout rounded-2xl p-3.5 shadow-2xl border border-white/20 text-white animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Row 1: Nama Tempat */}
          <div className="text-sm font-bold text-white tracking-tight leading-snug mb-1 flex items-center justify-between">
            <span className="truncate pr-2">{activeData.name}</span>
            <span className="text-[10px] text-cyan-300 font-mono font-medium">
              {activeData.coords.lat.toFixed(2)}°, {activeData.coords.lng.toFixed(2)}°
            </span>
          </div>
          <div className="text-[11px] text-slate-300 mb-1.5">{activeData.province}</div>

          {/* Row 2: Nama Bencana & Status Urgensi */}
          <div className="flex items-center justify-between text-xs font-medium mb-2">
            <span className="text-amber-300 font-semibold">{activeData.fullName}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-xs">
              {activeData.urgency}
            </span>
          </div>

          {/* Row 3: Waktu Kejadian */}
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300 mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>{activeData.timestamp}</span>
          </div>

          {/* Row 4: Aksi Cepat Callout (Detail, Rute, Laporan) */}
          <div className="pt-2 border-t border-white/15 flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDetail) onOpenDetail();
                else onExpandView();
              }}
              className="flex-1 py-1.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Buka Detail Wilayah Lengkap"
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
              title="Buka Jalur Distribusi Logistik di OpenStreetMap"
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
              title="Lihat Laporan Warga Terverifikasi"
            >
              <Camera className="w-3 h-3" />
              <span>Laporan</span>
            </button>
          </div>

          {/* Pointer notch below */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 map-glass-callout border-b border-r border-white/20 transform rotate-45"></div>
        </div>
      )}

      {/* Bottom Bar: Controls & Quick Action Buttons */}
      <div className="relative z-30 flex items-center justify-between px-6 sm:px-8 pb-6 pointer-events-auto">
        {/* Bottom Left Map Controls (Zoom & Scale) */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center bg-white/95 dark:bg-[#0b1329]/90 backdrop-blur-md p-1.5 rounded-full border border-slate-200/90 dark:border-slate-700/70 shadow-md gap-1">
            <button
              onClick={() => handleZoom('in')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs transition-all cursor-pointer"
              title="Perbesar Peta OpenStreetMap (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoom('out')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs transition-all cursor-pointer"
              title="Perkecil Peta OpenStreetMap (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center shadow-xs transition-all text-xs font-semibold ml-0.5 cursor-pointer"
              title="Reset Peta ke Tampilan Penuh Indonesia"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Zoom To Active Location / Center Info */}
          <div className="hidden md:flex items-center bg-white/95 dark:bg-[#0b1329]/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200/90 dark:border-slate-700/70 shadow-md text-xs font-medium text-slate-600 dark:text-slate-300 gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>Zoom: {currentZoom}x</span>
            {activeData && (
              <button
                onClick={() => handleFlyToDisaster(activeData.coords.lat, activeData.coords.lng)}
                className="ml-1 text-[11px] text-cyan-600 dark:text-cyan-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                title="Fokuskan ke lokasi bencana terpilih"
              >
                <MapPin className="w-3 h-3" />
                <span>Ke {activeData.name.split(',')[0]}</span>
              </button>
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
              <Zap className={`w-4 h-4 ${isDetailOpen ? 'text-white fill-white' : 'text-amber-500 fill-amber-500'}`} />
              <span>Detail Bencana</span>
              {isDetailOpen && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
            </button>

            <button
              onClick={onToggleRoute}
              className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 rounded-full shadow-md border backdrop-blur-md transition-all active:scale-95 text-xs font-bold cursor-pointer ${
                isRouteOpen
                  ? 'bg-orange-500 text-white border-orange-400 ring-2 ring-orange-400/40 shadow-orange-500/30'
                  : 'bg-white/95 dark:bg-[#0b1329]/90 hover:bg-white text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-700/70'
              }`}
              title="Buka / Tutup Halaman Rute Distribusi di OpenStreetMap"
            >
              <Compass className={`w-4 h-4 ${isRouteOpen ? 'text-white' : 'text-orange-500'}`} />
              <span>Rute Distribusi</span>
              {isRouteOpen && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
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
              <Camera className={`w-4 h-4 ${isReportsOpen ? 'text-white' : 'text-emerald-500'}`} />
              <span>Laporan Warga</span>
              {isReportsOpen && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
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
    </section>
  );
};
