#!/usr/bin/env bash
# API on :3100 against ribat_video (own Redis db, no worker) and the web app on :5273; the recorder sends /api to :3100.
cd "$(dirname "$0")/../.."
L=video/out; mkdir -p $L
(cd apps/api && DATABASE_URL=postgresql://ribat:ribat@127.0.0.1:5435/ribat_video REDIS_URL=redis://127.0.0.1:16379/5 \
  PORT=3100 APP_URL=http://localhost:5273 JOBS_WORKER=off npx nest start > ../../$L/api.log 2>&1 &)
(cd apps/web && npx vite --port 5273 --strictPort > ../../$L/web.log 2>&1 &)
for i in $(seq 90); do curl -s -o /dev/null localhost:3100/api/v1/auth/me && curl -sf localhost:5273 > /dev/null && echo up && exit 0; sleep 1; done
echo "servers did not start; see $L/api.log and $L/web.log"; exit 1
