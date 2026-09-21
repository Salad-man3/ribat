# 01 — Scope and delivery plan

> Built from [discovery/03-answers.md](../discovery/03-answers.md). IDs here are stable
> (`SC-*`, `OQ-*`) and are referenced by the engineering documents.

---

## 1. The product

Ribat digitises a mosque's teaching work. Members study in courses that either **memorize**
(Quran or a text) or **explain** (a book, page by page), often both at once. Teachers record
attendance and progress during class, on their own phones, usually with no internet. Families
follow their children's schedule, progress and messages in the same app.

**Pilot mosque:** 200 students · 10 teachers · 4 courses · 1 sheikh · 3 org admins ·
ages 5–30. Today everything runs on paper and WhatsApp groups. The sheikh's pain is the
time it takes to manage it all and to communicate with students and parents.

**The user of this project is also the org admin of the pilot mosque**, which means the
pilot's data entry and feedback loop are in his own hands.

---

## 2. Goals, in priority order

| # | Goal | What it implies |
| --- | --- | --- |
| G1 | **Get a backend job** | Public repo and live demo within 2–4 weeks, clean NestJS code, tests in CI, observability, a README a reviewer can read in ten minutes |
| G2 | The mosque uses it weekly | Class mode must be faster than paper, and must work offline |
| G3 | A real SaaS business later | Multi-tenant from the first migration; plans priced by member count come much later |

When G1 and G2 conflict — for example, polish for the mosque versus tests and documentation
— **G1 wins**, because the mosque is not waiting for a delivery date.

---

## 3. Beta definition of done

**SC-DOD:** every halaqa records attendance and logs memorization in the app for **four
consecutive weeks**, with no paper fallback.

Supporting conditions:

| # | Condition |
| --- | --- |
| SC-DOD-1 | A teacher can mark a full group's attendance and log each student's progress with no internet, and it syncs afterwards without duplicates |
| SC-DOD-2 | The sheikh can see, the same evening, who attended and what was memorized |
| SC-DOD-3 | A guardian can see their child's schedule, attendance and progress |
| SC-DOD-4 | The public demo runs the same code with fake data, and anyone can log in as each role |

---

## 4. Scope

### 4.1 Beta

| # | Feature | Notes |
| --- | --- | --- |
| SC-B-01 | Login, admin-created accounts, one-time setup codes | Phone + password |
| SC-B-02 | Mosque setup, the four roles, admin ↔ member view switch | One sheikh, unlimited admins |
| SC-B-03 | Members, guardians, siblings, archiving | Guardian may be contact-only |
| SC-B-04 | Member card with progress and teacher notes | Field visibility per role |
| SC-B-05 | Courses: memorization, explanation, or both | Requirements field stored, checked softly |
| SC-B-06 | Teacher assignment, hierarchical toggle, groups per material | A student may have one teacher per material |
| SC-B-07 | Materials CRUD (links only, pages only) | Sheikh and admin |
| SC-B-08 | Memorization log (new / revision) and juz tests | Lifetime record, ayah ranges → pages |
| SC-B-09 | Explanation page log, per class or group | With session notes |
| SC-B-10 | Attendance: present, absent, late, excused | Corrections audited |
| SC-B-11 | **Offline** attendance and progress logging | The heart of the beta |
| SC-B-12 | Weekly schedule for members and guardians | Fixed or prayer-anchored times, Hijri + Gregorian |
| SC-B-13 | In-app notifications | Including the end-of-day absence summary |
| SC-B-14 | Homework: assign to course, group or student; mark done | No uploads, no points |

### 4.2 After the beta

Excel import · web push · report cards (manual, in-app) · warnings (free text, teacher
proposes → sheikh publishes, may deduct points) · points (optional, org rules with course
overrides) · per-course leaderboard · statistics dashboard · SaaS owner console.

### 4.3 Later

Activities (one-time and repeating) · mosque self-signup · SMS and WhatsApp automation ·
billing by member-count plans · teacher attendance · missed-content view · group
competitions · guardian charts · an assistant that acts inside the app, over MCP (§4.6).

### 4.4 Out of scope

| # | Item | Reason |
| --- | --- | --- |
| SC-OUT-1 | Gender-separated data access | Not needed at the pilot |
| SC-OUT-2 | Memorization targets and plans | Explicitly rejected |
| SC-OUT-3 | Automatic warnings from absences | Warnings are manual only |
| SC-OUT-4 | Points or warnings tied to homework | Explicitly rejected |
| SC-OUT-5 | Rewards store, TV leaderboard, read receipts | Explicitly rejected |
| SC-OUT-6 | File uploads, national ID, photos | Storage, privacy |
| SC-OUT-7 | Export to Excel or PDF | Not now |
| SC-OUT-8 | WebSockets / live dashboards | Nightly aggregates are enough |
| SC-OUT-9 | Guardian-requested data deletion | The mosque archives instead |

### 4.5 Self-hosting and the hosted service

Ribat is an open source product **and** a paid multi-tenant service that handles hosting,
updates, backups and support ([ADR-0008](../engineering/adr/0008-distribution-model.md)). Both
run the same code, so the requirements below are engineering constraints, not a later port.

| # | Requirement | When |
| --- | --- | --- |
| SH-01 | Every setting comes from environment variables. Nothing assumes Damascus: timezone, weekend days, prayer method, mushaf page map and default locale are all configuration | S1 |
| SH-02 | `DEPLOY_MODE=self_host` runs one organization with no platform-owner surface; `DEPLOY_MODE=hosted` runs multi-tenant with provisioning | S1 |
| SH-03 | `docker compose up` with a documented `.env.example` brings up API, database and Redis | S1 |
| SH-04 | First run is a browser setup page (organization + sheikh), not a CLI command (WF-01) | S1 |
| SH-05 | Tagged releases with a CHANGELOG, published images, and expand-then-contract migrations that are safe for a deployment several releases behind | From S1, enforced at every release |
| SH-06 | `INSTALL.md`, `SECURITY.md` with a disclosure address, `CONTRIBUTING.md` with the DCO sign-off | After the beta |
| SH-07 | Export and import of a whole organization, so a self-hoster can move onto the hosted service and back | Later |
| SH-08 | No telemetry and no phone-home. Any future usage reporting is opt-in | Always |

Deliberately **not** done: paid-only features, licence checks in the application, community
infrastructure (issue templates, translations beyond Arabic and English, plugin points).
Plan limits are applied when the control plane provisions an organization, never as a payment
check inside the product.

### 4.6 Assistant and MCP (later)

A chat where a person asks for something in plain Arabic — *"who was absent in halaqa 2 this
week?"*, *"mark today's attendance for group B"*, *"send Ahmad's guardian this month's
summary"* — and the assistant answers from that person's own data, or carries out the action
on their behalf.

Two shapes, and they are not the same product:

| Shape | What it is | Who runs the model |
| --- | --- | --- |
| **A — in-app assistant** | A chat panel inside Ribat. The API hosts the agent loop and calls its own use-cases as tools | The deployment, with a configured provider key |
| **B — MCP server** | Ribat exposes an MCP endpoint. The sheikh connects his own Claude or ChatGPT and runs his mosque from there | The person's own client, at their own cost |

**Shape B ships first.** It carries no model budget and adds no provider dependency to the
product, and the work is a thin transport over machinery that already exists — the tool
surface *is* the API and its permission layer. Shape A then reuses the same tool definitions
behind a chat UI.

Sequenced after S6. None of it is built before the beta runs.

| # | Requirement |
| --- | --- |
| AI-01 | The assistant is a caller, not a role. Every tool call carries the acting person's session and passes the same tenant scoping and permission checks as an HTTP request ([03-permissions.md](../engineering/03-permissions.md)). No service account, no elevated token, no bypass — a teacher's assistant cannot reach another course, and the platform owner's reaches no tenant data at all (PERM-02) |
| AI-02 | Tools are the existing use-cases, adapted. No second write path, no raw SQL, no invariant that holds in the API and not through a tool |
| AI-03 | Every write made through the assistant lands in the audit log as the person who asked, marked `via=assistant`, with the tool call that produced it. Staff can see exactly what the assistant did and on whose instruction |
| AI-04 | Reads run freely; a write is proposed and confirmed by the person before it commits. Anything touching more than one member always confirms, and anything that reaches a family always confirms |
| AI-05 | Never on the critical path. Key absent, provider down or quota spent — the app behaves exactly as it does without it, and class mode is untouched (NFR-04) |
| AI-06 | Prompts would carry children's names, attendance and progress. Off by default; enabling it is an explicit per-organization setting that names the provider, and only providers with no-training, no-retention terms qualify. This is the same line SC-OUT-6 draws on photos and national IDs |
| AI-07 | Self-hosting: disabled unless a provider is configured (SH-01). No default key, no shared gateway, no phone-home (SH-08). A local model behind an OpenAI-compatible endpoint is a valid provider, for a mosque that will not send data anywhere |
| AI-08 | Text written by members — teacher notes, homework, names — is untrusted input inside a prompt. Tools take IDs, never free text that becomes a filter, and the model never supplies the organization scope |
| AI-09 | Per-organization rate and cost caps, with usage visible to staff |
| AI-10 | Answers in the person's locale, with Hijri and Gregorian dates (NFR-01, NFR-02) |

Open, and deliberately undecided: whether guardians get it at all; whether it may send
anything to a family or only draft it; and who pays for shape A on the hosted service.

---

## 5. Delivery slices

Each slice ends with a merged PR on the public repo, CI green, and the demo redeployed.

| Slice | Contents | Exit criteria |
| --- | --- | --- |
| **S1 Foundation** | Monorepo, Docker Postgres, CI, migrations, auth (SC-B-01), organization + roles + view switch (SC-B-02), members, guardians, siblings (SC-B-03), member card (SC-B-04), logging and health endpoints, deploy, honest README, **self-host mode and first-run setup (SH-01…SH-05)** | **Public repo and live demo exist**, and a stranger can run it with `docker compose up`. G1's first milestone |
| **S2 Courses** | Courses and both types (SC-B-05), teachers, hierarchy toggles and groups (SC-B-06), materials (SC-B-07), schedule and session generation (SC-B-12) | The pilot's 4 courses can be set up for real |
| **S3 Class mode** | Attendance (SC-B-10), memorization log and tests (SC-B-08), explanation log (SC-B-09), offline kit, client outbox and sync (SC-B-11), `MemorizationSummary` with its rebuild command and drift test ([ADR-0010](../engineering/adr/0010-read-models.md)) | **Mosque beta starts.** The CV line becomes true |
| **S4 Families** | Guardian portal, weekly timetable, in-app notifications and the absence summary (SC-B-13), homework (SC-B-14), and the first reactions: domain events on a transactional outbox, dispatcher, dead letters and the failed-events view ([ADR-0009](../engineering/adr/0009-events-and-outbox.md)) | Guardians stop asking WhatsApp for basics |
| **S5 After beta** | Report cards, warnings, points, leaderboard, statistics, web push, Excel import. Points and statistics subscribe to existing events rather than editing the writing services | The event decoupling pays for itself |
| **S6 Later** | Activities, SaaS owner console, self-signup, and the private control plane: billing, provisioning, plan limits, organization export (SH-07) | The hosted service can take a paying mosque |

### 5.1 Timeline reality

At 40 hours a week, **S1 fits in the first week and S2–S3 in the following two to three
weeks**, provided the UI stays plain and most effort goes to the API, the data model and the
sync contract.

The beta list (SC-B-01…14) is larger than the 2–4 week window comfortably holds. If time runs
short, cut in this order and move the items to S5:

1. Homework (SC-B-14)
2. In-app notifications beyond the absence summary (SC-B-13)
3. The guardian's weekly timetable (SC-B-12) — keep session generation, drop the view

**Do not cut** offline (SC-B-11) or the memorization log (SC-B-08): without them there is no
beta and no interview story.

### 5.2 Entering the pilot's data

There is no Excel file to import, and 200 members entered by hand is hours of typing. Excel
import is an after-beta feature, so **S1 ships a small seed/import script** (CSV → database,
run by the developer, not a UI). It costs little and saves the pilot.

---

## 6. Non-functional requirements

| # | Requirement |
| --- | --- |
| NFR-01 | Arabic (RTL) and English from day one; all copy translated in both |
| NFR-02 | Hijri **and** Gregorian dates everywhere a date is shown |
| NFR-03 | Works on personal Android phones (mostly) and a few iPhones, from 320px width |
| NFR-04 | Class mode works fully offline for the duration of a class, then syncs |
| NFR-05 | Marking one student's attendance and progress takes at most three taps |
| NFR-06 | Scale target: 200 members, 10 teachers, 4 courses per mosque; queries must stay indexed for 10× that |
| NFR-07 | Every tenant-owned query is scoped by `organizationId`; cross-tenant access returns 404 |
| NFR-08 | Structured JSON logs with a request ID on every request; no PII in logs |
| NFR-09 | Daily encrypted database backup, off-site, with a tested restore |
| NFR-10 | Statistics may be up to 24 hours old (nightly aggregation) |
| NFR-11 | A fresh deployment needs no code change: configuration only, with no default secrets and a refusal to start on a missing one |
| NFR-12 | Upgrades are safe for a deployment several releases behind: no destructive migration without a prior release that made it safe |

---

## 7. Open questions

These block or shape work that is already in the plan. Everything else can be decided as we
build.

| # | Question | Blocks | My recommendation |
| --- | --- | --- | --- |
| **OQ-1** | **Course lifecycle** (4.5 was unanswered): what happens when a course finishes? | S2 | Draft → active → paused → finished → archived. Finished means read-only, history stays on the member card. No certificates. |
| **OQ-2** | **Activity attendance conflict:** 8.7 says activities have attendance, 13.4 says they don't. | S6 only | Follow 13.4: no attendance, points or capacity for activities. Revisit when activities are built. |
| **OQ-3** | **Material CRUD conflict:** 0.2 includes teachers, 7.5 says sheikh and admin only. | S2 | Sheikh and admin create and edit materials. A course's lead teacher may add a material to their own course; other teachers cannot. |
| **OQ-4** | **Who writes what** (20.7 skipped). This one matters for G1: you must be able to explain the core in interviews. | Now | You hand-write auth, permissions, tenant scoping, the sync endpoint and the memorization model. I do scaffolding, frontend, tests and review. |
| **OQ-5** | **Hosting:** which provider can you actually pay for, what is the monthly budget, and do you own a domain? | **S1 deploy** | Decide before the end of S1. If a card works, AWS Lightsail or a small EC2 + RDS gives the CV keyword; otherwise a VPS with Docker Compose. |
| **OQ-6** | **"Never log out" (3.6)** — how to keep that safe on a lost or borrowed phone. | S1 | A one-year rolling session, revocable server-side, with a device list and "sign out everywhere"; require the password again for account and role changes. |
| **OQ-7** | **Leaderboard period** (11.5, "periods per course"): does each course choose weekly / monthly / all-time, with no reset? | S5 | Yes — a per-course setting, all-time by default, never reset. |
| **OQ-8** | **Report card contents** (15.3): which numbers appear on the manually generated page? | S5 | Attendance %, memorization in the period, test results, homework completion, teacher comment. |
| **OQ-9** | **Prayer-time source** for prayer-anchored class times: computed from coordinates, or entered per mosque? | S2 | Computed with the `adhan` library from the mosque's coordinates and method, with a manual per-prayer offset — the same approach as your `masjid-prayer-widget`. |
| **OQ-10** | **Multi-mosque identity** (2.10): one login that switches mosque, or a separate account per mosque? | S6 | One identity, one membership per mosque, an explicit switcher. The schema already supports it; the UI comes later. |

**OQ-4 and OQ-5 need answers this week.** The rest can wait for their slice.
