# ADR-0005 — Memorization model

**Status:** Accepted · **Date:** 2026-09-18

## Context

Memorization is the core domain. Requirements from discovery: the Quran plus other texts;
teachers log an ayah range and the app calculates pages; the 604-page Madinah mushaf; two log types
(new and revision); a grade and a mistake count; tests per juz scored out of 100 with every
attempt kept; any memorization order, including starting from the end; and — the decisive one
— **a student's memorized amount is a lifetime record that follows them across courses and
years**.

## Decision

- **Materials are an organization-level catalogue**, not course-owned. A course links to a
  material. One `QURAN` material is seeded per organization. This is what lets a lifetime
  record survive when a student moves from one course to the next.
- **Logs are append-only events** (`MemorizationLog`), each tagged with the member, the
  material, the optional course, the range, the grade and the author. A mistake is **voided
  with a reason**, never edited or deleted (DM-08).
- **Ranges, not counters.** Progress is the set of memorized ayah ranges, so order does not
  matter and a student starting at An-Nas is handled with no special case.
- **Pages are derived** from the ayah range through a static dataset in
  `packages/quran-data`, shipped to both the API and the PWA so the range picker validates
  offline.
- **A derived `MemorizationSummary`** per (member, material) is written in the same
  transaction as the log, holding pages memorized, last position and last log time. The class
  kit and the member card read it instead of scanning the ledger.
- **Starting level** is an `INITIAL` log with no course, so prior memorization enters through
  the same path as everything else.
- **Tests** (`MemorizationTest`) keep every attempt with a scope, a score out of 100, the
  course's pass mark and the examiner.

## Consequences

- The history question "what did this student recite on 3 Ramadan, and who heard it" is
  answerable forever.
- Correctness of the ayah → page map matters; it is reference data with its own unit tests
  rather than a runtime lookup service.
- The summary table must be updated transactionally with every log and void, which is the one
  place where a bug would show as a wrong "last position" in class.
- Texts (mutoon) reuse the same tables with page ranges instead of ayah ranges, so no second
  model is needed.

## Alternatives considered

- **A per-course progress counter** — simpler, but it loses the lifetime record the domain
  actually has, and it cannot answer history questions.
- **Storing pages only** — cheaper, but teachers work in surahs and ayahs, and a page number
  alone cannot be validated or split for revision.
- **Computing coverage on read every time** — fine at pilot size, but the class kit must be
  fast and offline-ready, which the summary guarantees.
