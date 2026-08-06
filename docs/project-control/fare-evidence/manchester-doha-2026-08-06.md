# Evidence record — Manchester–Doha fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-man-doh-economy-20260806-8w-v1`

> **⚠ Correction, 6 August 2026 audit:** `fareDirectness` was originally recorded as `'direct'` on
> the strength of the outbound leg being explicitly labelled "Nonstop" — the most confident-looking
> of all the Batch A findings, and for that reason the one most important to get right. Only the
> outbound was ever reviewed; the return leg (DOH→MAN) was never opened or confirmed. A nonstop
> outbound does not establish a nonstop return, even for the route's own verified direct operator —
> corrected to **`fareDirectness: 'unknown'`**. This was the archive's only `'direct'` value; there
> is currently no confirmed-direct observation anywhere in the archive as a result. The observation
> itself (price, airline, dates) remains valid and publishable. See `FARE_OBSERVATION_ARCHIVE.md`'s
> audit addendum for the full account.

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

**Directness (as originally recorded, now corrected — see banner above):** the outbound leg's own
source text states "Nonstop", not inferred from the route's own verified status. But the return leg
was never opened to confirm the same — **`fareDirectness` is now recorded as `'unknown'`**, not
`'direct'`. There is currently no confirmed-direct observation anywhere in the archive.

**Baggage:** not shown in the results list — recorded as `'not stated'`.

No screenshot was rendered (tool unavailable this session). No durable availability claim was shown
or recorded.

**Note for a future reviewer:** Manchester–Doha now has two dated observations for the same cabin —
one connecting (Pegasus, no `fareDirectness`), one `'unknown'` (Qatar Airways, outbound-only
evidence). There is no `man-doh-economy` Deal entry in `data/deals.ts`, so this creates no badge
risk either way. A genuine second check — one that actually opens the return leg — would be needed
before this route could honestly record `'direct'`.
