import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachmentError } from '../src/services/ai/helpdeskAttachment';

test('helpdesk accepts supported images and PDF up to 5 MB', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
    assert.equal(attachmentError({type, size: 5 * 1024 * 1024}), null);
  }
});
test('helpdesk rejects oversized and unsupported initial attachments', () => {
  assert.ok(attachmentError({type: 'application/pdf', size: 5 * 1024 * 1024 + 1}));
  assert.ok(attachmentError({type: 'text/html', size: 100}));
  assert.ok(attachmentError({type: '', size: 100}));
});
