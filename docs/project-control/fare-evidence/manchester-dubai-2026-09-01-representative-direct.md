# Evidence record — Manchester–Dubai representative-direct-fare pilot, checked 1 September 2026

**Observation ID this evidence supports:** `obs-man-dxb-economy-20260901-representative-direct-v1` (`data/fare-observations.ts`)

## What this check is, and why it is a separate series

This is the first observation of a deliberately **new** comparison series —
`manchester-dubai-economy-1adult-representative-direct-v1` — not a continuation of the
route's existing `manchester-dubai-economy-1adult-baseline-v1` series. The existing series is a
cheapest-visible-candidate methodology (see the 6/18/25 August 2026 entries); this check instead
specifically sought out the genuine, top-ranked Emirates direct journey the route is verified to
operate 21 times a week (`data/routes.ts`, `manchester-dubai`, verified 18 August 2026). Per the
founder's own instruction: representative-direct-service selection and cheapest-visible selection
are different comparison methodologies and must never share a series, or Fare Watcher could later
compute medians or "standout" differences across unlike selection policies.

## A note on what "evidence" means in this record

1. **No screenshot was rendered at any point in this session** — the browser screenshot tool is
   known unavailable in this environment for the current session (a standing, previously-confirmed
   limitation, not a new one introduced by this check). This is a stronger limitation than
   Manchester–Dubai's original 6 August 2026 check (where two screenshots were at least viewed
   live), the same limitation as Manchester–Lahore's 6 August 2026 check, and is disclosed plainly
   here rather than implied away.
2. **Every fact below was read directly from the live page's own accessibility tree and rendered
   text**, captured via the browser tool's `get_page_text`, `find` and `read_page` calls during the
   live session that performed this check — not reconstructed from memory afterwards.
3. **Methodology compliance**: `FARE_OBSERVATION_ARCHIVE.md`'s "Required record fields" and "Review
   standard" sections do not require a persisted image file — only the structured fields below,
   all of which are present. This observation is methodology-compliant and publishable on that
   basis, on the same standing as the Manchester–Lahore 6 August 2026 entry.

## Search parameters

- **URL:** `https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Dubai%20October%2020%202026%20return%20November%203%202026&curr=GBP&hl=en&gl=GB`
- Confirmed on screen via the search form itself: **Round trip**, **1 passenger**, **Economy**,
  **Manchester → Dubai**
- **Dates:** the same 20 October 2026 – 3 November 2026 window as the route's most recent
  (25 August 2026) baseline-series checks — reused deliberately, per the founder's instruction not
  to invent new travel dates when the existing comparable search parameters can reasonably be
  reused. This also keeps the two series' evidence directly comparable for the same travel window.

## Outbound leg — "Top departing flights" (Best tab, not Cheapest)

The initial results page's "Cheapest" tab showed fares from **£334** (a connecting itinerary,
confirmed by the "Other departing flights" section below the top three, which were all 1-stop). The
**"Top departing flights"** section — Google's own "Ranked based on price and convenience" list, the
same "Best"-tab convention the original 6 August 2026 Gulf Air and Lahore checks used — showed
**three Emirates nonstop options, all £755 round trip**:

- 9:50 AM MAN → 8:00 PM DXB, Nonstop, 7h 10m
- 2:05 PM MAN → 12:25 AM+1 DXB, Nonstop, 7h 20m
- 9:20 PM MAN → 7:30 AM+1 DXB, Nonstop, 7h 10m

All three confirmed as Emirates via the accessibility tree (`find "Emirates"` matched each result's
own link text: *"From 755 British pounds round trip total. Nonstop flight with Emirates."*). This is
genuinely the top/recommended result for the search, not hand-picked as cheapest — the cheapest
result was £334, a connecting itinerary shown separately.

## Return leg — selecting the first outbound option

Selecting the first outbound (9:50 AM MAN → 8:00 PM DXB) advanced to "Choose return to Manchester".
The **"Top returning flights"** section again showed three Emirates nonstop options, all **£755
round trip, Nonstop, 8h 5m**:

- 2:40 AM DXB → 6:45 AM MAN
- 7:10 AM DXB → 11:15 AM MAN
- 2:30 PM DXB → 6:35 PM MAN

Confirmed via `find "Emirates"` on this page too (10 matches, including the same
*"Nonstop flight with Emirates"* link text on each of the three top results). The "Other returning
flights" section (1-stop, £1,539+) confirms these three nonstop options are genuinely the top
result, not the only one shown.

## Confirmed full itinerary (both legs independently reviewed)

Selecting the first return option (2:40 AM DXB → 6:45 AM MAN) reached an itinerary-summary page
showing both legs together:

- **Departing:** Tue, 20 Oct 2026 — 9:50 AM MAN → 8:00 PM DXB, **Nonstop**, 7h 10m
  (flight **EK 22**, confirmed via the accessibility tree)
- **Returning:** Tue, 3 Nov 2026 — 2:40 AM DXB → 6:45 AM MAN, **Nonstop**, 8h 5m
  (flight **EK 21**, confirmed via the accessibility tree)

Both legs independently confirmed nonstop — satisfying `FARE_COLLECTION_CHECKLIST.md`'s stricter bar
for recording `fareDirectness: 'direct'` (both legs reviewed and each independently confirmed
nonstop, not inferred from one leg or from Emirates' general network).

## Price and baggage

The itinerary-summary page showed a "Lowest total price" of **£704** via a third-party seller
(EaseMyTrip), alongside a "Booking options" list:

- Book with Emirates (the airline itself): **£755**
- Book with EaseMyTrip: **£704**
- Book with Booking.com: **£764**
- Book with Trip.com: **£746**
- Book with Expedia: **£806**
- (32 more booking options, not individually reviewed)

**This record uses £755 (booking directly with Emirates), not the lower £704 third-party price**,
for the same reason the original 6 August 2026 Gulf Air and Lahore checks recorded the top/
recommended result rather than hand-picking the page's cheapest figure: the page's own baggage
statement — *"1 free carry-on"* and *"1st checked bag free"* — is shown for this itinerary, but is
immediately followed by *"Bag fee info isn't available when booking with Booking.com, Trip.com,
Expedia, ... EaseMyTrip ... or kiss&fly"* (an exhaustive list of third-party sellers, EaseMyTrip
included). Recording the £704 EaseMyTrip price would mean recording a price with no attached
baggage evidence for that channel; recording £755 keeps the price and the baggage statement tied to
the one channel (Emirates' own booking option) both are actually shown for.

## Explicitly not recorded as durable facts

- The £334/£704/£755/£1,539+ range of other prices on the same search — recorded here for context
  only (and referenced plainly in `priceNote`), never presented as if they were part of this
  observation's own itinerary.
- Google's own "Price insights" panel ("£704 is typical for Economy... usually £650–1,150") — a
  live market-commentary widget, not a JetStash fact; not carried into the observation record.

## Publishability result

`isPubliclyPublishable()` requires `departureDate`, `returnDate` and `currency` — all three present.
Route status for `manchester-dubai` is `'direct'` (verified). Confirmed publishable.

## Consequence for Fare Signal, Fare Watcher and Fare History (mechanical, not special-cased)

- **Fare Signal:** this is now the route's most recent, fresh, publicly-publishable Economy
  observation with `comparisonEligibility: 'current'`, and it does not match
  `isPoorItinerarySuitability()` (no self-transfer wording, 0 stops both ways) — so
  `selectRepresentativeObservation()` naturally selects it as the current representative fare,
  through the exact same unmodified selection logic used everywhere else. No route-specific
  code change was made anywhere in `lib/fare-signal.ts`.
- **Fare Watcher:** groups strictly by the `(routeSlug, cabin, profileId)` triple
  (`lib/fare-watcher.ts`). This observation's new `profileId` has exactly one entry, so it is
  `insufficient-baseline` by construction — it can never be compared against, or produce a
  standout/notable-drop candidate alongside, the separate baseline series' £314/£350/£480 history.
- **Standout Fare:** `getApprovedStandoutFare()` requires an unrevoked entry in
  `data/standout-fare-approvals.ts` for the exact route + cabin. No such entry exists for
  `manchester-dubai` — confirmed by inspection before this check — so Standout Fare stays `null`
  for this route regardless of this new observation.
- **Journey Choice:** scoped to `manchester-islamabad` only
  (`JOURNEY_CHOICE_PILOT_ROUTE_SLUGS`, `lib/journey-choice-route-adapter.ts`) — `manchester-dubai`
  is unaffected by construction.
- **Fare History:** `FareHistoryPanel` reads every publishable observation for the route
  regardless of Fare Signal state — the existing £314/£350/£480 baseline-series entries remain
  visible exactly as before, alongside this new entry.
