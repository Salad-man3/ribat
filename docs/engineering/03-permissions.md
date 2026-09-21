# 03 — Roles and permissions

> Server-side rules. The UI hides what a person cannot do, but the API decides.

---

## 1. Roles

| Scope | Role | Who | Count |
| --- | --- | --- | --- |
| Platform | `OWNER` | The SaaS operator | Exactly one |
| Organization | `SHEIKH` | The academic owner of the mosque | Exactly one per mosque |
| Organization | `ORG_ADMIN` | Helps the sheikh run the system | Unlimited |
| Organization | `MEMBER` | Any participant: student, teacher, or both | Unlimited |
| Organization | `GUARDIAN` | A login that only follows linked children | Unlimited |

**PERM-01** — `SHEIKH` and `ORG_ADMIN` have identical permissions, with one exception:
**only the sheikh creates or removes `ORG_ADMIN` memberships** (decision 2.2). Both are
called *staff* below.

**PERM-02** — The platform `OWNER` never reads tenant data. Owner endpoints return
organizations, counts and status only (decision 2.1). There is no impersonation.

---

## 2. Contextual capabilities

A role is not the whole story. Three assignments add capabilities to a `MEMBER`:

| Context | Source | Gives |
| --- | --- | --- |
| **Teacher** | `TeachingAssignment` on a course | Class mode and logging for that course, limited to their group when groups are on |
| **Student** | `Enrollment` in a course | Their own schedule, progress, homework |
| **Guardian** | `GuardianLink` rows | Read access to those wards |

**PERM-03** — Contexts are per course, never global. The same member may teach course A and
study in course B (decision 2.5).

**PERM-04** — A `GUARDIAN` membership has no enrollments of its own. A parent who also
studies is a `MEMBER` with guardian links, and sees both sections.

---

## 3. The admin ↔ member view switch

**PERM-05** — Staff hold one login and one member profile. The active view lives in the
session (`activeView` = `ADMIN` | `MEMBER`) and is changed by an explicit endpoint
(decision 2.4).

**PERM-06** — Staff-only endpoints require `activeView = ADMIN`. While in member view, the
API answers as if the person were an ordinary member. This keeps the switch honest instead of
cosmetic, and every switch is audited.

---

## 4. Permission matrix

`—` = never · `✔` = allowed · `own` = only their own courses, groups, wards or profile.

| Operation | Owner | Staff | Teacher | Member | Guardian |
| --- | :--: | :--: | :--: | :--: | :--: |
| Create / suspend an organization | ✔ | — | — | — | — |
| View platform statistics | ✔ | — | — | — | — |
| Read any mosque data | — | ✔ | own | own | own wards |
| Create members, households, guardian links | — | ✔ | — | — | — |
| Create logins and setup codes | — | ✔ | — | — | — |
| Create or remove `ORG_ADMIN` | — | **sheikh only** | — | — | — |
| Archive a member | — | ✔ | — | — | — |
| Create and edit courses | — | ✔ | — | — | — |
| Manage materials | — | ✔ | lead, own course (OQ-3) | — | — |
| Enroll or unenroll students | — | ✔ | — | — | — |
| Assign teachers, create groups, assign students to groups | — | ✔ | — | — | — |
| Edit the course schedule, pause a course | — | ✔ | — | — | — |
| Add or cancel a single session | — | ✔ | own course | — | — |
| Mark attendance | — | ✔ | own group | — | — |
| Correct attendance later | — | ✔ any time | own, same day | — | — |
| Log memorization / material pages | — | ✔ | own group | — | — |
| Void a progress log | — | ✔ | own, same day | — | — |
| Record a memorization test | — | ✔ | own group | — | — |
| Write a teacher note about a student | — | ✔ | own students | — | — |
| Read teacher notes | — | ✔ | own notes only | — | — |
| Assign homework | — | ✔ | own course, group or student | — | — |
| Mark homework done | — | ✔ | own group | — | — |
| Submit an excuse | — | ✔ | — | own | own wards |
| Accept an excuse | — | ✔ | — | — | — |
| Read the member card | — | ✔ full | own students, limited (§5) | own | own wards |
| Read course statistics | — | ✔ | own group | — | — |
| Read the audit log | — | ✔ | — | — | — |
| Change organization settings | — | ✔ | — | — | — |
| **After beta** | | | | | |
| Propose a warning | — | ✔ | own students | — | — |
| Publish a warning | — | ✔ | — | — | — |
| Give manual points | — | ✔ | own students | — | — |
| Configure point rules, toggle points | — | ✔ | — | — | — |
| Generate and publish a report card | — | ✔ | comment only | — | — |
| Send an announcement | — | ✔ | — | — | — |

---

## 5. Field visibility on the member card

**PERM-07** — Visibility is decided by response shaping in the service, not by the client
(decision 14.2).

| Viewer | Sees | Never sees |
| --- | --- | --- |
| **Staff** | Everything: all fields, all courses, guardians, siblings, notes, full history | — |
| **Teacher** | Name, phone, age or school grade, and progress **in the course they teach** | Address, mother's name, guardians, siblings, other courses, other teachers' notes, their own past-course history |
| **Guardian** | Their ward's full card except staff and teacher notes, plus schedule, attendance, progress, homework | Teacher notes, other members |
| **Member (self)** | Their own card and progress | Teacher notes, other members |

**PERM-08** — A leaderboard is visible to every member of that course, and to their guardians
(decision 11.6). It is hidden entirely when `leaderboardEnabled` is false.

---

## 6. Enforcement

**PERM-09** — Every request passes, in order: authentication → organization resolution →
role check → resource-scope check.

**PERM-10** — Resource scope is resolved by loading the resource **with** its
`organizationId` in the same query. A row belonging to another mosque is indistinguishable
from a missing one: **404** (DM-02).

**PERM-11** — A teacher's scope check answers one question: *does an active
`TeachingAssignment` link this member to this course, and — when `hasGroups` is true — does
this student sit in a group led by them?* The answer is computed server-side on every
request, never trusted from the client or from the offline queue.

**PERM-12** — Offline mutations carry no authority of their own. On replay they are
authorised exactly like a live request, using the teacher's permissions **at replay time**.
A teacher removed from a course cannot land logs from before the removal.

**PERM-13** — These actions always write an `AuditLog` row: attendance and progress edits or
voids, role and membership changes, login and setup-code issuance, permission-denied attempts
on staff endpoints, and later exports, points and warnings (decision 19.4).
