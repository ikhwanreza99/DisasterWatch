# Scheduled English news card translation

## Mechanism and platform limits

The translation step shares the existing `.github/workflows/incident-crawl.yml` GitHub Actions runner, scheduled daily at 05:00 UTC. On schedule it runs after the crawl step settles, even if the crawl failed, so it can process the last persisted eligible feed. A workflow dispatch with `force_translation=true` skips the crawl step and runs only one bounded translation pass. The worker acquires a Firestore lease and checks `jobState/incident-news-en-v1`; it starts a translation pass only when at least five days have elapsed since its last completed pass unless explicitly forced. This daily gate is needed because GitHub cron uses calendar fields and cannot express an exact rolling five-day interval. GitHub may delay or drop scheduled runs under load, so the interval is a minimum, not an exact wall-clock guarantee. Sharing the existing scheduled workflow avoids another runner startup and dependency install.

The job uses the repository's existing GitHub Actions runner, `FIREBASE_NEWS_SERVICE_ACCOUNT` (or the existing fallback), and Gemini key secrets. It does not deploy or enable Cloud Functions, Cloud Scheduler, Cloud Run, or billing. Firebase scheduled functions are not used because they require Blaze; that would violate the Spark/Rp0 constraint. GitHub Actions is free for public repositories and consumes the account's included minutes for private repositories; verify the repository's existing Actions allowance before enabling this workflow. No Firebase billing change is part of this implementation.

## Selection, backlog, and limits

Eligibility mirrors `filterIncidentNews` and `IncidentNewsPanel`: real (not mock) articles with a safe HTTPS source, `MATCHED` relevance for their incident, and a publication date in the existing 14-day display window are selected. `REVIEW_REQUIRED`, rejected, stale, invalid-URL, and Threads keyword-search items are excluded. Selection is ordered newest first. At most `NEWS_TRANSLATION_MAX_RECORDS` records are attempted per pass (default 15, hard cap 50); remaining eligible records stay queued for later five-day passes. The script does not fetch article bodies.

The initial backlog is not run from the development environment. After the workflow and secrets are reviewed on the default branch, an operator can use **Actions → Incident humanitarian crawl → Run workflow**, set `force_translation=true`, and run one controlled first batch (default 15 records); that dispatch skips the news crawl. Later scheduled passes resume the remaining queue. Do not use `--dry-run` for production writes; it only inspects and reports eligibility and never makes Gemini calls. Manual backfill is deliberately a separate operator action.

Required Actions secrets:

- `FIREBASE_NEWS_SERVICE_ACCOUNT` or existing `FIREBASE_SERVICE_ACCOUNT_DISASTERWATCH_61ED5`, with Firestore read/write IAM access.
- `DISASTERWATCH_GEMINI_KEY`, `DISASTERWATCH_GEMINI_SEARCH_KEY`, or `GEMINI_API_KEY`.

The worker checks the project ID before connecting. Firestore rules remain unchanged; Admin SDK IAM is the existing authorized write path.

## Stored data and usage

Only `title` and an already-present short `summary` are sent to Gemini. An additive `englishTranslation` object is written on each `incidentArticles` document. Original fields, publisher attribution, URLs, timestamps, and metadata are never rewritten. Each field tracks its matching source text, field status, overall fingerprint, model, prompt version, and translation timestamp. English fields are skipped; an Indonesian summary on an English headline can still be translated. Failed/empty fields do not become translated and do not overwrite previous successful field values. The default model follows the existing `DEFAULT_GEMINI_MODEL` setting (`gemini-3.8-flash`); `DISASTERWATCH_TRANSLATION_MODEL` can override it.

The prompt version is pinned to `news-card-en-v1`; changing it intentionally invalidates the translation fingerprint. Identical current content is skipped. A changed title or summary is submitted independently, preserving a still-current translation for the other field. Up to ten records share one structured Gemini request; malformed/missing records alone are retried one at a time. With the default 15-record run, the normal maximum is two requests, plus individual retries for invalid/missing items. Runs with no changed Indonesian records make zero AI calls.

Each pass emits one compact JSON summary with timestamps, eligible and changed counts, successful, skipped, and failed counts, and AI request count. Logs contain no source content, API key, or credential material.
