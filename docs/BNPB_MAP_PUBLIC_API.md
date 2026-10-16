# BNPB public map endpoint investigation

Verified 16 October 2026, read-only, no authentication bypass.

Entry: https://gis.bnpb.go.id/dev/map/
Public bundle: https://gis.bnpb.go.id/dev/map/static/js/main.4cce9414.js

## Endpoints used by that UI

- `https://gis.bnpb.go.id/dev/api/bencana/`: counts by hazard (JSON array), NOT individual geolocated incidents.
- `https://gis.bnpb.go.id/dev/api/summary/`: impact totals for requested area/date window.
- `https://gis.bnpb.go.id/dev/api/poligon/`: GeoJSON FeatureCollection, administrative MultiPolygons with impact and hazard totals; polygon boundaries are NOT the disaster footprint.

Observed date query syntax in the bundle: `start=%272026-10-10%27&end=%272026-10-16%27` (quoted ISO dates).
Optional `id=13` selects Sumatera Barat; the province selector uses administrative province codes.

Verified examples:

https://gis.bnpb.go.id/dev/api/summary/?start=%272026-10-10%27&end=%272026-10-16%27

https://gis.bnpb.go.id/dev/api/summary/?id=13&start=%272026-10-10%27&end=%272026-10-16%27

The second request returned `wilayah: Sumatera Barat`, `jumlah_kejadian: 2`, `rumah_rusak_berat: 14`, `rumah_rusak_sedang: 24`, `rumah_rusak_ringan: 6856`. These are a province aggregate across events, not Padang house counts.

## Schema / compatibility

Summary fields include `meninggal`, `hilang`, `terluka`, `menderita_mengungsi`, `rumah_rusak_berat/sedang/ringan`, `terendam`, `pendidikan_rusak`, `peribadatan_rusak`, `kesehatan_rusak`, `kantor_rusak`, `jembatan_rusak`. Values can be numeric strings or null. Keep null unknown; confirmed string `0` can be parsed to zero. GeoJSON has minor field naming differences, e.g. `menderita_dan_mengungsi`, and `tanggal_update` may be null.

## Recommended integration boundary

Fetch server-side once per daily crawler cycle with timeout/cache/backoff and preserve the existing snapshot on failure. Store separately as regional aggregate evidence, with administrative ID, query start/end, fetchedAt, source endpoint, and original nulls. Never sum with incident reports or create city markers from administrative polygons. Reconcile exact incident, area and period before using severity-specific counts for loss calculation. The site uses public internal endpoints; no published API stability/SLA or reuse license was established by this inspection. Browser CORS was not tested. No new automatic ingestion or production data replacement is activated by this investigation.
