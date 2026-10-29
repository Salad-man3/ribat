#!/bin/sh
set -eu
cd /repo/apps/api
# One-shot `migrate` Compose services run deploy; worker processes must not migrate (ADR-0006).
if [ "${SKIP_DB_MIGRATE:-false}" != "true" ] && [ "${JOBS_WORKER:-inline}" != "only" ]; then
  pnpm exec prisma migrate deploy
fi
exec node dist/main.js
