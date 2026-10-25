# Contributing

Ribat is AGPL-3.0-or-later. Open a pull request with your change; a maintainer reviews and
merges.

To **try Ribat without installing Node**, use [Run the demo](./README.md#run-the-demo) in the README.

## Development setup

Run the API and PWA from your checkout with hot reload. Docker provides Postgres and Redis only.

### Prerequisites

- Node 20+ and pnpm 12.4.2 (`corepack enable` once on your machine)
- Docker with Compose v2

### Steps

From the repository root:

1. `pnpm install` — install workspace dependencies.
2. `cp .env.example .env` and `cp .env.example apps/api/.env` — local defaults for the API and Prisma CLI.
3. `docker compose -f deploy/compose.dev.yml up -d` — Postgres on host port **5435**, Redis on **16379**.
4. `pnpm db:migrate` — apply migrations.
5. `pnpm db:seed` — wipe and recreate fictional demo data.
6. `pnpm dev` — API on http://localhost:3000, PWA on http://localhost:5173 (Vite proxies `/api` to the API).

**Note:** Stop the [Docker demo](./README.md#run-the-demo) first if it is running; both setups use port 3000 for the API.

### Verify

- `curl -sS http://localhost:3000/api/v1/health/live` returns `{"status":"ok"}` (or similar).
- http://localhost:5173 loads the sign-in page.
- Swagger UI: http://localhost:3000/api/docs when `API_DOCS=true` in your `.env`.

Class mode for teachers: http://localhost:5173/teach

### Stop

- End `pnpm dev` with Ctrl+C.
- `docker compose -f deploy/compose.dev.yml down` — stop Postgres and Redis.

### Testing the installed PWA and offline mode

The Vite dev server does not match production cookie and service-worker behaviour. Use one of these:

- **Closest to production:** [Run the demo](./README.md#run-the-demo) in the README (one origin at http://localhost:3000 with the built PWA and service worker).
- **From your branch:** `pnpm --filter web build` then `pnpm --filter web preview`, with the API still running via `pnpm dev` or the demo stack.

Then open class mode, cache the kit online, go offline in browser DevTools, mark attendance, and reconnect to confirm sync.

## Repository layout

| Path                  | What                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| `apps/api`            | NestJS API, Prisma schema, migrations, e2e tests                              |
| `apps/web`            | React PWA (Vite), offline class mode, i18n                                    |
| `apps/android`        | Bubblewrap TWA for Play Store / APK install ([guide](apps/android/README.md)) |
| `packages/shared`     | Zod contracts shared by API and web                                           |
| `packages/quran-data` | Surah and mushaf page reference data                                          |
| `deploy`              | Dockerfile, Compose files, Caddy                                              |

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
- Offline class mode: after UI or sync changes, exercise `/teach` using the demo stack or `web build` + `web preview` (see [Testing the installed PWA](#testing-the-installed-pwa-and-offline-mode)).
- Android shell changes: follow [apps/android/README.md](apps/android/README.md); run `pnpm android:update` when `twa-manifest.json` changes.

There is no DCO sign-off line required; the licence on the repo applies to merged contributions.
