# ADR-0006 — Redis and background jobs

**Status:** Accepted · **Date:** 2026-09-18

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
