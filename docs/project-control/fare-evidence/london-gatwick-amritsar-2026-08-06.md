# Evidence record — London Gatwick–Amritsar fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-lgw-atq-economy-20260806-8w-v1`

**Context:** Fare Coverage Expansion — Batch B, route 10 of 10. Priority 2 (South Asia, verified
direct route, zero prior observations, no existing Deal).

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20London%20Gatwick%20to%20Amritsar%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, London Gatwick (confirmed `LGW` in the origin field) → Amritsar, 1 adult, Economy,
GBP, Thu 1 Oct – Thu 15 Oct 2026. Sort: Best (default). Results-list evidence only, no click-through
into a booking flow.

**Top result:** Qatar Airways, £952 round trip, per person. LGW 09:00 → ATQ 02:10+1 via Doha (DOH),
**1 stop**, 17h10m total. The route's own verified operator is Air India (nonstop, per Air India's
own schedule) — the top "Best" result here is a different, connecting itinerary on a different
carrier.

**Directness:** `fareDirectness: 'connecting'` — the source states "1 stop" via Doha (DOH) for the
outbound leg. The return leg was not reviewed; per this batch's directness rules, a confirmed-connecting
outbound is sufficient on its own to record `'connecting'`.

**Baggage:** not shown in the results list — recorded as `'not stated'`. No bag-fees dialog opened.

**Evidence type:** DOM/accessibility-tree data only (Google Flights' rendered results list, read via
the browser's accessibility tree) — no screenshot was captured or archived this check.
