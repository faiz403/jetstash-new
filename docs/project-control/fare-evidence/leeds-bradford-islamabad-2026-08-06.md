# Evidence record — Leeds Bradford–Islamabad fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-lba-isb-economy-20260806-8w-v1`

**Context:** Fare Coverage Expansion — Batch B, route 9 of 10. Priority 2 (South Asia/Pakistan,
verified connecting route, zero prior observations, no existing Deal).

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20Leeds%20Bradford%20to%20Islamabad%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, Leeds Bradford (confirmed `LBA` in the origin field) → Islamabad, 1 adult, Economy,
GBP, Thu 1 Oct – Thu 15 Oct 2026. Only one itinerary was returned for these exact dates (the page's
own "from £840" teaser figure did not correspond to any listed result for this date pair and was not
used — only the actual listed itinerary was recorded). Results-list evidence only, no click-through
into a booking flow.

**Top (only) result:** Aer Lingus and Qatar Airways (the Aer Lingus leg shown as "Operated by Emerald
Airlines"), £916 round trip, per person. LBA 20:05 → ISB 01:50+2 via Dublin (DUB) and Doha (DOH),
**2 stops**, 25h45m total.

**Directness:** `fareDirectness: 'connecting'` — the source states "2 stops" via Dublin and Doha for
the outbound leg. The return leg was not reviewed; per this batch's directness rules, a
confirmed-connecting outbound is sufficient on its own to record `'connecting'`.

**Baggage:** not shown in the results list — recorded as `'not stated'`. No bag-fees dialog opened.

**Evidence type:** DOM/accessibility-tree data only (Google Flights' rendered results list, read via
the browser's accessibility tree) — no screenshot was captured or archived this check.
