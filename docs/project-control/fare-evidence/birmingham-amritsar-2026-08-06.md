# Evidence record — Birmingham–Amritsar fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-bhx-atq-economy-20260806-8w-v1`

> **⚠ Correction, 6 August 2026 audit:** `fareDirectness` was originally recorded as `'connecting'`
> on the strength of the outbound leg's "1 stop" label alone. Only the outbound was ever reviewed —
> the return leg's routing was never confirmed. Corrected to **`fareDirectness: 'unknown'`**. This
> has a real, direct consequence unlike the other Batch A corrections: `bhx-atq-economy`'s
> `DealCard` badge no longer resolves to "Connecting" — with `observedDirectness` now `undefined`,
> `getDealFareDirectnessLabel()` falls back to checking whether every source airline matches the
> route's verified operator, and the two older observations (KLM/IndiGo, Air France/Air India) still
> fail that check, so the badge is back to showing nothing. Genuinely completing the return-leg
> evidence for this observation would be needed to earn that badge honestly. See
> `FARE_OBSERVATION_ARCHIVE.md`'s audit addendum for the full account.

**Context:** Fare Coverage Expansion — Batch A, route 10 of 10 (Batch A's last route). Two prior
observations exist (28 July 2026, KLM/IndiGo; 4 August 2026, Air France/Air India — both predating
`fareDirectness`) and are left untouched. This route is one of the three DealCard entries the PR #74
audit found showing no badge at all (mismatched airline against the route's verified Air India
service). Lean process: results-list evidence only, no click-through, no baggage-rule digging.

**Search:** `https://www.google.com/travel/flights?q=Flights%20from%20Birmingham%20to%20Amritsar%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB`
— Round trip, Birmingham → Amritsar, 1 adult, Economy, GBP, Thu 1 Oct – Thu 15 Oct 2026. "11 results
returned." Sort: Best (default). Top-ranked result taken (cheapest overall was £564).

**Top result:** Air India — the route's own verified operator, unlike either historic observation.
£714 round trip, per person. BHX 21:30 → ATQ 21:50+1, **1 stop**, 19h 50m total. Read directly from
the results list, no click-through.

**Directness (as originally recorded, now corrected — see banner above):** the outbound leg's own
source text states "1 stop", matching the route's own editorial note ("does not list a direct
flight"). But the return leg was never opened to confirm the same — **`fareDirectness` is now
recorded as `'unknown'`**, not `'connecting'`.

**Baggage:** not shown in the results list — recorded as `'not stated'`.

No screenshot was rendered (tool unavailable this session). No durable availability claim was shown
or recorded. **Actual effect, post-correction:** `bhx-atq-economy`'s `DealCard` badge does **not**
resolve to "Connecting" from this observation alone — with an explicit value no longer present, the
fallback "every source matches the route's verified operator" check still fails (the two older
observations' KLM/IndiGo and Air France sources don't match Air India), so the badge shows nothing,
same as before this observation was added.
