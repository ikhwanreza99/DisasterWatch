// BMKG weather forecast tests (run: npx tsx scripts/testBmkgForecast.ts).
// Fixture mirrors the real api.bmkg.go.id shape observed 2026-10-01 (trimmed).
// No network: fetch is injected. Forecast is never warning-classified.
import {
  clearForecastCache,
  fetchForecast,
  forecastUrl,
  normalizeForecast,
  resolveForecastAdm4,
} from '../src/services/bmkg/bmkgWeatherForecast';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

const ADM4 = '31.71.03.1001';
const URL = forecastUrl(ADM4);
const FETCHED = '2026-10-01T09:40:00.000Z';

const REAL_SHAPED = {
  lokasi: {
    adm1: '31', adm2: '31.71', adm3: '31.71.03', adm4: ADM4,
    provinsi: 'DKI Jakarta', kotkab: 'Kota Adm. Jakarta Pusat',
    kecamatan: 'Kemayoran', desa: 'Kemayoran',
    lon: 106.8453837867, lat: -6.1647214778, timezone: 'Asia/Jakarta',
  },
  data: [
    {
      lokasi: { adm4: ADM4 },
      cuaca: [
        [
          { datetime: '2026-10-01T10:00:00Z', t: 26, tcc: 89, tp: 2.3, weather: 61, weather_desc: 'Hujan Ringan', weather_desc_en: 'Light Rain', wd_deg: 190, wd: 'S', wd_to: 'N', ws: 1.4, hu: 87, vs: null, vs_text: null, time_index: '9-10', analysis_date: '2026-10-01T00:00:00', image: 'https://api-apps.bmkg.go.id/storage/icon/cuaca/hujan ringan-am.svg', utc_datetime: '2026-10-01 10:00:00', local_datetime: '2026-10-01 17:00:00' },
          { datetime: '2026-10-01T13:00:00Z', t: 26, tcc: 75, tp: 0.7, weather: 2, weather_desc: 'Cerah Berawan', weather_desc_en: 'Partly Cloudy', wd_deg: 311, wd: 'W', wd_to: 'E', ws: 1, hu: 87, vs: null, vs_text: null, time_index: '12-13', analysis_date: '2026-10-01T00:00:00', image: '', utc_datetime: '2026-10-01 13:00:00', local_datetime: '2026-10-01 20:00:00' },
        ],
        [
          { datetime: '2026-10-02T10:00:00Z', t: 27, tcc: 40, tp: 0, weather: 1, weather_desc: 'Cerah', weather_desc_en: 'Clear', wd_deg: 90, wd: 'E', wd_to: 'W', ws: 2, hu: 70, vs: 8000, vs_text: '8 km', time_index: '9-10', analysis_date: '2026-10-01T00:00:00', image: '', utc_datetime: '2026-10-02 10:00:00', local_datetime: '2026-10-02 17:00:00' },
        ],
      ],
    },
  ],
};

type Stub = { ok: boolean; status: number; json: unknown } | { threw: unknown };
function stubFetch(routes: Record<string, Stub>, calls: string[] = []) {
  return (async (url: string): Promise<Response> => {
    calls.push(url);
    const r = routes[url] ?? { threw: new Error(`unexpected URL ${url}`) };
    if ('threw' in r) throw r.threw;
    return { ok: r.ok, status: r.status, statusText: '', json: async () => r.json } as unknown as Response;
  }) as unknown as typeof fetch;
}

// 1. valid real-shaped response
{
  clearForecastCache();
  const f = normalizeForecast(REAL_SHAPED, ADM4, URL, FETCHED);
  check('1 valid response normalizes', f !== null && f.days.length === 2 && f.days[0]!.slots.length === 2);
  check(
    '1 fields + provenance',
    f!.adm4 === ADM4 && f!.days[0]!.slots[0]!.temperatureC === 26 && f!.days[0]!.slots[0]!.weatherDesc === 'Hujan Ringan' &&
      f!.source === 'BMKG' && f!.provenance === 'OFFICIAL' && f!.isMock === false && f!.kind === 'FORECAST' &&
      f!.village === 'Kemayoran' && f!.sourceUrl === URL,
  );
}

// 2. malformed response
{
  clearForecastCache();
  for (const bad of [null, {}, { lokasi: {} }, { lokasi: { adm4: ADM4 } }, 'junk']) {
    const f = normalizeForecast(bad, ADM4, URL, FETCHED);
    if (f !== null) {
      check('2 malformed rejected', false, JSON.stringify(bad)?.slice(0, 60));
      break;
    }
  }
  check('2 malformed rejected', true);
}

// 3. missing required forecast fields
{
  clearForecastCache();
  const noSlots = { lokasi: (REAL_SHAPED as { lokasi: object }).lokasi, data: [{ lokasi: {}, cuaca: [[{ t: 1 }]] }] };
  const wrongAdm4 = { ...REAL_SHAPED, lokasi: { ...(REAL_SHAPED as { lokasi: Record<string, unknown> }).lokasi, adm4: '99' } };
  check('3 missing fields rejected', normalizeForecast(noSlots, ADM4, URL, FETCHED) === null && normalizeForecast(wrongAdm4, ADM4, URL, FETCHED) === null);
}

// 4. HTTP error (non-404)
{
  clearForecastCache();
  const res = await fetchForecast(ADM4, { fetchImpl: stubFetch({ [URL]: { ok: false, status: 500, json: {} } }), bypassCache: true });
  check('4 HTTP error state', res.state === 'HTTP_ERROR' && res.forecast === null, res.state);
}

// 5. cache hit (second call: no request)
{
  clearForecastCache();
  const calls: string[] = [];
  const impl = stubFetch({ [URL]: { ok: true, status: 200, json: REAL_SHAPED } }, calls);
  const r1 = await fetchForecast(ADM4, { fetchImpl: impl });
  const r2 = await fetchForecast(ADM4, { fetchImpl: impl });
  check('5 cache hit (1 request, fromCache)', r1.state === 'READY' && r2.state === 'READY' && calls.length === 1 && r2.fromCache === true, `calls=${calls.length}`);
}

// 6. cache expiry (stale → refetch)
{
  clearForecastCache();
  const calls: string[] = [];
  const impl = stubFetch({ [URL]: { ok: true, status: 200, json: REAL_SHAPED } }, calls);
  await fetchForecast(ADM4, { fetchImpl: impl, nowMs: 1_000 });
  const r = await fetchForecast(ADM4, { fetchImpl: impl, nowMs: 1_000 + 13 * 60 * 1000 });
  check('6 expired cache refetches', calls.length === 2 && r.fromCache !== true, `calls=${calls.length}`);
}

// 7. no adm4 location (no request attempted)
{
  clearForecastCache();
  const calls: string[] = [];
  const impl = stubFetch({}, calls);
  for (const bad of [null, undefined, '', '   ']) {
    const res = await fetchForecast(bad, { fetchImpl: impl });
    if (res.state !== 'NO_LOCATION' || res.forecast !== null) {
      check('7 NO_LOCATION', false, String(bad));
      break;
    }
  }
  check('7 NO_LOCATION, zero requests', calls.length === 0, `calls=${calls.length}`);
  check('7 resolver needs adm4 field', resolveForecastAdm4({ name: 'Demak', province: 'Jawa Tengah', coords: { lat: -6.9, lng: 110.6 } } as never) === null);
}

// 8. provenance is OFFICIAL
{
  clearForecastCache();
  const res = await fetchForecast(ADM4, { fetchImpl: stubFetch({ [URL]: { ok: true, status: 200, json: REAL_SHAPED } }), bypassCache: true });
  check('8 OFFICIAL provenance', res.forecast?.provenance === 'OFFICIAL' && res.forecast?.source === 'BMKG' && res.forecast?.isMock === false);
}

// 9. forecast never classified as warning
{
  clearForecastCache();
  const res = await fetchForecast(ADM4, { fetchImpl: stubFetch({ [URL]: { ok: true, status: 200, json: REAL_SHAPED } }), bypassCache: true });
  const blob = JSON.stringify(res.forecast).toLowerCase();
  check('9 no warning wording', !/warning|alert|peringatan|early.warning|prediksi.bencana/.test(blob));
  check('9 invalid adm4 → INVALID_LOCATION', (await fetchForecast('00', { fetchImpl: stubFetch({ [forecastUrl('00')]: { ok: false, status: 404, json: { message: 'Data not found' } } }), bypassCache: true })).state === 'INVALID_LOCATION');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
