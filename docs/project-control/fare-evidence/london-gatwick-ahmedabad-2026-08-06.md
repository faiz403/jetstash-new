# Evidence record — London Gatwick–Ahmedabad fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-lgw-amd-economy-20260806-8w-v1`

**Context:** Fare Coverage Expansion — Batch B, route 2 of 10. Priority 1 (existing `lgw-amd-economy`
Deal, no publishable observation until now — the route's two prior entries, `obs-lgw-amd-economy-1`
and `obs-lgw-amd-business-1`, have no `departureDate`/`returnDate`).

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20London%20Gatwick%20to%20Ahmedabad%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, London Gatwick (confirmed `LGW` in the origin field) → Ahmedabad, 1 adult, Economy,
GBP, Thu 1 Oct – Thu 15 Oct 2026. Sort: Best (default). Results-list evidence only, no
click-through into a booking flow.

**Top result:** Air Arabia, £535 round trip, per person. LGW 10:15 → AMD 04:25+1 via Sharjah (SHJ),
**1 stop**. The route's own verified operator is Air India (nonstop) — the top "Best" result here is
a different, cheaper, connecting itinerary on a different carrier; a genuine nonstop Air India option
also appears in the results list at £732, not selected here since it is not the cheapest/top-ranked
result.

**Directness:** `fareDirectness: 'connecting'` — the source states "1 stop" via Sharjah (SHJ) for the
outbound leg. The return leg was not reviewed; per this batch's directness rules, a confirmed-connecting
outbound is sufficient on its own to record `'connecting'` (see the London Heathrow–Doha evidence
record for the full reasoning on this rule).

**Baggage:** not shown in the results list — recorded as `'not stated'`. No bag-fees dialog opened.

**Evidence type:** DOM/accessibility-tree data only (Google Flights' rendered results list, read via
the browser's accessibility tree) — no screenshot was captured or archived this check.
