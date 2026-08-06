# Evidence record — Birmingham–Mumbai fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-bhx-bom-economy-20260806-8w-v1`

**Context:** Fare Coverage Expansion — Batch B, route 5 of 10. Priority 2 (South Asia, verified
connecting route, zero prior observations, no existing Deal).

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20Birmingham%20to%20Mumbai%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, Birmingham → Mumbai, 1 adult, Economy, GBP, Thu 1 Oct – Thu 15 Oct 2026. "12 results
returned." Sort: Best (default). Results-list evidence only, no click-through into a booking flow.

**Top result:** Qatar Airways, £586 round trip, per person. BHX 08:10 → BOM 02:40+1 via Doha (DOH),
**1 stop**, 14h total.

**Directness:** `fareDirectness: 'connecting'` — the source states "1 stop" via Doha (DOH) for the
outbound leg. The return leg was not reviewed; per this batch's directness rules, a confirmed-connecting
outbound is sufficient on its own to record `'connecting'`.

**Baggage:** not shown in the results list — recorded as `'not stated'`. No bag-fees dialog opened.

**Evidence type:** DOM/accessibility-tree data only (Google Flights' rendered results list, read via
the browser's accessibility tree) — no screenshot was captured or archived this check.
