# Padang article narrative pilot

Each hosting deployment refetches the two user-provided ANTARA/Hukumonline
references and up to six matched recent Padang aid/needs/recovery article URLs
from incidentArticles. Fetching is server-only, allowlisted publishers, HTTPS,
no redirect traversal, bounded body/time, no paywall bypass. Failures remain
unavailable rather than generating artificial records. Articles must be within
7 calendar days WIB; Padang Panjang and unrelated event titles are excluded.

Only structured facts are stored, not full article bodies. Original item names,
units, source URL, publication time and organization are retained. Counts are
not assigned across unrelated items. Tank capacity is separate from distributed
water; assistance value is not disaster loss. Estimated beneficiaries are not
converted into population needs or percentages. Other cities remain unchanged.

Output public/data/incident-narratives.json is generated, not committed. Real
facts are also upserted by Admin SDK to incidentNarratives with isMock=false and
verificationStatus=UNVERIFIED. Collection records are not independently verified.
Browser reads the generated snapshot; full source documents remain at publishers.
The public dashboard links each fact to its source and does not reproduce bodies.

Aid-gap rows show reported deliveries by item/unit/source without summing across
publishers. Required quantities, shortage, cost estimates and recovery percentages
remain unknown when not provided; 60 cartons are not converted into liters or
packs without explicit packaging data. Original prototype aid-gap arithmetic is
unchanged for separately recorded needs/aid. Narrative data does not populate
unrelated recovery fields or transform donations into damage estimates.

Tests lock: multiple distinct items, tank capacity not volume delivered,
assistance value not loss, wrong-city rejection, and scripts excluded from prose.
