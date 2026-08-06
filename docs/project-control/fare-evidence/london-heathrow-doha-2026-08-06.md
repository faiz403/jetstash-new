# Evidence record — London Heathrow–Doha fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-lhr-doh-economy-20260806-8w-v1`

**Context:** Fare Coverage Expansion — Batch B, route 1 of 10. Priority 1 (existing `lhr-doh-economy`
Deal, no publishable observation until now — the route's only prior entry, `obs-lhr-doh-economy-1`,
has no `departureDate`/`returnDate` and can never be publishable).

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20London%20Heathrow%20to%20Doha%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, London Heathrow (confirmed `LHR` in the origin field, not a generic London/LON
resolution) → Doha, 1 adult, Economy, GBP, Thu 1 Oct – Thu 15 Oct 2026. "14 results returned." Sort:
Best (default).

**Top result:** Etihad, £490 round trip, per person. Outbound LHR 14:45 → AUH 00:45+1 (flight EY64,
Airbus A380) → 1h15m layover in Abu Dhabi → AUH 02:00+1 → DOH 02:05+1 (flight EY663, Airbus A320neo,
"Plane and crew by Air Seychelles for Etihad Airways"), **1 stop**, 9h20m total. Opened "Flight
details" for this result specifically to confirm the connection point and both flight numbers, not
just the results-list summary. The return leg was not reviewed.

**Directness:** `fareDirectness: 'connecting'` — the outbound leg is explicitly confirmed as 1 stop
via Abu Dhabi (AUH), with both flight numbers read from the expanded flight-details panel. Per this
batch's directness rules ("either leg confirmed connecting → connecting"), one confirmed-connecting
leg is sufficient to call the observation connecting, even though the return leg was never opened —
this is a deliberate, narrower standard than Fare Coverage Expansion Batch A's convention (which
defaulted to `'unknown'` whenever the return wasn't reviewed, regardless of outbound findings); see
`FARE_COVERAGE_BATCH_B.md` for the full reasoning.

**Baggage:** not shown anywhere in the results list or the expanded flight-details panel — recorded
as `'not stated'`. No bag-fees dialog opened.

**Evidence type:** DOM/accessibility-tree data only (Google Flights' rendered results list and the
expanded flight-details panel, read via the browser's accessibility tree) — no screenshot was
captured or archived this check.
