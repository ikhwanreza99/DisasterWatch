// AI assistant: grounded answering over app data. Gemini when available, deterministic fallback otherwise.
//
// Architecture: USER QUESTION → current app state → buildAssistantSnapshot (deterministic,
// same engines as the dashboard) → Gemini verbalises → grounded answer.
// Gemini never invents numbers; the snapshot is the single source of truth.
import type { DisasterIncident } from '../../types';
import type { AidRecord, IntelligenceReport } from '../../domain/intelligence';
import { needLabel } from '../../domain/intelligence';
import { getGeminiModel } from '../../lib/firebase/ai';
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
  return n.toLocaleString('id-ID');
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
    if (!reference) return 'Bencana apa dan di kota/kabupaten mana yang ingin Anda pelajari?';
    return `Sebagai gambaran dari panduan yang tersedia di aplikasi: ${reference.guide.cause}\n\n${reference.guide.hazards}\n\nDi kota/kabupaten mana bencana yang Anda maksud? Apakah Anda ingin membahas risiko atau perlindungan diri?`;
  }

  // Unknown / untracked: fatalities are not in the dataset. Never invent.
  if (/meninggal|tewas|korban jiwa|mati\b|fatalitas|death/.test(q)) {
    return 'Data DisasterWatch yang tersedia saat ini belum mencatat angka korban meninggal secara terverifikasi.';
  }

  // Summary of current conditions.
  if (/ringkas|ringkasan|kondisi (saat ini|sekarang|terkini)|situasi|overview|kesimpulan/.test(q)) {
    const snap = buildAssistantSnapshot(deps);
    const lines = [
      'Kondisi Saat Ini (menurut data DisasterWatch saat ini):',
      `• ${stats.activeDisasters} insiden aktif`,
      `• ${fmt(stats.affectedPeople)} orang terdampak`,
      `• ${stats.unverifiedReports} laporan belum terverifikasi`,
      `• Gap bantuan terbesar: ${snap.intelligence.largestUnmetNeed}`,
      `• Prioritas tertinggi: ${snap.intelligence.highestPriorityDisaster}`,
    ];
    return lines.join('\n');
  }

  // Disaster count / active list.
  if (/(ada )?berapa (bencana|insiden|kejadian)|jumlah (bencana|insiden)|bencana apa (saja|aja).*aktif|list.*bencana|daftar.*bencana|insiden aktif/.test(q)) {
    return `Saat ini ada ${stats.activeDisasters} insiden bencana aktif di DisasterWatch: ${all.map((d) => d.name).join('; ')}.`;
  }

  // Affected population.
  if (/terdampak|terkena dampak|berapa orang|jumlah (korban|pengungsi|jiwa)|populasi/.test(q)) {
    return `Menurut data DisasterWatch saat ini, ${fmt(stats.affectedPeople)} orang terdampak.`;
  }

  // Verification backlog — exact same aggregation as the dashboard badge.
  if (/belum.*verifikasi|unverified|antri|verifikasi|perlu verifikasi|menunggu verifikasi/.test(q)) {
    const unv = deps.reports.filter(
      (r) => r.verificationStatus === 'UNVERIFIED' || r.verificationStatus === 'AI_REVIEWED',
    );
    const conf = deps.reports.filter((r) => r.verificationStatus === 'CONFLICTING');
    const detail = unv.slice(0, 3).map((r) => `${r.location.name} (${r.verificationStatus})`).join('; ');
    const confStr = conf.length > 0 ? ` Selain itu ada ${conf.length} laporan CONFLICTING yang perlu rekonsiliasi.` : '';
    return `Ya. Saat ini ada ${unv.length} laporan yang masih menunggu verifikasi (dari ${deps.reports.length} laporan intelijen).${detail ? ` ${detail}.` : ''}${confStr}`;
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
    if (rows.length === 0) return 'Data DisasterWatch saat ini belum memuat estimasi kebutuhan air bersih.';
    rows.sort((a, b) => b.gap - a.gap);
    const top = rows[0];
    if (/terbesar|mana|paling/.test(q)) {
      return `Gap air bersih terbesar saat ini di ${top.d.name}: kebutuhan ${fmt(top.estimated)} ${top.unit}, bantuan diterima ${fmt(top.received)} ${top.unit}, masih kurang ${fmt(top.gap)} ${top.unit} (coverage ${fmt(Math.round((100 - top.gapPct) * 10) / 10)}%).`;
    }
    if (rows.length === 1) {
      return `Kebutuhan air tercatat ${fmt(top.estimated)} ${top.unit}, sementara bantuan yang sudah diterima ${fmt(top.received)} ${top.unit}. Jadi masih ada gap ${fmt(top.gap)} ${top.unit}, dengan coverage sekitar ${fmt(Math.round((100 - top.gapPct) * 10) / 10)}%.`;
    }
    return `Gap air bersih per wilayah — ${rows.map((r) => `${r.d.name}: kurang ${fmt(r.gap)} ${r.unit}`).join('; ')}.`;
  }

  // Total aid received.
  if (/total bantuan|sudah diterima|diterima|disalurkan|bantuan masuk/.test(q)) {
    const byCat = new Map<string, number>();
    for (const a of deps.aid) byCat.set(a.needCategory, (byCat.get(a.needCategory) ?? 0) + (a.quantity || 0));
    const parts = [...byCat.entries()].map(([c, n]) => `${needLabel(c)} ${fmt(n)}`);
    return `Menurut data DisasterWatch saat ini, total ${deps.aid.length} catatan bantuan sudah diterima${parts.length > 0 ? `: ${parts.join('; ')}` : '.'}`;
  }

  // Total aid gap.
  if (/gap bantuan|total gap|kekurangan|masih kurang/.test(q)) {
    return `Menurut data DisasterWatch saat ini, total gap bantuan yang belum terpenuhi adalah ${fmt(stats.totalAidGap)}.`;
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
    if (!top || top.gaps.length === 0) return 'Belum ada data aid gap terstruktur. Estimasi kebutuhan muncul setelah laporan dianalisis AI.';
    return `Aid gap terbesar: ${top.d.name} — ${top.gaps.map((g) => `${needLabel(g.category)} kurang ${fmt(g.gap)}${g.unit ? ' ' + g.unit : ''} (${fmt(g.gapPct)}%)`).join(', ')}. (PERHITUNGAN DETERMINISTIK)`;
  }

  // Priority / most in need.
  if (/urgent|kenapa.*urgent|prioritas|paling membutuhkan|paling parah|paling kritis|mana yang|wilayah mana|daerah mana/.test(q)) {
    return `${stats.topPriorityName} saat ini menjadi prioritas tertinggi dengan skor ${stats.topPriorityScore}. Fokus utama adalah kebutuhan bantuan yang masih memiliki gap.`;
  }

  if (/kebutuhan|butuh/.test(q)) {
    const hit = all.find((d) => q.includes(d.name.split(',')[0].toLowerCase()) || q.includes(d.id));
    const target = hit ?? all[0];
    if (!target) return 'Belum ada data bencana.';
    const mine = deps.reports.filter((r) => !r.disasterId || r.disasterId === target.id);
    const mineAid = deps.aid.filter((a) => a.disasterId === target.id);
    const gaps = summarizeGaps(target.id, mine, mineAid);
    if (gaps.length === 0) return `Kebutuhan ${target.name}: ${target.supplies.map((s) => s.name).join(', ')} (data posko).`;
    return `Kebutuhan ${target.name}: ${gaps.map((g) => `${needLabel(g.category)} — butuh ${fmt(g.estimated)}, terima ${fmt(g.received)}, kurang ${fmt(g.gap)}`).join('; ')}.`;
  }

  if (/lapor/.test(q)) {
    return `Total ${deps.reports.length} laporan intelijen tersimpan. ${all.map((d) => `${d.name}: ${d.reports.length} laporan warga`).join('; ')}.`;
  }

  // General disaster-response guidance (no Firestore needed) — clearly labelled.
  if (/apa yang harus|bagaimana (cara|seharusnya)|tips|panduan umum|mitigasi|apa itu|jelaskan tentang|pertolongan pertama|evakuasi mandiri/.test(q)) {
    return 'Secara umum (panduan umum, bukan data DisasterWatch saat ini): ikuti arahan posko/BNPB setempat — amankan diri dan keluarga dulu, siapkan dokumen penting dan tas siaga, matikan listrik/gas bila terancam, dan hindari area berbahaya. Untuk kondisi spesifik wilayah Anda, tanyakan misalnya "wilayah mana yang paling prioritas?" berdasarkan data DisasterWatch saat ini.';
  }

  return `Saya menjawab dari DATA APLIKASI: ${all.length} insiden aktif (${all.map((d) => d.name).join('; ')}). Tanya misalnya: "daerah mana yang paling membutuhkan air bersih?", "berapa bantuan yang masih kurang?", atau "berapa laporan belum diverifikasi?"`;
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
