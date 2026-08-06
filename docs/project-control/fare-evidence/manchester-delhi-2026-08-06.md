# Evidence record — Manchester–Delhi fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-man-del-economy-20260806-8w-v1`

> **⚠ Correction, 6 August 2026 audit:** `fareDirectness` was originally recorded as `'connecting'`
> on the strength of the outbound leg's "1 stop" label alone. Only the outbound was ever reviewed —
> the return leg's routing was never confirmed. Corrected to **`fareDirectness: 'unknown'`**. The
> observation itself (price, airline, dates) remains valid and publishable. See
> `FARE_OBSERVATION_ARCHIVE.md`'s audit addendum for the full account.

**Context:** Fare Coverage Expansion — Batch A, route 4 of 10. This route had zero prior
observations — this is its first. Lean process (per founder direction after Lahore/Islamabad):
results-list evidence only, no click-through into a booking flow, no baggage-rule digging.

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Delhi%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, Manchester → Delhi, 1 adult, Economy, GBP, Thu 1 Oct – Thu 15 Oct 2026. "14 results
returned." Sort: Best (default). Top-ranked result taken, not hand-picked cheapest (cheapest
overall was £400).

**Top result:** Gulf Air, £481 round trip, per person. MAN 09:55 → DEL 04:05+1, **1 stop**, 13h 40m
total. Read directly from the results list, no click-through.

**Directness:** `fareDirectness: 'connecting'` — the source states "1 stop"; not inferred from Gulf
Air's general network. Connecting city not captured (not shown without a click-through, which this
check did not attempt).

**Baggage:** not shown in the results list — recorded as `'not stated'`. No bag-fees dialog opened.

No screenshot was rendered (tool unavailable this session, consistent with the earlier checks this
week). No durable availability claim was shown or recorded.
