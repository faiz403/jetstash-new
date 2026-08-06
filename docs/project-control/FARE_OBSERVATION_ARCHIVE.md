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
- `fareDirectness` — `'direct'`, `'connecting'` or `'unknown'`; **required for every new
  observation, never left unset** (added 6 August 2026, after a route-level "DIRECT FLIGHT" badge
  was found rendered above a genuinely connecting fare — see the Manchester–Dubai closed-observation
  entry below for the full incident). The collector must answer this directly from what the source
  actually shows for THAT itinerary, never inferred from the route's own verified service state: is
  it direct, or connecting (and if connecting, where and how many stops — record that detail in
  `priceNote`)? If it genuinely cannot be determined, record `'unknown'` explicitly rather than
  leaving the field unset — see `FARE_COLLECTION_CHECKLIST.md` for the full step-by-step;
- `sourceUrl` where a stable manual-check URL can be retained safely.

Append records; never edit an old observation because a fare changed. If a search returns no
publishable fare, record nothing and leave the route's honest empty state intact.

`observedVia`, `sourceUrl`, `currency`, `baggage`, `profileId`, `observationReason` and
`fareDirectness` are typed as optional in `FareObservation` only so historic entries that predate
each field remain valid TypeScript — that is a migration accommodation, not a relaxation of the
standard above. Every observation created under this archive must populate all of them. Nothing
currently stops a new entry from omitting them; if that gap starts being exploited in practice,
add a validation helper or constructor that enforces it for new records without rewriting
history, rather than tightening the type itself and breaking the historic rows.

**Use `FARE_COLLECTION_CHECKLIST.md` as the working template for every new observation** — it
walks through this exact field list plus the surrounding process (evidence record, publishability
check) in collection order, so nothing here is left to be reconstructed from memory afterwards.

## Cadence and queue

Start with one economy observation for each Tier A route in
`docs/project-control/ROUTE_COVERAGE.md`, checked once per week. Add a second check in a week only
when a route is entering a known peak period or the first result was unusually constrained. After
the first month, review whether the cadence is producing useful comparisons before expanding the
queue.

The first archive batch covered, in order:

1. Manchester → Lahore
2. Manchester → Islamabad
3. Heathrow → Delhi
4. Birmingham → Amritsar
5. Heathrow → Jeddah

Then Heathrow → Mumbai, Manchester → Dubai, Heathrow → Doha and Birmingham → Mumbai were added as
their route evidence and search context became ready. This was an operating queue, not a
popularity claim, and its own gap (no `fareDirectness` field existed yet) is what
`FARE_COLLECTION_CHECKLIST.md` now exists to close for every batch after it.

### Fare Coverage Expansion — Batch A (approved 6 August 2026, not yet started)

Founder decision, following the Manchester–Dubai directness correction: run future collection in
deliberately small batches rather than all 32 routes in one pass. The operational reason is
concrete — if a batch surfaces another methodology gap (as the directness field did here), only
that batch's entries need reviewing or unwinding, not the whole archive.

**Batch A — 10 highest-value routes, using `FARE_COLLECTION_CHECKLIST.md` for every entry.**
Re-sequenced 6 August 2026 (after Manchester–Lahore closed) to prioritise soft-launch routes first,
then highest commercial value — this order supersedes the original list above, which is left
unchanged as a historical record of the initial approval:

1. Manchester → Dubai *(done — the standalone check that started this whole correction; see above)*
2. Manchester → Lahore
3. Manchester → Islamabad
4. Manchester → Delhi
5. Manchester → Mumbai
6. Manchester → Ahmedabad
7. Manchester → Amritsar
8. Manchester → Doha
9. Manchester → Madinah
10. Birmingham → Amritsar

Reassess after Batch A closes — confirm the checklist held up in practice, review whether the
`fareDirectness` field needs any adjustment, and only then queue the next batch. The end goal
remains honest, evidence-led coverage across all 32 routes, reached deliberately rather than in one
uncontrolled sweep. **Process note (6 August 2026, after Lahore):** the founder confirmed the
Dubai/Lahore level of evidence depth (full round-trip itinerary, extensive DOM checks) is not
required for every remaining route — later Batch A entries may record only what a search naturally
surfaces (route, dates, profile, price, airline, direct/connecting, stops if shown), skipping
forced click-throughs into a booking flow and skipping baggage-rule digging. Baggage is recorded
only when it appears without digging, `'not stated'` otherwise.

### Batch A progress

| # | Route | Status | Observation | Notes |
|---:|---|---|---|---|
| 1 | Manchester → Dubai | ✅ Done (6 August 2026) | `obs-man-dxb-economy-20260806-8w-v1` | Full-depth evidence (see above) — this is the check that started the correction. |
| 2 | Manchester → Lahore | ✅ Done (6 August 2026) | `obs-man-lhe-economy-20260806-8w-v1` | First attempt (Trip.com) hit an interaction limitation reaching the return leg and a session-wide screenshot-tool outage — held back rather than recorded with weaker evidence than Dubai's. Second attempt (Google Flights) captured the full round-trip itinerary; see the closed-observation entry below. |
| 3 | Manchester → Islamabad | ✅ Done (6 August 2026) | `obs-man-isb-economy-20260806-8w-v1` | First route done under the leaner process — results-list evidence only, no click-through, no baggage digging. **No `man-isb-economy` Deal entry exists** — only `man-isb-business` — so this observation does not currently render on any `DealCard`; it still adds real, dated evidence to the route's own fare history. |
| 4 | Manchester → Delhi | Not started | — | — |
| 5 | Manchester → Mumbai | Not started | — | — |
| 6 | Manchester → Ahmedabad | Not started | — | — |
| 7 | Manchester → Amritsar | Not started | — | — |
| 8 | Manchester → Doha | Not started | — | — |
| 9 | Manchester → Madinah | Not started | — | — |
| 10 | Birmingham → Amritsar | Not started | — | — |

**Batch A is not complete.** 3 of 10 done (counting Dubai). Manchester–Delhi is next. Kept on one
working branch (`fare/batch-a-fare-coverage-2026-08`) rather than a PR per route, reviewed and
merged as a batch once a meaningful set is done — the point of batching is to avoid a run of tiny
"one route
updated" merges.

## ✅ Manchester–Dubai's first publishable observation — closed 6 August 2026

Manchester–Dubai's route was audited as part of Route Completion Batch 1
(`docs/project-control/ROUTE_COVERAGE_AUDIT.md`) and found to have **zero** publicly-publishable
fare observations at the time: two entries exist in this file (`obs-man-dxb-economy-1`,
`obs-man-dxb-business-1`, both from 16/12 June 2026) but predate the Truth Reset's
`departureDate`/`returnDate` requirement, so neither counted as evidence.

This required a genuine manual check — the archive's own binding rule above ("Automated browser
polling, price scraping, API harvesting... are not part of this archive") ruled out an automated
one even where the tooling existed to attempt it. That manual check has now been performed and
reviewed in two rounds (an initial search, then a second pass adding screenshot evidence and
opening the return leg for full itinerary detail) before being approved and recorded:

- **Recorded as:** `obs-man-dxb-economy-20260806-8w-v1` in `data/fare-observations.ts`
- **Route:** `manchester-dubai` — Manchester (MAN) → Dubai (DXB), return
- **Profile:** `manchester-dubai-economy-1adult-baseline-v1` — 1 adult, Economy, GBP
- **Travel dates:** 1 October 2026 – 15 October 2026 (8 weeks out, 14 nights, per the fixed
  horizon)
- **Price:** £480 return, per person
- **Source/provider:** Gulf Air, via Trip.com (`observedVia: 'trip.com'`) — genuinely the top
  "Recommended" result on the search, not hand-picked as cheapest (the cheapest shown was £469)
- **Routing:** connecting via Bahrain on both legs (outbound MAN T2 09:55 → DXB T1 22:35, 9h 40m
  total, 1h 5m in Bahrain; return DXB T1 21:00 → MAN T2 07:15 next day, 13h 15m total, 4h 55m in
  Bahrain) — a genuinely different airline and routing from the route's own verified Emirates
  direct service; see the content-depth finding below for why that matters
- **Baggage:** recorded as `'not stated'` — the selection flow showed only a generic "Included"
  badge with no kg/piece figure on either leg, confirmed by direct DOM inspection (no hidden
  tooltip, no fare-rules text) before recording anything. Never inferred from the badge.
- **Checked:** 6 August 2026
- **Evidence:** `docs/project-control/fare-evidence/manchester-dubai-2026-08-06.md` — a
  contemporaneous transcription of both screenshots viewed during the live browser session
  (search-parameters + outbound selection; return-leg selection with the matching £480 total),
  captured from the same DOM/accessibility data reviewed at the time of the check. **No PNG/JPG
  image file was persisted or committed to this repository** — the browser tool renders a
  screenshot inline for review but exposes no file path this session could write to `git` —
  disclosed plainly in that document rather than implying image files exist that don't. Reviewed
  6 August 2026 (truth-and-integrity correction) against `FARE_OBSERVATION_ARCHIVE.md`'s own
  "Required record fields" and "Review standard" sections (immediately below): neither requires a
  persisted image file, so this level of evidence is methodology-compliant and the observation
  stays publishable — see the evidence document's own "Methodology compliance" section for the
  full citation.

**Confirmed `isObservationPublishable()` / `isPubliclyPublishable()` returns `true`** for this
entry (both dates present, route matches, route status is `'direct'`).

### A genuine content-depth finding surfaced by this observation — fixed same day (6 August 2026)

Logging this observation gives Manchester–Dubai its second depth category (baggage + fare),
satisfying `computeRouteIntelligenceLevel()`'s two-category bar mechanically — this is a real
consequence of genuine evidence, not a manual override, and the threshold itself was not touched.
**But the code-level grade and a clean-reading page are not automatically the same thing.**
Reviewing the actual rendered `/routes/manchester-dubai` page (and its `/deals` `DealCard`) found a
real, visible inconsistency: the card's top-right badge read **"DIRECT FLIGHT"** — derived from the
route's own verified Emirates direct service via `getDealDirectnessLabel()` — sitting directly above
this fare's own description, which explicitly says **"connecting via Bahrain both ways."** A
customer reading the card would see both claims together and could reasonably read them as
contradictory.

Root cause: `getDealDirectnessLabel()` (`data/deals.ts`) intentionally derives the badge from the
**route's** verified status, never a specific displayed fare's own routing — by design, and correct
for every other route in the archive at that time, where the logged fare happened to share the
route's own operator. Manchester–Dubai was the first case where a logged fare was for a genuinely
different airline and routing than the route's own verified direct service (the same situation
exists for Manchester–Doha's Pegasus observation, but Doha has no curated `Deal` entry in
`data/deals.ts` at all, so its `DealCard` never renders and the mismatch never becomes visible
there).

**Fixed the same day, in a follow-up truth-and-integrity correction**: a new optional
`FareObservation.fareDirectness` field records the specific itinerary's own directness (set to
`'connecting'` on this observation); `getFareRangeSummary()` aggregates it into
`FareRangeSummary.observedDirectness`; and a new `getDealFareDirectnessLabel()` (`data/deals.ts`) is
now the only function `DealCard` calls for its badge — it prefers the fare's own recorded
directness, falls back to the route-level label only when every source airline is one of the
route's verified operators, and fails closed (no badge) otherwise. Manchester–Dubai's card now
reads "CONNECTING" directly above its Gulf Air description; the route hero and Business-class card
(no fare logged) still correctly read "DIRECT". Auditing every `Deal` entry for the same latent
defect surfaced three further instances (Manchester–Lahore, Heathrow–Delhi, Birmingham–Amritsar
Economy), all of which now correctly render no badge rather than an unconfirmed claim. See
`ROUTE_COVERAGE_AUDIT.md`'s addendum ("Third review") for the full verdict, and
`tests/deal-card-fare-directness.test.ts` for the regression coverage.

## ✅ Manchester–Lahore's Batch A observation — closed 6 August 2026

Fare Coverage Expansion — Batch A, route 1 of 10. Manchester–Lahore already had two publishable
observations (`obs-man-lhe-economy-20260728-8w-v1`, `obs-man-lhe-economy-20260804-8w-v1`, both
Etihad, both predating the `fareDirectness` field) — the actual gap here was never "no fare," it was
"no `fareDirectness` recorded," which is exactly the DealCard defect corrected the same week. Per the
archive's own rule against editing old observations, both historic entries are left untouched; this
is a fresh, separate entry.

- **Recorded as:** `obs-man-lhe-economy-20260806-8w-v1` in `data/fare-observations.ts`
- **Route:** `manchester-lahore` — Manchester (MAN) → Lahore (LHE), return
- **Profile:** `manchester-lahore-economy-1adult-23kg-v1` (the route's existing, stable profile) —
  1 adult, Economy, GBP
- **Travel dates:** 1 October 2026 – 15 October 2026 (8 weeks out, 14 nights, per the fixed horizon)
- **Price:** £638 return, per person — the top "Best"-ranked Google Flights result, not hand-picked
  as cheapest (cheapest overall on these dates was £594)
- **Source/provider:** Turkish Airlines, via Google Flights (`observedVia: 'google-flights'`)
- **Routing:** connecting via Istanbul on both legs — outbound MAN 22:55 → IST 04:55+1 (TK1916) →
  15h 45m layover (flagged "Long layover" by the source) → IST 20:40+1 → LHE 04:05+2 (TK714), 25h 10m
  total; return LHE 05:35 → IST 10:05 (TK715) → 4h 10m layover → IST 14:15 → MAN 16:30 (TK1995),
  14h 55m total. `fareDirectness: 'connecting'`, read directly off each leg's own itinerary, not
  inferred from Turkish Airlines' general network.
- **Baggage:** recorded as `'not stated'` — the source's "bag fees" control opened only to a list of
  airline names linking out to each airline's own general baggage-policy page; no kg/piece figure or
  checked/carry-on distinction appears anywhere in the search or the expanded flight-detail panels.
- **Checked:** 6 August 2026
- **Evidence:** `docs/project-control/fare-evidence/manchester-lahore-2026-08-06.md`. **No
  screenshot was rendered at any point in this check** — the browser tool's screenshot capability
  was unavailable for the entire session, confirmed by repeated attempts. This is a stronger
  limitation than Manchester–Dubai's (where two screenshots were at least viewed live, just not
  saved) — disclosed plainly rather than implied away. Checked against the same "Required record
  fields" / "Review standard" sections that govern admissibility: neither requires a screenshot to
  have been viewed, only the structured fields, all of which are present. The observation is
  methodology-compliant and publishable on that basis.

**Confirmed before recording:** `isObservationPublishable()` / `isPubliclyPublishable()` return
`true`; `getFareRangeSummary('manchester-lahore', 'Economy', ...)` resolves `observedDirectness` to
`'connecting'`; `getDealFareDirectnessLabel()` for the `man-lhe-economy` deal returns `'Connecting'`,
never `'Direct flight'`. No change was made to Atlas grading, Book-By, or `manchester-lahore`'s own
route-verification record — this entry only adds a fare observation.

**A first attempt on this route (Trip.com) was deliberately not recorded.** It reached the same top
result (Etihad, connecting via Abu Dhabi, outbound leg fully confirmed) but could not reach the
return leg's own detail — five different interaction attempts (mouse dispatch, computer-tool click,
hover+click, clicking the card region, keyboard focus+Enter) failed to advance past the results
list, and no screenshot could be rendered at all in that same session. Rather than record a
round-trip observation backed by only one confirmed leg — a visibly weaker evidence standard than
Manchester–Dubai's — that attempt was held back and Google Flights was tried instead, successfully.
The Trip.com attempt's one substantive finding, kept as a fare-observation-level note only and
**not** promoted to a route-intelligence or route-availability claim: Pakistan International
Airlines (the route's own verified direct operator) did not appear anywhere in either Trip.com's or
Google Flights' results for these dates. Absence from two booking providers' inventory says nothing
about PIA's actual schedule on its own — that would need official airline/airport-source
verification, per the standing sourcing rule (`CLAUDE.md`, "Verified route and airport claims").

## ✅ Manchester–Islamabad's Batch A observation — closed 6 August 2026

Fare Coverage Expansion — Batch A, route 3. First route done under the leaner process the founder
approved after Lahore — no forced click-through into a booking flow, no baggage-rule digging. Two
historic observations already exist on this route (`obs-man-isb-economy-20260728-8w-v1`,
`obs-man-isb-economy-20260804-8w-v1`, both predating `fareDirectness`) and are left untouched.

- **Recorded as:** `obs-man-isb-economy-20260806-8w-v1` in `data/fare-observations.ts`
- **Route:** `manchester-islamabad` — Manchester (MAN) → Islamabad (ISB), return
- **Profile:** `manchester-islamabad-economy-1adult-23kg-v1` (existing) — 1 adult, Economy, GBP
- **Travel dates:** 1–15 October 2026
- **Price:** £524 return, per person — top "Best"-ranked Google Flights result (cheapest overall
  on these dates was £484)
- **Source:** Gulf Air, via Google Flights
- **Directness:** `fareDirectness: 'connecting'` — the source states "1 stop"; the specific
  connecting city was not captured (not shown in the collapsed results list, and this check did not
  click through to find it, per the leaner process)
- **Baggage:** `'not stated'` — not shown in the results list; this check did not open the bag-fees
  dialog to look for one
- **Evidence:** `docs/project-control/fare-evidence/manchester-islamabad-2026-08-06.md`

**Confirmed before recording:** `isObservationPublishable()` / `isPubliclyPublishable()` return
`true`; `getFareRangeSummary('manchester-islamabad', 'Economy', ...)` resolves `observedDirectness`
to `'connecting'`. **No `man-isb-economy` Deal entry exists in `data/deals.ts`** — only
`man-isb-business`, which has no fare logged and is unaffected — so this observation currently adds
dated fare-history evidence for the route without changing any `DealCard` badge anywhere. No change
to Atlas grading, Book-By, or the route's own verification record.

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
