import assert from 'node:assert/strict';
import { test } from 'node:test';
import { articleImage, driveFolders, driveImage } from '../scripts/providers/disasterPhotos.ts';
import { validDisasterPhoto, type DisasterPhoto } from '../src/services/disasterPhoto.ts';

test('reads publisher image metadata with reversed attributes and safe relative URLs', () => {
  assert.equal(articleImage('<meta content="/foto.jpg?a=1&amp;b=2" property="og:image">', 'https://example.org/article'), 'https://example.org/foto.jpg?a=1&b=2');
  assert.equal(articleImage('<meta name="twitter:image" content="https://localhost/a.jpg">', 'https://example.org'), null);
  assert.equal(articleImage('<img src="logo.jpg">', 'https://example.org'), null);
});
test('extracts multiple BNPB folder links without treating other domains as Drive', () => {
  assert.deepEqual(driveFolders('https://drive.google.com/drive/folders/abc-123?usp=sharing\nhttps://drive.google.com/drive/folders/xyz_456'), ['abc-123', 'xyz_456']);
  assert.deepEqual(driveFolders('https://evil.com/folders/abc'), []);
});
test('Drive only selects image files with public thumbnail metadata; private access failure remains explicit', async () => {
  const request = (async (url, init) => {
    assert(!String(url).includes('test-key'));
    assert.equal((init!.headers as Record<string,string>)['x-goog-api-key'], 'test-key');
    return new Response(JSON.stringify({ files: [
      { mimeType: 'application/pdf', thumbnailLink: 'https://lh3.googleusercontent.com/pdf', webViewLink: 'https://drive.google.com/file/d/pdf/view' },
      { mimeType: 'image/jpeg', thumbnailLink: 'https://lh3.googleusercontent.com/photo', webViewLink: 'https://drive.google.com/file/d/photo/view' },
    ] }));
  }) as typeof fetch;
  assert.equal((await driveImage('folder-id', 'test-key', request))?.imageUrl, 'https://lh3.googleusercontent.com/photo');
  await assert.rejects(driveImage('folder-id', 'test-key', (async () => new Response('', {status:403})) as typeof fetch), /HTTP 403/);
});
test('wrong incident, old source dates and expired thumbnail snapshots cannot display', () => {
  const now = Date.parse('2026-10-14T12:00:00+07:00');
  const photo: DisasterPhoto = { incidentId:'merauke-2026-10', imageUrl:'https://example.org/photo.jpg', sourceUrl:'https://example.org/article', sourceName:'Media', reportDate:'2026-10-09', retrievedAt:new Date(now).toISOString(), origin:'NEWS_ARTICLE' };
  assert.equal(validDisasterPhoto(photo, photo.incidentId, now), true);
  assert.equal(validDisasterPhoto(photo, 'padang', now), false);
  assert.equal(validDisasterPhoto({...photo, reportDate:'2026-10-04'}, photo.incidentId, now), false);
  assert.equal(validDisasterPhoto(photo, photo.incidentId, now+24*3600_000), false);
});
