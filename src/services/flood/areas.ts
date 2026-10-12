export type FloodAreaKind = 'flash-likely' | 'flash-highly-likely' | 'inundation' | 'notification';
export interface FloodArea {
  id: string; kind: FloodAreaKind; gaugeId?: string; level?: string; mapType?: string;
  start: string; end: string; kml: string;
}
export type AreaState = 'ready' | 'partial' | 'unavailable';
export const areaColor = (area: FloodArea) => area.kind === 'flash-highly-likely' ? '#ef4444' : area.kind === 'flash-likely' ? '#f59e0b' : area.kind === 'notification' ? '#a855f7' : area.level === 'HIGH' ? '#1e40af' : area.level === 'MEDIUM' ? '#3b82f6' : '#93c5fd';
export function activeFloodAreas(areas: FloodArea[], now: number, flash: boolean, river: boolean, gaugeId?: string) {
  return areas.filter(a => Date.parse(a.start) <= now && now < Date.parse(a.end) &&
    (a.kind.startsWith('flash-') ? flash : river && a.gaugeId === gaugeId));
}
/** Browser-only KML geometry parsing. Never mount provider HTML or fetch external links. */
export function areaPaths(kml: string): { lat: number; lng: number }[][][] {
  const doc = new DOMParser().parseFromString(kml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];
  return Array.from(doc.getElementsByTagNameNS('*', 'Polygon')).flatMap(polygon => {
    const boundaries = ['outerBoundaryIs', 'innerBoundaryIs'].flatMap(tag => Array.from(polygon.getElementsByTagNameNS('*', tag)));
    const rings = boundaries.map(boundary => {
      const text = boundary.getElementsByTagNameNS('*', 'coordinates')[0]?.textContent?.trim() || '';
      return text.split(/\s+/).map(tuple => { const [lng, lat] = tuple.split(',').map(Number); return { lat, lng }; });
    });
    if (!rings.length || rings.some(r => r.length < 4 || r.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180))) return [];
    return [rings];
  });
}
