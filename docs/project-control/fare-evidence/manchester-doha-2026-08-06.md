# Evidence record — Manchester–Doha fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-man-doh-economy-20260806-8w-v1`

**Context:** Fare Coverage Expansion — Batch A, route 8 of 10. One prior observation exists
(`obs-man-doh-economy-20260805-8w-v1`, Pegasus, connecting, checked 5 August 2026, predates
`fareDirectness`) and is left untouched. This fresh check is a genuinely different result. Lean
process: results-list evidence only, no click-through, no baggage-rule digging.

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Doha%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, Manchester → Doha, 1 adult, Economy, GBP, Thu 1 Oct – Thu 15 Oct 2026. "7 results
returned."

**Top result — a genuine nonstop service, not the cheapest option shown:** Qatar Airways (also sold
under a British Airways code, both names shown together on the same result), £666 round trip, per
person. MAN 08:05 → DOH 16:55, **Nonstop**, 6h 50m total. This is the route's own verified direct
operator (Qatar Airways) — the search confirms its own service is bookable via Google Flights.
Cheaper connecting options exist further down the list (e.g. Pegasus at £487), consistent with the
existing 5 August observation.

**Directness:** `fareDirectness: 'direct'` — the source itself states "Nonstop", not inferred from
the route's own verified status. **This is the first observation in the archive with an explicit
`'direct'` value** — every prior fareDirectness-bearing observation has been `'connecting'`.

**Baggage:** not shown in the results list — recorded as `'not stated'`.

No screenshot was rendered (tool unavailable this session). No durable availability claim was shown
or recorded.

**Note for a future reviewer:** Manchester–Doha now has two dated observations for the same cabin —
one connecting (Pegasus, no `fareDirectness`), one direct (Qatar Airways, `'direct'`). There is no
`man-doh-economy` Deal entry in `data/deals.ts`, so this does not currently create any badge risk.
If a Deal entry is ever added for this route, `getFareRangeSummary`'s `observedDirectness`
aggregation only considers observations that state a value — since only the new entry does, the
range's badge would currently resolve to `'direct'` even though the range also includes a cheaper
connecting fare. Worth a second look before adding a `man-doh-economy` Deal card.
