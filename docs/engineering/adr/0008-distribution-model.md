# ADR-0008 — Open source product, managed hosting as the business

**Status:** Accepted · **Date:** 2026-09-18

## Context

Ribat is published as open source so that any mosque or developer can run it themselves, and
the same software is also offered as a paid multi-tenant service where Ribat handles hosting,
updates, backups and support. Plans are priced by member count (decision 1.7).

That combination is a known model — Plausible, Matomo and Discourse all run it — and it has
one failure mode worth naming: the hosted service quietly becomes a fork with extra features,
the open repository decays into a demo, and both the contributors and the proof value are
lost.

## Decision

1. **One codebase, one licence.** Every product feature is AGPL-3.0 and lives in the public
   repository. There is no open-core split and no feature that is withheld from self-hosters.
2. **Two deployment modes from the same image**, chosen by configuration:
   - `DEPLOY_MODE=self_host` — a single organization, browser-based first-run setup, no
     platform-owner surface.
   - `DEPLOY_MODE=hosted` — multi-tenant, platform owner enabled, provisioning API available.
   The tenant model in [02-domain-model.md](../02-domain-model.md) already supports both; the
   mode only decides what is exposed.
3. **The commercial layer is a separate, private control plane.** Customer signup, billing,
   plan limits, provisioning and support tooling live outside this repository and talk to the
   app through its platform API. It is a different program, not a fork.
4. **No licence checks or paywalls in the application code.** A plan limit is applied when the
   control plane provisions an organization (a member limit in `Organization.settings`), never
   as a payment check inside the product. Self-hosters carry no dead code about billing.
5. **Upgrade discipline, because self-hosters upgrade late.** Semantic versioning, tagged
   releases with a CHANGELOG, published Docker images, and GitHub security advisories.
   Migrations are expand-then-contract and backwards-compatible within a major version, so a
   deployment that is three releases behind still upgrades cleanly. The hosted service tracks
   `main`; self-hosters track tags.
6. **No telemetry and no phone-home.** If usage statistics are ever added they are opt-in and
   documented.
7. **An organization is an exportable unit.** A self-hoster must be able to move onto the
   hosted service and back off it again. Export tooling comes later, but no schema decision
   may make it impossible — everything already hangs off `organizationId`.
8. **Contributions are taken under a DCO sign-off.** A CLA is only needed if commercial
   dual-licensing is ever wanted, and that decision must be made **before the first outside
   pull request is merged**, because afterwards only each contributor can relicense their own
   work.

## Consequences

- The business sells hosting, updates, backups and support — not withheld features. That is
  the version self-hosters and contributors will tolerate, and it keeps one code path to test.
- Self-hostability becomes an engineering requirement from slice S1: configuration entirely
  from environment variables, a `docker compose up` path, and a first-run setup in the browser
  rather than a CLI command (see [WF-01](../04-workflows.md#wf-01--onboarding-a-mosque)).
- Schema changes get harder in a useful way: every migration has to be safe for someone who
  applies it weeks after it was written. This is also one of the better interview answers this
  project can produce.
- The control plane is out of scope until S6. Nothing before it depends on it.
- Nothing in the app may assume Damascus: timezone, weekend days, prayer calculation method,
  mushaf page map and locale are all configuration.

## Alternatives considered

- **Open core** — keep some features (SSO, advanced statistics) closed and paid. Rejected: it
  splits the codebase, sours contributors, and the things worth charging for here are hosting
  and support, which are not product features.
- **BSL or another source-available licence** — solves the competitor risk, but it is not open
  source, so it loses both the goodwill and the public-proof value that made this project
  worth building.
- **MIT or Apache-2.0 plus hosting** — maximum adoption, but it lets a larger provider run the
  code as a closed service, which is the one outcome AGPL is chosen to prevent.
