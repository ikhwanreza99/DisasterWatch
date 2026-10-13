# Google Search alongside Zapi

The server-only crawler calls both configured providers, merges canonical URLs, and applies the same incident relevance classifier. A provider failure preserves results from the other provider. Existing Firestore data is never deleted. Google output without actual search execution or with an incomplete response is a provider failure.

Google uses Gemini Interactions with `google_search`. Only explicit URL citations are retained; only the text segment associated with each citation becomes a summary. Publication dates remain unknown and results remain unverified. Unknown dates may place results in the review queue. These are AI summaries with cited sources, not fetched article bodies or confirmed needs. Google search suggestions are carried through Firestore and rendered in a sandboxed iframe alongside the news.

## Configure GitHub Actions

Keep `ZAPI_API_KEY` and Firebase service account secrets as before. Add:

- Secret `DISASTERWATCH_GEMINI_SEARCH_KEY`: a Gemini API key.
- Repository variable `DISASTERWATCH_GOOGLE_SEARCH_ENABLED`: `true`.
- Optional repository variable `DISASTERWATCH_GOOGLE_SEARCH_MODEL`: supported Google Search model, default `gemini-3.8-flash`.

The workflow must be committed/pushed before these changes affect scheduled runs. No secrets are included in browser variables. Locally, the same settings can live in the ignored `.env`; the crawler loads dotenv. The existing `DISASTERWATCH_GEMINI_KEY` can be used as a local key fallback, but search still requires the explicit enable flag.

## Execute

`npx tsx scripts/incidentCrawlRun.ts`

The existing five-day gate applies to both providers. Gemini has one request per incident; the model can execute multiple billable search queries inside a request. `--force` bypasses the time gate. `--dry-run` prevents Firestore writes but still sends paid provider requests when due; it is not an offline test. `--no-ai` disables the separate summary extraction step, not the requested Google Search provider.

Offline checks: `npm run lint` and `node --import tsx --test scripts/providers/geminiSearch.test.ts`.

Implementation reference: https://ai.google.dev/gemini-api/docs/google-search

## Service status page

`/status` separates browser checks from backend diagnostics. The Hosting workflow publishes `public/data/google-status.json` without credentials. Run **Deploy to Firebase Hosting → Run workflow → Uji Google Search** for one bounded Gemini search probe; it does not write crawled articles or change the five-day gate. The probe result is cached between deploys and shown with its original timestamp. Results older than 24 hours are marked stale. Normal scheduled deploys never invoke a new Google Search probe.

Browser tests run only when a visitor clicks a service test button. Firestore uses server reads, Weather tests bypass simulation, and the two Gemini transports are tested separately with no fallback. Auth only tests creation of the Google login URL; completing sign-in is a user action. Storage is configuration-only until an authenticated attachment workflow is used. No API key values or raw error bodies appear on the status page.
