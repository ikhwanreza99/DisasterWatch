// Needs + recovery extraction (heuristic, deterministic, browser-safe).
// Rules: emit ONLY when an item/service keyword is present (never infer from generic
// disaster text); unknown quantities are null; AI_REVIEWED is never VERIFIED.
import type {
  IncidentAidNeedDoc,
  IncidentRecoveryDoc,
  NeedItemCategory,
  NeedStatus,
  RecoveryServiceType,
  RecoveryStatus,
} from '../../domain/humanitarian';
import { isValidRecoveryStatus, remainingNeed, stableId } from '../../domain/humanitarian';
import type { VerificationStatus } from '../../domain/intelligence';

interface Ctx {
  incidentId: string;
  sourceUrl: string | null;
  sourceOrganization: string | null;
  sourceType: 'OFFICIAL' | 'NEWS_MEDIA' | 'OTHER';
  reportedAt: string | null;
  now: string;
  isMock: boolean;
}

const NEED_PATTERNS: Array<{ re: RegExp; category: NeedItemCategory; name: string }> = [
  // FOOD_NUTRITION
  { re: /makanan siap saji/i, category: 'FOOD_NUTRITION', name: 'makanan siap saji' },
  { re: /sembako|bahan makanan/i, category: 'FOOD_NUTRITION', name: 'sembako' },
  { re: /beras/i, category: 'FOOD_NUTRITION', name: 'beras' },
  { re: /nasi/i, category: 'FOOD_NUTRITION', name: 'nasi' },
  { re: /sari[kenteng]|ubi|selai/i, category: 'FOOD_NUTRITION', name: 'ganti nasi' },
  // DRINKING_WATER
  { re: /air minum/i, category: 'DRINKING_WATER', name: 'air minum' },
  { re: /air minum bersih/i, category: 'DRINKING_WATER', name: 'air minum bersih' },
  { re: /air penyangga/i, category: 'DRINKING_WATER', name: 'air penyangga' },
  { re: /aqua|mineral|isi ulang/i, category: 'DRINKING_WATER', name: 'air mineral/isi ulang' },
  // HYGIENE_SANITATION
  { re: /pembalut/i, category: 'HYGIENE_SANITATION', name: 'pembalut' },
  { re: /sabun/i, category: 'HYGIENE_SANITATION', name: 'sabun' },
  { re: /hygiene kit|paket kebersihan/i, category: 'HYGIENE_SANITATION', name: 'hygiene kit' },
  { re: /toilet portable|toilet darurat|MCK/i, category: 'HYGIENE_SANITATION', name: 'toilet darurat' },
  { re: /kilat\s*urine|disinfektan/i, category: 'HYGIENE_SANITATION', name: 'kilat/urine' },
  // BABY_CHILDCARE
  { re: /popok (bayi|dewasa|anak)/i, category: 'BABY_CHILDCARE', name: 'popok' },
  { re: /susu bayi|ASI|emak membesarkan/i, category: 'BABY_CHILDCARE', name: 'susu bayi/ASI' },
  { re: /fomula|susu gantung|pendamping susu/i, category: 'BABY_CHILDCARE', name: 'fomula/pendamping susu' },
  { re: /alat perawatan bayi/i, category: 'BABY_CHILDCARE', name: 'alat perawatan bayi' },
  // MENSTRUAL_HEALTH
  { re: /wanda|kanker|peach|higiena|sprei|selubung/i, category: 'MENSTRUAL_HEALTH', name: 'perlengkapan menstruasi' },
  { re: /tissue|handuk|lap menstruasi/i, category: 'MENSTRUAL_HEALTH', name: 'perlengkapan menstruasi' },
  // CLOTHING_BEDDING
  { re: /pakaian|baju/i, category: 'CLOTHING_BEDDING', name: 'pakaian' },
  { re: /selimut/i, category: 'CLOTHING_BEDDING', name: 'selimut' },
  { re: /tenda|terpal|tikar|kasur/i, category: 'CLOTHING_BEDDING', name: 'tenda/terpal/tikas' },
  { re: /piyama|selimut|tirai/i, category: 'CLOTHING_BEDDING', name: 'pakaian tidur' },
  // SHELTER
  { re: /rumah|kawang|ka longgar/i, category: 'SHELTER', name: 'shelter/kawang' },
  { re: /tenda|tarpaulin/i, category: 'SHELTER', name: 'tenda' },
  { re: /kosakata|lama|perumahan/i, category: 'SHELTER', name: 'shelter permanen' },
  // HEALTH_MEDICAL
  { re: /obat|medis|ispa|layanan kesehatan/i, category: 'HEALTH_MEDICAL', name: 'obat/medis' },
  { re: /masker|respirator|P3K/i, category: 'HEALTH_MEDICAL', name: 'masker/alat kesehatan' },
  { re: /termometer|lunak|peralatan medis/i, category: 'HEALTH_MEDICAL', name: 'peralatan medis' },
  // VECTOR_CONTROL
  { re: /kelambu|repulan|insid|larva/i, category: 'VECTOR_CONTROL', name: 'kelambu/repelan' },
  { re: /toksis|samap|habitat ikan/i, category: 'VECTOR_CONTROL', name: 'pengendalian vektor' },
  // WATER_TREATMENT
  { re: /tabir\s*air|filter|ku air|leser air/i, category: 'WATER_TREATMENT', name: 'penjenangan air' },
  { re: /bod|kilat|air/i, category: 'WATER_TREATMENT', name: 'penyehatan air' },
  // POWER_LIGHTING
  { re: /genset|pompa|listrik|PLN/i, category: 'POWER_LIGHTING', name: 'genset/listrik' },
  { re: /lampu|cahaya|surya|candle/i, category: 'POWER_LIGHTING', name: 'lampu/surya' },
  // COMMUNICATION
  { re: /sinyal|internet|HP|pulsa|kuota/i, category: 'COMMUNICATION', name: 'sinyal/internet' },
  { re: /daya|baterai|charger/i, category: 'COMMUNICATION', name: 'daya/baterai' },
  // RESCUE_ACCESS
  { re: /evakuasi|perahu karet|boats/i, category: 'RESCUE_ACCESS', name: 'evakuasi/perahu' },
  { re: /kursi|rolet|stretcher|gurney/i, category: 'RESCUE_ACCESS', name: 'akses medis' },
  // DISABILITY_ELDERLY_CARE
  { re: /dapur|pension|tua|cacah|buta|andisepas/i, category: 'DISABILITY_ELDERLY_CARE', name: 'perawatan tua/disabilitas' },
  { re: /kursi roda|fasilitas disabilitas/i, category: 'DISABILITY_ELDERLY_CARE', name: 'fasilitas disabilitas' },
  // LOGISTICS
  { re: /karung|pasir|bronjong|tiang pancang/i, category: 'LOGISTICS', name: 'material tanggul' },
  { re: /pompa|genset|perahu|tandu|mobil tangki|truk/i, category: 'LOGISTICS', name: 'logistik peralatan' },
  // OTHER
  { re: /lain/i, category: 'OTHER', name: 'butuhan lain' },
];

function qtyNear(text: string, index: number): { quantity: number | null; unit: string | null } {
  const window = text.slice(Math.max(0, index - 40), index + 60);
  const m = window.match(/(\d[\d.,]*)\s*(paket|dus|pcs|unit|karung|tanki|tangki|liter|kg|ton|lembar|buah|kaleng|botol|orang|jiwa|keluarga|tenda|masker|kantong|kotak)/i);
  if (!m) return { quantity: null, unit: null };
  const n = parseFloat(m[1]!.replace(/\./g, '').replace(',', '.'));
  return { quantity: Number.isFinite(n) ? n : null, unit: m[2]!.toLowerCase() };
}

function beneficiaryOf(text: string): string | null {
  const m = text.match(/(bayi|balita|anak-anak|lansia|ibu hamil|ibu menyusui|disabilitas)/i);
  return m ? m[1]!.toLowerCase() : null;
}

function priorityOf(text: string): 'HIGH' | 'NORMAL' {
  return /mendesak|darurat|segera|sangat butuh|kritis/i.test(text) ? 'HIGH' : 'NORMAL';
}

function areaOf(text: string): string | null {
  const m = text.match(/(Desa|Kelurahan|Kecamatan|Kabupaten|Kota)\s+([A-Z][\w\s.'-]{1,40})/);
  return m ? `${m[1]} ${m[2]!.trim()}` : null;
}

function verificationOf(sourceType: Ctx['sourceType']): VerificationStatus {
  return sourceType === 'OFFICIAL' ? 'AI_REVIEWED' : 'UNVERIFIED';
}

/** Extract needs — one record per distinct item. No keyword → no record (never inferred). */
export function extractNeeds(title: string, summary: string | null, ctx: Ctx): IncidentAidNeedDoc[] {
  const text = `${title}\n${summary ?? ''}`;
  if (!/butuh|dibutuhkan|kekurangan|mendesak|kebutuhan|kurang|bantuan|distribusi|disalurkan|dibagikan|dikirim|diterima|donasi/i.test(text)) return [];
  const out: IncidentAidNeedDoc[] = [];
  const seen = new Set<string>();
  for (const p of NEED_PATTERNS) {
    const m = text.match(p.re);
    if (!m || m.index == null) continue;
    const key = `${p.category}|${p.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { quantity, unit } = qtyNear(text, m.index);
    const received = /diterima|disalurkan|dibagikan|didistribusikan|tersalurkan/i.test(text) ? quantity : null;
    const status: NeedStatus = 'REPORTED';
    out.push({
      id: stableId(ctx.incidentId, p.category, p.name, areaOf(text) ?? '', ctx.sourceUrl ?? ''),
      incidentId: ctx.incidentId,
      itemCategory: p.category,
      itemName: p.name,
      quantityNeeded: quantity,
      unit,
      quantityReceived: received,
      quantityDistributed: null,
      quantityRemaining: remainingNeed(quantity, received, null),
      priority: priorityOf(text),
      beneficiaryGroup: beneficiaryOf(text),
      affectedArea: areaOf(text),
      status,
      statusReason: null,
      sourceUrl: ctx.sourceUrl,
      sourceOrganization: ctx.sourceOrganization,
      verificationStatus: verificationOf(ctx.sourceType),
      reportedAt: ctx.reportedAt,
      lastUpdatedAt: ctx.now,
      isMock: ctx.isMock,
      schemaVersion: 1,
    });
  }
  return out;
}

// --- Recovery extraction (category-specific statuses, history-ready, no invented ETAs) ---
const SERVICE_PATTERNS: Array<{ re: RegExp; service: RecoveryServiceType }> = [
  { re: /listrik|pln|genset|padam/i, service: 'POWER' },
  { re: /telekomunikasi|telkom|sinyal|internet|bts/i, service: 'TELECOMMUNICATIONS' },
  { re: /air bersih|air minum|sanitasi|pdam|sumur/i, service: 'WASH' },
  { re: /jalan|jembatan|akses|rute|pelabuhan|bandara/i, service: 'ACCESS_TRANSPORT' },
  { re: /sekolah|rumah sakit|puskesmas|pasar|kantor|fasilitas umum|gedung/i, service: 'PUBLIC_FACILITIES' },
];

function statusFor(service: RecoveryServiceType, text: string): RecoveryStatus {
  const bad = /padam|mati|putus|terputus|rusak|hancur|terendam|tertutup|terisolir|terganggu/i;
  const partial = /sebagian|parsial|terbatas|satu arah|bergiliran|dalam pemulihan|perbaikan/i;
  const good = /pulih|normal|kembali beroperasi|tersambung|dibuka|aman digunakan/i;
  switch (service) {
    case 'POWER':
    case 'TELECOMMUNICATIONS':
      if (good.test(text)) return 'RESTORED';
      if (partial.test(text)) return 'PARTIAL_OUTAGE';
      if (bad.test(text)) return 'OUTAGE';
      return 'UNKNOWN';
    case 'WASH':
      if (good.test(text)) return 'RESTORED';
      if (partial.test(text)) return 'LIMITED';
      if (bad.test(text)) return 'UNAVAILABLE';
      return 'UNKNOWN';
    case 'ACCESS_TRANSPORT':
      if (/rute alternatif|jalur alternatif|memutar/i.test(text)) return 'ALTERNATE_ROUTE';
      if (good.test(text)) return 'OPEN';
      if (partial.test(text)) return 'RESTRICTED';
      if (bad.test(text)) return 'CLOSED';
      return 'UNKNOWN';
    case 'PUBLIC_FACILITIES':
      if (good.test(text)) return 'RESTORED';
      if (partial.test(text)) return 'PARTIALLY_DAMAGED';
      if (bad.test(text)) return 'DAMAGED_CLOSED';
      return 'UNKNOWN';
  }
}

/** Extract recovery signals — one doc per service+area with a single-entry history. */
export function extractRecovery(title: string, summary: string | null, ctx: Ctx): IncidentRecoveryDoc[] {
  const text = `${title}\n${summary ?? ''}`;
  const out: IncidentRecoveryDoc[] = [];
  const seen = new Set<string>();
  for (const p of SERVICE_PATTERNS) {
    if (!p.re.test(text)) continue;
    const area = areaOf(text);
    const key = `${p.service}|${area ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const status = statusFor(p.service, text);
    const at = ctx.reportedAt ?? ctx.now;
    const entry = {
      status,
      at,
      sourceUrl: ctx.sourceUrl,
      sourceOrganization: ctx.sourceOrganization,
      note: null as string | null,
    };
    if (!isValidRecoveryStatus(p.service, status)) continue;
    out.push({
      id: `${ctx.incidentId}__${p.service}__${area ?? 'general'}`,
      incidentId: ctx.incidentId,
      serviceType: p.service,
      affectedArea: area,
      affectedEntity: null,
      impactDescription: text.slice(0, 280),
      affectedCount: null,
      unit: null,
      waterSafety: p.service === 'WASH' ? (/aman (diminum|dikonsumsi)/i.test(text) ? 'SAFE' : /tercemar|terkontaminasi/i.test(text) ? 'UNSAFE' : 'UNKNOWN') : null,
      estimatedRestorationAt: null, // never invented; only set from sourced estimates
      restoredAt: status === 'RESTORED' || status === 'OPERATIONAL' || status === 'OPEN' || status === 'AVAILABLE' ? at : null,
      history: [entry],
      sourceUrl: ctx.sourceUrl,
      sourceOrganization: ctx.sourceOrganization,
      verificationStatus: verificationOf(ctx.sourceType),
      reportedAt: ctx.reportedAt,
      lastUpdatedAt: ctx.now,
      isMock: ctx.isMock,
      schemaVersion: 1,
    });
  }
  return out;
}
