# Evidence record — Manchester–Ahmedabad fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-man-amd-economy-20260806-8w-v1`

> **⚠ Correction, 6 August 2026 audit:** `fareDirectness` was originally recorded as `'connecting'`
> on the strength of the outbound leg's "1 stop" label alone. Only the outbound was ever reviewed —
> the return leg's routing was never confirmed. Corrected to **`fareDirectness: 'unknown'`**. The
> observation itself (price, airline, dates) remains valid and publishable. Note: this correction
> does not affect this route's Atlas grade — Manchester–Ahmedabad's promotion to Strong depends only
> on a publishable fare observation existing, not on its directness value; see
> `FARE_OBSERVATION_ARCHIVE.md`'s audit addendum for the full account.

**Context:** Fare Coverage Expansion — Batch A, route 6 of 10. This route had zero prior
observations — this is its first. Lean process: results-list evidence only, no click-through, no
baggage-rule digging.

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Ahmedabad%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, Manchester → Ahmedabad, 1 adult, Economy, GBP, Thu 1 Oct – Thu 15 Oct 2026. "11
results returned." Sort: Best (default). Top-ranked result taken (cheapest overall was £503).

**Top result:** Emirates, £666 round trip, per person. MAN 09:50 → AMD 03:05+1, **1 stop**, 12h 45m
total. Read directly from the results list, no click-through.

**Directness:** `fareDirectness: 'connecting'` — the source states "1 stop"; this matches the
route's own editorial note that no direct Manchester–Ahmedabad service exists. Connecting city not
captured.

**Baggage:** not shown in the results list — recorded as `'not stated'`.

No screenshot was rendered (tool unavailable this session). No durable availability claim was shown
or recorded.
