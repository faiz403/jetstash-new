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
| Fare intelligence | A fresh manual observation records the result source, where it was checked, cabin, observed date, departure date, return date, currency and baggage treatment. | Reuse or edit historic observations to make a graph look fuller, or present an observation as a live price. |
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
| Heathrow → Delhi | British Airways direct service is verified; other operators remain separately scoped. | Recheck BA before 28 August 2026 and obtain separate primary evidence before naming another airline; continue dated fare observations. |
| Birmingham → Amritsar | Air India’s current booking page shows connection options and no direct flight. | Keep the connecting-only framing; add a fare only after travel dates are recorded. |
| Heathrow → Jeddah | British Airways direct service is individually verified; Saudia remains unverified. | Resolve only with a Saudia or airport primary source; preserve the existing airline-specific uncertainty until then. |

### Tier B — strengthen proven, high-value corridors

| Route | Current evidence state | Next evidence action |
|---|---|---|
| Heathrow → Mumbai | Strongest current multi-airline route evidence; one date-complete public fare is logged. | Add another independently checked dated fare before treating its range as meaningful; assess Book By eligibility only after its evidence is sufficient. |
| Manchester → Dubai | Emirates direct service is verified at 21 flights per week, with seasonal variation disclosed. | Recheck Emirates before 28 August 2026; do not generalise the figure to other operators. |
| Heathrow → Doha | Qatar Airways direct route is verified; exact frequency and duration remain unclaimed. | Recheck the official route page before 28 August 2026; do not publish an inferred frequency. |
| Birmingham → Mumbai | Confirmed connecting corridor, not direct. | Maintain the connecting-only framing; improve practical connection intelligence only with primary or operator evidence. |

### Newly added — first destination expansion since launch

| Route | Current evidence state | Next evidence action |
|---|---|---|
| Heathrow → Bengaluru | Two independently verified daily direct operators: British Airways (own 12 Nov 2025 press release, "the airline operates a daily service on its 777-200 fleet"; review due 30 August 2026) and Virgin Atlantic (own route page, "We fly to Bengaluru daily", 10h; review due 30 August 2026). Air India remains unverified — its official pages give contradictory information about a direct service, and Air India's own site was again unreachable to this session's tooling. | Resolve Air India's contradictory official information once a current, unambiguous Air India primary source can be reached — do not name it until then. Add a date-complete fare observation once a real, dated check can be made — none is logged yet. Separately: `lib/atlas-network-data.ts`'s `buildDestinationPoint()` only reads the route-level `verification` field for the Atlas's evidenceState badge, not per-airline `airlineVerifications` — this makes Bengaluru read "pending" on the Atlas despite two verified operators, the same pre-existing behaviour Delhi and Mumbai already have in production. Worth a small, separate fix; not part of this route's own evidence gap. |

### Newly added — Bangladesh workstream

Four candidate routes were investigated (Heathrow–Dhaka, Heathrow–Sylhet, Manchester–Dhaka,
Manchester–Sylhet); all four are now represented, on the evidence below. A founder-directed
amendment round (30 July 2026) corrected the original evidence read against fresh primary and
current sources — including a direct fetch of Manchester Airport's own current Sylhet page and
Heathrow's own live flight-tracking pages — rather than resting on the original secondary-news
leads. The service has a documented history of launch, withdrawal and relaunch (2012, 2020, 2021,
and a further 2026 suspension/resumption); Biman's own site (biman-airlines.com) has returned a 403
error on every attempt across two research rounds this session.

| Route | Current evidence state | Next evidence action |
|---|---|---|
| Manchester → Dhaka | Added as Connecting (one-stop via Sylhet, same Biman aircraft throughout, never presented as an ordinary connection). Multiple independent current (July 2026) Bangladeshi sources — BSS (state news agency), Dhaka Tribune, The Business Standard, AeroRoutes — consistently describe this exact stop on both legs, with the same flight number reported across the Sylhet and onward sectors, resuming after a ~4-month suspension at twice weekly (Tue/Sat). | Confirm this schedule directly against Biman's own site once reachable; none of the current sources are Biman's own official website. |
| Manchester → Sylhet | Remains Verification Pending. A genuine, current, directly-fetched contradiction: Manchester Airport's own Sylhet page states "We're not flying to this location at the moment", while the Manchester–Dhaka evidence above describes a scheduled Sylhet stop on every rotation of that same service. | Resolve only once a source directly addresses whether a through-stop is separately listed as a standalone destination — do not infer either way. |
| Heathrow → Dhaka | Remains Verification Pending, rechecked. Heathrow's own live flight-tracking pages confirm named, currently operating flights BG201 (Dhaka–London, Terminal 4) and BG202 (London–Dhaka, Terminal 3) — real evidence beyond the earlier terminal-directory-only finding. Whether this service is nonstop or (like Manchester) makes a scheduled Sylhet stop is unconfirmed by any primary source. | Check directly with Biman (403-blocked) or get Heathrow's flight-status detail (stop pattern) to render fully — this session's fetch tooling could not extract it. |
| Heathrow → Sylhet | Added as Verification Pending, correcting the original "zero evidence" rejection, which was inaccurate. Heathrow's own flight-tracking pages confirm the same current BG201/BG202 service; multiple independent flight-schedule aggregators (flightmapper.net, Skyscanner, FlightsFrom.com) describe a Sylhet stop on it, mirroring the confirmed Manchester pattern — but no primary source has confirmed the stop directly. | Only upgrade once a genuine Biman or Heathrow route-specific primary source confirms the Sylhet stop and schedule; do not infer it from the aggregator pattern alone. |

### Explicitly unresolved direct-service disputes

These are the only three direct-route records still intentionally fail-closed after the July
coverage pass. They are not silently treated as connecting routes: the available evidence does not
prove either a current direct service or its absence.

| Route | What current primary material supports | Safe customer-facing posture | Next evidence action |
|---|---|---|---|
| Manchester → Karachi | PIA's current public material confirms the resumed Islamabad–Manchester service, but publishes no route-specific Manchester–Karachi direct claim. | Keep directness unverified; do not publish a duration, frequency or airline fact as established. | Check PIA's live booking result or a current Manchester Airport/PIA schedule entry for MAN–KHI. |
| Birmingham → Lahore | PIA's current public material identifies Heathrow–Lahore service; Birmingham Airport's live destination directory does not list Lahore. | Keep directness unverified; do not infer a connection or cancellation from absence alone. | Check PIA's live booking result or a current BHX/PIA schedule entry for BHX–LHE. |
| Birmingham → Islamabad | PIA publicly confirms Islamabad–Manchester and Heathrow operations, but not Birmingham–Islamabad; Birmingham Airport's live destination directory does not list Islamabad. | Keep directness unverified; do not convert conflicting secondary reports into a direct claim. | Check PIA's live booking result or a current BHX/PIA schedule entry for BHX–ISB. |

## Weekly operating rhythm

1. Pick **one Tier A route** needing a source check and **one** needing a date-complete fare.
2. Verify service facts directly from an airline, airport, government or other primary source.
3. Capture the exact supported claim, source URL, checked date, review date and remaining uncertainty.
4. Add a new fare observation only when it records outbound and return dates and the fixed search context. Append; never rewrite history. Google Flights, TravelUp and airline booking pages may be used for manual fare observations; service claims still need primary sources.
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

- No automated schedule or price scraping, automated fare collection or retrospective price backfill. Manual editorial checks are allowed only when the result is recorded on the same day with its travel dates and source context.
- No expansion to a route just because a competitor lists it.
- No unlabelled estimate, inferred connection time or passenger arrival promise.
- No claim that the queue is a universal popularity ranking.
