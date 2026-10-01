// Draws NASA FIRMS hotspots on Google Maps with a single <canvas> (OverlayView),
// so tens of thousands of points render without one DOM node per point.
// Click hit-testing picks the nearest hotspot within a few pixels.
import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { FireHotspot } from '../../services/firms';

interface Props {
  hotspots: FireHotspot[];
  color: (frp: number) => string;
  radius: (frp: number) => number;
  onSelect: (h: FireHotspot | null) => void;
}

export function GoogleFireOverlay({ hotspots, color, radius, onSelect }: Props) {
  const map = useMap();
  const dataRef = useRef(hotspots);
  const selectRef = useRef(onSelect);
  dataRef.current = hotspots;
  selectRef.current = onSelect;
  const overlayRef = useRef<google.maps.OverlayView | null>(null);

  useEffect(() => {
    if (!map || typeof google === 'undefined') return;

    class FireCanvas extends google.maps.OverlayView {
      canvas = document.createElement('canvas');
      onAdd() {
        this.canvas.style.position = 'absolute';
        this.canvas.style.pointerEvents = 'none';
        this.getPanes()?.overlayLayer.appendChild(this.canvas);
      }
      onRemove() {
        this.canvas.remove();
      }
      draw() {
        const proj = this.getProjection();
        const div = map!.getDiv();
        if (!proj || !div) return;
        const w = div.clientWidth;
        const h = div.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        // Canvas covers the visible viewport; anchor its top-left to the viewport origin in div pixels.
        const bounds = map!.getBounds();
        if (!bounds) return;
        const ne = proj.fromLatLngToDivPixel(bounds.getNorthEast());
        const sw = proj.fromLatLngToDivPixel(bounds.getSouthWest());
        if (!ne || !sw) return;
        const left = sw.x;
        const top = ne.y;
        const c = this.canvas;
        c.style.left = `${left}px`;
        c.style.top = `${top}px`;
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
        c.width = w * dpr;
        c.height = h * dpr;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(124,45,18,0.8)';
        ctx.lineWidth = 0.6;
        const list = dataRef.current;
        // Weakest first so strong fires paint on top.
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i]!;
          const px = proj.fromLatLngToDivPixel(new google.maps.LatLng(p.latitude, p.longitude));
          if (!px) continue;
          const x = px.x - left;
          const y = px.y - top;
          if (x < -8 || y < -8 || x > w + 8 || y > h + 8) continue;
          ctx.beginPath();
          ctx.arc(x, y, radius(p.frp), 0, Math.PI * 2);
          ctx.fillStyle = color(p.frp);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    const ov = new FireCanvas();
    ov.setMap(map);
    overlayRef.current = ov;

    const idle = map.addListener('idle', () => ov.draw());
    const click = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      const proj = ov.getProjection();
      if (!proj || !e.latLng) return;
      const at = proj.fromLatLngToDivPixel(e.latLng);
      if (!at) return;
      let best: FireHotspot | null = null;
      let bestD = 8 * 8; // px²
      for (const p of dataRef.current) {
        const px = proj.fromLatLngToDivPixel(new google.maps.LatLng(p.latitude, p.longitude));
        if (!px) continue;
        const d = (px.x - at.x) ** 2 + (px.y - at.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      selectRef.current(best);
    });

    return () => {
      idle.remove();
      click.remove();
      ov.setMap(null);
      overlayRef.current = null;
    };
  }, [map, color, radius]);

  // Redraw when data changes.
  useEffect(() => {
    overlayRef.current?.draw();
  }, [hotspots]);

  return null;
}
