import { newsSourceUrl } from './newsSourceUrl';
import { inRecentWindow } from './recentWindow';
import { NTT_CASE_ID } from '../domain/nttCase';
export interface DisasterPhoto {
  incidentId: string; imageUrl: string; sourceUrl: string; sourceName: string;
  reportDate: string; retrievedAt: string; origin: 'BNPB_DRIVE' | 'NEWS_ARTICLE';
}
export function validDisasterPhoto(photo: DisasterPhoto, id: string, now = Date.now()): boolean {
  return photo?.incidentId === id && !!newsSourceUrl(photo.imageUrl) && !!newsSourceUrl(photo.sourceUrl)
    && !!photo.sourceName && Number.isFinite(Date.parse(photo.retrievedAt))
    && Date.parse(photo.retrievedAt) <= now && now - Date.parse(photo.retrievedAt) < 24 * 3_600_000
    && (id === NTT_CASE_ID || inRecentWindow(photo.reportDate, now));
}
