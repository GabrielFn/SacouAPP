#!/usr/bin/env bash
# Splits the deploy identity of the sacou-api project in three (E5.1, ADR 0068, D3). Run in Cloud Shell, after
# setup-sacou-api.sh. Idempotent: every step checks or adds, so running it again changes nothing.
# It holds names only: no secret value ever goes through this script.
#
# Before: one sacou-deployer, usable by any workflow on main, with run.developer on the whole project.
# After:
#   sacou-builder        -> jobs without an environment (build): artifactregistry.writer on the sacou repository only.
#   sacou-deployer-test  -> jobs in the `test` environment: run.developer on sacou-api-test only,
#                           serviceAccountUser on sacou-api-test-run only.
#   sacou-deployer-prod  -> jobs in the `production` environment (owner's approval): run.developer on sacou-api only,
#                           serviceAccountUser on sacou-api-run only.
# The provider accepts only .github/workflows/deploy-api.yml on main, and each account trusts one OIDC subject.
# The two services are created here, with a public placeholder image, so run.developer can be granted on each
# service instead of the project (a role on a resource that does not exist yet cannot be granted).
set -euo pipefail

PROJECT_ID="sacou-api"
REGION="us-east4"
GITHUB_REPO="GabrielFn/SacouAPP"
GITHUB_REPO_ID="1440184485"
GITHUB_OWNER_ID="5855069"
DEPLOY_WORKFLOW_REF="${GITHUB_REPO}/.github/workflows/deploy-api.yml@refs/heads/main"
ARTIFACT_REPO="sacou"
POOL="github"
PROVIDER="sacouapp"
PLACEHOLDER_IMAGE="us-docker.pkg.dev/cloudrun/container/hello"
OLD_DEPLOYER="sacou-deployer"
BUILDER="sacou-builder"
DEPLOYER_TEST="sacou-deployer-test"
DEPLOYER_PROD="sacou-deployer-prod"
SERVICE_TEST="sacou-api-test"
SERVICE_PROD="sacou-api"
RUNNER_TEST="sacou-api-test-run"
RUNNER_PROD="sacou-api-run"
RUNNERS=("$RUNNER_TEST" "$RUNNER_PROD")

# The repository uses GitHub's immutable OIDC subject (owner and repository with their numeric ids), checked with
# `gh api repos/GabrielFn/SacouAPP/actions/oidc/customization/sub`. A job without an environment carries the ref,
# a job with one carries its name.
SUBJECT_PREFIX="repo:${GITHUB_REPO%%/*}@${GITHUB_OWNER_ID}/${GITHUB_REPO#*/}@${GITHUB_REPO_ID}"
SUBJECT_BUILD="${SUBJECT_PREFIX}:ref:refs/heads/main"
SUBJECT_TEST="${SUBJECT_PREFIX}:environment:test"
SUBJECT_PROD="${SUBJECT_PREFIX}:environment:production"

sa_email() { echo "$1@${PROJECT_ID}.iam.gserviceaccount.com"; }

gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
POOL_PRINCIPAL="principal://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/subject"

ensure_account() {
  local name="$1" display="$2"
  if ! gcloud iam service-accounts describe "$(sa_email "$name")" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$name" --display-name="$display"
  fi
}

# Creates the service once, private (the loop below opens it to allUsers: the API checks its own tokens), running as its own runtime account; the first real deploy replaces the image.
ensure_service() {
  local service="$1" runner="$2"
  if ! gcloud run services describe "$service" --region="$REGION" >/dev/null 2>&1; then
    gcloud run deploy "$service" --image="$PLACEHOLDER_IMAGE" --region="$REGION" \
      --service-account="$(sa_email "$runner")" --min-instances=0 --max-instances=1 \
      --no-allow-unauthenticated --quiet
  fi
}

# One deployer: one service, one runtime account, one OIDC subject.
grant_deployer() {
  local deployer="$1" service="$2" runner="$3" subject="$4"
  gcloud run services add-iam-policy-binding "$service" --region="$REGION" \
    --member="serviceAccount:$(sa_email "$deployer")" --role=roles/run.developer
  gcloud iam service-accounts add-iam-policy-binding "$(sa_email "$runner")" \
    --member="serviceAccount:$(sa_email "$deployer")" --role=roles/iam.serviceAccountUser
  gcloud iam service-accounts add-iam-policy-binding "$(sa_email "$deployer")" --role=roles/iam.workloadIdentityUser \
    --member="${POOL_PRINCIPAL}/${subject}"
}

echo "== Identities"
ensure_account "$BUILDER" "GitHub Actions image builder"
ensure_account "$DEPLOYER_TEST" "GitHub Actions deployer of ${SERVICE_TEST}"
ensure_account "$DEPLOYER_PROD" "GitHub Actions deployer of ${SERVICE_PROD}"

echo "== Services (placeholder image until the first deploy; public, as the console checkbox did)"
ensure_service "$SERVICE_TEST" "$RUNNER_TEST"
ensure_service "$SERVICE_PROD" "$RUNNER_PROD"
for service in "$SERVICE_TEST" "$SERVICE_PROD"; do
  gcloud run services add-iam-policy-binding "$service" --region="$REGION" \
    --member=allUsers --role=roles/run.invoker
done

echo "== Builder: pushes images, nothing else"
gcloud artifacts repositories add-iam-policy-binding "$ARTIFACT_REPO" --location="$REGION" \
  --member="serviceAccount:$(sa_email "$BUILDER")" --role=roles/artifactregistry.writer
gcloud iam service-accounts add-iam-policy-binding "$(sa_email "$BUILDER")" --role=roles/iam.workloadIdentityUser \
  --member="${POOL_PRINCIPAL}/${SUBJECT_BUILD}"

echo "== Deployers: each its own service and runtime account"
grant_deployer "$DEPLOYER_TEST" "$SERVICE_TEST" "$RUNNER_TEST" "$SUBJECT_TEST"
grant_deployer "$DEPLOYER_PROD" "$SERVICE_PROD" "$RUNNER_PROD" "$SUBJECT_PROD"

echo "== Provider: only this repository, only main, only the deploy workflow"
gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" --location=global \
  --workload-identity-pool="$POOL" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref,attribute.workflow_ref=assertion.workflow_ref" \
  --attribute-condition="assertion.repository_id == '${GITHUB_REPO_ID}' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '${DEPLOY_WORKFLOW_REF}'"

echo "== Old ${OLD_DEPLOYER}: its roles removed, then the account deleted"
if gcloud iam service-accounts describe "$(sa_email "$OLD_DEPLOYER")" >/dev/null 2>&1; then
  old_member="serviceAccount:$(sa_email "$OLD_DEPLOYER")"
  # A missing binding makes remove fail; here that only means it is already gone.
  gcloud projects remove-iam-policy-binding "$PROJECT_ID" --member="$old_member" \
    --role=roles/run.developer --condition=None >/dev/null || echo "run.developer already removed"
  gcloud artifacts repositories remove-iam-policy-binding "$ARTIFACT_REPO" --location="$REGION" \
    --member="$old_member" --role=roles/artifactregistry.writer >/dev/null || echo "artifactregistry.writer already removed"
  for runner in "${RUNNERS[@]}"; do
    gcloud iam service-accounts remove-iam-policy-binding "$(sa_email "$runner")" --member="$old_member" \
      --role=roles/iam.serviceAccountUser >/dev/null || echo "serviceAccountUser on ${runner} already removed"
  done
  gcloud iam service-accounts delete "$(sa_email "$OLD_DEPLOYER")" --quiet
fi

echo
echo "== GitHub repository variables (Settings > Secrets and variables > Actions > Variables; not secrets)"
echo "Create: GCP_BUILDER_SA=$(sa_email "$BUILDER")"
echo "Create: GCP_DEPLOYER_TEST_SA=$(sa_email "$DEPLOYER_TEST")"
echo "Create: GCP_DEPLOYER_PROD_SA=$(sa_email "$DEPLOYER_PROD")"
echo "Delete: GCP_DEPLOYER_SA"
