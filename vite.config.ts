import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { createAdminApi } from './server/admin';
import {createFirmsProxy} from './server/firmsProxy';
import { createAiProxy } from './server/aiProxy';
export default defineConfig(({mode}) => {
  // Server-only secrets (no VITE_ prefix) — never bundled into client code.
  const env = loadEnv(mode, process.cwd(), '');
  const firmsKey = env.NASA_FIRMS_MAP_KEY || '';
  const geminiKey = env.GEMINI_API_KEY || env.GEMINI_DIRECT_API_KEY || env.DISASTERWATCH_GEMINI_SEARCH_KEY || '';
  return {
    // Exact allowlist: dynamically reading import.meta.env must not inline arbitrary VITE secrets.
    envPrefix: ['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_FIREBASE_STORAGE_BUCKET','VITE_FIREBASE_MESSAGING_SENDER_ID','VITE_FIREBASE_MEASUREMENT_ID','VITE_FIREBASE_APPCHECK_SITE_KEY','VITE_GOOGLE_MAPS_API_KEY','VITE_GEMINI_MODEL','VITE_GEMINI_FALLBACK_MODELS'],
    build: {sourcemap:false},
    plugins: [react(), tailwindcss(), {
      name: 'disasterwatch-admin-api',
      configureServer(server) {
        server.middlewares.use('/api/admin', createAdminApi({
          demo: env.ADMIN_DEMO_MODE === 'true', password: env.ADMIN_PASSWORD,
        }));
        // Gemini direct-key proxy: key stays server-side, never in the bundle.
        server.middlewares.use('/api/ai', createAiProxy({ key: geminiKey }));
        server.middlewares.use('/api/firms', createFirmsProxy({key:firmsKey}));
      },
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        // Dev proxy: /api/firms/{SOURCE}/{AREA}/{DAYS} → FIRMS area API with MAP_KEY injected server-side.
        // Production needs an equivalent backend proxy (e.g. Firebase Function).
        // Dev proxy for BMKG nowcast RSS + CAP XML (same-origin → no browser CORS issues).
        '/api/bmkg': {
          target: 'https://www.bmkg.go.id',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/bmkg/, ''),
        },
        // Dev proxy for Darwin VAAC volcanic-ash advisories (BOM). BOM returns 403 when an
        // Origin header is present, so strip it server-side.
        '/api/vaac': {
          target: 'https://www.bom.gov.au',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/vaac/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              req.removeHeader('origin');
              req.removeHeader('referer');
              req.setHeader('user-agent', 'Mozilla/5.0 (DisasterWatch dev proxy)');
            });
          },
        },

      },
    },
  };
});
