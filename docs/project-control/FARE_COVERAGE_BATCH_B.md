# Fare Coverage Expansion — Batch B Completion Review

**Branch:** `fare/batch-b-fare-coverage-2026-08`
**Closed:** 6 August 2026
**Status:** Complete — 10 of 10 routes, ready for PR. Not merged or deployed.

This is the permanent record of what Batch B actually did. Full detail for each individual decision
lives in `FARE_OBSERVATION_ARCHIVE.md` and `ROUTE_COVERAGE_AUDIT.md`; this document is the one-page
summary a future reviewer should read first.

**Sequencing:** Batch A → Route Intelligence Scoring v2 (`RIS-001`) → Batch B. RIS-001 merged and was
verified in production (`8b1d18d`) before this batch started. RIS-001 itself was not touched during
this batch — every grade change below is the unchanged scoring function running against new evidence.

## 1. The 10 routes

| # | Route | Fare | Airline | Routing | `fareDirectness` | Deal added? |
|---:|---|---:|---|---|---|---|
| 1 | London Heathrow–Doha | £490 | Etihad | 1 stop via Abu Dhabi (AUH) | `connecting` | No — existing `lhr-doh-economy` |
| 2 | London Gatwick–Ahmedabad | £535 | Air Arabia | 1 stop via Sharjah (SHJ) | `connecting` | No — existing `lgw-amd-economy` |
| 3 | London Heathrow–Bengaluru | £489 | Gulf Air | 1 stop via Bahrain (BAH) | `connecting` | Yes — `lhr-blr-economy` |
| 4 | Manchester–Jeddah | £432 | Pegasus | 1 stop via Istanbul (SAW) | `connecting` | Yes — `man-jed-economy` |
| 5 | Birmingham–Mumbai | £586 | Qatar Airways | 1 stop via Doha (DOH) | `connecting` | Yes — `bhx-bom-economy` |
| 6 | Birmingham–Madinah | £532 | Pegasus and Flynas | 1 stop via Istanbul (SAW) | `connecting` | Yes — `bhx-med-economy` |
| 7 | Manchester–Dhaka | £653 | Etihad | 1 stop via Abu Dhabi (AUH) | `connecting` | Yes — `man-dac-economy` |
| 8 | Leeds Bradford–Amritsar | £800 | KLM and IndiGo | 2 stops via Amsterdam and Mumbai | `connecting` | Yes — `lba-atq-economy` |
| 9 | Leeds Bradford–Islamabad | £916 | Aer Lingus and Qatar Airways | 2 stops via Dublin and Doha | `connecting` | Yes — `lba-isb-economy` |
| 10 | London Gatwick–Amritsar | £952 | Qatar Airways | 1 stop via Doha (DOH) | `connecting` | Yes — `lgw-atq-economy` |

**Evidence depth:** results-list evidence only for all 10 (no click-through into a booking flow),
except London Heathrow–Doha, where "Flight details" was opened specifically to confirm both flight
numbers and the connection point. Every outbound leg was explicitly shown as 1 or more stops by the
source — no observation in this batch tested the "confirmed direct" branch of the directness rule.
Baggage: not shown for any of the 10, recorded honestly as `'not stated'`. No screenshot was captured
or archived for any of the 10 — every evidence record is DOM/accessibility-tree data only, stated
plainly in each `docs/project-control/fare-evidence/<route-slug>-2026-08-06.md` file rather than
implying image files exist that don't.

## 2. Queue derivation

Computed live from the real repository data (`routes`, `getPublishableObservationsByRoute()`,
`deals`), not by hand. Of 32 routes, 13 already had a publishable observation. Of the 19 without one,
**6 are `unverified`** (Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad, Heathrow–Dhaka,
Manchester–Sylhet, Heathrow–Sylhet) — a fare observation logged against an unverified route can never
become publishable, so these were excluded before queueing began rather than have collection effort
spent on routes that could never benefit from it. That left 13 eligible untracked routes, and the
brief's own priority order (existing Deal with no observation, then highest-value South Asia/Gulf)
filled all 10 slots without needing the lower-priority tiers — every Priority 2 candidate happened to
already be South Asia or Gulf.

## 3. Directness rule — a deliberate, narrower standard than Batch A's

Batch A's own convention (established by its evidence-completeness audit, see
`FARE_OBSERVATION_ARCHIVE.md`) treated every outbound-only review as `'unknown'`, regardless of what
the outbound itself showed — correct for Batch A's own entries under that convention. Batch B's brief
states a different, more precise rule: "either leg confirmed connecting → connecting"; "return not
reviewed or ambiguous → unknown" applies only when there's nothing more specific to say. Read
together: a confirmed-connecting outbound leg is real, positive evidence the round trip is not fully
nonstop, even without checking the return — whereas `'direct'` still needs both legs confirmed, since
a single nonstop leg says nothing about the other one. Every one of Batch B's 10 observations had an
explicitly stop-confirmed outbound, so every one is honestly recorded `'connecting'`.

**This is not a reversal of Batch A's correction.** Batch A's `'unknown'` entries remain correct under
Batch A's own convention; Batch B's `'connecting'` entries are correct under Batch B's own, different
but equally defensible convention. Neither batch retroactively corrects the other.

## 4. Customer-visible fare coverage — before and after

| | Before Batch B | After Batch B |
|---|---:|---:|
| Publishable routes | 13 of 32 | 23 of 32 |
| Customer-visible routes (real `Deal` card) | 12 of 32 | 22 of 32 |
| Archive-only | 1 (Heathrow–Jeddah) | 1 (Heathrow–Jeddah, unchanged — pre-dates and is out of scope for this batch) |

Every one of Batch B's 10 new routes is customer-visible — 8 via a brand-new `Deal` entry, 2
(Heathrow–Doha, Gatwick–Ahmedabad) via an existing `Deal` that previously had no publishable
observation behind it. Every new `Deal`'s `airline` field follows the established convention (the
route's own primary editorial operator, never the specific cheaper fare's own source airline).

## 5. RIS-001 grade changes caused mechanically by this batch

Three routes move Useful → Strong. Zero routes move Strong → Useful. Each upgrade has the same shape:
the route already had exactly one substantive depth category (a sourced warning, or
airline-verification), and Batch B's new fare observation supplied the second, clearing Gate 1
(breadth), Gate 2 (diversity — the pre-existing category was already substantive) and Gate 3
(visible-content — a real `Deal` now renders the fare, and all three are direct routes, so the
connecting-depth check doesn't apply):

| Route | Pre-existing category | Gates cleared |
|---|---|---|
| London Gatwick–Ahmedabad | Warning | 1, 2, 3 |
| London Heathrow–Bengaluru | Airline-verification | 1, 2, 3 |
| London Gatwick–Amritsar | Warning | 1, 2, 3 |

Confirmed by running the real `computeRouteIntelligenceLevel()` before and after this batch's data
changes — not asserted from the model alone. **No manual override anywhere.**

**Two country aggregates moved upward as a direct consequence**, confirmed against
`buildAtlasAirports()`'s real output:

- **Heathrow's India: Mixed → Strong** — Bengaluru joins Delhi and Mumbai (already Strong); all three
  of Heathrow's India destinations are now individually Strong.
- **Gatwick's India: Useful → Strong** — Ahmedabad and Amritsar, Gatwick's only two India
  destinations, are both now individually Strong.

Neither is a single-destination shortcut — both groups have multiple destinations, and the
conservative aggregation rule (unchanged) genuinely required, and got, every one of them individually
Strong first.

**The other 7 new routes stay Useful:** 5 (Manchester–Jeddah, Birmingham–Mumbai,
Birmingham–Madinah, Manchester–Dhaka, Leeds Bradford–Amritsar) gained only one category — the new
fare — so Gate 1's breadth requirement isn't cleared. Leeds Bradford–Islamabad now has two categories
(its existing warning plus the new fare) but is a connecting route with no `connectingAlternative`
block, so Gate 3 blocks it. London Heathrow–Doha gained its first-ever category — one is never enough
for Gate 1 regardless of which one it is.

## 6. Known limitations, carried forward honestly

- **All 10 observations are outbound-only evidence.** None opened the return leg (except confirming
  flight numbers for Heathrow–Doha's outbound). This is an honest, disclosed limitation, not a defect
  — the directness rule this batch applied (§3) exists specifically to make outbound-only evidence
  usable without overclaiming.
- **6 connecting routes among the 10 (Manchester–Jeddah, Birmingham–Mumbai, Birmingham–Madinah,
  Manchester–Dhaka, Leeds Bradford–Amritsar, Leeds Bradford–Islamabad) stay Useful** because they lack
  a `connectingAlternative` block — genuine, addable future work, not attempted in this batch (adding
  one without real, sourced hub/stops/journey-time detail would be exactly the filler content this
  batch was told not to add).
- **Heathrow–Jeddah remains the one archive-only route**, unaffected by this batch — its gap (a
  missing Deal entry for a pre-existing observation) predates Batch B and sits outside its scope.
- **`lhr-isb-economy` is a pre-existing orphan `Deal`** (fromAirportSlug `london-heathrow`,
  toDestinationSlug `islamabad`) with no matching route in `data/routes.ts` at all (no
  `london-heathrow-islamabad` route exists) — discovered while deriving this batch's queue, confirmed
  unrelated to and unaffected by any of this batch's 10 routes, and out of scope to fix here. Flagged
  as a genuine, pre-existing data-integrity follow-up for a future pass.

## 7. Quality gate (final, before PR)

See the PR description for the full run — focused fare-methodology and directness tests, DealCard
directness tests, route/fare integrity tests, Atlas scoring tests, `npx tsc --noEmit`, `npm run lint`,
the full canonical Vitest suite, `npm run build`, and `git diff --check`, plus visual QA at
390×844/768×1024/1440×900 covering a representative sample of the newly-visible route pages, `/deals`,
the homepage Atlas, every new direct/connecting badge, and at least one unknown-directness card for
comparison.
