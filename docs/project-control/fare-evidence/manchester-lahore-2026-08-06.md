# Evidence record — Manchester–Lahore fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-man-lhe-economy-20260806-8w-v1` (`data/fare-observations.ts`)

**Context:** this is a Fare Coverage Expansion — Batch A entry (`FARE_OBSERVATION_ARCHIVE.md`). Two
historic Manchester–Lahore observations already exist (28 July and 4 August 2026, both Etihad, both
predating the `fareDirectness` field). Per the archive's own rule against editing old observations,
those two are left untouched as historical context; this is a fresh, separate entry that also
records `fareDirectness` for the first time on this route.

## A note on what "evidence" means in this record

**Unambiguous statement of fact, written at the time of the check:**

1. **No screenshot was rendered at any point during this check.** The browser tool's screenshot
   capability was unavailable for the entire session ("Screenshot timed out... the Browser pane is
   not displayed"), confirmed by repeated attempts before and after the search. Unlike the
   Manchester–Dubai check (where two screenshots were at least viewed live, just not saved), no
   image of any kind — persisted or transient — was ever produced or reviewed for this observation.
2. **No PNG, JPG, or any other image evidence file was persisted or committed to this repository.**
   This is a stronger statement than "not saved" — no image existed to save in the first place.
3. **This markdown file is a contemporaneous transcription of live structured page data** — the
   accessibility tree and rendered text of Google Flights' own search-results and flight-detail
   views, captured at the same session that ran the search, not reconstructed from memory
   afterwards.
4. **This is not a substitute claim that image evidence is archived**, and it is not a claim that
   any screenshot was ever viewed either. Nothing below should be read as implying visual
   confirmation beyond the structured page text and DOM queries actually performed.
5. **Baggage was not stated for either leg and is recorded as `'not stated'`** — see "Baggage —
   explicitly checked, not assumed" below.
6. **No durable availability claim is retained.** Google Flights did not surface a seats-remaining
   style badge on this search; nothing of that kind appears anywhere in this record.

### Methodology compliance

Checked directly against `FARE_OBSERVATION_ARCHIVE.md`'s "Required record fields" and "Review
standard" sections, the same two sections the Manchester–Dubai correction (6 August 2026) confirmed
govern admissibility. Neither section requires a persisted image file, and neither requires that a
screenshot have been viewed at all — only the structured fields (route slug/cabin, `observedDate`,
`departureDate`/`returnDate`, `source`, `observedVia`, `currency`, `price`/`priceNote`, `baggage`,
`fareDirectness`, `sourceUrl`) and the review standard's five checks (travel dates present;
source/method/cabin/currency/baggage explicit; route slug matches; manually checked on
`observedDate`; wording stays observational). All are satisfied here. **This observation is
methodology-compliant and publishable on the same evidence-quality basis as Manchester–Dubai's**,
even though the specific tooling limitation this session hit (no screenshot capability at all,
rather than screenshots viewed-but-unsaved) was different in kind. What matters per the binding
methodology is the structured data, not the presence of a picture.

## Search

**URL (search query form):** `https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Lahore%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
**Performed:** 6 August 2026
**Search bar confirmed:** Round trip, **Manchester → Lahore**, depart **Thu, Oct 1**, return **Thu,
Oct 15**, 1 adult, Economy, GBP — matching profile `manchester-lahore-economy-1adult-23kg-v1`,
already established by the two historic observations on this route.
**Results:** "10 results returned." Sort: **Best** (Google's default ranking by price and
convenience), not the separately-shown "Cheapest" (£594). Top-ranked result taken, not hand-picked
as cheapest.

## Top result — Turkish Airlines, £638 round trip

Selected via Google Flights' own two-step flow: choosing the outbound flight first opened "Choose
return to Manchester" (Google's own return-leg selection step, a genuine UI interaction — no
booking or payment page was reached at any point), then the same £638 total round-trip fare's
matching top-ranked return option was opened for its own leg-by-leg breakdown.

### Outbound — Thursday 1 October 2026

Exact text read from the expanded "Flight details" panel:

- **MAN (Manchester Airport) 22:55 → IST (Istanbul Airport) 04:55+1** — Turkish Airlines **TK 1916**,
  Economy, Airbus A321neo, travel time 4h, flagged "Overnight"
- **15h 45m layover, Istanbul (IST)** — flagged by Google Flights itself as **"Long layover"**
- **IST 20:40+1 → LHE (Allama Iqbal International Airport) 04:05+2** — Turkish Airlines **TK 714**,
  Economy, Airbus A330, travel time 5h 25m, flagged "Overnight"
- **Total: 25h 10m, 1 stop**

### Return — Thursday 15 October 2026

Exact text read from the expanded "Flight details" panel:

- **LHE 05:35 → IST 10:05** — Turkish Airlines **TK 715**, Economy, Airbus A330, travel time 6h 30m
- **4h 10m layover, Istanbul (IST)**
- **IST 14:15 → MAN 16:30** — Turkish Airlines **TK 1995**, Economy, Airbus A321neo, travel time
  4h 15m
- **Total: 14h 55m, 1 stop**

### Price

**£638 round trip total, per person** — the same figure on both the outbound-selection card and the
return-selection card, confirming they are the matched pair for one fare, not two different prices.

## Directness — read from the itinerary, never inferred

Both legs explicitly show one stop via Istanbul, with exact connection-city and layover-duration
detail given by the source itself (15h 45m outbound, 4h 10m return). Recorded as
**`fareDirectness: 'connecting'`**. This was not inferred from Turkish Airlines' general network —
it is read directly off this specific itinerary's own stated routing, on both legs independently.

## Baggage — explicitly checked, not assumed

The search page shows a "bag fees" control. Opened directly rather than assumed away:

- The resulting dialog's full text: *"Baggage fees — Emirates, Etihad, Qatar Airways, Turkish
  Airlines"* — four airline names, each a link out to that airline's own general baggage-policy
  page (e.g. Turkish Airlines' link resolves to
  `https://www.turkishairlines.com/en-int/any-questions/baggage-information/`).
- No kg/piece figure, no checked/carry-on distinction, and no fare-specific allowance appears
  anywhere in this dialog or in the expanded flight-detail panels for either leg — only generic
  amenity information (legroom, Wi-Fi availability, power/USB outlets, on-demand video).

**Conclusion: no explicit checked-baggage or cabin-baggage allowance is disclosed anywhere in this
search for this fare.** Recorded as `baggage: 'not stated'` — never inferred from the presence of a
"bag fees" link to an airline's general policy page.

## Explicitly not recorded as durable facts or route intelligence

- **"Long layover"** — Google Flights' own UI flag on the outbound connection, kept here as
  itinerary evidence only. Not converted into a `data/route-warnings.ts` entry or any other route
  warning; that would require its own independent investigation and sourcing standard, which this
  fare check does not meet.
- **PIA's absence from this search's results** — Google Flights returned Turkish Airlines, Etihad,
  Qatar Airways/British Airways and Emirates/Qantas across its 10 results; Pakistan International
  Airlines (the route's own verified direct operator) did not appear, consistent with the earlier
  Trip.com attempt on the same dates. This is recorded here as a fare-observation-level note only —
  **not** as a route-availability claim. Absence from one or two booking providers' inventory does
  not establish anything about PIA's actual schedule; that would require official
  airline/airport-source verification, per the standing sourcing rule
  (`CLAUDE.md`, "Verified route and airport claims"), which this check does not attempt.
- No seats-remaining or urgency badge was shown by the source at any point; none is recorded.
