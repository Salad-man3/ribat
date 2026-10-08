#!/bin/sh
set -eu
cd /repo/apps/api
pnpm exec prisma migrate deploy
exec node dist/main.js
