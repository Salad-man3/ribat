# Ribat

Multi-tenant management system for mosque education: courses for Quran memorization and book
explanation, attendance, student progress, homework, and communication with families.
Installable PWA, Arabic (RTL) and English, built to keep working offline during class.

[![CI](https://github.com/Salad-man3/ribat/actions/workflows/ci.yml/badge.svg)](https://github.com/Salad-man3/ribat/actions/workflows/ci.yml)

## Status

Phase 0 foundation is in place:

- NestJS 11 API with Prisma 6, PostgreSQL, Redis, and health endpoints
- React + Vite PWA shell with Arabic/English i18n
- Shared Zod contracts (`packages/shared`) and Quran reference data (`packages/quran-data`)
- Docker Compose for local Postgres and Redis
- GitHub Actions: lint, typecheck, test, build

**Not yet implemented:** auth, domain models, database seed, offline sync, production deploy.

## Stack

| Layer | Choice |
| --- | --- |
| API | NestJS 11, TypeScript, Prisma 6, PostgreSQL 16 |
| Web | React 19, Vite 6, PWA, i18next |
| Monorepo | pnpm workspaces, Turborepo |
| Lint | Oxlint + Prettier + `tsc --noEmit` |
| Local infra | Docker Compose (Postgres + Redis) |

## Quick start

**Prerequisites:** Node 20+, pnpm 12, Docker.

```bash
pnpm install
cp .env.example .env
docker compose -f deploy/compose.dev.yml up -d
pnpm db:migrate
pnpm dev
```

- API: http://localhost:3000/api/v1/health/live
- PWA: http://localhost:5173

Copy env for the API (Prisma CLI reads `apps/api/.env`):

```bash
cp .env.example apps/api/.env
```

Compose maps Postgres to **5434** and Redis to **16379** so it does not clash with other local services. Adjust `.env` if your ports differ.

Verify readiness (needs Postgres **and** Redis):

```bash
curl -i http://localhost:3000/api/v1/health/ready
```

Stop Postgres to confirm failure:

```bash
docker compose -f deploy/compose.dev.yml stop postgres
curl -i http://localhost:3000/api/v1/health/ready   # expect 503
docker compose -f deploy/compose.dev.yml start postgres
```

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | API (:3000) and PWA (:5173) with reload |
| `pnpm build` | Production build of all packages |
| `pnpm lint` | Oxlint across the monorepo |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm test` | Unit tests (API health, quran-data helpers) |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |

## Documentation

Start at [docs/README.md](./docs/README.md).

## Licence

AGPL-3.0 — see [LICENSE](./LICENSE) and [ADR-0007](./docs/engineering/adr/0007-licence-and-visibility.md).
