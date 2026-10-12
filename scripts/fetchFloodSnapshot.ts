import { fetchFloodAreas } from './floodAreas';
import { mkdir, writeFile } from 'node:fs/promises';
import { normalizeFloodData } from '../src/services/flood/data';

const key = process.env.GOOGLE_FLOOD_API_KEY;
const base = 'https://floodforecasting.googleapis.com/v1/';
async function request(path: string, body?: object) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Goog-Api-Key': key!, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000),
  });
  // Never log response body or URL containing credentials.
  if (!response.ok) throw new Error(`Flood Forecasting HTTP ${response.status}`);
  return response.json();
}
async function pages(path: string, field: string) {
  const rows: any[] = [];
  let pageToken: string | undefined;
  const seen = new Set<string>();
  do {
    const data = await request(path, { regionCode: 'ID', pageSize: 1000, ...(pageToken ? { pageToken } : {}) });
    rows.push(...(data[field] ?? []));
    pageToken = data.nextPageToken;
    if (pageToken && seen.has(pageToken)) throw new Error('Repeated flood page token');
    if (pageToken) seen.add(pageToken);
  } while (pageToken);
  return rows;
}
await mkdir('public/data', { recursive: true });
try {
  if (!key) throw new Error('GOOGLE_FLOOD_API_KEY not configured');
  const [gauges, statuses] = await Promise.all([
    pages('gauges:searchGaugesByArea', 'gauges'),
    pages('floodStatus:searchLatestFloodStatusByArea', 'floodStatuses'),
  ]);
  console.log(`Flood API returned ${gauges.length} gauges and ${statuses.length} statuses; countries: ${[...new Set(gauges.map(g => g.countryCode))].join(',')}`);
  const ids = gauges.filter(g => (!g.countryCode || g.countryCode === 'ID') && g.hasModel).map(g => g.gaugeId);
  const models: any[] = [];
  const forecasts: Record<string, any> = {};
  // Small batches also keep GET URLs within proxy limits.
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    const modelParams = new URLSearchParams();
    const forecastParams = new URLSearchParams();
    batch.forEach(id => { modelParams.append('names', `gaugeModels/${id}`); forecastParams.append('gaugeIds', id); });
    const results = await Promise.allSettled([
      request(`gaugeModels:batchGet?${modelParams}`), request(`gauges:queryGaugeForecasts?${forecastParams}`),
    ]);
    if (results[0].status === 'fulfilled') models.push(...(results[0].value.gaugeModels ?? []));
    if (results[1].status === 'fulfilled') Object.assign(forecasts, results[1].value.forecasts ?? {});
    if (results.some(r => r.status === 'rejected')) console.warn('::warning::Some flood chart details unavailable');
  }
  const snapshot = normalizeFloodData(gauges, statuses, models, forecasts);
  Object.assign(snapshot, await fetchFloodAreas(request, statuses));
  await writeFile('public/data/flood.json', JSON.stringify(snapshot));
  console.log(`Flood snapshot: ${snapshot.gauges.length} Indonesian gauges`);
} catch (error) {
  console.warn(`::warning::${error instanceof Error ? error.message : 'Flood snapshot unavailable'}`);
  await writeFile('public/data/flood.json', JSON.stringify({ version: 1, state: 'unavailable', generatedAt: new Date().toISOString(), gauges: [] }));
}
