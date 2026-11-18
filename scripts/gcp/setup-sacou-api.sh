#!/usr/bin/env bash
# One-time setup of the sacou-api Google Cloud project (E5.1, ADR 0068).
# Run in Cloud Shell. It holds names only: no secret value ever goes through this script.
# The two secrets are created empty; the owner adds the Neon URLs by hand in Secret Manager.
set -euo pipefail

PROJECT_ID="sacou-api"
REGION="us-east4"
GITHUB_REPO="GabrielFn/SacouAPP"
GITHUB_REPO_ID="1440184485"
ARTIFACT_REPO="sacou"
KEEP_IMAGES=5
DEPLOYER="sacou-deployer"
RUNNERS=("sacou-api-test-run" "sacou-api-run")
SECRETS=("sacou-database-url-test" "sacou-database-url-prod")
POOL="github"
PROVIDER="sacouapp"

sa_email() { echo "$1@${PROJECT_ID}.iam.gserviceaccount.com"; }

gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

echo "== APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

echo "== Artifact Registry (keeps the ${KEEP_IMAGES} newest images; scanning stays off)"
gcloud artifacts repositories create "$ARTIFACT_REPO" --repository-format=docker --location="$REGION" \
  --description="Sacou API images"
POLICY_FILE="$(mktemp)"
cat > "$POLICY_FILE" <<JSON
[
  {"name": "keep-newest", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": ${KEEP_IMAGES}}},
  {"name": "delete-the-rest", "action": {"type": "Delete"}, "condition": {"tagState": "any"}}
]
JSON
gcloud artifacts repositories set-cleanup-policies "$ARTIFACT_REPO" --location="$REGION" \
  --policy="$POLICY_FILE" --no-dry-run
rm -f "$POLICY_FILE"

echo "== Service accounts"
gcloud iam service-accounts create "$DEPLOYER" --display-name="GitHub Actions deployer"
for runner in "${RUNNERS[@]}"; do
  gcloud iam service-accounts create "$runner" --display-name="Runtime of ${runner%-run}"
done

echo "== Deployer roles (no run.admin: public access is turned on once in the console)"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$(sa_email "$DEPLOYER")" \
  --role=roles/run.developer --condition=None
gcloud artifacts repositories add-iam-policy-binding "$ARTIFACT_REPO" --location="$REGION" \
  --member="serviceAccount:$(sa_email "$DEPLOYER")" --role=roles/artifactregistry.writer
for runner in "${RUNNERS[@]}"; do
  gcloud iam service-accounts add-iam-policy-binding "$(sa_email "$runner")" \
    --member="serviceAccount:$(sa_email "$DEPLOYER")" --role=roles/iam.serviceAccountUser
done

echo "== Secrets (empty; each runtime reads only its own)"
for index in 0 1; do
  gcloud secrets create "${SECRETS[$index]}" --replication-policy=user-managed --locations="$REGION"
  gcloud secrets add-iam-policy-binding "${SECRETS[$index]}" \
    --member="serviceAccount:$(sa_email "${RUNNERS[$index]}")" --role=roles/secretmanager.secretAccessor
done

echo "== Workload Identity Federation (only this repository, by numeric id, and only main)"
gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location=global \
  --workload-identity-pool="$POOL" --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository_id == '${GITHUB_REPO_ID}' && assertion.ref == 'refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$(sa_email "$DEPLOYER")" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}"

echo
echo "== GitHub repository variables (Settings > Secrets and variables > Actions > Variables; not secrets)"
echo "GCP_PROJECT_ID=${PROJECT_ID}"
echo "GCP_WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "GCP_DEPLOYER_SA=$(sa_email "$DEPLOYER")"
