// AI assistant: grounded answering over app data. Gemini when available, deterministic fallback otherwise.
//
// Architecture: USER QUESTION → current app state → buildAssistantSnapshot (deterministic,
// same engines as the dashboard) → Gemini verbalises → grounded answer.
// Gemini never invents numbers; the snapshot is the single source of truth.
import type { DisasterIncident } from '../../types';
import type { AidRecord, IntelligenceReport } from '../../domain/intelligence';
import { needLabel } from '../../domain/intelligence';
import { getGeminiModel } from '../../lib/firebase/ai';
import { localeFor, translate } from '../../i18n';
import { ASSISTANT_SYSTEM } from './prompts';
import { summarizeGaps } from '../intelligence/aidGapEngine';
import {
  buildAssistantSnapshot,
  computeDashboardStats,
  renderAssistantContextText,
} from './disasterAssistantContext';

export interface AssistantDeps {
  disasters: Record<string, DisasterIncident>;
  reports: IntelligenceReport[];
  aid: AidRecord[];
}

// Re-exported so existing callers can migrate to the authoritative builder.
export { buildAssistantSnapshot, computeDashboardStats, renderAssistantContextText };

/** Back-compat: compact factual context block for the Gemini prompt. */
export function buildDisasterContext(deps: AssistantDeps, maxChars = 6000): string {
  return renderAssistantContextText(buildAssistantSnapshot(deps), maxChars);
}

function fmt(n: number): string {
  return n.toLocaleString(localeFor());
}

/** Deterministic fallback answering — same numbers the dashboard shows. */
export function fallbackAnswer(question: string, deps: AssistantDeps): string {
  const q = question.toLowerCase();
  const all = Object.values(deps.disasters);
  const stats = computeDashboardStats(deps);

  // Conversational "Pelajari Bencana" flow (location not yet known): answer from app guides only.
  if (/mempelajari bencana/.test(q)) {
    const category = /banjir/.test(q) ? 'flood' : /gempa/.test(q) ? 'earthquake' : /kebakaran/.test(q) ? 'fire' : null;
    const reference = all.find((d) => d.category === category);
    if (!reference) return translate('Bencana apa dan di kota/kabupaten mana yang ingin Anda pelajari?');
    return translate('Sebagai gambaran dari panduan yang tersedia di aplikasi: {cause}\n\n{hazards}\n\nDi kota/kabupaten mana bencana yang Anda maksud? Apakah Anda ingin membahas risiko atau perlindungan diri?', { cause: reference.guide.cause, hazards: reference.guide.hazards });
  }

  // Unknown / untracked: fatalities are not in the dataset. Never invent.
  if (/meninggal|tewas|korban jiwa|mati\b|fatalitas|death/.test(q)) {
    return translate('Data DisasterWatch yang tersedia saat ini belum mencatat angka korban meninggal secara terverifikasi.');
  }

  // Summary of current conditions.
  if (/ringkas|ringkasan|kondisi (saat ini|sekarang|terkini)|situasi|overview|kesimpulan/.test(q)) {
    const snap = buildAssistantSnapshot(deps);
    const lines = [
      translate('Kondisi Saat Ini (menurut data DisasterWatch saat ini):'),
      translate('• {count} insiden aktif', { count: stats.activeDisasters }),
      translate('• {count} orang terdampak', { count: fmt(stats.affectedPeople) }),
      translate('• {count} laporan belum terverifikasi', { count: stats.unverifiedReports }),
      translate('• Gap bantuan terbesar: {need}', { need: snap.intelligence.largestUnmetNeed }),
      translate('• Prioritas tertinggi: {name}', { name: snap.intelligence.highestPriorityDisaster }),
    ];
    return lines.join('\n');
  }

  // Disaster count / active list.
  if (/(ada )?berapa (bencana|insiden|kejadian)|jumlah (bencana|insiden)|bencana apa (saja|aja).*aktif|list.*bencana|daftar.*bencana|insiden aktif/.test(q)) {
    return translate('Saat ini ada {count} insiden bencana aktif di DisasterWatch: {names}.', { count: stats.activeDisasters, names: all.map((d) => d.name).join('; ') });
  }

  // Affected population.
  if (/terdampak|terkena dampak|berapa orang|jumlah (korban|pengungsi|jiwa)|populasi/.test(q)) {
    return translate('Menurut data DisasterWatch saat ini, {count} orang terdampak.', { count: fmt(stats.affectedPeople) });
  }

  // Verification backlog — exact same aggregation as the dashboard badge.
  if (/belum.*verifikasi|unverified|antri|verifikasi|perlu verifikasi|menunggu verifikasi/.test(q)) {
    const unv = deps.reports.filter(
      (r) => r.verificationStatus === 'UNVERIFIED' || r.verificationStatus === 'AI_REVIEWED',
    );
    const conf = deps.reports.filter((r) => r.verificationStatus === 'CONFLICTING');
    const detail = unv.slice(0, 3).map((r) => `${r.location.name} (${r.verificationStatus})`).join('; ');
    const confStr = conf.length > 0 ? ' ' + translate('Selain itu ada {count} laporan CONFLICTING yang perlu rekonsiliasi.', { count: conf.length }) : '';
    return translate('Ya. Saat ini ada {count} laporan yang masih menunggu verifikasi (dari {total} laporan intelijen).{detail}{conf}', { count: unv.length, total: deps.reports.length, detail: detail ? ` ${detail}.` : '', conf: confStr });
  }

  // Water gap — deterministic per-category math.
  if (/air( bersih)?|clean water/.test(q) && /gap|kurang|butuh|kebutuhan|berapa|terbesar|mana/.test(q)) {
    const rows: Array<{ d: DisasterIncident; estimated: number; received: number; gap: number; gapPct: number; unit: string }> = [];
    for (const d of all) {
      const mine = deps.reports.filter((r) => !r.disasterId || r.disasterId === d.id);
      const mineAid = deps.aid.filter((a) => a.disasterId === d.id);
      const w = summarizeGaps(d.id, mine, mineAid).find((g) => g.category === 'clean_water');
      if (w) rows.push({ d, estimated: w.estimated, received: w.received, gap: w.gap, gapPct: w.gapPct, unit: w.unit });
    }
    if (rows.length === 0) return translate('Data DisasterWatch saat ini belum memuat estimasi kebutuhan air bersih.');
    rows.sort((a, b) => b.gap - a.gap);
    const top = rows[0];
    if (/terbesar|mana|paling/.test(q)) {
      return translate('Gap air bersih terbesar saat ini di {name}: kebutuhan {estimated} {unit}, bantuan diterima {received} {unit}, masih kurang {gap} {unit} (coverage {coverage}%).', { name: top.d.name, estimated: fmt(top.estimated), unit: top.unit, received: fmt(top.received), gap: fmt(top.gap), coverage: fmt(Math.round((100 - top.gapPct) * 10) / 10) });
    }
    if (rows.length === 1) {
      return translate('Kebutuhan air tercatat {estimated} {unit}, sementara bantuan yang sudah diterima {received} {unit}. Jadi masih ada gap {gap} {unit}, dengan coverage sekitar {coverage}%.', { estimated: fmt(top.estimated), unit: top.unit, received: fmt(top.received), gap: fmt(top.gap), coverage: fmt(Math.round((100 - top.gapPct) * 10) / 10) });
    }
    return translate('Gap air bersih per wilayah — {list}.', { list: rows.map((r) => translate('{name}: kurang {gap} {unit}', { name: r.d.name, gap: fmt(r.gap), unit: r.unit })).join('; ') });
  }

  // Total aid received.
  if (/total bantuan|sudah diterima|diterima|disalurkan|bantuan masuk/.test(q)) {
    const byCat = new Map<string, number>();
    for (const a of deps.aid) byCat.set(a.needCategory, (byCat.get(a.needCategory) ?? 0) + (a.quantity || 0));
    const parts = [...byCat.entries()].map(([c, n]) => `${translate(needLabel(c))} ${fmt(n)}`);
    return translate('Menurut data DisasterWatch saat ini, total {count} catatan bantuan sudah diterima{detail}', { count: deps.aid.length, detail: parts.length > 0 ? `: ${parts.join('; ')}` : '.' });
  }

  // Total aid gap.
  if (/gap bantuan|total gap|kekurangan|masih kurang/.test(q)) {
    return translate('Menurut data DisasterWatch saat ini, total gap bantuan yang belum terpenuhi adalah {amount}.', { amount: fmt(stats.totalAidGap) });
  }

  if (/gap.*terbesar|paling.*kurang|kritis|air bersih/.test(q)) {
    const ranked = all
      .map((d) => {
        const mine = deps.reports.filter((r) => !r.disasterId || r.disasterId === d.id);
        const mineAid = deps.aid.filter((a) => a.disasterId === d.id);
        return { d, gaps: summarizeGaps(d.id, mine, mineAid) };
      })
      .map(({ d, gaps }) => ({ d, total: gaps.reduce((s, g) => s + g.gap, 0), gaps }))
      .sort((a, b) => b.total - a.total);
    const top = ranked[0];
    if (!top || top.gaps.length === 0) return translate('Belum ada data aid gap terstruktur. Estimasi kebutuhan muncul setelah laporan dianalisis AI.');
    return translate('Aid gap terbesar: {name} — {list}. (PERHITUNGAN DETERMINISTIK)', { name: top.d.name, list: top.gaps.map((g) => translate('{need} kurang {gap}{unit} ({pct}%)', { need: translate(needLabel(g.category)), gap: fmt(g.gap), unit: g.unit ? ' ' + g.unit : '', pct: fmt(g.gapPct) })).join(', ') });
  }

  // Priority / most in need.
  if (/urgent|kenapa.*urgent|prioritas|paling membutuhkan|paling parah|paling kritis|mana yang|wilayah mana|daerah mana/.test(q)) {
    return translate('{name} saat ini menjadi prioritas tertinggi dengan skor {score}. Fokus utama adalah kebutuhan bantuan yang masih memiliki gap.', { name: stats.topPriorityName, score: stats.topPriorityScore });
  }

  if (/kebutuhan|butuh/.test(q)) {
    const hit = all.find((d) => q.includes(d.name.split(',')[0].toLowerCase()) || q.includes(d.id));
    const target = hit ?? all[0];
    if (!target) return translate('Belum ada data bencana.');
    const mine = deps.reports.filter((r) => !r.disasterId || r.disasterId === target.id);
    const mineAid = deps.aid.filter((a) => a.disasterId === target.id);
    const gaps = summarizeGaps(target.id, mine, mineAid);
    if (gaps.length === 0) return translate('Kebutuhan {name}: {list} (data posko).', { name: target.name, list: target.supplies.map((s) => s.name).join(', ') });
    return translate('Kebutuhan {name}: {list}.', { name: target.name, list: gaps.map((g) => translate('{need} — butuh {estimated}, terima {received}, kurang {gap}', { need: translate(needLabel(g.category)), estimated: fmt(g.estimated), received: fmt(g.received), gap: fmt(g.gap) })).join('; ') });
  }

  if (/lapor/.test(q)) {
    return translate('Total {count} laporan intelijen tersimpan. {list}.', { count: deps.reports.length, list: all.map((d) => translate('{name}: {count} laporan warga', { name: d.name, count: d.reports.length })).join('; ') });
  }

  // General disaster-response guidance (no Firestore needed) — clearly labelled.
  if (/apa yang harus|bagaimana (cara|seharusnya)|tips|panduan umum|mitigasi|apa itu|jelaskan tentang|pertolongan pertama|evakuasi mandiri/.test(q)) {
    return translate('Secara umum (panduan umum, bukan data DisasterWatch saat ini): ikuti arahan posko/BNPB setempat — amankan diri dan keluarga dulu, siapkan dokumen penting dan tas siaga, matikan listrik/gas bila terancam, dan hindari area berbahaya. Untuk kondisi spesifik wilayah Anda, tanyakan misalnya "wilayah mana yang paling prioritas?" berdasarkan data DisasterWatch saat ini.');
  }

  return translate('Saya menjawab dari DATA APLIKASI: {count} insiden aktif ({names}). Tanya misalnya: "daerah mana yang paling membutuhkan air bersih?", "berapa bantuan yang masih kurang?", atau "berapa laporan belum diverifikasi?"', { count: all.length, names: all.map((d) => d.name).join('; ') });
}

export async function askAssistant(
  question: string,
  deps: AssistantDeps,
): Promise<{ answer: string; engine: 'gemini' | 'deterministic' }> {
  // Fresh snapshot per question — props already mirror Firestore-synced app state.
  const snapshot = buildAssistantSnapshot(deps);
  const context = renderAssistantContextText(snapshot);
  try {
    const model = await getGeminiModel();
    if (model) {
      const prompt = `${ASSISTANT_SYSTEM}\n\nCURRENT DISASTERWATCH DATA\n${context}\n\nPertanyaan pengguna:\n${question.slice(0, 1000)}\n\nJawab ringkas dalam Bahasa Indonesia. Untuk angka/fakta gunakan HANYA nilai dari CURRENT DISASTERWATCH DATA di atas; jika tidak ada, katakan data belum tersedia. Bedakan data DisasterWatch saat ini vs panduan umum.`;
      const out = await model.generateContent(prompt);
      if (out && out.trim().length > 10) return { answer: out.trim().slice(0, 2000), engine: 'gemini' };
    }
  } catch {
    // fallback below
  }
  return { answer: fallbackAnswer(question, deps), engine: 'deterministic' };
}
