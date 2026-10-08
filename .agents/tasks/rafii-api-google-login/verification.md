# Verification: rafii-api Google login (iteration 1, PAUSED)

Status: paused. A second agent (Kiro spec `.kiro/specs/google-oauth-login-fix`, tasks 3–4) is rewriting the same files while this step runs. Someone else also committed this step's WIP as `5a6a493` and pushed it to origin/rafii-api. This step made no commit and no push.

## Static checks (run against this step's implementation, before the concurrent rewrite)
- `npm run lint` (tsc --noEmit): PASS
- `npx tsx --test tests/*.test.ts`: PASS, 18/18 (includes the new tests/authErrors.test.ts)
- `npm run build`: PASS. The only warnings were the chunk-size warning and an INEFFECTIVE_DYNAMIC_IMPORT on config.ts; both were already there before this change.
- Re-run at 09:38 WIB, after the other agent's edits: `npm run lint` FAILS. src/App.tsx imports `logout` and `completeRedirectLogin`, but the other agent removed them from auth.ts and renamed them to `signOutUser` and `consumeRedirectResult`. The other agent was still editing App.tsx at that point.

## Env (key names only)
- Before: `.env` had only VITE_GOOGLE_MAPS_API_KEY and NASA_FIRMS_MAP_KEY, so the app ran in mock auth mode.
- Added: VITE_FIREBASE_API_KEY, _AUTH_DOMAIN, _PROJECT_ID, _STORAGE_BUCKET, _MESSAGING_SENDER_ID, _APP_ID, _MEASUREMENT_ID. The values come from the public web config in the deployed bundle. projectId = disasterwatch-61ed5.
- Required by `isFirebaseConfigured()`: API_KEY, AUTH_DOMAIN, PROJECT_ID, APP_ID. VITE_FIREBASE_APPCHECK_KEY and VITE_GEMINI_* have no effect on login.
- Vite picked up the new .env on its own; the served modules now have the VITE_FIREBASE_* keys in `import.meta.env`.

## Code bug found at runtime
`src/lib/firebase/config.ts` `readEnv` used `(import.meta as unknown as …)?.env`, which compiles to `import.meta?.env`. Vite's dev server does not inject env for that form, so localhost was always in mock mode even with the keys set. Fixed by reading `import.meta.env` directly. The same pattern still exists in mapTypes.ts, geminiConfig.ts, ai.ts and googleWeather.ts; those are out of scope and were not changed.

## COOP
No Cross-Origin-Opener-Policy header in vite.config.ts or firebase.json, and none in the localhost:3000 response (`null`). Nothing changed.

## Runtime check (headless Brave via CDP, 1440×900, real Input.dispatchMouseEvent clicks, existing dev server :3000)
- In the page, `isFirebaseConfigured()` returned true after the config.ts fix. Before the fix it returned false, and the DEV preview bypass closed the modal.
- (a) Header "Laporkan Bencana" opens a dialog titled "Masuk untuk laporkan bencana". PASS
- (b) The avatar `button[aria-label="Masuk dengan Google"]` opens a dialog titled "Masuk ke DisasterWatch". PASS. The screenshot showed main's modal styling unchanged.
- (c) Gesture-click on Google opened a popup to `https://disasterwatch-61ed5.firebaseapp.com/__/auth/handler` with authType=signInViaPopup. The modal then showed "Login Google belum diaktifkan di Firebase Console (Authentication → Sign-in method → Google)." The console showed `[auth] Google login failed auth/operation-not-allowed`. PASS: this is the real Firebase path with the mapped error.
- (d) Headless Brave does not enforce the popup blocker, so a JS `.click()` simply opens the popup. A blocked popup was simulated by stubbing `window.open = () => null`. A Document request then went to `…firebaseapp.com/__/auth/handler` with authType=signInViaRedirect. PASS: the fallback calls signInWithRedirect.
- After the redirect came back, `getRedirectResult` resolved null and did not surface an error. The page reloaded twice and no error modal appeared, and the `dw:postLoginIntent` sessionStorage key was left behind. A fix was in progress (clear the intent when the result is null) but is not verified, because the concurrent rewrite replaced that code.
- Not verified: a full successful sign-in. It needs the console fix below plus a real Google account in a non-headless browser.
- The browser was killed and the temp profile, screenshot and scripts were deleted.

## Console-only blocker
Firebase Console → Authentication → Sign-in method → Google → Enable (with a support email). The proof is `auth/operation-not-allowed`, seen above. For LAN access, also add `192.168.0.113` to Authorized domains.
