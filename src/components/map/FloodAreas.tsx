import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { areaColor, areaPaths, type FloodArea } from '../../services/flood/areas';
export function FloodAreas({ areas }: { areas: FloodArea[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const polygons = areas.flatMap(area => areaPaths(area.kml).map(paths => new google.maps.Polygon({
      map, paths, strokeColor: areaColor(area), fillColor: areaColor(area), strokeWeight: 1.5,
      fillOpacity: area.kind === 'notification' ? 0.06 : 0.2, clickable: false, zIndex: area.kind === 'flash-highly-likely' ? 3 : 2,
    })));
    return () => polygons.forEach(p => p.setMap(null));
  }, [map, areas]);
  return null;
}
