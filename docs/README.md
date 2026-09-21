# Ribat documentation

Ribat is a multi-tenant SaaS that runs a mosque's teaching work: courses (Quran
memorization and book explanation), attendance, progress, homework, and communication with
families. It is an installable PWA that keeps working offline during class.

**Stage:** specification. No code yet. Pilot: one mosque, ~200 students.

## Read in this order

| # | Document | What it answers |
| --- | --- | --- |
| 1 | [product/01-scope.md](./product/01-scope.md) | What the beta includes, what it doesn't, in which order it ships, and what is still open |
| 2 | [engineering/01-architecture.md](./engineering/01-architecture.md) | Stack, repo layout, environments, security, observability |
| 3 | [engineering/02-domain-model.md](./engineering/02-domain-model.md) | Entities, ERD, invariants |
| 4 | [engineering/03-permissions.md](./engineering/03-permissions.md) | Roles, permission matrix, field visibility |
| 5 | [engineering/04-workflows.md](./engineering/04-workflows.md) | The flows the app must support, step by step |
| 6 | [engineering/05-offline-sync.md](./engineering/05-offline-sync.md) | The offline contract: cache, queue, conflicts |
| 7 | [engineering/06-api-outline.md](./engineering/06-api-outline.md) | REST endpoints per module |
| 8 | [engineering/07-events-and-jobs.md](./engineering/07-events-and-jobs.md) | Event catalogue, the outbox dispatcher, background jobs, failure playbook |
| 9 | [engineering/08-scaling-notes.md](./engineering/08-scaling-notes.md) | Where the first limits are and what the answer is — reasoning, not built work |
| 10 | [engineering/09-local-development.md](./engineering/09-local-development.md) | Commands, environment variables, seeded data, troubleshooting |
| 11 | [engineering/10-testing-strategy.md](./engineering/10-testing-strategy.md) | Test levels, the non-negotiable suites, CI gates, PR definition of done |
| 12 | [engineering/adr/](./engineering/adr/) | Why each major decision was made |

## Where decisions come from

| Document | Role |
| --- | --- |
| [discovery/01-idea-analysis.md](./discovery/01-idea-analysis.md) | Why this project, and how it is judged by recruiters |
| [discovery/02-questions.md](./discovery/02-questions.md) | The 147 discovery questions |
| [discovery/03-answers.md](./discovery/03-answers.md) | **The answers, as a decision record.** Every spec statement traces back here |

## Conventions

- Requirement IDs are stable: `SC-*` (scope), `DM-*` (domain invariant), `PERM-*`
  (permission rule), `WF-*` (workflow), `SYNC-*` (offline rule), `OQ-*` (open question).
- Decisions with lasting consequences get an ADR in
  [engineering/adr/](./engineering/adr/).
- When behaviour changes, update the affected document **and** the decision record.
- Docs stay lean on purpose. A reviewer should understand the system in ten minutes.
