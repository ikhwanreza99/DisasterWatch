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

const NEED_KEYWORDS: Array<[RegExp, string]> = [
  [/air\s*bersih|air\s*minum|air/i, 'clean_water'],
  [/makan|sembako|beras|logistik/i, 'food'],
  [/obat|medis|ispa|masker|respirator/i, 'medicine'],
  [/masker/i, 'mask'],
  [/tenda|pengungs|selimut|pakaian/i, 'shelter'],
  [/perahu|kano|evakuasi|boat/i, 'boat'],
  [/genset|listrik/i, 'genset'],
];

const DAMAGE_KEYWORDS: Array<[RegExp, string]> = [
  [/jembatan/i, 'jembatan tidak bisa dilewati'],
  [/jalan.*(putus|tutup|tidak bisa|terendam)|akses.*terputus/i, 'akses jalan terputus'],
  [/tanggul.*jebol|tanggul/i, 'tanggul jebol'],
  [/rumah.*(terendam|masuk|rusak)|air masuk/i, 'rumah terdampak genangan'],
  [/listrik.*(padam|mati)/i, 'listrik padam'],
  [/longsor/i, 'longsor'],
  [/api|kebakaran|asap/i, 'titik api / asap'],
];

function heuristicExtract(rawText: string, locationHint?: string): AIExtraction {
  const t = rawText.toLowerCase();
  const disasterType = /api|kebakar|asap|gambut|karhutla/.test(t)
    ? 'fire'
    : /gempa|sesar|magnitudo|retak/.test(t)
      ? 'earthquake'
      : /longsor/.test(t)
        ? 'landslide'
        : 'flood';
  const hh = t.match(/(\d+)\s*(kk|keluarga|rumah)/);
  const jiwa = t.match(/(\d+)\s*(jiwa|orang|warga)/);
  const households = hh ? parseInt(hh[1], 10) : null;
  const population = jiwa ? parseInt(jiwa[1], 10) : households ? households * 4 : null;
  const needs = NEED_KEYWORDS.filter(([re]) => re.test(rawText)).map(([, c]) => ({ category: c, quantity: null, unit: null }));
  const infra = DAMAGE_KEYWORDS.filter(([re]) => re.test(rawText)).map(([, s]) => s);
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
    extraction: heuristicExtract(text, opts?.locationHint),
    engine: 'heuristic',
    note: translate('Gemini tidak tersedia — memakai ekstraksi heuristik lokal (jelas berlabel).'),
  };
}
