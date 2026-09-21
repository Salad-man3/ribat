# ADR-0003 — Authentication and sessions

**Status:** Accepted · **Date:** 2026-09-18

## Context

The users are a sheikh, three admins, ten teachers, 200 students and their parents in
Damascus. Many have no email. SMS to +963 numbers is unreliable and costs money. Hosted
identity providers can require foreign payment methods. Teachers must be able to open the app
in class without being asked to log in, and the user asked plainly: **people should never be
logged out**.

## Decision

- **Phone number + password**, with accounts created by staff. No self-signup in the beta.
- A new account gets a **one-time setup code** (7 days, hashed, single use). The person
  enters phone + code and chooses their own password. Staff never type a member's password.
- A forgotten password is a new code from staff — the same mechanism, no email or SMS needed.
- Passwords are hashed with **argon2id**.
- Sessions are **httpOnly, Secure, SameSite=Lax cookies**, hashed server-side in
  `AuthSession`, valid for **one year and renewed on use**, which satisfies "never logged
  out" without making a stolen cookie eternal.
- Safeguards that make a long session acceptable: a visible device list, "sign out
  everywhere", instant server-side revocation, and a password re-prompt for account and role
  changes.
- **CSRF** double-submit token on every mutation, since authentication is cookie-based.
- The platform owner account is seeded from environment variables and stored hashed; the
  secret never enters the repository (decision 3.4).
- Rate limiting on login and setup-code redemption.

## Consequences

- No third-party dependency, no per-message cost, and nothing that can refuse service based
  on the country.
- Staff carry the burden of account creation and resets, which fits a 200-member mosque where
  the admins already know everyone.
- Long sessions mean revocation must actually work, so session state lives in the database
  rather than in a self-contained token.
- Offline behaviour follows: an already-valid session opens class mode with no network
  (SYNC-14).

## Alternatives considered

- **SMS OTP** — the natural choice for this audience, blocked by delivery reliability and cost
  to +963. The schema keeps phone as the identifier, so OTP can be added later without
  migration.
- **Clerk / Auth0 / Supabase** — payment and country risk, plus an external dependency for the
  one flow that must never fail during class.
- **JWT access + refresh tokens** — more moving parts for a same-origin PWA, and revoking a
  session would need the same server-side store anyway.
