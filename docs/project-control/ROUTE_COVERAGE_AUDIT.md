# Route Coverage Truth and Completion — Phase 1 Audit

**Date:** 6 August 2026
**Scope:** Atlas route/country status honesty + a structured, evidence-based completeness audit of all 32 public routes.
**Computed against:** `main` at commit `dc9f6fb`, using the real production data and the exact function (`computeRouteIntelligenceLevel` in `lib/atlas-network-data.ts`) the live Atlas itself calls — this document and the product cannot drift apart, because they're the same derivation.
**What this document is not:** a completion plan that's already been executed. Nothing in this phase completed missing route intelligence, added fare observations, or changed a route fact. This is Phase 1 — truth and audit only. See "Recommended route-completion batches" for what Phase 2+ would involve.

---

## 1. Executive summary

JetStash currently presents 32 public routes. The intelligence behind them was genuinely uneven, and the Atlas didn't explain that difference — it let a single verified destination make an entire country read "strong," and offered no honest middle state between "verified" and "not yet researched" at the country level.

This phase does not claim every route is now complete. It does three things:

1. **Fixes what the Atlas says.** Every route now shows one of three honestly-derived, non-blank statuses — *"JetStash knows this route well"*, *"Useful route guidance available"*, or *"Intelligence still being expanded"* — computed from real fields (current verification, connecting-route detail, per-airline verification, publishable fare evidence, Book-By priority, or a specific investigated warning), never manually assigned. Country-level aggregation is now conservative: one strong destination can no longer carry an entire country.
2. **Grades all 32 routes honestly**, using that same derivation, and states plainly what's missing from each one that isn't "strong."
3. **States the real fare-tracking scope** — 8 of 32 routes have any publicly-displayable fare observation, all 8 currently fresh — and fixes the one page (`/deals`) most likely to read as claiming broader coverage than exists.

**Headline numbers, computed from the real data:**

| | Count | of 32 |
|---|---|---|
| **Strong** — JetStash knows this route well | 16 | 50% |
| **Useful** — useful route guidance available | 16 | 50% |
| **Expanding** — intelligence still being expanded | 0 | 0% (this state applies to Atlas destinations with no `routes.ts` entry at all, not to any of the 32) |
| Routes with any publicly-displayable fare observation | 8 | 25% |
| Soft-launch routes (of 6) with a fresh fare observation | 5 | 83% |

**One finding worth surfacing immediately:** the Atlas's own default landing route, Manchester–Dubai, is graded **Useful, not Strong** — it has zero *publicly displayable* fare observations. Two logged observations exist in `data/fare-observations.ts` (`obs-man-dxb-economy-1`/`business-1`) but predate the Truth Reset's `departureDate`/`returnDate` requirement, so they don't count as evidence today. This is exactly the "looks complete, thin underneath" pattern this audit was commissioned to find. See §6 and §4.

---

## 2. Status definitions

### Route-level (every one of the 32 routes gets exactly one)

| Status | Customer-facing label | Definition |
|---|---|---|
| **Strong** | "JetStash knows this route well" | Current direct/connecting status is confirmed (`getDisplayDirectness()` returns `'direct'` or `'connecting'`, never `'unverified'`) **and** at least one genuine depth signal exists beyond the baseline route page: a publishable fare observation, a `connectingAlternative` detail block, per-airline verification (`airlineVerifications`), Book-By priority modelling, or an active, specifically-investigated warning. |
| **Useful** | "Useful route guidance available" | A real route guide exists (every route has one — intro, booking-window note, peak periods are required fields), but the route doesn't meet the Strong bar: either its current direct/connecting status isn't confirmed, or it is confirmed but carries none of the depth signals above. |
| **Expanding** | "Intelligence still being expanded" | No `data/routes.ts` entry exists at all — an Atlas destination backed only by `data/network-evidence.ts` (real, sourced evidence that the destination is reachable, but no dedicated JetStash route guide yet). None of the 32 routes this audit covers are in this state by definition; it applies to the wider Atlas destination set (Istanbul, Antalya, Marrakech, and others). |

**Why "depth signal" is defined this way, not some other way:** every one of the five signals is something the codebase already independently gates and can't be gamed by rewording prose. A route can't become "Strong" by writing a longer intro — it has to have a fare observation that passed the Truth Reset's date-completeness+route-status gate, or a `connectingAlternative` block, or a per-airline verification record, or be one of the five Book-By priority routes, or have an active warning that was actually researched (not merely "0 warnings" read as "nothing to say," which would perversely reward routes nobody has looked closely at).

**What this deliberately is not:** the `factsConfidence: 'verified' | 'editorial-estimate'` field `data/routes.ts` documents removing (see that file, ~line 974). That field collapsed a route's *whole fact bundle* into one label and called it "verified" even when frequency or a specific airline wasn't independently confirmed — which was false. This status answers a narrower, honestly-answerable question — how much *depth of guidance* exists — and never overrides or summarises individual fact accuracy. A Strong-graded route can still have an unconfirmed frequency string, same as before; nothing here claims otherwise.

### Country-level (a conservative aggregate of its own destinations, per airport)

| Status | Label | Rule |
|---|---|---|
| **Strong** | "JetStash knows this country well" | Every destination in the country is Strong. |
| **Mixed** | "Coverage is mixed — some routes are more developed than others" | At least one destination is Strong, but not all of them. **This is the fix** — previously, *any* Strong destination made the whole country read "strong," even with three Expanding siblings. |
| **Useful** | "Useful guidance available — coverage is still developing" | No Strong destination, but at least one Useful. |
| **Expanding** | "Early-stage coverage — still being researched" | Every destination is Expanding. |

A separate, additive signal — **active service notice** — covers a live withdrawal/service-change announcement (currently Manchester–Delhi and Manchester–Mumbai's IndiGo notice). It is deliberately *not* part of the status above: a well-researched route doesn't become less well-researched because its service is changing. It renders as its own labelled callout in the Atlas destination panel and its own aria-label suffix, never by silently demoting the tier.

---

## 3. Complete 32-route audit table

Grouped by grade. "Depth signals" lists which of the five Strong-qualifying facts the route actually has (routes graded Useful have none). "Fare" shows publishable observation count and freshness as of 6 Aug 2026 (`OBSERVATION_FRESH_DAYS` = 60). "TC" = has a real Trip.com link.

### Strong (16 of 32)

| Route | Direct/Connecting | Depth signals | Fare | TC | Notes |
|---|---|---|---|---|---|
| Manchester–Lahore | Direct, verified | Fare, Book-By | 2, fresh | Y | Soft-launch route. |
| Manchester–Islamabad | Direct, verified | Fare, Book-By | 2, fresh | Y | Soft-launch route. |
| Heathrow–Delhi | Direct (airline-verified) | Fare, airline-verif, Book-By | 2, fresh | N | No Heathrow-origin Trip.com link exists (by design — see AFF-001). |
| Birmingham–Amritsar | Connecting | Fare, Book-By, warning (reduced frequency) | 2, fresh | Y | Soft-launch route. |
| Heathrow–Jeddah | Direct (airline-verified) | Fare, airline-verif, Book-By | 2, fresh | N | Saudia's own status is separately unverified — BA's evidence doesn't cover it. |
| Leeds Bradford–Islamabad | Connecting | Warning (specific, sourced: repeated failed direct claims) | 0 | Y | Strong on the strength of a genuinely researched caution, not fare/verification depth — see §6 for why this is legitimate, not a loophole. |
| Heathrow–Mumbai | Direct (airline-verified, 3 airlines) | Fare, airline-verif | 1, fresh (13d) | N | |
| Heathrow–Bengaluru | Direct (airline-verified, 2 airlines) | Airline-verif | 0 | N | No fare observation logged yet — flagged in §6. |
| Manchester–Doha | Direct, verified | Fare | 1, fresh (1d) | Y | Soft-launch route. |
| Gatwick–Ahmedabad | Direct, verified | Warning (reduced frequency) | 0 | N | |
| Gatwick–Amritsar | Direct, verified | Warning (reduced frequency) | 0 | N | |
| Manchester–Delhi | Direct, verified | Connecting-alternative, active status event | 0 | Y | Active withdrawal notice (IndiGo, effective 31 Aug 2026) — shown as a separate service notice, doesn't affect this grade. |
| Manchester–Mumbai | Direct, verified | Connecting-alternative, active status event | 0 | Y | Same withdrawal notice as Delhi. |
| Manchester–Amritsar | Connecting | Connecting-alternative | 0 | Y | |
| Manchester–Ahmedabad | Connecting | Connecting-alternative | 0 | Y | |
| Manchester–Madinah | Connecting | Connecting-alternative, fare | 1, fresh (1d) | Y | Soft-launch route. |

### Useful (16 of 32)

| Route | Direct/Connecting | Why not Strong | Fare | TC |
|---|---|---|---|---|
| Manchester–Dubai | Direct, verified | **No depth signal** — verified but no fare/connecting-alt/airline-verif/Book-By/warning. **The Atlas default landing route.** | 0 (2 unpublishable — see §6) | Y |
| Heathrow–Doha | Direct, verified | No depth signal. | 0 | N |
| Manchester–Karachi | Direct, **unverified** | Current direct claim not confirmed by a primary source. | 0 | Y |
| Birmingham–Lahore | Direct, **unverified** | Current direct claim not confirmed by a primary source. | 0 | Y |
| Birmingham–Islamabad | Direct, **unverified** | Conflicting secondary sources, no primary source resolves it. | 0 | Y |
| Leeds Bradford–Amritsar | Connecting | No depth signal (no fare, no warning, no connecting-alt). | 0 | Y |
| Heathrow–Dhaka | Direct, **unverified** | Real evidence of current operation (live flight-tracking) but stop pattern unconfirmed. | 0 | N |
| Manchester–Dhaka | Connecting, verified | Connecting and verified, but no other depth signal. | 0 | Y |
| Manchester–Sylhet | Direct, **unverified** | Genuine, disclosed contradiction between Manchester Airport's own page and Biman's notice. | 0 | Y |
| Heathrow–Sylhet | Direct, **unverified** | Real evidence (flight-tracking + independent schedule sources) but not primary-confirmed. | 0 | N |
| Manchester–Jeddah | Connecting | No depth signal. | 0 | Y |
| Birmingham–Madinah | Connecting | No depth signal. | 0 | Y |
| Birmingham–Mumbai | Connecting, verified | Connecting and verified (Birmingham Airport's own page), but no other depth signal. | 0 | Y |
| Glasgow–Dubai | Direct, verified | No depth signal. | 0 | Y |
| Edinburgh–Dubai | Direct, verified | No depth signal. | 0 | Y |
| Newcastle–Dubai | Direct, verified | No depth signal. | 0 | Y |

### Full route index (by slug)

Machine-checkable manifest — every one of the 32 routes, exactly once, with its exact grade. See §6 for gaps on any route below Strong.

| Slug | Grade |
|---|---|
| `birmingham-amritsar` | Strong |
| `birmingham-islamabad` | Useful |
| `birmingham-lahore` | Useful |
| `birmingham-madinah` | Useful |
| `birmingham-mumbai` | Useful |
| `edinburgh-dubai` | Useful |
| `glasgow-dubai` | Useful |
| `leeds-bradford-amritsar` | Useful |
| `leeds-bradford-islamabad` | Strong |
| `london-gatwick-ahmedabad` | Strong |
| `london-gatwick-amritsar` | Strong |
| `london-heathrow-bengaluru` | Strong |
| `london-heathrow-delhi` | Strong |
| `london-heathrow-dhaka` | Useful |
| `london-heathrow-doha` | Useful |
| `london-heathrow-jeddah` | Strong |
| `london-heathrow-mumbai` | Strong |
| `london-heathrow-sylhet` | Useful |
| `manchester-ahmedabad` | Strong |
| `manchester-amritsar` | Strong |
| `manchester-delhi` | Strong |
| `manchester-dhaka` | Useful |
| `manchester-doha` | Strong |
| `manchester-dubai` | Useful |
| `manchester-islamabad` | Strong |
| `manchester-jeddah` | Useful |
| `manchester-karachi` | Useful |
| `manchester-lahore` | Strong |
| `manchester-madinah` | Strong |
| `manchester-mumbai` | Strong |
| `manchester-sylhet` | Useful |
| `newcastle-dubai` | Useful |

---

## 3.5. Airport and baggage guidance coverage

Part D of the brief asked this to be recorded explicitly per route, separately from the Strong/Useful/Expanding grade above — it is a genuinely different signal (practical trip-planning content, not route-existence evidence) and deliberately does **not** feed into `computeRouteIntelligenceLevel()`. Computed from `data/traveller-tips.ts`, the only structured source for this content (`TravellerTipScope` can target a `routeSlug`, `destinationSlug`, or `airportSlug`).

- **Airport guidance:** every route's departure airport has a general airport guide page (`/airports/[slug]`, `description`/`whyThisAirport` in `data/airports.ts`) — universal baseline coverage, not a differentiator between routes. But **zero of the 10 traveller tips are scoped to an `airportSlug`** — no route currently has dedicated, route-specific airport guidance (terminal, check-in, transfer-specific advice) beyond that shared baseline. This is a real, previously unrecorded gap, not a data error — nothing here was invented to fill it.
- **Baggage guidance:** 3 of the 10 traveller tips are `category: 'baggage'`, scoped to Lahore, Delhi and Mumbai. Because tips are destination-scoped (not per-route), this reaches **5 of 32 routes**: Manchester–Lahore, Birmingham–Lahore, Heathrow–Delhi, Manchester–Delhi, Manchester–Mumbai. The other 27 routes have no dedicated baggage guidance.
- **Overlap with §3's grade:** low — baggage/airport tip coverage doesn't track the Strong/Useful split at all (e.g. Manchester–Lahore is Strong *and* has baggage guidance, but Heathrow–Bengaluru is Strong with none; Manchester–Karachi is Useful but has a destination tip, just not a baggage one). Treat this as an independent axis, not a sub-component of the grade above.

This is not a Phase 1 action item — flagged here for the Phase 2+ batches in §7, since it's the kind of gap a future batch could reasonably close alongside a fare check for the same route.

---

## 4. Six launch-route readiness

Audited to the same standard as every other route — **not upgraded for being launch priorities.**

| Route | Grade | Genuinely meets the strongest standard? | Exact missing work, if any |
|---|---|---|---|
| Manchester–Lahore | **Strong** | Yes. | None for this grade. (Broader gaps — e.g. no `airlineVerifications` detail beyond the route-level record — are cosmetic, not blocking.) |
| Manchester–Islamabad | **Strong** | Yes. | None for this grade. |
| Birmingham–Amritsar | **Strong** | Yes. | None for this grade. |
| Manchester–Doha | **Strong** | Yes. | None for this grade. |
| Manchester–Madinah | **Strong** | Yes. | None for this grade. |
| **Manchester–Dubai** | **Useful** | **No.** | **Needs a fresh, dated, methodology-compliant fare observation** (with `departureDate`/`returnDate`) to earn Strong on fare depth — the two existing observations predate the dating requirement and don't count. Alternatively, a `connectingAlternative` block or Book-By priority inclusion would also clear the bar, but a fare observation is the most natural fit given this route's own booking-window copy already discusses comparing fares. |

**Verdict: 5 of the 6 soft-launch routes genuinely meet the strongest standard today. Manchester–Dubai does not, and is not being upgraded here to make the launch set look complete — it needs one real, dated fare check.** This is squarely a Phase 2 action (adding a fare observation), explicitly out of scope for this phase.

---

## 5. Fare-tracking coverage truth

- **Exact number of routes with any publishable observation:** 8 of 32 (25%).
- **Exact number with recent (≤60 day), methodology-compliant observations:** 8 of 32 — every currently-publishable observation happens to also be fresh (the two oldest publishable ones, Heathrow–Mumbai and the historic 18, only Heathrow–Mumbai's dated entry survives the publishability gate, at 13 days old).
- **Total raw entries in the archive:** 31 (`data/fare-observations.ts`), of which 8 routes' worth pass `isPubliclyPublishable()` (requires both `departureDate` and `returnDate` — a Truth Reset requirement the original 18 entries predate).
- **Soft-launch coverage:** 5 of 6 (Manchester–Dubai is the gap — see §4).
- **Did "Fares we're tracking" imply broader coverage than exists?** Yes, on the one page most likely to be read as a coverage claim: `/deals`. Its hero said "Fares we're tracking" and cited only a raw count of checks logged (31) and airports covered, never the route denominator — a visitor had no way to see this spans 8 of 32 routes, not most of the network. **Fixed in this phase** — see §7's implementation note.
- **Do empty/thin categories look abandoned?** No — this was already handled correctly before this phase. `NoFareFallback` ("We haven't logged a tracked fare for {city} yet") renders wherever a route/destination/airport/cabin has zero observations, with a Trip.com comparison link where one exists. Nothing was found to fix here.
- **Is observation age clear?** Yes — every fare-rendering surface (`DealCard`, `FareHistoryPanel`, `BookByCountdown`) already uses the shared 3-tier freshness model (`lib/freshness-thresholds.ts`: fresh ≤60 days, ageing ≤180 days, stale beyond) with visible de-emphasis and explicit "this is old" copy for stale observations.
- **Is the manual-verification methodology explained clearly?** Yes, on `/deals` itself and in `docs/project-control/FARE_OBSERVATION_ARCHIVE.md` — the hero already linked "Read our standards" before this phase, and that page's own content is accurate and unaffected by this audit.

**Recommended and implemented wording** (per the brief's example, using the real, live-computed count rather than a hand-typed number that could drift):

> "We're currently tracking fares on **8 of our 32 routes** — coverage is being expanded gradually using manually verified observations, not a live price feed."

This is now the opening line of `/deals`'s hero, with `8` and `32` both computed live from `routes.length` and `getPublishableObservationsByRoute()` — the same functions this audit itself calls — so the sentence can never silently drift out of sync with reality the way a hand-typed figure could.

---

## 6. Exact gaps by route

Only routes with a genuine, specific, actionable gap are listed (Strong routes with no gap are omitted; see §3 for their full record).

| Route | Gap | What would close it |
|---|---|---|
| **Manchester–Dubai** | Zero publicly-displayable fare evidence, despite being the Atlas's own default landing route. Two logged observations exist but predate the dating requirement. | One fresh, dated, methodology-compliant fare check (`departureDate`+`returnDate`). |
| Heathrow–Bengaluru | Airline service is confirmed by two independent primary sources, but no fare observation has ever been logged. | One fresh, dated fare check. |
| Manchester–Karachi | Direct claim not confirmed by any primary source; secondary aviation-news reporting only. | A route-specific PIA or airport-schedule primary source. |
| Birmingham–Lahore | Same — no primary source confirms a direct Birmingham–Lahore PIA service. | A route-specific primary source. |
| Birmingham–Islamabad | Conflicting secondary sources; genuinely unresolved. | A route-specific primary source that resolves the conflict either way. |
| Manchester–Sylhet | Direct, disclosed contradiction between Manchester Airport's own page ("not flying to this location") and Biman's official Manchester–Dhaka-via-Sylhet notice. | A Biman-direct or Manchester Airport-direct source that resolves the contradiction. |
| Heathrow–Dhaka / Heathrow–Sylhet | Real, current flight-tracking evidence exists, but the exact stop pattern (nonstop vs. via Sylhet) is unconfirmed by any primary source. | A Biman or Heathrow route-specific source stating the stop pattern directly. |
| 10 "no depth signal" Useful routes (Heathrow–Doha, Leeds Bradford–Amritsar, Manchester–Dhaka, Manchester–Jeddah, Birmingham–Madinah, Birmingham–Mumbai, Glasgow/Edinburgh/Newcastle–Dubai) | Verified and correctly described, but carry none of the five Strong-qualifying depth signals — no fare, no connecting-alternative detail, no per-airline verification breakdown, not Book-By priority, no specifically-investigated warning. | Any one of: a fare observation, a `connectingAlternative` block (for the connecting ones), or Book-By priority inclusion (a founder decision, not this phase's to make). |

**Routes that appear visually complete but have thin underlying intelligence** (the specific question the brief asked): **Manchester–Dubai** is the clearest case — verified, direct, a Trip.com link, and the Atlas's own default first impression, yet zero fare evidence behind it. Heathrow–Bengaluru is the second case — two independent airlines confirmed, but no price evidence at all.

**Routes with stale or weak evidence:** none of the 32 routes currently have a *stale* `verification` record (every `reviewDueDate` is still in the future as of 6 Aug 2026) — but 9 of them have `unverified` status specifically because no primary source was ever found, not because a once-good source went stale. That's a different, harder gap (needs new evidence, not re-verification of old evidence).

---

## 7. Recommended route-completion batches

Based on the actual data above, not a generic template:

- **Batch 1 — close the one soft-launch gap.** Manchester–Dubai: one fresh fare observation. Smallest possible batch, highest priority — it's both a launch route and the Atlas default.
- **Batch 2 — the other "visually complete, fare-thin" Strong route.** Heathrow–Bengaluru: one fresh fare observation.
- **Batch 3 — the three unresolved Pakistan primary-source gaps.** Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad — all need the same kind of evidence (a route-specific PIA or airport-schedule primary source), so investigating them together is efficient.
- **Batch 4 — the four unresolved Bangladesh primary-source gaps.** Manchester–Sylhet, Heathrow–Dhaka, Heathrow–Sylhet (stop-pattern confirmation), grouped with Manchester–Karachi/Birmingham's Pakistan batch if convenient, or separately given they need Bangladesh-specific sources (Biman, Manchester Airport, Heathrow).
- **Batch 5 — the 10 "no depth signal" Useful routes**, roughly in commercial-value order: Heathrow–Doha (Gulf, no Trip.com link but high search interest) and the three single-destination Dubai routes (Glasgow/Edinburgh/Newcastle, each simple — one fare check apiece would move all three to Strong) first; Manchester–Jeddah, Birmingham–Madinah, Birmingham–Mumbai and Manchester–Dhaka (all connecting, would benefit from a `connectingAlternative` block) after; Leeds Bradford–Amritsar last (smallest airport, lowest relative volume).

**Suggested order of work:** Batch 1 → Batch 2 → Batch 3 → Batch 4 → Batch 5. Batches 1–2 are single-fare-check items (fastest, highest-leverage — one soft-launch route and one already-Strong-adjacent route). Batches 3–4 require new primary-source research, not fare-checking, so they're naturally slower and should be scheduled with that in mind rather than rushed to match Batch 1–2's pace.

---

## 8. Criteria for upgrading a route

A route moves from **Useful → Strong** when it gains at least one of:
1. A fresh, methodology-compliant, publicly-publishable fare observation (`departureDate` + `returnDate` both set, per `data/fare-observations.ts`'s standard).
2. A `connectingAlternative` block (for a connecting route) — real hub/airline/journey-time detail, not invented.
3. A per-airline `airlineVerifications` entry, sourced the same way route-level verification already is.
4. Inclusion in `BOOK_BY_PRIORITY_ROUTE_SLUGS` (a founder-level product decision, not a data-entry task).
5. A specific, sourced, investigated active warning (`data/route-warnings.ts`) — only when the investigation is real, never added just to hit this bar.

A route moves from **Unverified-direct → Verified** (a prerequisite for Strong on most direct routes) only through a genuine primary source — an airline's own booking system, a UK airport's own schedule/destination page, or equivalent — never a secondary aviation-news report alone, per the standing sourcing rule (CLAUDE.md, "Verified route and airport claims").

## 9. Criteria for making a route eligible for public fare-tracking claims

Already fully defined and unchanged by this phase — `isPubliclyPublishable()` in `data/fare-observations.ts` requires:
1. Both `departureDate` and `returnDate` recorded (the Truth Reset requirement; historic entries predating it stay in the archive but never render publicly).
2. A real, current `data/routes.ts` entry for that exact route slug.
3. The route's effective status (`getEffectiveRoutePresentation()`) is `'direct'` or `'connecting'` — never `'unverified'` or `'service-ended'`.

This phase adds nothing new here — it only makes the *aggregate* consequence of these rules (8 of 32 routes currently qualify) visible on `/deals`, where it wasn't stated before.

---

## Appendix: what this phase deliberately did not do

Per the brief's explicit scope:
- Did not rewrite any of the 32 route pages.
- Did not add any new fare observation (the Manchester–Dubai and Heathrow–Bengaluru gaps identified in §6 remain open).
- Did not complete any missing route intelligence.
- Did not add a new route or a new country.
- Did not redesign the Atlas beyond the status/aggregation/legend changes this document describes.
- Did not touch Arrive By, Book By's own logic, Trip.com links, or affiliate provider behaviour.
- Did not change which country the Atlas defaults to per airport, or which routes carry Book-By priority — those are product/founder decisions, not truth-and-honesty fixes.
