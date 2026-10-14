import 'dotenv/config';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { allCurrentRecords, currentRecords, currentArticles } from '../src/data/currentIncidents.ts';
import { nttArticlesSeed } from '../src/data/nttCase.ts';
import { NTT_CASE_ID } from '../src/domain/nttCase.ts';
import { descriptorFor } from '../src/services/incidentRegistry.ts';
import { classifyRelevance } from '../src/services/incidentNews.ts';
import { driveFolders, driveImage, fetchArticleImage } from './providers/disasterPhotos.ts';
import { newsSourceUrl } from '../src/services/newsSourceUrl.ts';
import type { DisasterPhoto } from '../src/services/disasterPhoto.ts';
import type { IncidentArticle } from '../src/domain/incidentDetail.ts';

async function main() {
  const retrievedAt = new Date().toISOString();
  const photos: Record<string, DisasterPhoto> = {};
  const candidates: Array<IncidentArticle & { imageUrl?: string | null }> = [...currentArticles,
    ...nttArticlesSeed.map(a => ({ ...a, eventDate: a.eventDate ?? undefined, incidentId: a.caseId }))];
  const raw = process.env.FIREBASE_NEWS_SERVICE_ACCOUNT;
  if (raw) {
    const account = JSON.parse(raw);
    if (account.project_id !== 'disasterwatch-61ed5') throw new Error('Project mismatch');
    const app = initializeApp({ credential: cert(account), projectId: account.project_id }, 'photo-snapshot');
    try {
      const stored = await getFirestore(app).collection('incidentArticles').select('incidentId', 'title', 'url', 'sourceName', 'sourceType', 'publishedAt', 'retrievedAt', 'summary', 'contentStatus', 'discoveredBy', 'imageUrl').limit(1000).get();
      for (const doc of stored.docs) {
        const a = doc.data();
        candidates.push({ ...a, incidentId: null, targetIncidentId: a.incidentId } as IncidentArticle & { imageUrl?: string; targetIncidentId: string });
      }
    } catch { console.log('Photo article read unavailable; using reviewed source metadata'); }
    finally { await deleteApp(app); }
  }
  const records = [...currentRecords, ...allCurrentRecords.filter(r => r.id === NTT_CASE_ID && !currentRecords.some(c => c.id === r.id))];
  const queue = [...records];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let record = queue.shift(); record; record = queue.shift()) {
      let photo: DisasterPhoto | null = null;
      if (process.env.BNPB_DRIVE_API_KEY) {
        const folders = [...(record.reports ?? [])].sort((a,b) => b.date.localeCompare(a.date)).flatMap(report => driveFolders(report.documentationUrl ?? '').map(folder => ({ folder, reportDate: report.date })));
        for (const { folder, reportDate } of folders.slice(0, 2)) {
          try {
            const image = await driveImage(folder, process.env.BNPB_DRIVE_API_KEY);
            if (image) { photo = { ...image, incidentId: record.id, sourceName: 'BNPB · Dokumentasi kejadian', reportDate, retrievedAt, origin: 'BNPB_DRIVE' }; break; }
          } catch { /* Private/unavailable folders do not prevent publisher fallback. */ }
        }
      }
      const descriptor = descriptorFor(record.id);
      if (!photo && descriptor) {
        const matched = candidates.filter(a => {
          const target = (a as IncidentArticle & { targetIncidentId?: string }).targetIncidentId;
          return (!target || target === record!.id) && classifyRelevance(a, descriptor).status === 'MATCHED';
        }).sort((a, b) => Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? ''));
        for (const article of matched.filter(a => a.sourceType !== 'OFFICIAL' || a.discoveredBy !== 'bnpb-documentation').slice(0, 3)) {
          try {
            const imageUrl = newsSourceUrl(article.imageUrl) ?? await fetchArticleImage(article.url);
            const sourceUrl = newsSourceUrl(article.url);
            if (!imageUrl || !sourceUrl) continue;
            const reportDate = article.publishedAt ?? article.eventDate ?? (record.id === NTT_CASE_ID ? '2026-10-04' : null);
            if (!reportDate) continue;
            photo = { incidentId: record.id, imageUrl, sourceUrl, sourceName: article.sourceName, reportDate, retrievedAt, origin: 'NEWS_ARTICLE' }; break;
          } catch { /* Blocked publisher/hotlink: leave unavailable instead of inventing. */ }
        }
      }
      if (photo) photos[record.id] = photo;
    }
  }));
  await mkdir('public/data', { recursive: true });
  await writeFile('public/data/disaster-photos.json', JSON.stringify({ version: 1, generatedAt: retrievedAt, photos }));
  try {
    const status = JSON.parse(await readFile('public/data/google-status.json', 'utf8'));
    status.services = [...status.services.filter((s: {id:string}) => !['bnpb-drive-photos', 'disaster-photos'].includes(s.id)),
      { id:'bnpb-drive-photos', name:'Google Drive · dokumentasi BNPB', state:process.env.BNPB_DRIVE_API_KEY ? Object.values(photos).some(p => p.origin === 'BNPB_DRIVE') ? 'ok' : 'configured' : 'disabled', detail:process.env.BNPB_DRIVE_API_KEY ? `${Object.values(photos).filter(p => p.origin === 'BNPB_DRIVE').length} foto dari folder BNPB yang bisa diakses. Folder privat/hasil kosong memakai fallback berita.` : 'Tambahkan BNPB_DRIVE_API_KEY untuk membaca folder publik. Foto berita tetap diproses.', scope:'backend', checkedAt:retrievedAt },
      { id:'disaster-photos', name:'Foto · dokumentasi kejadian', state:Object.keys(photos).length ? 'ok' : 'empty', detail:`Metadata foto tersedia untuk ${Object.keys(photos).length}/${records.length} titik. Memuat sumber dan tanggal laporan; keberhasilan render gambar di browser belum diuji oleh snapshot ini.`, scope:'snapshot', checkedAt:retrievedAt },
    ];
    await writeFile('public/data/google-status.json', JSON.stringify(status));
  } catch { /* Standalone photo generation does not require a status report. */ }
  console.log(`Photo snapshot: ${Object.keys(photos).length}/${records.length} sourced photos; BNPB Drive ${process.env.BNPB_DRIVE_API_KEY ? 'configured' : 'not configured'}`);
}
main().catch(() => { console.error('Photo snapshot failed (no keys or provider bodies logged)'); process.exitCode = 1; });
