# Indonesian river flood forecasts

The flood category displays Google Flood Forecasting gauges, severity, model forecast charts and thresholds. All-category mode also shows the gauge markers. The API eye toggle controls both. Google Maps and Leaflet share the same snapshot; the detail panel adapts to desktop and mobile.

## Setup

Save an approved Flood Forecasting API key as the GitHub Actions repository secret `GOOGLE_FLOOD_API_KEY`. This is separate from Maps/Weather access. The key is used only by `scripts/fetchFloodSnapshot.ts`; never use a `VITE_` prefix. For localhost, run the script with this environment variable set, then run `npm run dev`. Do not commit the generated `public/data/flood.json`.

The existing production workflow refreshes the snapshot approximately every 30 minutes (GitHub schedules may be delayed), plus each main-branch deployment. Browser refresh only downloads the published snapshot and makes no provider API requests. News retains its separate five-day refresh interval. Firestore synchronization remains paused.

Only `regionCode: ID` gauges returned with `countryCode: ID` are included. API pagination is followed; metadata and forecasts use small batches. Missing chart data is explicit, expired statuses become unknown, and the snapshot timestamp is displayed. No dummy flood data is supplied. A snapshot failure deploys an unavailable state rather than silently suggesting normal conditions.

## Coverage

This implementation covers river gauge markers, current forecast severity, latest model forecast series and thresholds. It does not yet render inundation polygons, watershed boundaries, or flash-flood forecasts. City weather remains a separate overlay, not a flood prediction. Model forecasts are shown with dashed lines and their actual units; no historical observations are synthesized.

References:
- https://developers.google.com/flood-forecasting/rest/v1/gauges/searchGaugesByArea
- https://developers.google.com/flood-forecasting/rest/v1/floodStatus/searchLatestFloodStatusByArea
- https://developers.google.com/flood-forecasting/rest/v1/gauges/queryGaugeForecasts
- https://developers.google.com/flood-forecasting/rest/v1/gaugeModels/batchGet
