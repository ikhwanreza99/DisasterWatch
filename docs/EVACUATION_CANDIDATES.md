# Usulan lokasi posko

When a disaster has no reported route checkpoints, opening Posko Evakuasi searches
Google Places API (New) Nearby Search around the stored disaster coordinates.
Types include mosque, church, schools, parks/fields, stadium/sports complex and
community center. Search 5 km first, expand to 15 km if fewer than 3 eligible
places, max 20 provider results, max 5 displayed candidates. Coordinates and
names must come from Places; closed, duplicate, out-of-radius and ineligible
places are excluded. Distances are straight-line, not driving routes.

Google sometimes pins several distinct venues to one shared coordinate/plus-code.
Candidates closer than 50 m to an already-kept candidate are dropped, so the map
shows one marker per real site instead of a stack of overlapping pins; only then is
the list capped at five. Marker positions are the Places coordinates, never the
disaster coordinate.

Places candidates appear immediately. Gemini receives candidate IDs, facility
types and distances and may reorder those IDs only. Invalid response or API
failure keeps the distance ordering. The existing Firebase AI/Developer API
fallback and aiUsage telemetry are used. No invented capacity or new AI coordinates.
Shared in-memory requests/cache last 5 minutes (max 40 incident entries).

Cards reuse the existing dummy posko design, show Usulan fasum, source Google Maps,
unknown capacity/aid and a Google Maps source link. Cards and markers share the
same checkpoint IDs. Candidate markers are not connected as an evacuation route.
Existing reported posko remain unchanged. Suggestions are ephemeral; they are not
written as confirmed incidentPoskos or approved relief operations.

Production requires Places API (New), billing and browser key restrictions for
VITE_GOOGLE_MAPS_API_KEY allowing the production origin and Places API (New).
Gemini uses existing client configuration. Google metadata does not establish
capacity, safety, accessibility, opening availability or permission to shelter.
BPBD/operator verification is required before treating a candidate as active.
Reference: https://developers.google.com/maps/documentation/places/web-service/nearby-search

Facilities must match the incident regency/city (Places addressComponents,
address fallback) as well as the radius. If no matching facilities are found,
resolve the area named in the BNPB report with Text Search, validate its regency,
then search around that representative area. Show the changed search reference
explicitly; do not silently label Bangka Tengah facilities as Bangka Selatan.
This does not change the incident's official coordinates or prove the exact site.
