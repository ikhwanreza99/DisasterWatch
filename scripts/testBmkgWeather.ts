// BMKG weather warning fixture tests (run: npx tsx scripts/testBmkgWeather.ts).
// Fully deterministic: fixtures mirror the real CAP 1.2 / RSS shapes observed
// 2026-10-01 (trimmed). No network, no live endpoint dependency.
import {
  dedupeWeatherWarnings,
  extractFirst,
  extractTagBlocks,
  getBmkgWeatherWarnings,
  getWeatherWarningAccess,
  normalizeCapAlert,
  parseCapPolygon,
  parseWeatherRss,
  warningStatus,
} from '../src/services/bmkg/bmkgWeatherWarning';
import { buildBmkgWeatherPopupHtml } from '../src/components/map/bmkgPopup';
import type { BmkgWeatherWarning } from '../src/services/bmkg/bmkgTypes';

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

// Frozen clock: 2026-10-01T15:00:00+07:00 == 2026-10-01T08:00:00Z,
// inside the fixture 14:00–16:00 +07 validity window.
const NOW = Date.parse('2026-10-01T08:00:00Z');

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Peringatan Dini Cuaca BMKG</title>
    <pubDate>Thu, 01 Oct 2026 07:00:44 +0000</pubDate>
    <item>
      <title>Hujan Lebat disertai Petir di Jawa Barat</title>
      <link>https://www.bmkg.go.id/alerts/nowcast/id/CJB20261001003_alert.xml</link>
      <description>Hujan lebat disertai petir akan terjadi di Jawa Barat.</description>
      <author>cuaca.ekstrem@bmkg.go.id (BMKG)</author>
      <category>Met</category>
      <guid isPermaLink="false">2.49.0.1.360.0.2026.10.01.07.32.003</guid>
      <pubDate>Thu, 01 Oct 2026 13:55:00 +0700</pubDate>
    </item>
    <item>
      <title>Hujan Lebat disertai Petir di Riau</title>
      <link>https://www.bmkg.go.id/alerts/nowcast/id/CRU20261001002_alert.xml</link>
      <description>Hujan lebat disertai petir akan terjadi di Riau.</description>
      <guid isPermaLink="false">2.49.0.1.360.0.2026.10.01.07.14.002</guid>
      <pubDate>Thu, 01 Oct 2026 13:50:00 +0700</pubDate>
    </item>
  </channel>
</rss>`;

const CAP_FIXTURE = `<?xml version="1.0" ?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>2.49.0.1.360.0.2026.10.01.07.32.003</identifier>
  <sender>cuaca.ekstrem@bmkg.go.id</sender>
  <sent>2026-10-01T13:55:00+07:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>id</language>
    <category>Met</category>
    <event>Hujan Lebat dan Petir</event>
    <urgency>Immediate</urgency>
    <severity>Moderate</severity>
    <certainty>Observed</certainty>
    <effective>2026-10-01T14:00:00+07:00</effective>
    <expires>2026-10-01T16:00:00+07:00</expires>
    <senderName>Badan Meteorologi Klimatologi dan Geofisika</senderName>
    <headline>Hujan Lebat disertai Petir di Jawa Barat</headline>
    <description>Hujan lebat disertai petir di Jawa Barat, khususnya di ANDIR, LEMBANG.</description>
    <web>https://nowcasting.bmkg.go.id/infografis/CJB/2026/10/01/infografis.jpg</web>
    <contact>06221 196</contact>
    <area>
      <areaDesc>Jawa Barat</areaDesc>
      <polygon>-6.772,106.932 -6.778,106.932 -6.796,106.921 -6.838,106.871 -6.772,106.932</polygon>
      <polygon>not-a-polygon</polygon>
    </area>
    <area>
      <areaDesc>Bandung Raya</areaDesc>
      <polygon>-6.90,107.60 -6.91,107.61 -6.92,107.60 -6.90,107.60</polygon>
    </area>
  </info>
</alert>`;

const FETCHED = '2026-10-01T01:05:00.000Z';
const DETAIL = 'https://www.bmkg.go.id/alerts/nowcast/id/CJB20261001003_alert.xml';

// 1. RSS parsing
{
  const items = parseWeatherRss(RSS_FIXTURE);
  check('1 RSS parses 2 items', items.length === 2, `got ${items.length}`);
  check('1 RSS item fields', items[0]!.title === 'Hujan Lebat disertai Petir di Jawa Barat' && items[0]!.link === DETAIL && items[0]!.guid === '2.49.0.1.360.0.2026.10.01.07.32.003');
}

// 2. CAP parsing
{
  const w = normalizeCapAlert(CAP_FIXTURE, DETAIL, FETCHED, NOW);
  check('2 CAP normalizes', w !== null);
  check(
    '2 CAP fields',
    w!.event === 'Hujan Lebat dan Petir' &&
      w!.headline === 'Hujan Lebat disertai Petir di Jawa Barat' &&
      w!.senderName === 'Badan Meteorologi Klimatologi dan Geofisika' &&
      w!.web === 'https://nowcasting.bmkg.go.id/infografis/CJB/2026/10/01/infografis.jpg' &&
      w!.source === 'BMKG' &&
      w!.provenance === 'OFFICIAL' &&
      w!.sourceUrl === DETAIL,
  );
  check('2 CAP areas (bad polygon retained)', w!.areas.length === 3, `got ${w!.areas.length}`);
  check('2 CAP valid polygons kept', w!.areas[0]!.polygon.length === 5 && w!.areas[2]!.polygon.length === 4);
  check('2 CAP invalid polygon → empty, record kept', w!.areas[1]!.polygon.length === 0);
}

// 3. Status calculation (frozen NOW inside 14:00–16:00 +07 window)
{
  check('3 ACTIVE within window', warningStatus('2026-10-01T14:00:00+07:00', '2026-10-01T16:00:00+07:00', NOW) === 'ACTIVE');
  check('3 UPCOMING before window', warningStatus('2026-10-02T14:00:00+07:00', '2026-10-02T16:00:00+07:00', NOW) === 'UPCOMING');
  check('3 EXPIRED after window', warningStatus('2026-09-30T14:00:00+07:00', '2026-09-30T16:00:00+07:00', NOW) === 'EXPIRED');
  check('3 malformed dates → EXPIRED (never ACTIVE)', warningStatus('soon', 'later', NOW) === 'EXPIRED');
  const w = normalizeCapAlert(CAP_FIXTURE, DETAIL, FETCHED, NOW)!;
  check('3 normalized status ACTIVE', w.status === 'ACTIVE');
}

// 4. Polygon parsing
{
  const p = parseCapPolygon('-6.772,106.932 -6.778,106.932 -6.796,106.921');
  check('4 valid polygon', p !== null && p.length === 3 && p[0]![0] === -6.772 && p[0]![1] === 106.932);
}

// 5. Invalid polygon handling
{
  check('5 bad token → null', parseCapPolygon('not-a-polygon') === null);
  check('5 out-of-range → null', parseCapPolygon('-6.7,106.9 999,106.9 -6.8,106.9') === null);
  check('5 fewer than 3 points → null', parseCapPolygon('-6.7,106.9 -6.8,106.9') === null);
  check('5 empty → null', parseCapPolygon('   ') === null);
  check('5 tag helpers safe', extractTagBlocks('', 'item').length === 0 && extractFirst('', 'title') === '');
}

// 6. Deduplication
{
  const a = normalizeCapAlert(CAP_FIXTURE, DETAIL, FETCHED, NOW)!;
  const b = normalizeCapAlert(CAP_FIXTURE, DETAIL, '2026-10-01T02:00:00.000Z', NOW)!;
  check('6 stable ID across fetches', a.id === b.id, `${a.id} vs ${b.id}`);
  check('6 duplicates collapse', dedupeWeatherWarnings([a, b]).length === 1);
}

// 7. Empty feed
{
  check('7 empty RSS → 0 items', parseWeatherRss('<?xml version="1.0"?><rss><channel></channel></rss>').length === 0);
  const noArea = CAP_FIXTURE.replace(/<area>[\s\S]*?<\/area>/g, '');
  check('7 CAP without area → null', normalizeCapAlert(noArea, DETAIL, FETCHED, NOW) === null);
}

// 8. Malformed XML
{
  const garbage = ['not xml at all <><', '', '<alert><info><event>'];
  let threw = false;
  let total = 0;
  try {
    for (const g of garbage) {
      total += parseWeatherRss(g).length;
      if (normalizeCapAlert(g, DETAIL, FETCHED, NOW) !== null) total += 100;
    }
  } catch {
    threw = true;
  }
  check('8 malformed handled (0 records, no throw)', total === 0 && !threw);
}

// 9. Unavailable (injected failing fetch — no network)
{
  const failingFetch = async (): Promise<Response> => {
    throw new Error('network blocked (simulated CORS)');
  };
  const res = await getBmkgWeatherWarnings(failingFetch as unknown as typeof fetch, NOW);
  check('9 fetch failure → ok:false, empty', res.ok === false && res.warnings.length === 0);
}

// 10. Popup attribution + map data shape
{
  const w: BmkgWeatherWarning = normalizeCapAlert(CAP_FIXTURE, DETAIL, FETCHED, NOW)!;
  const html = buildBmkgWeatherPopupHtml(w);
  check(
    '10 popup attribution + fields',
    html.includes('Source: <b>BMKG</b>') &&
      html.includes('BMKG WEATHER WARNING') &&
      html.includes('Hujan Lebat dan Petir') &&
      html.includes('Affected area') &&
      html.includes('Effective') &&
      html.includes('Expires') &&
      html.includes('nowcast detail'),
  );
  const drawable = w.areas.filter((a) => a.polygon.length >= 3);
  check('10 drawable areas identified', drawable.length === 2, `got ${drawable.length}`);
}

// 11-15. Error classification via getBmkgWeatherWarnings (injected fetch, no network).
type StubRoute = { ok: boolean; status: number; text: string } | { threw: unknown };
function stubFetch(routes: Record<string, StubRoute>, fallback: StubRoute = { threw: new Error('unexpected URL') }) {
  return (async (url: string): Promise<Response> => {
    const r = routes[url] ?? fallback;
    if ('threw' in r) throw r.threw;
    return { ok: r.ok, status: r.status, statusText: r.ok ? 'OK' : 'Error', text: async () => r.text } as unknown as Response;
  }) as unknown as typeof fetch;
}
const RSS_URL = 'https://www.bmkg.go.id/alerts/nowcast/id';
const CAP2_URL = 'https://www.bmkg.go.id/alerts/nowcast/id/CRU20261001002_alert.xml';
const okResp = (text: string): StubRoute => ({ ok: true, status: 200, text });

// 11. CORS-blocked RSS → RSS_CORS_BLOCKED (browser TypeError shape, not generic)
{
  const res = await getBmkgWeatherWarnings(stubFetch({ [RSS_URL]: { threw: new TypeError('Failed to fetch') } }), NOW);
  check('11 CORS RSS → RSS_CORS_BLOCKED', res.ok === false && res.errorType === 'RSS_CORS_BLOCKED' && res.warnings.length === 0, res.errorType);
}

// 12. HTTP RSS error → RSS_HTTP_ERROR
{
  const res = await getBmkgWeatherWarnings(stubFetch({ [RSS_URL]: { ok: false, status: 503, text: 'unavailable' } }), NOW);
  check('12 HTTP RSS → RSS_HTTP_ERROR', res.ok === false && res.errorType === 'RSS_HTTP_ERROR', res.errorType);
}

// 13. Malformed RSS → RSS_PARSE_ERROR (reachable but not a listing)
{
  const res = await getBmkgWeatherWarnings(stubFetch({ [RSS_URL]: okResp('<html>gateway says hi</html>') }), NOW);
  check('13 malformed RSS → RSS_PARSE_ERROR', res.ok === false && res.errorType === 'RSS_PARSE_ERROR', res.errorType);
}

// 14. Valid RSS + CAP details → OK
{
  const res = await getBmkgWeatherWarnings(
    stubFetch({ [RSS_URL]: okResp(RSS_FIXTURE), [DETAIL]: okResp(CAP_FIXTURE), [CAP2_URL]: okResp(CAP_FIXTURE) }),
    NOW,
  );
  check('14 valid feed → OK', res.ok === true && res.errorType === 'OK' && res.warnings.length === 2, `${res.errorType}/${res.warnings.length}`);
}

// 15. CAP CORS blocked → CAP_CORS_BLOCKED
{
  const res = await getBmkgWeatherWarnings(
    stubFetch({ [RSS_URL]: okResp(RSS_FIXTURE) }, { threw: new TypeError('Failed to fetch') }),
    NOW,
  );
  check('15 CORS CAP → CAP_CORS_BLOCKED', res.ok === false && res.errorType === 'CAP_CORS_BLOCKED', res.errorType);
}

// 16. Valid but empty listing → EMPTY (reachable, honest zero)
{
  const res = await getBmkgWeatherWarnings(
    stubFetch({ [RSS_URL]: okResp('<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>') }),
    NOW,
  );
  check('16 empty listing → EMPTY + ok', res.ok === true && res.errorType === 'EMPTY' && res.warnings.length === 0, res.errorType);
}

// 17. Unparseable CAP bodies → CAP_PARSE_ERROR
{
  const res = await getBmkgWeatherWarnings(
    stubFetch({ [RSS_URL]: okResp(RSS_FIXTURE), [DETAIL]: okResp('garbage'), [CAP2_URL]: okResp('garbage') }),
    NOW,
  );
  check('17 bad CAP → CAP_PARSE_ERROR', res.ok === false && res.errorType === 'CAP_PARSE_ERROR', res.errorType);
}

// 18. Browser capability gate: known-blocked endpoints must not be fetched
// by the hook path. The constant is the single source of truth; the adapter
// itself stays fully functional (proven above) for future/server use.
{
  check('18 capability is BROWSER_ACCESS_BLOCKED', getWeatherWarningAccess() === 'BROWSER_ACCESS_BLOCKED', String(getWeatherWarningAccess()));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);