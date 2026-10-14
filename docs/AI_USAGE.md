# aiUsage

Created automatically on the first write, no manual dummy documents needed.
Fields: at (ISO time), createdAt (server timestamp), model, transport, source
(browser/crawler), uid (caller UID or null for server), input/output (provider
counts or null when unavailable), total (provider reported total).
No key, prompt or generated content is stored. Missing metadata is not zero.

Browser requests require an authenticated, non-anonymous session and the updated
firestore.rules. Guests retain local-only telemetry. Default Google session and
separate superuser session are both supported. Browser counts are self-reported,
not billing proof. Crawler writes use Admin SDK and FIREBASE_NEWS_SERVICE_ACCOUNT.
Only superusers can read; browser updates/deletes are forbidden.

/admin#tokens reads the newest 1,000 documents, filters 1/7/30 days, refreshes every
30 seconds. No historical backfill and no billing/quota totals. Cloud read errors
are shown rather than represented as empty/zero. Publish the full firestore.rules
in Firebase Console if automatic publication fails IAM 403.

Manual workflow "Check AI usage collection" tries publishing rules and makes one
real Gemini request, then verifies a Firestore write/readback. This is a paid API
probe, run only manually. It does not recreate/reset the admin account.
