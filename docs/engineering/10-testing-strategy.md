# 10 — Testing strategy

> What gets tested, at which level, and what a pull request must satisfy.
> The gates listed here are the CI pipeline.

---

## 1. Shape

Not a pyramid by ideology — by where this system's bugs actually live.

| Level | Covers | Speed |
| --- | --- | --- |
| **Unit** | Pure domain logic: Quran range maths, page calculation, permission resolution, conflict policy, point rules, prayer-anchored schedule resolution | Milliseconds, no database |
| **Integration (e2e)** | Every endpoint against a real PostgreSQL: authentication, authorisation, tenant scope, validation, CSRF, audit side effects | Seconds |
| **Suites** | Cross-cutting guarantees: isolation, sync, projections, migrations | Seconds to a minute |
| **Manual** | The class-mode flow on a real phone before the pilot starts | Once per slice |

No UI snapshot tests, no coverage percentage target. A number would be gamed; the suites below
are the real contract.

## 2. Non-negotiable suites

### Tenant isolation

For **every** tenant-owned endpoint: seed two organizations, act as a member of A, request a
resource of B, assert **404** and never 403 (DM-02). A missing case here is treated as a leak,
not as missing coverage.

### Permissions

For each endpoint, the matrix in [03-permissions.md](./03-permissions.md) becomes a table test:
unauthenticated → 401, wrong role → 403, right role but wrong scope (a teacher and another
teacher's group) → 403, correct → 200. Plus: staff endpoints refused while `activeView=MEMBER`
(PERM-06), and offline mutations authorised at replay time, not capture time (PERM-12).

### Offline sync

The nine cases in [05-offline-sync.md §8](./05-offline-sync.md#8-failure-modes-to-test), run
as integration tests: duplicate batch, killed app, two teachers offline on one student,
teacher unassigned mid-class, skewed clock, stale kit, expired session, midnight rollover, 200
queued mutations in one request.

### Events and delivery

The seven cases in [07-events-and-jobs.md §7](./07-events-and-jobs.md#7-tests): transactional
write, dispatcher crash, redelivery, dead letter, out-of-order, per-organization timezone, no
PII in payloads.

### Projections

Rebuild from the ledger and assert equality with the incrementally maintained value, for
`MemorizationSummary` and `StatsDaily` ([ADR-0010](./adr/0010-read-models.md)). This is the
test that makes derived data trustworthy.

### Migrations

Apply the migration chain from the previous release tag onto a seeded database and assert the
app boots and the suites pass. Self-hosters upgrade late, so a migration that only works on a
fresh database is a defect (NFR-12, SH-05).

## 3. Fixtures

- **Builders, not fixture files.** `aMember({ age: 9 })`, `aCourse({ type: 'BOTH', groups: true })`
  — a test states only what it cares about.
- **The second organization is always present** in the e2e base seed, so isolation cases cost
  nothing to write.
- **Time is injected.** Nothing reads the system clock directly; tests set "now", which is the
  only way to test midnight rollover, prayer-anchored schedules and end-of-day jobs honestly.
- **Fictional data only**, in tests and seeds alike.

## 4. CI gates

| Gate | Blocking |
| --- | --- |
| `lint`, `typecheck` across all packages | yes |
| `prisma validate` and migration apply on a clean database | yes |
| Unit tests | yes |
| e2e tests against a PostgreSQL service container | yes |
| Isolation, permissions, sync, events, projection suites | yes |
| Migration-from-previous-tag test | yes, from the first tagged release |
| Production build of API and PWA | yes |
| Docker image build and publish | `main` only |
| Secret scan on the diff | yes |

## 5. Definition of done for a pull request

1. Behaviour has a test at the right level; a bug fix has the test that would have caught it.
2. Tenant scope and permissions covered for any new endpoint — including the 404 case.
3. New offline-writable mutations carry an idempotency key and a replay test.
4. Schema change ships with a migration that is safe for an older deployment, and a rebuild
   path if it touches a projection.
5. Arabic and English copy updated together (NFR-01).
6. The affected document under `docs/` updated in the same pull request, and
   [03-answers.md](../discovery/03-answers.md) amended if a product decision changed.
7. No PII in logs, payloads or test output; no secrets in the diff.
