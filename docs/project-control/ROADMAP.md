# JetStash Roadmap

This roadmap contains unfinished work only. Completed work belongs in `COMPLETED.md`.

## Delivery queue

**Current baseline:** `4494fd3561ac533a9ba787c04ef77b6ae44626ad`, reconciled 27 August
2026. `ACTIVE` means continuing evidence/operations work; `WAITING` means no repository change is
authorised until an external fact, founder decision or meaningful traffic exists; `FROZEN` means a
live pilot must collect evidence before expansion.

| Order | ID | Status | Work | Definition of done |
|---:|---|---|---|---|
| 1 | `LEGAL-001` | WAITING — founder/professional input | Resolve the public operator/legal foundation. | Founder confirms the public identity/address/legal-notices/retention decisions; a qualified professional reviews the draft Terms and related wording; only then is a separate publish decision made. Repository preparation is complete in `docs/legal/A4_LEGAL_REVIEW_PACK.md`; do not invent the missing facts. |
| 2 | `FARE-001` | ACTIVE — ongoing editorial cadence | Maintain the fare observation archive. Current code-derived state: **226 append-only records, 202 methodology-complete, 195 public-safe at the current route-evidence state, and 83 of 88 routes with a current Fare Signal**. | Fresh, manually checked observations with travel dates, cabin, source, observation method, currency, baggage treatment and evidence-backed directness. Preserve history; never backfill or scrape. |
| 3 | `COV-001` | ACTIVE — evidence/date driven | Maintain verified route coverage deliberately. Five routes remain unresolved and fail closed. Manchester–Mumbai/Manchester–Delhi have a completed pre-map audit and a scheduled 31 August / 1 September truth check that must not be pre-empted. | Every status change is primary-sourced and review-dated; unresolved facts stay unresolved. |
| 4 | `AFF-001` | ACTIVE / WAITING ON PROVIDER | Improve evidence-safe affiliate coverage. | Current state is 45 route-level + 18 exact-pair fallback handoffs = 63 of 88; 25 fail closed. Trip.com is the only active flight partner. A second provider or London fallback is not enabled without approval and direct journey validation. |
| 5 | `CONV-001` | WAITING FOR MEANINGFUL EVIDENCE | Validate homepage/campaign conversion and commercial value. | Google Ads Basic Consent Mode and conversion tracking are live (PR #135). The remaining work is reading a meaningful settled sample — not adding more instrumentation or acting on same-day counts. |
| 6 | `PILOT-001` | FROZEN | Evaluate Journey Choice and Fare Watcher / Standout Fare. | MAN→ISB remains the sole Journey Choice route and sole public Standout Fare pilot. Do not expand, add UI or change thresholds until real traffic evidence supports a founder decision. |
| 7 | `HOTEL-001` | COMPLETE, FROZEN | Hotel Intelligence expansion. | Shipped across 10 destinations with 29 exact-property Trip.com handoffs (PR #136, 15 August 2026). Do not add an 11th destination without customer-usage evidence and a new founder decision. |

`RIS-001` (Route Intelligence Scoring v2) shipped 6 August 2026 — see `COMPLETED.md`. **Fare Coverage
Expansion sequencing (agreed 6 August 2026, after Batch A's audit, completed the same week):** Batch A
→ Route Intelligence Scoring v2 (`RIS-001`) → Batch B. All three stages are now done, merged and
verified in production.

**Historical Post-Batch-B sequencing decision (6 August 2026, founder-reviewed after PR #78's pre-merge truth
audit): Batch C is deliberately not the next task.** With the fare database no longer empty (23 of 32
routes publishable, 22 of 32 customer-visible **at the time of this decision** — the catalogue has
since grown to 88 routes; see `FARE-001` above for the current state),
the open question changes from "is there any fare evidence" to "are the strongest routes genuinely
the best travel-intelligence pages." Agreed order:

1. **Let the new system settle** — watch real analytics (route engagement, which fare cards get
   clicked, which routes actually receive traffic) before deciding where the next investment should
   go, rather than guessing.
2. **Close the specific, already-known customer-visible gaps** before starting a new collection
   round: Heathrow–Jeddah remains archive-only (a fare exists, no matching Deal — see
   `FARE_OBSERVATION_ARCHIVE.md`'s evidence-completeness audit); the 6 routes Batch B deliberately
   excluded for being `unverified` still need a primary-source resolution before any fare collection
   on them is worth attempting; as of 16 August 2026, 7 of the current 88 routes have no publishable
   observation at all (88 total − 81 with ≥1 publishable observation).
3. **Then Batch C** — but reshaped. Not "collect 10 more fares" by default; the brief for whatever
   comes next should weigh completing the highest-traffic routes, adding real
   `connectingAlternative`/airline-verification/baggage depth to routes Batch B left at exactly one
   category, and closing the known gaps above, against a further pure fare-collection round —
   decided against real usage data from step 1, not assumed.

This three-step note is preserved as the decision that governed the August expansion; it is not the
current queue. Fare collection subsequently advanced to the 27 August counts in `FARE-001` above.

## Product-development roadmap

### `ARR-001` — Arrive By

An urgent, deadline-critical journey feasibility tool for funerals, weddings, hospital visits,
business meetings and religious travel. A traveller enters their starting location, destination
and required arrival time; JetStash works backwards to show the fastest and easiest plausible
journeys, including conservative airport, immigration, baggage and onward-ground-time allowances.

**Current status:** the evidence-gated specification is complete in `ARRIVE_BY_SPEC.md`.
Implementation remains deferred until the necessary schedule and ground-transport data can support
honest estimates.

**Non-negotiable boundary:** it must never promise that a traveller will arrive on time. It must
label assumptions, uncertainty, connection risk and the point after which the journey is no longer
realistically achievable.

### Route Status expansion

V1 is complete. Future work may add a dedicated status hub, change history and better Route Watch
connections, but only if the ledger remains the sole source of customer-facing service truth.

### Book By

Continue accumulating verified corridor and fare evidence. The countdown is an interface; the
defensible asset is the longitudinal data. Never turn it into unsupported price prediction.

### Journey Brief

Expand from a route guide into a trusted briefing that can eventually support the pre-booking,
pre-travel, in-journey and after-arrival lifecycle. Build one evidence-backed layer at a time.

**Current experiment:** Journey Choice is live only on Manchester–Islamabad, with measurement and a
dated Trip.com handoff. It remains a one-route evidence phase. The founder has frozen further
Journey Choice work until meaningful traffic exists; do not interpret the longer-term paragraph
above as authority to start a second route now.

**Note (29 July 2026):** the public homepage's discovery/browse surface for this idea is now the
Route Atlas (`components/founder/atlas-feel-test.tsx`, wired into `journey-desk-home.tsx`), not the
retired `pull-brief*.tsx` components. Any future Journey Brief work should build on the Atlas and
the route-page architecture; the old pull-brief hero and its supporting
`lib/homepage-flagship.ts`/`lib/flagship-status-copy.ts` are dead code pending cleanup (see
`LAUNCH_CHECKLIST.md` item H), not a foundation to extend.

### Travel Confidence

Use transparent evidence states such as route verified, documents ready, active warning and
connection risk. Do not introduce an opaque numeric score such as “7.8/10”.

### Route Intelligence Scoring v2 (`RIS-001`) — shipped 6 August 2026

Implemented and merged (`8b1d18d`) — see `COMPLETED.md` for the full record and
`ROUTE_COVERAGE_AUDIT.md`'s "Route Intelligence Scoring v2 (RIS-001)" addendum for the model,
reasoning and full 32-route recomputation. Three independent gates now gate Strong: breadth (2+ of
six depth categories, unchanged from the prior threshold), category diversity (at least one category
beyond `connectingAlternative`+fare), and a visible-content baseline (a real, customer-visible fare,
plus `connectingAlternative` specifically for connecting routes). Fare Coverage Expansion Batch B
(the fare-collection round this was sequenced ahead of) is also now complete — see `FARE_COVERAGE_BATCH_B.md`.

## Deferred, not forgotten

- Automated flight-deal collection until a reliable, lawful and maintainable data source exists.
- SEO expansion beyond the core launch pages.
- Newsletter growth mechanics beyond the honest human-operated workflow.
- Full Arrive By implementation.
- Broad international expansion outside the UK-departure and priority-corridor strategy.

## Prioritisation rule

When choosing between tasks:

1. prevent an incorrect or harmful travel decision;
2. protect trust and evidence quality;
3. fix a broken lead or revenue path;
4. improve discoverability and conversion;
5. add premium presentation;
6. add breadth.
