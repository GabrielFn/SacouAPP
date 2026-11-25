#!/usr/bin/env bash
# Setup of the daily database backups in the sacou-api project (E5.3 part 1, ADR 0082). Run in Cloud Shell, from the
# repository root, after setup-sacou-api.sh, and only after both read-only URL secrets have a version (roteiro in
# docs/operacao/backup.md). It holds names only: it never reads, prints or creates a secret value.
#   SACOU_ALERT_EMAIL=<e-mail> bash scripts/gcp/setup-backups.sh
# SACOU_ALERT_EMAIL is where the failure alert goes; it stays in the shell, never in the repository. Without it, the
# alert is skipped with a warning.
# Safe to run again: each resource is created only when describe does not find it, IAM bindings are idempotent, and
# the jobs and the workflow are replaced by the versions in the repository.
set -euo pipefail

PROJECT_ID="sacou-api"
REGION="us-east4"
# The only regions of the Cloud Storage free tier (5 GB-month Standard); the data stay in the US (answer 91).
BUCKET_REGION="us-east1"
# The Postgres 18 client tools, by digest (the same in BackupTools.cs of the integration tests: test:tooling compares).
IMAGE="docker.io/library/postgres:18.6-alpine@sha256:9ba53c7d41ea093baf5c1ba635ba5434c4f979880527d49bb7d9237d3193085b"
ENVIRONMENTS=("test" "production")
JOBS=("sacou-backup-test" "sacou-backup")
RUNNERS=("sacou-backup-test-run" "sacou-backup-run")
SECRETS=("sacou-backup-database-url-test" "sacou-backup-database-url-prod")
BUCKETS=("sacou-api-backups-test" "sacou-api-backups-prod")
# Nobody deletes or replaces a backup before 30 days (question 195); the lifecycle rule deletes it at 31.
RETENTION="30d"
TRIGGER="sacou-backup-trigger"
WORKFLOW="sacou-backups"
SCHEDULE_JOB="sacou-backups-daily"
# 04:00 in Brasília, every day.
SCHEDULE="0 4 * * *"
SCHEDULE_TIME_ZONE="America/Sao_Paulo"
ALERT_POLICY_NAME="Sacou backup missing"
ALERT_CHANNEL_NAME="Sacou backups"

BACKUP_SCRIPT_FILE="scripts/backup/backup.sh"
JOB_TEMPLATE="deploy/backup/job.yaml"
WORKFLOW_SOURCE="deploy/backup/workflow.yaml"
LIFECYCLE_FILE="deploy/backup/lifecycle.json"
ALERT_POLICY_FILE="deploy/backup/alert-policy.json"

sa_email() { echo "$1@${PROJECT_ID}.iam.gserviceaccount.com"; }

# exists <gcloud describe arguments...>: true when the resource is already there.
exists() { gcloud "$@" >/dev/null 2>&1; }

# render_job <job> <environment> <runner> <secret> <bucket>: the job's YAML with backup.sh in the block of
# ${BACKUP_SCRIPT}, every line after the first indented like the placeholder (taken from the template itself).
render_job() {
  local indent
  indent="$(sed -n 's/^\( *\)\${BACKUP_SCRIPT}$/\1/p' "$JOB_TEMPLATE")"
  [ -n "$indent" ] || { echo "No \${BACKUP_SCRIPT} line in ${JOB_TEMPLATE}" >&2; exit 1; }
  JOB_NAME="$1" BACKUP_ENVIRONMENT="$2" RUNTIME_ACCOUNT="$3" DATABASE_SECRET="$4" BUCKET="$5" IMAGE="$IMAGE" \
    BACKUP_SCRIPT="$(sed "2,\$s/^/${indent}/" "$BACKUP_SCRIPT_FILE")" \
    envsubst '${JOB_NAME} ${BACKUP_ENVIRONMENT} ${RUNTIME_ACCOUNT} ${DATABASE_SECRET} ${BUCKET} ${IMAGE} ${BACKUP_SCRIPT}' \
    <"$JOB_TEMPLATE"
}

for file in "$BACKUP_SCRIPT_FILE" "$JOB_TEMPLATE" "$WORKFLOW_SOURCE" "$LIFECYCLE_FILE" "$ALERT_POLICY_FILE"; do
  [ -f "$file" ] || { echo "Run from the repository root: ${file} not found" >&2; exit 1; }
done

gcloud config set project "$PROJECT_ID"

echo "== APIs"
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com workflows.googleapis.com \
  storage.googleapis.com monitoring.googleapis.com

echo "== Both read-only URL secrets need a version first (docs/operacao/backup.md, step 2)"
for secret in "${SECRETS[@]}"; do
  if ! exists secrets versions describe latest --secret="$secret"; then
    echo "Secret ${secret} has no version. Create it with --data-file=- (roteiro) and run again." >&2
    exit 1
  fi
done

trigger="$(sa_email "$TRIGGER")"
echo "== ${TRIGGER}: starts the workflow and the two jobs; reads no secret and no bucket"
if ! exists iam service-accounts describe "$trigger"; then
  gcloud iam service-accounts create "$TRIGGER" --display-name="Starts the daily backup jobs"
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

for index in 0 1; do
  environment="${ENVIRONMENTS[$index]}"
  job="${JOBS[$index]}"
  runner_name="${RUNNERS[$index]}"
  runner="$(sa_email "$runner_name")"
  secret="${SECRETS[$index]}"
  bucket="${BUCKETS[$index]}"

  echo "== Bucket ${bucket}: ${BUCKET_REGION}, uniform access, no public access, ${RETENTION} retention, no versioning, no soft delete"
  if ! exists storage buckets describe "gs://${bucket}"; then
    gcloud storage buckets create "gs://${bucket}" --location="$BUCKET_REGION" --default-storage-class=STANDARD \
      --uniform-bucket-level-access --public-access-prevention --retention-period="$RETENTION" --soft-delete-duration=0
  fi
  # Also on a bucket that already exists: running again restores every protection, whoever changed it.
  gcloud storage buckets update "gs://${bucket}" --uniform-bucket-level-access --public-access-prevention \
    --retention-period="$RETENTION" --soft-delete-duration=0 --no-versioning --lifecycle-file="$LIFECYCLE_FILE"

  echo "== ${runner_name}: runs ${job}; reads ${secret} only, writes ${bucket} only"
  if ! exists iam service-accounts describe "$runner"; then
    gcloud iam service-accounts create "$runner_name" --display-name="Runs the ${environment} database backup"
  fi
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${runner}" --role=roles/secretmanager.secretAccessor
  # The volume mount lists and reads what it writes (R1); the retention policy keeps it from deleting or replacing.
  gcloud storage buckets add-iam-policy-binding "gs://${bucket}" \
    --member="serviceAccount:${runner}" --role=roles/storage.objectUser

  echo "== Job ${job}"
  render_job "$job" "$environment" "$runner" "$secret" "$bucket" >"$work/${job}.yaml"
  gcloud run jobs replace "$work/${job}.yaml" --region="$REGION"

  echo "== ${TRIGGER} may start ${job} only"
  gcloud run jobs add-iam-policy-binding "$job" --region="$REGION" \
    --member="serviceAccount:${trigger}" --role=roles/run.invoker
done

echo "== Workflow ${WORKFLOW} (runs as ${TRIGGER})"
gcloud workflows deploy "$WORKFLOW" --location="$REGION" --source="$WORKFLOW_SOURCE" --service-account="$trigger"
# Workflows has no role on a single workflow; this is the only workflow of the project, and the role only starts one.
gcloud projects add-iam-policy-binding "$PROJECT_ID" --condition=None \
  --member="serviceAccount:${trigger}" --role=roles/workflows.invoker

echo "== Daily schedule ${SCHEDULE_JOB}"
if ! exists scheduler jobs describe "$SCHEDULE_JOB" --location="$REGION"; then
  gcloud scheduler jobs create http "$SCHEDULE_JOB" --location="$REGION" \
    --schedule="$SCHEDULE" --time-zone="$SCHEDULE_TIME_ZONE" \
    --uri="https://workflowexecutions.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/workflows/${WORKFLOW}/executions" \
    --http-method=POST --message-body='{}' --oauth-service-account-email="$trigger"
fi

echo "== Alert by e-mail when no backup job succeeded in 26 h (one condition: ADR 0082, D7)"
if [ -z "${SACOU_ALERT_EMAIL:-}" ]; then
  echo "   SACOU_ALERT_EMAIL is not set: no alert. Run again with it."
else
  channel="$(gcloud beta monitoring channels list --filter="displayName=\"${ALERT_CHANNEL_NAME}\"" --format='value(name)' | head -n 1)"
  if [ -z "$channel" ]; then
    channel="$(gcloud beta monitoring channels create --display-name="$ALERT_CHANNEL_NAME" --type=email \
      --channel-labels="email_address=${SACOU_ALERT_EMAIL}" --format='value(name)')"
  fi
  # The policy of the repository with the channel in it, so an update keeps the channel.
  jq --arg channel "$channel" '. + {notificationChannels: [$channel]}' "$ALERT_POLICY_FILE" >"$work/alert-policy.json"
  policy="$(gcloud alpha monitoring policies list --filter="displayName=\"${ALERT_POLICY_NAME}\"" --format='value(name)' | head -n 1)"
  if [ -z "$policy" ]; then
    gcloud alpha monitoring policies create --policy-from-file="$work/alert-policy.json"
  else
    # Running again replaces the condition and the channel with the ones of the repository.
    gcloud alpha monitoring policies update "$policy" --policy-from-file="$work/alert-policy.json"
  fi
fi

echo "== Done. Next: Cloud Run > Jobs > ${JOBS[0]} > Execute, then see the .dump and .manifest.json in gs://${BUCKETS[0]}."
