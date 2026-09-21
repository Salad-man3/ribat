# 05 — Offline and sync

> The contract that makes class mode work with no internet, and the part of the system worth
> explaining in an interview. See [ADR-0004](./adr/0004-offline-sync.md) for the reasoning.

---

## 1. Scope

**SYNC-01** — Exactly two things are written offline: **attendance** and **progress logs**
(memorization and material pages). Everything else requires a connection (decision 9.3).

**SYNC-02** — Offline reads are limited to the **class kit**: the teacher's sessions for
today, their students, each student's last position, and the course's materials. Nothing
else is cached, so no data a teacher may not see ever reaches their phone (PERM-07).

**SYNC-03** — The target is a full class offline, not days (decision 9.1). The kit is valid
for 24 hours; after that the app warns that it is stale but still accepts writes.

---

## 2. The class kit

`GET /api/v1/class-kit` returns, for the signed-in teacher:

| Part | Contents |
| --- | --- |
| Sessions | Today's `CourseSession` rows for their courses, with status and times |
| Roster | Per session: enrollments the teacher may log for (their group when groups are on) |
| Positions | Each student's `MemorizationSummary` for the relevant materials: last page, last surah and ayah |
| Materials | The course's materials with page counts and track |
| Meta | `generatedAt`, `kitVersion`, the organization's timezone |

Budget: one request, under 150 KB for a 40-student teacher — see the
[performance budget](./01-architecture.md#11-performance-budget).

Refreshed when the app opens online, when class mode is entered, and after every successful
sync.

---

## 3. Local storage (Dexie)

| Table | Holds | Cleared |
| --- | --- | --- |
| `kit` | The latest class kit, one row | On refresh |
| `outbox` | Queued mutations | When the server confirms each one |
| `results` | Recent sync results, for the conflict banner | After 7 days |
| `meta` | `lastSyncedAt`, `kitVersion`, schema version | — |

**SYNC-04** — The service worker treats `/api/*` as network-only. Domain data lives in Dexie
by explicit code, never in an HTTP cache that could silently answer a stale roster.

**SYNC-05** — Any change to these tables ships with a Dexie version migration and a test that
replays an old queue.

---

## 4. Outbox mutations

Every queued mutation is:

```jsonc
{
  "idempotencyKey": "uuid v4, generated on the device",
  "type": "attendance.mark | memorization.log | material.log",
  "capturedAt": "2026-09-18T15:04:11+03:00",  // device clock
  "payload": { /* validated by the shared Zod schema before queueing */ }
}
```

**SYNC-06** — The key is generated once, when the teacher taps. Retries reuse it. This is what
makes replay safe (DM-10).

**SYNC-07** — Payloads are validated on the device with the same Zod schema the API uses, so
a malformed entry is caught before it sits in a queue for an hour.

**SYNC-08** — The queue is ordered by `capturedAt` and replayed in that order. Order matters
only within one student and entity; the server does not assume a global order.

---

## 5. The sync endpoint

`POST /api/v1/sync/mutations` — a batch of up to 200 mutations.

```jsonc
// response
{ "results": [
  { "idempotencyKey": "…", "status": "applied",    "entityId": "…" },
  { "idempotencyKey": "…", "status": "duplicate",  "entityId": "…" },
  { "idempotencyKey": "…", "status": "superseded", "entityId": "…", "server": { /* winning row */ } },
  { "idempotencyKey": "…", "status": "rejected",   "error": { "code": "FORBIDDEN" } }
] }
```

**SYNC-09** — Each mutation is processed in its own transaction: apply the write, record the
`SyncMutation` row, write the audit entry. One rejection never fails the batch.

**SYNC-10** — A key already present in `SyncMutation` returns the stored result without
touching the row again (`duplicate`).

**SYNC-11** — Authorisation happens at replay time with the teacher's current permissions
(PERM-12). A teacher removed from a course gets `rejected: FORBIDDEN`, and the app shows those
entries instead of dropping them.

**SYNC-12** — The endpoint is rate-limited, and a batch is rejected whole if it exceeds the
size limit.

---

## 6. Conflict rules

| Entity | Rule |
| --- | --- |
| **Attendance** | Last writer by `markedAt` wins. The previous value goes to `AuditLog`, `supersededCount` is incremented, and the person whose value was replaced gets a notification. The client applies the server's row (decision 9.4) |
| **Memorization log** | No conflict possible: append-only, deduped by key. Two teachers logging the same student create two rows, which is correct — they recited twice |
| **Material log** | Append-only, one row per (session, material, group). A second log for the same triple is kept; the course page shows the furthest page reached |
| **Clock skew** | `markedAt` is trusted only within ±12 hours of the server's time. Outside that, the server's receipt time is used and the row is flagged in the audit entry |

**SYNC-13** — The client never silently discards a local value. Every superseded or rejected
mutation is surfaced in the conflict banner until dismissed.

---

## 7. Authentication offline

**SYNC-14** — An already-signed-in teacher opens the app offline and reaches class mode from
the cached kit. A fresh login needs the network (decision 9.5).

**SYNC-15** — If the session has expired by the time the queue replays, the app keeps the
queue, asks for the password, and replays afterwards. Queued work is never lost to a logout.

---

## 8. Failure modes to test

| Case | Expected |
| --- | --- |
| The same batch sent twice | All `duplicate`, no double rows |
| The app is killed mid-class | Queue survives; nothing is lost |
| Two teachers mark the same student offline | One row, latest `markedAt` wins, both in the audit log, the loser notified |
| A teacher is unassigned during class | Their mutations are `rejected` and shown, never applied |
| The device clock is a day off | Clamped, flagged, not trusted |
| The kit is 3 days old | Warning banner, writes still accepted |
| Sync while the session expired | Password prompt, then successful replay |
| A midnight rollover during class | The session keeps its own date; the kit does not swap under the teacher |
| 200 queued mutations | One request, under 2 seconds |

These cases are the sync suite in CI ([01-architecture.md §10](./01-architecture.md#10-testing-and-ci)).
