// Report → structured extraction. Gemini via Firebase AI Logic, heuristic fallback.
import type { AIExtraction } from '../../domain/intelligence';
import { getGeminiModel } from '../../lib/firebase/ai';
import { buildExtractionPrompt } from './prompts';
import { safeParseJson, validateExtraction } from './schemas';
import { translate } from '../../i18n';

export interface ExtractionResult {
  extraction: AIExtraction;
  engine: 'gemini' | 'heuristic';
  note: string;
}

const NEED_KEYWORDS: Array<[RegExp, string, string]> = [
  [/\bair\s*(?:bersih|minum)\b/i, 'clean_water', 'liter|litre|l'],
  [/makanan|makan|sembako|beras|logistik/i, 'food', 'kg|kilogram|paket|porsi|karung|ton'],
  [/obat|medis|ispa/i, 'medicine', 'kotak|paket|tablet|botol|strip'],
  [/masker|respirator/i, 'mask', 'buah|lembar|kotak|box|unit'],
  [/tenda|pengungs|selimut/i, 'shelter', 'tenda|unit|buah|lembar'],
  [/pakaian|baju/i, 'clothing', 'paket|potong|stel|buah'],
  [/perahu|kano|boat/i, 'boat', 'unit|buah|perahu'],
  [/genset/i, 'genset', 'unit|buah'],
];
const NUMBER = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:[.,]\\d+)?';
function reportedNumber(value: string): number {
  return Number((/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(value) ? value.replaceAll('.', '') : value).replace(',', '.'));
}

/** Only explicit amounts with a compatible unit are quantities; household counts are not supply quantities. */
function explicitNeeds(text: string): AIExtraction['needs'] {
  return NEED_KEYWORDS.flatMap(([keyword, category, units]) => {
    const hit = keyword.exec(text);
    if (!hit) return [];
    const before = text.slice(Math.max(0, hit.index - 40), hit.index);
    const after = text.slice(hit.index + hit[0].length, hit.index + hit[0].length + 40);
    const following = after.match(new RegExp(`^\\s*(?:sebanyak|sejumlah|:)?\\s*(${NUMBER})\\s*(${units})\\b`, 'i'));
    const preceding = before.match(new RegExp(`(${NUMBER})\\s*(${units})\\s*$`, 'i'));
    const amount = following ?? preceding;
    return [{ category, quantity: amount ? reportedNumber(amount[1]) : null, unit: amount ? amount[2].toLowerCase() : null }];
  });
}

const DAMAGE_KEYWORDS: Array<[RegExp, string]> = [
  [/jembatan[^.\n]*(?:putus|rusak|tidak bisa dilewati|roboh)/i, 'jembatan tidak bisa dilewati'],
  [/jalan.*(putus|tutup|tidak bisa|terendam)|akses.*terputus/i, 'akses jalan terputus'],
  [/tanggul[^.\n]*jebol/i, 'tanggul jebol'],
  [/rumah.*(terendam|masuk|rusak)|air masuk/i, 'rumah terdampak genangan'],
  [/listrik.*(padam|mati)/i, 'listrik padam'],
  [/longsor/i, 'longsor'],
  [/\bapi\b|kebakaran|\basap\b/i, 'titik api / asap'],
];

export function heuristicExtract(rawText: string, locationHint?: string, categoryHint?: string): AIExtraction {
  // Original notes are retained for review, but cannot override the confirmed form.
  const text = rawText.split('KETERANGAN AWAL (referensi saja;')[0];
  const t = text.toLowerCase();
  const categoryText = categoryHint?.trim().toLowerCase() || t;
  const disasterType = /\bapi\b|kebakar|\basap\b|gambut|karhutla/.test(categoryText)
    ? 'fire'
    : /gempa|sesar|magnitudo|retak/.test(categoryText)
      ? 'earthquake'
      : /longsor/.test(categoryText)
        ? 'landslide'
        : /banjir|genangan|terendam/.test(categoryText) ? 'flood' : 'other';
  const hh = t.match(new RegExp(`(${NUMBER})\\s*(?:kk|keluarga)\\b`));
  const jiwa = t.match(new RegExp(`(${NUMBER})\\s*(?:jiwa|orang|warga)\\b`));
  const households = hh ? reportedNumber(hh[1]) : null;
  const population = jiwa ? reportedNumber(jiwa[1]) : null;
  const needs = explicitNeeds(text);
  const infra = DAMAGE_KEYWORDS.filter(([re]) => re.test(text)).map(([, s]) => s);
  const urgency = /tidak bisa dilewati|terisolir|korban|darurat|air masuk|jebol/.test(t) ? 'high' : /butuh|mendesak|rusak/.test(t) ? 'medium' : 'low';
  // Dedupe needs by category
  const seen = new Set<string>();
  const deduped = needs.filter((n) => (seen.has(n.category) ? false : (seen.add(n.category), true)));
  return {
    disasterType,
    locationName: locationHint?.slice(0, 160) || 'Lokasi pelapor',
    affectedHouseholds: households,
    affectedPopulation: population,
    infrastructureDamage: [...new Set(infra)],
    needs: deduped,
    urgency: urgency as AIExtraction['urgency'],
    confidence: 0.62,
  };
}

export async function extractDisasterInfo(
  rawText: string,
  opts?: { locationHint?: string; categoryHint?: string },
): Promise<ExtractionResult> {
  const text = rawText.trim();
  if (!text) {
    return {
      extraction: {
        disasterType: 'other', locationName: opts?.locationHint ?? '-', affectedHouseholds: null,
        affectedPopulation: null, infrastructureDamage: [], needs: [], urgency: 'low', confidence: 0.2,
      },
      engine: 'heuristic',
      note: translate('Teks kosong — ekstraksi minimal.'),
    };
  }
  try {
    const model = await getGeminiModel();
    if (model) {
      const prompt = buildExtractionPrompt(text, opts?.locationHint, opts?.categoryHint);
      const out = await model.generateContent(prompt);
      const parsed = validateExtraction(safeParseJson(out));
      if (parsed) return { extraction: parsed, engine: 'gemini', note: translate('Diekstrak oleh Gemini via Firebase AI Logic.') };
    }
  } catch {
    // fall through to heuristic
  }
  return {
    extraction: heuristicExtract(text, opts?.locationHint, opts?.categoryHint),
    engine: 'heuristic',
    note: translate('Gemini tidak tersedia — memakai ekstraksi heuristik lokal (jelas berlabel).'),
  };
}
