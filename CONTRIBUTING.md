# Contributing

Ribat is AGPL-3.0-or-later. Open a pull request with your change; a maintainer reviews and
merges.

## Run it

**Docker only** (works on Windows, macOS, and Linux):

```bash
docker compose -f deploy/compose.demo.yml up -d --build
docker compose -f deploy/compose.demo.yml run --rm seed
```

Open http://localhost:3000. Demo password: `demo-ribat-2026` (see the root README for accounts).

**Develop** (hot reload):

```bash
corepack enable
pnpm install
cp .env.example .env
cp .env.example apps/api/.env
docker compose -f deploy/compose.dev.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

PWA: http://localhost:5173 · API: http://localhost:3000 · Swagger: http://localhost:3000/api/docs

Requires Node 20+, pnpm 12.4.2 (from `package.json`), and Docker.

## Repository layout

| Path | What |
| --- | --- |
| `apps/api` | NestJS API, Prisma schema, migrations, e2e tests |
| `apps/web` | React PWA (Vite), offline class mode, i18n |
| `packages/shared` | Zod contracts shared by API and web |
| `packages/quran-data` | Surah and mushaf page reference data |
| `deploy` | Dockerfile, Compose files, Caddy |

## Pull requests

1. Branch from `main`.
2. Keep commits in [conventional commit](https://www.conventionalcommits.org/) form when you can.
3. Before opening the PR, run what your change touches:
   - `pnpm lint` and `pnpm typecheck`
   - `pnpm test`
   - `pnpm test:e2e` when you change an API route, permissions, tenant scope, or offline sync
4. CI must pass (lint, typecheck, unit tests, e2e, build).

## Invariants

- Scope tenant-owned data by `organizationId`. Cross-tenant access must look like **404**, not 403.
- User-facing copy in **English and Arabic** when you touch UI strings.
- No secrets, invite codes, OTPs, or real personal data in the repo or logs.
- Offline class mode: after UI or sync changes, try `pnpm dev:pwa` and exercise `/teach`.

There is no DCO sign-off line required; the licence on the repo applies to merged contributions.
