# Google login (Firebase Auth) — rafii-api

Workspace: /Users/960302/Downloads/DisasterWatch (branch rafii-api, work in place, no worktree). Do NOT commit or push. Do NOT stop/restart the Vite dev server on :3000. Never print values from `.env` (refer to keys by name).

Commands (from package.json / tests): `npm run lint` (tsc --noEmit, currently green), `npm run build`, `npx tsx --test tests/*.test.ts` (node:test + tsx, pattern in tests/reportIntent.test.ts).

## 1. Reproduced runtime behavior (headless Brave via CDP)

localhost:3000 (running dev server):
- Served `import.meta.env` contains only `VITE_GOOGLE_MAPS_API_KEY`. `.env` has no `VITE_FIREBASE_*` keys, so `isFirebaseConfigured()` is false and the app runs in mock auth mode.
- Clicking the header "Laporkan Bencana" opens LoginModal. That part works.
- Clicking the avatar does nothing. It's a plain `<img>` in `<div class="hidden lg:flex">` with no handler (Header.tsx).
- Clicking "Masuk dengan Google" never reaches Firebase. `LoginModal.handleLogin` short-circuits with `if (import.meta.env.DEV) onSuccess(previewUser())`, so the modal closes and a fake "Pelapor Demo" user is used. No identitytoolkit request goes out and no popup opens.

Production (https://disasterwatch-61ed5.web.app, same code from main): Firebase is configured (authDomain `disasterwatch-61ed5.firebaseapp.com`, projectId `disasterwatch-61ed5`).
- A real user-gesture click opens the popup to `disasterwatch-61ed5.firebaseapp.com/__/auth/handler?...authType=signInViaPopup`. The popup closes right away and the modal shows the generic "Login Google belum berhasil. Silakan coba lagi."
- Root cause: calling `identitytoolkit.googleapis.com/v1/accounts:createAuthUri` with providerId `google.com` returns HTTP 400 `OPERATION_NOT_ALLOWED : The identity provider configuration is not found.` The Google sign-in provider is not enabled in Firebase Auth. The SDK surfaces this as `auth/operation-not-allowed`, and the current UI hides that code behind the generic message.
- `GET /v1/projects` gives authorizedDomains = `localhost`, `disasterwatch-61ed5.firebaseapp.com`, `disasterwatch-61ed5.web.app`. `192.168.0.113` is missing, so LAN access will fail with `auth/unauthorized-domain` even after the provider is enabled.
- A synthetic JS `.click()` (no user activation) gives `auth/popup-blocked` ("Izinkan popup…"). That is a headless/test artifact, not a code bug, but the redirect fallback below covers it.
- Anonymous sign-in (`accounts:signUp`) and Firestore work in production.

COOP: neither vite.config.ts nor firebase.json sets `Cross-Origin-Opener-Policy`. Response headers from localhost:3000 and web.app have no COOP, and the popup opened fine. No change is needed. Do not add COOP. If someone adds it later, it must be `same-origin-allow-popups`.

## 2. Console-only items (cannot be fixed from code)

Hand these to the user. Each one is proven by the error shown:

1. Enable the Google provider: Firebase Console → Authentication → Sign-in method → Google → Enable, and set a support email. Proof: `accounts:createAuthUri` returns `OPERATION_NOT_ALLOWED : The identity provider configuration is not found` (SDK code `auth/operation-not-allowed`). This is the blocker for "masih gagal".
2. Authorized domains: Authentication → Settings → Authorized domains → add `192.168.0.113`. `localhost`, `disasterwatch-61ed5.web.app` and `disasterwatch-61ed5.firebaseapp.com` are already present. Proof: the domain is missing from `authorizedDomains`, so the SDK throws `auth/unauthorized-domain` on the LAN URL.
3. OAuth consent screen (Google Cloud Console → APIs & Services → OAuth consent screen): it gets created when the Google provider is enabled. While it is in "Testing", only listed test users can sign in (Google shows `Error 403: access_denied`). Publish it or add testers.
4. authDomain: `VITE_FIREBASE_AUTH_DOMAIN` must be `disasterwatch-61ed5.firebaseapp.com`. It already is in the production bundle, and the GitHub secret is used by deploy-hosting.yml. A mismatch shows up as `auth/auth-domain-config-required` or the handler page showing "redirect_uri_mismatch".
5. Local env: `.env` lacks every `VITE_FIREBASE_*` key, which is why localhost is in mock mode. The values are the public web-client config, the same ones already in the deployed bundle (Project settings → Your apps → Web app). Step 6 fills them in.

## 3. Design decisions

- Keep `signInWithPopup(GoogleAuthProvider)` as the primary flow. The popup already opens on desktop. Fall back to `signInWithRedirect` on `auth/popup-blocked`, `auth/cancelled-popup-request` and `auth/operation-not-supported-in-environment`. Also use redirect directly on mobile, detected with `matchMedia('(pointer: coarse)')` plus a mobile UA regex `/Android|iPhone|iPad|iPod|Mobile/i`. Call `getRedirectResult` once on app load.
- Use `signInWithPopup`, not `linkWithPopup`, to replace the anonymous session. Linking throws `auth/credential-already-in-use` for returning users, which adds complexity for no gain. Reports already store `sourceName` per submission.
- The post-login intent ('report' vs 'account') lives in React state for the popup flow. It is mirrored in `sessionStorage['dw:postLoginIntent']` so it survives the full-page redirect.
- Map error codes to Indonesian text in a new pure module, `src/lib/firebase/authErrors.ts`, so it can be unit-tested without Firebase.
- Remove the DEV `previewUser()` bypass whenever Firebase is configured. Keep it only as a fallback when `import.meta.env.DEV && !isFirebaseConfigured()`, so local demos without env vars still work. `canReport` stays unchanged.
- Extend `UserIdentity` with optional `email?` and `photoURL?`. Avatar visuals stay identical to main: same 36px round image, border, placement and `hidden lg:flex` wrapper. Only the wrapper becomes a `<button>`, plus a small dropdown in the same style as the existing calendar popover.

## 4. Implementation plan

- [ ] 1. Add the error-message mapper and its tests.
      Create `authErrorMessage(cause: unknown): string`, which reads `(cause as {code?}).code`. Mappings:
      - `auth/popup-closed-by-user` / `auth/cancelled-popup-request` → "Login dibatalkan. Silakan coba lagi."
      - `auth/popup-blocked` → "Popup diblokir browser. Mengalihkan ke halaman login Google…"
      - `auth/operation-not-allowed` → "Login Google belum diaktifkan di Firebase Console (Authentication → Sign-in method → Google)."
      - `auth/unauthorized-domain` → `Domain ${location.hostname} belum diizinkan. Tambahkan di Firebase Console → Authentication → Settings → Authorized domains.` (guard `typeof location`)
      - `auth/network-request-failed` → "Koneksi gagal. Periksa internet Anda lalu coba lagi."
      - `auth/too-many-requests` → "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
      - `auth/user-disabled` → "Akun ini dinonaktifkan."
      - `auth/account-exists-with-different-credential` → "Email ini sudah terdaftar dengan metode login lain."
      - `auth/invalid-api-key` / `auth/api-key-not-valid.-please-pass-a-valid-api-key.` → "Konfigurasi Firebase tidak valid (API key)."
      - `auth/configuration-not-found` / `auth/auth-domain-config-required` → "Konfigurasi Firebase Auth belum lengkap."
      - `auth/internal-error` → "Terjadi kesalahan pada layanan login. Silakan coba lagi."
      - any other code → `Login Google belum berhasil (${code}). Silakan coba lagi.`
      - no code: if it's an Error, use its message; otherwise "Login belum berhasil. Silakan coba lagi."

      Also export `REDIRECT_FALLBACK_CODES = new Set(['auth/popup-blocked','auth/cancelled-popup-request','auth/operation-not-supported-in-environment'])`.
      Files: src/lib/firebase/authErrors.ts (new), tests/authErrors.test.ts (new, node:test + assert/strict like tests/reportIntent.test.ts; cover operation-not-allowed, unauthorized-domain, popup-closed, unknown code includes the code, plain Error message).
      Verify: `npx tsx --test tests/authErrors.test.ts` passes; `npm run lint` is clean.

- [ ] 2. Extend the auth service (depends on 1).
      - In src/domain/intelligence.ts add optional `email?: string; photoURL?: string;` to `UserIdentity`.
      - In src/lib/firebase/auth.ts add a `toIdentity(u: User)` helper used by `ensureUser`, `watchUser` and the login functions. It maps uid, isAnonymous, `displayName ?? undefined`, `email ?? undefined`, `photoURL ?? undefined`, isMock false.
      - Rewrite `loginWithGoogle(): Promise<UserIdentity | 'redirect'>`. It builds `new GoogleAuthProvider()` with `setCustomParameters({ prompt: 'select_account' })` and sets `auth.languageCode = 'id'`. If `isMobileBrowser()` it calls `signInWithRedirect` and returns 'redirect'. Otherwise it tries `signInWithPopup`; on a code in `REDIRECT_FALLBACK_CODES` it calls `signInWithRedirect` and returns 'redirect'; on any other error it rethrows.
      - Add `completeRedirectLogin(): Promise<UserIdentity | null>`, which wraps `getRedirectResult(auth)` and returns null when there is no auth or no result. It rethrows errors so the caller can show them.
      - Add `logout(): Promise<void>`, which calls `signOut(auth)` when auth exists. `watchUser` then emits `mockUser()`.
      - Add `isMobileBrowser()` (SSR-guarded).
      - Keep the throw for missing config.
      Files: src/domain/intelligence.ts, src/lib/firebase/auth.ts
      Verify: `npm run lint` is clean; `npx tsx --test tests/*.test.ts` passes.

- [ ] 3. Update LoginModal (depends on 1, 2). Keep main's markup and classes exactly.
      - Add prop `reason?: 'report' | 'account'` (default 'report'). For 'account', the title becomes "Masuk ke DisasterWatch" and the description "Gunakan akun Google untuk melaporkan bencana dan menyimpan laporan Anda."
      - In `handleLogin`, replace the DEV bypass with `if (import.meta.env.DEV && !isFirebaseConfigured()) { onSuccess(previewUser()); return; }`. Otherwise call `loginWithGoogle()`. On `'redirect'`, keep busy and show "Mengalihkan ke Google…". Otherwise call `onSuccess(user)`. On error call `setError(authErrorMessage(cause))`, and log `console.warn('[auth] Google login failed', code)` with the code only.
      - Add optional prop `initialError?: string` so App can show redirect-result errors.
      Files: src/components/LoginModal.tsx
      Verify: `npm run lint` and `npm run build` succeed.

- [ ] 4. Make the Header avatar interactive (depends on 2). Keep visuals.
      - New props: `user: UserIdentity`, `onLogin: () => void`, `onLogout: () => void`.
      - Signed in means `!user.isAnonymous && !user.isMock`.
      - Wrap the existing `<img>` in `<button type="button">` inside the existing `hidden lg:flex ... border-l` div, with `aria-haspopup="menu"`, `aria-expanded`, and `aria-label` = "Masuk dengan Google" when signed out or "Akun {name}" when signed in.
      - Signed out: keep the current placeholder image and alt; click calls `onLogin()`.
      - Signed in: `src={user.photoURL || <current placeholder>}`, `alt={user.displayName || 'Akun pengguna'}`, `referrerPolicy="no-referrer"` (Google photo URLs need it). Click toggles a dropdown positioned `absolute right-0 mt-2` with the same classes as the calendar popover (`bg-white dark:bg-[#0b1329] rounded-2xl shadow-2xl border ... p-4 z-50 text-xs`). It shows the name, the email, and a "Keluar" `role="menuitem"` button that calls `onLogout()` and closes the menu. Close on outside click and Escape.
      - The "Laporkan Bencana" button stays unchanged.
      Files: src/components/Header.tsx
      Verify: `npm run lint` is clean (App still compiles after step 5; do steps 4 and 5 together if tsc requires it).

- [ ] 5. Wire App (depends on 2–4).
      - Add `const [loginReason, setLoginReason] = useState<'report'|'account'>('report')` and `const [loginError, setLoginError] = useState('')`.
      - `handleReportDisaster`: when not allowed, set reason 'report', set `sessionStorage['dw:postLoginIntent']='report'`, and open the modal.
      - The `onRequireLogin` passed to AIHelpdeskPanel also uses reason 'report'.
      - New `handleAvatarLogin`: set reason 'account', set the sessionStorage intent to 'account', and open the modal.
      - `handleLogout`: `await logout()`, then close the AI report flow if it was in a report workflow (`setIsAIOpen(false)`).
      - LoginModal `onSuccess(user)`: `setCurrentUser(user)`, close the modal, clear the sessionStorage intent, and call `if (loginReason === 'report' && !isAIOpen) openReportForm()`. Keep the existing AIHelpdesk resume behaviour, which reacts to `user` changes.
      - In the existing mount `useEffect` call `completeRedirectLogin()`. On a user: `setCurrentUser(u)`, and if `sessionStorage` intent === 'report' call `openReportForm()`, then clear the intent. On an error: `setLoginError(authErrorMessage(e))`, re-open the modal with the stored reason, then clear the intent.
      - Pass `user={currentUser} onLogin={handleAvatarLogin} onLogout={handleLogout}` to `<Header>`, and `reason={loginReason} initialError={loginError}` to `<LoginModal>`. Reset `loginError` on close.
      Files: src/App.tsx
      Verify: `npm run lint` and `npm run build` succeed; `npx tsx --test tests/*.test.ts` passes.

- [ ] 6. Enable real Firebase on localhost (medium risk: gitignored local file, public client config).
      - Add the 7 `VITE_FIREBASE_*` keys listed in .env.example to `/Users/960302/Downloads/DisasterWatch/.env`.
      - Get the values from the deployed web-client config: the `VITE_FIREBASE_*` literals in the production bundle `https://disasterwatch-61ed5.web.app/assets/index-*.js`, which is the same public config as Firebase Console → Project settings → Web app.
      - Do it with a script that writes straight into .env without echoing values. Leave existing keys untouched. Do not touch .env.example (already lists the keys).
      - Vite restarts itself when .env changes. Do NOT restart it manually.
      Files: .env (gitignored; never committed or printed)
      Verify: `curl -s http://localhost:3000/src/lib/firebase/config.ts | grep -c VITE_FIREBASE_PROJECT_ID` shows the key in the injected `import.meta.env` (print key names only). If the server did not pick up the env, tell the user a manual dev-server restart is needed instead of restarting it.

- [ ] 7. Runtime verification against the running servers (headless Brave via CDP, temp profile, real `Input.dispatchMouseEvent` clicks; kill the browser and delete the temp profile/scripts afterwards).
      On http://localhost:3000 at 1440×900:
      - (a) The header "Laporkan Bencana" opens LoginModal with the title "Masuk untuk laporkan bencana".
      - (b) The avatar button opens LoginModal with "Masuk ke DisasterWatch".
      - (c) A gesture-click on Google opens a popup to `disasterwatch-61ed5.firebaseapp.com/__/auth/handler`. Until the console item 2.1 is done, the modal must show the Indonesian `auth/operation-not-allowed` message. That proves error mapping and the real Firebase path.
      - (d) Without a gesture (JS `.click()`), the popup-blocked fallback calls `signInWithRedirect` and the page navigates to the auth handler.
      - (e) The visuals of the header, avatar and modal match main (take a screenshot and compare against the current layout).
      A full successful sign-in requires a real Google account in a non-headless browser after the console fixes. State this as unverified unless the user confirms it.
      Files: none (temp files under /tmp, removed afterwards)
      Verify: all of (a)–(e) observed; `npm run lint`, `npm run build` and `npx tsx --test tests/*.test.ts` all green.

## 5. Gaps / assumptions

- Successful Google sign-in can't be proven until the user enables the Google provider (2.1). Until then, the expected visible result is the clear Indonesian `auth/operation-not-allowed` message instead of the generic one.
- The avatar stays `hidden lg:flex` (main's design), so on narrow screens login is reachable only through "Laporkan Bencana". This is intentional to preserve the layout.
- The mobile redirect flow uses authDomain `firebaseapp.com` from a different origin. Browsers that partition third-party storage (Safari, Firefox strict) can lose the redirect result. If the user reports this, the follow-up is to serve auth from the hosting domain: authDomain `disasterwatch-61ed5.web.app` plus the redirect URI `https://disasterwatch-61ed5.web.app/__/auth/handler` in the Google Cloud OAuth client. That is a console change, not in scope now.
