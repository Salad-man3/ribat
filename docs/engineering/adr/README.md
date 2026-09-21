# Architecture decision records

One file per decision that would be expensive to reverse. Short, dated, and honest about
what was rejected.

| # | Decision | Status |
| --- | --- | --- |
| [0001](./0001-stack-and-repo.md) | Stack and repository shape — NestJS, Prisma, Postgres, React + Vite PWA, pnpm monorepo, shared Zod | Accepted |
| [0002](./0002-tenant-isolation.md) | Tenant isolation — `organizationId` everywhere with a scoping client extension; RLS after the beta | Accepted |
| [0003](./0003-authentication.md) | Authentication — phone + password, staff-issued setup codes, long revocable cookie sessions | Accepted |
| [0004](./0004-offline-sync.md) | Offline class mode — narrow surface, idempotent replay, last-writer-wins attendance, append-only logs | Accepted |
| [0005](./0005-memorization-model.md) | Memorization — organization-level materials, append-only range logs, lifetime record, derived summary | Accepted |
| [0006](./0006-async-work.md) | Redis + BullMQ for scheduled and fan-out work, from slice S4 | Accepted |
| [0007](./0007-licence-and-visibility.md) | Public repository from day one, AGPL-3.0, honest README | Accepted |
| [0008](./0008-distribution-model.md) | Open source product with managed hosting as the business — one codebase, two deployment modes, private control plane | Accepted |
| [0009](./0009-events-and-outbox.md) | Domain events on a transactional outbox from S4; the pg-boss alternative and why it was refused | Accepted |
| [0010](./0010-read-models.md) | Derived read models, transactional for the class kit and nightly for statistics, each with a rebuild and a drift test | Accepted |

## Writing a new one

Copy the shape of an existing file: **Context** (the forces, with facts), **Decision** (what
we do, in the present tense), **Consequences** (including the bad ones), **Alternatives
considered** (and why they lost). Number sequentially. Never edit an accepted ADR to change
its meaning — supersede it with a new one and mark the old one `Superseded by ADR-XXXX`.
