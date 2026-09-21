# ADR-0001 — Stack and repository shape

**Status:** Accepted · **Date:** 2026-09-18

## Context

A solo developer has 40 hours a week and 2–4 weeks to produce a public, deployed, tested
NestJS application that a mosque can also use. The app must work offline during class, in
Arabic and English, on personal phones.

A keyword count over 335 remote Node/Nest postings showed TypeScript 65%, AWS 50%, CI/CD 42%,
React 41%, PostgreSQL 41%, observability 40%, Docker 32%, testing 25% — and every ORM at
about 2%. So the ORM is free to choose on productivity, while TypeScript, Postgres, React,
Docker, CI and observability all pay off twice: in the product and in the job search.

## Decision

- **NestJS on Express, modular monolith**, one deployable unit.
- **PostgreSQL 16 with Prisma** — schema as code, real migrations, a typed client.
- **React + Vite PWA**, TanStack Query for server state, Dexie for offline, Tailwind and
  shadcn/ui for a plain but consistent UI.
- **pnpm workspaces + Turborepo**: `apps/api`, `apps/web`, `packages/shared`,
  `packages/quran-data`.
- **Zod in `packages/shared`** as the single definition of every request payload, imported by
  both the API and the PWA.
- Node 20, Docker for local Postgres and Redis.
- **Oxlint** for linting (replaces ESLint); Prettier for formatting; `tsc --noEmit` for type-checking.

## Consequences

- One origin in production: Nest serves the built PWA, so cookies work on iOS without
  `SameSite=None` and there is no CORS layer to get wrong.
- Shared Zod schemas mean an offline-queued payload is validated by the same rules on the
  phone and on the server — a real benefit, not a preference.
- A monolith keeps deployment and debugging within one person's reach; module boundaries are
  kept clean so a split stays possible.
- Prisma cannot express one constraint the domain needs (the composite key in
  [02-domain-model.md §6](../02-domain-model.md#6-courses-and-teaching)); that migration is
  hand-written SQL.

## Alternatives considered

- **Next.js** — rejected: the app is fully authenticated and offline-first, so SSR and RSC
  add nothing, while a second Node server would duplicate what Nest already does and break
  same-origin cookies.
- **TypeORM / Sequelize / Drizzle** — all viable; Prisma chosen for migration ergonomics and
  because Sequelize is already on the CV from previous work.
- **Microservices** — rejected outright at this size.
