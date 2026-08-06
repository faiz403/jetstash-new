# Evidence record — Manchester–Jeddah fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-man-jed-economy-20260806-8w-v1`

**Context:** Fare Coverage Expansion — Batch B, route 4 of 10. Priority 2 (Gulf/Saudi, verified
connecting route, zero prior observations, no existing Deal).

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Jeddah%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, Manchester (confirmed `MAN` in the results, departure field itself rendered blank on
load but the itinerary explicitly states "Leaves Manchester Airport") → Jeddah, 1 adult, Economy,
GBP, Thu 1 Oct – Thu 15 Oct 2026. "7 results returned." Sort: Best (default). Results-list evidence
only, no click-through into a booking flow.

**Top result:** Pegasus, £432 round trip, per person. MAN 13:55 → JED 01:10+1 via Istanbul Sabiha
Gökçen (SAW), **1 stop**, 9h15m total. The results list flags this specific fare: "This price does
not include overhead bin access" — a basic-fare cabin-bag restriction, recorded in the price note as
a real, source-shown caveat. This is a fare-class restriction, not a checked-baggage figure. The
route's own verified operator is Qatar Airways (connecting via Doha) — the top "Best" result here is
a cheaper, different itinerary on a different carrier via a different hub.

**Directness:** `fareDirectness: 'connecting'` — the source states "1 stop" via Istanbul (SAW) for the
outbound leg. The return leg was not reviewed; per this batch's directness rules, a confirmed-connecting
outbound is sufficient on its own to record `'connecting'`.

**Baggage:** not shown as a checked-baggage figure — recorded as `'not stated'`. The "no overhead bin
access" restriction is a fare-class detail captured in `priceNote`, not conflated with the baggage
field. No bag-fees dialog opened.

**Evidence type:** DOM/accessibility-tree data only (Google Flights' rendered results list, read via
the browser's accessibility tree) — no screenshot was captured or archived this check.
