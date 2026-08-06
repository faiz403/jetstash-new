# Evidence record — Manchester–Islamabad fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-man-isb-economy-20260806-8w-v1` (`data/fare-observations.ts`)

> **⚠ Correction, 6 August 2026 audit:** `fareDirectness` was originally recorded as `'connecting'`
> on the strength of the outbound leg's "1 stop" label alone. Only the outbound was ever reviewed
> (see "no click-through" below) — the return leg's routing was never confirmed. Per the standing
> rule that directness must never be inferred from partial evidence, this has been corrected to
> **`fareDirectness: 'unknown'`**. The observation itself (price, airline, dates) remains valid and
> publishable — only the directness claim was overreaching. See `FARE_OBSERVATION_ARCHIVE.md`'s
> audit addendum for the full account.

**Context:** Fare Coverage Expansion — Batch A, route 3 of 10 (Manchester–Lahore and Manchester–Dubai
done first). Per the founder's own direction after Lahore, this record is intentionally lighter than
the Dubai/Lahore evidence files — only what the search naturally surfaced, no forced click-through
into a booking flow, no baggage-rule digging. Two historic observations already exist on this route
(`obs-man-isb-economy-20260728-8w-v1`, `obs-man-isb-economy-20260804-8w-v1`, both predating
`fareDirectness`) and are left untouched, per the archive's rule against editing old observations.

## Search

**URL:** `https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Islamabad%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
**Performed:** 6 August 2026
**Search bar confirmed:** Round trip, Manchester → Islamabad, depart Thu Oct 1, return Thu Oct 15,
1 adult, Economy, GBP — matching profile `manchester-islamabad-economy-1adult-23kg-v1`.
**Results:** "10 results returned." Sort: **Best** (default). Top-ranked result taken, not
hand-picked cheapest (cheapest overall on these dates was £484).

## Top result — Gulf Air, £524 round trip

Read directly from the results list, no click-through:

- **Outbound:** MAN 09:55 → ISB 14:30+1
- **Duration:** 24h 35m total, **1 stop**
- **Airline:** Gulf Air
- **Price:** £524 round trip, per person

**Directness:** `fareDirectness: 'connecting'` — the source itself states "1 stop"; this is not
inferred from Gulf Air's general network. The specific connecting city was not captured — the page's
collapsed list does not name it, and per the leaner Batch A process this session did not chase
further into the booking flow to find it (no forced click-through, consistent with the founder's
explicit instruction not to repeat the Dubai/Lahore level of depth on every route).

**Baggage:** not explicitly displayed anywhere in the results list for this fare — recorded as
`'not stated'`. Per the leaner process, this check did not open the "bag fees" dialog or otherwise
dig for a figure; baggage is recorded only when it appears without digging.

## Explicitly not recorded as durable facts

- No seats-remaining or urgency badge was shown; none is recorded.
- No route-warning or route-availability claim is made from this search.
