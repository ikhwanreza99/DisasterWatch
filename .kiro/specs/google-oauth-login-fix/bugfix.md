# Bugfix Requirements Document

## Introduction

Google login on DisasterWatch does not complete. A signed-out user clicks "Laporkan Bencana" in the header. The LoginModal ("Masuk untuk laporkan bencana") opens, and the user clicks "Masuk dengan Google". The Google popup then stalls on the Firebase auth handler page (`https://disasterwatch-61ed5.firebaseapp.com/__/auth/handler?...authType=signInViaPopup...`), and the modal shows the generic message "Login Google belum berhasil. Silakan coba lagi." The real Firebase error code never reaches the user or the console. The header avatar is a static image, so clicking it does nothing: it does not open the login modal, does not show the signed-in user, and has no sign-out option. Because the user cannot sign in, they cannot submit a disaster report on the deployed site (`disasterwatch-61ed5.web.app`).

Environment facts behind these requirements:
- Checked: `firebase.json`, `vite.config.ts`, and `index.html` set no Cross-Origin-Opener-Policy header. Live responses from `disasterwatch-61ed5.web.app/` and both `/__/auth/handler` hosts return no COOP header. COOP is therefore not the cause today, but the fix must not add a restrictive COOP.
- Checked: `disasterwatch-61ed5.web.app/__/auth/handler` returns HTTP 200, so the hosting domain can serve the auth handler itself.
- Inferred from the handler URL: the production app is served from `web.app` while the build-time `VITE_FIREBASE_AUTH_DOMAIN` is the cross-origin `firebaseapp.com` domain.
- Checked: the local `.env` contains no `VITE_FIREBASE_*` keys, so local dev runs in mock mode. In DEV the modal skips Google entirely and uses a preview user, so OAuth cannot be reproduced locally as-is.
- Not verified: Firebase console and Google Cloud console settings. These include whether the Google provider is enabled, the authorized domains, the OAuth consent screen, and the OAuth client redirect URIs. These may also contribute to the failure.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a signed-out user on the deployed hosting domain (`disasterwatch-61ed5.web.app`) clicks "Masuk dengan Google" THEN the system opens a popup that stalls on the cross-origin `firebaseapp.com/__/auth/handler` page, never returns the sign-in result to the app, and leaves the user signed out

1.2 WHEN Google sign-in fails with any Firebase error code other than `auth/popup-closed-by-user` or `auth/popup-blocked` (for example `auth/unauthorized-domain`, `auth/operation-not-allowed`, `auth/internal-error`, `auth/network-request-failed`, `auth/cancelled-popup-request`) THEN the system shows only the generic "Login Google belum berhasil. Silakan coba lagi." and does not log the error code anywhere

1.3 WHEN the popup is blocked, cancelled by a second popup request, or unsupported (for example on mobile or in embedded browsers) THEN the system stops at an error message and never tries a redirect-based sign-in

1.4 WHEN the app loads after a redirect-based Google sign-in THEN the system never reads the redirect result, so a redirect sign-in and its errors are never surfaced

1.5 WHEN a signed-out user clicks the header avatar THEN the system does nothing, because the avatar is a static, non-interactive image

1.6 WHEN a user is signed in with Google THEN the system keeps showing a hard-coded placeholder avatar ("Koordinator Satgas BNPB") instead of the user's photo and name, and offers no way to sign out

1.7 WHEN the app runs in DEV mode (`import.meta.env.DEV`) with Firebase configured THEN the system skips Google OAuth and signs in a local preview user, so the real OAuth flow cannot be tested locally

1.8 WHEN `VITE_FIREBASE_AUTH_DOMAIN` is left at the default `firebaseapp.com` domain for the `web.app` deployment THEN the system relies on cross-origin storage and messaging between the handler and the app, which browsers with third-party storage partitioning can break

### Expected Behavior (Correct)

2.1 WHEN a signed-out user on the deployed hosting domain clicks "Masuk dengan Google" and Google sign-in succeeds THEN the system SHALL complete authentication and close the popup. It SHALL update the current user to the Google account (non-anonymous, non-mock), close the LoginModal, and open the report form.

2.2 WHEN Google sign-in fails with a Firebase error code THEN the system SHALL show an Indonesian message mapped from that code and SHALL log the raw error code to the console without logging secrets. At minimum it SHALL map `auth/popup-closed-by-user`, `auth/popup-blocked`, `auth/cancelled-popup-request`, `auth/unauthorized-domain`, `auth/operation-not-allowed`, `auth/network-request-failed`, `auth/internal-error`, and `auth/operation-not-supported-in-this-environment`. Unknown codes SHALL fall back to a generic message that includes the code.

2.3 WHEN the popup sign-in fails with `auth/popup-blocked`, `auth/cancelled-popup-request`, or `auth/operation-not-supported-in-this-environment`, or the device is a mobile or embedded browser THEN the system SHALL fall back to `signInWithRedirect` with the Google provider

2.4 WHEN the app loads THEN the system SHALL call `getRedirectResult` once. On success it SHALL treat the user as signed in, and if the login was triggered by "Laporkan Bencana" it SHALL open the report form. On failure it SHALL surface the mapped Indonesian error and log the code.

2.5 WHEN a signed-out user clicks the header avatar THEN the system SHALL open the same LoginModal, and the avatar SHALL be an accessible button with an Indonesian label

2.6 WHEN a user is signed in with Google THEN the header avatar SHALL show the user's Google photo (or an initial-based fallback) and display name. Clicking it SHALL offer a "Keluar" (sign-out) action, which signs the user out and returns the header to the signed-out state.

2.7 WHEN login was triggered from the avatar rather than "Laporkan Bencana" and succeeds THEN the system SHALL close the LoginModal without opening the report form

2.8 WHEN the production build targets `disasterwatch-61ed5.web.app` THEN the system SHALL support setting `VITE_FIREBASE_AUTH_DOMAIN` to the hosting domain so the auth handler is same-origin. The spec SHALL document the console prerequisites:
  - The Google provider is enabled. Otherwise sign-in fails with `auth/operation-not-allowed`.
  - The authorized domains include `localhost`, `192.168.0.113`, `disasterwatch-61ed5.web.app`, and `disasterwatch-61ed5.firebaseapp.com`. Otherwise sign-in fails with `auth/unauthorized-domain`.
  - `https://disasterwatch-61ed5.web.app/__/auth/handler` is an authorized redirect URI on the OAuth web client. Otherwise Google shows `Error 400: redirect_uri_mismatch`.
  - The OAuth consent screen is configured. Otherwise Google shows an access or consent error.

2.9 WHEN the app runs in DEV mode with Firebase configured THEN the system SHALL use the real Google OAuth flow. The local preview user SHALL be used only when Firebase is not configured (mock mode).

2.10 WHEN hosting or dev-server headers are defined THEN the system SHALL NOT set `Cross-Origin-Opener-Policy: same-origin`. If a COOP header is ever needed, it SHALL be `same-origin-allow-popups`.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a signed-in, non-anonymous, non-mock user clicks "Laporkan Bencana" THEN the system SHALL CONTINUE TO open the report form directly without showing the LoginModal

3.2 WHEN Firebase is not configured (missing `VITE_FIREBASE_*` keys) THEN the system SHALL CONTINUE TO run in mock fallback mode without crashing. The LoginModal SHALL show the existing "Login belum tersedia…" style message, or the DEV preview session where that applies today.

3.3 WHEN the user closes the LoginModal (X button, backdrop click, or Escape) THEN the system SHALL CONTINUE TO close it without signing in and without opening the report form

3.4 WHEN the user closes the Google popup THEN the system SHALL CONTINUE TO show "Login dibatalkan. Silakan coba lagi." and keep the modal open

3.5 WHEN the app starts without a Google session THEN the system SHALL CONTINUE TO use the existing anonymous/mock identity behavior (`ensureUser`, `watchUser`) for features that do not require Google login

3.6 WHEN the AI helpdesk report workflow requires login (`onRequireLogin`) THEN the system SHALL CONTINUE TO open the same LoginModal, and on success SHALL CONTINUE TO keep the AI panel open instead of opening a second form

3.7 WHEN the header renders THEN the system SHALL CONTINUE TO keep main's visual design. This covers the gradient "Laporkan Bencana" button, the date controls, the ticker, the avatar size and position, and the responsive visibility (avatar hidden below `lg`).

3.8 WHEN the app loads THEN the system SHALL CONTINUE TO keep the API data-layers toggle defaulting to off, the map legend in its current position, and the BMKG earthquake popup behavior unchanged

3.9 WHEN the app is built and deployed by the existing GitHub workflow THEN the system SHALL CONTINUE TO read all Firebase config from `VITE_FIREBASE_*` build-time variables. No secret values SHALL be committed, and `.env.example` SHALL list key names only.
