import React, { useEffect, useRef, useState, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
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
  Globe,
  RefreshCw,
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

type GoogleMapType = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

// Modern high-contrast dark theme for Google Maps
const googleMapsDarkTheme: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#09101f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#050a14' }, { weight: 3 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#38bdf8' }, { weight: 1.2 }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }, { weight: 0.8 }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0b1329' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#050a16' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
];

// Clean light theme
const googleMapsLightTheme: google.maps.MapTypeStyle[] = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#dbeafe' }],
  },
];

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
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const markersContainerRef = useRef<HTMLDivElement | null>(null);
  const routePolylinesRef = useRef<google.maps.Polyline[]>([]);
  const hazardCircleRef = useRef<google.maps.Circle | null>(null);

  const [activeCalloutPos, setActiveCalloutPos] = useState<{ x: number; y: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(5);
  const [mapType, setMapType] = useState<GoogleMapType>('roadmap');
  const [showTileSelector, setShowTileSelector] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const activeData = disasters[activeDisasterKey];
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Synchronize callout position above active disaster marker
  const updateCalloutPosition = useCallback(() => {
    if (!overlayRef.current || !activeData || !activeData.coords) {
      setActiveCalloutPos(null);
      return;
    }
    const lat = activeData.coords.lat;
    const lng = activeData.coords.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      setActiveCalloutPos(null);
      return;
    }

    const projection = overlayRef.current.getProjection();
    if (!projection) return;

    const pixel = projection.fromLatLngToContainerPixel(new google.maps.LatLng(lat, lng));
    if (pixel) {
      setActiveCalloutPos({ x: pixel.x, y: pixel.y });
    }
  }, [activeData]);

  // Initialize Google Maps
  useEffect(() => {
    let isMounted = true;

    if (!apiKey) {
      setMapError('Google Maps API Key belum dikonfigurasi di file .env (VITE_GOOGLE_MAPS_API_KEY).');
      setIsLoading(false);
      return;
    }

    setOptions({
      apiKey,
      version: 'weekly',
    });

    Promise.all([importLibrary('maps'), importLibrary('geometry')])
      .then(() => {
        if (!isMounted || !mapContainerRef.current) return;

        // Center on Indonesia archipelago
        const center = { lat: -2.5, lng: 118.0 };

        const map = new google.maps.Map(mapContainerRef.current, {
          center,
          zoom: 5,
          minZoom: 4,
          maxZoom: 18,
          mapTypeId: mapType,
          disableDefaultUI: true, // We use rich custom UI controls
          gestureHandling: 'greedy',
          styles: (mapType === 'roadmap' || mapType === 'terrain')
            ? (isDarkMode ? googleMapsDarkTheme : googleMapsLightTheme)
            : undefined,
          restriction: {
            latLngBounds: {
              north: 8.5,
              south: -13.5,
              west: 94.0,
              east: 142.0,
            },
            strictBounds: false,
          },
        });

        mapInstanceRef.current = map;

        // Custom OverlayView for custom HTML markers & callout projection
        const CustomOverlay = class extends google.maps.OverlayView {
          private div: HTMLDivElement | null = null;

          onAdd() {
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.left = '0';
            this.div.style.top = '0';
            this.div.style.width = '100%';
            this.div.style.height = '100%';
            this.div.style.pointerEvents = 'none';

            markersContainerRef.current = this.div;
            const panes = this.getPanes();
            panes?.overlayMouseTarget.appendChild(this.div);
          }

          draw() {
            if (!this.div) return;
            // Position all custom HTML marker elements
            const projection = this.getProjection();
            if (!projection) return;

            const markerElements = this.div.querySelectorAll<HTMLElement>('[data-lat][data-lng]');
            markerElements.forEach((el) => {
              const lat = parseFloat(el.getAttribute('data-lat') || '0');
              const lng = parseFloat(el.getAttribute('data-lng') || '0');
              const pos = projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
              if (pos) {
                el.style.left = `${pos.x}px`;
                el.style.top = `${pos.y}px`;
              }
            });

            // Update callout floating card position
            if (activeData?.coords) {
              const pixel = projection.fromLatLngToContainerPixel(
                new google.maps.LatLng(activeData.coords.lat, activeData.coords.lng)
              );
              if (pixel) {
                setActiveCalloutPos({ x: pixel.x, y: pixel.y });
              }
            }
          }

          onRemove() {
            if (this.div && this.div.parentNode) {
              this.div.parentNode.removeChild(this.div);
              this.div = null;
              markersContainerRef.current = null;
            }
          }
        };

        const overlay = new CustomOverlay();
        overlay.setMap(map);
        overlayRef.current = overlay;

        // Listeners for zoom and position updates
        map.addListener('zoom_changed', () => {
          const z = map.getZoom();
          if (typeof z === 'number') {
            setCurrentZoom(z);
          }
          if (overlayRef.current) {
            overlayRef.current.draw();
          }
        });

        map.addListener('drag', () => {
          if (overlayRef.current) {
            overlayRef.current.draw();
          }
        });

        map.addListener('bounds_changed', () => {
          if (overlayRef.current) {
            overlayRef.current.draw();
          }
        });

        setIsLoading(false);
        setMapError(null);
      })
      .catch((err) => {
        console.error('Google Maps load error:', err);
        if (isMounted) {
          setMapError(
            err.message ||
              'Gagal memuat Google Maps API. Pastikan API Key valid dan Maps JavaScript API diaktifkan di Google Cloud Console.'
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
      mapInstanceRef.current = null;
    };
  }, [apiKey]);

  // Update Map Styles when Dark Mode or Map Type changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.setMapTypeId(mapType);

    if (mapType === 'roadmap' || mapType === 'terrain') {
      map.setOptions({
        styles: isDarkMode ? googleMapsDarkTheme : googleMapsLightTheme,
      });
    } else {
      map.setOptions({ styles: undefined });
    }
  }, [isDarkMode, mapType]);

  // Render Disaster Markers into OverlayView
  useEffect(() => {
    const container = markersContainerRef.current;
    if (!container || !mapInstanceRef.current) return;

    // Clear previous markers
    container.innerHTML = '';

    // Remove existing hazard circle
    if (hazardCircleRef.current) {
      hazardCircleRef.current.setMap(null);
      hazardCircleRef.current = null;
    }

    const map = mapInstanceRef.current;

    Object.values(disasters).forEach((incident) => {
      const isVisible = activeCategory === 'all' || incident.category === activeCategory;
      if (!isVisible) return;

      const { lat, lng } = incident.coords;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const isSelected = incident.id === activeDisasterKey;

      // Color scheme according to category
      let categoryBg = 'bg-rose-600';
      let categoryBorder = 'border-rose-400';
      let categoryColorHex = '#e11d48';
      let categoryIconHtml = '🌋';

      if (incident.category === 'flood') {
        categoryBg = 'bg-sky-500';
        categoryBorder = 'border-sky-300';
        categoryColorHex = '#0ea5e9';
        categoryIconHtml = '🌊';
      } else if (incident.category === 'fire') {
        categoryBg = 'bg-amber-500';
        categoryBorder = 'border-amber-300';
        categoryColorHex = '#f59e0b';
        categoryIconHtml = '🔥';
      }

      const markerEl = document.createElement('div');
      markerEl.setAttribute('data-lat', lat.toString());
      markerEl.setAttribute('data-lng', lng.toString());
      markerEl.className = 'absolute pointer-events-auto cursor-pointer transition-transform duration-150';
      markerEl.style.transform = 'translate(-50%, -50%)';
      markerEl.style.zIndex = isSelected ? '1000' : '100';

      markerEl.innerHTML = isSelected
        ? `
          <div class="relative flex items-center justify-center">
            <span class="w-10 h-10 rounded-full bg-amber-400/30 border-2 border-amber-400 flex items-center justify-center pulse-selected">
              <span class="w-7 h-7 rounded-full bg-amber-500 border-2 border-slate-900 shadow-2xl flex items-center justify-center text-white font-bold text-xs">
                ${categoryIconHtml}
              </span>
            </span>
            <span class="absolute -bottom-6 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900/95 text-amber-300 border border-amber-400/40 shadow-lg whitespace-nowrap pointer-events-none">
              ${incident.name.split(',')[0]}
            </span>
          </div>
        `
        : `
          <div class="relative flex items-center justify-center group hover:scale-110 transition-transform">
            <span class="w-7 h-7 rounded-full ${categoryBg} border-2 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-white text-[11px] group-hover:ring-4 group-hover:ring-white/30 transition-all">
              ${categoryIconHtml}
            </span>
            <span class="opacity-0 group-hover:opacity-100 absolute -bottom-6 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900/95 text-white border border-white/20 shadow-md whitespace-nowrap pointer-events-none transition-opacity">
              ${incident.name.split(',')[0]}
            </span>
          </div>
        `;

      markerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectDisaster(incident.id);
        map.panTo({ lat, lng });
        const curZ = map.getZoom();
        if (typeof curZ === 'number' && curZ < 7) {
          map.setZoom(7);
        }
      });

      container.appendChild(markerEl);

      // Add emergency perimeter circle for selected incident
      if (isSelected) {
        const hazardCircle = new google.maps.Circle({
          strokeColor: categoryColorHex,
          strokeOpacity: 0.85,
          strokeWeight: 2,
          fillColor: categoryColorHex,
          fillOpacity: 0.15,
          map,
          center: { lat, lng },
          radius: incident.category === 'earthquake' ? 25000 : 18000,
        });

        hazardCircleRef.current = hazardCircle;
      }
    });

    if (overlayRef.current) {
      overlayRef.current.draw();
    }
  }, [disasters, activeCategory, activeDisasterKey, onSelectDisaster]);

  // Draw Evacuation / Distribution Route when Route View is active
  useEffect(() => {
    // Clear previous polylines
    routePolylinesRef.current.forEach((pl) => pl.setMap(null));
    routePolylinesRef.current = [];

    // Remove route checkpoint markers
    const container = markersContainerRef.current;
    if (container) {
      const existingCpMarkers = container.querySelectorAll('.route-cp-marker');
      existingCpMarkers.forEach((el) => el.remove());
    }

    if (!mapInstanceRef.current || !isRouteOpen || !activeData || !activeData.route) return;

    const map = mapInstanceRef.current;
    const checkpoints = activeData.route.checkpoints || [];
    const routeCoords: google.maps.LatLngLiteral[] = [];

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

      routeCoords.push({ lat, lng });

      // Checkpoint badge marker
      if (container) {
        const cpEl = document.createElement('div');
        cpEl.setAttribute('data-lat', lat.toString());
        cpEl.setAttribute('data-lng', lng.toString());
        cpEl.className = 'absolute pointer-events-auto route-cp-marker cursor-pointer transform -translate-x-1/2 -translate-y-1/2 z-30 group';
        cpEl.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full bg-slate-900 border-2 border-orange-400 text-orange-300 font-black text-[10px] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              ${idx + 1}
            </div>
            <div class="opacity-0 group-hover:opacity-100 absolute bottom-7 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-900/95 text-white border border-orange-400/40 shadow-xl whitespace-nowrap pointer-events-none transition-opacity z-50">
              <span class="font-bold text-orange-300">${cp.title}</span><br/>
              <span class="text-slate-300">${cp.tag}</span>
            </div>
          </div>
        `;
        container.appendChild(cpEl);
      }
    });

    if (routeCoords.length >= 2) {
      // Glow background line
      const glowLine = new google.maps.Polyline({
        path: routeCoords,
        geodesic: true,
        strokeColor: '#ea580c',
        strokeOpacity: 0.35,
        strokeWeight: 8,
        map,
      });

      // Main dashed route line
      const lineSymbol = {
        path: 'M 0,-1 0,1',
        strokeOpacity: 1,
        scale: 3,
        strokeColor: '#f97316',
      };

      const mainLine = new google.maps.Polyline({
        path: routeCoords,
        geodesic: true,
        strokeOpacity: 0,
        icons: [
          {
            icon: lineSymbol,
            offset: '0',
            repeat: '16px',
          },
        ],
        map,
      });

      routePolylinesRef.current = [glowLine, mainLine];

      // Fit bounds to show route
      const bounds = new google.maps.LatLngBounds();
      routeCoords.forEach((coord) => bounds.extend(coord));
      map.fitBounds(bounds, { top: 80, bottom: 80, left: 80, right: 80 });
    }

    if (overlayRef.current) {
      overlayRef.current.draw();
    }
  }, [isRouteOpen, activeData]);

  // Zoom handlers
  const handleZoom = (dir: 'in' | 'out') => {
    if (!mapInstanceRef.current) return;
    const currentZ = mapInstanceRef.current.getZoom() || 5;
    mapInstanceRef.current.setZoom(dir === 'in' ? currentZ + 1 : currentZ - 1);
  };

  const handleReset = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.panTo({ lat: -2.5, lng: 118.0 });
    mapInstanceRef.current.setZoom(5);
  };

  const handleFlyToDisaster = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.panTo({ lat, lng });
    mapInstanceRef.current.setZoom(8);
  };

  return (
    <section
      className="col-span-12 h-full overflow-hidden flex flex-col justify-between relative bg-slate-900 select-none"
      data-purpose="map-viewport"
    >
      {/* Google Maps Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full absolute inset-0 z-0"
        style={{ background: isDarkMode ? '#070d18' : '#e2e8f0' }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm text-white">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-sm font-semibold tracking-wide text-cyan-300">Memuat Google Maps Platform...</span>
        </div>
      )}

      {/* API Error / Missing Key Banner */}
      {mapError && (
        <div className="absolute inset-x-4 top-20 z-40 max-w-xl mx-auto bg-slate-900/95 border border-rose-500/50 rounded-2xl p-5 shadow-2xl backdrop-blur-md text-white">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="text-sm font-bold text-rose-300 mb-1">Google Maps Memerlukan Konfigurasi</h4>
              <p className="text-slate-300 leading-relaxed mb-3">{mapError}</p>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-white/10 font-mono text-[11px] text-cyan-300 mb-3 select-all">
                VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
              </div>
              <p className="text-[11px] text-slate-400">
                Pastikan Anda telah memasukkan kunci di file <code className="text-amber-300 font-bold">.env</code> dan mengaktifkan <strong>Maps JavaScript API</strong> di Google Cloud Console.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Left Google Maps Platform Badge / Layer Switcher */}
      <div className="relative z-30 pt-4 px-6 pointer-events-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Google Maps Active Indicator Pill */}
          <div className="flex items-center gap-2 bg-white/95 dark:bg-[#0b1329]/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/90 dark:border-slate-700/80 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              <span>Google Maps Live</span>
              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                Maps JavaScript API
              </span>
            </span>
          </div>

          {/* Map Layer Mode Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowTileSelector(!showTileSelector)}
              className="flex items-center gap-1.5 bg-white/95 dark:bg-[#0b1329]/95 hover:bg-white text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-slate-200/90 dark:border-slate-700/80 shadow-md cursor-pointer transition-all active:scale-95"
              title="Ganti Lapisan Peta Google Maps"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-500" />
              <span>
                {mapType === 'roadmap'
                  ? 'Peta Jalan (Roadmap)'
                  : mapType === 'satellite'
                  ? 'Satelit Murni'
                  : mapType === 'hybrid'
                  ? 'Satelit + Label'
                  : 'Topografi / Medan'}
              </span>
            </button>

            {showTileSelector && (
              <div className="absolute left-0 mt-2 w-52 bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 shadow-2xl z-50 animate-fadeIn">
                <button
                  onClick={() => {
                    setMapType('roadmap');
                    setShowTileSelector(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    mapType === 'roadmap'
                      ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Peta Jalan (Roadmap)</span>
                  {mapType === 'roadmap' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>}
                </button>
                <button
                  onClick={() => {
                    setMapType('hybrid');
                    setShowTileSelector(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    mapType === 'hybrid'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Satelit + Label (Hybrid)</span>
                  {mapType === 'hybrid' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>}
                </button>
                <button
                  onClick={() => {
                    setMapType('satellite');
                    setShowTileSelector(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    mapType === 'satellite'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Satelit Murni</span>
                  {mapType === 'satellite' && <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>}
                </button>
                <button
                  onClick={() => {
                    setMapType('terrain');
                    setShowTileSelector(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    mapType === 'terrain'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Topografi / Medan</span>
                  {mapType === 'terrain' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
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
              title="Buka Jalur Distribusi Logistik di Google Maps"
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
              title="Perbesar Peta Google Maps (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoom('out')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs transition-all cursor-pointer"
              title="Perkecil Peta Google Maps (-)"
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
              title="Buka / Tutup Halaman Rute Distribusi di Google Maps"
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
