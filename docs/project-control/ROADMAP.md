# JetStash Roadmap

This roadmap contains unfinished work only. Completed work belongs in `COMPLETED.md`.

## Delivery queue

| Order | ID | Status | Work | Definition of done |
|---:|---|---|---|---|
| 1 | `FARE-001` | ACTIVE | Build the editorial fare observation archive. Methodology is finalized and the first five-observation batch is now logged under it. | Fresh, manually checked observations for priority routes with travel dates, cabin, source, observation method, currency, baggage treatment and a fixed 8-week booking horizon, accumulated honestly over time. |
| 2 | `COV-001` | ACTIVE | Build verified route coverage deliberately. | The route queue is evidence-led, each change is sourced and reviewed, and price context appears only from date-complete observations. |
| 3 | `VIS-001` | COMPLETE | Complete the UK airport visual collection. | Premium, airport-specific WebP artwork for every supported UK airport, using one consistent 1672×941 composition. |
| 4 | `AFF-001` | ACTIVE | Improve affiliate coverage. | Current partner state reconciled; only approved, tracked integrations with directly validated customer journeys are enabled. Expedia and other candidates remain off until approved. |
| 5 | `CONV-001` | QUEUED | Validate homepage conversion. | Funnel analytics reviewed; changes made only where data identifies a real drop-off. |

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

### Travel Confidence

Use transparent evidence states such as route verified, documents ready, active warning and
connection risk. Do not introduce an opaque numeric score such as “7.8/10”.

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
