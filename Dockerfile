# DisasterWatch API — Cloud Run image.
#
# This image runs ONLY the server-side API (`/api/ai` → Gemini, `/api/firms` →
# NASA FIRMS) so the API keys stay on the server and are never inlined into the
# browser bundle. The static frontend is built and served by Firebase Hosting,
# which rewrites `/api/**` to this service (see firebase.json).
#
# Secrets are injected by Cloud Run at runtime (Secret Manager), never baked in:
#   GEMINI_API_KEY, NASA_FIRMS_MAP_KEY   (see .dockerignore — .env is excluded)
FROM node:22-slim

WORKDIR /app

# Install ALL dependencies: the server is plain TypeScript run with tsx and uses
# firebase-admin, and BOTH are devDependencies. `--include=dev` keeps them.
# The `||` fallback tolerates a lockfile that lags package.json (still no missing
# module at runtime).
COPY package.json package-lock.json* ./
RUN npm ci --include=dev || npm install --include=dev

# Server code plus the src/data modules it imports. No .env, no dist, no secrets.
COPY server ./server
COPY src ./src
COPY tsconfig.json ./

# Runtime-only settings (public API mode, no privileged admin endpoint).
ENV NODE_ENV=production
ENV ENABLE_ADMIN_API=false
EXPOSE 8080

CMD ["npx", "tsx", "server/index.ts"]
