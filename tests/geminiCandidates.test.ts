import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_FALLBACK_MODELS,
  resolveGeminiCandidates,
  resolveGeminiModel,
} from '../src/lib/firebase/geminiConfig.ts';

test('primary model default is gemini-3.8-flash with a verified fallback', () => {
  assert.equal(resolveGeminiModel(), DEFAULT_GEMINI_MODEL);
  assert.ok(GEMINI_FALLBACK_MODELS.includes('gemini-3.5-flash-lite'));
});

test('candidates list primary first, then fallbacks, deduplicated', () => {
  const candidates = resolveGeminiCandidates();
  assert.equal(candidates[0], resolveGeminiModel());
  assert.ok(candidates.includes('gemini-3.5-flash-lite'));
  assert.equal(new Set(candidates).size, candidates.length);
});
