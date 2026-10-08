import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiLayerVisibility } from '../src/domain/apiLayerVisibility.ts';
const visible = (category: Parameters<typeof apiLayerVisibility>[0], enabled = true) => Object.entries(apiLayerVisibility(category, enabled)).filter(([, on]) => on).map(([key]) => key).sort();
test('grid enables all API sources by default', () => {
  assert.deepEqual(visible('all'), ['showAsh', 'showBmkg', 'showBmkgWeather', 'showFirms', 'showMagma', 'showWeather']);
});
test('fire, flood and earthquake each display only their requested sources', () => {
  assert.deepEqual(visible('fire'), ['showFirms']);
  assert.deepEqual(visible('flood'), ['showWeather']);
  assert.deepEqual(visible('earthquake'), ['showAsh', 'showBmkg', 'showMagma']);
});
test('eye switch disables every layer for every category', () => {
  for (const category of ['all', 'fire', 'flood', 'earthquake', 'none'] as const) assert.deepEqual(visible(category, false), []);
  assert.deepEqual(visible('none'), []);
});
