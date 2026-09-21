# ADR-0007 — Public repository and licence

**Status:** Accepted · **Date:** 2026-09-18

## Context

The repository must be public from the first commit, because its main purpose is to be read
by hiring engineers. At the same time the project is meant to become a paid SaaS priced by
member count, and it holds a real mosque's data about children.

## Decision

- **Public GitHub repository from day one**, `main` as the default branch, feature branches
  merged by pull request with CI green, conventional commit messages.
- **Licence: AGPL-3.0.** Anyone may read, run and modify the code; anyone who runs a modified
  version as a network service must publish their changes.
- **No real data in the repository, ever.** Seeds are clearly fictional. The public demo runs
  the same code against a separate database with fake data (decision 19.1).
- The README states honestly what exists. No claim of a status the code has not reached — the
  previous README claimed a working API and PWA that did not exist, and that is the failure
  mode to avoid.
- Secrets live only in environment variables and CI secret stores. The owner bootstrap code,
  session secret and database URL are never committed.

## Consequences

- The commit history itself becomes part of the proof: small, reviewable pull requests with
  passing CI show how the developer works, which a finished repository alone cannot.
- AGPL keeps a competitor from taking the code closed-source as a hosted product, while
  leaving mosques free to self-host — which fits the goal ordering (job first, business
  later).
- Public-by-default raises the bar on secret hygiene and on what the seed data may contain;
  both are enforced in review and CI.
- AGPL is also what makes the business model in [ADR-0008](./0008-distribution-model.md)
  workable: anyone may self-host freely, while nobody may run a modified copy as a closed
  competing service. Contributions are taken under a DCO sign-off; a CLA is required only if
  commercial dual-licensing is ever wanted, and that must be decided before the first outside
  pull request is merged.

## Alternatives considered

- **MIT** — friendlier for reuse and marginally more attractive to some employers, but it
  would let anyone host the SaaS without contributing back.
- **Private until the beta works** — would hide the very thing that closes the P0 gap, and
  would delay the first recruiter-visible milestone by weeks.
- **No licence** — visible but legally unusable, and it signals carelessness rather than
  intent.
