import type { FloodArea, AreaState } from '../src/services/flood/areas';
type Request = (path: string, body?: object) => Promise<any>;
export async function fetchFloodAreas(request: Request, statuses: any[], now = Date.now()) {
  const refs: Omit<FloodArea, 'kml'>[] = [];
  let failed = false;
  const add = (id: unknown, rest: Omit<FloodArea, 'id' | 'kml'>) => {
    if (typeof id === 'string' && id && Date.parse(rest.start) <= now && now < Date.parse(rest.end)) refs.push({ id, ...rest });
  };
  try {
    let pageToken: string | undefined;
    const seen = new Set<string>();
    do {
      const data = await request('flashFloods:search', { countryCodes: ['ID'], pageSize: 1000, ...(pageToken ? { pageToken } : {}) });
      for (const event of data.flashFloodEvents ?? []) {
        if (!event.affectedCountryCodes?.includes('ID')) continue;
        const start = event.forecastIssueTime;
        const endMs = Date.parse(start) + Number(event.forecastPeriodHours) * 3600000;
        if (!Number.isFinite(endMs)) continue;
        const end = new Date(endMs).toISOString();
        add(event.likelyAffectedPolygonId, { kind: 'flash-likely', start, end });
        add(event.highlyLikelyAffectedPolygonId, { kind: 'flash-highly-likely', start, end });
      }
      pageToken = data.nextPageToken;
      if (pageToken && seen.has(pageToken)) throw new Error('Repeated page');
      if (pageToken) seen.add(pageToken);
    } while (pageToken);
  } catch { failed = true; }
  for (const status of statuses) {
    const range = status.inundationMapSet?.inundationMapsTimeRange;
    for (const map of status.inundationMapSet?.inundationMaps ?? []) {
      add(map.serializedPolygonId, { kind: 'inundation', gaugeId: status.gaugeId, level: map.level, mapType: status.inundationMapSet.inundationMapType, start: range?.start, end: range?.end });
    }
    add(status.serializedNotificationPolygonId, { kind: 'notification', gaugeId: status.gaugeId, start: status.forecastTimeRange?.start, end: status.forecastTimeRange?.end });
  }
  const kmls = new Map<string, string>();
  const ids = [...new Set(refs.map(r => r.id))];
  for (let i = 0; i < ids.length; i += 6) {
    await Promise.all(ids.slice(i, i + 6).map(async id => {
      try {
        const result = await request(`serializedPolygons/${encodeURIComponent(id)}`);
        if (typeof result.kml !== 'string' || !result.kml.trim()) throw new Error('Missing geometry');
        kmls.set(id, result.kml);
      } catch { failed = true; }
    }));
  }
  const areas: FloodArea[] = refs.flatMap(ref => kmls.has(ref.id) ? [{ ...ref, kml: kmls.get(ref.id)! }] : []);
  return { areas, areaState: (failed ? areas.length ? 'partial' : 'unavailable' : 'ready') as AreaState };
}
