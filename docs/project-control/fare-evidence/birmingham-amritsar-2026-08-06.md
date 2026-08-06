# Evidence record — Birmingham–Amritsar fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-bhx-atq-economy-20260806-8w-v1`

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

**Directness:** `fareDirectness: 'connecting'` — the source states "1 stop"; matches the route's own
editorial note ("does not list a direct flight"). Connecting city not captured.

**Baggage:** not shown in the results list — recorded as `'not stated'`.

No screenshot was rendered (tool unavailable this session). No durable availability claim was shown
or recorded. **Expected effect:** since this observation's source (Air India) matches the route's
own verified operator, `bhx-atq-economy`'s `DealCard` badge should now resolve to "Connecting"
instead of no badge at all — to be confirmed in the quality-gate verification pass.
