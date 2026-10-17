import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertCompletedGeneration, isCompleteAssistantAnswer, withResponseDeadline } from '../src/services/ai/responseCompletion';
test('truncated or blocked generations cannot be presented as completed answers', () => {
  for (const reason of ['MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER']) assert.throws(() => assertCompletedGeneration(reason));
  assert.doesNotThrow(() => assertCompletedGeneration('STOP'));
  assert.doesNotThrow(() => assertCompletedGeneration());
  assert.equal(isCompleteAssistantAnswer('Berikut rincian banjir Padang:'), false);
  assert.equal(isCompleteAssistantAnswer('Berikut rincian banjir Padang...'), false);
  assert.equal(isCompleteAssistantAnswer('Banjir di Padang tercatat pada 10 Oktober 2026.'), true);
});
test('unresponsive transport releases the caller and ignores late results', async () => {
  let resolve!: (value: string) => void;
  const delayed = new Promise<string>(done => {resolve = done;});
  await assert.rejects(withResponseDeadline(delayed, 10), /timeout/);
  resolve('late response');
  assert.equal(await withResponseDeadline(Promise.resolve('complete'), 100), 'complete');
});
