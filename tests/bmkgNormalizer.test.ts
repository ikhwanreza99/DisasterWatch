import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeBmkgGempa, toBmkgMarkerData } from '../src/services/bmkg/bmkgNormalizer';

const RETRIEVED = '2026-10-06T04:00:00.000Z';
const RAW = {
  DateTime: '2026-10-06T03:42:45+00:00',
  Coordinates: '-8.10,120.50',
  Magnitude: '4.6',
  Kedalaman: '21 km',
  Wilayah: 'Pusat gempa berada di laut 30 km BaratLaut Lombok Utara',
  Potensi: 'Tidak berpotensi tsunami',
  Dirasakan: 'III Mataram',
  Shakemap: '20261006104245.mmi.jpg',
};

test('BMKG record keeps Potensi and Shakemap alongside core fields', () => {
  const e = normalizeBmkgGempa(RAW, RETRIEVED);
  assert.ok(e);
  assert.equal(e.magnitude, 4.6);
  assert.equal(e.depthKm, 21);
  assert.equal(e.region, RAW.Wilayah);
  assert.equal(e.latitude, -8.1);
  assert.equal(e.longitude, 120.5);
  assert.equal(e.eventTime, '2026-10-06T03:42:45.000Z');
  assert.equal(e.potential, 'Tidak berpotensi tsunami');
  assert.equal(e.mmi, '20261006104245.mmi.jpg');
  assert.equal(e.feltArea, 'III Mataram');
  assert.equal(toBmkgMarkerData(e).potential, 'Tidak berpotensi tsunami');
});

test('BMKG record without Potensi has no potential key', () => {
  const { Potensi: _omit, ...rest } = RAW;
  const e = normalizeBmkgGempa(rest, RETRIEVED);
  assert.ok(e);
  assert.equal('potential' in e, false);
});
