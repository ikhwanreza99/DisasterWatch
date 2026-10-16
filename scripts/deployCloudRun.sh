#!/usr/bin/env bash
# One-time (and repeatable) deploy of the DisasterWatch API proxy to Cloud Run.
#
# Prereqs: gcloud authenticated (gcloud auth login) with a project where you have
# Cloud Run Admin + Secret Manager Admin + Service Usage Admin.
#
#   GEMINI_API_KEY=...      NASA_FIRMS_MAP_KEY=...      ./scripts/deployCloudRun.sh
#
# Keys are stored in Secret Manager and injected at runtime — never baked into
# the image and never shipped to the browser.
set -euo pipefail

PROJECT="${PROJECT:-disasterwatch-61ed5}"
REGION="${REGION:-asia-southeast2}"
SERVICE="${SERVICE:-disasterwatch-api}"
ORIGINS="${ORIGINS:-https://${PROJECT}.web.app,https://${PROJECT}.firebaseapp.com}"

echo "→ Enabling required APIs (${PROJECT})"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com --project "$PROJECT"

ensure_secret() {
  local name="$1" value="${2:-}"
  if gcloud secrets describe "$name" --project "$PROJECT" >/dev/null 2>&1; then
    if [ -n "$value" ]; then
      printf "%s" "$value" | gcloud secrets versions add "$name" --project "$PROJECT" --data-file=- >/dev/null
      echo "  updated secret: $name"
    else
      echo "  secret exists (unchanged): $name"
    fi
  else
    if [ -z "$value" ]; then
      echo "!! secret $name is missing and no value was provided" >&2
      exit 1
    fi
    printf "%s" "$value" | gcloud secrets create "$name" --project "$PROJECT" --data-file=- >/dev/null
    echo "  created secret: $name"
  fi
}

echo "→ Ensuring Secret Manager secrets"
ensure_secret gemini-key "${GEMINI_API_KEY:-}"
ensure_secret firms-key "${NASA_FIRMS_MAP_KEY:-}"

echo "→ Deploying Cloud Run service: $SERVICE ($REGION)"
gcloud run deploy "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --source . \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "ENABLE_ADMIN_API=false,ALLOWED_ORIGINS=${ORIGINS}" \
  --set-secrets "GEMINI_API_KEY=gemini-key:latest,NASA_FIRMS_MAP_KEY=firms-key:latest" \
  --min-instances 0 --max-instances 2 \
  --quiet

URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')
echo "✅ Cloud Run ready: $URL"
echo "   Next: deploy Hosting so /api/** rewrites to this service."
