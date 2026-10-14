import { currentIncidents, currentRecords, CURRENT_REVIEWED_AT } from '../src/data/currentIncidents.ts';
import { nttIncident } from '../src/data/nttIncident.ts';
import { NTT_CASE_ID } from '../src/domain/nttCase.ts';
import { recentWindow } from '../src/services/recentWindow.ts';
import { locationValidation } from '../src/services/locationValidation.ts';

export function realDisasterDataset(now = Date.now()) {
  const window = recentWindow(now);
  const sourced = currentRecords.map(record => ({
    ...currentIncidents[record.id],
    id: record.id, isMock: false, demoNotice: 'REAL', dataOrigin: 'REVIEWED_SOURCE_SNAPSHOT',
    sourceName: record.source, sourceUrl: record.url,
    sourceReviewedAt: CURRENT_REVIEWED_AT, eventDate: record.date,
    eventStartDate: record.startDate ?? record.date,
    officialReports: record.reports ?? [],
    locationValidation: {...locationValidation(record),coordinatePrecision:'REGION_REPRESENTATIVE',requiresSiteFactCheck:true},
    datasetWindow: { startDate: window.startDate, endDate: window.endDate, timeZone: 'Asia/Jakarta' },
    isArchivedCase: false, schemaVersion: 1,
  }));
  const ntt = {
    ...nttIncident, id: NTT_CASE_ID, isMock: false, demoNotice: 'REAL',
    dataOrigin: 'REVIEWED_SOURCE_SNAPSHOT', sourceName: 'BMKG',
    sourceUrl: 'https://www.bmkg.go.id/gempabumi/20261004055834',
    sourceReviewedAt: CURRENT_REVIEWED_AT, eventDate: '2026-10-04', eventStartDate: '2026-10-04',
    officialReports: [], datasetWindow: { startDate: window.startDate, endDate: window.endDate, timeZone: 'Asia/Jakarta' },
    isArchivedCase: true, schemaVersion: 1,
  };
  return [...sourced.filter(record => record.id !== NTT_CASE_ID), ntt];
}

export function canDemoSeedOverwrite(existing: { isMock?: unknown; demoNotice?: unknown } | undefined): boolean {
  return existing?.isMock !== false && existing?.demoNotice !== 'REAL';
}
