// Build-time snapshot of Darwin VAAC volcanic-ash advisories for production.
// BOM blocks browser (cross-origin) requests, but allows plain server requests, so GitHub Actions
// runs this before `npm run build`; Vite copies public/ into dist/ → served at /data/vaac.json.
//
// Usage: npx tsx scripts/fetchVaacSnapshot.ts [outFile]
// Exit code 1 if BOM is unreachable or the page format changed (the workflow keeps deploying
// without the file; the app then shows "ABU N/A" instead of stale data).
import { mkdirSync, writeFileSync } from 'node:fs';
import { get } from 'node:https';
import { dirname } from 'node:path';
import { parseVaacPage, VAAC_SOURCE_URL } from '../src/services/vaac/parser';

const out = process.argv[2] ?? 'public/data/vaac.json';

// Plain https.get (not fetch): Node's fetch adds browser-style Sec-Fetch-* headers,
// which BOM's firewall rejects with 403 like a cross-origin browser request.
function download(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (DisasterWatch VAAC snapshot)', Accept: 'text/html' }, timeout: 30_000 },
      (res) => {
        res.setEncoding('latin1'); // BOM serves ISO-8859-1
        let body = '';
        res.on('data', (c: string) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

const { status, body: html } = await download(VAAC_SOURCE_URL);
if (status !== 200 || !/VA ADVISORY/.test(html)) {
  console.error(`VAAC snapshot failed: HTTP ${status}, advisories found: ${/VA ADVISORY/.test(html)}`);
  process.exit(1);
}

const advisories = parseVaacPage(html);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ fetchedAt: new Date().toISOString(), source: VAAC_SOURCE_URL, advisories }));
console.log(`VAAC snapshot: ${advisories.length} advisories (${advisories.filter((a) => !a.terminated).length} active) → ${out}`);
