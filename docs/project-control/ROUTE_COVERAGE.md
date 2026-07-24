# Route Coverage Operating System

This is JetStash's operating record for turning a route guide from a safe shell into useful,
evidence-backed travel intelligence. It is deliberately a working queue, not a claim that every
listed route has equal demand or equal evidence.

## Purpose

The site must earn its "travel intelligence first" positioning route by route. A route is never
filled merely to avoid an empty state: every added service, airline, frequency, duration, fare or
booking-window fact must meet its own evidence boundary.

The initial queue below follows the existing `BOOK_BY_PRIORITY_ROUTE_SLUGS` product decision and
known trust risks. It is **not** presented as a market-demand ranking. Add analytics and commercial
evidence before calling any future expansion a top-10 or top-15 demand list.

## What good coverage means

| Layer | Publish only when | Never do |
|---|---|---|
| Service truth | A current primary airline, airport or official schedule source supports the claim, with a source URL, checked date and review date. | Carry forward an old frequency or infer one airline's service from another's page. |
| Route Status | A dated, attributable source describes a material service change. | Treat a predicted change or an unsourced timetable scrape as settled fact. |
| Fare intelligence | A fresh observation records source, cabin, observed date, departure date and return date. | Reuse or edit historic observations to make a graph look fuller. |
| Booking guidance | Existing route-specific evidence or calendar guidance applies to the route and event. | Turn thin observations into a price prediction. |
| Travel readiness | An official rule has a source and a review cadence. | Treat a general buffer as an official processing promise. |

## Current operating queue

### Tier A — sustain the existing Book By product

These are already the routes for which JetStash offers Book By. The immediate goal is not more
marketing; it is to make each one source-complete and add real, dated observations over time.

| Route | Current evidence state | Next evidence action |
|---|---|---|
| Manchester → Lahore | Direct service verified through Manchester Airport; review due 13 August 2026. | Recheck the current service before the review date; log a new date-complete fare when a primary source is available. |
| Manchester → Islamabad | Direct service verified through Manchester Airport; launch frequency is documented, current frequency is not. Review due 13 August 2026. | Recheck current service and frequency separately; do not publish an inferred frequency. |
| Heathrow → Delhi | Existing direct-service copy remains verification-pending. | Obtain current primary evidence for each airline or remove unsupported detail; add the first date-complete fare observation. |
| Birmingham → Amritsar | Existing direct-service copy remains verification-pending. | Obtain a current primary airline or airport source before publishing directness, duration or frequency; add a fare only after travel dates are recorded. |
| Heathrow → Jeddah | British Airways direct service is individually verified; Saudia remains unverified. | Resolve only with a Saudia or airport primary source; preserve the existing airline-specific uncertainty until then. |

### Tier B — strengthen proven, high-value corridors

| Route | Current evidence state | Next evidence action |
|---|---|---|
| Heathrow → Mumbai | Strongest current multi-airline route evidence; one date-complete public fare is logged. | Add another independently checked dated fare before treating its range as meaningful; assess Book By eligibility only after its evidence is sufficient. |
| Manchester → Dubai | Public route facts are verification-pending while broader destination wording can imply a direct service. | Resolve the contradiction first; source the corridor from an official airline or airport page before enriching it. |
| Heathrow → Doha | Public route facts are verification-pending. | Verify airline, directness and current frequency from a primary source before adding fare or booking guidance. |
| Birmingham → Mumbai | Confirmed connecting corridor, not direct. | Maintain the connecting-only framing; improve practical connection intelligence only with primary or operator evidence. |

## Weekly operating rhythm

1. Pick **one Tier A route** needing a source check and **one** needing a date-complete fare.
2. Verify service facts directly from an airline, airport, government or other primary source.
3. Capture the exact supported claim, source URL, checked date, review date and remaining uncertainty.
4. Add a new fare observation only when it records outbound and return dates. Append; never rewrite history.
5. Run typecheck, lint, tests and a production build for code/data changes. Inspect affected rendered pages.
6. Update this record and `STATUS.md` only when the live state has actually changed.

This pace is intentionally calm. A single verified addition is more valuable than ten unsupported
route claims.

## Expansion gate

Before adding a route to the Book By priority set or building a richer Journey Brief, it should
have all of the following:

- verified service truth appropriate to the claim being displayed;
- a clear route-status posture, including any material warnings;
- relevant peak-period or booking-window evidence;
- at least one date-complete fare observation if price context will be shown; and
- a customer reason to prioritise it, based on analytics, enquiries, route-watch demand or an
  explicit founder decision — not an assumption about an audience.

## What this does not authorise

- No schedule scraping, price scraping or automated fare collection.
- No expansion to a route just because a competitor lists it.
- No unlabelled estimate, inferred connection time or passenger arrival promise.
- No claim that the queue is a universal popularity ranking.
