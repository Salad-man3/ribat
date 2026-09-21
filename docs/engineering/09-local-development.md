# 09 — Local development

> **Target state.** The scaffold built in slice S1 must make every command on this page true,
> and CI must run the same ones. If a command here stops working, that is a bug.

---

## 1. Prerequisites

Node 20, pnpm 9, Docker (for PostgreSQL 16 and Redis). Nothing else — no global CLIs.

## 2. Quick start

```bash
pnpm install
cp .env.example .env                 # every value has a working local default
docker compose -f deploy/compose.dev.yml up -d   # postgres + redis
pnpm db:migrate                      # prisma migrate deploy
pnpm db:seed                         # demo mosque with fake data
pnpm dev                             # API on :3000, PWA on :5173
```

The seed prints one login per role. Those accounts exist only in seeded databases and are
refused when `NODE_ENV=production`.

## 3. Configuration

Everything comes from environment variables (SH-01, NFR-11). The API refuses to start if a
required secret is missing — there are no defaults for secrets, in any environment.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | PostgreSQL connection |
| `REDIS_URL` | yes | — | Queues and the dispatcher |
| `SESSION_SECRET` | yes | — | Session cookie signing; refuses to boot if unset |
| `DEPLOY_MODE` | yes | `self_host` | `self_host` or `hosted` (SH-02) |
| `APP_URL` | yes | `http://localhost:5173` | Absolute links in notifications |
| `PORT` | no | `3000` | API port |
| `LOG_LEVEL` | no | `info` | Pino level |
| `NODE_ENV` | no | `development` | |
| `OWNER_PHONE` | hosted only | — | Bootstraps the platform owner |
| `OWNER_SETUP_CODE` | hosted only | — | One-time; stored hashed, never logged |
| `DEFAULT_TIMEZONE` | no | `Asia/Damascus` | Only a default; each organization sets its own |
| `DEFAULT_LOCALE` | no | `ar` | `ar` or `en` |
| `WEEKEND_DAYS` | no | `5,6` | Friday–Saturday; a self-hoster elsewhere changes it (SH-01) |
| `PRAYER_METHOD` | no | `UmmAlQura` | Default calculation method for new organizations |
| `SENTRY_DSN` | no | — | Error tracking; disabled when empty |
| `WORKER` | no | `0` | `1` runs queues and the dispatcher instead of the HTTP server |

## 4. Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | API and PWA with reload |
| `pnpm build` | Production build of both |
| `pnpm lint` · `pnpm typecheck` | All packages |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | Integration tests against a real database |
| `pnpm db:migrate` · `pnpm db:reset` | Apply migrations · drop, recreate, seed |
| `pnpm db:studio` | Prisma Studio |
| `pnpm --filter api projections:rebuild --target=summary\|stats` | Rebuild a read model ([ADR-0010](./adr/0010-read-models.md)) |
| `pnpm --filter api worker` | Run queues and the dispatcher locally |
| `pnpm --filter api import:members --file=members.csv` | Bulk entry for the pilot (scope §5.2) |

## 5. Seeded data

`pnpm db:seed` creates:

- **Two organizations** — the demo mosque and a second one that exists only so isolation tests
  can prove it is invisible (DM-01, DM-02).
- One sheikh, two org admins, ten teachers, about sixty members with guardians and siblings.
- Four courses: one memorization, one explanation, one of both types, one hierarchical with
  groups per material.
- Four weeks of past sessions, attendance and progress logs, so dashboards and the member card
  have something real to show.
- Clearly fictional names and phone numbers only. Never real data, in any seed
  ([ADR-0007](./adr/0007-licence-and-visibility.md)).

## 6. Working on offline behaviour

The service worker is disabled in `pnpm dev` by default; run `pnpm dev:pwa` to build the
worker and serve the PWA the way a phone sees it. To exercise class mode:

1. Open class mode while online so the kit is cached.
2. Switch the browser to offline (DevTools → Network → Offline).
3. Mark attendance and log progress; watch the queue badge grow.
4. Go back online and confirm one `/sync/mutations` request drains the queue.

Chrome's Application panel shows the Dexie tables (`kit`, `outbox`, `results`, `meta`).

## 7. Troubleshooting

| Symptom | Cause |
| --- | --- |
| API exits at boot with a config error | A required variable is missing. That is deliberate (NFR-11) |
| `migrate` fails on a fresh database | Docker Postgres not ready yet; rerun |
| Reactions never happen locally | No worker running — `pnpm --filter api worker` |
| Cross-tenant test suddenly passes a 200 | A query lost its organization scope. Treat as a leak, not a test bug |
| Dates look wrong by hours | Something used the browser or server timezone instead of the organization's |
