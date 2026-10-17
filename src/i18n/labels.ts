import { t } from './index';
import type {
  NttContentStatus,
  NttSourceType,
  NttVerificationStatus,
} from '../domain/nttCase';

/**
 * Centralized mapping from internal status/enum codes to localized labels.
 * Keys are the Indonesian source strings so the existing dictionaries apply;
 * raw enum codes are never shown directly in the UI.
 */
const VERIFICATION_LABELS: Record<NttVerificationStatus, string> = {
  VERIFIED: 'Terverifikasi',
  AI_REVIEWED: 'Ditinjau AI',
  UNVERIFIED: 'Belum diverifikasi',
  CONFLICTING: 'Klaim bertentangan',
};

const SOURCE_TYPE_LABELS: Record<NttSourceType, string> = {
  OFFICIAL: 'Resmi',
  NEWS_MEDIA: 'Media berita',
  OTHER: 'Lainnya',
};

const CONTENT_STATUS_LABELS: Record<NttContentStatus, string> = {
  FULL: 'Konten penuh',
  PARTIAL: 'Sebagian',
  METADATA_ONLY: 'Metadata saja',
  FAILED: 'Gagal',
};

const EXTRACTION_LABELS: Record<'HEURISTIC' | 'GEMINI' | 'MANUAL', string> = {
  HEURISTIC: 'Heuristik',
  GEMINI: 'Gemini',
  MANUAL: 'Manual',
};

const CLAIM_TYPE_LABELS: Record<string, string> = {
  damage: 'Kerusakan',
  casualties: 'Korban',
};

const TOPIC_LABELS: Record<string, string> = {
  aftershocks: 'Gempa susulan',
  casualties: 'Korban',
  damage: 'Kerusakan',
  evacuation: 'Evakuasi',
  official_parameters: 'Parameter resmi',
  official_statement: 'Pernyataan resmi',
  official_update: 'Pembaruan resmi',
  shaking: 'Getaran',
  technical_analysis: 'Analisis teknis',
  tsunami_assessment: 'Asesmen tsunami',
};

export const verificationLabel = (value: NttVerificationStatus): string =>
  t(VERIFICATION_LABELS[value] ?? value);
export const sourceTypeLabel = (value: NttSourceType): string =>
  t(SOURCE_TYPE_LABELS[value] ?? value);
export const contentStatusLabel = (value: NttContentStatus): string =>
  t(CONTENT_STATUS_LABELS[value] ?? value);
export const extractionLabel = (value: 'HEURISTIC' | 'GEMINI' | 'MANUAL'): string =>
  t(EXTRACTION_LABELS[value] ?? value);
export const claimTypeLabel = (value: string): string =>
  t(CLAIM_TYPE_LABELS[value] ?? value);
export const topicLabel = (value: string): string =>
  t(TOPIC_LABELS[value] ?? value);
