// AI assistant: grounded answering over app data. Gemini when available, deterministic fallback otherwise.
import type { DisasterIncident } from '../../types';
import type { AidRecord, IntelligenceReport } from '../../domain/intelligence';
import { needLabel } from '../../domain/intelligence';
import { getGeminiModel } from '../../lib/firebase/ai';
import { ASSISTANT_SYSTEM } from './prompts';
import { summarizeGaps } from '../intelligence/aidGapEngine';

export interface AssistantDeps {
  disasters: Record<string, DisasterIncident>;
  reports: IntelligenceReport[];
  aid: AidRecord[];
}

/** Build a compact, factual context block. Prototype-scale: whole-state snapshot, truncated. */
export function buildDisasterContext(deps: AssistantDeps, maxChars = 6000): string {
  const lines: string[] = ['DATA APLIKASI DISASTERWATCH (fakta, jangan dikarang):'];
  for (const d of Object.values(deps.disasters)) {
    const mine = deps.reports.filter((r) => !r.disasterId || r.disasterId === d.id);
    const mineAid = deps.aid.filter((a) => a.disasterId === d.id);
    const gaps = summarizeGaps(d.id, mine, mineAid);
    const gapStr = gaps.length > 0
      ? gaps.map((g) => `${needLabel(g.category)}: butuh ${g.estimated}${g.unit ? ' ' + g.unit : ''}, terima ${g.received}, kurang ${g.gap} (${g.gapPct}%)`).join('; ')
      : 'belum ada estimasi kebutuhan terstruktur';
    lines.push(
      `- [${d.id}] ${d.name}, ${d.province} | ${d.fullTitleDisplay} | urgensi ${d.urgency} | dampak ${d.impact} | biaya ${d.cost} | gap pemulihan ${d.gapRecovery} | laporan warga ${d.reports.length} | AID GAP => ${gapStr}`,
    );
    lines.push(`Panduan ${d.id}: penyebab ${d.guide.cause}; bahaya ${d.guide.hazards}; perlindungan ${d.guide.protocols.join('; ')}; evakuasi ${d.guide.evacRoute}`);
  }
  if (deps.reports.length > 0) {
    lines.push('LAPORAN INTELIJEN TERBARU:');
    deps.reports.slice(0, 8).forEach((r) => {
      lines.push(
        `- ${r.id} @${r.location.name} [${r.verificationStatus}, AI ${(Math.round((r.aiConfidence ?? 0) * 100))}%]: ${r.rawText.slice(0, 160)}`,
      );
    });
  }
  const joined = lines.join('\n');
  return joined.length > maxChars ? joined.slice(0, maxChars) + '\n...(dipotong)' : joined;
}

/** Deterministic fallback answering for the demo-critical questions. */
export function fallbackAnswer(question: string, deps: AssistantDeps): string {
  const q = question.toLowerCase();
  const all = Object.values(deps.disasters);

  if (/mempelajari bencana/.test(q)) {
    const category = /banjir/.test(q) ? 'flood' : /gempa/.test(q) ? 'earthquake' : /kebakaran/.test(q) ? 'fire' : null;
    const reference = all.find(d => d.category === category);
    if (!reference) return 'Bencana apa dan di kota/kabupaten mana yang ingin Anda pelajari?';
    return `Sebagai gambaran dari panduan yang tersedia di aplikasi: ${reference.guide.cause}\n\n${reference.guide.hazards}\n\nDi kota/kabupaten mana bencana yang Anda maksud? Apakah Anda ingin membahas risiko atau perlindungan diri?`;
  }
  if (/belum.*verifikasi|unverified|antri/.test(q)) {
    const unv = deps.reports.filter((r) => r.verificationStatus === 'UNVERIFIED' || r.verificationStatus === 'AI_REVIEWED');
    return `Ada ${unv.length} laporan menunggu verifikasi (dari ${deps.reports.length} laporan intelijen). ${unv.slice(0, 3).map((r) => `${r.location.name} (${r.verificationStatus})`).join('; ') || ''}`;
  }
  if (/gap.*terbesar|paling.*kurang|kritis|butuh|air bersih/.test(q)) {
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
    return `Aid gap terbesar: ${top.d.name} — ${top.gaps.map((g) => `${needLabel(g.category)} kurang ${g.gap}${g.unit ? ' ' + g.unit : ''} (${g.gapPct}%)`).join(', ')}. (PERHITUNGAN DETERMINISTIK)`;
  }
  if (/kebutuhan|butuh/.test(q)) {
    const hit = all.find((d) => q.includes(d.name.split(',')[0].toLowerCase()) || q.includes(d.id));
    const target = hit ?? all[0];
    if (!target) return 'Belum ada data bencana.';
    const mine = deps.reports.filter((r) => !r.disasterId || r.disasterId === target.id);
    const mineAid = deps.aid.filter((a) => a.disasterId === target.id);
    const gaps = summarizeGaps(target.id, mine, mineAid);
    if (gaps.length === 0) return `Kebutuhan ${target.name}: ${target.supplies.map((s) => s.name).join(', ')} (data posko).`;
    return `Kebutuhan ${target.name}: ${gaps.map((g) => `${needLabel(g.category)} — butuh ${g.estimated}, terima ${g.received}, kurang ${g.gap}`).join('; ')}.`;
  }
  if (/urgent|kenapa.*urgent|prioritas/.test(q)) {
    const crit = all.filter((d) => /darurat|tinggi/i.test(d.urgency));
    return `Lokasi urgent: ${crit.map((d) => `${d.name} (${d.urgency}, ${d.impact})`).join('; ') || 'tidak ada yang berstatus darurat'}. Penilaian memakai status posko + aid gap, bukan klaim AI semata.`;
  }
  if (/lapor/.test(q)) {
    return `Total ${deps.reports.length} laporan intelijen tersimpan. ${all.map((d) => `${d.name}: ${d.reports.length} laporan warga`).join('; ')}.`;
  }
  return `Saya menjawab dari DATA APLIKASI: ${all.length} insiden aktif (${all.map((d) => d.name).join('; ')}). Tanya misalnya: "daerah mana yang paling membutuhkan air bersih?", "berapa bantuan yang masih kurang?", atau "berapa laporan belum diverifikasi?"`;
}

export async function askAssistant(question: string, deps: AssistantDeps): Promise<{ answer: string; engine: 'gemini' | 'deterministic' }> {
  const context = buildDisasterContext(deps);
  try {
    const model = await getGeminiModel();
    if (model) {
      const prompt = `${ASSISTANT_SYSTEM}\n\n${context}\n\nPertanyaan pengguna:\n${question.slice(0, 1000)}\n\nJawab ringkas dalam Bahasa Indonesia, sebutkan angka persis dari konteks, dan bedakan DATA vs ANALISIS AI vs PERHITUNGAN.`;
      const out = await model.generateContent(prompt);
      if (out && out.trim().length > 10) return { answer: out.trim().slice(0, 2000), engine: 'gemini' };
    }
  } catch {
    // fallback below
  }
  return { answer: fallbackAnswer(question, deps), engine: 'deterministic' };
}
