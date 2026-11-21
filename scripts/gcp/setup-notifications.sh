#!/usr/bin/env bash
# One-time setup of the push notifications in the sacou-api project (E3.11 part 2, ADR 0069, D10 to D12).
# Run in Cloud Shell, after setup-sacou-api.sh and after both services were deployed once (it reads their URLs).
# It holds names only: the two Expo secrets are created empty, and the owner adds the access token by hand.
set -euo pipefail

PROJECT_ID="sacou-api"
REGION="us-east4"
INVOKER="sacou-tasks-invoker"
SERVICES=("sacou-api-test" "sacou-api")
RUNNERS=("sacou-api-test-run" "sacou-api-run")
QUEUES=("sacou-notifications-test" "sacou-notifications")
SECRETS=("sacou-expo-access-token-test" "sacou-expo-access-token-prod")
SWEEPS=("sacou-notifications-sweep-test" "sacou-notifications-sweep")
# Once a day, before the day's rounds: catches what a crash left (ADR 0069, D10). Free tier: 3 jobs per account.
SWEEP_SCHEDULE="0 4 * * *"
SWEEP_TIME_ZONE="America/Sao_Paulo"
PUMP_PATH="/internal/notifications/pump"

sa_email() { echo "$1@${PROJECT_ID}.iam.gserviceaccount.com"; }

gcloud config set project "$PROJECT_ID"

echo "== APIs"
gcloud services enable cloudtasks.googleapis.com cloudscheduler.googleapis.com

echo "== The account whose OIDC token Cloud Tasks and Cloud Scheduler send (no key, no project role)"
gcloud iam service-accounts create "$INVOKER" --display-name="Calls the internal pump route"

for index in 0 1; do
  service="${SERVICES[$index]}"
  runner="$(sa_email "${RUNNERS[$index]}")"
  queue="${QUEUES[$index]}"
  url="$(gcloud run services describe "$service" --region="$REGION" --format='value(status.url)')"

  echo "== Queue ${queue}: one call per second at most, three tries"
  gcloud tasks queues create "$queue" --location="$REGION" --max-attempts=3 --max-dispatches-per-second=1

  echo "== ${runner} queues tasks on ${queue} only, as ${INVOKER}"
  gcloud tasks queues add-iam-policy-binding "$queue" --location="$REGION" \
    --member="serviceAccount:${runner}" --role=roles/cloudtasks.enqueuer
  gcloud iam service-accounts add-iam-policy-binding "$(sa_email "$INVOKER")" \
    --member="serviceAccount:${runner}" --role=roles/iam.serviceAccountUser

  echo "== ${INVOKER} may invoke ${service} (the service is public today; this holds if it ever is not)"
  gcloud run services add-iam-policy-binding "$service" --region="$REGION" \
    --member="serviceAccount:$(sa_email "$INVOKER")" --role=roles/run.invoker

  echo "== Secret ${SECRETS[$index]} (empty; only ${runner} reads it)"
  gcloud secrets create "${SECRETS[$index]}" --replication-policy=user-managed --locations="$REGION"
  gcloud secrets add-iam-policy-binding "${SECRETS[$index]}" \
    --member="serviceAccount:${runner}" --role=roles/secretmanager.secretAccessor

  echo "== Daily sweep ${SWEEPS[$index]}"
  gcloud scheduler jobs create http "${SWEEPS[$index]}" --location="$REGION" \
    --schedule="$SWEEP_SCHEDULE" --time-zone="$SWEEP_TIME_ZONE" \
    --uri="${url}${PUMP_PATH}" --http-method=POST \
    --oidc-service-account-email="$(sa_email "$INVOKER")" --oidc-token-audience="$url"

  echo "   ServiceCaller__Audience and NotificationTasks__ServiceUrl of ${service}: ${url}"
done

echo "== Done. Add the Expo access token (expo.dev, push security on) as a version of each secret, by hand."
echo "   ServiceCaller__Email and NotificationTasks__InvokerEmail: $(sa_email "$INVOKER")"
