# 06 — API outline

> REST under `/api/v1`, documented with OpenAPI. Swagger UI is enabled on the demo only.
> Request and response shapes come from the Zod schemas in `packages/shared`.

---

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Auth | httpOnly session cookie; mutations need the CSRF header |
| Tenancy | The organization comes from the session, never from the URL or body |
| Errors | `{ "error": { "code", "message", "details"? }, "requestId" }` — codes are stable, messages are English |
| Status | 400 validation · 401 no session · 403 same-tenant denial · 404 missing **or** cross-tenant · 409 state conflict · 429 rate limited |
| Lists | Cursor pagination: `?cursor=&limit=` (default 50, max 200) |
| Dates | ISO 8601 with offset; the server converts using the organization's timezone |
| Idempotency | `idempotencyKey` in the body for every offline-writable mutation |

---

## 2. Auth and session

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/login` | phone + password → session cookie. Throttled |
| POST | `/auth/setup` | phone + one-time code + new password (WF-02) |
| POST | `/auth/logout` | Revokes the current session |
| GET | `/auth/me` | Identity, memberships, active organization, `activeView`, permissions |
| POST | `/auth/switch-view` | `ADMIN` ↔ `MEMBER` (PERM-05); audited |
| POST | `/auth/switch-org` | After beta (OQ-10) |
| GET | `/auth/devices` | Active sessions |
| DELETE | `/auth/devices/:id` | Revoke one, or `?all=true` for "sign out everywhere" |

## 3. Platform (owner only)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/platform/organizations` | Create a mosque with its sheikh (WF-01) |
| GET | `/platform/organizations` | Name, slug, status, member counts — no tenant data (PERM-02) |
| PATCH | `/platform/organizations/:id` | Suspend or reactivate |
| GET | `/platform/stats` | Organizations, active users, logs per day |

## 4. Organization and people

| Method | Path | Notes |
| --- | --- | --- |
| GET/PATCH | `/organization` | Name, timezone, coordinates, prayer method, locale, points toggle |
| GET/POST | `/members` | Search by name or phone; create with guardians and siblings (WF-03) |
| GET/PATCH | `/members/:id` | Card, shaped per viewer (PERM-07) |
| POST | `/members/:id/archive` | WF-10 |
| GET | `/members/:id/progress` | Memorization summary, tests, attendance %, homework — per course |
| GET/POST/DELETE | `/members/:id/guardians` | Guardian links with relation |
| POST | `/members/:id/household` | Link a sibling, creating the household if needed |
| GET/POST | `/members/:id/notes` | Teacher notes; readable by staff and the author only (DM-13) |
| POST | `/members/:id/access` | Create the login and a setup code (WF-02) |
| POST | `/members/:id/access/reset-code` | New one-time code |
| GET/POST/PATCH | `/memberships` | Roles; creating `ORG_ADMIN` is sheikh-only (PERM-01) |

## 5. Courses and teaching

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/courses` | Filters: status, type, teacher, member |
| GET/PATCH | `/courses/:id` | Includes toggles, materials, teachers, groups, schedule |
| POST | `/courses/:id/status` | Draft → active → paused → finished → archived (OQ-1) |
| GET/POST/DELETE | `/courses/:id/requirements` | Soft enrollment conditions |
| GET/POST/DELETE | `/courses/:id/materials` | Links a catalogue material with its track |
| GET/POST/DELETE | `/courses/:id/teachers` | Assign by member search; lead or teacher |
| GET/POST/PATCH/DELETE | `/courses/:id/groups` | Group per teacher, optionally per material |
| POST/DELETE | `/courses/:id/groups/:groupId/students` | Enforces one teacher per material (DM-06) |
| GET/POST/DELETE | `/courses/:id/enrollments` | Returns requirement warnings, never blocks staff |
| GET/PUT | `/courses/:id/schedule` | Weekday rules, fixed or prayer-anchored; enqueues generation |
| GET/POST/DELETE | `/courses/:id/pauses` | Holidays (decision 4.9) |
| GET/POST | `/materials` | Organization catalogue; staff only (OQ-3) |

## 6. Sessions, attendance, progress

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/sessions` | By course, date range, or teacher |
| POST | `/sessions` | Add an extra session |
| PATCH | `/sessions/:id` | Cancel, change topic or time |
| GET | `/sessions/:id/attendance` | Roster with current marks |
| POST | `/sessions/:id/attendance` | Batch marks; idempotent; same shape as the offline payload |
| GET/POST | `/memorization/logs` | Filters: member, course, material, date range |
| POST | `/memorization/logs/:id/void` | Void with a reason (DM-08) |
| GET/POST | `/memorization/tests` | Every attempt kept (WF-07) |
| GET/POST | `/material-logs` | Explanation pages per session and group |
| GET/POST | `/excuses` · POST `/excuses/:id/decision` | Guardian submits, staff decide (WF-08) |
| **GET** | **`/class-kit`** | The offline bundle (SYNC-02) |
| **POST** | **`/sync/mutations`** | Batch replay (SYNC-09) |

## 7. Homework, schedule, notifications

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/homework` | Target: course, group or member (decision 10.2) |
| PATCH | `/homework/tasks/:id` | Mark done or missed |
| GET | `/schedule` | The caller's weekly timetable: teaching and studying combined (decision 16.2) |
| GET | `/notifications` | Inbox, unread first |
| POST | `/notifications/read` | Mark one or all read |

## 8. Statistics and audit

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/stats/dashboard` | The sheikh's five numbers (decision 17.1), from `StatsDaily` |
| GET | `/stats/courses/:id` | Attendance trend, pages per week, tests |
| GET | `/stats/teachers/:id` | Own group only for a teacher (PERM-04) |
| GET | `/stats/members/:id` | Guardian-visible trends |
| GET | `/audit` | Staff only; filter by entity, actor, date |
| GET | `/health/live` · `/health/ready` | Process; database, Redis, migrations |

## 9. After beta

`/points/rules` · `/points/entries` · `/leaderboard?courseId=` · `/warnings` (propose,
publish) · `/report-cards` (draft, comment, publish) · `/announcements` ·
`/activities` and `/activities/:id/participants` · `/push/subscriptions` ·
`/imports/members`.
