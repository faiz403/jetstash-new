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
3. **States the real fare-tracking scope** — 9 of 32 routes have any publicly-displayable fare observation, all 9 currently fresh — and fixes the one page (`/deals`) most likely to read as claiming broader coverage than exists.

**Headline numbers, computed from the real data under the corrected threshold** (updated 6 August 2026 after Manchester–Dubai's fare observation closed — see "Batch 1 completion record" after §7 and its addendum for the full account):

| | Count | of 32 |
|---|---|---|
| **Strong** — JetStash knows this route well | 10 | 31% |
| **Useful** — useful route guidance available | 22 | 69% |
| **Expanding** — intelligence still being expanded | 0 | 0% (this state applies to Atlas destinations with no `routes.ts` entry at all, not to any of the 32) |
| Routes with any publicly-displayable fare observation | 9 | 28% |
| Soft-launch routes (of 6) that genuinely meet the Strong bar | 5 | 83% |

**Findings worth surfacing immediately:**
- The Atlas's own default landing route, **Manchester–Dubai, is now graded Strong** — its 6 August 2026 fare observation (`obs-man-dxb-economy-20260806-8w-v1`) gave it a second genuine depth category alongside the baggage guidance Batch 1 already added. This is a real, mechanical consequence of genuine evidence clearing the unchanged two-category threshold — **not an automatic content-quality promotion**: a dedicated content-depth review of the actual rendered page found a real, visible inconsistency (the `DealCard`'s "DIRECT FLIGHT" badge sits directly above this fare's own "connecting via Bahrain" description) that isn't resolved by the grade alone. See the Batch 1 completion record's addendum for the full finding — not fixed in this pass, flagged as a founder-level follow-up.
- **Manchester–Doha**, a soft-launch route, remains graded **Useful** — its only depth category is a single fresh fare observation, and every avenue this project's tooling could research for a second one is exhausted (see the completion record). Not upgraded to make the launch set look complete, and explicitly protected from being upgraded by anything other than genuine independent evidence — see §4 and "Protecting the Doha decision."

---

## 2. Status definitions

### Route-level (every one of the 32 routes gets exactly one)

| Status | Customer-facing label | Definition |
|---|---|---|
| **Strong** | "JetStash knows this route well" | Current direct/connecting status is confirmed (`getDisplayDirectness()` returns `'direct'` or `'connecting'`, never `'unverified'`) **and** at least **two** of six independent depth categories are present: per-airline verification breakdown (`airlineVerifications`), a `connectingAlternative` detail block, a publishable fare observation, Book-By priority modelling, an active specifically-investigated warning, or dedicated baggage guidance. |
| **Useful** | "Useful route guidance available" | A real route guide exists (every route has one — intro, booking-window note, peak periods are required fields), but the route doesn't meet the Strong bar: either its current direct/connecting status isn't confirmed, or it is confirmed but has fewer than two of the six depth categories. |
| **Expanding** | "Intelligence still being expanded" | No `data/routes.ts` entry exists at all — an Atlas destination backed only by `data/network-evidence.ts` (real, sourced evidence that the destination is reachable, but no dedicated JetStash route guide yet). None of the 32 routes this audit covers are in this state by definition; it applies to the wider Atlas destination set (Istanbul, Antalya, Marrakech, and others). |

**Why breadth, not presence:** each of the six categories is something the codebase already independently gates and can't be gamed by rewording prose — but a route can (and, before this revision, several did) satisfy exactly one of them and nothing else. Requiring at least two means "JetStash knows this route well" now means the route has been looked at from more than one angle — priced *and* verified per-airline, or verified *and* carrying real connecting-route detail, etc. — not just one fact recorded somewhere.

**Category prevalence across the real 32 routes** (how many routes have each, for reference, updated after Route Completion Batch 1 and Manchester–Dubai's 6 August 2026 fare observation — see the completion record after §7): per-airline verification breakdown 4, connecting-alternative detail 5, fare evidence 9, Book-By priority 5, investigated warning 5, baggage guidance 6.

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

### Strong (10 of 32)

| Route | Direct/Connecting | Depth categories (2+) | Fare | TC | Notes |
|---|---|---|---|---|---|
| Heathrow–Delhi | Direct (airline-verified) | Airline-verif, fare, Book-By, baggage | 2, fresh | N | 4 categories — the broadest evidence of any route. No Heathrow-origin Trip.com link exists (by design — see AFF-001). |
| Birmingham–Amritsar | Connecting | Fare, Book-By, warning (reduced frequency) | 2, fresh | Y | Soft-launch route. |
| Heathrow–Jeddah | Direct (airline-verified) | Airline-verif, fare, Book-By | 2, fresh | N | Saudia's own status is separately unverified — BA's evidence doesn't cover it. |
| Manchester–Dubai | Direct, verified | Fare, baggage | 1, fresh (0d) | Y | **The Atlas default landing route.** Closed 6 August 2026 (`obs-man-dxb-economy-20260806-8w-v1`, £480, Gulf Air, connecting via Bahrain — a different airline/routing than the route's own verified Emirates direct service). Mechanically Strong, but see the Batch 1 completion record's content-depth finding: the rendered `DealCard` shows a "DIRECT FLIGHT" badge directly above this fare's own "connecting via Bahrain" description — a real, unresolved inconsistency, not fixed in this pass. |
| Manchester–Lahore | Direct, verified | Fare, Book-By, baggage | 2, fresh | Y | Soft-launch route. |
| Heathrow–Mumbai | Direct (airline-verified, 3 airlines) | Airline-verif, fare | 1, fresh (13d) | N | |
| Manchester–Delhi | Direct, verified | Connecting-alternative, baggage | 0 | Y | Active withdrawal notice (IndiGo, effective 31 Aug 2026) — shown as a separate service notice, doesn't affect this grade. |
| Manchester–Islamabad | Direct, verified | Fare, Book-By | 2, fresh | Y | Soft-launch route. |
| Manchester–Madinah | Connecting | Connecting-alternative, fare | 1, fresh (1d) | Y | Soft-launch route. |
| Manchester–Mumbai | Direct, verified | Connecting-alternative, baggage | 0 | Y | Same withdrawal notice as Delhi. |

### Useful (22 of 32)

| Route | Direct/Connecting | Depth categories (0–1) | Why not Strong | Fare | TC |
|---|---|---|---|---|---|
| Leeds Bradford–Islamabad | Connecting | Warning only (1) | One category only — a genuinely researched caution, but not broad evidence. | 0 | Y |
| Gatwick–Ahmedabad | Direct, verified | Warning only (1) | Same — warning alone isn't breadth. | 0 | N |
| Gatwick–Amritsar | Direct, verified | Warning only (1) | Same. | 0 | N |
| Heathrow–Bengaluru | Direct (airline-verified, 2 airlines) | Airline-verif only (1) | Two independent primary sources confirm the route exists, but no other guidance behind it — see §6. | 0 | N |
| Manchester–Amritsar | Connecting | Connecting-alt only (1) | Real connecting detail, but nothing else. | 0 | Y |
| Manchester–Ahmedabad | Connecting | Connecting-alt only (1) | Same. | 0 | Y |
| Manchester–Doha | Direct, verified | Fare only (1) | **Soft-launch route.** One fresh fare check, nothing else — Batch 1 (August 2026) could not honestly add a second category; see the completion record after §7. | 1, fresh (1d) | Y |
| Manchester–Karachi | Direct, **unverified** | Warning (1), but unverified directness blocks Strong regardless | Current direct claim not confirmed by a primary source. | 0 | Y |
| Birmingham–Lahore | Direct, **unverified** | Baggage (1), but unverified directness blocks Strong regardless | Current direct claim not confirmed by a primary source. | 0 | Y |
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
| `manchester-dubai` | Strong |
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
- **Baggage guidance:** 4 of the 11 traveller tips are `category: 'baggage'` (Route Completion Batch 1, August 2026 added a fourth — `manchester-dubai-emirates-baggage-weight`, checked directly against Manchester Airport's own Emirates operator page), scoped to Lahore, Delhi, Mumbai and Manchester–Dubai specifically. Because most of these are destination-scoped while the new one is route-scoped, this reaches **6 of 32 routes**: Manchester–Lahore, Birmingham–Lahore, Heathrow–Delhi, Manchester–Delhi, Manchester–Mumbai, Manchester–Dubai. The other 26 routes have no dedicated baggage guidance. This category *is* one of the six scored in §2 — it contributes to 5 of the 10 Strong grades (Heathrow–Delhi, Manchester–Lahore, Manchester–Delhi, Manchester–Mumbai, Manchester–Dubai).
- **Overlap with §3's grade:** partial now (baggage guidance is a scored category), but still not determinative alone — e.g. Birmingham–Lahore has a baggage tip but stays Useful because its directness is unverified (the prerequisite still gates everything).

This is not a Phase 1 action item beyond the scoring change above — flagged here for the Phase 2+ batches in §7, since airport-specific guidance is the kind of gap a future batch could reasonably close.

---

## 3.6. Country-level aggregation, per airport (recomputed under the corrected threshold)

Every country node in the Atlas is scoped to a single airport's network (the same country can appear multiple times across different airports, aggregated independently each time). Computed live from `aggregateCountryIntelligence()` against the corrected per-route grades above.

| Airport | Country | Destinations (grade) | Result |
|---|---|---|---|
| Manchester | India | Mumbai (Strong), Delhi (Strong), Amritsar (Useful), Ahmedabad (Useful) | **Mixed** |
| Manchester | UAE | Dubai (Strong) | **Strong** (single-destination country — see the content-depth caveat on Dubai's own grade in §3 and the Batch 1 completion record before reading this as unqualified) |
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
| **Manchester–Dubai** | **Strong** | **Mechanically yes; not without a caveat.** | Closed 6 August 2026 — a genuine fare observation (`obs-man-dxb-economy-20260806-8w-v1`) gave it a second real depth category alongside Batch 1's baggage guidance, clearing the unchanged two-category threshold. But the content-depth review run before accepting this grade found a real, visible problem: the rendered `DealCard`'s "DIRECT FLIGHT" badge (correctly derived from the route's own verified Emirates service) sits directly above this fare's own "connecting via Bahrain, Gulf Air" description — a genuine inconsistency, not resolved by the grade alone. Not fixed here (a shared-component change, out of scope for recording one fare); see the Batch 1 completion record's addendum for the full finding and recommended follow-up. |
| **Manchester–Doha** | **Useful** | **No.** | Currently has exactly one depth category (a single fresh fare check). Route Completion Batch 1 (August 2026) audited this route specifically and could not honestly add a second: Qatar Airways' own baggage page is not accessible from this environment (confirmed 403), Manchester Airport's own Qatar Airways page explicitly has no baggage figure and directs to Qatar Airways directly, a per-airline `airlineVerifications` entry would duplicate the existing route-level claim on this single-carrier route rather than add real depth, no genuine warning exists, and Book-By priority is a founder decision. See the Batch 1 completion record after §7 for the full account. |

**Verdict: 5 of the 6 soft-launch routes now genuinely meet the corrected, stricter standard — Manchester–Lahore, Manchester–Islamabad, Birmingham–Amritsar, Manchester–Madinah and, as of 6 August 2026, Manchester–Dubai (with the content-depth caveat above).** Manchester–Dubai was not upgraded to make the launch set look complete — a real, dated fare check was performed, reviewed twice, and approved before recording; the grade is a mechanical consequence of that evidence against an unchanged threshold, and the caveat is reported rather than hidden. **Manchester–Doha remains the one gap** — every avenue this batch could research on its own is exhausted (see above), and closing it must wait for a genuine founder decision (Book-By priority, assigned only if editorially justified, never merely to create a second scoring category) or a human editor with unrestricted browser access confirming a real, route-specific Qatar Airways baggage fact — see "Protecting the Doha decision" after the Batch 1 completion record for why even that second option may not be enough on its own.

---

## 5. Fare-tracking coverage truth

Unaffected by the route-threshold correction — fare-tracking coverage is a separate computation (`getPublishableObservationsByRoute()`) that never depended on `computeRouteIntelligenceLevel()`. Updated 6 August 2026 for Manchester–Dubai's new observation.

- **Exact number of routes with any publishable observation:** 9 of 32 (28%).
- **Exact number with recent (≤60 day), methodology-compliant observations:** 9 of 32 — every currently-publishable observation happens to also be fresh.
- **Total raw entries in the archive:** 32 (`data/fare-observations.ts`), of which 9 routes' worth pass `isPubliclyPublishable()` (requires both `departureDate` and `returnDate` — a Truth Reset requirement the original 18 entries predate).
- **Soft-launch coverage:** 6 of 6 soft-launch routes now have at least one publishable fare observation — a separate fact from §4's "meets the Strong bar," since a fare check is only one of the two-or-more categories now required.
- **Did "Fares we're tracking" imply broader coverage than exists?** It did before this phase; already fixed — see §7's implementation note. Wording is live-computed (see below), so it updated automatically with no further code change when Manchester–Dubai's observation was added.
- **Do empty/thin categories look abandoned?** No — this was already handled correctly before this phase. `NoFareFallback` ("We haven't logged a tracked fare for {city} yet") renders wherever a route/destination/airport/cabin has zero observations, with a Trip.com comparison link where one exists. Nothing was found to fix here.
- **Is observation age clear?** Yes — every fare-rendering surface (`DealCard`, `FareHistoryPanel`, `BookByCountdown`) already uses the shared 3-tier freshness model (`lib/freshness-thresholds.ts`: fresh ≤60 days, ageing ≤180 days, stale beyond) with visible de-emphasis and explicit "this is old" copy for stale observations.
- **Is the manual-verification methodology explained clearly?** Yes, on `/deals` itself and in `docs/project-control/FARE_OBSERVATION_ARCHIVE.md` — the hero already linked "Read our standards" before this phase, and that page's own content is accurate and unaffected by this audit.
- **A limitation worth naming (raised in the product-truth review, not fixed here):** `getPublishableObservationsByRoute()` gates on date-completeness and current route status, but not on freshness — a route whose only publishable observation had gone stale (>180 days, per `lib/freshness-thresholds.ts`) would still count toward the "N of 32 routes" figure on `/deals`, since staleness only affects *display* styling elsewhere, not this count. Today this is moot — all 9 publishable observations are fresh — but the wording doesn't self-enforce freshness going forward. Not changed in this PR (it's a pre-existing property of a function used the same way elsewhere, e.g. Book-By's Verified Check callout, not something this phase introduced); flagged for a future hardening pass if it becomes a real gap.

**Recommended and implemented wording** (using the real, live-computed count rather than a hand-typed number that could drift):

> "We're currently tracking fares on **9 of our 32 routes** — coverage is being expanded gradually using manually verified observations, not a live price feed."

This is now the opening line of `/deals`'s hero, with the count and `32` both computed live from `routes.length` and `getPublishableObservationsByRoute()` — the same functions this audit itself calls — so the sentence can never silently drift out of sync with reality the way a hand-typed figure could. No code change was needed to reflect Manchester–Dubai's new observation here — the live computation already picked it up.

---

## 6. Exact gaps by route

Only routes with a genuine, specific, actionable gap are listed (Strong routes with no gap are omitted; see §3 for their full record).

| Route | Gap | What would close it |
|---|---|---|
| **Manchester–Doha** | Soft-launch route with exactly one depth category (a fresh fare check). Batch 1 confirmed no second category is currently addable: Qatar Airways' baggage page is inaccessible, a duplicate `airlineVerifications` entry on this single-carrier route wouldn't be genuine depth, and no real warning exists. | A founder Book-By decision, or a human editor checking Qatar Airways' own baggage page directly with unrestricted browser access. |
| Manchester–Dubai *(closed 6 August 2026 — kept here as the "thin despite looking complete" example, not an open gap)* | Now Strong (fare + baggage), but the rendered `DealCard` shows a "DIRECT FLIGHT" badge directly above this fare's own "connecting via Bahrain" description — see the Batch 1 completion record's addendum. | A founder decision on whether `getDealDirectnessLabel()` should account for a displayed fare's own routing, or explanatory copy bridging the two facts. Not a "close the gap" item — the depth categories are genuinely met; this is a clarity problem, not a missing-evidence one. |
| Heathrow–Bengaluru | Airline service is confirmed by two independent primary sources (one category), but no fare observation or any other guidance has ever been logged. | One fresh, dated fare check would clear the bar (airline-verif + fare = 2 categories). |
| Manchester–Amritsar / Manchester–Ahmedabad | Each has real connecting-route detail (one category) but nothing else. | A fare check or a formally investigated warning would clear the bar. |
| Leeds Bradford–Islamabad / Gatwick–Ahmedabad / Gatwick–Amritsar | Each has a genuinely researched, sourced warning (one category) but nothing else. | A fare check or per-airline verification would clear the bar — the warning itself should stay, it's real research, just not broad on its own. |
| Manchester–Karachi | Direct claim not confirmed by any primary source; secondary aviation-news reporting only. | A route-specific PIA or airport-schedule primary source (this is the harder, prerequisite-level gap — no depth category can substitute for it). |
| Birmingham–Lahore | Same — no primary source confirms a direct Birmingham–Lahore PIA service. | A route-specific primary source. |
| Birmingham–Islamabad | Conflicting secondary sources; genuinely unresolved. | A route-specific primary source that resolves the conflict either way. |
| Manchester–Sylhet | Direct, disclosed contradiction between Manchester Airport's own page ("not flying to this location") and Biman's official Manchester–Dhaka-via-Sylhet notice. | A Biman-direct or Manchester Airport-direct source that resolves the contradiction. |
| Heathrow–Dhaka / Heathrow–Sylhet | Real, current flight-tracking evidence exists, but the exact stop pattern (nonstop vs. via Sylhet) is unconfirmed by any primary source. | A Biman or Heathrow route-specific source stating the stop pattern directly. |
| 12 zero-category Useful routes (Heathrow–Doha, Leeds Bradford–Amritsar, Manchester–Dhaka, Manchester–Jeddah, Birmingham–Madinah, Birmingham–Mumbai, Glasgow/Edinburgh/Newcastle–Dubai, plus Birmingham–Islamabad, Heathrow–Dhaka, Heathrow–Sylhet, Manchester–Sylhet already listed above for their prerequisite gap) | Verified (where directness is confirmed) and correctly described, but carry none of the six Strong-qualifying depth categories. | Any two of: a fare observation, a `connectingAlternative` block (for the connecting ones), a per-airline verification entry, Book-By priority, a newly-investigated warning, or baggage guidance. |

**Routes that appear visually complete but have thin underlying intelligence** (the specific question the brief asked): **Manchester–Dubai is now the clearest example of the inverse problem** — a route that genuinely closed its depth gap (fare + baggage, both real and evidenced) but whose rendered page still shows a real inconsistency (the "DIRECT FLIGHT" badge sitting above a "connecting via Bahrain" fare description) that the grade alone doesn't fix. Meeting the threshold and reading cleanly to a customer are not automatically the same thing — see the Batch 1 completion record's addendum. **Manchester–Doha** is a soft-launch route that looked complete (verified, fresh fare, Trip.com link) but has only one kind of evidence behind it, and Batch 1 confirmed every other avenue this environment can research is currently exhausted for it. Heathrow–Bengaluru remains the clearest "confirmed but un-priced" case.

**Routes with stale or weak evidence:** none of the 32 routes currently have a *stale* `verification` record (every `reviewDueDate` is still in the future as of 6 Aug 2026) — but 9 of them have `unverified` status specifically because no primary source was ever found, not because a once-good source went stale. That's a different, harder gap (needs new evidence, not re-verification of old evidence).

---

## 7. Recommended route-completion batches

Based on the actual data above, not a generic template:

- **Batch 1 — close the two soft-launch gaps.** ✅ Run August 2026, wording corrected same month after a product-truth review — see the full completion record immediately after this section. Manchester–Dubai gained one genuine category (baggage guidance) and needs one manual fare check to satisfy the code-level Strong threshold — not the same thing as being content-complete; see the review's findings below. Manchester–Doha could not gain a second category through any avenue this batch could research — its remaining gap needs either a genuinely-justified founder Book-By decision or human browser access this environment doesn't have, and even the latter may only surface Qatar's generic policy, not a route-specific fact.
- **Batch 2 — the other "confirmed but thin" Strong-adjacent routes.** Heathrow–Bengaluru (one fresh fare check closes it), Manchester–Amritsar/Ahmedabad (a fare check or warning), Leeds Bradford–Islamabad and both Gatwick routes (a fare check or airline-verification entry alongside their existing warning).
- **Batch 3 — the three unresolved Pakistan primary-source gaps.** Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad — all need the same kind of evidence (a route-specific PIA or airport-schedule primary source) before any depth category can even apply, so investigating them together is efficient.
- **Batch 4 — the four unresolved Bangladesh primary-source gaps.** Manchester–Sylhet, Heathrow–Dhaka, Heathrow–Sylhet (stop-pattern confirmation), grouped with the Pakistan batch if convenient, or separately given they need Bangladesh-specific sources (Biman, Manchester Airport, Heathrow).
- **Batch 5 — the remaining zero-category Useful routes** (Heathrow–Doha, Leeds Bradford–Amritsar, Manchester–Dhaka, Manchester–Jeddah, Birmingham–Madinah, Birmingham–Mumbai, Glasgow/Edinburgh/Newcastle–Dubai), roughly in commercial-value order: Heathrow–Doha (Gulf, no Trip.com link but high search interest) and the three single-destination Dubai routes (each simple — one fare check apiece would move them halfway, a second category would complete them) first; the four connecting routes (would benefit from a `connectingAlternative` block plus one more category) after; Leeds Bradford–Amritsar last (smallest airport, lowest relative volume).

**Suggested order of work:** Batch 1 → Batch 2 → Batch 3 → Batch 4 → Batch 5. Batches 1–2 are mostly fare-check/verification items (fastest, highest-leverage — the launch set and the routes already one step from Strong). Batches 3–4 require new primary-source research, not fare-checking, so they're naturally slower and should be scheduled with that in mind rather than rushed to match Batch 1–2's pace.

---

## Batch 1 completion record (August 2026): Manchester–Dubai and Manchester–Doha

Full audit and outcome for the two routes Batch 1 was scoped to. Neither route was automatically
upgraded — every category below was checked individually against real evidence before being added
or ruled out, and the Strong threshold itself was not touched.

### Manchester–Dubai — before and after

| Category | Before Batch 1 | After Batch 1 | Why |
|---|---|---|---|
| Verified service state | ✅ (route-level, Emirates' own route page, checked 28 Jul 2026) | Unchanged | Already solid; not this batch's concern. |
| Per-airline verification breakdown | Not present | Not added | Single-airline route (Emirates only) — a duplicate `airlineVerifications` entry restating the same route-level claim would be filler, not real depth. |
| Connecting-alternative detail | N/A | N/A | Route is direct, not connecting — this category structurally cannot apply. |
| Fare evidence | ❌ Two logged observations, both predate the `departureDate`/`returnDate` requirement | ❌ Still none | `FARE_OBSERVATION_ARCHIVE.md`'s own binding rule rules out an automated check ("Automated browser polling, price scraping... are not part of this archive"), and no existing observation could be safely re-dated without misrepresenting when it was actually checked. Documented as a standing manual founder action in that file. |
| Book-By priority | Not included | Not added | Founder-level product decision, explicitly out of scope for this batch. |
| Investigated warning | None | None | No genuine service issue exists for this route; nothing to research or add. |
| Baggage guidance | None | ✅ Added — `manchester-dubai-emirates-baggage-weight` in `data/traveller-tips.ts` | Checked directly against Manchester Airport's own Emirates flight-operator page (`manchesterairport.co.uk/flight-operators/emirates/`, fetched 6 August 2026): "no bag may weigh more than 32kg and the total weight of all your baggage may not exceed the limit of your ticket type." Genuinely different from the generic 23kg-comparison prose already in `data/guides.ts` — not a duplicate. |
| Airport/terminal guidance | Manchester's Terminal 2 already documented airport-wide in `data/airport-notes.ts` (`man-terminal-2`, covers Emirates and Qatar Airways together) | Unchanged | Already exists; adding a route-scoped duplicate would be redundant, not genuine new depth. Confirmed by checking `data/airport-notes.ts` before writing anything new. |
| **Depth category count** | **0** | **1** | |
| **Grade** | Useful | **Useful (unchanged — correctly not auto-upgraded)** | One category is not enough; the fare check remains the one thing standing between this route and Strong. |

### Manchester–Doha — before and after

| Category | Before Batch 1 | After Batch 1 | Why |
|---|---|---|---|
| Verified service state | ✅ (route-level, Qatar Airways' own route page, checked 28 Jul 2026) | Unchanged | Already solid. |
| Per-airline verification breakdown | Not present | Not added | Single-airline route (Qatar Airways only) — same reasoning as Dubai. |
| Connecting-alternative detail | N/A | N/A | Route is direct. |
| Fare evidence | ✅ One publishable observation (`obs-man-doh-economy-20260805-8w-v1`, checked 5 Aug 2026, £411 return, Pegasus Airlines via Trip.com) | Unchanged | Already present — genuinely the cheapest fare Trip.com returned on the date checked, not a mismatch with the route's Qatar Airways verification (see `data/fare-observations.ts`'s own documented distinction between a route's curated operating airline and a fare observation's actual source). |
| Book-By priority | Not included | Not added | Founder decision, out of scope. |
| Investigated warning | None | None | No genuine issue found. |
| Baggage guidance | None | **Still none — genuinely blocked** | Qatar Airways' own baggage page returned HTTP 403 to this environment's fetch tooling on every attempt. Manchester Airport's own Qatar Airways operator page was checked directly and explicitly states no baggage figure, directing passengers to Qatar Airways' own site instead: "Go to the Qatar Airways website to check in online and see information about your luggage allowance." No reliable, specific, checkable figure was found anywhere this environment could reach. |
| Airport/terminal guidance | Manchester's Terminal 2 already documented (same `man-terminal-2` note as Dubai) | Unchanged | Already exists; nothing new to add. |
| **Depth category count** | **1** | **1** | |
| **Grade** | Useful | **Useful (unchanged)** | Every category this batch could research is now exhausted for this route; see below for what's left. |

### Sources used

- `data/routes.ts`, `data/route-warnings.ts`, `data/fare-observations.ts`, `lib/booking-intelligence.ts`, `lib/booking-providers.ts`, `data/traveller-tips.ts`, `data/airport-notes.ts`, `data/airlines.ts`, `data/destinations.ts` — read directly, no changes except the one new `traveller-tips.ts` entry.
- Manchester Airport's own Emirates flight-operator page (`manchesterairport.co.uk/flight-operators/emirates/`), fetched 6 August 2026 — source for the new Dubai baggage-guidance entry.
- Manchester Airport's own Qatar Airways flight-operator page (`manchesterairport.co.uk/flight-information/flight-operators/qatar-airways/`) and its Doha destination guide (`manchesterairport.co.uk/destinations-and-guides/doha/`), both fetched 6 August 2026 — confirmed no baggage figure exists on either; ruled out adding anything for Doha rather than guessing.
- Emirates' own official baggage pages (emirates.com) and Qatar Airways' own official baggage pages (qatarairways.com) — attempted, both returned HTTP 403 to this environment's fetch tooling on every URL tried. Not used as sources because they could not actually be read.

### No new fare observation was added

Confirmed from the real data: Manchester–Dubai has zero publishable fare observations (its two logged entries predate the dating requirement); Manchester–Doha has exactly one. Per this project's own binding fare-observation methodology (`FARE_OBSERVATION_ARCHIVE.md`, "Automated browser polling, price scraping, API harvesting and retrospective backfill are not part of this archive"), no automated check is a legitimate source for this archive regardless of what tooling is available — this is a stricter rule than this batch's own instructions, and the stricter rule was followed. The exact manual check Manchester–Dubai needs — route, profile, dates, required fields — is now documented in `FARE_OBSERVATION_ARCHIVE.md`'s new "Founder action required" section, ready to execute.

### Whether each route now genuinely qualifies as Strong

Neither does. Manchester–Dubai: 1 of 2 required categories (needs the fare check). Manchester–Doha: 1 of 2 required categories (needs one more, and every avenue this batch could research is exhausted — see above). This is the honest outcome the batch was asked to report if upgrading wasn't achievable; nothing was fabricated or forced to close the gap.

### Does "baggage + fare" genuinely justify "JetStash knows this route well"? (product-truth review, August 2026)

The completion record above states that a compliant fare observation would satisfy `computeRouteIntelligenceLevel()`'s two-category bar for Manchester–Dubai. A dedicated review challenged whether that's the same thing as the rendered page actually earning the customer-facing wording, and read the page as a customer would rather than trusting the code's grade alone. Checked directly against the real route and the real rendered page:

| What a customer would see | Present? |
|---|---|
| Useful route overview | Yes — a real, specific intro paragraph exists. |
| Reliable service state | Yes — shown as a "DIRECT" badge, backed by a route-level `verification` record. |
| Useful airline guidance | **Weak** — the page shows only the word "Emirates" under "Airlines"; there is no per-airline detail beyond the single-carrier route-level claim. |
| Useful airport guidance | **Indirect** — real content exists (`data/airport-notes.ts`'s Terminal 2 note), but only via a separate "View Manchester Airport guide" link, not inline on the route page itself. |
| Source/review evidence | **Not shown at all.** Confirmed by source-scanning the whole codebase: no file under `app/` or `components/` reads `route.verification` outside the test suite. The sourced citation this whole grading system is built on (Emirates' own route page, checked 28 July 2026) is real and correct, but a visitor to `/routes/manchester-dubai` never sees it — only the Atlas (a homepage widget) surfaces it, in an internal verdict string, not on the route page proper. |
| Exact provider hand-off | Yes — the Trip.com CTA is correct and unchanged. |
| Transparent fare evidence | Would be yes once the fare check lands — `DealCard`/`FareHistoryPanel` already render dated ranges honestly wherever data exists. |

This is a genuine, previously-unrecorded finding (not fixed here — the fix would mean adding a "sources" section to the shared `app/routes/[slug]/page.tsx` template, which affects all 32 routes and is explicitly out of scope for a batch scoped to two routes). It means the code-level Strong threshold and a customer's actual read of the page can diverge: two categories is enough to clear `computeRouteIntelligenceLevel()`, but "JetStash knows this route well" is a stronger claim than "two of six internally-tracked facts exist," especially when one of those facts (source/review evidence) isn't visible on the page at all.

**Revised framing, replacing every prior claim elsewhere in this document and in `FARE_OBSERVATION_ARCHIVE.md`** that the code-level grade alone would settle the matter: a compliant fare observation would satisfy the current Atlas threshold for Manchester–Dubai, subject to a final content-depth review — not an automatic promotion. The Strong threshold itself is unchanged by this finding (that would be a global, cross-route decision, out of scope for a two-route batch); this is a note for whoever adds the fare observation to read the rendered page critically rather than assume the grade alone settles the question.

### Protecting the Doha decision from artificial upgrading

Explicit standing rules, so a future pass doesn't close Manchester–Doha's gap by gaming the score rather than earning it:

- **Book-By priority must be assigned only when editorially justified** — because a route genuinely fits the festival-anchored, dated booking-guidance pattern `lib/booking-intelligence.ts` was built for — **never** simply to hand the route a second Atlas scoring category. `BOOK_BY_PRIORITY_ROUTE_SLUGS` stays a founder-level product decision; nothing in this batch or its documentation should be read as a request to add Manchester–Doha to it.
- **No filler warning.** `data/route-warnings.ts` entries must document a real, sourced, investigated service issue. Manchester–Doha has none, and none should be invented to close the gap.
- **No duplicated airline record.** Manchester–Doha has one operating airline (Qatar Airways) and one route-level verification. A new `airlineVerifications` entry restating the same claim would not be genuine per-carrier depth — see the completion record's own reasoning for why this was correctly ruled out for both Batch 1 routes.
- **No unsupported baggage statement.** This batch confirmed Qatar Airways' own baggage page is inaccessible to this environment (HTTP 403 on every attempt) and that Manchester Airport's own Qatar Airways page explicitly has no baggage figure. Nothing should be written to fill that gap without a real, checkable source.
- **The route stays Useful until genuine independent intelligence is available.** No mechanism in this codebase should treat "Doha needs one more category" as licence to manufacture one.

**Would unrestricted human browser access to Qatar Airways' own baggage page actually complete the route?** Probably only partially, and this should not be assumed to close the gap on its own. Based on the same Weight Concept pattern confirmed for Emirates (this batch's own research — see the completion record: allowance stated as varying "by ticket type" with no single figure given) and Qatar Airways' own general baggage-policy pages (checked via search summary earlier in this batch's research, not directly readable), Qatar Airways' baggage rules are very likely governed by fare family and route region in the same generic way — meaning a human editor with real browser access would probably find the same kind of general, ticket-type-dependent policy statement Manchester Airport's own page already gestures at, not a fact unique to the Manchester–Doha city pair. That would still be genuine, addable depth (the same standard Dubai's own baggage tip was held to), but a founder or editor pursuing this should expect "Qatar Airways' general policy, sourced properly" rather than a materially different or more route-specific discovery.

---

## Addendum (6 August 2026): Manchester–Dubai's fare observation closes the code-level gap, with a caveat

Manchester–Dubai's founder-action fare check (documented in `FARE_OBSERVATION_ARCHIVE.md`'s
"Founder action required" section above) was performed, reviewed twice, and approved for recording:

- **Recorded:** `obs-man-dxb-economy-20260806-8w-v1` — £480 return, Gulf Air, connecting via
  Bahrain, checked 6 August 2026. Full detail and evidence in `FARE_OBSERVATION_ARCHIVE.md` and
  `docs/project-control/fare-evidence/manchester-dubai-2026-08-06.md`.
- **`isPubliclyPublishable()` / `isObservationPublishable()`: confirmed `true`** — both dates
  present, route matches, route status is `'direct'`.
- **Atlas grade: now `'strong'`**, computed live via the unchanged `computeRouteIntelligenceLevel()`
  — baggage (Batch 1) + fare (this observation) = 2 categories. This is a mechanical consequence of
  real, reviewed evidence clearing an unchanged threshold, **not a manual override and not an
  automatic content-quality promotion** — the two are deliberately kept separate, per the
  content-depth review immediately above and the second review below.

### Second content-depth review, specifically on the now-Strong page

The first review (above) was run *before* this observation existed, on the hypothetical of what
adding one would produce. This second pass re-reviewed the actual rendered
`/routes/manchester-dubai` page and its `/deals` `DealCard` with the real observation live.

**A concrete problem was found (and has since been fixed — see "Third review" below):** the
`DealCard`'s top-right badge read **"DIRECT FLIGHT"** — derived from the route's own verified
Emirates direct service via `getDealDirectnessLabel()` (`data/deals.ts`) — rendered directly above
this fare's own price description, which explicitly states **"Gulf Air, connecting via Bahrain both
ways."** This was a real, currently-live inconsistency a customer would see on the same card,
confirmed on both `/routes/manchester-dubai` and `/deals` (the same shared `DealCard` component
renders on both).

**Root cause, confirmed in code (at the time):** `getDealDirectnessLabel()` intentionally derives
the badge from the *route's* verified status, never the specific fare's own routing — correct for
every other route in the archive at that time, where the logged fare happened to share the route's
verified operator. Manchester–Doha's Pegasus observation has the same underlying mismatch (a
different airline/routing than the route's verified Qatar Airways service) but never became
visible, because Doha has no `Deal` entry in `data/deals.ts` at all — its `DealCard` never renders.

### Third review (6 August 2026): the badge contradiction is now fixed

A follow-up truth-and-integrity correction (same day) implemented the fix this section originally
left open, rather than leaving it as a future recommendation:

- **New field:** `FareObservation.fareDirectness?: 'direct' | 'connecting'` (`data/fare-observations.ts`)
  — the specific itinerary's own recorded directness, set from evidence at the time of the check,
  never inferred from route status. Set to `'connecting'` on
  `obs-man-dxb-economy-20260806-8w-v1`.
- **New aggregation:** `FareRangeSummary.observedDirectness`, computed by `getFareRangeSummary()` —
  `'direct'`/`'connecting'` only when every contributing observation agrees, `undefined` otherwise
  (never a majority guess).
- **New gate:** `getDealFareDirectnessLabel()` (`data/deals.ts`) is now the only function `DealCard`
  calls for its top-right badge. Resolution order: bundled/package deals keep the route-level label
  (no flight-only fare is ever shown for them); a deal with no logged fare keeps the route-level
  label (nothing to contradict); an observation with an explicit `fareDirectness` always wins; absent
  that, the route-level label is used only when every source airline shown is one of the route's own
  verified operators (a safe inference); otherwise the function **fails closed — no badge at all**,
  rather than guessing.
- **Manchester–Dubai now renders "CONNECTING"** on its Economy `DealCard`, directly above the "Gulf
  Air, connecting via Bahrain both ways" description — the contradiction is resolved. The route
  hero and Business-class card (no fare logged) are untouched and still correctly read "DIRECT" /
  "DIRECT FLIGHT", preserving the route-level truth exactly as this section originally required.
- **Auditing every `Deal` entry for the same latent defect surfaced three more instances** beyond
  Dubai, none previously visible as a labelled contradiction only because no description text on
  those cards stated a conflicting airline in words: `man-lhe-economy` (Manchester–Lahore Economy —
  route verified for PIA, logged fare was Etihad), `lhr-del-economy` (Heathrow–Delhi Economy — route
  verified for Virgin Atlantic/BA/Air India, logged fare was IndiGo), `bhx-atq-economy`
  (Birmingham–Amritsar Economy — route verified for Air India, logged fares included KLM/IndiGo/Air
  France). All three now correctly render **no directness badge** instead of an unconfirmed claim.
  Every other `Deal` entry was confirmed unaffected (`tests/deal-card-fare-directness.test.ts`).
- **Manchester–Doha's Pegasus mismatch remains latent** exactly as this section originally noted —
  it has no `Deal` entry, so `getDealFareDirectnessLabel()` is never called for it and no badge ever
  renders either way. Adding a `Deal` entry for Doha is unchanged, separate scope.

**Verdict on "JetStash knows this route well" (Part 3 reassessment, this same correction):** the
brief for this correction explicitly required *not* manually overriding the Atlas grade in either
direction as part of fixing the badge — and that instruction was followed; nothing in
`computeRouteIntelligenceLevel()` or the Strong threshold was touched.

- **Internal consistency: now clean.** The specific defect this section flagged — a route-level
  direct badge sitting directly above a description of a connecting fare — no longer exists anywhere
  in the catalogue. A customer reading the Dubai page now sees "DIRECT" (Emirates, route-level, in
  the hero) and "CONNECTING" (Gulf Air, this specific fare, on the card) as two separate, individually
  true claims, not a contradiction.
- **The broader content-depth concern from the first review (above this addendum) is unrelated to
  the badge and remains exactly as before**: the page's airline guidance is still a bare name with
  no verification detail beyond the badge itself, and the underlying fare-check evidence (the
  browser-session review, the DOM baggage inspection) is not itself surfaced anywhere on the public
  page — only the resulting price and badge are. Fixing the badge contradiction does not add page
  depth; it only stops the page from asserting two things that disagreed.
- **Grade left exactly as the mechanical threshold computes it (Strong)** — per instruction, not
  manually raised or lowered here. Whether a fare observation whose itinerary genuinely differs from
  the route's verified service should count *less* toward the Strong threshold than one that matches
  it is a real product question the numeric criteria (§8 below) don't currently distinguish between
  — flagged here as a **possible separate grading-model follow-up**, not resolved or acted on in this
  correction.

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
