# Arrive By full journey: F4-S synthetic validation

**No external-user validation yet. Current evidence is engineering plus synthetic validation.**

Nothing in this report is user evidence. Persona "comprehension" outcomes were produced by the same model that built the
product, so they are low-confidence hypotheses, never validation.

## What was run

- Date: 1 Oct 2026 (session date), build `be7abad` (F3.1), a private Vercel Preview behind Vercel protection, with the
  Upstash durable monthly call guard, a Preview-only internal token and founder flag, and a Preview-only Google key.
- 26 scripted UI journeys (UK start, UK departure airport, manual flight times, arrival airport, final destination) and
  12 adversarial API cases (forged / stale / swapped place ids, unsupported airports, declared connections,
  non-UK start, wrong-country destination, a flight time inside the UK clock-change gap).

## Engineering results (these are facts about the software)

- 0 wrong place, 0 wrong time, 0 wrong country accepted across the runs.
- Median 5 Google calls per journey (max 6) against a ceiling of 10.
- Every adversarial case failed closed (`CANNOT_CONFIRM`) with the correct reason; valid recovery completed.
- Monthly guard counter on Upstash matched the calls actually made.

## Findings that led to F3.2

| ID | Finding | Status |
| --- | --- | --- |
| B1 | The resolved place was not shown when Google's match was accepted silently (a bare "Newport" could be the wrong Newport). | Fixed in F3.2 |
| B2 | Recovery prompts showed only a street address / plus code, not something recognisable. | Improved in F3.2; limited by Geocoding data (below) |
| S1 | Times crossing midnight showed a clock with no date. | Fixed in F3.2 |
| S3 | `CANNOT CONFIRM` could still sit beside a leave-time headline. | Fixed in F3.2 |
| S2 | The pre-airport leg silently assumed driving. | Copy added in F3.2 |

## Hypotheses only (not evidence)

- Flight-delay tolerance may matter to travellers. This is a contaminated hypothesis, not a finding.

## Backlog (deliberately not fixed here)

Penzance locality handling; La Défense accent / result quality; a generic resolver error taxonomy; flight-delay
tolerance; live flights; transit to the departure airport; public rollout.

## What is still needed

Moderated sessions with real travellers. Until then, do not describe Arrive By as validated.
