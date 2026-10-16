# Padang article narrative pilot

Each hosting deployment refetches the three fixed references (ANTARA/Hukumonline
aid and the RRI BNPB/Pusdalops impact report) and up to eight matched recent
Padang aid/needs/recovery/impact article URLs from incidentArticles. Fetchable
publishers and impact-titled reports are preferred so a slot is not spent on a
blocked domain or a report with no figures. Fetching is server-only, allowlisted
publishers, HTTPS, no redirect traversal, bounded body/time, no paywall bypass.
A transient network failure is retried once; a blocked publisher or invalid URL
is not, and failures remain unavailable rather than generating artificial
records. Articles must be within 7 calendar days WIB; Padang Panjang and
unrelated event titles are excluded.

Only structured facts are stored, not full article bodies. Original item names,
units, source URL, publication time and organization are retained. Counts are
not assigned across unrelated items. Tank capacity is separate from distributed
water; assistance value is not disaster loss. Estimated beneficiaries are not
converted into population needs or percentages. Other cities remain unchanged.

Reported impact figures (people displaced/evacuated, people affected, households
affected, homes affected) are read from a report's own title and body — grouped
as `IMPACT` facts. Only numerals become values: "ratusan"/"puluhan" stay
unreported instead of becoming an invented precise count. One value per metric
per source is kept — the largest figure is the report's own total, so per-shelter
subsets are not published as separate figures. Values are never summed across
articles, never converted into needs, and never written into BNPB/GIS recovery
fields; the browser keeps the original unit and the source link. A passage naming
another province only contributes when it also names Padang.

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
assistance value not loss, wrong-city rejection, per-source impact figures with
their own unit (largest figure per metric, no per-shelter subsets), another
province never attributed to Padang, vague quantifiers never becoming counts,
and scripts excluded from prose.
