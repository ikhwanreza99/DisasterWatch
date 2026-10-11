// NTT case assistant — grounded in persisted case data.
// Reuses existing Gemini client (getGeminiModel). No second client, no hardcoded keys.
// Compact structured context; never sends the whole database blindly.
import { getGeminiModel } from '../../lib/firebase/ai';
import type { NttCaseState } from '../nttCaseStore';
import { countNtt } from '../nttCaseStore';

export function isNttQuestion(q: string): boolean {
  return /sumba|ntt|kodi|sbd|barat daya|waikabubak|tambolaka|perokonda|bima/i.test(q);
}

export function buildNttContext(state: NttCaseState, maxChars = 4000): string {
  const c = countNtt(state);
  const L: string[] = [
    'KASUS NTT — Gempa Sumba Barat Daya 4 Okt 2026 (data retrieval nyata, bukan demo):',
    `ID: ${state.kase.caseId}`,
    'FAKTA RESMI (BMKG, terverifikasi):',
  ];
  for (const r of state.kase.revisions) {
    L.push(
      `- [${r.revision}] ${r.sourceLabel}: M${r.magnitude}, ${r.depthKm} km, ${r.latitude} LS ${r.longitude} BT — ${r.locationText}; ${r.tsunamiAssessment}. Sumber: ${r.sourceUrl}`,
    );
  }
  L.push(`KLASIFIKASI: insiden gempa (bukan bencana kemanusiaan besar). ${state.kase.classificationNote}`);
  L.push(
    `CRAWL: ${c.articles} artikel (${c.official} resmi), ${c.claims} klaim (${c.awaiting} menunggu verifikasi, ${c.conflicting} konflik). Crawl terakhir: ${c.lastCrawlAt ?? 'belum ada'}.`,
  );
  L.push('ARTIKEL (judul + link aktual):');
  for (const a of state.articles.slice(0, 12)) {
    L.push(
      `- [${a.sourceType}/${a.verificationStatus}/${a.contentStatus}] ${a.sourceName}: "${a.title}" ${a.publishedAt ? `(terbit ${a.publishedAt})` : '(waktu terbit tidak tersedia)'} — ${a.url}`,
    );
  }
  L.push('KLAIM (dengan sumber, konflik dipertahankan):');
  for (const cl of state.claims.slice(0, 14)) {
    L.push(`- [${cl.claimType}/${cl.verificationStatus}] ${cl.claimText} (sumber: ${cl.sourceUrl})`);
  }
  L.push(
    'ATURAN: korban/kerusakan yang tidak ada di atas = "Belum tersedia", jangan disimpulkan dari magnitudo. Klaim media = klaim media, bukan fakta resmi. Konflik angka (20 vs 26 vs 56) dideskripsikan per sumber, jangan dijumlah.',
  );
  const joined = L.join('\n');
  return joined.length > maxChars ? joined.slice(0, maxChars) + '\n...(dipotong)' : joined;
}

/** Deterministic fallback — same numbers the dashboard shows. */
export function nttFallbackAnswer(question: string, state: NttCaseState): string {
  const q = question.toLowerCase();
  const c = countNtt(state);
  const bmkg = state.kase.sourceUrl;
  if (/apa yang terjadi|ringkas|apa.*sumba|kondisi/.test(q)) {
    return [
      'Yang terjadi di Sumba Barat Daya (data kasus NTT):',
      '• FAKTA RESMI (BMKG): gempa 4 Okt 2026 05:55:52 WIB. Parameter awal M6,1/10 km (9,70 LS–118,92 BT); update M5,9/30 km (9,84 LS–118,90 BT, ±59 km barat daya Kodi). Tidak berpotensi tsunami.',
      `• MEDIA: ${c.articles} artikel terkumpul (${c.official} resmi). Klaim kerusakan BERBEDA antar sumber: BNPB 20 rumah + 1 luka ringan; Bupati via detik 56 rumah + 13 fasum; TVRI 26 bangunan — konflik belum terselesaikan, jangan dijumlah.`,
      `• Bukti resmi: ${bmkg}`,
    ].join('\n');
  }
  if (/resmi.*bmkg|parameter|magnitudo|kedalaman|koordinat|tsunami/.test(q)) {
    return [
      'Informasi resmi BMKG (terverifikasi, kedua revisi dipertahankan):',
      '• Awal (rilis 05:58:34 WIB): M6,1, 10 km, 9,70 LS–118,92 BT — 30 km barat daya SBD. Tidak berpotensi tsunami.',
      '• Update (siaran pers): M5,9, 30 km, 9,84 LS–118,90 BT — 59 km barat daya Kodi (di laut). Mekanisme normal fault, Sesar Waikabubak. TIDAK BERPOTENSI TSUNAMI.',
      `• Sumber: ${bmkg}`,
    ].join('\n');
  }
  if (/berapa.*berita|berapa.*artikel|berita.*kumpul/.test(q)) {
    return `Terkumpul ${c.articles} artikel (${c.official} dari sumber resmi: BMKG ×3, BNPB ×1) dan ${c.claims} klaim (${c.awaiting} menunggu verifikasi, ${c.conflicting} konflik). Crawl terakhir: ${c.lastCrawlAt ?? 'belum ada'}.`;
  }
  if (/rusak|rumah|bangunan|dampak|kerusakan/.test(q)) {
    return [
      'Laporan kerusakan (klaim media, konflik dipertahankan — bukan fakta tunggal):',
      '• BNPB (pendataan sementara): 20 rumah (19 ringan, 1 sedang).',
      '• Bupati SBD via detik: 56 rumah + 13 fasum (rincian 50+6+1=57 inkonsisten internal).',
      '• TVRI: 26 bangunan.',
      'Tidak ada angka pengungsi resmi. BMKG menyebut kerusakan bangunan warga + sekolah di Desa Perokonda tanpa angka.',
    ].join('\n');
  }
  if (/korban|luka|meninggal|tewas|jiwa/.test(q)) {
    return 'Data korban: 1 orang luka ringan (BNPB, tertimpa reruntuhan, rawat jalan). Tidak ada laporan korban meninggal terverifikasi — statusnya "Belum tersedia", bukan nol.';
  }
  if (/belum.*verifikasi|klaim.*belum|unverif/.test(q)) {
    const un = state.claims.filter((x) => x.verificationStatus === 'UNVERIFIED' || x.verificationStatus === 'AI_REVIEWED');
    return `Ada ${un.length} klaim menunggu verifikasi: ${un.slice(0, 4).map((x) => x.claimText.slice(0, 80)).join(' | ')}.`;
  }
  if (/beda|konflik|perbedaan|selisih/.test(q)) {
    return 'Perbedaan antar sumber: kerusakan 20 (BNPB) vs 26 (TVRI) vs 56+13 (Bupati via detik). Masing-masing dipertahankan dengan atribusi sumbernya; bukan dijumlah, bukan saling menguatkan otomatis.';
  }
  if (/terbaru|perkembangan|susulan|aftershock/.test(q)) {
    return 'Perkembangan resmi terakhir: 62 gempa susulan M1,5–M4,3 hingga 08:05 WIB (BMKG); 1 luka ringan + pendataan kerusakan berjalan (BNPB). Tidak ada evakuasi/pengungsi resmi yang tercatat.';
  }
  if (/sumber.*mana|sumber.*menyebut|link|referensi/.test(q)) {
    return `Sumber per klaim: ${state.claims.slice(0, 5).map((x) => `${x.claimType} ← ${x.sourceUrl}`).join('; ')}. Semua link membuka sumber aslinya.`;
  }
  return [
    `Kasus NTT: gempa 4 Okt 2026 (M6,1 → update M5,9), tidak berpotensi tsunami. ${c.articles} artikel, ${c.claims} klaim.`,
    'Tanya misalnya: "Apa informasi resmi BMKG?", "Apakah ada laporan kerusakan?", "Apakah ada perbedaan antarberita?"',
  ].join('\n');
}

export async function askNttAssistant(
  question: string,
  state: NttCaseState,
): Promise<{ answer: string; engine: 'gemini' | 'deterministic' }> {
  const context = buildNttContext(state);
  try {
    const model = await getGeminiModel();
    if (model) {
      const prompt = `Anda DisasterAI untuk kasus gempa Sumba Barat Daya 4 Okt 2026. Jawab HANYA dari KONTEKS KASUS di bawah, Bahasa Indonesia ringkas. Setiap angka/fakta harus berlink ke sumber aktual dari konteks. Jika tidak ada di konteks, katakan "Belum tersedia" — jangan simpulkan dari magnitudo. Pisahkan: 1) Fakta resmi, 2) Klaim media, 3) Belum terverifikasi, 4) Panduan umum (hanya jika diminta).\n\nKONTEKS KASUS\n${context}\n\nPertanyaan:\n${question.slice(0, 800)}`;
      const out = await model.generateContent(prompt);
      if (out && out.trim().length > 10) return { answer: out.trim().slice(0, 2000), engine: 'gemini' };
    }
  } catch {
    /* fallback below */
  }
  return { answer: nttFallbackAnswer(question, state), engine: 'deterministic' };
}
