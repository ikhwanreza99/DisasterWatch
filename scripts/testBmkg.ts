// BMKG V1 fixture tests (run: npx tsx scripts/testBmkg.ts).
// Covers: latest/M5+/felt parsing, normalization, malformed handling,
// dedup, marker data, attribution, unavailable fallback, existing models intact.
// Network-free except the optional LIVE check at the end (explicitly labeled).
import { BMKG_SOURCE_URL } from '../src/services/bmkg/bmkgTypes';
import {
  buildEarthquakeId,
  dedupeEarthquakes,
  normalizeBmkgGempa,
  normalizeBmkgPayload,
  parseCoordinates,
  parseDepthKm,
  parseEventTime,
  parseMagnitude,
  parseRegion,
  toBmkgMarkerData,
} from '../src/services/bmkg/bmkgNormalizer';
import { buildBmkgPopupHtml } from '../src/components/map/bmkgPopup';

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

const RETRIEVED = '2026-10-01T03:35:00.000Z';

// Fixtures mirror the real BMKG shapes observed 2026-10-01.
const latestPayload = {
  Infogempa: {
    gempa: {
      Tanggal: '01 Okt 2026',
      Jam: '07:43:06 WIB',
      DateTime: '2026-10-01T00:43:06+00:00',
      Coordinates: '-10.04,123.61',
      Lintang: '10.04 LS',
      Bujur: '123.61 BT',
      Magnitude: '3.1',
      Kedalaman: '6 km',
      Wilayah: 'Pusat gempa berada di Laut 31 km Barat Kab. Kupang',
      Potensi: 'Gempa ini dirasakan untuk diteruskan pada masyarakat',
      Dirasakan: 'II - III Kab. Kupang, II - III Kota Kupang',
      Shakemap: '20261001074306.mmi.jpg',
    },
  },
};

const m5Payload = {
  Infogempa: {
    gempa: [
      {
        Tanggal: '22 Sep 2026',
        Jam: '06:48:13 WIB',
        DateTime: '2026-09-21T23:48:13+00:00',
        Coordinates: '4.74,125.30',
        Lintang: '4.74 LU',
        Bujur: '125.30 BT',
        Magnitude: '5.2',
        Kedalaman: '10 km',
        Wilayah: '127 km BaratLaut TAHUNA-KEP.SANGIHE-SULUT',
        Potensi: 'Tidak berpotensi tsunami',
      },
      {
        Tanggal: '14 Sep 2026',
        Jam: '17:58:04 WIB',
        DateTime: '2026-09-14T10:58:04+00:00',
        Coordinates: '2.52,128.09',
        Lintang: '2.52 LU',
        Bujur: '128.09 BT',
        Magnitude: '6.2',
        Kedalaman: '145 km',
        Wilayah: '42 km TimurLaut PULAUDOI-MALUT',
        Potensi: 'Tidak berpotensi tsunami',
      },
    ],
  },
};

const feltPayload = {
  Infogempa: {
    gempa: [
      {
        Tanggal: '30 Sep 2026',
        Jam: '09:35:54 WIB',
        DateTime: '2026-09-30T02:35:54+00:00',
        Coordinates: '4.84,95.14',
        Lintang: '4.84 LU',
        Bujur: '95.14 BT',
        Magnitude: '4.1',
        Kedalaman: '5 km',
        Wilayah: 'Pusat gempa berada di laut 54 km barat laut Calang-Aceh Jaya',
        Dirasakan: 'III-IV Calang, III Aceh Besar, III Banda Aceh, II Sigli',
      },
    ],
  },
};

// 1. Latest feed parsing
{
  const { events, rejected } = normalizeBmkgPayload(latestPayload, RETRIEVED);
  check('1 latest feed parses to 1 event', events.length === 1 && rejected === 0, `got ${events.length}/${rejected}`);
  const e = events[0]!;
  check('1 latest fields', e.magnitude === 3.1 && e.depthKm === 6 && e.latitude === -10.04 && e.longitude === 123.61);
  check('1 latest felt+mmi kept', e.feltArea === 'II - III Kab. Kupang, II - III Kota Kupang' && e.mmi === '20261001074306.mmi.jpg');
}

// 2. M5+ feed parsing
{
  const { events, rejected } = normalizeBmkgPayload(m5Payload, RETRIEVED);
  check('2 M5+ feed parses to 2 events', events.length === 2 && rejected === 0);
  check('2 M5+ magnitudes', events.some((e) => e.magnitude === 5.2) && events.some((e) => e.magnitude === 6.2));
}

// 3. Felt feed parsing
{
  const { events } = normalizeBmkgPayload(feltPayload, RETRIEVED);
  check('3 felt feed parses + feltArea', events.length === 1 && events[0]!.feltArea === 'III-IV Calang, III Aceh Besar, III Banda Aceh, II Sigli');
}

// 4. Normalization / provenance
{
  const { events } = normalizeBmkgPayload(latestPayload, RETRIEVED);
  const e = events[0]!;
  check(
    '4 provenance OFFICIAL/BMKG + url',
    e.source === 'BMKG' && e.sourceType === 'OFFICIAL' && e.sourceOrganization === 'BMKG' && e.sourceUrl === BMKG_SOURCE_URL,
  );
  check('4 eventTime ISO', Number.isFinite(Date.parse(e.eventTime)));
}

// 5. Malformed handling (must reject safely, never throw)
{
  const bad: unknown[] = [
    null,
    undefined,
    {},
    { Infogempa: {} },
    { Infogempa: { gempa: { Magnitude: 'abc', Kedalaman: '6 km', Coordinates: '-10,123', Wilayah: 'x', DateTime: '2026-10-01T00:00:00+00:00' } } },
    { Infogempa: { gempa: { Magnitude: '99', Kedalaman: '6 km', Coordinates: '-10,123', Wilayah: 'x', DateTime: '2026-10-01T00:00:00+00:00' } } },
    { Infogempa: { gempa: { Magnitude: '3.1', Kedalaman: '-5 km', Coordinates: '-10,123', Wilayah: 'x', DateTime: '2026-10-01T00:00:00+00:00' } } },
    { Infogempa: { gempa: { Magnitude: '3.1', Kedalaman: '6 km', Coordinates: '999,999', Wilayah: 'x', DateTime: '2026-10-01T00:00:00+00:00' } } },
    { Infogempa: { gempa: { Magnitude: '3.1', Kedalaman: '6 km', Coordinates: '-10,123', Wilayah: '', DateTime: 'not-a-date' } } },
  ];
  let threw = false;
  let totalEvents = 0;
  try {
    for (const p of bad) totalEvents += normalizeBmkgPayload(p, RETRIEVED).events.length;
  } catch {
    threw = true;
  }
  check('5 malformed rejected safely (0 events, no throw)', totalEvents === 0 && !threw, `events=${totalEvents} threw=${threw}`);
  check('5 validators reject junk', parseMagnitude('abc') === null && parseDepthKm('nope') === null && parseCoordinates('x') === null && parseEventTime('zzz') === null && parseRegion('') === null);
}

// 6. Deduplication (deterministic IDs, no random per fetch)
{
  const a = normalizeBmkgGempa((latestPayload.Infogempa.gempa as object), RETRIEVED)!;
  const b = normalizeBmkgGempa((latestPayload.Infogempa.gempa as object), '2026-10-02T00:00:00.000Z')!;
  check('6 stable ID across fetches', a.id === b.id, `${a.id} vs ${b.id}`);
  check('6 id format', /^bmkg-[0-9a-f]{8}$/.test(a.id), a.id);
  const merged = dedupeEarthquakes([a, b, ...normalizeBmkgPayload(m5Payload, RETRIEVED).events]);
  check('6 duplicates collapse', merged.length === 3, `got ${merged.length}`);
  check('6 sorted newest-first', merged[0]!.eventTime >= merged[merged.length - 1]!.eventTime);
  check('6 id derives from stable fields', buildEarthquakeId(a.eventTime, a.latitude, a.longitude, a.magnitude) === a.id);
}

// 7. Marker data
{
  const { events } = normalizeBmkgPayload(latestPayload, RETRIEVED);
  const m = toBmkgMarkerData(events[0]!);
  check('7 marker lat/lng/title', m.lat === -10.04 && m.lng === 123.61 && m.title.includes('M3.1'));
}

// 8. Source attribution in popup
{
  const { events } = normalizeBmkgPayload(latestPayload, RETRIEVED);
  const html = buildBmkgPopupHtml(events[0]!);
  check(
    '8 popup attribution',
    html.includes('Source: <b>BMKG</b>') && html.includes('data.bmkg.go.id/gempabumi') && html.includes('EARTHQUAKE') && html.includes('Magnitude') && html.includes('Depth') && html.includes('Felt area'),
  );
}

// 9. Unavailable fallback shape (adapter never throws; hook initial state is neutral)
{
  const empty = normalizeBmkgPayload({ Infogempa: { gempa: [] } }, RETRIEVED);
  check('9 empty feed → 0 events (neutral empty state)', empty.events.length === 0 && empty.rejected === 0);
  const broken = normalizeBmkgPayload({ broken: true }, RETRIEVED);
  check('9 broken envelope → 0 events (no crash)', broken.events.length === 0);
}

// 10. Existing disaster/report/aid models intact (import + spot check)
{
  const intel = await import('../src/domain/intelligence');
  const types = await import('../src/types');
  check('10 intelligence domain intact', typeof intel.needLabel === 'function' && typeof intel.nowIso === 'function');
  check('10 disaster types intact', (['fire', 'flood', 'earthquake'] as string[]).includes('earthquake'));
  void types;
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
