import { test } from "node:test";
import assert from "node:assert/strict";
import { aqiColor, parseAirQuality } from "./googleAirQuality";

// Shape captured from a real currentConditions:lookup response (Jakarta).
const jakarta = {
  dateTime: "2026-10-16T06:00:00Z",
  regionCode: "id",
  indexes: [
    {
      code: "uaqi",
      displayName: "Universal AQI",
      aqi: 23,
      aqiDisplay: "23",
      color: { red: 1, green: 0.35686275 },
      category: "Kualitas udara rendah",
      dominantPollutant: "o3",
    },
  ],
};

test("parses the real Air Quality payload shape", () => {
  const aq = parseAirQuality(jakarta);
  assert.ok(aq);
  assert.equal(aq.aqi, 23);
  assert.equal(aq.aqiDisplay, "23");
  assert.equal(aq.code, "uaqi");
  assert.equal(aq.category, "Kualitas udara rendah");
  assert.equal(aq.dominantPollutant, "o3");
  assert.equal(aq.color, "rgb(255, 91, 0)");
});

test("prefers the UAQI index when several are returned", () => {
  const aq = parseAirQuality({
    indexes: [
      { code: "id_air_quality_index", aqi: 61, aqiDisplay: "61" },
      { code: "uaqi", aqi: 23, aqiDisplay: "23" },
    ],
  });
  assert.equal(aq?.aqi, 23);
  assert.equal(aq?.code, "uaqi");
});

test("never invents an AQI", () => {
  assert.equal(parseAirQuality(null), null);
  assert.equal(parseAirQuality({}), null);
  assert.equal(parseAirQuality({ indexes: [] }), null);
  assert.equal(parseAirQuality({ indexes: [{ code: "uaqi" }] }), null);
  assert.equal(parseAirQuality({ indexes: [{ code: "uaqi", aqi: Number.NaN }] }), null);
});

test("falls back to a safe colour and display value", () => {
  const aq = parseAirQuality({ indexes: [{ code: "uaqi", aqi: 41.6 }] });
  assert.equal(aq?.aqiDisplay, "42");
  assert.equal(aq?.color, "#0ea5e9");
  assert.equal(aqiColor({ red: 2, green: -1, blue: 0.5 }), "rgb(255, 0, 128)");
  assert.equal(aqiColor(undefined), "#0ea5e9");
});
