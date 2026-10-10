# Arrive By call-budget acceptance — 9 October 2026

## Decision: PASS

The existing ceiling is **10 billable Google calls per full calculation request**,
shared across both journey legs and any presentation-only Places lookup. It is
not a cumulative ceiling across a traveller's confirmation interaction. This
clarifies the existing implementation and recovery contract; it does not raise
either limit or change routing, confirmation or evidence requirements.

There is an explicit ten-call *full journey calculation* contract. No reviewed
decision explicitly caps the sum of the initial submission and confirmation
resubmissions at ten. Describing twelve calls as exceeding a whole-interaction
contract was an inference, not a guard the product had promised or implemented.
Twelve calls are nevertheless real usage and must count towards the monthly cap
and operational measurements of completed traveller interactions.

## Contract and enforcement evidence

- Founder-approved architecture, 30 September, section 0:
  `docs/product/ARRIVE_BY_FULL_JOURNEY_ARCHITECTURE.md` on historical branch
  `docs/arrive-by-full-journey-architecture`: ten calls per full journey **solver
  calculation**, refusing to finish beyond the ceiling; 2,000 per month; five
  submissions per 60 seconds. Section 1 defines full journey as both physical
  sides of the flight; section 6 specifies recomputation without result storage.
- `ARRIVE_BY_FULL_JOURNEY_F0_F1.md`, call accounting and monthly guard: one
  ledger refuses the eleventh call; reserve ten, settle actual usage.
- `ARRIVE_BY_FULL_JOURNEY_F2.md`, origin-side budget: the ceiling covers both
  legs, not ten per leg. `plan.ts` caps the origin search to retain arrival budget.
- `ARRIVE_BY_FULL_JOURNEY_F3.md`, F3.1 and Places addendum: API intentionally
  stateless; every request freshly re-geocodes both places, including supplied
  place IDs. Two recovery prompts may take three submissions. A Places name is
  presentation only; it never replaces the next request's place verification.
- `lib/arrive-by-journey/plan.ts`: each invocation reserves its budget and
  constructs one new `GoogleCallLedger`; final settlement charges actual calls.
- `call-budget.ts` and `internal-access.ts`: refusal before an eleventh provider
  request; durable shared monthly counter required in Production; hard stop at
  2,000, alerts at 50%/80%. All confirmation submissions count against that cap.
- Public and founder journey API routes each call the orchestrator once per POST.
  The visitor limiter counts submissions independently of Google sub-calls.
- `arrive-by-journey-plan.test.ts`, `arrive-by-journey-origin-leg.test.ts` and
  `arrive-by-journey-api.test.ts` cover the shared per-calculation hard stop,
  monthly reservation/refund and fail-closed storage.
- `arrive-by-journey-place-recovery.test.ts` explicitly tests three-request
  recovery sessions and checks each request's calls, not a session sum.
- F4-S measurements and `docs/project-control/STATUS.md` use the shorthand
  “per journey”; they do not define an additional accumulated interaction cap.

## Wedding: twelve-call trace

Evidence: saved public JetStash responses at 00:21 BST on 9 October:
initial `5 = 2 geocodes + 2 Routes + 1 other`; confirmed
`7 = 2 geocodes + 5 Routes`. Both origin searches report two queries.
The order below is reconstructed from those counts and the sequential provider
code. Raw Google request/response bodies were not captured, so individual probe
departure instants are not asserted as network observations.

| Call | Request | Provider and purpose |
| --- | --- | --- |
| 1 | Initial | Geocoding: resolve Reading as the UK start. |
| 2 | Initial | Routes DRIVE: first Reading → Heathrow departure-search probe. |
| 3 | Initial | Routes DRIVE: second probe to verify the latest feasible departure. |
| 4 | Initial | Geocoding: resolve The Midland; venue requires confirmation. |
| 5 | Initial | Places Details, displayName only: show recognisable hotel name. Counted as `other`. |
| 6 | Confirmed | Geocoding: freshly resolve Reading. |
| 7 | Confirmed | Routes DRIVE: first Reading → Heathrow departure-search probe. |
| 8 | Confirmed | Routes DRIVE: second departure-search probe. |
| 9 | Confirmed | Geocoding: re-verify The Midland against the supplied place ID/country. |
| 10 | Confirmed | Routes TRANSIT: primary MAN → The Midland journey, ready at 12:05 BST. |
| 11 | Confirmed | Routes TRANSIT: later departure after missing the first qualifying service. |
| 12 | Confirmed | Routes DRIVE: conditional missed-service car rescue at the first service's departure time. |

Repeated work: start geocode, two origin probes and destination geocode. No
onward route was requested before destination confirmation; no Places lookup is
repeated after confirmation. Primary transit, missed-service transit and rescue
DRIVE are distinct questions at different times/modes, not duplicate evidence.

Reusing a client-supplied resolved place would violate the existing fresh
re-verification requirement. Safely carrying prior server results would require
trusted retained/signed state, input/time/mode binding and freshness rules; none
exists in the current stateless contract. No such change is needed to comply
with it. Presentation names can already be retained by the client; those names
must not become routing evidence. No cache or deduplication was introduced.

## Accepted behaviour and release scope

Saved fresh-response regression checks retain Wedding `POSSIBLE_BUT_TIGHT`,
12:44:53 physical arrival, 12:43:14 conditional rescue, 12:45 latest acceptable
arrival; Sheffield `ESTIMATE_ONLY`, 17:41:08 arrival and 18:10:08 missed service;
Rawalpindi `BEFORE_DEADLINE`, 07:15:36 arrival, with 04:30 explicitly entered/
assumed and no claim of a verified flight connection. Times here are local.

Those checks exercise saved live API results and candidate rendering/recovery.
They are not newly deployed candidate-browser tests or independent real-user
validation. No further Google calls were made for this investigation.

Release changes are limited to the brittle open-details assertion, normal
Arrive By TSX test discovery, budget-scope comments/documentation and a metering
regression. The regression proves independent five- and seven-call calculations
charge twelve to the same monthly store, while the eleventh call in a single
calculation is still refused. It uses provider seams, not fabricated itinerary
evidence. No product logic, solver, flight/capability policy or limits changed.

## Release-candidate validation

- Expanded Arrive By: **42 files, 1,022 passed, zero skipped** using normal
  repository discovery, including Arrive By TSX tests.
- Saved fresh-response regressions: **3/3 passed**, including exact arrival/
  rescue instants, destination recovery and the entered-flight disclosure.
- Full repository: **4,917 passed, 3 failed** (255 files). The three known
  MAN–Antalya baseline failures remain in `fare-fallback-truth-fix.test.ts`
  (two assertions expecting a current fare) and
  `tripcom-fresh-search-clarity.test.ts` (expects `current`, receives `none`).
  They are outside this change and were not repaired. The repository is not
  wholly green; no Arrive By regression was found.
- TypeScript, repository ESLint, production build and whitespace diff check:
  **passed**. The prebuild image manifest has no content change.

**READY FOR PR**, with the three existing full-suite failures disclosed for
review. This is not approval to bypass required CI or merge a red check. No
push, PR, merge or deployment was performed.
