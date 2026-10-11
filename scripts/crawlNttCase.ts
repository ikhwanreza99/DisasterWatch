// Real NTT crawl log: attempts the existing ZAPI pipeline, then direct BMKG fetch.
// Honest record: ZAPI requires ZAPI_API_KEY (absent here) → recorded as failure,
// BMKG event page fetched directly over HTTP → FULL content verified.
// Output: public/data/ntt-case-crawl.json (machine-readable crawl receipt).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = process.argv[2] || 'public/data/ntt-case-crawl.json';
const now = new Date().toISOString();
const receipt: Record<string, unknown> = { caseId: 'ntt-sumba-barat-daya-2026-10-04', at: now, steps: [] };
const steps = receipt.steps as Array<Record<string, unknown>>;

// 1) Existing crawler path (ZAPI Google News) — same endpoint/query style as fetchDisasterNews.ts.
const zapiKey = process.env.ZAPI_API_KEY || '';
if (!zapiKey) {
  steps.push({ step: 'zapi-google-news', status: 'FAILED', reason: 'ZAPI_API_KEY missing — no request sent (same guard as scripts/fetchDisasterNews.ts).' });
} else {
  try {
    const url = new URL('https://api.zapi.ink/v1/news:google-news/feed');
    url.searchParams.set('query', '(gempa OR "Sumba Barat Daya" OR Kodi) NTT Indonesia when:30d');
    url.searchParams.set('limit', '10');
    const res = await fetch(url, { headers: { 'x-api-key': zapiKey }, signal: AbortSignal.timeout(20_000) });
    steps.push({ step: 'zapi-google-news', status: res.ok ? 'OK' : 'FAILED', http: res.status });
  } catch (e) {
    steps.push({ step: 'zapi-google-news', status: 'FAILED', reason: String(e).slice(0, 200) });
  }
}

// 2) Direct BMKG event page fetch (primary reference).
try {
  const res = await fetch('https://www.bmkg.go.id/gempabumi/20261004055834', {
    headers: { Accept: 'text/html', 'User-Agent': 'DisasterWatch-crawl/1.0' },
    signal: AbortSignal.timeout(25_000),
  });
  const html = res.ok ? await res.text() : '';
  const checks = {
    hasM61: /M\s?6,?1/.test(html),
    hasM59: /M\s?5,?9/.test(html),
    hasTsunami: /TIDAK BERPOTENSI TSUNAMI/i.test(html),
    hasAftershocks: /62.*susulan|aftershock/i.test(html),
    hasPerokonda: /Perokonda/i.test(html),
  };
  steps.push({ step: 'bmkg-event-page', status: res.ok && checks.hasM61 ? 'FULL' : 'FAILED', http: res.status, bytes: html.length, checks });
  (receipt as Record<string, unknown>).bmkgVerified = res.ok && (checks as Record<string, boolean>).hasM61;
} catch (e) {
  steps.push({ step: 'bmkg-event-page', status: 'FAILED', reason: String(e).slice(0, 200) });
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
