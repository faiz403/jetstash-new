# Editorial Fare Observation Archive

**Owner:** JetStash editorial workflow
**Status:** Active - two priority-route batches recorded; latest check 4 August 2026
**Canonical data file:** `data/fare-observations.ts`

## Purpose

JetStash is not claiming to know what a fare was on a day nobody checked. The archive starts now
and compounds through dated, repeatable observations. Each record answers a narrow question:

> What fare did JetStash observe, for these exact travel dates and search conditions, on this date?

This is evidence, not a live-price feed and not a promise that the fare is still available.

## First recorded batch

On 28 July 2026, JetStash manually checked the five Tier A priority routes using the baseline
profile (one adult, return Economy, GBP, 14-night stay, roughly eight weeks out):

- Manchester to Lahore - GBP 578, Etihad, 22 September to 6 October 2026
- Manchester to Islamabad - GBP 562, Etihad, 22 September to 6 October 2026
- Heathrow to Delhi - GBP 432, IndiGo (operated under lease from Norse), 22 September to 6 October 2026
- Birmingham to Amritsar - GBP 733, KLM and IndiGo, 22 September to 6 October 2026
- Heathrow to Jeddah - GBP 575, Royal Jordanian, 22 September to 6 October 2026

These are dated editorial observations from Google Flights, not claims that the fares remain available
or that they represent the cheapest fare across every search result.

## Second recorded batch

On 4 August 2026, JetStash repeated the same five profiles at the fixed eight-week horizon. The
travel dates advanced by one week to preserve comparability: 29 September to 13 October 2026.

- Manchester to Lahore - GBP 620, Etihad
- Manchester to Islamabad - GBP 621, Turkish Airlines
- Heathrow to Delhi - GBP 456, IndiGo (operated under lease from Norse)
- Birmingham to Amritsar - GBP 829, Air France and Air India
- Heathrow to Jeddah - GBP 487, Etihad

These are also dated Google Flights observations, not live-price promises. The next scheduled check
must keep the same profiles, 14-night stay and fixed eight-week horizon while advancing the travel
dates with the observation date.

# What may be observed

A human editor may manually check a return fare on:

- Google Flights (`observedVia: 'google-flights'`)
- Trip.com (`observedVia: 'trip.com'`)
- the airline's own booking page (`observedVia: 'airline'`)

Google Flights, Trip.com and other booking surfaces are fare-observation sources only. They do not
prove that an airline operates a route, flies a given frequency or will honour a connection. Those
service claims still require primary airline, airport or official sources and belong in the Route
Status evidence ledger.

Automated browser polling, price scraping, API harvesting and retrospective backfill are not part
of this archive. A price seen today may be recorded today; it cannot be presented as a price that
was seen on an earlier date unless JetStash actually recorded it then.

## Standard search configuration

Use the same configuration for comparable observations unless the record explicitly states why it
differs:

- one adult, return journey, economy;
- GBP display only. Configure the source to show GBP before reading the fare — never record a
  result in another currency and convert it. If a source cannot be set to GBP, do not log an
  observation from it for this archive;
- exact outbound and return dates recorded in the entry;
- all relevant airports for the route's named departure airport, not a silently widened UK search;
- baggage allowance recorded as shown (`included`, the stated allowance, or `not stated`);
- lowest visible fare only when the result is a bookable itinerary, not an advert or an estimate.

Business-class observations are welcome, but must be kept as a separate cabin record. Do not mix
cabin, passenger count, baggage assumptions or airport scope when comparing a series.

## Observation methodology (binding)

Every priority route gets a named, versioned observation profile before its first archive entry.
Profiles may differ by route when the real customer journey differs, but a route's profile must
remain stable across its series so the observations are comparable. Changing a profile starts a
new series and must be recorded explicitly.

The baseline profile is:

- one adult, no children;
- return economy;
- one checked bag where the source lets us select it; otherwise record `not stated`;
- GBP, taxes and mandatory fees included where shown;
- a 14-night trip unless the route profile specifies a different customer-representative stay;
- one fixed weekly observation day (fortnightly only where the route is explicitly marked so);
- **a fixed 8-week booking horizon**: the outbound departure date searched is always roughly 8
  weeks after `observedDate`, unless the route profile states a different horizon. Chosen because
  several routes' own `bookingWindowNote` already describe 8–10 weeks out as where fares "hold
  reasonably steady" — the point in the booking curve least distorted by last-minute volatility,
  and therefore the most comparable week to week. Without a fixed horizon, two weekly checks on
  the same route could search different points on the price curve and look like a real fare
  movement when only the lead time changed;
- the route's named departure airport, without silently widening the search to all UK airports.

A route profile may override the baseline only for a documented reason—for example a materially
different typical stay or baggage norm. It must include a stable `profileId` such as
`manchester-lahore-economy-1adult-23kg-v1`.

Every observation must also state one `observationReason`: `routine-weekly`,
`routine-fortnightly`, `school-holiday`, `religious-peak`, `airline-sale`, `emergency-recheck`,
`route-status-recheck` or `other` (with the reason explained in `priceNote`). This lets future
analysis distinguish a normal movement from a seasonal or operational event.
## Required record fields

Every new `FareObservation` must include:

- route slug and cabin;
- `observedDate` — the date the result was actually checked;
- `departureDate` and `returnDate` — the dates the fare was quoted for;
- `source` — the airline or provider named by the result;
- `observedVia` — Google Flights, Trip.com or airline page;
- `currency` — currently GBP for the archive;
- `price` and a plain `priceNote` such as `return, per person`;
- `baggage` — what the result states, or `not stated`;
- `sourceUrl` where a stable manual-check URL can be retained safely.

Append records; never edit an old observation because a fare changed. If a search returns no
publishable fare, record nothing and leave the route's honest empty state intact.

`observedVia`, `sourceUrl`, `currency`, `baggage`, `profileId` and `observationReason` are typed
as optional in `FareObservation` only so the eighteen historic entries that predate this
methodology remain valid TypeScript — that is a migration accommodation, not a relaxation of the
standard above. Every observation created under this archive must populate all of them. Nothing
currently stops a new entry from omitting them; if that gap starts being exploited in practice,
add a validation helper or constructor that enforces it for new records without rewriting
history, rather than tightening the type itself and breaking the historic rows.

## Cadence and queue

Start with one economy observation for each Tier A route in
`docs/project-control/ROUTE_COVERAGE.md`, checked once per week. Add a second check in a week only
when a route is entering a known peak period or the first result was unusually constrained. After
the first month, review whether the cadence is producing useful comparisons before expanding the
queue.

The first archive batch should therefore cover, in order:

1. Manchester → Lahore
2. Manchester → Islamabad
3. Heathrow → Delhi
4. Birmingham → Amritsar
5. Heathrow → Jeddah

Then add Heathrow → Mumbai, Manchester → Dubai, Heathrow → Doha and Birmingham → Mumbai when their
route evidence and search context are ready. This is an operating queue, not a popularity claim.

## Founder action required: Manchester–Dubai's first publishable observation (Route Completion Batch 1, August 2026)

Manchester–Dubai's route evidence and search context are now ready — this section is the exact,
ready-to-execute check. Manchester–Dubai's route was audited as part of Route Completion Batch 1
(`docs/project-control/ROUTE_COVERAGE_AUDIT.md`) and found to have **zero** publicly-publishable
fare observations: two entries exist in this file (`obs-man-dxb-economy-1`,
`obs-man-dxb-business-1`, both from 16/12 June 2026) but predate the Truth Reset's
`departureDate`/`returnDate` requirement, so neither counts as evidence today.

**This is squarely a manual step this environment could not perform** — the archive's own binding
rule above ("Automated browser polling, price scraping, API harvesting... are not part of this
archive") rules out an automated check even where the tooling exists to attempt one, and no
existing observation can be safely re-dated instead (that would misrepresent when the fare was
actually seen). A founder (or editor with real browser access) needs to log one real, dated check:

- **Route:** `manchester-dubai` (Manchester → Dubai, Emirates)
- **Profile:** baseline — one adult, return Economy, GBP, 14-night stay
- **`profileId`:** `manchester-dubai-economy-1adult-baseline-v1`
- **Departure date:** roughly 8 weeks after the day you actually check (the archive's fixed
  horizon — see "Observation methodology" above)
- **Return date:** 14 nights after the departure date searched
- **Where to check:** Google Flights, Trip.com, or Emirates' own booking page — record whichever
  was actually used as `observedVia`
- **`observationReason`:** `routine-weekly` (this is the route's first entry, starting a new series)
- Record `observedDate` as the real date you checked, `source` as the airline/provider the result
  names, `currency: 'GBP'`, `baggage` as shown (or `not stated`), and `sourceUrl` where the search
  can be safely retained.

**Once this single observation is logged, a compliant fare observation would satisfy the current
Atlas threshold for Manchester–Dubai, subject to a final content-depth review — not an automatic
promotion.** It already has one genuine depth category (baggage guidance, added in the same batch
— see `data/traveller-tips.ts`'s `manchester-dubai-emirates-baggage-weight` entry), and a
publishable fare observation would be its second, clearing `computeRouteIntelligenceLevel()`'s
two-category bar on the code side. A product-truth review (August 2026) found the rendered route
page still doesn't show the underlying verification source or date anywhere — see
`ROUTE_COVERAGE_AUDIT.md`'s "Does 'baggage + fare' genuinely justify 'JetStash knows this route
well'?" for the full finding — so whoever logs this observation should read the resulting page
critically rather than treat the two-category bar as the final word. Do not add this observation
from memory or estimate — if the check can't be done for real, leave this section as the standing
to-do rather than filling it with an invented number.

## Manchester–Doha: do not close its gap artificially

Manchester–Doha already has one publishable fare observation (`obs-man-doh-economy-20260805-8w-v1`,
checked 5 August 2026) but stays graded Useful — it needs exactly one more genuine depth category,
and Route Completion Batch 1 (August 2026) confirmed every avenue it could research is exhausted
(Qatar Airways' own baggage page returned HTTP 403 on every attempt; Manchester Airport's own Qatar
Airways page explicitly has no baggage figure). Whoever picks this up next must not close the gap
by gaming the score:

- **Do not add Manchester–Doha to `BOOK_BY_PRIORITY_ROUTE_SLUGS`** unless it is genuinely
  editorially justified — because the route fits the festival-anchored, dated booking-guidance
  pattern that list exists for — never merely to hand it a second scoring category.
- **Do not log a fare observation from memory, an estimate, or a stale search result** to appear
  as if a fresh check happened — the same standard as the Dubai check above.
- **Do not add a warning, a duplicate airline verification record, or a baggage claim that isn't
  backed by a real, checkable source** — see `ROUTE_COVERAGE_AUDIT.md`'s "Protecting the Doha
  decision" for the full reasoning, including why even unrestricted human access to Qatar Airways'
  own baggage page will likely only surface a general, ticket-type-dependent policy statement, not
  a fact unique to this city pair — genuinely addable, on the same standard as Dubai's own baggage
  tip, but not something to assume will complete the route.

## Review standard

Before a record can influence a public fare range or Book-By context:

1. confirm both travel dates are present;
2. confirm the source, observation method, cabin, currency and baggage treatment are explicit;
3. confirm the route slug matches the actual departure and destination searched;
4. confirm the source result was manually checked on `observedDate`;
5. keep the wording as an observation (`observed`, `starting from`, `checked on`), never a live-price
   promise or prediction.

The archive becomes commercially valuable through repetition: one check is a fact, several checks
are context, and a long series can eventually support cautious booking-window guidance. It must
never be made to look mature before the underlying record is mature.

## Known limitation (tracked, non-blocking)

Baggage is currently recorded as `included`, a stated allowance, or `not stated` — there is no
distinct state for a fare that explicitly includes *no* checked bag versus a result that simply
doesn't mention baggage at all. Both currently record as `not stated`. Worth a fourth `excluded`
state in a future pass; not required before the archive can start.
