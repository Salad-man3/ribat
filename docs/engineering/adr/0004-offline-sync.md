# ADR-0004 — Offline class mode and sync

**Status:** Accepted · **Date:** 2026-09-18

## Context

Teachers record attendance and progress during class on their own phones, and should expect
to be offline for the whole class. If the app loses a teacher's work once, they go back to
paper and the pilot is over. Two teachers, or a teacher and the sheikh, may record the same
student while both are offline.

## Decision

- **A narrow offline surface:** two write types (attendance, progress logs) and one cached
  read bundle (the class kit). Nothing else works offline (SYNC-01, SYNC-02).
- **Dexie** holds the kit and a persistent **outbox**; the Workbox service worker precaches
  the app shell and treats `/api/*` as network-only, so a stale roster can never come from an
  HTTP cache.
- Every queued mutation carries a **client-generated idempotency key**, created once when the
  teacher taps and reused on every retry.
- Replay is a **batch endpoint** that processes each mutation in its own transaction and
  answers per mutation: `applied`, `duplicate`, `superseded` or `rejected`.
- **Authorisation happens at replay time**, using current permissions, never the permissions
  captured on the device (PERM-12).
- **Conflict policy by entity:** attendance is last-writer-wins by the client's `markedAt`,
  with the losing value preserved in the audit log and a notification to the person
  overridden; progress logs are append-only and therefore cannot conflict.
- **Nothing is discarded silently:** superseded and rejected mutations stay visible in a
  conflict banner until the teacher sees them.
- Device clocks are trusted only within ±12 hours of server time.

## Consequences

- Duplicate submission, a killed app, a flaky connection and a double-tap all converge on the
  same row, which is the property that makes the feature trustworthy.
- The server keeps a `SyncMutation` record per key, which costs storage but gives replay
  answers and a debugging trail.
- Two teachers logging the same student create two progress rows — correct, because the
  student recited twice — while attendance stays single-valued.
- The failure list in [05-offline-sync.md §8](../05-offline-sync.md#8-failure-modes-to-test)
  is a CI suite, not a manual checklist.

## Alternatives considered

- **Offline everything** — far more cache invalidation, more private data sitting on phones,
  and no benefit for the flows that actually happen in class.
- **CRDTs or an off-the-shelf sync engine** — heavy for two entity types with a natural
  resolution rule.
- **Server-wins** — simpler, but it throws away a teacher's work, which is exactly the
  behaviour that kills adoption.
