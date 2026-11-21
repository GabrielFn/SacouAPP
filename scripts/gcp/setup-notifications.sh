#!/usr/bin/env bash
# Setup of the push notifications in the sacou-api project (E3.11 part 2, ADR 0069, D10 to D12).
# Run in Cloud Shell, after setup-sacou-api.sh and after both services were deployed once (it reads their URLs).
# It holds names only: the two Expo secrets are created empty, and the owner adds the access token by hand.
# Safe to run again: each resource is created only when describe does not find it, and IAM bindings are idempotent.
set -euo pipefail

PROJECT_ID="sacou-api"
REGION="us-east4"
SERVICES=("sacou-api-test" "sacou-api")
RUNNERS=("sacou-api-test-run" "sacou-api-run")
# One calling account per environment: the test queue and sweep can never call production.
INVOKERS=("sacou-tasks-invoker-test" "sacou-tasks-invoker")
QUEUES=("sacou-notifications-test" "sacou-notifications")
SECRETS=("sacou-expo-access-token-test" "sacou-expo-access-token-prod")
SWEEPS=("sacou-notifications-sweep-test" "sacou-notifications-sweep")
# Once a day, before the day's rounds: catches what a crash left (ADR 0069, D10). Free tier: 3 jobs per account.
SWEEP_SCHEDULE="0 4 * * *"
SWEEP_TIME_ZONE="America/Sao_Paulo"
PUMP_PATH="/internal/notifications/pump"

sa_email() { echo "$1@${PROJECT_ID}.iam.gserviceaccount.com"; }

# exists <gcloud describe arguments...>: true when the resource is already there.
exists() { gcloud "$@" >/dev/null 2>&1; }

gcloud config set project "$PROJECT_ID"

echo "== APIs"
gcloud services enable cloudtasks.googleapis.com cloudscheduler.googleapis.com

for index in 0 1; do
  service="${SERVICES[$index]}"
  runner="$(sa_email "${RUNNERS[$index]}")"
  invoker_name="${INVOKERS[$index]}"
  invoker="$(sa_email "$invoker_name")"
  queue="${QUEUES[$index]}"
  secret="${SECRETS[$index]}"
  sweep="${SWEEPS[$index]}"
  url="$(gcloud run services describe "$service" --region="$REGION" --format='value(status.url)')"

  echo "== ${invoker_name}: the account whose OIDC token the ${service} queue and sweep send (no key, no project role)"
  if ! exists iam service-accounts describe "$invoker"; then
    gcloud iam service-accounts create "$invoker_name" --display-name="Calls the internal pump route of ${service}"
  fi

  echo "== Queue ${queue}: one call per second at most, three tries"
  if ! exists tasks queues describe "$queue" --location="$REGION"; then
    gcloud tasks queues create "$queue" --location="$REGION" --max-attempts=3 --max-dispatches-per-second=1
  fi

  echo "== ${runner} queues tasks on ${queue} only, as ${invoker_name} only"
  gcloud tasks queues add-iam-policy-binding "$queue" --location="$REGION" \
    --member="serviceAccount:${runner}" --role=roles/cloudtasks.enqueuer
  gcloud iam service-accounts add-iam-policy-binding "$invoker" \
    --member="serviceAccount:${runner}" --role=roles/iam.serviceAccountUser

  echo "== ${invoker_name} may invoke ${service} only (the service is public today; this holds if it ever is not)"
  gcloud run services add-iam-policy-binding "$service" --region="$REGION" \
    --member="serviceAccount:${invoker}" --role=roles/run.invoker

  echo "== Secret ${secret} (empty; only ${runner} reads it)"
  if ! exists secrets describe "$secret"; then
    gcloud secrets create "$secret" --replication-policy=user-managed --locations="$REGION"
  fi
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${runner}" --role=roles/secretmanager.secretAccessor

  echo "== Daily sweep ${sweep}"
  if ! exists scheduler jobs describe "$sweep" --location="$REGION"; then
    gcloud scheduler jobs create http "$sweep" --location="$REGION" \
      --schedule="$SWEEP_SCHEDULE" --time-zone="$SWEEP_TIME_ZONE" \
      --uri="${url}${PUMP_PATH}" --http-method=POST \
      --oidc-service-account-email="$invoker" --oidc-token-audience="$url"
  fi

  echo "   ${service}: ServiceCaller__Audience = NotificationTasks__ServiceUrl = ${url}"
  echo "   ${service}: ServiceCaller__Email = NotificationTasks__InvokerEmail = ${invoker}"
done

echo "== Done. Add the Expo access token (expo.dev, push security on) as a version of each secret, by hand."
echo "   The API refuses to start when the two sides of a line above differ."
