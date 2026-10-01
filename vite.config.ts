import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
export default defineConfig(({mode}) => {
  // Server-only secrets (no VITE_ prefix) — never bundled into client code.
  const env = loadEnv(mode, process.cwd(), '');
  const firmsKey = env.NASA_FIRMS_MAP_KEY || '';
  return {
    plugins: [react(), tailwindcss()],
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
        '/api/firms': {
          target: 'https://firms.modaps.eosdis.nasa.gov',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/firms/, `/api/area/csv/${encodeURIComponent(firmsKey)}`),
        },
      },
    },
  };
});
