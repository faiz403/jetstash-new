# Evidence record — London Heathrow–Bengaluru fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-lhr-blr-economy-20260806-8w-v1`

**Context:** Fare Coverage Expansion — Batch B, route 3 of 10. Priority 2 (South Asia, verified
direct route, zero prior observations, no existing Deal).

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20London%20Heathrow%20to%20Bengaluru%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, London Heathrow (confirmed `LHR` in the origin field) → Bengaluru, 1 adult, Economy,
GBP, Thu 1 Oct – Thu 15 Oct 2026. Sort: Best (default). Results-list evidence only, no
click-through into a booking flow.

**Top result:** Gulf Air, £489 round trip, per person. LHR 10:00 → BLR 04:55+1 via Bahrain (BAH),
**1 stop**. The route's own verified operators are British Airways and Virgin Atlantic (both
nonstop) — a genuine nonstop British Airways option appears in the results list at £512, not
selected here since it is not the cheapest/top-ranked result.

**Directness:** `fareDirectness: 'connecting'` — the source states "1 stop" via Bahrain (BAH) for the
outbound leg. The return leg was not reviewed; per this batch's directness rules, a confirmed-connecting
outbound is sufficient on its own to record `'connecting'`.

**Baggage:** not shown in the results list — recorded as `'not stated'`. No bag-fees dialog opened.

**Evidence type:** DOM/accessibility-tree data only (Google Flights' rendered results list, read via
the browser's accessibility tree) — no screenshot was captured or archived this check.
