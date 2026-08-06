# Route Coverage Truth and Completion — Phase 1 Audit

**Date:** 6 August 2026 (revised same day after a product-truth review — see "Revision note" below).
**Scope:** Atlas route/country status honesty + a structured, evidence-based completeness audit of all 32 public routes.
**Computed against:** `main`-derived branch `feat/atlas-route-status-truth`, using the real production data and the exact function (`computeRouteIntelligenceLevel` in `lib/atlas-network-data.ts`) the live Atlas itself calls — this document and the product cannot drift apart, because they're the same derivation.
**What this document is not:** a completion plan that's already been executed. Nothing in this phase completed missing route intelligence, added fare observations, or changed a route fact. This is Phase 1 — truth and audit only. See "Recommended route-completion batches" for what Phase 2+ would involve.

## Revision note (product-truth review, 6 August 2026)

The first version of this audit and the threshold it was built on required only **one** depth signal for a route to be graded "Strong" ("JetStash knows this route well"). A dedicated review of that threshold, run against the real 32-route dataset rather than unit-test fixtures, found this too permissive: 7 of the original 16 "Strong" routes qualified on exactly one shallow signal — a single `connectingAlternative` paragraph (Manchester–Amritsar, Manchester–Ahmedabad), a single warning (Leeds Bradford–Islamabad, Gatwick–Ahmedabad, Gatwick–Amritsar), or airline verification alone with no other guidance (Heathrow–Bengaluru), plus Manchester–Doha on a single fare check. The review's principle — *"a Strong route should have broad intelligence depth across several independent categories, not directness plus one signal"* — is now enforced in code: **`computeRouteIntelligenceLevel()` requires at least two of six independently-gated depth categories**, not one. This document has been fully regenerated against the corrected function. Every number below reflects the corrected threshold; the original, more permissive numbers are not reproduced here except where explicitly noted as "previously."

Two candidate categories were tested against the real data and deliberately **not** added: an "independently checkable source URL" category was dropped because every route-level `verified` record in the dataset already has one (14/14) — it never actually differentiated anything, it would only have inflated every verified route's score by one point for free. An "airport/transfer guidance" category was considered but 0 of 32 routes currently have any (see §3.5) — including it as a scored category today would make it un-clearable by definition; it stays tracked, not scored, until at least one route has one.

---

## 1. Executive summary

JetStash currently presents 32 public routes. The intelligence behind them was genuinely uneven, and the Atlas didn't explain that difference — it let a single verified destination make an entire country read "strong," and offered no honest middle state between "verified" and "not yet researched" at the country level, and (per the revision above) its first-draft route threshold was itself too easy to clear.

This phase does not claim every route is now complete. It does three things:

1. **Fixes what the Atlas says.** Every route now shows one of three honestly-derived, non-blank statuses — *"JetStash knows this route well"*, *"Useful route guidance available"*, or *"Intelligence still being expanded"* — computed from real fields, requiring **breadth across at least two independent categories** for the top tier, never a single signal and never manually assigned. Country-level aggregation is conservative: one strong destination can no longer carry an entire country.
2. **Grades all 32 routes honestly**, using that same derivation, and states plainly what's missing from each one that isn't "strong."
3. **States the real fare-tracking scope** — 8 of 32 routes have any publicly-displayable fare observation, all 8 currently fresh — and fixes the one page (`/deals`) most likely to read as claiming broader coverage than exists.

**Headline numbers, computed from the real data under the corrected threshold:**

| | Count | of 32 |
|---|---|---|
| **Strong** — JetStash knows this route well | 9 | 28% |
| **Useful** — useful route guidance available | 23 | 72% |
| **Expanding** — intelligence still being expanded | 0 | 0% (this state applies to Atlas destinations with no `routes.ts` entry at all, not to any of the 32) |
| Routes with any publicly-displayable fare observation | 8 | 25% |
| Soft-launch routes (of 6) that genuinely meet the Strong bar | 4 | 67% |

**Two findings worth surfacing immediately:**
- The Atlas's own default landing route, Manchester–Dubai, is graded **Useful** — it has zero depth categories at all beyond a verified route-level record (no fare, no connecting-alternative, no per-airline breakdown, not Book-By priority, no warning, no baggage guidance). See §6 and §4.
- **Manchester–Doha**, a soft-launch route, is now also graded **Useful** under the corrected threshold — its only depth category is a single fresh fare observation. Not upgraded to make the launch set look complete; see §4.

---

## 2. Status definitions

### Route-level (every one of the 32 routes gets exactly one)

| Status | Customer-facing label | Definition |
|---|---|---|
| **Strong** | "JetStash knows this route well" | Current direct/connecting status is confirmed (`getDisplayDirectness()` returns `'direct'` or `'connecting'`, never `'unverified'`) **and** at least **two** of six independent depth categories are present: per-airline verification breakdown (`airlineVerifications`), a `connectingAlternative` detail block, a publishable fare observation, Book-By priority modelling, an active specifically-investigated warning, or dedicated baggage guidance. |
| **Useful** | "Useful route guidance available" | A real route guide exists (every route has one — intro, booking-window note, peak periods are required fields), but the route doesn't meet the Strong bar: either its current direct/connecting status isn't confirmed, or it is confirmed but has fewer than two of the six depth categories. |
| **Expanding** | "Intelligence still being expanded" | No `data/routes.ts` entry exists at all — an Atlas destination backed only by `data/network-evidence.ts` (real, sourced evidence that the destination is reachable, but no dedicated JetStash route guide yet). None of the 32 routes this audit covers are in this state by definition; it applies to the wider Atlas destination set (Istanbul, Antalya, Marrakech, and others). |

**Why breadth, not presence:** each of the six categories is something the codebase already independently gates and can't be gamed by rewording prose — but a route can (and, before this revision, several did) satisfy exactly one of them and nothing else. Requiring at least two means "JetStash knows this route well" now means the route has been looked at from more than one angle — priced *and* verified per-airline, or verified *and* carrying real connecting-route detail, etc. — not just one fact recorded somewhere.

**Category prevalence across the real 32 routes** (how many routes have each, for reference): per-airline verification breakdown 4, connecting-alternative detail 5, fare evidence 8, Book-By priority 5, investigated warning 5, baggage guidance 5.

**What this deliberately is not:** the `factsConfidence: 'verified' | 'editorial-estimate'` field `data/routes.ts` documents removing (see that file, ~line 974). That field collapsed a route's *whole fact bundle* into one label and called it "verified" even when frequency or a specific airline wasn't independently confirmed — which was false. This status answers a narrower, honestly-answerable question — how much *breadth* of guidance exists — and never overrides or summarises individual fact accuracy. A Strong-graded route can still have an unconfirmed frequency string, same as before; nothing here claims otherwise.

### Country-level (a conservative aggregate of its own destinations, per airport)

| Status | Label | Rule |
|---|---|---|
| **Strong** | "JetStash knows this country well" | Every destination in the country is Strong. |
| **Mixed** | "Coverage is mixed — some routes are more developed than others" | At least one destination is Strong, but not all of them. **This is the fix** — previously, *any* Strong destination made the whole country read "strong," even with weaker siblings. |
| **Useful** | "Useful guidance available — coverage is still developing" | No Strong destination, but at least one Useful. |
| **Expanding** | "Early-stage coverage — still being researched" | Every destination is Expanding. |

A separate, additive signal — **active service notice** — covers a live withdrawal/service-change announcement (currently Manchester–Delhi and Manchester–Mumbai's IndiGo notice). It is deliberately *not* part of the status above: a well-researched route doesn't become less well-researched because its service is changing. It renders as its own labelled callout in the Atlas destination panel and its own aria-label suffix, never by silently demoting the tier. This aggregation rule is unaffected by the threshold correction — the mechanism (`aggregateCountryIntelligence()`) is unchanged; only the per-route inputs feeding it are stricter now (see §3.6 for the recomputed result).

---

## 3. Complete 32-route audit table

Grouped by grade. "Depth categories" lists which of the six Strong-qualifying facts the route actually has — Strong routes always have two or more; Useful routes never have two or more. "Fare" shows publishable observation count and freshness as of 6 Aug 2026 (`OBSERVATION_FRESH_DAYS` = 60). "TC" = has a real Trip.com link (tracked, not scored — see the Revision note).

### Strong (9 of 32)

| Route | Direct/Connecting | Depth categories (2+) | Fare | TC | Notes |
|---|---|---|---|---|---|
| Heathrow–Delhi | Direct (airline-verified) | Airline-verif, fare, Book-By, baggage | 2, fresh | N | 4 categories — the broadest evidence of any route. No Heathrow-origin Trip.com link exists (by design — see AFF-001). |
| Birmingham–Amritsar | Connecting | Fare, Book-By, warning (reduced frequency) | 2, fresh | Y | Soft-launch route. |
| Heathrow–Jeddah | Direct (airline-verified) | Airline-verif, fare, Book-By | 2, fresh | N | Saudia's own status is separately unverified — BA's evidence doesn't cover it. |
| Manchester–Lahore | Direct, verified | Fare, Book-By, baggage | 2, fresh | Y | Soft-launch route. |
| Heathrow–Mumbai | Direct (airline-verified, 3 airlines) | Airline-verif, fare | 1, fresh (13d) | N | |
| Manchester–Delhi | Direct, verified | Connecting-alternative, baggage | 0 | Y | Active withdrawal notice (IndiGo, effective 31 Aug 2026) — shown as a separate service notice, doesn't affect this grade. |
| Manchester–Islamabad | Direct, verified | Fare, Book-By | 2, fresh | Y | Soft-launch route. |
| Manchester–Madinah | Connecting | Connecting-alternative, fare | 1, fresh (1d) | Y | Soft-launch route. |
| Manchester–Mumbai | Direct, verified | Connecting-alternative, baggage | 0 | Y | Same withdrawal notice as Delhi. |

### Useful (23 of 32)

| Route | Direct/Connecting | Depth categories (0–1) | Why not Strong | Fare | TC |
|---|---|---|---|---|---|
| Leeds Bradford–Islamabad | Connecting | Warning only (1) | One category only — a genuinely researched caution, but not broad evidence. | 0 | Y |
| Gatwick–Ahmedabad | Direct, verified | Warning only (1) | Same — warning alone isn't breadth. | 0 | N |
| Gatwick–Amritsar | Direct, verified | Warning only (1) | Same. | 0 | N |
| Heathrow–Bengaluru | Direct (airline-verified, 2 airlines) | Airline-verif only (1) | Two independent primary sources confirm the route exists, but no other guidance behind it — see §6. | 0 | N |
| Manchester–Amritsar | Connecting | Connecting-alt only (1) | Real connecting detail, but nothing else. | 0 | Y |
| Manchester–Ahmedabad | Connecting | Connecting-alt only (1) | Same. | 0 | Y |
| Manchester–Doha | Direct, verified | Fare only (1) | **Soft-launch route.** One fresh fare check, nothing else — see §4. | 1, fresh (1d) | Y |
| Manchester–Karachi | Direct, **unverified** | Warning (1), but unverified directness blocks Strong regardless | Current direct claim not confirmed by a primary source. | 0 | Y |
| Birmingham–Lahore | Direct, **unverified** | Baggage (1), but unverified directness blocks Strong regardless | Current direct claim not confirmed by a primary source. | 0 | Y |
| Manchester–Dubai | Direct, verified | **Zero** categories | Verified but nothing else — no fare, no connecting-alt, no airline-verif, not Book-By, no warning, no baggage. **The Atlas default landing route.** | 0 (2 unpublishable — see §6) | Y |
| Heathrow–Doha | Direct, verified | Zero | No depth category at all. | 0 | N |
| Birmingham–Islamabad | Direct, **unverified** | Zero | Conflicting secondary sources, no primary source resolves it. | 0 | Y |
| Leeds Bradford–Amritsar | Connecting | Zero | No fare, no warning, no connecting-alt, no baggage. | 0 | Y |
| Heathrow–Dhaka | Direct, **unverified** | Zero | Real evidence of current operation (live flight-tracking) but stop pattern unconfirmed. | 0 | N |
| Manchester–Dhaka | Connecting, verified | Zero | Connecting and verified, but no other depth category. | 0 | Y |
| Manchester–Sylhet | Direct, **unverified** | Zero | Genuine, disclosed contradiction between Manchester Airport's own page and Biman's notice. | 0 | Y |
| Heathrow–Sylhet | Direct, **unverified** | Zero | Real evidence (flight-tracking + independent schedule sources) but not primary-confirmed. | 0 | N |
| Manchester–Jeddah | Connecting | Zero | No depth category. | 0 | Y |
| Birmingham–Madinah | Connecting | Zero | No depth category. | 0 | Y |
| Birmingham–Mumbai | Connecting, verified | Zero | Connecting and verified (Birmingham Airport's own page), but no other depth category. | 0 | Y |
| Glasgow–Dubai | Direct, verified | Zero | No depth category. | 0 | Y |
| Edinburgh–Dubai | Direct, verified | Zero | No depth category. | 0 | Y |
| Newcastle–Dubai | Direct, verified | Zero | No depth category. | 0 | Y |

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
| `leeds-bradford-islamabad` | Useful |
| `london-gatwick-ahmedabad` | Useful |
| `london-gatwick-amritsar` | Useful |
| `london-heathrow-bengaluru` | Useful |
| `london-heathrow-delhi` | Strong |
| `london-heathrow-dhaka` | Useful |
| `london-heathrow-doha` | Useful |
| `london-heathrow-jeddah` | Strong |
| `london-heathrow-mumbai` | Strong |
| `london-heathrow-sylhet` | Useful |
| `manchester-ahmedabad` | Useful |
| `manchester-amritsar` | Useful |
| `manchester-delhi` | Strong |
| `manchester-dhaka` | Useful |
| `manchester-doha` | Useful |
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

Part D of the brief asked this to be recorded explicitly per route, separately from the Strong/Useful/Expanding grade above — it is a genuinely different signal (practical trip-planning content, not route-existence evidence) and deliberately does **not** feed into `computeRouteIntelligenceLevel()` as a required category (baggage guidance is one of the six *scored* categories; airport-specific guidance is tracked only — see below). Computed from `data/traveller-tips.ts`, the only structured source for this content (`TravellerTipScope` can target a `routeSlug`, `destinationSlug`, or `airportSlug`).

- **Airport guidance:** every route's departure airport has a general airport guide page (`/airports/[slug]`, `description`/`whyThisAirport` in `data/airports.ts`) — universal baseline coverage, not a differentiator between routes. But **zero of the 10 traveller tips are scoped to an `airportSlug`** — no route currently has dedicated, route-specific airport guidance (terminal, check-in, transfer-specific advice) beyond that shared baseline. This is a real, previously unrecorded gap, not a data error — nothing here was invented to fill it, and it's why this category is tracked but not required in §2's threshold: a required category that 0/32 routes can currently pass isn't a meaningful bar.
- **Baggage guidance:** 3 of the 10 traveller tips are `category: 'baggage'`, scoped to Lahore, Delhi and Mumbai. Because tips are destination- or route-scoped, this reaches **5 of 32 routes**: Manchester–Lahore, Birmingham–Lahore, Heathrow–Delhi, Manchester–Delhi, Manchester–Mumbai. The other 27 routes have no dedicated baggage guidance. This category *is* one of the six scored in §2 — it contributes to 4 of the 9 Strong grades (Heathrow–Delhi, Manchester–Lahore, Manchester–Delhi, Manchester–Mumbai).
- **Overlap with §3's grade:** partial now (baggage guidance is a scored category), but still not determinative alone — e.g. Birmingham–Lahore has a baggage tip but stays Useful because its directness is unverified (the prerequisite still gates everything).

This is not a Phase 1 action item beyond the scoring change above — flagged here for the Phase 2+ batches in §7, since airport-specific guidance is the kind of gap a future batch could reasonably close.

---

## 3.6. Country-level aggregation, per airport (recomputed under the corrected threshold)

Every country node in the Atlas is scoped to a single airport's network (the same country can appear multiple times across different airports, aggregated independently each time). Computed live from `aggregateCountryIntelligence()` against the corrected per-route grades above.

| Airport | Country | Destinations (grade) | Result |
|---|---|---|---|
| Manchester | India | Mumbai (Strong), Delhi (Strong), Amritsar (Useful), Ahmedabad (Useful) | **Mixed** |
| Manchester | UAE | Dubai (Useful) | Useful |
| Manchester | Pakistan | Lahore (Strong), Islamabad (Strong), Karachi (Useful) | **Mixed** |
| Manchester | Bangladesh | Dhaka (Useful), Sylhet (Useful) | Useful |
| Manchester | Qatar | Doha (Useful) | Useful |
| Manchester | Saudi Arabia | Jeddah (Useful), Madinah (Strong) | **Mixed** |
| Birmingham | India | Mumbai (Useful), Amritsar (Strong) | **Mixed** |
| Birmingham | Pakistan | Lahore (Useful), Islamabad (Useful) | Useful |
| Birmingham | Saudi Arabia | Madinah (Useful) | Useful |
| Heathrow | India | Bengaluru (Useful), Delhi (Strong), Mumbai (Strong) | **Mixed** |
| Heathrow | Qatar | Doha (Useful) | Useful |
| Heathrow | Saudi Arabia | Jeddah (Strong) | **Strong** (single-destination country, and that destination clears the stricter bar) |
| Heathrow | Bangladesh | Dhaka (Useful), Sylhet (Useful) | Useful |
| Gatwick | India | Ahmedabad (Useful), Amritsar (Useful) | Useful |
| Glasgow | UAE | Dubai (Useful) | Useful |
| Edinburgh | UAE | Dubai (Useful) | Useful |
| Newcastle | UAE | Dubai (Useful) | Useful |
| Leeds Bradford | India | Amritsar (Useful) | Useful |
| Leeds Bradford | Pakistan | Islamabad (Useful) | Useful |

**What changed from the first (uncorrected) version of this document:** five country nodes that previously read "Strong" are now honestly "Mixed" or "Useful" under the corrected route threshold — most visibly **Manchester's India** (the country shown by default context on the homepage Atlas alongside the Manchester origin), which drops from "Strong" to "Mixed" because Amritsar and Ahmedabad don't clear the stricter bar even though Mumbai and Delhi do. Heathrow's India, Manchester's Qatar (Doha), Gatwick's India, and Leeds Bradford's Pakistan (Islamabad) all move from "Strong" to "Useful" for the same reason. No country moves in the other direction, and no country becomes "Strong" through a single strong route while a sibling in the same group is weaker — the one exception, Heathrow's Saudi Arabia, is a **single-destination** country where "every destination is Strong" is trivially true because there's only one destination, and that destination (Jeddah) itself clears the corrected two-category bar on its own merits (airline verification + fare + Book-By).

---

## 4. Six launch-route readiness

Audited to the same standard as every other route — **not upgraded for being launch priorities.**

| Route | Grade | Genuinely meets the strongest standard? | Exact missing work, if any |
|---|---|---|---|
| Manchester–Lahore | **Strong** | Yes. | None for this grade. |
| Manchester–Islamabad | **Strong** | Yes. | None for this grade. |
| Birmingham–Amritsar | **Strong** | Yes. | None for this grade. |
| Manchester–Madinah | **Strong** | Yes. | None for this grade. |
| **Manchester–Doha** | **Useful** | **No.** | Currently has exactly one depth category (a single fresh fare check). Needs a second, independent one to clear the corrected bar — the most natural fit is a `connectingAlternative`-style airline-verification record (Qatar Airways' own booking route already backs the route-level verification; a formal `airlineVerifications` entry would add real per-carrier detail) or Book-By priority inclusion (a founder decision, not a data-entry task). |
| **Manchester–Dubai** | **Useful** | **No.** | Has zero depth categories. Needs at least two: a fresh, dated, methodology-compliant fare observation (`departureDate`/`returnDate` — the two existing observations predate the dating requirement and don't count) is the most natural first one, given this route's own booking-window copy already discusses comparing fares; a second (e.g. Book-By priority, given it's already a soft-launch route) would then clear the bar. |

**Verdict: 4 of the 6 soft-launch routes genuinely meet the corrected, stricter standard today — Manchester–Lahore, Manchester–Islamabad, Birmingham–Amritsar and Manchester–Madinah. Manchester–Doha and Manchester–Dubai do not**, and neither is upgraded here to make the launch set look complete; each needs one additional, independent piece of real evidence. This is squarely a Phase 2 action, explicitly out of scope for this phase. (The first, uncorrected version of this audit had reported 5 of 6, with only Manchester–Dubai short — that was itself a consequence of the too-permissive threshold this revision fixes; Manchester–Doha's single fare check was enough to pass the old "any one signal" bar but isn't enough for the corrected "at least two" bar.)

---

## 5. Fare-tracking coverage truth

Unaffected by the route-threshold correction — fare-tracking coverage is a separate computation (`getPublishableObservationsByRoute()`) that never depended on `computeRouteIntelligenceLevel()`.

- **Exact number of routes with any publishable observation:** 8 of 32 (25%).
- **Exact number with recent (≤60 day), methodology-compliant observations:** 8 of 32 — every currently-publishable observation happens to also be fresh.
- **Total raw entries in the archive:** 31 (`data/fare-observations.ts`), of which 8 routes' worth pass `isPubliclyPublishable()` (requires both `departureDate` and `returnDate` — a Truth Reset requirement the original 18 entries predate).
- **Soft-launch coverage:** 5 of 6 soft-launch routes have at least one publishable fare observation (all except Manchester–Dubai) — a separate fact from §4's "meets the Strong bar," since a fare check is only one of the two-or-more categories now required.
- **Did "Fares we're tracking" imply broader coverage than exists?** Yes, on the one page most likely to be read as a coverage claim: `/deals`. Its hero said "Fares we're tracking" and cited only a raw count of checks logged (31) and airports covered, never the route denominator — a visitor had no way to see this spans 8 of 32 routes, not most of the network. **Fixed in this phase** — see §7's implementation note.
- **Do empty/thin categories look abandoned?** No — this was already handled correctly before this phase. `NoFareFallback` ("We haven't logged a tracked fare for {city} yet") renders wherever a route/destination/airport/cabin has zero observations, with a Trip.com comparison link where one exists. Nothing was found to fix here.
- **Is observation age clear?** Yes — every fare-rendering surface (`DealCard`, `FareHistoryPanel`, `BookByCountdown`) already uses the shared 3-tier freshness model (`lib/freshness-thresholds.ts`: fresh ≤60 days, ageing ≤180 days, stale beyond) with visible de-emphasis and explicit "this is old" copy for stale observations.
- **Is the manual-verification methodology explained clearly?** Yes, on `/deals` itself and in `docs/project-control/FARE_OBSERVATION_ARCHIVE.md` — the hero already linked "Read our standards" before this phase, and that page's own content is accurate and unaffected by this audit.
- **A limitation worth naming (raised in the product-truth review, not fixed here):** `getPublishableObservationsByRoute()` gates on date-completeness and current route status, but not on freshness — a route whose only publishable observation had gone stale (>180 days, per `lib/freshness-thresholds.ts`) would still count toward the "N of 32 routes" figure on `/deals`, since staleness only affects *display* styling elsewhere, not this count. Today this is moot — all 8 publishable observations are fresh — but the wording doesn't self-enforce freshness going forward. Not changed in this PR (it's a pre-existing property of a function used the same way elsewhere, e.g. Book-By's Verified Check callout, not something this phase introduced); flagged for a future hardening pass if it becomes a real gap.

**Recommended and implemented wording** (using the real, live-computed count rather than a hand-typed number that could drift):

> "We're currently tracking fares on **8 of our 32 routes** — coverage is being expanded gradually using manually verified observations, not a live price feed."

This is now the opening line of `/deals`'s hero, with `8` and `32` both computed live from `routes.length` and `getPublishableObservationsByRoute()` — the same functions this audit itself calls — so the sentence can never silently drift out of sync with reality the way a hand-typed figure could.

---

## 6. Exact gaps by route

Only routes with a genuine, specific, actionable gap are listed (Strong routes with no gap are omitted; see §3 for their full record).

| Route | Gap | What would close it |
|---|---|---|
| **Manchester–Dubai** | Zero depth categories at all — the Atlas's own default landing route. Two logged fare observations exist but predate the dating requirement. | Two of: a fresh dated fare check, a `connectingAlternative` block, an `airlineVerifications` entry, Book-By priority, or a newly-investigated warning. |
| **Manchester–Doha** | Soft-launch route with exactly one depth category (a fresh fare check). | One more of the remaining five categories — most naturally an `airlineVerifications` entry given Qatar Airways' own booking route already backs the route-level record. |
| Heathrow–Bengaluru | Airline service is confirmed by two independent primary sources (one category), but no fare observation or any other guidance has ever been logged. | One fresh, dated fare check would clear the bar (airline-verif + fare = 2 categories). |
| Manchester–Amritsar / Manchester–Ahmedabad | Each has real connecting-route detail (one category) but nothing else. | A fare check or a formally investigated warning would clear the bar. |
| Leeds Bradford–Islamabad / Gatwick–Ahmedabad / Gatwick–Amritsar | Each has a genuinely researched, sourced warning (one category) but nothing else. | A fare check or per-airline verification would clear the bar — the warning itself should stay, it's real research, just not broad on its own. |
| Manchester–Karachi | Direct claim not confirmed by any primary source; secondary aviation-news reporting only. | A route-specific PIA or airport-schedule primary source (this is the harder, prerequisite-level gap — no depth category can substitute for it). |
| Birmingham–Lahore | Same — no primary source confirms a direct Birmingham–Lahore PIA service. | A route-specific primary source. |
| Birmingham–Islamabad | Conflicting secondary sources; genuinely unresolved. | A route-specific primary source that resolves the conflict either way. |
| Manchester–Sylhet | Direct, disclosed contradiction between Manchester Airport's own page ("not flying to this location") and Biman's official Manchester–Dhaka-via-Sylhet notice. | A Biman-direct or Manchester Airport-direct source that resolves the contradiction. |
| Heathrow–Dhaka / Heathrow–Sylhet | Real, current flight-tracking evidence exists, but the exact stop pattern (nonstop vs. via Sylhet) is unconfirmed by any primary source. | A Biman or Heathrow route-specific source stating the stop pattern directly. |
| 12 zero-category Useful routes (Heathrow–Doha, Leeds Bradford–Amritsar, Manchester–Dhaka, Manchester–Jeddah, Birmingham–Madinah, Birmingham–Mumbai, Glasgow/Edinburgh/Newcastle–Dubai, plus Birmingham–Islamabad, Heathrow–Dhaka, Heathrow–Sylhet, Manchester–Sylhet already listed above for their prerequisite gap) | Verified (where directness is confirmed) and correctly described, but carry none of the six Strong-qualifying depth categories. | Any two of: a fare observation, a `connectingAlternative` block (for the connecting ones), a per-airline verification entry, Book-By priority, a newly-investigated warning, or baggage guidance. |

**Routes that appear visually complete but have thin underlying intelligence** (the specific question the brief asked): **Manchester–Dubai** remains the clearest case — verified, direct, a Trip.com link, and the Atlas's own default first impression, yet zero depth categories behind it. **Manchester–Doha** is a newly-surfaced case under the corrected threshold — a soft-launch route that looked complete (verified, fresh fare, Trip.com link) but has only one kind of evidence behind it. Heathrow–Bengaluru remains the clearest "confirmed but un-priced" case.

**Routes with stale or weak evidence:** none of the 32 routes currently have a *stale* `verification` record (every `reviewDueDate` is still in the future as of 6 Aug 2026) — but 9 of them have `unverified` status specifically because no primary source was ever found, not because a once-good source went stale. That's a different, harder gap (needs new evidence, not re-verification of old evidence).

---

## 7. Recommended route-completion batches

Based on the actual data above, not a generic template:

- **Batch 1 — close the two soft-launch gaps.** Manchester–Dubai (needs two new categories) and Manchester–Doha (needs one more, on top of its existing fare check). Highest priority — both are launch-set routes, and Dubai is the Atlas default.
- **Batch 2 — the other "confirmed but thin" Strong-adjacent routes.** Heathrow–Bengaluru (one fresh fare check closes it), Manchester–Amritsar/Ahmedabad (a fare check or warning), Leeds Bradford–Islamabad and both Gatwick routes (a fare check or airline-verification entry alongside their existing warning).
- **Batch 3 — the three unresolved Pakistan primary-source gaps.** Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad — all need the same kind of evidence (a route-specific PIA or airport-schedule primary source) before any depth category can even apply, so investigating them together is efficient.
- **Batch 4 — the four unresolved Bangladesh primary-source gaps.** Manchester–Sylhet, Heathrow–Dhaka, Heathrow–Sylhet (stop-pattern confirmation), grouped with the Pakistan batch if convenient, or separately given they need Bangladesh-specific sources (Biman, Manchester Airport, Heathrow).
- **Batch 5 — the remaining zero-category Useful routes** (Heathrow–Doha, Leeds Bradford–Amritsar, Manchester–Dhaka, Manchester–Jeddah, Birmingham–Madinah, Birmingham–Mumbai, Glasgow/Edinburgh/Newcastle–Dubai), roughly in commercial-value order: Heathrow–Doha (Gulf, no Trip.com link but high search interest) and the three single-destination Dubai routes (each simple — one fare check apiece would move them halfway, a second category would complete them) first; the four connecting routes (would benefit from a `connectingAlternative` block plus one more category) after; Leeds Bradford–Amritsar last (smallest airport, lowest relative volume).

**Suggested order of work:** Batch 1 → Batch 2 → Batch 3 → Batch 4 → Batch 5. Batches 1–2 are mostly fare-check/verification items (fastest, highest-leverage — the launch set and the routes already one step from Strong). Batches 3–4 require new primary-source research, not fare-checking, so they're naturally slower and should be scheduled with that in mind rather than rushed to match Batch 1–2's pace.

---

## 8. Criteria for upgrading a route

A route moves from **Useful → Strong** when it gains at least **two** of the following six (having exactly one is not enough — see the Revision note):
1. A fresh, methodology-compliant, publicly-publishable fare observation (`departureDate` + `returnDate` both set, per `data/fare-observations.ts`'s standard).
2. A `connectingAlternative` block (for a connecting route) — real hub/airline/journey-time detail, not invented.
3. A per-airline `airlineVerifications` entry, sourced the same way route-level verification already is.
4. Inclusion in `BOOK_BY_PRIORITY_ROUTE_SLUGS` (a founder-level product decision, not a data-entry task).
5. A specific, sourced, investigated active warning (`data/route-warnings.ts`) — only when the investigation is real, never added just to hit this bar.
6. Dedicated baggage guidance (`data/traveller-tips.ts`, `category: 'baggage'`, scoped to the route or its destination) — only when the tip is real, route-relevant advice, never added just to hit this bar.

A route moves from **Unverified-direct → Verified** (a prerequisite for Strong on most direct routes, and gates every category above regardless of how many are present) only through a genuine primary source — an airline's own booking system, a UK airport's own schedule/destination page, or equivalent — never a secondary aviation-news report alone, per the standing sourcing rule (CLAUDE.md, "Verified route and airport claims").

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
- Did not add any new fare observation (the Manchester–Dubai, Manchester–Doha and Heathrow–Bengaluru gaps identified in §6 remain open).
- Did not complete any missing route intelligence.
- Did not add a new route or a new country.
- Did not redesign the Atlas beyond the status/aggregation/legend changes this document describes.
- Did not touch Arrive By, Book By's own logic, Trip.com links, or affiliate provider behaviour.
- Did not change which country the Atlas defaults to per airport, or which routes carry Book-By priority — those are product/founder decisions, not truth-and-honesty fixes.
- Did not split `/deals`'s coverage-wording fix or the `lib/atlas-network-data.ts` mojibake text-encoding correction into separate PRs — both were reviewed specifically for this (see the PR's own review notes) and judged safe and in-scope to keep together: the `/deals` change uses only the existing publishability-gated function and was explicit brief scope; the mojibake fix touches only prose (comments and customer-facing strings) in the exact file already being modified for this phase, verified byte-for-byte to never touch a URL, identifier, or code token.
