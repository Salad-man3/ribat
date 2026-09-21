# Ribat — Decision Record (discovery answers)

> **Source:** the answers to [02-questions.md](./02-questions.md), given 2026-09-18.
> This is the record the spec is built on. If a spec statement and this file disagree,
> this file wins until the spec is corrected.

Legend: **D** = accepted my suggested default · **U** = the user's own answer.

---

## 0. Brief clarifications

| # | Decision | |
| --- | --- | :-: |
| 0.1 | The duplicated `activities` table was a typo. One activities table. | U |
| 0.2 | Materials CRUD: the sheikh and the org admin. (See conflict [OQ-3](../product/01-scope.md#open-questions).) | U |
| 0.3 | One activity model. Some activities are limited to a course's members; others are assigned manually by criteria such as age. | U |
| 0.4 | Leaderboard is **per course**, switched on by the sheikh or org admin. Only that course's members see it and appear on it. | U |
| 0.5 | **Guardian is a fifth user type.** | U |

## 1. Goals, beta, timeline

| # | Decision | |
| --- | --- | :-: |
| 1.1 | Priority: (a) get a backend job first; (b) mosque uses it weekly and (c) real SaaS business are also goals. | U |
| 1.2 | Public repo + live demo: **2 weeks to 1 month**. The mosque is not waiting. **40 hours/week** available. | U |
| 1.3 | Pilot: **200 students, 10 teachers, 4 courses, 1 sheikh, 3 admins**, ages **5–30**, all groups. | U |
| 1.4 | Today they use paper and WhatsApp groups. Biggest pain: **time spent managing everything, and communicating with students and parents**. | U |
| 1.5 | Beta success: every halaqa takes attendance and logs memorization in the app, 4 weeks in a row. | D |
| 1.6 | The user is the **org admin of the first mosque**. No existing Excel data — members are entered by hand. | U |
| 1.7 | Business model (later): paid **plans based on member count** and storage needs. | U |
| 1.8 | Start fresh from the old spec; re-decide the stack in section 20. | D |
| 1.9 | Name stays **Ribat**. UI and README say mosque and sheikh. Code uses `Organization` and role `SHEIKH`. | D |

## 2. Users, roles, accounts

| # | Decision | |
| --- | --- | :-: |
| 2.1 | SaaS owner sees no mosque data — organization-level info and aggregates only. | D |
| 2.2 | Sheikh and org admin have the same permissions, **except only the sheikh can create org admin accounts**. | U |
| 2.3 | Unlimited org admins. **Exactly one sheikh** per mosque for now. | U |
| 2.4 | One login per person. The org admin (and the sheikh) switch between admin view and their personal member view. | D |
| 2.5 | A member can teach course A and study in course B at the same time. | D |
| 2.6 | A guardian has a login, is linked to one or more children, and does not have to study at the mosque. | D |
| 2.7 | Under 12: no login, the guardian sees everything. From 12: own login. | D |
| 2.8 | When creating a member, the admin or sheikh can link an existing sibling or create one, and link one or more guardians the same way. | U |
| 2.9 | **No gender separation** for now. | U |
| 2.10 | A person may belong to two mosques, but must switch accounts — each mosque is a separate tenant. | U |
| 2.11 | A teacher sees only their own course, and only their own group when groups are on. Sheikh and admin see everything. | D |
| 2.12 | Teachers can write **notes about a student for the sheikh to read**. Not visible to guardians. | U |

## 3. Login and security

| # | Decision | |
| --- | --- | :-: |
| 3.1 | Phone number + password. The admin creates the account and hands over a one-time code to set the password. | D |
| 3.2 | Forgotten password: the admin issues a new one-time code. | D |
| 3.3 | No self-signup in the beta. Admins create all accounts. | D |
| 3.4 | The SaaS owner account is seeded from an environment variable; the secret is stored hashed and never committed. | D |
| 3.5 | Teachers use their own phones. | U |
| 3.6 | **Users never get logged out.** (Handling: [OQ-6](../product/01-scope.md#open-questions).) | U |

## 4. Courses and structure

| # | Decision | |
| --- | --- | :-: |
| 4.1 | No level layer above courses. A course can carry **requirements**: material memorized, a course already taken, or a manual condition such as age. | U |
| 4.2 | Course page shows linked materials, teachers and progress. Clicking a teacher or student opens their page, with a back button in the top bar. | U |
| 4.3 | A course can be **both types**. Explanation progress is shown once for the class; each student's memorization progress is listed under it. | U |
| 4.4 | The sheikh or admin enrolls students directly. No join requests, no waitlist. | D |
| 4.5 | *(not answered — see [OQ-1](../product/01-scope.md#open-questions))* | — |
| 4.6 | Sessions are generated from the weekly schedule; the teacher can add or cancel one. | D |
| 4.7 | A class time is either a fixed clock time or **anchored to a prayer** ("from Asr to 6pm"). | U |
| 4.8 | Show **both** Hijri and Gregorian dates. | U |
| 4.9 | A course can be paused (Eid, exams) so no absences are recorded. | U |

## 5. Teachers and groups

| # | Decision | |
| --- | --- | :-: |
| 5.1 | A normal course has one lead: the sheikh or a member. | D |
| 5.2 | Several teachers without groups: every teacher may log for every student. | U |
| 5.3 | With groups on: each teacher sees and logs only their own students. Sheikh and admin can log for anyone. | D |
| 5.4 | **A student can have a different teacher for each material.** | U |
| 5.5 | Logs keep their author; assignment history is kept. | D |
| 5.6 | A toggle cannot be switched off while assignments exist. | D |
| 5.7 | Two levels maximum: course → teachers → students. | D |
| 5.8 | A teacher must already be a member; their login can come later. | D |
| 5.9 | Only the sheikh and admin add or remove students in a group. | D |
| 5.10 | The sheikh sees which teachers didn't log today. | D |
| 5.11 | Teachers' own attendance is tracked (later). | U |

## 6. Memorization

| # | Decision | |
| --- | --- | :-: |
| 6.1 | Quran built in, plus a generic model for other texts (mutoon, hadith). | D |
| 6.2 | The teacher picks an ayah range; the app calculates pages. **604-page Madinah mushaf.** | D |
| 6.3 | Only two log types: **new memorization** and **revision**. | U |
| 6.4 | Each recitation records a grade (excellent / very good / good / repeat), a mistake count, and an optional note. | D |
| 6.5 | One test per juz, scored out of 100, pass mark set per course, all attempts kept. | D |
| 6.6 | Progress is a set of memorized ranges, so any memorization order works. | D |
| 6.7 | Memorization is a **lifetime record**, each log tagged with the course it happened in. | D |
| 6.8 | **No** targets or plans. | U |
| 6.9 | Memorization from before joining can be entered as a starting level. | U |

## 7. Explanation courses and materials

| # | Decision | |
| --- | --- | :-: |
| 7.1 | Page progress is logged once per class or group, not per student. | D |
| 7.2 | Materials use **pages only**, plus a free-text note per session. | U |
| 7.3 | Links only, no file uploads. | U |
| 7.4 | A log entry covers page from → to per material, several materials per session, with notes. | U |
| 7.5 | Only the sheikh and admin edit materials. | U |
| 7.6 | Optional quiz scores in explanation courses come later. | D |
| 7.7 | Absent students see what they missed (later). | U |

## 8. Attendance

| # | Decision | |
| --- | --- | :-: |
| 8.1 | Four statuses: present, absent, late, excused. | U |
| 8.2 | The person who marked it can edit the same day; sheikh and admin any time; every edit is logged. | D |
| 8.3 | Guardians can submit an excuse ahead of time. | U |
| 8.4 | Absences are sent to guardians as an **end-of-day summary**. | D |
| 8.5 | **No automatic warnings.** Warnings are manual text. | U |
| 8.6 | An unmarked session stays "not taken" and the sheikh is alerted. | D |
| 8.7 | Activities may be one-time or repeating. (Attendance conflict: [OQ-2](../product/01-scope.md#open-questions).) | U |

## 9. Offline

| # | Decision | |
| --- | --- | :-: |
| 9.1 | Expect to be offline for a whole class. | U |
| 9.2 | Personal phones, mostly Android, a few iPhones. | U |
| 9.3 | Offline class kit: my courses, today's sessions, student lists, each student's last position. Writes: attendance and progress. | D |
| 9.4 | Latest change wins, both versions kept in history, the overridden person is told. Progress logs are append-only; duplicates caught by idempotency key. | D |
| 9.5 | An already-logged-in teacher can open the app offline. A fresh login needs internet. | D |
| 9.6 | A badge counts unsynced changes, plus a "last synced" time. | D |

## 10. Homework

| # | Decision | |
| --- | --- | :-: |
| 10.1 | The teacher assigns a task with a due date and marks it done or not done. No uploads. | D |
| 10.2 | Homework targets a **group (حلقة), a course, or a single student**. | U |
| 10.3 | **No points and no warnings** attached to homework. | U |
| 10.4 | Guardians see homework and get reminders. | U |

## 11. Points and leaderboard

| # | Decision | |
| --- | --- | :-: |
| 11.0 | **The whole points system is optional and can be switched off.** | U |
| 11.1 | Automatic point rules are set org-wide by the sheikh or admin, and a course can override them. | D |
| 11.2 | Teacher, sheikh and admin may give manual points. A reason is required, negatives allowed, no limit, everything logged. | D |
| 11.3 | Points are counted both per course and as a total per student. | D |
| 11.4 | Points are for ranking only — no rewards store. | D |
| 11.5 | Leaderboard scope: per course. Period: configured per course. **No reset.** | U |
| 11.6 | Every member of a course sees that course's leaderboard. | U |
| 11.7 | Group competitions: optional, later. | U |

## 12. Warnings

| # | Decision | |
| --- | --- | :-: |
| 12.1 | A warning is **free text** — no types, no levels. | U |
| 12.2 | Issued manually only. | U |
| 12.3 | The teacher proposes; the sheikh or admin sends it to the family. | D |
| 12.4 | No read receipt, no expiry, **may deduct points**. | U |

## 13. Activities

| # | Decision | |
| --- | --- | :-: |
| 13.1 | Examples: trip, camp, iftar, football training, martial arts, swimming. | U |
| 13.2 | No guardian approval. Any member can be enlisted manually. | U |
| 13.3 | No fee tracking in the beta. | D |
| 13.4 | Activities have no attendance, points or capacity. (Conflicts with 8.7 → [OQ-2](../product/01-scope.md#open-questions).) | U |

## 14. Member card

| # | Decision | |
| --- | --- | :-: |
| 14.1 | Fields: full name (first / father / family), mother's name, birth date, phone, address, school grade and name, join date, notes, linked guardians and siblings, progress per material. **No national ID, no photo.** Previous courses' progress and teacher notes are reachable from the card. | U |
| 14.2 | A teacher sees only name, phone, grade/age and progress **in the course they teach**. Sheikh and admin see everything. | U |
| 14.3 | A parent may exist as contact info only (name + phone) and be upgraded to an account later. | U |
| 14.4 | Card progress: memorization (total, last position, tests), materials (pages covered, attendance %), points, warnings, homework completion. | U |
| 14.5 | WhatsApp button to the parent, as a plain `wa.me` link. | D |
| 14.6 | A member who leaves gets a status change and is archived. | U |

## 15. Notifications and report cards

| # | Decision | |
| --- | --- | :-: |
| 15.1 | In-app inbox plus web push, and a WhatsApp share link for report cards. | D |
| 15.2 | Recipients per event — S student, G guardian, T teacher: absence `G T` · late `G T` · warning `G T S` · test result `G T S` · report card `G T S` · homework assigned `G S` · homework missed `G T S` · schedule change `G T S` · activity invitation `G S` · points milestone *(nobody)* · announcement `G T S`. | U |
| 15.3 | Report cards are **generated manually** and shown as an **in-app page**. | U |
| 15.4 | The sheikh can send announcements to a group. | U |
| 15.5 | No quiet hours, no digests (the end-of-day absence summary in 8.4 stays). | U |

## 16. Schedule

| # | Decision | |
| --- | --- | :-: |
| 16.1 | Members and guardians see a weekly timetable of their courses and activities. | U |
| 16.2 | A teacher who also studies sees both schedules combined. | U |

## 17. Statistics

| # | Decision | |
| --- | --- | :-: |
| 17.1 | The sheikh's weekly numbers: attendance rate per course and teacher, pages memorized this week, tests passed, top students, teachers who haven't logged. | U |
| 17.2 | Teachers see stats for their own groups; guardians see their child's trends as charts. | U |
| 17.3 | SaaS owner statistics: my choice. | U |
| 17.4 | No Excel or PDF export for now. | U |
| 17.5 | Nightly refresh is fine. | D |

## 18. Language, UI, devices

| # | Decision | |
| --- | --- | :-: |
| 18.1 | Arabic (RTL) and English from day one. | D |
| 18.2 | Every role may use phone or laptop. | U |
| 18.3 | Visual design is my call. | U |
| 18.4 | A dedicated class-mode screen for teachers. | D |
| 18.5 | No TV leaderboard. | U |

## 19. Data, privacy, licence

| # | Decision | |
| --- | --- | :-: |
| 19.1 | Real data only in production; the public demo uses fake data in a separate database. | U |
| 19.2 | Consent is given, and the agreement must state that data is **private and never shared**. | U |
| 19.3 | Members who leave are archived. Guardians cannot request deletion. | U |
| 19.4 | Audit: every edit or delete of attendance, progress, points and warnings; role changes; exports; logins. | D |
| 19.5 | Licence: **AGPL**. | U |

## 20. Stack

| # | Decision | |
| --- | --- | :-: |
| 20.1 | NestJS + TypeScript + PostgreSQL. | D |
| 20.2 | Prisma. | D |
| 20.3 | `organizationId` on every table with scoped queries and isolation tests; Row-Level Security added after the beta. | D |
| 20.4 | Redis + BullMQ, starting with the notifications slice. | D |
| 20.5 | Own authentication with httpOnly cookie sessions. | D |
| 20.6 | React + Vite PWA, TanStack Query, Dexie. | D |
| 20.7 | *(skipped — see [OQ-4](../product/01-scope.md#open-questions))* | — |
| 20.8 | Zod schemas in a shared package, used by API and PWA. | D |
| 20.9 | Hosting: whatever can reliably be paid for, AWS preferred for the CV. (Still undecided in practice: [OQ-5](../product/01-scope.md#open-questions).) | D |
| 20.10 | Environments: production, public demo, local. No staging. | D |
| 20.11 | Pino JSON logs, request IDs, Sentry, uptime check, health endpoints. | D |
| 20.12 | Unit tests for domain rules; e2e tests against real Postgres covering permissions and tenant isolation. No coverage target. | D |
| 20.13 | REST with OpenAPI; Swagger UI public on the demo. | D |
| 20.14 | `@nestjs/throttler` on login and sync endpoints. | D |
| 20.15 | pnpm workspaces monorepo with Turborepo. | D |
| 20.16 | Public GitHub repo, `main` branch, feature branches → PR with CI → squash merge, conventional commits. | D |
| 20.17 | **Keep both** `CLAUDE.md` and `.cursor/rules`, in sync — the user works with Cursor and Claude. | U |
| 20.18 | No WebSockets in the beta. | D |

## 21. Beta scope

Beta: login and admin-created accounts · mosque setup, roles, admin ↔ member switch ·
members, guardians, siblings · member card · courses (both types) · teacher assignment and
groups · materials CRUD · memorization log and tests · explanation page log · attendance ·
offline attendance and progress · schedule view · in-app notifications · **homework**.

After beta: Excel import · web push · report cards · warnings · points · leaderboard ·
statistics dashboard · SaaS owner console.

Later: activities · mosque self-signup · SMS/WhatsApp automation · billing · an assistant
that acts in the app, over MCP.

---

## 22. Added after the answers

| # | Decision | Date | |
| --- | --- | --- | :-: |
| 22.1 | An assistant a person chats with in Arabic, able to carry out tasks in the app on their behalf. Exposed as an MCP server first, so the person brings their own model; an in-app chat panel reuses the same tools later. Sequenced after S6, off by default, and bound by the same permissions and audit log as any other caller — specified in [01-scope.md §4.6](../product/01-scope.md). | 2026-09-19 | U |
