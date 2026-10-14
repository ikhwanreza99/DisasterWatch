# Dashboard verificator

Route: `/admin` (including `/admin/`). Temporary login: **Admin / Disaster123**.

## Local preview

Run `npm run dev` and open `http://localhost:3000/admin`.
The Vite middleware runs the same protected Express admin API as the production server.
Development defaults to explicit demo mode: seeded reports and disasters, with approvals held in server memory. Restarting resets demo approvals. Browser report submissions in mock mode are not shared with the server demo dataset.

## Connected Firestore / production

Set `ADMIN_DEMO_MODE=false` and provide Application Default Credentials, normally through `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account JSON file outside the repository. Credentials must belong to the intended Firebase project and permit reading reports, disasters and incidents, and writing reports/reportReviews. Do not put these credentials in `VITE_*` variables.

`ADMIN_PASSWORD` overrides the temporary password. The username remains `Admin`.
Build with `npm run build`, then run `NODE_ENV=production npm start` behind HTTPS (production cookies are Secure). Install devDependencies as well: the start script uses tsx and firebase-admin. Production uses Firestore unless `ADMIN_DEMO_MODE=true` is explicitly set.

**Hosting integration:** the current GitHub workflow deploys static Firebase Hosting only. It does not run the admin API. Deploy the Node server behind the same origin (proxy `/api/admin/*`), or serve the built app from that server. Static `vite preview`/Firebase Hosting alone cannot authenticate admin users. No hosting migration, production deployment, or billing change has been performed.

The temporary session store is in memory, expires after eight hours, and is revoked on logout. Restarting the server signs users out. Use a single server instance for this implementation; distributed deployments require a shared session/rate-limit store. Do not cache `/api/admin` responses. HTTPS termination must preserve the cookie and same-origin API path.

Deploy the changed `firestore.rules` with the backend: browser clients can create pending reports, but cannot approve or forge reviewer metadata. The Admin SDK transaction records `verificationStatus`, `reviewedBy`, `reviewedAt`, and `reviewNote`, and creates an immutable `reportReviews` record. Existing VERIFIED records remain unchanged; records without reviewer metadata are clearly labelled in the detail view. New AI validation never sets VERIFIED.

## Data and monitoring

- Reports: paginated Firestore `reports`, 50 per page, server-side status filter and collection count. Search explicitly applies to the loaded page. Approval verifies the expected status inside a transaction.
- Disasters: switch between `disasters` (public dashboard) and `incidents` (pipeline). Both use complete cursor pagination without local demo merging when connected.
- Service status: direct server Firestore check plus the existing `/data/google-status.json` snapshot. Missing snapshots show unknown; results older than 24 hours show stale. Reloading retrieves the latest published snapshot; it does not run the crawler or paid AI probes.
- Token usage: provider-reported metadata from the shared Firebase AI Logic / Gemini Direct accessor, persisted for up to 500 calls in this browser. No prompts or report contents are stored in token telemetry. This is not aggregate project billing; crawler calls, other devices and calls without metadata are excluded. A shared backend telemetry pipeline is required for project-wide totals.

## Validation

`npm run lint`, `npm run build`, and `npm run test:admin`.
API integration tests cover unauthenticated access, invalid credentials, CSRF header requirement, login throttling, approval persistence in demo mode, stale approval conflicts, logout revocation, and the AI/manual verification boundary.
