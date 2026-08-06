# JetStash Roadmap

This roadmap contains unfinished work only. Completed work belongs in `COMPLETED.md`.

## Delivery queue

| Order | ID | Status | Work | Definition of done |
|---:|---|---|---|---|
| 1 | `FARE-001` | ACTIVE | Build the editorial fare observation archive. Fare Coverage Expansion Batch A (10 routes) closed and audited 6 August 2026 — see `BATCH_A_COMPLETION_REVIEW.md`. | Fresh, manually checked observations for priority routes with travel dates, cabin, source, observation method, currency, baggage treatment, a fixed 8-week booking horizon and an evidence-backed `fareDirectness` (both legs confirmed, or honestly `'unknown'`), accumulated honestly over time. |
| 2 | `RIS-001` | **NEXT — sequenced ahead of further fare batches** | Route Intelligence Scoring v2 (see the dedicated entry below for the full reasoning). Batch A made the current threshold's weakness concrete and reproducible (Manchester–Amritsar, Manchester–Ahmedabad) — agreed 6 August 2026 that this should land before any further fare-collection batch, not after, so the next batch doesn't repeat the same thin-promotion pattern. | A founder decision on the actual criteria, then an implementation that measures traveller-facing depth, not just category count. |
| 3 | `COV-001` | ACTIVE | Build verified route coverage deliberately. | The route queue is evidence-led, each change is sourced and reviewed, and price context appears only from date-complete observations. |
| 4 | `VIS-001` | COMPLETE | Complete the UK airport visual collection. | Premium, airport-specific WebP artwork for every supported UK airport, using one consistent 1672×941 composition. |
| 5 | `AFF-001` | ACTIVE | Improve affiliate coverage. | Current partner state reconciled; only approved, tracked integrations with directly validated customer journeys are enabled. Expedia and other candidates remain off until approved. |
| 6 | `CONV-001` | QUEUED | Validate homepage conversion. | Funnel analytics reviewed; changes made only where data identifies a real drop-off. Same underlying gap as `LAUNCH_CHECKLIST.md` item F, the paid-advertising analytics blocker. |

**Fare Coverage Expansion sequencing (agreed 6 August 2026, after Batch A's audit):** Batch A → Route
Intelligence Scoring v2 (`RIS-001`) → Batch B. Do not start a Batch B fare-collection round until
`RIS-001` has at least a founder decision on criteria — otherwise a new batch of fresh observations
risks producing another wave of thin "Strong" promotions the same way Batch A did.

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

**Note (29 July 2026):** the public homepage's discovery/browse surface for this idea is now the
Route Atlas (`components/founder/atlas-feel-test.tsx`, wired into `journey-desk-home.tsx`), not the
retired `pull-brief*.tsx` components. Any future Journey Brief work should build on the Atlas and
the route-page architecture; the old pull-brief hero and its supporting
`lib/homepage-flagship.ts`/`lib/flagship-status-copy.ts` are dead code pending cleanup (see
`LAUNCH_CHECKLIST.md` item H), not a foundation to extend.

### Travel Confidence

Use transparent evidence states such as route verified, documents ready, active warning and
connection risk. Do not introduce an opaque numeric score such as “7.8/10”.

### Route Intelligence Scoring v2 (`RIS-001` — next phase, sequenced ahead of Batch B; not yet implemented)

**Problem:** `computeRouteIntelligenceLevel()`'s Strong threshold (2+ of 6 depth categories, see
`ROUTE_COVERAGE_AUDIT.md` §8) measures evidence *presence*, not complete traveller usefulness. Three
separate findings have now surfaced this: the Atlas threshold itself was originally too permissive
(corrected in PR #71 to require 2+ categories instead of 1); Manchester–Dubai's "JetStash knows this
route well" badge mechanically qualified as Strong (fare + baggage) while its airline guidance stayed
thin; and — the finding that made this concrete rather than hypothetical —
**Fare Coverage Expansion Batch A's audit (6 August 2026) found Manchester–Amritsar and
Manchester–Ahmedabad both qualify as Strong on exactly the cheapest possible combination
(`connectingAlternative` + fare), with no baggage guidance, no per-airline depth, and no visible
source citation, and this cascaded into Manchester's India country node reading "JetStash knows this
country well."** See `BATCH_A_COMPLETION_REVIEW.md` §6 for the full account.

**Status: agreed 6 August 2026 to be the next product-quality phase, before any further
fare-collection batch** (`ROADMAP.md`'s delivery queue, `RIS-001`) — not blocking Batch A's own merge
(the grade is mechanically honest and no fact is fabricated), but blocking Batch B, since a further
round of fresh observations risks producing the same thin-promotion pattern again. No implementation
has started; the next step is a founder decision on actual criteria.

**Future consideration:** combine evidence-category presence with visible route-page depth and
actual traveller decision-support quality, rather than counting categories alone. The smallest
concrete safeguard proposed so far (Batch A's audit, not yet decided or implemented): a route should
not qualify for Strong on `connectingAlternative` + fare alone, without at least one category beyond
that specific combination. No shape is finally decided — this entry exists so the question isn't
lost before more routes are graded Strong under the current model, not to prescribe a formula
unilaterally.

**Status:** flagged only. No implementation planned; do not start building this without an
explicit founder decision on the actual criteria.

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
