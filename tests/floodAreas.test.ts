import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFloodAreas } from '../scripts/floodAreas';
import { activeFloodAreas } from '../src/services/flood/areas';
const now = Date.parse('2026-10-11T12:00:00Z');
const event = { affectedCountryCodes: ['ID'], forecastIssueTime: '2026-10-11T00:00:00Z', forecastPeriodHours: 24, likelyAffectedPolygonId: 'p1', highlyLikelyAffectedPolygonId: 'p2' };
const kml = '<kml><Polygon><outerBoundaryIs><LinearRing><coordinates>106,-6 107,-6 107,-7 106,-6</coordinates></LinearRing></outerBoundaryIs></Polygon></kml>';
test('fetches Indonesia flash polygons, paginates, and isolates polygon failure', async () => {
  const result = await fetchFloodAreas(async (path, body: any) => {
    if (path === 'flashFloods:search') {
      assert.deepEqual(body.countryCodes, ['ID']);
      return body.pageToken ? { flashFloodEvents: [] } : { flashFloodEvents: [event, { ...event, affectedCountryCodes: ['US'] }], nextPageToken: 'next' };
    }
    if (path.endsWith('p2')) throw new Error('unavailable');
    return { kml };
  }, [], now);
  assert.equal(result.areaState, 'partial');
  assert.equal(result.areas.length, 1);
  assert.equal(result.areas[0].kind, 'flash-likely');
  assert.equal(activeFloodAreas(result.areas, now, true, false).length, 1);
  assert.equal(activeFloodAreas(result.areas, now, false, false).length, 0);
  assert.equal(activeFloodAreas(result.areas, now + 24 * 3600000, true, true).length, 0);
});
test('river geometry keeps its type/time and is visible only for selected gauge', async () => {
  const range = { start: '2026-10-11T00:00:00Z', end: '2026-10-12T00:00:00Z' };
  const result = await fetchFloodAreas(async path => path === 'flashFloods:search' ? { flashFloodEvents: [] } : { kml }, [{ gaugeId: 'g', forecastTimeRange: range, serializedNotificationPolygonId: 'notice', inundationMapSet: { inundationMapsTimeRange: range, inundationMapType: 'DEPTH', inundationMaps: [{ level: 'HIGH', serializedPolygonId: 'depth' }] } }], now);
  assert.equal(result.areaState, 'ready');
  assert.equal(result.areas[0].mapType, 'DEPTH');
  assert.equal(activeFloodAreas(result.areas, now, true, true, 'g').length, 2);
  assert.equal(activeFloodAreas(result.areas, now, true, true, 'other').length, 0);
  assert.equal(activeFloodAreas(result.areas, now, true, false, 'g').length, 0);
});
test('expired events do not trigger polygon fetch and unavailable differs from empty', async () => {
  const result = await fetchFloodAreas(async path => {
    assert.equal(path, 'flashFloods:search');
    return { flashFloodEvents: [{ ...event, forecastIssueTime: '2026-09-01T00:00:00Z' }] };
  }, [], now);
  assert.equal(result.areaState, 'ready');
  assert.deepEqual(result.areas, []);
  assert.equal((await fetchFloodAreas(async () => { throw new Error('403'); }, [], now)).areaState, 'unavailable');
});
