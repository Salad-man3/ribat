# ADR-0002 — Tenant isolation

**Status:** Accepted · **Date:** 2026-09-18

## Context

Ribat is multi-tenant from the first migration, even though only one mosque uses it during
the beta. The data is children's personal information, so a cross-tenant leak is the worst
failure this system can have. It is also the first thing an interviewer probes when they hear
"multi-tenant".

Three options: application-level scoping, PostgreSQL Row-Level Security, or a schema or
database per tenant.

## Decision

**Shared schema, `organizationId` on every tenant-owned table, scoping enforced in one
place.**

- A Prisma client extension injects `organizationId` into every query on a tenant model and
  **throws at runtime** if a tenant model is queried without it. Services never receive an
  unscoped client.
- Resources are loaded by id **and** organization in the same query. A row from another
  mosque is reported as **404**, never 403, so existence does not leak (DM-02).
- Business uniqueness is tenant-aware: compound unique constraints, never global ones.
- Every list endpoint has an e2e test that seeds a second organization and proves it is
  invisible. This suite is a CI gate.

**Row-Level Security is added after the beta** as a second lock, using a per-request
`SET LOCAL app.organization_id` inside the transaction, with policies on every tenant table.

## Consequences

- Isolation depends on code plus tests during the beta. That is acceptable while one mosque
  exists, and the tests make the guarantee visible.
- Adding RLS later is additive: the column and the scoping already exist, so the migration
  only adds policies and the transaction variable.
- The platform owner's endpoints deliberately bypass tenant scope, so they are a separate
  module with their own guard and no access to tenant models (PERM-02).

## Alternatives considered

- **RLS from day one** — stronger, but it costs a transaction-scoped session variable on every
  request and complicates Prisma's connection handling. Deferred deliberately, not forgotten.
- **Schema or database per tenant** — best isolation, worst operations for a solo maintainer:
  migrations multiply and the SaaS goal (many small mosques) makes it worse.
