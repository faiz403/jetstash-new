# Atlas Airport Network Audit

Audited 2026-07-26. Covers every UK airport in `data/airports.ts` against `data/routes.ts` (real,
individually-researched Route Status ledger entries — the only tier of evidence this codebase
treats as adequate) and `data/destinations.ts`'s `ukAirports` arrays (unsourced editorial claims,
already established as inadequate on their own by the Manchester network-evidence audit,
`data/network-evidence.ts`).

## 1–2. Every UK airport and what's claimed for it

| Airport | Destinations claimed (`ukAirports`) | Direct long-haul? |
|---|---|---|
| Manchester | 22 (already audited, see `data/network-evidence.ts`) | Yes |
| Birmingham | 18: Lahore, Islamabad, Delhi, Mumbai, Amritsar, Ahmedabad, Dubai, Doha, Jeddah, Istanbul, Antalya, Dalaman, Bodrum, Agadir, Barcelona, Faro, Athens, Rome | Yes |
| London Heathrow | 9: Lahore, Karachi, Delhi, Mumbai, Dubai, Doha, Jeddah, Madinah, Casablanca | Yes |
| London Gatwick | 15: Amritsar, Ahmedabad, Dubai, Istanbul, Antalya, Dalaman, Bodrum, Izmir, Marrakech, Agadir, Tangier, Barcelona, Faro, Athens, Rome | Yes |
| Leeds Bradford | 6: Istanbul, Antalya, Dalaman, Bodrum, Barcelona, Faro | No |
| Glasgow | 5: Dubai, Antalya, Dalaman, Bodrum, Athens | Yes |
| Edinburgh | 4: Dubai, Barcelona, Antalya, Faro | Yes |
| Newcastle | 2: Dubai, Dalaman | Yes |
| Bristol | 6: Antalya, Dalaman, Marrakech, Barcelona, Faro, Rome | No |
| East Midlands | 0 | No |
| Liverpool | 0 | No |

## 3. Adequately network-evidenced claims (real `routes.ts` entries)

| Airport | Routes.ts entries | Notes |
|---|---|---|
| Manchester | Lahore, Islamabad, Dubai, Karachi, Doha, Jeddah, Delhi, Mumbai, Amritsar, Ahmedabad, Madinah (11) | |
| Birmingham | Amritsar, Lahore, Islamabad, Madinah, Mumbai (5) | Madinah/Mumbai missing from those destinations' own `ukAirports` — the route ledger is more complete than the editorial field |
| London Heathrow | Delhi, Doha, Jeddah, Mumbai (4) | |
| London Gatwick | Ahmedabad, Amritsar (2) | |
| Leeds Bradford | Amritsar, Islamabad (2) | Both `isDirect: false` — genuinely researched, honest answer is connecting-only, consistent with `airports.ts`'s own caution about unstable direct-service claims here |
| Glasgow | Dubai (1) | |
| Edinburgh | Dubai (1) | |
| Newcastle | Dubai (1) | |
| Bristol / East Midlands / Liverpool | none | Matches `hasDirectLongHaul: false` for all three |

## 4. Unsourced editorial claims requiring verification

Every Mediterranean/North Africa leisure destination for every airport (Istanbul, Antalya, Dalaman,
Bodrum, Izmir, Marrakech, Agadir, Barcelona, Faro, Athens, Rome, Casablanca, Tangier), plus for the
long-haul network specifically: Birmingham→Delhi/Ahmedabad/Dubai/Doha/Jeddah, Heathrow→Lahore/
Karachi/Dubai/Madinah/Casablanca.

**Inconsistency, not just unsourced:** `airports.ts`'s Heathrow entry lists `shortHaulHighlights:
['Rome', 'Lisbon', 'Athens']` — Rome/Athens's own `ukAirports` don't include Heathrow, and no
"Lisbon" destination exists anywhere in `data/destinations.ts`. Worth a separate fix regardless of
airport-expansion sequencing.

## 5. Recommendation — smallest honest first set

**Birmingham.** The only additional airport with a substantial existing sourced network (5 real
routes across Pakistan, Saudi Arabia and India), a genuine major-UK-airport profile with its own
`whyThisAirport` narrative, and destinations spanning three countries — enough to actually exercise
the multi-country hierarchy, unlike a single-route airport.

**Not** Glasgow/Edinburgh/Newcastle yet — each has exactly one sourced destination (Dubai), so
three near-identical single-country airports would add a lot of new UI surface for very little new
signal.

**Not** Leeds Bradford — both sourced routes are honestly connecting-only, and `airports.ts` itself
warns about unstable prior direct-service claims on this exact corridor. The data isn't dishonest,
it's just a weaker first example than Birmingham for proving out the multi-airport engine.

No Birmingham (or other) `network-evidence.ts` records have been built, and no new airport data has
been wired into the Atlas — held pending approval of this audit, per instruction.

---

## Update, 2026-07-26 (later same day): all approved Airport Packs built

Birmingham was approved and built first (see prior session), then the remaining six were approved
in one batch: London Heathrow, London Gatwick, Glasgow, Edinburgh, Newcastle, Leeds Bradford.
Bristol was named in that batch too but excluded here for the same reason Liverpool/East Midlands
were excluded above — zero `routes.ts` entries. Stansted, Luton, Belfast and Cardiff were raised
separately and checked: none exist anywhere in `data/airports.ts` or `data/routes.ts` — not
unsourced, genuinely absent from the data model.

| Airport | Countries | Destinations | Route Status-backed | Future destinations needing Network Evidence research |
|---|---|---|---|---|
| Manchester | 11 | 22 | 11 (Lahore, Islamabad, Karachi, Delhi, Mumbai, Amritsar, Ahmedabad, Dubai, Doha, Jeddah, Madinah) | 0 outstanding — the other 11 already have Network Evidence (Istanbul, Antalya, Dalaman, Bodrum, Izmir, Marrakech, Agadir, Barcelona, Faro, Athens, Rome) |
| Birmingham | 3 | 5 | 5 (Amritsar, Lahore, Islamabad, Madinah, Mumbai) | 14: Delhi, Ahmedabad, Dubai, Doha, Jeddah, Istanbul, Antalya, Dalaman, Bodrum, Agadir, Barcelona, Faro, Athens, Rome |
| London Heathrow | 3 | 4 | 4 (Delhi, Doha, Jeddah, Mumbai) | 5: Lahore, Karachi, Dubai, Madinah, Casablanca |
| London Gatwick | 1 | 2 | 2 (Ahmedabad, Amritsar) | 13: Dubai, Istanbul, Antalya, Dalaman, Bodrum, Izmir, Marrakech, Agadir, Tangier, Barcelona, Faro, Athens, Rome |
| Glasgow | 1 | 1 | 1 (Dubai) | 4: Antalya, Dalaman, Bodrum, Athens |
| Edinburgh | 1 | 1 | 1 (Dubai) | 3: Barcelona, Antalya, Faro |
| Newcastle | 1 | 1 | 1 (Dubai) | 1: Dalaman |
| Leeds Bradford | 2 | 2 | 2 (Amritsar, Islamabad — both genuinely connecting-only, `isDirect: false`) | 6: Istanbul, Antalya, Dalaman, Bodrum, Barcelona, Faro |

**Excluded, not built:** Bristol, Liverpool, East Midlands — all zero `routes.ts` entries.
**Not in JetStash's data at all:** Stansted, Luton, Belfast, Cardiff.

**Two bugs surfaced and fixed generically while building these, not special-cased to one airport:**
- `buildDestinationPoint`'s verdict text always said "Direct service verified." whenever a route's
  verification status was `'verified'`, regardless of `isDirect`. Latent since none of Manchester's
  verified routes happened to also be `isDirect: false`; Birmingham's `birmingham-mumbai` (verified
  as genuinely having *no* direct service) exposed it immediately. Now branches on `isDirect` in
  both the verified and pending states — confirmed live for Birmingham (Mumbai) and Leeds Bradford
  (Amritsar, Islamabad).
- The shared `<svg>` viewBox, sized for Manchester's origin position, clipped Glasgow's and
  Edinburgh's origin glow at its breathing-animation peak — both airports sit further north than
  Manchester. Extended the top boundary by the minimum amount needed, verified against every
  airport's real position (not just the two that triggered it) with zero clipping margin remaining
  on the tightest case (Edinburgh).

tsc, lint, and all 531 tests pass; zero console errors on desktop or mobile for any of the 8
airports now wired in. No homepage integration, no deploy — held pending founder review.
