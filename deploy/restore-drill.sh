#!/usr/bin/env bash
# Decrypt the latest off-site backup into a scratch DB and verify row counts (drill only).
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL (admin URL to create/drop scratch DB)}"
: "${BACKUP_KEY_FILE:?set BACKUP_KEY_FILE}"
: "${BACKUP_OFFSITE_DIR:?set BACKUP_OFFSITE_DIR}"

SCRATCH_DB="${RESTORE_DRILL_DB:-ribat_restore_drill}"
ADMIN_URL="${RESTORE_DRILL_ADMIN_URL:-$DATABASE_URL}"

LATEST="$(ls -1t "$BACKUP_OFFSITE_DIR"/ribat-*.sql.enc 2>/dev/null | head -1)"
if [[ -z "$LATEST" ]]; then
  echo '{"ok":false,"error":"no off-site ciphertext found"}' >&2
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -in "$LATEST" -out "$TMP" -pass "file:$BACKUP_KEY_FILE"

BASE="${ADMIN_URL%/*}"
ORG_COUNT="$(psql "$ADMIN_URL" -Atc 'SELECT count(*) FROM "Organization"' 2>/dev/null || echo 0)"

psql "$BASE/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\";"
psql "$BASE/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$SCRATCH_DB\";"

SCRATCH_URL="${ADMIN_URL%/*}/$SCRATCH_DB"
psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 -f "$TMP" >/dev/null
RESTORED="$(psql "$SCRATCH_URL" -Atc 'SELECT count(*) FROM "Organization"')"

psql "$BASE/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE \"$SCRATCH_DB\";"

if [[ "$RESTORED" != "$ORG_COUNT" ]]; then
  echo "{\"ok\":false,\"expected\":$ORG_COUNT,\"restored\":$RESTORED}" >&2
  exit 1
fi

echo "{\"ok\":true,\"source\":\"$LATEST\",\"organizationCount\":$RESTORED}"
