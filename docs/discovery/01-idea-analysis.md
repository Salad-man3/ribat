# Ribat — Idea Analysis

> **Stage:** Discovery (2026-09-17). Nothing here is decided yet.
> Decisions come from your answers in [02-questions.md](./02-questions.md).

---

## 1. The idea in one paragraph

Ribat is a multi-tenant SaaS that moves a mosque's teaching work off paper. It covers
Quran memorization circles and explanation (lesson) courses, attendance, progress logs,
tests, homework, points and leaderboards, warnings, activities, and reports to families.
It is an installable PWA that works offline for the two things teachers do during class
(taking attendance and logging progress). The beta runs in one real mosque.

---

## 2. Short verdict

**As a product:** the problem is real, a real user is within reach, and the workflows are
concrete (circles, pages, tests, attendance). The main product risk is adoption: teachers
must log during class on a phone, so it has to be faster than paper.

**As job-search proof:** this is the right project, **if it ships narrowly and gets used.**
The danger is repeating the last attempt. That attempt produced about 5,500 lines of spec
across 29 files (7 of them ADRs) and almost no code. A recruiter cannot see a spec, and
right now there is nothing public to see.

| Signal a reviewer checks | Today | After a shipped beta slice |
| --- | --- | --- |
| Public repo with real NestJS code | None | Yes |
| Live demo link | None | Yes (fake-data demo) |
| Tests running in CI | Workflow file, never ran | Green badge |
| Real usage | None | "Used weekly by one mosque: N students, M teachers" |
| Interview stories | None | Offline sync, tenant isolation, permissions, points ledger |

---

## 3. How recruiters and hiring engineers actually look at it

1. **Recruiter / ATS (seconds):** reads the CV line, looks for keywords and a live link.
   Does not care about the domain.
2. **Hiring engineer (5–15 minutes):** README → architecture diagram → one or two modules →
   tests → commit history → CI status. Will not read long docs.
3. **Interview (hours):** "walk me through this", "why did you pick X", "what breaks at
   100 mosques", "how do you know mosque A can't see mosque B's data".

### What your own job data says

A rough keyword count over **335 remote Node/NestJS postings** collected by your scanner
(`~/Programming/docs/job-search/data/jobs.sqlite`). These are simple regex matches, not a
scientific sample.

| Term | Share of postings |
| --- | --- |
| TypeScript | 65% |
| AWS | 50% |
| CI/CD | 42% |
| React | 41% |
| PostgreSQL | 41% |
| Observability (logging, monitoring, Sentry…) | 40% |
| Docker | 32% |
| Kubernetes | 32% |
| Testing (Jest, integration, e2e) | 25% |
| Microservices | 24% |
| NestJS | 20% |
| Redis | 19% |
| Queues (BullMQ, RabbitMQ, SQS…) | 16% |
| Prisma / TypeORM / Sequelize | ~2% each |
| Multi-tenant | 1% |
| Offline / PWA | 1% |

**What this means for Ribat:**

- **The ORM choice doesn't matter for keywords.** Pick the one that gets you moving fastest.
- **The things that show up often are all things Ribat can show naturally:** TypeScript,
  PostgreSQL, Docker, CI/CD, tests, observability, Redis and queues. AWS depends on
  where you can host (question 20.9).
- **A React PWA frontend helps** (41% mention React), but it must not eat the backend time.
- **Multi-tenancy and offline sync are rarely keywords.** They are *depth* signals for the
  interview, not search terms. Sell the project on "a production NestJS + PostgreSQL app
  used by a real organization", and keep tenancy and offline sync as the stories you tell.

### Target CV line (only true once shipped)

> Built and operate Ribat, a multi-tenant NestJS + PostgreSQL SaaS used weekly by a mosque
> school (N students, M teachers): offline-first attendance sync with idempotent replay,
> course-scoped permissions, queued notifications, e2e tests in CI, structured logging,
> deployed on X.

---

## 4. Why it fits your profile

- **Real users are the biggest differentiator.** Most junior portfolios are demos.
- **It closes your P0 gaps directly:** public Nest code, observability, e2e tests in CI,
  rate limiting (see `PROFILE.md`).
- **It isn't a repeat of Ghaya.** Ghaya showed content, gamification and Stripe. Ribat shows
  tenancy, permissions, offline sync, reporting and background jobs.
- **It gives you concrete interview stories:**

| Story | What an interviewer will ask |
| --- | --- |
| Offline sync | Idempotency keys, replay order, what happens when two people edit the same record offline |
| Tenant isolation | How you enforce it, and how you *test* it |
| Resource-scoped permissions | How a teacher is limited to their own students in their own course |
| Points ledger | Why append-only, how the leaderboard is computed, how automatic rules fire |
| Notifications and report cards | Queues, retries, scheduling, not spamming parents |
| Statistics | Aggregation queries, indexes, `EXPLAIN` (your P1 gap "SQL on camera") |
| Children's data | Privacy, audit log, field-level visibility |

---

## 5. Risks

| # | Risk | Why it matters | Mitigation |
| --- | --- | --- | --- |
| 1 | **Scope explosion.** The brief has ~14 features plus a SaaS layer, and the last attempt stalled at spec. | Nothing to show recruiters | Cut the beta to one weekly workflow. Spec only what is being built next. Ship small public PRs. |
| 2 | **Frontend and offline work is most of the effort.** Service workers, IndexedDB and RTL UI are frontend work. | Doesn't read as backend skill | Plain UI on a component library. I carry more of the frontend. Your hand-written effort goes into API, data model, sync endpoint and tests. |
| 3 | **Adoption.** Teachers stop if logging is slower than paper. | No real-usage claim | A "class mode" screen: log one student in ≤ 3 taps. Test with one teacher in the first week of the beta. |
| 4 | **Children's personal data.** | Trust, and an interview question you must be ready for | Real data only on the private production instance. Public demo uses fake seed data. No photos in beta. Audit log. Tested backups. |
| 5 | **Not being able to defend AI-written code in interviews.** | Your profile promises "can walk through it line by line" | You write the core modules by hand. I scaffold, review and write supporting code (question 20.7). |
| 6 | **Syria-specific infrastructure:** paying for hosting, SMS to +963 numbers, iPhone web push only works after "Add to Home Screen", power and internet cuts. | Blocks deploy or notifications | A host you can actually pay for. No SMS in beta. In-app plus web push notifications. Offline where it matters. |
| 7 | **Public repo vs. a SaaS business.** Anyone can self-host public code. | Matters only if the business is a goal | Decide the license (question 19.5). |
| 8 | **Stale files contradict the new direction.** `README.md` claims a working API + PWA that doesn't exist. The `.cursor/rules` lock old decisions (invite codes, no exams, `academic_lead` naming). | Pushing the README as-is would hurt credibility | Rewrite after your answers. Don't push the current README. |

**On the mosque domain:** reviewers judge the engineering and the real usage. The README
only needs a short glossary for non-Arabic readers (halaqa, hifz, muraja'ah, sheikh).
Whether the public framing says "mosque" or a neutral "community school" is question 1.9.

---

## 6. What the system needs

### Backend modules

| Module | Contents |
| --- | --- |
| Identity and auth | Login, sessions, password reset path, SaaS-owner bootstrap from an env var |
| Organizations | Tenants, memberships, roles, admin ↔ member view switch |
| Authorization | Role checks plus course- and group-scoped checks, field-level visibility |
| Members and families | Profiles, guardian links, siblings, info card |
| Courses | Type (memorization / explanation), schedule, enrollment, teachers, hierarchical groups |
| Materials | CRUD for course sources |
| Progress | Memorization logs and tests; explanation page logs |
| Attendance | Marking, corrections, offline sync endpoint with idempotency |
| Homework | Assign, mark done |
| Points | Append-only ledger, automatic rules, manual entries, leaderboard |
| Warnings | Issue, publish to family, acknowledge |
| Activities | Course-level and mosque-level (needs clarification, question 0.3) |
| Notifications | In-app inbox, web push, report cards, background jobs |
| Statistics | Aggregations for sheikh, admin, teachers and SaaS owner |
| Audit log | Who changed what, when |
| SaaS owner console | Create, suspend and monitor mosques |

### Frontend (PWA)

Installable app shell. Arabic RTL (plus English?). Service worker. IndexedDB cache and an
outbox queue for offline writes. Role-based navigation. A teacher "class mode" screen.

### Platform and operations

Monorepo. CI (lint, typecheck, unit tests, e2e tests against real Postgres). Docker.
Deployment. Migrations. Seed data for a fake demo mosque. Backups. Structured logs with
request IDs. Error tracking. Health checks. Rate limiting. OpenAPI docs.

### Documentation (lean on purpose)

README for reviewers, one architecture diagram, domain model and ERD, permission matrix,
generated API docs, about five short ADRs, and a small runbook. **Target: a reviewer
understands the project in 10 minutes.**

---

## 7. Recommended way forward

1. **You answer [02-questions.md](./02-questions.md).** Start with the `[now]` questions.
2. **I write the lean spec:** beta scope, domain model and ERD, permission matrix, the key
   flows (offline attendance, memorization log, hierarchical course), and ADRs for the
   stack.
3. **I set up the working environment:** `CLAUDE.md` (replacing the outdated Cursor rules),
   monorepo scaffold, Docker Postgres, lint and tests, CI, an honest README.
4. **We build in vertical slices.** Each slice is merged by PR into a public repo and deployed.
   A possible order, to be confirmed by your answers:

| Slice | Contents | Milestone |
| --- | --- | --- |
| S1 Foundation | Auth, mosque setup, roles, members and guardians, deploy, CI, logging | Public repo and live link exist |
| S2 Courses | Types, teachers, hierarchical groups, materials, schedule | |
| S3 Class mode | Attendance and progress logging, offline | **Mosque beta starts, CV line becomes true** |
| S4 Families | Info card, schedule view, notifications, warnings, report cards | |
| S5 Motivation | Points (automatic and manual), leaderboard, homework | |
| S6 Admin | Statistics, activities, SaaS owner console | |

---

## 8. What I found in the repo

- **The old spec is in the trash, not lost.** `docs/` was moved to trash on 2026-09-17 at
  19:49: `~/.local/share/Trash/files/docs` (product) and
  `~/.local/share/Trash/files/engineering`. The old `apps/` scaffold (trashed 2026-09-12)
  is there too. Restore from your file manager if you want any of it back.
- **The files still in the repo describe the old design:** `README.md`,
  `.cursor/rules/*.mdc`, `.github/workflows/ci.yml`.
- **The branch is `master` with no commits yet.** The expected main branch is `main`.
- **`PROFILE.md` says "Ribat is a specification; no code exists yet."** That is still true.
