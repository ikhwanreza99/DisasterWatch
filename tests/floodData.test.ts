import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentSeverity, normalizeFloodData } from '../src/services/flood/data';

test('flood snapshot includes only Indonesia and chooses latest forecast without fabricating missing values', () => {
  const gauges = [
    { gaugeId: 'id1', countryCode: 'ID', location: { latitude: 0, longitude: 110 } },
    { gaugeId: 'outside', countryCode: 'MY', location: { latitude: 1, longitude: 110 } },
    { gaugeId: 'missing', countryCode: 'ID' },
  ];
  const data = normalizeFloodData(gauges, [], [], { id1: { forecasts: [
    { issuedTime: '2026-10-08T00:00:00Z', forecastRanges: [{ value: 70, forecastStartTime: '2026-10-09T00:00:00Z' }] },
    { issuedTime: '2026-10-09T00:00:00Z', forecastRanges: [{ value: 80, forecastStartTime: '2026-10-10T00:00:00Z' }] },
  ] } });
  assert.equal(data.gauges.length, 1);
  assert.equal(data.gauges[0].severity, 'UNKNOWN');
  assert.equal(data.gauges[0].unit, undefined);
  assert.equal(data.gauges[0].forecast[0].value, 80);
});
test('HYBAS gauges from the Indonesia query remain visible when optional country metadata is omitted', () => {
  const data = normalizeFloodData([{ gaugeId: 'hybas_5120009480', location: { latitude: -6.077083333334088, longitude: 107.01458333332874 }, source: 'HYBAS', qualityVerified: true, hasModel: true }], [], [], {});
  assert.equal(data.gauges.length, 1);
  assert.equal(data.gauges[0].source, 'HYBAS');
});
test('expired or missing validity never presents a gauge as normal', () => {
  const gauge = normalizeFloodData([{ gaugeId: 'id', countryCode: 'ID', location: { latitude: 0, longitude: 110 } }],
    [{ gaugeId: 'id', severity: 'NO_FLOODING', forecastTimeRange: { end: '2026-10-10T00:00:00Z' } }], [], {}).gauges[0];
  assert.equal(currentSeverity(gauge, Date.parse('2026-10-09T00:00:00Z')), 'NO_FLOODING');
  assert.equal(currentSeverity(gauge, Date.parse('2026-10-11T00:00:00Z')), 'UNKNOWN');
  assert.equal(currentSeverity({ ...gauge, validUntil: undefined }), 'UNKNOWN');
});
