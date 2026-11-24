#!/bin/sh
# Daily logical backup of the Sacou database and its restore check (E5.3, ADR 0082). POSIX sh: it runs in
# postgres:18.6-alpine, as the Cloud Run Jobs sacou-backup-test and sacou-backup (scripts/gcp/setup-backups.sh
# embeds this file in deploy/backup/job.yaml), in the restore rehearsal of docs/operacao/backup.md and in the CI.
#
#   backup.sh dump
#     SACOU_BACKUP_DATABASE_URL  postgresql://... of the database to copy (read-only role in the Neon)
#     SACOU_BACKUP_ENVIRONMENT   test | production (goes into the manifest)
#     SACOU_BACKUP_DIR           where sacou-<UTC>.dump and sacou-<UTC>.manifest.json land (the bucket's mount)
#   backup.sh restore-check <dump> <manifest>
#     SACOU_RESTORE_DATABASE_URL postgresql://... of an EMPTY database: never restores over tables
#
# The URLs carry a password: they live only in the environment and the tools' arguments, never in a log line or the
# manifest. Never add `set -x`. Every host but localhost and 127.0.0.1 gets sslmode=verify-full against the system CAs,
# whatever sslmode the URL brings. The manifest holds only table names, row counts, migration ids, the size and the
# SHA-256: no row content, so no personal data.
set -eu
umask 077
# A closed pipe fails the write with an error (and the EXIT trap runs), instead of killing the shell quietly.
trap '' PIPE

MANIFEST_FORMAT=1
SNAPSHOT_WAIT_SECONDS=60
SHA256_HEX_LENGTH=64
EXIT_USAGE=2

work=""

fail() {
  printf 'backup: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [ -n "$work" ]; then rm -rf "$work"; fi
}
trap cleanup EXIT

# The password of a postgresql:// URL (empty when it has none), to scrub it from any tool output.
password_of() {
  authority="${1#*://}"
  authority="${authority%%[/?]*}"
  case "$authority" in
    *@*) userinfo="${authority%@*}" ;;
    *) return 0 ;;
  esac
  case "$userinfo" in
    *:*) printf '%s' "${userinfo#*:}" ;;
  esac
}

# Prints a tool's error output without any line that holds the password (read from the environment, never an argument).
print_scrubbed() {
  if [ -s "$1" ]; then
    SCRUB_SECRET="$2" awk 'ENVIRON["SCRUB_SECRET"] == "" || index($0, ENVIRON["SCRUB_SECRET"]) == 0' "$1" >&2
  fi
}

# The URL to connect with: postgres(ql):// only; outside the machine, any sslmode or sslrootcert is replaced by
# sslmode=verify-full&sslrootcert=system (libpq 16+).
secure_url() {
  case "$1" in
    postgresql://* | postgres://*) ;;
    *) fail "$2 must be a postgresql:// URL" ;;
  esac
  authority="${1#*://}"
  authority="${authority%%[/?]*}"
  host="${authority##*@}"
  host="${host%:*}"
  case "$host" in
    localhost | 127.0.0.1)
      printf '%s' "$1"
      return 0
      ;;
  esac
  base="${1%%\?*}"
  query=""
  case "$1" in
    *\?*) query="${1#*\?}" ;;
  esac
  kept=""
  set -f
  old_ifs="$IFS"
  IFS='&'
  for pair in $query; do
    case "$pair" in
      "" | sslmode=* | sslrootcert=*) ;;
      *) kept="${kept}${pair}&" ;;
    esac
  done
  IFS="$old_ifs"
  set +f
  printf '%s?%ssslmode=verify-full&sslrootcert=system' "$base" "$kept"
}

require_env() {
  eval "value=\${$1:-}"
  if [ -z "$value" ]; then fail "$1 is not set"; fi
}

# Rows of every table and the last migration of every module, one `kind|name|value` line each, in a stable order.
state_sql() {
  cat <<'SQL'
SELECT 'migration', table_schema,
  coalesce((xpath('/row/m/text()', query_to_xml(format('SELECT max(%I) AS m FROM %I.%I', 'MigrationId', table_schema, table_name), false, true, '')))[1]::text, '')
FROM information_schema.tables
WHERE table_type = 'BASE TABLE' AND table_name = '__ef_migrations_history'
ORDER BY table_schema COLLATE "C";
SELECT 'rows', table_schema || '.' || table_name,
  (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema COLLATE "C", table_name COLLATE "C";
SQL
}

# The `migrations` and `rows` blocks of the manifest, from the lines of state_sql. The restore check rebuilds the same
# text from the restored database, so the two compare line by line.
state_block() {
  awk -F'|' '
    function quote(text) { gsub(/\\/, "\\\\", text); gsub(/"/, "\\\"", text); return "\"" text "\"" }
    $1 == "migration" { migrations[++migration_count] = "    " quote($2) ": " quote($3) }
    $1 == "rows" {
      if ($3 !~ /^[0-9]+$/) { bad = 1 }
      rows[++row_count] = "    " quote($2) ": " $3
    }
    END {
      if (bad || row_count == 0) { exit 1 }
      print "  \"migrations\": {"
      for (i = 1; i <= migration_count; i++) print migrations[i] (i < migration_count ? "," : "")
      print "  },"
      print "  \"rows\": {"
      for (i = 1; i <= row_count; i++) print rows[i] (i < row_count ? "," : "")
      print "  }"
    }'
}

psql_quiet() {
  psql --no-psqlrc --quiet --tuples-only --no-align --field-separator='|' --set=ON_ERROR_STOP=1 "$@"
}

dump() {
  require_env SACOU_BACKUP_DATABASE_URL
  require_env SACOU_BACKUP_ENVIRONMENT
  require_env SACOU_BACKUP_DIR
  environment="$SACOU_BACKUP_ENVIRONMENT"
  case "$environment" in
    test | production) ;;
    *) fail "SACOU_BACKUP_ENVIRONMENT must be test or production" ;;
  esac
  directory="$SACOU_BACKUP_DIR"
  if [ ! -d "$directory" ] || [ ! -w "$directory" ]; then fail "SACOU_BACKUP_DIR is not a writable directory"; fi
  url="$(secure_url "$SACOU_BACKUP_DATABASE_URL" SACOU_BACKUP_DATABASE_URL)"
  secret="$(password_of "$url")"

  work="$(mktemp -d)"
  started="$(date -u +%s)"
  created="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  name="sacou-$(date -u +%Y%m%dT%H%MZ)"
  echo "backup: ${environment}: dumping into ${name}"

  # One read-only transaction exports its snapshot: the dump and the counts of the manifest see the same rows, even
  # with the API writing meanwhile. The session stays open until pg_dump ends.
  mkfifo "$work/session"
  {
    echo "BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY;"
    echo "\\o $work/snapshot"
    echo "SELECT pg_export_snapshot();"
    echo "\\o $work/state"
    state_sql
    echo "\\o $work/ready"
    echo "SELECT 'ready';"
    echo "\\o"
  } >"$work/commands"
  psql_quiet --dbname="$url" <"$work/session" >/dev/null 2>"$work/session.err" &
  session=$!
  exec 3>"$work/session"
  cat "$work/commands" >&3

  waited=0
  until [ -s "$work/ready" ]; do
    if ! kill -0 "$session" 2>/dev/null; then
      print_scrubbed "$work/session.err" "$secret"
      fail "could not open the database session"
    fi
    if [ "$waited" -ge "$SNAPSHOT_WAIT_SECONDS" ]; then fail "timed out waiting for the database session"; fi
    sleep 1
    waited=$((waited + 1))
  done
  snapshot="$(tr -d ' \n' <"$work/snapshot")"

  if ! pg_dump --format=custom --no-owner --no-privileges --snapshot="$snapshot" --dbname="$url" \
    --file="$work/$name.dump" 2>"$work/dump.err"; then
    print_scrubbed "$work/dump.err" "$secret"
    fail "pg_dump failed; nothing was written to SACOU_BACKUP_DIR"
  fi
  echo "COMMIT;" >&3
  exec 3>&-
  if ! wait "$session"; then
    print_scrubbed "$work/session.err" "$secret"
    fail "the database session failed; nothing was written to SACOU_BACKUP_DIR"
  fi

  bytes="$(wc -c <"$work/$name.dump" | tr -d ' ')"
  sha256="$(sha256sum "$work/$name.dump" | cut -d ' ' -f 1)"
  if ! state_block <"$work/state" >"$work/state.json"; then fail "could not read the row counts"; fi
  {
    echo "{"
    echo "  \"format\": ${MANIFEST_FORMAT},"
    echo "  \"environment\": \"${environment}\","
    echo "  \"createdAt\": \"${created}\","
    echo "  \"file\": \"${name}.dump\","
    echo "  \"bytes\": ${bytes},"
    echo "  \"sha256\": \"${sha256}\","
    cat "$work/state.json"
    echo "}"
  } >"$work/$name.manifest.json"

  # Final names only now, the manifest last: a dump without its manifest is not a backup (docs/operacao/backup.md).
  # A copy, never a move: on the bucket's mount a rename is a delete, which the retention policy refuses.
  cp "$work/$name.dump" "$directory/$name.dump"
  cp "$work/$name.manifest.json" "$directory/$name.manifest.json"
  tables="$(grep -c '^rows|' "$work/state")"
  echo "backup: ${environment}: ${name}.dump, ${bytes} bytes, ${tables} tables, $(($(date -u +%s) - started)) s"
}

restore_check() {
  if [ "$#" -ne 2 ]; then
    echo "usage: backup.sh restore-check <dump> <manifest>" >&2
    exit "$EXIT_USAGE"
  fi
  dump_file="$1"
  manifest="$2"
  if [ ! -f "$dump_file" ] || [ ! -f "$manifest" ]; then fail "the dump or the manifest is missing"; fi
  require_env SACOU_RESTORE_DATABASE_URL
  url="$(secure_url "$SACOU_RESTORE_DATABASE_URL" SACOU_RESTORE_DATABASE_URL)"
  secret="$(password_of "$url")"
  work="$(mktemp -d)"
  started="$(date -u +%s)"

  expected="$(sed -n 's/^  "sha256": "\([0-9a-f]*\)",$/\1/p' "$manifest")"
  if [ "${#expected}" -ne "$SHA256_HEX_LENGTH" ]; then fail "the manifest has no SHA-256; nothing was restored"; fi
  actual="$(sha256sum "$dump_file" | cut -d ' ' -f 1)"
  if [ "$actual" != "$expected" ]; then fail "the dump does not match the SHA-256 of the manifest; nothing was restored"; fi

  if ! tables="$(echo "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema');" |
    psql_quiet --dbname="$url" 2>"$work/psql.err")"; then
    print_scrubbed "$work/psql.err" "$secret"
    fail "could not connect to the target database"
  fi
  if [ "$tables" != "0" ]; then fail "the target database has tables; restore only into an empty database"; fi

  if ! pg_restore --no-owner --no-privileges --exit-on-error --single-transaction --dbname="$url" "$dump_file" \
    2>"$work/restore.err"; then
    print_scrubbed "$work/restore.err" "$secret"
    fail "pg_restore failed; the transaction was rolled back"
  fi

  if ! state_sql | psql_quiet --dbname="$url" >"$work/state" 2>"$work/psql.err"; then
    print_scrubbed "$work/psql.err" "$secret"
    fail "could not read the restored database"
  fi
  state_block <"$work/state" >"$work/restored.json" || fail "could not read the restored row counts"
  sed -n '/^  "migrations": {$/,$p' "$manifest" | sed '$d' >"$work/expected.json"
  if ! diff "$work/expected.json" "$work/restored.json" >&2; then
    fail "the restored database differs from the manifest (lines above: expected, then restored)"
  fi
  tables="$(grep -c '^rows|' "$work/state")"
  echo "restore-check: ok, ${tables} tables match the manifest, $(($(date -u +%s) - started)) s"
}

command="${1:-}"
if [ "$#" -gt 0 ]; then shift; fi
case "$command" in
  dump) dump "$@" ;;
  restore-check) restore_check "$@" ;;
  *)
    echo "usage: backup.sh dump | backup.sh restore-check <dump> <manifest>" >&2
    exit "$EXIT_USAGE"
    ;;
esac
