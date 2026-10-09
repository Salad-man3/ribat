# ADR-0006 — Redis and background jobs

**Status:** Accepted, amended 2026-10-08 · **Date:** 2026-09-18

## Context

Several features are not request-shaped: sessions must be generated from weekly schedules
with prayer-anchored times, guardians get one absence summary each evening, the sheikh gets an
alert about sessions nobody marked, statistics are pre-computed nightly, and announcements
fan out to many recipients. Later, web push needs retries.

The earlier specification deliberately avoided Redis. Two things changed: the feature list now
contains genuine scheduled and fan-out work, and Redis with a queue appears in 16–19% of the
job postings this project is also meant to answer.

## Decision

- **Redis + BullMQ**, introduced with the notifications work (slice S4), not before.
- Workers run from the **same Docker image** with a `WORKER=1` flag, so there is one build and
  one deployment.
- Jobs: `sessions.generate`, `attendance.dailySummary`, `sessions.notTakenAlert`,
  `stats.rollup`, `notifications.fanout`, and later `push.send`.
- Every job is **idempotent and keyed by its natural identity** (organization + date +
  job name), so a retry or a double schedule cannot send a parent two summaries.
- Scheduling respects each organization's timezone, because "end of day" means Damascus, not
  UTC.
- Redis is **not** the source of truth for anything. Losing it loses queued jobs, not data;
  the nightly jobs simply run again.

## Consequences

- One more service to run and back up nothing — acceptable, since Redis holds only queues.
- Caching becomes available later (leaderboards, dashboards) without adding infrastructure.
- Statistics are read from `StatsDaily` rather than aggregated per request, which keeps the
  dashboard fast and makes up-to-24-hours-old numbers an explicit product decision (NFR-10).

## Alternatives considered

- **`@nestjs/schedule` only** — enough for cron, but it offers no retries, no visibility and
  no fan-out queue, and it runs inside the API process.
- **pg-boss (queues in Postgres)** — a real option that avoids Redis, at the cost of putting
  queue churn in the same database as the domain data, and of a less common skill.

## Amendment — 2026-10-08: BullMQ arrives in S2

Session generation (T210/T211) is the first real job, so BullMQ moves from S4 to S2.

- One queue, `sessions`, with two jobs: `generate-course` (on schedule, pause, date or status
  changes) and `generate-org` (nightly at 02:00 in the organization's timezone via
  `upsertJobScheduler`, after prayer-setting changes, and once per organization when a worker
  boots).
- Both jobs **reconcile** rather than append: they compute the next 28 days, insert missing
  sessions (`skipDuplicates` on `(courseId, date, startsAt)`) and delete future `SCHEDULED`
  generated sessions that no longer match. Duplicates and retries are therefore harmless, and
  no job id is needed for dedupe.
- `JOBS_WORKER` selects where the worker runs: `inline` inside the API (development and a
  one-container demo), `only` for a worker-only process from the same image, `off` for the API
  when a separate worker runs (`deploy/compose.prod.yml`) and for e2e tests.
- Enqueueing never fails a request: if Redis is down the change is saved and the nightly or
  boot-time run catches up.
