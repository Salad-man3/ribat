# 07 — Events, outbox and background jobs

> Implementation detail for [ADR-0009](./adr/0009-events-and-outbox.md). Lands in slice S4.
> Until then, services call each other directly.

---

## 1. Principles

| # | Rule |
| --- | --- |
| EV-01 | Events drive **reactions only**. No user-visible record depends on a handler running |
| EV-02 | A `DomainEvent` row is written **in the same transaction** as the domain change |
| EV-03 | Delivery is **at least once**. Every handler is idempotent per `(eventId, handler)` |
| EV-04 | Ordering is per aggregate and best effort. Handlers tolerate out-of-order arrival |
| EV-05 | A failed delivery ends in a dead letter that a human can see and retry — never in silence |
| EV-06 | Every event carries the `requestId` of the request that produced it |
| EV-07 | Payloads carry **IDs and facts, never PII**. Handlers load what they need (NFR-08) |

---

## 2. Tables

### DomainEvent

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Also the idempotency anchor for handlers |
| organizationId | uuid | Tenant scope travels with the event |
| type | text | `attendance.marked`, `memorization.logged`, … |
| aggregateType, aggregateId | text, uuid | Ordering scope |
| payload | jsonb | IDs and facts only |
| requestId | text | Traces back to the HTTP request or job that caused it |
| actorMembershipId | uuid? | Who caused it, when a person did |
| occurredAt | timestamptz | Domain time |
| dispatchedAt | timestamptz? | Set when the dispatcher has enqueued every handler |

Index: `(dispatchedAt, occurredAt)` for the dispatcher, `(organizationId, type, occurredAt desc)` for inspection.

### EventDelivery

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | |
| eventId | uuid | |
| handler | text | Handler name |
| status | enum | `PENDING`, `DONE`, `FAILED`, `DEAD` |
| attempts | int | |
| lastError | text? | Truncated, no PII |
| nextAttemptAt, completedAt | timestamptz? | |

**Unique on `(eventId, handler)`** — this single constraint is what makes redelivery a no-op.

---

## 3. The dispatcher

A loop in the worker process:

1. `SELECT … FROM "DomainEvent" WHERE "dispatchedAt" IS NULL ORDER BY "occurredAt" LIMIT 100 FOR UPDATE SKIP LOCKED`
2. For each event, insert a `PENDING` `EventDelivery` per subscribed handler (`ON CONFLICT DO NOTHING`), enqueue a BullMQ job per delivery.
3. Mark the event `dispatchedAt`.
4. Sleep 1 second, or wake early on a NOTIFY.

Properties worth knowing in an interview: `SKIP LOCKED` lets several workers run without
coordination; the table is the source of truth, so Redis losing its data delays reactions but
loses nothing; crash between enqueue and commit results in re-enqueue, which EV-03 absorbs.

**Retries:** after 10 s, 1 min, 5 min and 30 min. The fifth failure makes the delivery
`DEAD`; it appears in the staff *failed events* view (`/staff/events`) with a retry button,
and is logged at error level (Sentry once it is wired).

**Built as:** `OutboxService` in the worker process (`JOBS_WORKER=inline|only`). The dispatcher
loop runs every second; a sweep every minute re-enqueues deliveries still `PENDING` a minute
after creation, which covers a crash between commit and enqueue. A handler's writes and the
`DONE` mark share one transaction, and every notification carries a `dedupeKey`, so a
re-run inserts nothing.

**Monitoring:** undispatched events older than 60 seconds, deliveries in `DEAD`, and dispatcher
loop duration. A stuck dispatcher is treated as an outage, not a warning.

---

## 4. Event catalogue

| Event | Emitted by | Payload | Consumers | Slice |
| --- | --- | --- | --- | --- |
| `attendance.marked` | Attendance write and sync replay | sessionId, enrollmentId, status, markedByMemberId, supersededMemberId | `notify.attendanceOverridden`; points, stats later | S4 |
| `attendance.corrected` | Staff correction | as above + previousStatus | notify overridden marker, points, stats | S4 |
| `memorization.logged` | Progress write and sync replay | memberId, materialId, courseId, type, pages, grade | points, stats | S4 |
| `memorization.voided` | Void with reason | logId, memberId, reason | points reversal, stats | S5 |
| `test.recorded` | Test write | memberId, materialId, scope, score, passed | notify guardian, student, teacher; points; stats | S4 |
| `homework.assigned` | Homework create | homeworkId, courseId, targets | notify students and guardians | S4 |
| `homework.missed` | Nightly due-date check | homeworkId, enrollmentId | notify guardian, student, teacher | S4 |
| `session.cancelled` | Session update | sessionId, courseId, reason | notify course members and guardians | S4 |
| `excuse.decided` | Staff decision | excuseId, decision | notify guardian, apply `EXCUSED` marks | S4 |
| `warning.published` | Warning publish | warningId, memberId | notify guardian, student, teacher; points deduction | S5 |
| `report.published` | Report card publish | reportId, memberId, period | notify guardian, student, teacher | S5 |
| `announcement.published` | Announcement | announcementId, audience | fan-out to notifications | S5 |
| `member.archived` | Archive | memberId | close enrollments, revoke sessions, stats | S4 |

Beta handlers (`apps/api/src/events/handlers.ts`): `notify.attendanceOverridden`, `notify.testResult`,
`notify.homeworkAssigned`, `notify.homeworkMissed`, `notify.sessionCancelled`,
`notify.excuseDecided`, `members.closeOnArchive`. `memorization.logged` is stored with no
subscriber yet, for points and statistics in S5. Accepting an excuse sets `EXCUSED` marks in the
decision's own transaction, not in a handler (EV-01). After beta: `points.apply`,
`stats.invalidate`, `push.send`.

---

## 5. Job catalogue

| Job | Trigger | Idempotency key | Notes |
| --- | --- | --- | --- |
| `sessions.generate` | Nightly 02:00 per org timezone, and on schedule change | `org:date-range` | Resolves prayer anchors, skips pauses, never duplicates an existing session |
| `attendance.dailySummary` | Nightly at org "end of day" | `org:date:guardianId` | One notification per guardian per day (decision 8.4) |
| `sessions.notTakenAlert` | Nightly | `org:date` | Sessions past, not cancelled, no attendance (decision 8.6) |
| `homework.dueCheck` | Nightly | `homeworkId:date` | Emits `homework.missed` |
| `stats.rollup` | Nightly 03:00 | `org:date:scope` | Fills `StatsDaily` ([ADR-0010](./adr/0010-read-models.md)) |
| `events.dispatch` | Continuous loop | — | §3 |
| `notifications.fanout` | From events | `eventId:handler` | Expands an audience into notification rows |
| `push.send` | From notification creation | `notificationId:endpoint` | After beta; retries, prunes dead subscriptions |
| `retention.prune` | Weekly | `week` | Deletes read notifications older than 90 days; never touches domain data |

`attendance.dailySummary`, `sessions.notTakenAlert`, `homework.dueCheck` and `retention.prune` run
together as one `evening-org` job at 21:30 in the organization's timezone (`EveningService`).

All scheduled jobs run **per organization in its own timezone** — "end of day" means Damascus
for the pilot and something else for a self-hoster in another country (SH-01).

---

## 6. Failure playbook

| Symptom | Cause | Response |
| --- | --- | --- |
| Reactions stop, writes fine | Dispatcher not running | Restart the worker; undispatched rows drain in order. Nothing is lost |
| One handler failing repeatedly | Bug or bad data | Deliveries go `DEAD`, visible in the staff view; fix, then bulk retry |
| Redis unavailable | Infrastructure | Writes continue; events queue in Postgres; reactions resume on recovery |
| Duplicate notifications | Handler not idempotent | Violates EV-03 — add the `(eventId, handler)` check, which is the bug, not the delivery |
| A parent says they got nothing | Any of the above | Search events by `requestId` or member, read the delivery rows, retry |

---

## 7. Tests

| Test | Asserts |
| --- | --- |
| Commit writes both | A domain write and its event row appear or vanish together, including on rollback |
| Dispatcher crash | Killing the worker mid-batch produces no lost and no doubled deliveries |
| Redelivery | Running a handler twice on one event changes nothing the second time |
| Dead letter | Five failures produce `DEAD` and a visible row |
| Out of order | Two events for one aggregate applied in reverse still converge |
| Timezone | "End of day" fires per organization, not per server |
| No PII | Payload snapshots contain no names, phones or addresses |
