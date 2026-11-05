#!/usr/bin/env bash
# Encrypted Postgres backup (NFR-09). Key file and dumps stay outside git.
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL}"
: "${BACKUP_KEY_FILE:?set BACKUP_KEY_FILE path to a secret key file}"
: "${BACKUP_DIR:?set BACKUP_DIR for local ciphertext}"
: "${BACKUP_OFFSITE_DIR:?set BACKUP_OFFSITE_DIR for off-box copy}"

mkdir -p "$BACKUP_DIR" "$BACKUP_OFFSITE_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PLAIN="$BACKUP_DIR/ribat-${STAMP}.sql"
CIPHER="$BACKUP_DIR/ribat-${STAMP}.sql.enc"
OFFSITE="$BACKUP_OFFSITE_DIR/ribat-${STAMP}.sql.enc"

pg_dump "$DATABASE_URL" --no-owner --no-acl -f "$PLAIN"
openssl enc -aes-256-cbc -pbkdf2 -salt -in "$PLAIN" -out "$CIPHER" -pass "file:$BACKUP_KEY_FILE"
rm -f "$PLAIN"
cp "$CIPHER" "$OFFSITE"
echo "{\"ok\":true,\"cipher\":\"$CIPHER\",\"offsite\":\"$OFFSITE\",\"at\":\"$STAMP\"}"
