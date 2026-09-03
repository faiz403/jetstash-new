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
| Heathrow → Jeddah | Saudia direct service is individually verified via its own current booking page (3 September 2026, RECENT/CHANGING, review due 3 October 2026); British Airways permanently ended this service from 24 April 2026 (TR-010, Round 4) and is no longer a current operator. | Recheck Saudia's current evidence before the review date; do not reintroduce British Airways without new primary evidence that it has resumed. |

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
amendment round (30 July 2026) corrected the original evidence read against current primary
sources — including Biman Bangladesh Airlines' official Manchester notice, a direct fetch of
Manchester Airport's own current Sylhet page and Heathrow's own live flight-tracking pages. The
service has a documented history of launch, withdrawal and relaunch (2012, 2020, 2021, and a
further 2026 suspension/resumption).

| Route | Current evidence state | Next evidence action |
|---|---|---|
| Manchester → Dhaka | Added as Connecting (one stop via Sylhet, not nonstop). Biman Bangladesh Airlines' current official notice says: “BIMAN BANGLADESH AIRLINES WILL RESUME DHAKA-MANCHESTER-DHAKA (VIA SYLHET) FLIGHTS FROM 01 JULY 2026 (EVERY TUESDAY & SATURDAY).” This primary source supports the via-Sylhet pattern and Tuesday/Saturday schedule, but does not establish aircraft, terminal or transfer arrangements. | Recheck Biman's official notice and live booking flow on the review date, given the route's history of suspension and relaunch. |
| Manchester → Sylhet | Remains Verification Pending. A genuine, current, directly-fetched contradiction: Manchester Airport's own Sylhet page states "We're not flying to this location at the moment", while Biman's official Manchester–Dhaka notice says the service operates via Sylhet every Tuesday and Saturday. | Resolve only once a source directly addresses whether a via-Sylhet stop is separately listed as a standalone destination — do not infer either way. |
| Heathrow → Dhaka | Remains Verification Pending, rechecked. Heathrow's own live flight-tracking pages confirm named, currently operating flights BG201/BG202 — real evidence beyond the earlier airline-directory-only finding. Whether this service is nonstop or makes a scheduled Sylhet stop is unconfirmed by any primary source. | Check directly with Biman or get Heathrow's flight-status detail (stop pattern) to render fully — this session's fetch tooling could not extract it. |
| Heathrow → Sylhet | Added as Verification Pending, correcting the original "zero evidence" rejection, which was inaccurate. Heathrow's own flight-tracking pages confirm the same current BG201/BG202 service; multiple independent flight-schedule aggregators describe a Sylhet stop on it, but no primary source has confirmed the stop directly. | Only upgrade once a genuine Biman or Heathrow route-specific primary source confirms the Sylhet stop and schedule; do not infer it from the aggregator pattern alone. |

### Explicitly unresolved direct-service disputes

**Resolved 21 August 2026 (COV-001 verification-gap audit) — see the batch history in
`ROUTE_VERIFICATION_CADENCE_POLICY.md`.** Manchester–Karachi, Birmingham–Lahore and
Birmingham–Islamabad are no longer disputed-direct records: a live search on PIA's own booking
engine resolved all three as connecting, not nonstop — Manchester–Karachi's sampled results showed
a mixed routing (Islamabad on PIA's own metal, or Dubai/Jeddah on codeshare partners), while
Birmingham–Lahore and Birmingham–Islamabad routed consistently via Istanbul across every sampled
result. All three are now published as verified-connecting records in `data/routes.ts`, not left in
this table. Birmingham–Delhi (previously a separate cross-source dispute, not listed in this table)
was resolved the same day as connecting via Amritsar, once Air India's own current page and
Birmingham Airport's 2019 tag-service announcement were read together rather than as competing
claims.

No direct-route records remain in this "explicitly unresolved" state as of this pass. Birmingham
Ahmedabad, Gatwick–Ahmedabad, Heathrow–Dhaka, Heathrow–Sylhet and Manchester–Sylhet remain
unverified for entirely different, still-open reasons (see the Bangladesh workstream and the
COV-001 audit record) — they were deliberately left untouched by this pass.

### Manchester Turkey route-guide pilot — 12 August 2026

Five Manchester Turkey route guides are prepared only where current primary evidence supports a
useful, bounded customer page. This is a pilot benchmark, not permission to fill the remaining
Turkey matrix without pair-specific evidence.

| Route | Published evidence | Deliberate boundary |
|---|---|---|
| Manchester → Istanbul | Turkish Airlines: two direct flights daily to Istanbul Airport (IST); Manchester Airport: scheduled 4h30m | The frequency is specifically Turkish Airlines' published service, not total route frequency; exact dates and other operators remain for the traveller to check. |
| Manchester → Dalaman | SunExpress: direct overnight service from 19 May 2026, daily in the published summer programme; Manchester Airport: scheduled 4h30m | The published programme is subject to change; exact dates and baggage terms remain unconfirmed. |
| Manchester → Bodrum | SunExpress: twice-weekly direct summer 2026 service; Manchester Airport: summer-only | Published duration differs by source, so the guide intentionally publishes no single flight-time figure. |
| Manchester → Antalya | SunExpress's April–October 2026 plan, corroborated by current Jet2 and Corendon booking pages; Manchester Airport and airline pages publish differing timings | Seasonal direct service is evidenced, but exact airlines, dates, frequency and duration vary; no single timing or fixed weekly number is published. |
| Manchester → Izmir | SunExpress's April–October 2026 plan and summer programme; Manchester Airport: published 4h20m planning figure | Seasonal direct service is evidenced; no fixed weekly frequency is published and the 4h20m figure is planning guidance, not a guaranteed actual duration. |

Every route that already has a verified Trip.com handoff keeps it; the five new Gatwick route
guides remain without a provider CTA because booking evidence does not substitute for route
evidence and Trip.com's tool still cannot generate exact airport-specific London links.

### Turkey route-guide completion batch - 12 August 2026

Fourteen of the remaining fifteen Turkey airport-to-destination pairs now have route guides backed
by current airport or airline evidence. Leeds Bradford to Istanbul remains intentionally unbuilt:
Leeds Bradford Airport's current destinations directory does not list Istanbul, and no current
airport or airline source reviewed in this batch established a route-specific service. The fourteen
new guides preserve exact non-London Trip.com handoffs where already verified; all five new Gatwick
guides remain without a provider CTA because Trip.com's tool still cannot generate an exact
airport-specific dateless London handoff.

| Airport | Destination guides added | Evidence boundary |
|---|---|---|
| Leeds Bradford | Antalya, Dalaman, Bodrum | Direct destination listings; no fixed operator, frequency or duration published on the reviewed pages. |
| Glasgow | Antalya, Dalaman, Bodrum | Current airport schedules list direct services; Dalaman/Bodrum publish approximate durations, Antalya remains date-specific. |
| Bristol | Antalya, Dalaman | Current airport pages list direct service and bounded schedule context; no fixed route duration published. |
| Newcastle | Dalaman | Current airport airline directory supports seasonal SunExpress service; fixed duration/frequency remains unknown. |
| London Gatwick | Istanbul, Antalya, Dalaman, Bodrum, Izmir | Current airport/airline sources support direct seasonal or daily service; exact Trip.com airport handoffs remain blocked. |

### Morocco route-guide completion batch — 12 August 2026

All eight published Morocco airport-to-destination pairs in this batch have bounded route guides
backed by current airport or airline evidence. The guides preserve the four existing non-London
Trip.com handoffs; Gatwick/Heathrow booking handoffs remain blocked because Trip.com's affiliate
tool does not provide an exact airport-specific dateless link for those origins.

| Origin | Destination guides added | Evidence boundary |
|---|---|---|
| Manchester | Marrakech, Agadir | Manchester Airport and current airline pages support direct service; published timings and exact dates/frequency remain subject to the selected itinerary. |
| Bristol | Marrakech | Bristol Airport publishes up to four weekly, year-round service; operator and duration remain unconfirmed on the reviewed page. |
| Birmingham | Agadir | Birmingham Airport supports direct service with approximate duration and seasonal/date caveats; operator/frequency vary by programme. |
| London Gatwick | Marrakech, Agadir, Tangier | Gatwick's current route material supports direct service; exact operator, frequency and duration are deliberately not fixed in the guide. |
| London Heathrow | Casablanca | Royal Air Maroc and Heathrow material identify the LHR–CMN service; exact schedule, duration and baggage terms remain for the traveller to check. |

## Weekly operating rhythm

1. Pick **one Tier A route** needing a source check and **one** needing a date-complete fare.
2. Verify service facts directly from an airline, airport, government or other primary source.
3. Capture the exact supported claim, source URL, checked date, review date and remaining uncertainty.
4. Add a new fare observation only when it records outbound and return dates and the fixed search context. Append; never rewrite history. Google Flights, Trip.com and airline booking pages may be used for manual fare observations; service claims still need primary sources.
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
