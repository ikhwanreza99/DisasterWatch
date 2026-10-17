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

// --- Service-count groundwork (NOT wired into extractRecovery/crawl) ---------
// Conservative evidence parser for affected/restored service counts. Returns
// nulls unless a number is adjacent to BOTH a known count-unit token AND an
// affected/restored verb, with no nearby negation. Hooking this into the crawl
// pipeline requires review of source-evidence policy; until then ingestion
// keeps counts null rather than risk fabrication.
const COUNT_UNITS = ['pelanggan', 'rumah tangga', 'kk', 'kepala keluarga', 'km', 'kilometer', 'unit', 'tower', 'bts', 'gardu', 'trafo', 'sambungan', 'jiwa', 'orang', 'rumah', 'desa', 'pelanggan listrik', 'pelanggan air'];
const AFFECTED_VERBS = /terdampak|terimbas|\bmati\b|padam|putus|terputus|terendam|lumpuh|terganggu|terisolir|rusak|terputusnya/i;
const RESTORED_VERBS = /pulih|kembali normal|menyala|tersambung|beroperasi kembali|dibuka kembali|dapat dilalui|bisa dilalui|normal kembali|baik kembali|tersambung kembali/i;
const NEGATION = /\b(tidak|tanpa|belum|bukan)\b/i;

export interface ServiceCountEvidence {
  affected: number | null;
  affectedUnit: string | null;
  restored: number | null;
  restoredUnit: string | null;
}

function parseCountNumber(raw: string): number | null {
  const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Extract explicitly stated affected/restored counts, or all-nulls. Pure. */
export function extractServiceCounts(title: string, summary: string | null): ServiceCountEvidence {
  const text = `${title}\n${summary ?? ''}`;
  const out: ServiceCountEvidence = { affected: null, affectedUnit: null, restored: null, restoredUnit: null };
  const re = /(\d[\d.,]*)\s*([A-Za-z]+(?: [A-Za-z]+){0,2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // Longest known-unit prefix: "pelanggan terdampak…" → "pelanggan".
    const words = m[2]!.trim().toLowerCase().split(/\s+/);
    let unit: string | null = null;
    for (let len = Math.min(3, words.length); len >= 1; len--) {
      const cand = words.slice(0, len).join(' ');
      if (COUNT_UNITS.includes(cand)) {
        unit = cand;
        break;
      }
    }
    if (!unit) continue;
    if (NEGATION.test(text.slice(Math.max(0, m.index - 14), m.index))) continue;
    const n = parseCountNumber(m[1]!);
    if (n === null) continue;
    // Proximity attribution: verbs right after the figure win (Indonesian
    // predicative order: "400 pelanggan terdampak"); fallback to verbs just
    // before it. Both/neither within range → ambiguous → skipped, never guessed.
    // (Measured from the end of the matched unit, not the raw match.)
    const unitEnd = m.index + m[1]!.length + 1 + unit.length;
    const after = text.slice(unitEnd, unitEnd + 30);
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    const afterR = RESTORED_VERBS.test(after);
    const afterA = AFFECTED_VERBS.test(after);
    const beforeR = RESTORED_VERBS.test(before);
    const beforeA = AFFECTED_VERBS.test(before);
    let kind: 'restored' | 'affected' | null = null;
    if (afterR && !afterA) kind = 'restored';
    else if (afterA && !afterR) kind = 'affected';
    else if (beforeR && !beforeA) kind = 'restored';
    else if (beforeA && !beforeR) kind = 'affected';
    else continue;
    if (kind === 'restored' && out.restored === null) {
      out.restored = n;
      out.restoredUnit = unit;
    } else if (kind === 'affected' && out.affected === null) {
      out.affected = n;
      out.affectedUnit = unit;
    }
  }
  return out;
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
      // Counts are never extracted here today: only explicitly sourced figures
      // may populate them (see extractServiceCounts groundwork below and the
      // crawl hook-point note). Null preserves "unknown", never zero.
      restoredCount: null,
      restorationCriterion: null,
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
