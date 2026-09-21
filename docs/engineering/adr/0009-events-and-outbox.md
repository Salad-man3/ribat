# ADR-0009 — Domain events and the transactional outbox

**Status:** Accepted · **Date:** 2026-09-18 · **Applies from:** slice S4

## Context

From S4 onward, one domain write has several reactions. Marking attendance should notify a
guardian; later it should also feed point rules and invalidate statistics. Recording a test
notifies three people. Publishing homework fans out to a whole course.

Two problems appear at that moment.

**The dual write.** [ADR-0006](./0006-async-work.md) put the queue in Redis. A handler that
commits attendance to Postgres and then enqueues a notification to Redis performs two writes
with no shared transaction. If the enqueue fails — Redis restarting, a network blip, the
process dying between the two — the attendance is saved, the parent is never told, and
nothing in the system knows a message was lost. Silent loss is the worst kind: the sheikh
only finds out when a parent complains weeks later.

**Coupling.** If `AttendanceService` calls notifications, then points, then statistics
directly, every new reaction edits the attendance code, and a failure in a reaction can fail
the write that mattered.

## Decision

1. **Nothing before the second consumer.** Slices S1–S3 use direct calls. An event bus with
   one subscriber is indirection without benefit.
2. **A `DomainEvent` row is appended in the same transaction as the domain write.** Either
   both land or neither does. This is the transactional outbox.
3. **A dispatcher turns rows into jobs.** It claims batches with
   `SELECT … FOR UPDATE SKIP LOCKED`, enqueues BullMQ jobs, and marks rows dispatched. Redis
   being down delays reactions; it never loses them, because the truth is the table.
4. **Handlers are idempotent per `(eventId, handler)`**, enforced by a unique index on
   `EventDelivery`. At-least-once delivery is assumed, so a redelivery is a no-op.
5. **Failures are visible.** Retries use exponential backoff; after the last attempt the
   delivery is dead-lettered and appears in a staff-facing *failed events* view with a manual
   retry. A silently stuck dispatcher in a 200-user app is a product failure, so it is
   monitored like one.
6. **Events never sit on the primary write path.** Attendance, progress and enrollment are
   correct the moment the transaction commits. Events drive reactions only — notifications,
   points, statistics. If the dispatcher stops, nobody's record is wrong; some parents are
   told late.
7. **Ordering is per aggregate and best effort.** Handlers must tolerate out-of-order
   delivery; none of the reactions in this product depend on global order.

### The trade-off, stated plainly

The outbox exists because the queue is in Redis. A Postgres-backed queue such as **pg-boss**
enqueues inside the same transaction, and then the dual write — and this entire ADR —
disappears. That option was rejected deliberately: BullMQ brings better tooling for retries,
scheduling and inspection, and it is a far more common skill. The cost of that choice is one
table and a dispatcher, paid so that a parent's notification is never lost.

## Consequences

- Reactions become eventually consistent, with a window of seconds. Documented, and
  acceptable because of decision 6.
- One table, one dispatcher, a dead-letter path and a staff view to build and operate.
- Debugging spans three places, so every event carries the originating `requestId`, and logs
  include `eventId` and handler name.
- Adding a consumer becomes a subscription rather than an edit to the producing service —
  which is what makes S5's point rules cheap.
- The event log doubles as a history of what the system reacted to, next to the audit log of
  what people did.

## Alternatives considered

- **pg-boss with transactional enqueue** — genuinely simpler and removes the failure this ADR
  addresses. Rejected for tooling and skill reasons above; it remains the right answer for a
  deployment that wants one less service.
- **Direct enqueue, no outbox** — one less table, and a lost notification whenever Redis
  hiccups at the wrong moment.
- **A broker (Kafka, RabbitMQ)** — built for throughput this product will not see. Roughly
  thirty reactions a day per mosque.
- **Full event sourcing** — the ledgers are already append-only where the domain is naturally
  event-shaped; rebuilding member or course state from events would add cost with no question
  it answers.
