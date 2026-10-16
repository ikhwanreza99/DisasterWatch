import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { searchGemini } from '../providers/geminiSearch.ts';
import { searchSerpNews } from '../providers/serpapiNews.ts';
import type { ServiceCheck, StatusSnapshot } from '../../src/services/status/model.ts';
import { safeStatusError } from '../../src/services/status/model.ts';
import { isCrawlDue } from '../../src/domain/humanitarian.ts';
import { recentWindow, RECENT_WINDOW_DAYS } from '../../src/services/recentWindow.ts';
import { currentRecords } from '../../src/data/currentIncidents.ts';

const now = new Date().toISOString();
const services: ServiceCheck[] = [];
const add = (id: string, name: string, state: ServiceCheck['state'], detail: string) => services.push({ id, name, state, detail, scope: 'backend', checkedAt: now });
const enabled = process.env.DISASTERWATCH_GOOGLE_SEARCH_ENABLED === 'true';
const searchKey = process.env.DISASTERWATCH_GEMINI_SEARCH_KEY || process.env.DISASTERWATCH_GEMINI_KEY || '';
const model = process.env.DISASTERWATCH_GOOGLE_SEARCH_MODEL || 'gemini-3.8-flash';
const window = recentWindow();
add('threads-config', 'Threads · pencarian sosial media', process.env.THREADS_ACCESS_TOKEN ? 'configured':'disabled', process.env.THREADS_ACCESS_TOKEN ? 'Token backend tersedia. Request dan hasil publik belum dibuktikan oleh konfigurasi; crawler menjalankan satu pencarian per titik saat gate harian lolos.' : 'Tambahkan THREADS_ACCESS_TOKEN dari OAuth Meta dengan threads_basic dan threads_keyword_search.');
add('dataset-window', `Dataset · ${RECENT_WINDOW_DAYS} hari terakhir`, 'ok', `Rentang ${window.startDate}–${window.endDate} WIB (termasuk hari ini). BNPB snapshot tersaring: ${currentRecords.length} wilayah, ${currentRecords.reduce((n, r) => n + (r.reports?.length ?? 0), 0)} laporan. Snapshot BNPB masih memerlukan impor sumber terbaru; filter bukan bukti pengambilan data baru.`);
add('google-search-config', 'Gemini · Google Search', !enabled ? 'disabled' : searchKey ? 'configured' : 'error', !enabled ? 'DISASTERWATCH_GOOGLE_SEARCH_ENABLED belum true.' : !searchKey ? 'Key backend belum tersedia.' : `Aktif; model ${model}. Key tersedia di backend.`);

let previous: StatusSnapshot | null = null;
try { previous = JSON.parse(await readFile('public/data/google-status.json', 'utf8')); } catch { /* first run */ }
let searchProbe = previous?.searchProbe;
const serpapiKey = process.env.SERPAPI_API_KEY?.trim() || '';
add('serpapi-config', 'SerpApi · Google News', serpapiKey ? 'configured' : 'disabled', serpapiKey ? 'Key backend tersedia. Tiga pencarian per titik: kejadian, kebutuhan, dan penanggulangan/pemulihan.' : 'Tambahkan GitHub Secret SERPAPI_API_KEY untuk mengaktifkan provider.');
let serpProbe = previous?.services.find(s => s.id === 'serpapi-probe');
if (process.env.CHECK_SERPAPI === 'true' && serpapiKey) {
  try {
    const hits = await searchSerpNews('"Gayo Lues" banjir when:7d', serpapiKey);
    serpProbe = { id: 'serpapi-probe', name: 'SerpApi · uji langsung', state: hits.length ? 'ok' : 'empty', detail: `Google News berhasil: ${hits.length} artikel, ${hits.filter(h => h.publishedAt).length} bertanggal. Uji ini tidak menulis artikel atau melewati gate crawler.`, checkedAt: now, scope: 'backend' };
  } catch (e) {
    serpProbe = { id: 'serpapi-probe', name: 'SerpApi · uji langsung', state: 'error', detail: safeStatusError(e), checkedAt: now, scope: 'backend' };
  }
}
if (serpProbe) services.push(serpProbe);
if (process.env.CHECK_GOOGLE_SEARCH === 'true' && enabled && searchKey) {
  try {
    const hits = await searchGemini('"Gayo Lues" banjir kebutuhan bantuan air bersih Oktober 2026', searchKey, model);
    searchProbe = { id: 'google-search-probe', name: 'Google Search · uji langsung', state: hits.length ? 'ok' : 'empty', detail: `Permintaan Gemini selesai dengan Google Search: ${hits.length} sumber berkutip. Uji ini tidak menulis artikel ke Firestore dan tidak melewati gate crawler.`, checkedAt: now, scope: 'backend' };
  } catch (e) {
    searchProbe = { id: 'google-search-probe', name: 'Google Search · uji langsung', state: 'error', detail: safeStatusError(e), checkedAt: now, scope: 'backend' };
  }
}
try {
  const raw = process.env.FIREBASE_NEWS_SERVICE_ACCOUNT;
  if (!raw) add('crawler', 'Crawler berita · gate & hasil tersimpan', 'unknown', 'Service account untuk laporan crawler belum tersedia.');
  else {
    const account = JSON.parse(raw);
    if (account.project_id !== 'disasterwatch-61ed5') throw new Error('Project mismatch');
    const app = initializeApp({ credential: cert(account), projectId: 'disasterwatch-61ed5' }, 'status-probe');
    try {
      const db = getFirestore(app);
      const [runs, google, zapi, googleSample] = await Promise.all([
        db.collection('incidentCrawlRuns').orderBy('startedAt', 'desc').limit(10).get(),
        db.collection('incidentArticles').where('discoveredBy', '==', 'gemini:google-search').count().get(),
        db.collection('incidentArticles').count().get(),
        db.collection('incidentArticles').where('discoveredBy', '==', 'gemini:google-search').select('relevance').limit(500).get(),
      ]);
      const latest = runs.docs.map(d => d.data()).find(r => ['SUCCESS', 'SUCCESS_EMPTY'].includes(r.outcome));
      const at = latest?.finishedAt || latest?.startedAt || null;
      const due = isCrawlDue(at, Date.now());
      add('crawler', 'Crawler berita · gate & hasil tersimpan', 'ok', `Terakhir: ${latest?.outcome || 'belum ada run sukses'}. ${due ? 'Sudah jatuh tempo' : 'Tertahan interval 1 hari'}. Artikel Gemini tersimpan: ${google.data().count}; seluruh artikel: ${zapi.data().count}.`);
      if (at) services[services.length - 1].detail += ` Run sukses: ${at}.`;
      const sample = googleSample.docs.map(d => d.data());
      const matched = sample.filter(a => a.relevance?.status === 'MATCHED').length;
      const review = sample.filter(a => a.relevance?.status === 'REVIEW_REQUIRED').length;
      add('google-search-data', 'Artikel Google · tampil di sidebar', google.data().count ? matched ? 'ok' : 'empty' : 'unknown', `Tersimpan ${google.data().count} artikel Gemini. Sampel ${sample.length}: ${matched} sesuai kejadian, ${review} perlu review. Tanpa tanggal publikasi yang cocok, hasil Gemini masuk review dan tidak otomatis tampil di feed utama.`);
      const [serpCount, serpSample] = await Promise.all([
        db.collection('incidentArticles').where('discoveredBy', '==', 'serpapi:google-news').count().get(),
        db.collection('incidentArticles').where('discoveredBy', '==', 'serpapi:google-news').select('relevance').limit(500).get(),
      ]);
      const serpMatched = serpSample.docs.filter(d => d.data().relevance?.status === 'MATCHED').length;
      const serpReview = serpSample.docs.filter(d => d.data().relevance?.status === 'REVIEW_REQUIRED').length;
      add('serpapi-data', 'Artikel SerpApi · tampil di sidebar', serpCount.data().count ? serpMatched ? 'ok' : 'empty' : 'unknown', `Tersimpan ${serpCount.data().count} artikel. Sampel ${serpSample.size}: ${serpMatched} sesuai kejadian, ${serpReview} perlu review. Berita digabung dengan sumber lain setelah pemeriksaan lokasi dan tanggal.`);

    } finally { await deleteApp(app); }
  }
} catch (e) { add('crawler', 'Crawler berita · gate & hasil tersimpan', 'error', safeStatusError(e)); }
try {
  const flood = JSON.parse(await readFile('public/data/flood.json', 'utf8'));
  services.push({ id: 'flood', name: 'Google Flood Forecasting', state: flood.state === 'ready' ? flood.gauges?.length ? 'ok' : 'empty' : 'error', detail: `Snapshot produksi: ${flood.gauges?.length ?? 0} gauge Indonesia.`, scope: 'snapshot', checkedAt: flood.generatedAt || null });
} catch { add('flood', 'Google Flood Forecasting', 'unknown', 'Snapshot banjir belum tersedia.'); }
await mkdir('public/data', { recursive: true });
const report: StatusSnapshot = { version: 1, generatedAt: now, revision: process.env.GITHUB_SHA?.slice(0, 7) || 'local', services, ...(searchProbe ? { searchProbe } : {}) };
await writeFile('public/data/google-status.json', JSON.stringify(report));
for (const service of [...services, ...(searchProbe ? [searchProbe] : [])]) console.log(`${service.id}: ${service.state} · ${service.detail}`);
