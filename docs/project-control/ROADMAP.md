# JetStash Roadmap

This roadmap contains unfinished work only. Completed work belongs in `COMPLETED.md`.

**BUILD FREEZE ACTIVE (14 September 2026).** The Astra founder-review programme (#1–#20) closed with
a CONTINUE/VALIDATION MODE verdict — see `STATUS.md`'s "Astra programme closure and current
operating state" section. Nothing in this roadmap, including rows marked `ACTIVE` below, authorises
a new PR unless it also satisfies one of the freeze's five triggers (P0/P1 safety or truth issue;
a real measurable funnel blocker; the same specific need independently requested by multiple
relevant travellers; a confirmed booking's reconciliation/follow-up work; an approved partner
integration). `ACTIVE` here means "continuing evidence/observation," not "open for a build PR."

## Delivery queue

**Current baseline:** `2f1ede5`, reconciled 14 September 2026 — see `COMPLETED.md`'s September 2026
table for everything merged since the 6 September baseline, including the Astra programme's closure.
`ACTIVE` means continuing evidence/operations work (still subject to the build freeze above);
`WAITING` means no repository change is authorised until an external fact, founder decision or
meaningful traffic exists; `FROZEN` means a live pilot must collect evidence before expansion.

| Order | ID | Status | Work | Definition of done |
|---:|---|---|---|---|
| 1 | `LEGAL-001` | WAITING — founder/professional input | Resolve the public operator/legal foundation. | Founder confirms the public identity/address/legal-notices/retention decisions; a qualified professional reviews the draft Terms and related wording; only then is a separate publish decision made. Repository preparation is complete in `docs/legal/A4_LEGAL_REVIEW_PACK.md`; do not invent the missing facts. |
| 2 | `FARE-001` | ACTIVE — ongoing editorial cadence | Maintain the fare observation archive. Current code-derived state: **226 append-only records, 202 methodology-complete, 195 public-safe at the current route-evidence state, and 83 of 88 routes with a current Fare Signal**. | Fresh, manually checked observations with travel dates, cabin, source, observation method, currency, baggage treatment and evidence-backed directness. Preserve history; never backfill or scrape. |
| 3 | `COV-001` | ACTIVE — evidence/date driven | Maintain verified route coverage deliberately. Five routes remain unresolved and fail closed. Manchester–Mumbai/Manchester–Delhi have a completed pre-map audit and a scheduled 31 August / 1 September truth check that must not be pre-empted. | Every status change is primary-sourced and review-dated; unresolved facts stay unresolved. |
| 4 | `AFF-001` | ACTIVE / WAITING ON PROVIDER | Improve evidence-safe affiliate coverage. | Current state is 45 route-level + 18 exact-pair fallback handoffs = 63 of 88; 25 fail closed. Trip.com is the only active flight partner. A second provider or London fallback is not enabled without approval and direct journey validation. |
| 5 | `CONV-001` | WAITING FOR MEANINGFUL EVIDENCE | Validate homepage/campaign conversion and commercial value. | Google Ads Basic Consent Mode and conversion tracking are live (PR #135). The remaining work is reading a meaningful settled sample — not adding more instrumentation or acting on same-day counts. |
| 6 | `PILOT-001` | PARKED | Evaluate Journey Choice and Fare Watcher / Standout Fare. | Journey Choice Round 1 is closed/historical on MAN→ISB (`JOURNEY-CHOICE-ROUND1-001`) — the public pilot is off, infrastructure preserved. No Standout Fare is currently live: the MAN→ISB approval retired automatically on 1 September 2026 (expected lifecycle, `STANDOUT-ISB-001`) and the LGW→DLM approval was revoked on 7 October 2026 (`STANDOUT-DLM-001`); the engine and approval gate are unchanged. Do not reopen, expand, add UI or change thresholds without a build-freeze-breaking trigger. |
| 7 | `HOTEL-001` | COMPLETE, FROZEN | Hotel Intelligence expansion. | Shipped across 10 destinations with 29 exact-property Trip.com handoffs (PR #136, 15 August 2026). Do not add an 11th destination without customer-usage evidence and a new founder decision. |
| 8 | `STANDOUT-DLM-001` | RESOLVED — PR #316 merged 7 October 2026 | Re-verify the live founder-approved london-gatwick-dalaman £58 Standout Fare (29 Sep 2026, easyJet non-stop) at booking-offer level. | Resolved by fail-closed handling: the historical £58 lacked offer-level evidence (provider and label never recorded), so the approval was revoked and the observation preserved and methodology-excluded; a fresh offer-level re-verification (easyJet direct £55, non-stop both ways, no label on the offer) is now the ordinary Fare Signal. No Fare Watcher or Standout contract change. Evidence: `fare-evidence/standout-dlm-001-2026-10-07.md`. Keep this row until the next roadmap clean-up. |
| 9 | `STANDOUT-ISB-001` | RESOLVED — EXPECTED LIFECYCLE (7 October 2026) | Investigate why the approved manchester-islamabad Standout Fare resolves to nothing. | Resolved as expected lifecycle behaviour, not a defect: the approval retired automatically on 1 September 2026 when a newer routine observation became the current detection (Fare Watcher's existing supersession rule, documented in the approvals ledger and `tests/fare-observation-temporal-causality.test.ts`). The approval record is intact but dormant and is deliberately NOT revoked. No data, approval, threshold or Production change required. |
| 10 | `FWATCH-ST-001` | RESOLVED — PR #317 merged 7 October 2026 | Make Fare Watcher self-transfer aware. | Resolved with parts 1-3 only: (1) a clean fare beats a cheaper same-day self-transfer one, (2) a self-transfer observation is never a candidate (it still supersedes older clean leads, so none resurfaces), (3) a self-transfer recheck is never the evaluated fare (a later flagged recheck retires the candidate; there is no fallback to an older clean recheck). Self-transfer / separate-ticket observations remain preserved as evidence and can still support intentionally labelled lower-fare displays. Baselines, medians, thresholds, booking-horizon rules and the Standout contract are unchanged. On the current archive the fix only removes misleading leads (Fare Watcher 6 to 3, Route Watch 4 to 2) but this is not a universal guarantee: a same-day clean/flagged pair with different travel dates can change the qualification baseline (documented by a boundary test). The old branch's part 4 (baseline exclusion) is not included and is tracked as `FWATCH-BASELINE-001`. |
| 11 | `STANDOUT-LIFE-001` | OPEN — product-contract question, not started | Decide whether a founder-approved Standout should survive later observations. | With routine weekly observations, an approved Standout can stop resolving as soon as the next current observation supersedes its detection identity (MAN→ISB lasted 7 days; LGW→DLM survived to 7 October only because the 6 October observations were held). Whether approvals should persist is a product-contract question that could materially change the Standout contract; it is deliberately separate from `FWATCH-ST-001` and must not be changed without a founder decision and design review. |
| 12 | `FWATCH-BASELINE-001` | OPEN — methodology question, not started and not investigated | Decide whether self-transfer / separate-ticket observations should be removed from Fare Watcher's comparable baseline. | Corresponds to part 4 of the old `fix/fare-watcher-self-transfer-awareness` branch, which was deliberately NOT taken into `FWATCH-ST-001`. Removing those points changes the comparison population itself: medians and previous lows shift and a new candidate can appear (a simulation on the 7 October archive created a `bristol-marrakech` notable-drop). That is a product/methodology decision, not a self-transfer safety fix, and needs a founder decision and design review before any change. |
| 13 | `FARE-SIGNAL-RECHECK-001` | IN REVIEW — narrow correctness PR awaiting approval | Stop the public Fare Signal showing an older lower fare that a later targeted recheck of the same window superseded or explicitly could not reproduce. | Structured append-only ledger `data/fare-reverifications.ts` with two actions: `supersede` (MAN-ISB £460 superseded by the same-itinerary £480 recheck; requires strict structured itinerary identity) and `retire` (BHX-ATQ £579 and LHR-JED £367 whose rechecks state the fare could not be reproduced; the observation is not claimed false and stays history). The recheck is never promoted: the ordinary clean/eligibility/lowest-fare rules choose the fallback (BHX-ATQ £603, LHR-JED £450). Applies only from the 4 October 2026 lowest-fare policy date. Also corrects "Latest comparable non-self-transfer fare observed" to "Lowest ...". Observed-range deal cards deliberately unchanged (historical "from N checks" wording). |
| 14 | `FARE-SIGNAL-RECHECK-002` | FROZEN follow-up, not started | Implied non-reproduction: the remaining 8 routes where a later same-search clean fare is higher and a different itinerary. | Wider policy decision: should implied (not explicit) non-reproduction ever remove a fare? Simulation found 7 of 9 changes would be to an unrelated, pricier itinerary. |
| 15 | `FARE-SIGNAL-RECHECK-003` | FROZEN follow-up, not started | The 4 routes where later lower same-window evidence is gated out by `fareDirectness: unknown` (manchester-dalaman, london-gatwick-faro, london-gatwick-rome, london-gatwick-marrakech). | Different error direction: the public price is older and higher. Separate directness-classification question. |
| 16 | `FARE-SIGNAL-FRESHNESS-001` | FROZEN follow-up, not started | Fare age / freshness wording: the displayed fare can be up to 60 days old with no caveat in the `current` state. | Distinct from contradiction by a later recheck. No 14-day or other age warning is approved. |
| 17 | `FARE-SIGNAL-RECHECK-004` | FROZEN known boundary, not started | A retirement that leaves only a self-transfer fare: existing policy would still show a labelled self-transfer fare. | Does not affect Production today (a clean fallback exists for all three cases); visible only in historical replays, which the 4 October gate leaves unchanged. Headline self-transfer policy not altered. |

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

**Current status:** LIVE as a limited beta since the PR #293 launch (3 October 2026 reconciliation); FROZEN for
feature work. The evidence-gated specification remains in `ARRIVE_BY_SPEC.md`. MAN is transit-first;
ISB / LHE / KHI are road-pickup-first; unsupported airports fail closed. Reopen only if real beta evidence
identifies a defect or a clearly validated opportunity. See `STATUS.md` for the full record.

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

**Journey Brief Phase 1 (built 5–6 September 2026, see `COMPLETED.md`'s `JOURNEY-BRIEF-PHASE1-001`):**
a separate, founder-only prototype at `/founder/journey-brief/manchester-mumbai` (PR #233), gated
behind `FOUNDER_DASHBOARD_ENABLED` and deliberately not the public Atlas/route-page surface the
29 July note above describes — a founder-only pilot, not a homepage change. Rebuilds around a
five-answer structure (route reality, journey option, decisive consequence, entry readiness, next
action) assembled entirely from existing canonical sources. A founder-run 5-person comprehension
test found one launch-blocking usability defect, which was fixed and merged (PR #235). This phase
is now frozen: no second route, no public exposure and no further Journey Brief work is scheduled
until the founder decides whether and how to expand or expose it.

**PARKED (14 September 2026):** the pilot is technically ready for a controlled first-10 user gate,
but the Astra #20 CEO review parked it deliberately — first-booking validation on MAN→ISB outranks
running this gate right now. Do not start the user gate under the current build freeze; it is not
one of the freeze's five triggers.

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
- Further Arrive By feature work (V1 is live as a limited beta and frozen until real beta evidence).
- Broad international expansion outside the UK-departure and priority-corridor strategy.

## Prioritisation rule

When choosing between tasks:

1. prevent an incorrect or harmful travel decision;
2. protect trust and evidence quality;
3. fix a broken lead or revenue path;
4. improve discoverability and conversion;
5. add premium presentation;
6. add breadth.
