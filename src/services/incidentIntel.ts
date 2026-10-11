// Aid + posko metadata extraction (heuristic; Gemini client reused only for summaries).
// Every unavailable value stays null. No invented contacts/addresses/coords/quantities.
// Place names are NEVER treated as verified coordinates (coordSource stays null
// unless matched to an existing official checkpoint).
import type { CitizenReport } from '../types';
import type { AidDistributionStatus, AidEventRecord, IncidentArticle, PoskoRecord, PoskoType } from '../domain/incidentDetail';

const AID_TYPES: Array<[RegExp, string]> = [
  [/masker|respirator/i, 'masker'],
  [/air\s*bersih|air\s*minum|air mineral|tangki air/i, 'air_bersih'],
  [/sembako|makanan|beras|pangan|makanan siap saji/i, 'makanan'],
  [/obat|medis|ispa|layanan kesehatan/i, 'medis'],
  [/tenda|selimut|terpal|hunian sementara/i, 'tempat_tinggal'],
  [/perahu|kano|boat|speedboat/i, 'perahu_evakuasi'],
  [/pompa|genset|listrik/i, 'peralatan'],
  [/karung pasir|pasir|bronjong|tiang pancang/i, 'material_tanggul'],
  [/pakaian|kelambu/i, 'pakaian'],
  [/donasi|uang tunai|dana/i, 'donasi'],
];

const ORGS = /(BNPB|BPBD|BMKG|PMI|Tagana|Manggala Agni|TNI|Polri|Basarnas|Dinas Sosial|Dinsos|Pemkab|Pemkot|Pemprov|relawan|posko)/i;

function aidStatusOf(t: string): AidDistributionStatus {
  if (/disalurkan|dibagikan|didistribusikan|tersalurkan|diterima/i.test(t)) return 'REPORTED_DISTRIBUTED';
  if (/diterima/i.test(t)) return 'REPORTED_RECEIVED';
  if (/dikirim|dikerahkan|distribusi|menyalurkan/i.test(t)) return 'REPORTED_DISPATCHED';
  if (/butuh|dibutuhkan|kekurangan|mendesak|kebutuhan/i.test(t)) return 'REPORTED_NEEDED';
  return 'UNKNOWN';
}

function qtyOf(t: string): { quantity: number | null; unit: string | null } {
  const m = t.match(/(\d[\d.,]*)\s*(paket|dus|pcs|unit|karung|tanki|tangki|liter|kg|ton|keluarga|orang|jiwa|tenda|masker|kantong)/i);
  if (!m) return { quantity: null, unit: null };
  const n = parseFloat(m[1]!.replace(/\./g, '').replace(',', '.'));
  return { quantity: Number.isFinite(n) ? n : null, unit: m[2]!.toLowerCase() };
}

function orgOf(t: string): string | null {
  const m = t.match(ORGS);
  return m ? m[1]! : null;
}

let seq = 0;
function nextId(prefix: string, incidentId: string): string {
  seq += 1;
  return `${prefix}-${incidentId.slice(0, 12)}-${Date.now().toString(36)}-${seq}`;
}

/** Extract aid EVENTS from article text. Needs-only mentions become REPORTED_NEEDED, kept separate from distributions. */
export function extractAidEvents(article: IncidentArticle, incidentId: string, isMock: boolean): AidEventRecord[] {
  const text = `${article.title}\n${article.summary ?? ''}`;
  if (!/bantuan|distribusi|disalurkan|dibagikan|diterima|dikirim|logistik|donasi|butuh|sembako|masker|tenda|posko|evakuasi/i.test(text)) return [];
  const status = aidStatusOf(text);
  const { quantity, unit } = qtyOf(text);
  const org = orgOf(text);
  const types = AID_TYPES.filter(([re]) => re.test(text)).map(([, t]) => t);
  if (types.length === 0) types.push('logistik_umum');
  return types.slice(0, 3).map((aidType) => ({
    aidId: nextId('aid', incidentId),
    incidentId,
    articleId: article.url,
    aidType,
    quantity,
    unit,
    estimatedValue: null,
    recipientOrDestination: article.summary?.match(/(warga|pengungsi|korban|posko)[^.,;]{0,60}/i)?.[0] ?? null,
    location: null,
    distributingOrganization: org,
    distributionStatus: status,
    eventTime: article.publishedAt,
    sourceUrl: article.url,
    sourceName: article.sourceName,
    verificationStatus: article.sourceType === 'OFFICIAL' ? ('AI_REVIEWED' as const) : ('UNVERIFIED' as const),
    recordKind: 'REPORTED_EVENT' as const,
    isMock,
  }));
}

function poskoTypeOf(t: string): PoskoType {
  if (/posko utama|posko komando|pusdalops/i.test(t)) return 'COMMAND_POST';
  if (/pengungsi|pengungsian|shelter|tenda pengungsi|evakuasi/i.test(t)) return 'EVACUATION_SHELTER';
  if (/gudang|logistik/i.test(t)) return 'LOGISTICS_DEPOT';
  if (/posko|pos aju/i.test(t)) return 'FIELD_POST';
  return 'UNKNOWN';
}

/** Extract posko mentions. Coords ALWAYS null here (no geocoding); matched later to official checkpoints. */
export function extractPosko(article: IncidentArticle, incidentId: string, isMock: boolean): PoskoRecord[] {
  const text = `${article.title}\n${article.summary ?? ''}`;
  if (!/posko|pengungsi|pengungsian|evakuasi|shelter/i.test(text)) return [];
  const names = new Set<string>();
  const re = /(Posko(?: Utama| Lapangan| Induk)?[^.,;()]{2,60}|pengungsian[^.,;()]{2,60})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = m[1]!.trim().replace(/\s+/g, ' ');
    if (n.length >= 4) names.add(n);
  }
  if (names.size === 0) names.add('Titik pengungsian/posko (nama spesifik tidak tersedia)');
  const desa = text.match(/Desa\s+([A-Z][\w\s.-]{1,30})/)?.[1]?.trim() ?? null;
  const kec = text.match(/Kecamatan\s+([A-Z][\w\s.-]{1,30})/)?.[1]?.trim() ?? null;
  const kab = text.match(/(Kabupaten|Kota)\s+([A-Z][\w\s.-]{1,30})/)?.[2]?.trim() ?? null;
  return [...names].slice(0, 3).map((name) => ({
    poskoId: nextId('posko', incidentId),
    incidentId,
    articleId: article.url,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    poskoType: poskoTypeOf(text),
    address: null,
    village: desa,
    regency: kab ?? kec,
    province: null,
    latitude: null,
    longitude: null,
    coordSource: null,
    contact: null,
    capacity: null,
    occupancy: null,
    operationalStatus: null,
    lastUpdatedAt: article.publishedAt,
    sourceUrl: article.url,
    sourceName: article.sourceName,
    verificationStatus: 'UNVERIFIED' as const,
    isMock,
  }));
}

/** Convert an in-app citizen/official report into aid+posko evidence (source-linked, mock-flagged). */
export function extractFromReport(r: CitizenReport, incidentId: string, isMock: boolean): { aid: AidEventRecord[]; posko: PoskoRecord[] } {
  const pseudo: IncidentArticle = {
    url: r.sourceUrl ?? `report:${r.id}`,
    title: r.title ?? r.desc.slice(0, 120),
    sourceName: r.author || 'Laporan aplikasi',
    sourceType: r.sourceType === 'official' ? 'OFFICIAL' : 'OTHER',
    publishedAt: null,
    retrievedAt: new Date().toISOString(),
    summary: r.desc,
    contentStatus: 'PARTIAL',
    incidentId,
    discoveredBy: 'in-app-report',
  };
  return { aid: extractAidEvents(pseudo, incidentId, isMock), posko: extractPosko(pseudo, incidentId, isMock) };
}
