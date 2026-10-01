// Validated schemas for Gemini structured output. No free-form AI writes to state.
import type { AIExtraction, DisasterType, ExtractedNeed, UrgencyLevel } from '../../domain/intelligence';

const VALID_TYPES: DisasterType[] = ['fire', 'flood', 'earthquake', 'landslide', 'other'];
const VALID_URGENCY: UrgencyLevel[] = ['low', 'medium', 'high', 'critical'];

function clamp01(n: unknown, fallback = 0.5): number {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.min(1, Math.max(0, x));
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').slice(0, 20);
}

function asNeeds(v: unknown): ExtractedNeed[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).map((n) => {
    const o = (n ?? {}) as Record<string, unknown>;
    const category = asString(o['category'], 'other').toLowerCase().replace(/[^a-z_]/g, '_').slice(0, 40) || 'other';
    const q = o['quantity'];
    return {
      category,
      quantity: typeof q === 'number' && Number.isFinite(q) ? q : null,
      unit: typeof o['unit'] === 'string' ? (o['unit'] as string).slice(0, 20) : null,
      note: typeof o['note'] === 'string' ? (o['note'] as string).slice(0, 200) : undefined,
    };
  });
}

/** Validate + normalise raw AI JSON into AIExtraction. Returns null when unrecoverable. */
export function validateExtraction(raw: unknown): AIExtraction | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const disasterType = VALID_TYPES.includes(o['disasterType'] as DisasterType)
    ? (o['disasterType'] as DisasterType)
    : 'other';
  const urgency = VALID_URGENCY.includes(o['urgency'] as UrgencyLevel) ? (o['urgency'] as UrgencyLevel) : 'medium';
  const locationName = asString(o['locationName']).slice(0, 160) || 'Lokasi tidak diketahui';
  const ah = o['affectedHouseholds'];
  const ap = o['affectedPopulation'];
  return {
    disasterType,
    locationName,
    affectedHouseholds: typeof ah === 'number' && Number.isFinite(ah) ? Math.max(0, Math.round(ah)) : null,
    affectedPopulation: typeof ap === 'number' && Number.isFinite(ap) ? Math.max(0, Math.round(ap)) : null,
    infrastructureDamage: asStringArray(o['infrastructureDamage']),
    needs: asNeeds(o['needs']),
    urgency,
    confidence: clamp01(o['confidence'], 0.5),
    isDuplicate: o['isDuplicate'] === true,
    conflictNotes: typeof o['conflictNotes'] === 'string' ? (o['conflictNotes'] as string).slice(0, 500) : undefined,
  };
}

export function safeParseJson(text: string): unknown | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : text);
  } catch {
    return null;
  }
}
