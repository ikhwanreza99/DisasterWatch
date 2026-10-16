# Security audit — 16 October 2026

## Verified scope

Reviewed frontend/server key paths, Vite env injection, Git-tracked env/key files, static Hosting headers, Firebase AI fallback, FIRMS transport, and public production JS entry/lazy chunks discovered by static imports. Secret values were never printed. No private-key PEM or tracked .env was found; only .env.example is tracked. Public artifact scans are bounded and cannot certify all historical deployments or external account settings.

## Changes

- Remove Gemini Developer API key from frontend; use Firebase AI Logic or authenticated same-origin server fallback. The Express fallback requires a valid nonanonymous Firebase ID token, caps prompt/output, validates model names, limits each user to 10 calls/minute per process, times out upstream requests, and suppresses upstream error bodies. Multi-instance/global quotas require backend infrastructure.
- Remove browser FIRMS key and direct keyed NASA requests. Static Firebase Hosting receives a server/CI-generated 5-day detection snapshot with no key. Requests outside its available dates explicitly fail instead of implying empty data. A self-hosted backend may supply historical ranges through the constrained proxy. Static Hosting does not deploy Express proxies.
- Vite client env allowlist, explicit sourcemap=false, CI secret-value/PEM scan. CI uses the old FIRMS secret only server-side as a migration fallback; it is not passed to the frontend build.
- Hosting: nosniff, DENY framing, strict-origin-when-cross-origin referrer, limited Permissions-Policy, and a baseline CSP blocking object embeds, foreign base URIs and framing. Script/connect allowlists are intentionally not claimed; Maps/Firebase/Drive integrations require separately validated CSP tightening.
- Demo admin mode now opt-in for local Vite middleware.

## Browser-visible keys

Firebase web config, Maps browser key and reCAPTCHA site key are public client identifiers by design. Visibility alone is not a secret leak. Firebase Security Rules/Auth/App Check and Google Cloud website/API restrictions enforce access. Cloud restriction/enforcement settings were NOT verified or changed by this code-only audit. Never promise that inspect-element can hide a browser-required key.

## Required account follow-up

Any Gemini/FIRMS backend key ever shipped in an older public bundle must be rotated by its owner; removing it from the current bundle cannot revoke copies or old URLs. Restrict the Maps browser key to the production web.app/firebaseapp.com domains and only the APIs used. Use separate backend credentials, quotas and budget alerts; enable/enforce App Check after checking legitimate traffic. Do not paste keys into this report or chat.

## Verification

Typecheck/build, six loopback proxy security tests, secret guard over dist, production public asset and security-header verification. No payment, account-role, actual admin decision or private-key rotation is performed by this audit.

## Dependency follow-up

Initial runtime npm audit reported five high-severity entries rooted in @grpc/grpc-js and source-map-js. Overrides update the installed graph to @grpc/grpc-js 1.14.6 and source-map-js 1.2.2, retaining Firebase 12.19.0. Subsequent `npm audit --omit=dev` reports zero vulnerabilities; this is a runtime dependency report, not a proof of application security. Typecheck/build and bundle-secret guard pass after the update.
