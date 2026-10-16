import type { DisasterIncident } from '../../types';
import { findIncidentMatches } from './assistantConversation';

export type WorkflowType = 'menu' | 'report-disaster' | 'report-needs' | 'find-posts' | 'learn-disaster';
export interface ReportQuestion { key: string; label: string; text: string }
export const reportQuestions: ReportQuestion[] = [
  { key: 'location', label: 'Lokasi', text: 'Di mana bencana terjadi? Sebutkan kota/kabupaten dan lokasi yang lebih spesifik, seperti desa atau alamat.' },
  { key: 'category', label: 'Jenis bencana', text: 'Jenis bencana apa yang ingin Anda laporkan?' },
  { key: 'time', label: 'Waktu', text: 'Kapan bencana terjadi? Sebutkan tanggal dan perkiraan waktunya.' },
  { key: 'description', label: 'Kondisi dan dampak', text: 'Ceritakan kondisi di lokasi dan dampak yang Anda lihat, termasuk warga yang terdampak.' },
  { key: 'urgency', label: 'Urgensi', text: 'Seberapa mendesak kondisinya? Apakah ada warga yang masih membutuhkan pertolongan segera?' },
];
export const needsQuestions: ReportQuestion[] = [
  { key: 'items', label: 'Kebutuhan', text: 'Bantuan apa yang dibutuhkan? Sebutkan jenis, jumlah, dan satuannya jika diketahui.' },
  { key: 'location', label: 'Lokasi', text: 'Di mana bantuan dibutuhkan? Sebutkan kota/kabupaten serta nama posko, desa, atau alamat.' },
  { key: 'category', label: 'Jenis bencana', text: 'Kebutuhan ini terkait bencana apa?' },
  { key: 'victims', label: 'Penerima bantuan', text: 'Berapa orang atau keluarga yang membutuhkan bantuan tersebut?' },
  { key: 'access', label: 'Akses dan kontak', text: 'Bagaimana akses menuju lokasi dan siapa kontak yang bisa dihubungi untuk penyaluran bantuan?' },
  { key: 'urgency', label: 'Urgensi', text: 'Kebutuhan mana yang paling mendesak dan kapan bantuan diperlukan?' },
];
export const isReportWorkflow = (workflow: WorkflowType) => workflow === 'report-disaster' || workflow === 'report-needs';
export function getReportQuestions(workflow: WorkflowType, hasContext: boolean): ReportQuestion[] {
  return workflow === 'report-needs' ? needsQuestions : hasContext
    ? [reportQuestions[0], reportQuestions[1], reportQuestions[3], reportQuestions[2], reportQuestions[4]] : reportQuestions;
}
export function validateReportAnswers(answers: Record<string, string>, questions: ReportQuestion[]): ReportQuestion | undefined {
  return questions.find(question => !answers[question.key]?.trim());
}
export function attachmentError(file: Pick<File, 'size' | 'type'>): string | null {
  if (file.size > 5 * 1024 * 1024) return 'Ukuran dokumen maksimal 5 MB. Pilih file yang lebih kecil.';
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) return 'Gunakan foto JPG, PNG, WebP, atau dokumen PDF.';
  return null;
}
export function matchReportIncident(location: string, category: string, incidents: DisasterIncident[]): DisasterIncident | undefined {
  const matches = findIncidentMatches(location, incidents);
  // A combined incident label must not claim a more precise location's coordinates.
  const exact = matches.filter(incident => {
    const place = incident.name.toLocaleLowerCase();
    return location.toLocaleLowerCase().includes(place);
  });
  const categoryMatches = exact.filter(incident => {
    const value = category.toLocaleLowerCase();
    const type = /banjir|flood/.test(value) ? 'flood' : /gempa|earthquake/.test(value) ? 'earthquake' : /kebakaran|fire/.test(value) ? 'fire' : /longsor|landslide/.test(value) ? 'landslide' : 'other';
    return incident.category === type;
  });
  return categoryMatches.length === 1 ? categoryMatches[0] : undefined;
}

/** Confirmed fields precede original notes so later corrections take precedence. */
export function buildReportText(workflow: WorkflowType, answers: Record<string, string>, questions: ReportQuestion[], narrative: string, fileName?: string): string {
  return [
    workflow === 'report-needs' ? 'Laporan kebutuhan bantuan' : 'Laporan bencana',
    'ISIAN TERKONFIRMASI (menggantikan keterangan awal jika berbeda):',
    ...questions.map(question => `${question.label}: ${answers[question.key]}`),
    `Dokumen: ${fileName || 'Tidak ada'}`,
    ...(narrative ? [`KETERANGAN AWAL (referensi saja; gunakan isian terkonfirmasi jika dikoreksi): ${narrative}`] : []),
  ].join('\n');
}
