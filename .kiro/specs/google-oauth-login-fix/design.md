# Google OAuth Login Fix Bugfix Design

## Overview

Google sign-in on the deployed site (`disasterwatch-61ed5.web.app`) does not complete. The popup stalls on the cross-origin `disasterwatch-61ed5.firebaseapp.com/__/auth/handler`, every failure collapses into one generic Indonesian message, there is no redirect fallback, `getRedirectResult` is never read, and the header avatar is a static image with no sign-in or sign-out path. In DEV, the modal skips OAuth entirely, so the real flow cannot be reproduced locally.

The fix has five parts:

1. Make the auth handler same-origin in production by building with `VITE_FIREBASE_AUTH_DOMAIN=disasterwatch-61ed5.web.app`.
2. Replace `loginWithGoogle` with `signInWithGoogle(source)`: popup first, redirect fallback for specific error codes and for mobile or embedded browsers, with a persisted login intent so the redirect round-trip still opens the report form.
3. Read `getRedirectResult` exactly once per page load, and add `signOutUser`.
4. Map Firebase error codes to Indonesian messages in a pure module, and log only the raw code.
5. Make the header avatar an accessible button (sign in when signed out, photo/name plus "Keluar" menu when signed in), and wire the login source through `App.tsx`.

Scope boundary: no restrictive COOP is added. The Firebase and Google Cloud console settings are prerequisites that this repo cannot change. They are documented below with the error each one produces.

## Glossary

- **Bug_Condition (C)**: A Google sign-in attempt, a post-redirect app load, or a header-avatar interaction where the current code fails to authenticate, hides the real error, never falls back to redirect, or gives the user no sign-in or sign-out path.
- **Property (P)**: The attempt either authenticates the user as a non-anonymous, non-mock Google user and routes them according to the login source, or shows the code-specific Indonesian message and logs the raw code.
- **Preservation**: Behavior that must not change: mock mode without Firebase config, anonymous identity via `ensureUser` and `watchUser`, modal close paths, the "Login dibatalkan" message, AI helpdesk login, main's header visuals, the data-layer defaults, and the build-time `VITE_*` config.
- **F / F'**: The original and fixed code paths (`loginWithGoogle` + `LoginModal.handleLogin` + static avatar, and their replacements).
- **LoginSource**: `'report' | 'avatar' | 'ai-helpdesk'`. Records which UI element opened the LoginModal.
- **Login intent**: `{ source: LoginSource, createdAt: number }`, stored in `sessionStorage` under `dw.loginIntent` before a redirect and consumed after it.
- **`signInWithGoogle`**: New function in `src/lib/firebase/auth.ts`. It replaces `loginWithGoogle`.
- **`consumeRedirectResult`**: New memoized function in `auth.ts`. It calls `getRedirectResult` at most once per page load.
- **`mapAuthError`**: New pure function in `src/lib/firebase/authErrors.ts`. It turns a Firebase error code into an Indonesian message.
- **`shouldFallbackToRedirect` / `prefersRedirect`**: New pure decision functions in `src/lib/firebase/authFlow.ts`.
- **Google user**: A `UserIdentity` with `isAnonymous === false` and `isMock === false`.

## Bug Details

### Bug Condition

The bug appears in four places:

- The sign-in attempt itself. The popup crosses origins (`web.app` to `firebaseapp.com`), and browsers with third-party storage partitioning can break that.
- Error handling. Codes other than `popup-closed-by-user` and `popup-blocked` become one generic string, and the code is never logged.
- Fallback. There is no redirect path, and `getRedirectResult` is never called.
- The header. The avatar is a non-interactive `<img>` with a hard-coded placeholder.

In DEV with Firebase configured, `LoginModal` also short-circuits to `previewUser()`.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AuthInteraction
         { kind: 'google-signin' | 'app-load' | 'avatar-click' | 'signed-in-render',
           firebaseConfigured: boolean, isDev: boolean,
           appOrigin: string, authDomain: string,
           errorCode?: string, userAgent: string,
           pendingRedirect: boolean, user: UserIdentity }
  OUTPUT: boolean

  IF input.kind = 'google-signin' AND input.firebaseConfigured THEN
    RETURN input.isDev                                              // 1.7 OAuth bypassed
        OR origin(input.authDomain) != input.appOrigin               // 1.1 / 1.8 cross-origin handler
        OR (input.errorCode != NULL
            AND input.errorCode NOT IN ['auth/popup-closed-by-user', 'auth/popup-blocked'])   // 1.2
        OR input.errorCode IN ['auth/popup-blocked', 'auth/cancelled-popup-request',
                               'auth/operation-not-supported-in-this-environment']           // 1.3
        OR isMobileOrEmbedded(input.userAgent)                       // 1.3
  IF input.kind = 'app-load' THEN
    RETURN input.firebaseConfigured AND input.pendingRedirect        // 1.4
  IF input.kind = 'avatar-click' THEN
    RETURN NOT isGoogleUser(input.user)                              // 1.5
  IF input.kind = 'signed-in-render' THEN
    RETURN isGoogleUser(input.user)                                  // 1.6
  RETURN false
END FUNCTION
```

### Examples

- On `web.app`, the user clicks "Laporkan Bencana", then "Masuk dengan Google". Expected: the account is chosen, the popup closes, the modal closes, and the report workflow opens. Actual: the popup stalls on `firebaseapp.com/__/auth/handler` and the user stays signed out.
- The domain is missing from the authorized domains. Expected: "Domain ini belum diizinkan untuk login Google…", plus a console line with `auth/unauthorized-domain`. Actual: "Login Google belum berhasil. Silakan coba lagi." and nothing in the console.
- The user taps "Masuk dengan Google" on an Android phone or in the Instagram in-app browser. Expected: a redirect to Google, then a return to the app with the report workflow open. Actual: a popup error and no fallback.
- The user clicks the avatar while signed out. Expected: the LoginModal opens. Actual: nothing happens.
- The user is signed in. Expected: their Google photo and name, plus a "Keluar" option. Actual: the "Koordinator Satgas BNPB" stock photo and no sign-out.
- Edge case: the user closes the popup. Expected, as today: "Login dibatalkan. Silakan coba lagi.", with the modal still open and no redirect fallback.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- A signed-in Google user clicking "Laporkan Bencana" opens the report workflow directly, with no modal (3.1).
- Without `VITE_FIREBASE_*` config, the app runs in mock mode. In DEV the modal still uses `previewUser()`. In a production build it shows "Login belum tersedia. Silakan coba lagi setelah layanan login diaktifkan." (3.2).
- The X button, a backdrop click, and Escape all close the modal without signing in or opening the form (3.3).
- `auth/popup-closed-by-user` shows "Login dibatalkan. Silakan coba lagi." and keeps the modal open, with no redirect fallback (3.4).
- `ensureUser` still creates an anonymous session when there is no Google session. `watchUser` still emits `mockUser()` when there is no Firebase or no user (3.5).
- `onRequireLogin` from the AI helpdesk opens the same modal. On popup success the AI panel stays open and no second form opens (3.6).
- Header visuals are unchanged: the gradient "Laporkan Bencana" button, date controls, ticker, the `w-9 h-9 rounded-full` avatar slot with its `pl-2 border-l` wrapper, and `hidden lg:flex` (3.7).
- The API data-layers toggle defaults to off, the legend position stays the same, and the BMKG quake popup is untouched. None of these files are edited (3.8).
- All Firebase config still comes from `VITE_FIREBASE_*` at build time. `.env.example` lists key names only, and no secret values are committed (3.9).

**Scope:**
Inputs outside the bug condition must behave exactly as before. These include:
- All non-auth UI: map, layers, legend, quake popup, date picker, ticker, weather, donations
- Mock-mode sessions, and anonymous sessions used for non-report features
- Modal close interactions and the popup-closed-by-user path
- The "Laporkan Bencana" click when already signed in

## Hypothesized Root Cause

1. **Cross-origin auth handler (primary)**: The production bundle is built with the `firebaseapp.com` authDomain, while the app is served from `web.app`. The popup's handler page and the opener are different sites. Browsers that partition third-party storage (Safari ITP, Chrome storage partitioning, Firefox TCP) can block the handler from passing the credential back, so the popup hangs. `web.app/__/auth/handler` already returns 200, so switching authDomain to the hosting domain makes the flow same-origin.
2. **Console misconfiguration (possible contributor, not verified)**: The causes could be a disabled Google provider, a missing authorized domain, a missing `web.app/__/auth/handler` redirect URI on the OAuth web client, or an unconfigured consent screen. Today these are hidden because `LoginModal` drops the code. The mapped and logged codes will confirm or rule each one out.
3. **No redirect fallback**: `loginWithGoogle` only calls `signInWithPopup`. Blocked popups, cancelled requests, unsupported environments, and mobile or embedded webviews dead-end.
4. **Redirect result never consumed**: `getRedirectResult` is never called. Even a working redirect would not surface its errors or route the user back to the report form.
5. **Error masking**: `LoginModal` maps every other code to one generic string and does not log.
6. **DEV bypass**: `if (import.meta.env.DEV) onSuccess(previewUser())` runs before checking whether Firebase is configured.
7. **Static avatar**: `Header` renders an `<img>` with no handler, and has no `user` prop.

## Correctness Properties

Property 1: Bug Condition - Google sign-in completes, falls back, or reports the real error

_For any_ auth interaction where isBugCondition returns true, the fixed code SHALL do one of the following:
- (a) Sign in through the popup, or through the redirect fallback when the error code is in {`auth/popup-blocked`, `auth/cancelled-popup-request`, `auth/operation-not-supported-in-this-environment`} or the user agent is mobile or embedded. The current user becomes a Google user, and routing follows the login source: report opens the report workflow, avatar only closes the modal, and ai-helpdesk keeps the AI panel.
- (b) Show `mapAuthError(code)`, which is a code-specific Indonesian message for every listed code and a generic message containing the code for unknown codes, and log only `{ code, phase }` to the console.
- (c) On app load, call `getRedirectResult` exactly once, even under StrictMode double effects, and apply (a) or (b) using the persisted login intent.

In the header, a signed-out avatar click SHALL open the LoginModal. A signed-in render SHALL show the Google photo (or an initial) and name, with a "Keluar" action that returns the header to the signed-out state. In DEV with Firebase configured, the real OAuth flow SHALL run.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

Property 2: Preservation - Non-buggy auth and UI behavior unchanged

_For any_ input where isBugCondition returns false, the fixed code SHALL produce the same result as the original code. This covers:
- mock mode without Firebase config (preview user in DEV, "Login belum tersedia…" in production)
- `auth/popup-closed-by-user`, which shows "Login dibatalkan. Silakan coba lagi.", keeps the modal open, and does not redirect
- modal close via X, backdrop, or Escape
- direct report opening for an already signed-in Google user
- anonymous and mock identities from `ensureUser` and `watchUser`
- AI helpdesk login keeping the panel open
- main's header visual design, including `hidden lg:flex`
- data-layer, legend, and quake-popup defaults
- build-time `VITE_FIREBASE_*` config with no committed secrets

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

## Fix Implementation

### Changes Required

Assuming the root cause analysis holds:

**File**: `src/domain/intelligence.ts`

**Type**: `UserIdentity`

1. **Extend identity**: Add optional `photoURL?: string` and `email?: string` to the existing optional `displayName`. `email` is used only for the menu label and is never logged. Existing producers stay valid because both fields are optional.

---

**File (new)**: `src/lib/firebase/authErrors.ts`. It is pure, with no `firebase` or `import.meta` imports, so `node:test` can load it.

1. `export const AUTH_ERROR_MESSAGES: Record<string, string>` maps at least these codes:

   | Code | Message (Indonesian) |
   |---|---|
   | `auth/popup-closed-by-user` | Login dibatalkan. Silakan coba lagi. (unchanged text) |
   | `auth/popup-blocked` | Popup diblokir browser. Kami alihkan ke halaman login Google… |
   | `auth/cancelled-popup-request` | Permintaan login sebelumnya dibatalkan. Mengalihkan ke halaman login Google… |
   | `auth/operation-not-supported-in-this-environment` | Browser ini tidak mendukung popup login. Mengalihkan ke halaman login Google… |
   | `auth/unauthorized-domain` | Domain ini belum diizinkan untuk login Google. Hubungi admin DisasterWatch. |
   | `auth/operation-not-allowed` | Login Google belum diaktifkan untuk aplikasi ini. Hubungi admin DisasterWatch. |
   | `auth/network-request-failed` | Koneksi bermasalah. Periksa internet Anda lalu coba lagi. |
   | `auth/internal-error` | Terjadi gangguan pada layanan login. Silakan coba lagi beberapa saat lagi. |
   | `auth/too-many-requests` | Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi. |
   | `auth/user-disabled` | Akun ini dinonaktifkan. Hubungi admin DisasterWatch. |
   | `auth/web-storage-unsupported` | Browser memblokir penyimpanan data. Aktifkan cookie/penyimpanan situs lalu coba lagi. |
   | `auth/account-exists-with-different-credential` | Email ini sudah terdaftar dengan metode login lain. |

2. `export function mapAuthError(code: string | undefined, fallbackMessage?: string): string` returns the table entry. For an unknown code it returns `` `Login Google belum berhasil (kode: ${code}). Silakan coba lagi.` ``. When there is no code it returns `fallbackMessage ?? 'Login belum berhasil. Silakan coba lagi.'`.
3. `export function authErrorCode(cause: unknown): string | undefined` safely reads a string `code` from a thrown value.
4. `export function logAuthError(code: string | undefined, phase: 'popup' | 'redirect' | 'redirect-result' | 'signout'): void` calls `console.warn('[auth] Google sign-in failed', { code: code ?? 'unknown', phase })`. It never logs the error object, `customData` (which can contain an email), tokens, or config values.

---

**File (new)**: `src/lib/firebase/authFlow.ts`. It is pure. Storage and user agent are passed in as parameters for testability.

1. `export type LoginSource = 'report' | 'avatar' | 'ai-helpdesk'`.
2. `export const REDIRECT_FALLBACK_CODES = ['auth/popup-blocked', 'auth/cancelled-popup-request', 'auth/operation-not-supported-in-this-environment'] as const`.
3. `export function shouldFallbackToRedirect(code: string | undefined): boolean` returns true only for those three codes. It returns false for `auth/popup-closed-by-user` and every other code.
4. `export function prefersRedirect(userAgent: string): boolean` returns true for mobile (`/Android|iPhone|iPad|iPod|Mobile/i`) and for embedded or in-app webviews (`/FBAN|FBAV|Instagram|Line\/|; wv\)|WebView|GSA\//i`). Desktop UAs return false.
5. Intent helpers that take a `Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null`:
   - `saveLoginIntent(storage, source, now)` writes `dw.loginIntent` = JSON `{ source, createdAt }`.
   - `takeLoginIntent(storage, now, maxAgeMs = 10 * 60_000)` reads, removes, validates the source, and expires stale entries. It returns `LoginSource | null`.
   - `clearLoginIntent(storage)`.

   Every helper wraps its storage access in try/catch, because Safari private mode or blocked storage can throw. On failure it degrades to "no intent".

---

**File**: `src/lib/firebase/auth.ts`

1. **`toIdentity(u: User): UserIdentity`**: One mapper used by `ensureUser`, `watchUser`, and sign-in. It includes `displayName`, `photoURL`, and `email`.
2. **`signInWithGoogle(source: LoginSource): Promise<GoogleSignInOutcome>`**, where `GoogleSignInOutcome = { status: 'signed-in'; user: UserIdentity } | { status: 'redirecting' }`:
   - Without auth it throws the existing "Login belum tersedia…" `Error`, which has no code.
   - It creates `new GoogleAuthProvider()` and calls `setCustomParameters({ prompt: 'select_account' })`.
   - The `signInWithPopup` call must be the first `await` in the click call stack, so the browser's user-activation window is preserved. Nothing async may run before it.
   - If `prefersRedirect(navigator.userAgent)` is true, it skips the popup: `saveLoginIntent(sessionStorage, source)`, then `await signInWithRedirect(...)`, then returns `{ status: 'redirecting' }`.
   - Otherwise it tries `signInWithPopup`. On success it calls `clearLoginIntent` and returns signed-in.
   - On error it calls `logAuthError(code, 'popup')`. If `shouldFallbackToRedirect(code)`, it saves the intent, calls `signInWithRedirect`, and returns redirecting. Otherwise it rethrows, so the modal can map the error.
   - If `signInWithRedirect` itself throws, it calls `clearLoginIntent`, then `logAuthError(code, 'redirect')`, and rethrows.
   - `loginWithGoogle` is removed. `LoginModal` is its only caller.
3. **`consumeRedirectResult(): Promise<{ user: UserIdentity | null; source: LoginSource | null; error?: { code?: string; message: string } }>`**:
   - A module-level `let redirectResultPromise: Promise<…> | null = null`. The first call stores the promise, and later calls return the same one. This guarantees exactly one `getRedirectResult` per page load, including under `<StrictMode>` (confirmed in `src/main.tsx`), which runs effects twice in DEV.
   - In mock mode (no auth) it resolves `{ user: null, source: null }` without calling Firebase.
   - It calls `getRedirectResult(auth)`. On success with a credential it returns `toIdentity(result.user)` and `takeLoginIntent(sessionStorage)`. On a `null` result it returns `{ user: null, source: null }` and calls `takeLoginIntent` to discard a stale intent.
   - On error it calls `logAuthError(code, 'redirect-result')` and returns `{ user: null, source: takeLoginIntent(...), error: { code, message: mapAuthError(code) } }`.
   - It never throws.
4. **`ensureUser` ordering**: Before the `signInAnonymously` branch, `await consumeRedirectResult()`. This stops an anonymous session from racing a pending Google redirect credential. Because the call is memoized, it adds no second `getRedirectResult`.
5. **`signOutUser(): Promise<UserIdentity>`**: In mock mode it returns `mockUser()`. Otherwise it calls `await signOut(auth)`, then `clearLoginIntent`, then returns `ensureUser()`. Restoring the anonymous identity keeps 3.5 intact. On error it calls `logAuthError(code, 'signout')` and rethrows.
6. **`isGoogleUser(u)`**: `!u.isAnonymous && !u.isMock`. `canReport` is unchanged. It still accepts the DEV preview user, which is now only reachable in mock mode.

---

**File**: `src/components/LoginModal.tsx`

1. New props: `source: LoginSource` and `initialError?: string`, where `initialError` carries a redirect-result failure from `App`.
2. `handleLogin`:
   - If `!isFirebaseConfigured()`: in DEV, call `onSuccess(previewUser())`. In production, show "Login belum tersedia. Silakan coba lagi setelah layanan login diaktifkan." This preserves 3.2.
   - Otherwise, never take the preview path, even in DEV (2.9). Call `signInWithGoogle(source)` synchronously from the click handler, with no `await` before it.
   - On `'signed-in'`, call `onSuccess(user)`. On `'redirecting'`, keep `busy` set and show "Mengalihkan ke halaman login Google…" while the page navigates away.
   - On error, `setError(mapAuthError(authErrorCode(cause), cause instanceof Error && !authErrorCode(cause) ? cause.message : undefined))`. Logging already happened in `auth.ts`.
3. The close behavior (X, backdrop, Escape via `onCancel`), the `<dialog>` markup, `role="alert"`, and the visual styling all stay unchanged.

---

**File**: `src/components/Header.tsx`

1. New props: `user: UserIdentity`, `onOpenLogin: () => void`, and `onSignOut: () => void | Promise<void>`.
2. Keep the wrapper `div.hidden.lg:flex.items-center.pl-2.border-l…` exactly as it is. Add `relative` for the menu.
3. **Signed out** (`!isGoogleUser(user)`): render a `<button type="button" aria-label="Masuk dengan akun Google">` containing a `w-9 h-9 rounded-full border border-slate-300 dark:border-cyan-500/40 shadow-xs` circle with a lucide `UserRound` icon. It uses the same size, border, and shadow as the current image. On click it calls `onOpenLogin`. The placeholder "Koordinator Satgas BNPB" stock photo is retired so it no longer implies a signed-in officer. Decision: keeping the stock image is possible if visual parity matters more. It would be a single-line swap.
4. **Signed in**: render a `<button type="button" aria-haspopup="menu" aria-expanded={open} aria-controls="account-menu" aria-label={`Akun: ${user.displayName ?? 'Pengguna Google'}`}>`. Inside it:
   - an `<img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover border …">`, with `onError` falling back to the initial
   - or, when there is no photo or the image fails, a `w-9 h-9` circle showing the first letter of `displayName`/`email`

   The menu is `<div id="account-menu" role="menu">`. It shows the name and email as non-interactive text, plus `<button role="menuitem">Keluar</button>`, which calls `onSignOut` and then closes the menu.
   - Keyboard: Escape closes the menu and returns focus to the trigger, and the first item gets focus on open.
   - Pointer: an outside click closes the menu, using the same pattern as the calendar dropdown.
   - Visible focus ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500`.
5. The ticker, date picker, and "Laporkan Bencana" button are untouched. Known limitation, kept per 3.7: below `lg` the avatar, and so the "Keluar" option, stays hidden.

---

**File**: `src/App.tsx`

1. State: `loginSource: LoginSource` (default `'report'`) and `loginError: string | undefined`. `openLogin(source)` sets both (clearing the error) and calls `setIsLoginOpen(true)`.
2. `handleReportDisaster` calls `openLogin('report')` instead of `setIsLoginOpen(true)`. AIHelpdesk uses `onRequireLogin={() => openLogin('ai-helpdesk')}`. Header gets `user={currentUser}`, `onOpenLogin={() => openLogin('avatar')}`, and `onSignOut={async () => setCurrentUser(await signOutUser())}`. If sign-out fails it is logged and the current state is kept.
3. `routeAfterLogin(user, source)`:
   - It calls `setCurrentUser(user)` and `setIsLoginOpen(false)`.
   - For `'report'`, it calls `openReportForm()`.
   - For `'ai-helpdesk'`, it does `if (!isAIOpen) openReportForm()`. Popup login keeps the open panel (3.6). After a redirect the panel state is gone, so the report workflow is reopened. The unsent AI draft is not restored, which is a known limitation.
   - For `'avatar'`, nothing else happens (2.7).
4. `LoginModal` gets `source={loginSource}`, `initialError={loginError}`, and `onSuccess={(u) => routeAfterLogin(u, loginSource)}`.
5. A mount effect calls `consumeRedirectResult().then(...)`:
   - If there is a `user`, it calls `routeAfterLogin(user, source ?? 'avatar')`. The default means a redirect without an intent never opens the form by surprise.
   - If there is an `error`, it calls `setLoginSource(source ?? 'report')`, `setLoginError(error.message)`, and `setIsLoginOpen(true)`.
   - It uses the existing `cancelled` guard pattern. The memoized promise keeps it at one Firebase call under StrictMode.

---

**File**: `.github/workflows/deploy-hosting.yml`

1. Replace `VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}` with the literal `VITE_FIREBASE_AUTH_DOMAIN: disasterwatch-61ed5.web.app`. Add a comment explaining that the auth handler must be same-origin with the hosting domain, and that the value is a public hostname, not a secret. No other keys change.
2. The workflow only deploys from `main`, so the change takes effect after `rafii-api` is merged. Until then, a manual production build must export the same value.

---

**File**: `.env.example` and `README.md`

1. `.env.example`: keep the key name only. Add a comment: "Production: set to the Hosting domain (e.g. <project>.web.app) so /__/auth/handler is same-origin. Local dev may use <project>.firebaseapp.com." No values.
2. README (EN and ID): add a short "Google login prerequisites" section mirroring the console list below.

---

**COOP**: Confirmed absent in `firebase.json` (no `headers`), in `vite.config.ts` (no `server.headers`), and in `index.html`. No change is needed. A unit test guards against adding `Cross-Origin-Opener-Policy: same-origin`. If a COOP header is ever needed, it must be `same-origin-allow-popups` (2.10).

### Console-only prerequisites (not changeable from the repo)

| # | Setting | Where | Error if missing |
|---|---|---|---|
| 1 | Google sign-in provider enabled | Firebase console → Authentication → Sign-in method | `auth/operation-not-allowed` |
| 2 | Authorized domains include `localhost`, `192.168.0.113`, `disasterwatch-61ed5.web.app`, `disasterwatch-61ed5.firebaseapp.com` | Firebase console → Authentication → Settings → Authorized domains | `auth/unauthorized-domain` |
| 3 | `https://disasterwatch-61ed5.web.app/__/auth/handler` in Authorized redirect URIs, keeping the existing `https://disasterwatch-61ed5.firebaseapp.com/__/auth/handler` | Google Cloud console → APIs & Services → Credentials → OAuth 2.0 Web client (auto-created by Firebase) | Google page `Error 400: redirect_uri_mismatch` |
| 4 | Authorized JavaScript origins include `https://disasterwatch-61ed5.web.app` (and `http://localhost:3000` for dev) | Same OAuth Web client | Google page `Error 400: origin_mismatch` / `idpiframe_initialization_failed` |
| 5 | OAuth consent screen configured (app name, support email; published, or test users added while in Testing) | Google Cloud console → OAuth consent screen | Google page `Error 403: access_denied` / "This app is blocked" / "Access blocked: app has not completed verification" |
| 6 | API key restrictions, if any, allow `disasterwatch-61ed5.web.app/*` referrers and the Identity Toolkit API | Google Cloud console → Credentials → API key | `auth/internal-error` or `auth/api-key-not-valid` / `auth/requests-from-referer-…-are-blocked` |

None of these values are secrets. The OAuth client secret is managed by Firebase and is never needed in the repo.

## Testing Strategy

### Validation Approach

Validation runs in two phases. First, show the bug on the unfixed code with tests that encode the expected behavior. Then implement the fix and verify both the fix and preservation. The project uses `node:test` + `node:assert/strict`, run with `npx tsx --test tests/*.test.ts`, so no new framework is added. Optionally, add `"test": "tsx --test tests/*.test.ts"` to `package.json`. The new modules (`authErrors.ts`, `authFlow.ts`) stay free of `firebase` and `import.meta.env` imports so `tsx` can load them in Node. Firebase SDK calls and React components are checked by `npm run lint` (`tsc --noEmit`), `npm run build`, and manual verification on the deployed domain.

### Exploratory Bug Condition Checking

**Goal**: Show counterexamples on the unfixed code and confirm the root cause.

**Test Plan**: Against the current code, write assertions that encode the expected behavior and observe them fail. In the browser, capture the real error code on the deployed site, which needs the logging added by the fix or a temporary DevTools breakpoint.

**Test Cases**:
1. **Error masking**: Assert that the current inline mapping in `LoginModal` turns `auth/unauthorized-domain` into a code-specific message. It fails, because it yields the generic string.
2. **No fallback**: Assert that a `auth/popup-blocked` failure leads to a redirect attempt. It fails, because there is no `signInWithRedirect` import or call in `auth.ts`.
3. **Redirect result unread**: `grep getRedirectResult src` finds no call site. Fails.
4. **Avatar inert**: The Header avatar has no `button` role or `onClick`. Fails.
5. **Cross-origin handler (manual)**: On `web.app`, the popup URL host is `firebaseapp.com`, and DevTools shows the handler never posting back. Expected to reproduce, though it may vary by browser.

**Expected Counterexamples**:
- `mapping('auth/unauthorized-domain') === 'Login Google belum berhasil. Silakan coba lagi.'`
- A popup-blocked error ends in an error message with no redirect.
- Possible causes: a cross-origin authDomain, a missing console prerequisite (identified by the newly logged code), or a missing fallback.

### Fix Checking

**Goal**: For every input where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL code IN KNOWN_CODES DO
  ASSERT mapAuthError(code) = AUTH_ERROR_MESSAGES[code] AND isIndonesian(mapAuthError(code))
FOR ALL code NOT IN KNOWN_CODES DO
  ASSERT mapAuthError(code) CONTAINS code
FOR ALL code IN REDIRECT_FALLBACK_CODES DO
  ASSERT shouldFallbackToRedirect(code)
FOR ALL ua IN MOBILE_OR_EMBEDDED_UAS DO
  ASSERT prefersRedirect(ua)
FOR ALL source IN LoginSource, now DO
  saveLoginIntent(store, source, now)
  ASSERT takeLoginIntent(store, now + 1000) = source AND takeLoginIntent(store, now + 2000) = null
```

### Preservation Checking

**Goal**: For every input where the bug condition does not hold, the fixed code behaves like the original.

**Pseudocode:**
```
FOR ALL code WHERE code NOT IN REDIRECT_FALLBACK_CODES DO     // incl. popup-closed-by-user
  ASSERT NOT shouldFallbackToRedirect(code)
ASSERT mapAuthError('auth/popup-closed-by-user') = 'Login dibatalkan. Silakan coba lagi.'
FOR ALL ua IN DESKTOP_UAS DO
  ASSERT NOT prefersRedirect(ua)
ASSERT firebase.json AND vite.config.ts contain no 'Cross-Origin-Opener-Policy: same-origin'
```

**Testing Approach**: Use property-style tests over generated inputs: random code strings, random sources and timestamps, and a table of real user-agent strings. They cover the input domain more broadly than single examples. No PBT library is installed. Rather than adding a dependency, the generators are small seeded loops inside `node:test`. If the user prefers a library, `fast-check` (pinned exact version) is the standard choice.

**Test Plan**: Before writing assertions, observe the current values on the unfixed code: the popup-closed text, mock-mode behavior, and desktop popup-first behavior.

**Test Cases**:
1. **Popup-closed preservation**: The message text is identical and there is no fallback.
2. **Desktop popup-first**: Chrome, Firefox, Safari, and Edge desktop UAs give `prefersRedirect === false`.
3. **Intent robustness**: A throwing storage, a missing storage, a malformed JSON value, an unknown source, and an expired entry all give `null`, with no throw.
4. **No restrictive COOP**: Parse `firebase.json` and read `vite.config.ts` text, and assert there is no `same-origin` COOP.

### Unit Tests

- `tests/authErrors.test.ts`:
  - every required code from 2.2 maps to its specific message
  - unknown codes include the code
  - an undefined code uses the fallback
  - `authErrorCode` handles non-objects
  - `logAuthError` (with `console.warn` stubbed) receives only `{ code, phase }`, with no extra keys
- `tests/authFlow.test.ts`:
  - `shouldFallbackToRedirect` is true for exactly the three codes
  - `prefersRedirect` gives the right answer for the mobile, embedded, and desktop UA tables
  - the intent save, take, and expire round trip works
  - one-shot consumption works
  - storage failures are handled
- `tests/hostingHeaders.test.ts`: the COOP guard.

### Property-Based Tests

- Random strings that do not start with a known code: `mapAuthError` always returns a non-empty string containing the code. `shouldFallbackToRedirect` is false.
- Random `(source, createdAt, delta)`: `takeLoginIntent` returns `source` if and only if `0 <= delta <= maxAge`, and always clears the key.
- Random interleavings of save, take, and clear on an in-memory storage: at most one `take` returns a non-null source per `save`.

### Integration Tests

Manual, on the deployed `https://disasterwatch-61ed5.web.app` after the workflow builds with the `web.app` authDomain and the console prerequisites are confirmed:

1. **Desktop Chrome and Safari, from "Laporkan Bencana"**: The popup URL host is `disasterwatch-61ed5.web.app/__/auth/handler`. After the account is chosen, the popup closes, the modal closes, and the report workflow opens. The avatar shows the Google photo and name.
2. **From the avatar**: The modal opens. On success it closes, and no report form opens.
3. **AI helpdesk `onRequireLogin`**: After a popup login, the AI panel stays open with no second form.
4. **Popup blocked** (block popups for the site): The page redirects to Google and returns. `getRedirectResult` runs once, which can be seen in the Network panel, and the report workflow opens because the intent was `report`.
5. **Mobile Android Chrome / iOS Safari / Instagram in-app browser**: Redirect-first, with a return to the report workflow.
6. **Closing the popup**: "Login dibatalkan. Silakan coba lagi.", with the modal still open.
7. **Error surfacing**: Temporarily remove nothing in production. Instead, run a preview channel (`firebase hosting:channel:deploy`) whose domain is deliberately not authorized. That shows "Domain ini belum diizinkan…" and logs `{ code: 'auth/unauthorized-domain', phase: 'popup' }`, with no other fields logged.
8. **"Keluar"**: The user is signed out and the avatar returns to the signed-out button. Clicking "Laporkan Bencana" opens the LoginModal again.
9. **Keyboard and screen reader**: The avatar is reachable with Tab and announced with its Indonesian label. Enter or Space opens the menu or the modal, Escape closes the menu and restores focus, and focus is visible. Full WCAG validation still needs manual assistive-technology testing.
10. **Local DEV with Firebase configured**: The real Google popup appears, with no preview user. **Local DEV without config**: The preview user flow is unchanged.
11. **Regression sweep**: The data-layers toggle is off by default, the legend position is unchanged, the BMKG quake popup works, and the header layout matches main at `sm`, `md`, and `lg`.

Build gates for every change: `npm run lint`, `npm run build`, `npx tsx --test tests/*.test.ts`. No secret values are printed in logs, tests, or documentation.
