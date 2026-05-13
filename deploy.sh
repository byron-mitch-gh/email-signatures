#!/usr/bin/env bash
# deploy.sh — build and deploy the email signature app to GCP + Firebase
#
# Prerequisites:
#   gcloud CLI authenticated  (gcloud auth login)
#   firebase CLI installed    (npm install -g firebase-tools && firebase login)
#   GCP project created with billing enabled
#
# Required env vars (export before running, or edit the defaults below):
#   GCP_PROJECT_ID   — your GCP project ID
#   SMTP_FROM_EMAIL  — the Gmail address that sends signatures
#   SMTP_PASSWORD    — Gmail App Password (not your Google account password)
#
# Optional:
#   REGION           — Cloud Run region (default: us-central1)
#   GCS_BUCKET_NAME  — photo storage bucket (default: <project-id>-sig-photos)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?Please export GCP_PROJECT_ID}"
REGION="${REGION:-us-central1}"
SERVICE="email-signatures"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"
BUCKET="${GCS_BUCKET_NAME:-${PROJECT_ID}-sig-photos}"

SMTP_FROM="${SMTP_FROM_EMAIL:?Please export SMTP_FROM_EMAIL}"
SMTP_PASS="${SMTP_PASSWORD:?Please export SMTP_PASSWORD}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploying Email Signature Generator"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "  Image   : ${IMAGE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Enable required GCP APIs ───────────────────────────────────────────────
echo ""
echo "▶ Enabling GCP APIs…"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    storage.googleapis.com \
    --project "${PROJECT_ID}"

# ── 2. Store secrets in Secret Manager ────────────────────────────────────────
echo ""
echo "▶ Storing secrets in Secret Manager…"

store_secret() {
    local name=$1
    local value=$2
    if gcloud secrets describe "${name}" --project "${PROJECT_ID}" &>/dev/null; then
        echo "  Updating secret: ${name}"
        printf '%s' "${value}" | gcloud secrets versions add "${name}" \
            --data-file=- --project "${PROJECT_ID}"
    else
        echo "  Creating secret: ${name}"
        printf '%s' "${value}" | gcloud secrets create "${name}" \
            --data-file=- --project "${PROJECT_ID}"
    fi
}

store_secret "smtp-password"   "${SMTP_PASS}"
store_secret "smtp-from-email" "${SMTP_FROM}"

# ── 3. Create GCS bucket for profile photos ───────────────────────────────────
echo ""
echo "▶ Setting up Cloud Storage bucket: ${BUCKET}"
if ! gsutil ls -p "${PROJECT_ID}" "gs://${BUCKET}" &>/dev/null; then
    gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${BUCKET}"
fi
gsutil iam ch allUsers:objectViewer "gs://${BUCKET}"
echo "  Bucket ready: gs://${BUCKET}"

# ── 4. Build and push Docker image ────────────────────────────────────────────
echo ""
echo "▶ Building Docker image with Cloud Build…"
gcloud builds submit ./backend \
    --tag "${IMAGE}" \
    --project "${PROJECT_ID}"

# ── 5. Grant Cloud Run service account access to secrets ──────────────────────
echo ""
echo "▶ Granting secret access to Cloud Run service account…"
SA_EMAIL="${PROJECT_ID}@appspot.gserviceaccount.com"
for secret in smtp-password smtp-from-email; do
    gcloud secrets add-iam-policy-binding "${secret}" \
        --member "serviceAccount:${SA_EMAIL}" \
        --role "roles/secretmanager.secretAccessor" \
        --project "${PROJECT_ID}" \
        --quiet
done

# ── 6. Deploy to Cloud Run ────────────────────────────────────────────────────
echo ""
echo "▶ Deploying to Cloud Run…"
gcloud run deploy "${SERVICE}" \
    --image "${IMAGE}" \
    --platform managed \
    --region "${REGION}" \
    --allow-unauthenticated \
    --set-env-vars "GCS_BUCKET_NAME=${BUCKET}" \
    --set-secrets "SMTP_PASSWORD=smtp-password:latest,SMTP_FROM_EMAIL=smtp-from-email:latest" \
    --project "${PROJECT_ID}"

SERVICE_URL=$(gcloud run services describe "${SERVICE}" \
    --platform managed --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --format "value(status.url)")

echo "  Backend live: ${SERVICE_URL}"

# ── 7. Deploy frontend to Firebase Hosting ────────────────────────────────────
echo ""
echo "▶ Deploying frontend to Firebase Hosting…"
# firebase.json rewrites /api/** → Cloud Run, so no URL hardcoding needed
firebase deploy --only hosting --project "${PROJECT_ID}"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deployment complete!"
echo "  Backend  → ${SERVICE_URL}"
echo "  Frontend → https://${PROJECT_ID}.web.app"
echo ""
echo "  Next: run 'firebase init hosting' if you haven't"
echo "  already, then link it to project ${PROJECT_ID}."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
