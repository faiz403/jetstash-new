# Evidence record — Leeds Bradford–Amritsar fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-lba-atq-economy-20260806-8w-v1`

**Context:** Fare Coverage Expansion — Batch B, route 8 of 10. Priority 2 (South Asia, verified
connecting route, zero prior observations, no existing Deal).

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20Leeds%20Bradford%20to%20Amritsar%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, Leeds Bradford (confirmed `LBA` in the origin field) → Amritsar, 1 adult, Economy,
GBP, Thu 1 Oct – Thu 15 Oct 2026. Sort: Best (default). Results-list evidence only, no click-through
into a booking flow.

**Top result:** KLM and IndiGo, £800 round trip, per person. LBA 06:30 → ATQ 07:45+1 via Amsterdam
(AMS) and Mumbai (BOM), **2 stops**, 25h15m total.

**Directness:** `fareDirectness: 'connecting'` — the source states "2 stops" via Amsterdam and Mumbai
for the outbound leg. The return leg was not reviewed; per this batch's directness rules, a
confirmed-connecting outbound is sufficient on its own to record `'connecting'`.

**Baggage:** not shown in the results list — recorded as `'not stated'`. No bag-fees dialog opened.

**Evidence type:** DOM/accessibility-tree data only (Google Flights' rendered results list, read via
the browser's accessibility tree) — no screenshot was captured or archived this check.
