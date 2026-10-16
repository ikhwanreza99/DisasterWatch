# 🌊 DisasterWatch

**English** · [Bahasa Indonesia](README.id.md)

DisasterWatch is a map-first disaster response dashboard for Indonesia. It brings official hazard feeds (earthquakes, weather, wildfires, volcanoes, volcanic ash) together with incident tracking, aid-gap analysis and an AI helpdesk in one interactive map.

Live: https://disasterwatch-61ed5.web.app

> ⚠️ Disaster incidents, citizen reports and aid figures in the app are **demo / AI-processed data**, not an official BNPB or BMKG feed. Official layers are labelled with their source.

## Features

- **Interactive map**: Google Maps (satellite and vector) with automatic Leaflet/OpenStreetMap fallback. Every popup has a close (✕) button.
- **Incident intelligence**: KPI strip (active incidents, people affected, priority, aid gap, reports to verify), detail view, distribution routes, citizen reports and an AI helpdesk (Firebase AI Logic + Gemini, with a local heuristic fallback).
- **Official data layers**, each with its own map toggle:

| Toggle | Data | Source |
|---|---|---|
| 🌐 BMKG | Latest earthquakes | [BMKG](https://data.bmkg.go.id/gempabumi/) |
| ⛈ CUACA | BMKG weather warnings + current weather for 21 major cities + weather sidebar | BMKG nowcast, Google Weather API |
| 🔥 FIRMS | Satellite fire hotspots, follows the header date range (Today / 24 h / 7 d / 30 d) | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) (VIIRS, MODIS) |
| 🌋 MAGMA | Volcano activity levels (I–IV) and landslide reports, with a legend | [MAGMA Indonesia](https://magma.esdm.go.id/) (PVMBG) |
| 🌫 ABU VULKANIK | Volcanic ash clouds (observed + 6/12/18 h forecast) | [Darwin VAAC](https://www.bom.gov.au/aviation/warnings/volcanic-ash/) (BOM) |

## Tech stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Google Maps (`@vis.gl/react-google-maps`) · Leaflet · Firebase (Firestore, Auth, AI Logic, Hosting) · GitHub Actions

## Getting started

Requirements: Node.js 22+ and npm.

```bash
git clone https://github.com/ikhwanreza99/DisasterWatch.git
cd DisasterWatch
npm install
cp .env.example .env   # then fill in your keys
npm run dev            # http://localhost:3000
```

Without any keys the app still runs: it uses demo data, Leaflet/OSM and local fallbacks.

### Environment variables

| Variable | Used for |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps + Google Weather. Restrict it by HTTP referrer. |
| `VITE_FIREBASE_*` | Firestore, Auth and App Check (optional; demo data is used when empty) |
| `VITE_GEMINI_MODEL` | Gemini model name for Firebase AI Logic (optional; default in `src/lib/firebase/geminiConfig.ts`) |
| `NASA_FIRMS_MAP_KEY` | FIRMS in local dev. Server-side only, injected by the Vite proxy. |
| `VITE_NASA_FIRMS_MAP_KEY` | FIRMS in production (built into the browser bundle) |

A free FIRMS key is available at https://firms.modaps.eosdis.nasa.gov/api/map_key/.

> `VITE_*` values are bundled into public JavaScript. Never put real server secrets in them.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server on port 3000 (with proxies for FIRMS, BMKG and VAAC) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm run seed:firestore` | Seed Firestore with demo data |
| `npx tsx scripts/testBmkgWeather.ts` | BMKG weather-warning parser tests (also `testBmkgForecast.ts`, `testBmkg.ts`) |

## Project structure

```
src/
  components/        UI (MapCanvas, sidebars, modals, map overlays)
  services/
    bmkg/            BMKG earthquakes, weather warnings, forecast
    firms/           NASA FIRMS hotspots
    magma/           MAGMA Indonesia volcanoes + landslides
    vaac/            Darwin VAAC volcanic ash advisories
    weather/         Google Weather (incident + major cities)
    ai/, intelligence/, pipeline/, store/
  lib/firebase/      Firebase setup
scripts/             Seeding and parser tests
.github/workflows/   Firebase Hosting deploy
```

## Deployment

Each push to `main` builds the app and deploys it to Firebase Hosting (`.github/workflows/deploy-hosting.yml`). The same workflow also runs on a schedule (about every 30 minutes) to refresh the volcanic ash snapshot, and can be started manually from the Actions tab. Build-time keys come from GitHub repository secrets with the same names as the `VITE_*` variables above.

### Known limitations

- Firebase Hosting serves static files only, so the dev proxies don't exist in production:
  - **ABU VULKANIK**: BOM blocks direct browser requests, so production uses a snapshot (`/data/vaac.json`). The deploy workflow rebuilds it about every 30 minutes (`scripts/fetchVaacSnapshot.ts`), which means production data can be 30–60 minutes behind. Local dev reads the live page through the proxy.
  - **BMKG weather warnings** show "BROWSER ACCESS BLOCKED", because BMKG also blocks direct browser access.
- **MAGMA** reads data embedded in the public MAGMA map page (the official API requires login). If PVMBG changes that page, the layer shows "N/A" instead of breaking.
- The MAGMA landslide reports provided by the source are older (2022–2023). Their dates are shown in each popup.

## Data sources & attribution

BMKG · NASA FIRMS (LANCE/EOSDIS) · MAGMA Indonesia, PVMBG – Badan Geologi · Darwin VAAC, Australian Bureau of Meteorology · Google Maps Platform · © OpenStreetMap contributors.
Each layer links back to its source. Follow each provider's terms of use.
