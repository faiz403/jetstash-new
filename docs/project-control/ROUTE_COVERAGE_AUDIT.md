# Route Coverage Truth and Completion — Phase 1 Audit

**Date:** 6 August 2026 (revised same day after a product-truth review; revised again the same week
by Route Intelligence Scoring v2 — see "Revision note" and "RIS-001 revision note" below; revised
again the same week by Fare Coverage Expansion Batch B — see the addendum near the end).
**Scope:** Atlas route/country status honesty + a structured, evidence-based completeness audit of all 32 public routes.
**Computed against:** `main`-derived branch `feat/route-intelligence-scoring-v2`, using the real production data and the exact function (`computeRouteIntelligenceLevel` in `lib/atlas-network-data.ts`) the live Atlas itself calls — this document and the product cannot drift apart, because they're the same derivation.
**What this document is not:** a completion plan that's already been executed. Nothing in this phase completed missing route intelligence, added fare observations, or changed a route fact. This is Phase 1 — truth and audit only. See "Recommended route-completion batches" for what Phase 2+ would involve.

## RIS-001 revision note (Route Intelligence Scoring v2, 6 August 2026)

**This is the current, binding threshold — read this before any table below.** Fare Coverage
Expansion Batch A's own audit found that the "at least two of six categories" rule below (the
product-truth review's fix, still correct as far as it went) could still be satisfied by exactly the
two cheapest-to-obtain categories — `connectingAlternative` (one editorial paragraph) and a single
fare check — with no baggage guidance, no per-airline verification, no investigated warning, and
(before a separate same-week fix) sometimes not even a visible price. Manchester–Amritsar and
Manchester–Ahmedabad were the concrete, reproducible instance: both cleared "Strong" on exactly that
combination, and a rendered-page review found neither read as confidently as the badge claimed.

`computeRouteIntelligenceLevel()` now applies two further, independent gates beyond the unchanged
2-of-6 breadth requirement:

- **Category diversity** — at least one of the two-or-more satisfied categories must be
  "substantive" (per-airline verification, Book-By priority, an investigated warning, or baggage
  guidance), not just `connectingAlternative` and/or fare alone. This directly rules out the
  Amritsar/Ahmedabad pattern, generalised so it can never recur silently on a future route.
- **Visible-content baseline** — a real, dated fare must actually render as a priced `Deal` card a
  visitor can see (not merely sit in the archive behind `NoFareFallback`'s "we haven't logged a
  tracked fare... yet"), and for a **connecting** route specifically, `connectingAlternative` must be
  present (a connecting route with neither a visible fare nor an explanation of how the connection
  works has essentially nothing behind "Strong"). Direct routes are never required to carry
  `connectingAlternative` — matching the standing principle that a direct route doesn't need transfer
  guidance it doesn't use.

**Full reasoning, the real 32-route audit this was validated against before being written into code,
and the exact routes it moves:** see the "Route Intelligence Scoring v2 (RIS-001)" addendum near the
end of this document. Every number in the sections below already reflects RIS-001 — the "Revision
note" immediately below is preserved as a historical record of the PREVIOUS correction (1-of-6 →
2-of-6), not the current rule.

## Revision note (product-truth review, 6 August 2026) — historical, superseded by RIS-001 above

The first version of this audit and the threshold it was built on required only **one** depth signal for a route to be graded "Strong" ("JetStash knows this route well"). A dedicated review of that threshold, run against the real 32-route dataset rather than unit-test fixtures, found this too permissive: 7 of the original 16 "Strong" routes qualified on exactly one shallow signal — a single `connectingAlternative` paragraph (Manchester–Amritsar, Manchester–Ahmedabad), a single warning (Leeds Bradford–Islamabad, Gatwick–Ahmedabad, Gatwick–Amritsar), or airline verification alone with no other guidance (Heathrow–Bengaluru), plus Manchester–Doha on a single fare check. The review's principle — *"a Strong route should have broad intelligence depth across several independent categories, not directness plus one signal"* — was enforced in code as **`computeRouteIntelligenceLevel()` requires at least two of six independently-gated depth categories**, not one. That 2-of-6 breadth requirement is still the FIRST of RIS-001's three gates today; RIS-001 added the other two.

Two candidate categories were tested against the real data and deliberately **not** added: an "independently checkable source URL" category was dropped because every route-level `verified` record in the dataset already has one (14/14) — it never actually differentiated anything, it would only have inflated every verified route's score by one point for free. An "airport/transfer guidance" category was considered but 0 of 32 routes currently have any (see §3.5) — including it as a scored category today would make it un-clearable by definition; it stays tracked, not scored, until at least one route has one.

---

## 1. Executive summary

JetStash currently presents 32 public routes. The intelligence behind them was genuinely uneven, and the Atlas didn't explain that difference — it let a single verified destination make an entire country read "strong," offered no honest middle state between "verified" and "not yet researched" at the country level, its first-draft route threshold was itself too easy to clear, and (per RIS-001 above) even the corrected threshold could still be cleared on the two cheapest categories alone.

This phase does not claim every route is now complete. It does three things:

1. **Fixes what the Atlas says.** Every route now shows one of three honestly-derived, non-blank statuses — *"JetStash knows this route well"*, *"Useful route guidance available"*, or *"Intelligence still being expanded"* — computed from real fields, requiring **breadth across at least two independent categories, category diversity beyond the two cheapest, and a visible-content baseline** for the top tier (RIS-001) — never a single signal, never the cheap-pair alone, never manually assigned. Country-level aggregation is conservative: one strong destination can no longer carry an entire country.
2. **Grades all 32 routes honestly**, using that same derivation, and states plainly what's missing from each one that isn't "strong."
3. **States the real fare-tracking scope** — 13 of 32 routes have any publicly-displayable fare observation, all 13 currently fresh — and fixes the one page (`/deals`) most likely to read as claiming broader coverage than exists.

**Headline numbers, computed from the real data under RIS-001, after Fare Coverage Expansion Batch B**
(updated 6 August 2026 — see the RIS-001 addendum and the Batch B addendum near the end for the full
recomputations):

| | Count | of 32 |
|---|---|---|
| **Strong** — JetStash knows this route well | 10 | 31% |
| **Useful** — useful route guidance available | 22 | 69% |
| **Expanding** — intelligence still being expanded | 0 | 0% (this state applies to Atlas destinations with no `routes.ts` entry at all, not to any of the 32) |
| Routes with any publicly-displayable fare observation | 23 | 72% |
| Routes with a customer-visible fare (a real priced `Deal` card) | 22 | 69% |
| Soft-launch routes (of 6) that genuinely meet the Strong bar | 3 | 50% |

**Findings worth surfacing immediately:**
- **Manchester–Amritsar, Manchester–Ahmedabad and Manchester–Madinah all moved from Strong back to Useful under RIS-001** (6 August 2026) — each qualified on exactly `connectingAlternative` + a single fare check, the specific combination RIS-001's category-diversity gate now rules out. Not a manual override — the same evidence, re-assessed against a stricter, more defensible rule.
- **Birmingham–Amritsar and Heathrow–Jeddah also moved from Strong to Useful** — both have genuinely broad category counts (3 each), but RIS-001's visible-content gate found Birmingham–Amritsar has no `connectingAlternative` block despite being a connecting route (nothing explains how the connection actually works), and Heathrow–Jeddah's fare observation has never had a matching `Deal` card, so it has never actually been visible to a customer.
- **Manchester–Dubai remains Strong under RIS-001** (fare + baggage — baggage counts as substantive depth, and its fare is genuinely visible). The residual concern from the earlier content-depth review — thin airline guidance, a bare name with no per-airline detail — is real but is not something RIS-001 resolves; see the addendum for why this is reported as an honest, named limitation rather than forced to fail.
- **Manchester–Doha**, a soft-launch route, remains graded **Useful** — its only depth category is fare evidence, never broad enough to clear Gate 1 regardless of RIS-001. Not upgraded to make the launch set look complete — see §4 and "Protecting the Doha decision."
- **Fare Coverage Expansion Batch B (6 August 2026, after RIS-001) added 10 new fare observations**, mechanically moving three routes from Useful to Strong — **London Gatwick–Ahmedabad, London Heathrow–Bengaluru and London Gatwick–Amritsar** — each because the new fare was the second depth category a route already had exactly one of (a pre-existing warning or airline verification). Two country aggregates followed: **Heathrow India and Gatwick India both moved from Mixed/Useful to Strong**, since every one of their India destinations is now individually Strong. See the Batch B addendum for the full account.

---

## 2. Status definitions

### Route-level (every one of the 32 routes gets exactly one)

| Status | Customer-facing label | Definition |
|---|---|---|
| **Strong** | "JetStash knows this route well" | Current direct/connecting status is confirmed (`getDisplayDirectness()` returns `'direct'` or `'connecting'`, never `'unverified'`) **and** RIS-001's three gates all pass: (1) at least **two** of six independent depth categories are present — per-airline verification breakdown (`airlineVerifications`), a `connectingAlternative` detail block, a publishable fare observation, Book-By priority modelling, an active specifically-investigated warning, or dedicated baggage guidance; (2) at least one of those categories is "substantive" (airline-verif, Book-By, warning or baggage — `connectingAlternative` and fare alone never qualify on their own); (3) a real, dated fare actually renders as a priced `Deal` card a visitor can see, and — for a connecting route specifically — `connectingAlternative` is present. |
| **Useful** | "Useful route guidance available" | A real route guide exists (every route has one — intro, booking-window note, peak periods are required fields), but the route doesn't meet the Strong bar under any of RIS-001's three gates. |
| **Expanding** | "Intelligence still being expanded" | No `data/routes.ts` entry exists at all — an Atlas destination backed only by `data/network-evidence.ts` (real, sourced evidence that the destination is reachable, but no dedicated JetStash route guide yet). None of the 32 routes this audit covers are in this state by definition; it applies to the wider Atlas destination set (Istanbul, Antalya, Marrakech, and others). |

**Why breadth, diversity AND visibility, not just presence:** each of the six categories is something the codebase already independently gates and can't be gamed by rewording prose — but a route can (and, before the original threshold correction, several did) satisfy exactly one of them and nothing else; and even two categories, if they're both from the "cheap to obtain" pair (`connectingAlternative`, fare), don't add up to genuine breadth (RIS-001's finding). Requiring category diversity plus a visible-content baseline means "JetStash knows this route well" now means the route has been looked at from more than one *genuinely different* angle, AND that a visitor can actually see the result — not just that two boxes happen to be ticked in the data.

**Category prevalence across the real 32 routes** (how many routes have each, for reference, updated after Fare Coverage Expansion Batch A, 6 August 2026 — see the addendum after §7): per-airline verification breakdown 4, connecting-alternative detail 5, fare evidence 13, Book-By priority 5, investigated warning 5, baggage guidance 6.

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

Grouped by grade under RIS-001. "Depth categories" lists which of the six category-1 facts the route actually has — Strong routes always have two or more AND at least one substantive one AND a passing visible-content check (see the RIS-001 addendum); Useful routes fail at least one of the three gates. "Fare" shows publishable observation count and freshness as of 6 Aug 2026 (`OBSERVATION_FRESH_DAYS` = 60). "TC" = has a real Trip.com link (tracked, not scored — see the Revision note).

### Strong (10 of 32)

| Route | Direct/Connecting | Depth categories (2+, ≥1 substantive) | Fare | Visible fare? | TC | Notes |
|---|---|---|---|---|---|---|
| Heathrow–Delhi | Direct (airline-verified) | Airline-verif, fare, Book-By, baggage | 2, fresh | Yes | N | 4 categories — the broadest evidence of any route. No Heathrow-origin Trip.com link exists (by design — see AFF-001). |
| Manchester–Dubai | Direct, verified | Fare, baggage | 1, fresh (0d) | Yes | Y | **The Atlas default landing route.** Baggage is the substantive category. The residual airline-guidance-depth concern from the earlier content-depth review is real but not something RIS-001 resolves — see the RIS-001 addendum for why this is reported honestly rather than forced to fail. |
| Manchester–Lahore | Direct, verified | Fare, Book-By, baggage | 3, fresh (0d) | Yes | Y | Soft-launch route. |
| Heathrow–Mumbai | Direct (airline-verified, 3 airlines) | Airline-verif, fare | 1, fresh (13d) | Yes | N | |
| Manchester–Delhi | Direct, verified | Connecting-alternative, baggage, fare | 1, fresh (0d) | Yes | Y | Active withdrawal notice (IndiGo, effective 31 Aug 2026) — shown as a separate service notice, doesn't affect this grade. Baggage is the substantive category. |
| Manchester–Islamabad | Direct, verified | Fare, Book-By | 3, fresh (0d) | Yes | Y | Soft-launch route. |
| Manchester–Mumbai | Direct, verified | Connecting-alternative, baggage, fare | 1, fresh (0d) | Yes | Y | Same withdrawal notice as Delhi. Baggage is the substantive category. |
| Gatwick–Ahmedabad | Direct, verified | Warning, fare (2) | 1, fresh (0d) | Yes | N | **Moved from Useful, Fare Coverage Expansion Batch B (6 August 2026).** The existing sourced warning was already substantive; the new fare observation is its second category, and it's a direct route so the connecting-depth check doesn't apply. |
| Heathrow–Bengaluru | Direct (airline-verified, 2 airlines) | Airline-verif, fare (2) | 1, fresh (0d) | Yes | N | **Moved from Useful, Fare Coverage Expansion Batch B (6 August 2026).** Airline-verification was already substantive; the new fare observation is its second category. |
| Gatwick–Amritsar | Direct, verified | Warning, fare (2) | 1, fresh (0d) | Yes | N | **Moved from Useful, Fare Coverage Expansion Batch B (6 August 2026).** Same shape as Gatwick–Ahmedabad. |

### Useful (22 of 32)

| Route | Direct/Connecting | Depth categories | Why not Strong (under RIS-001) | Fare | TC |
|---|---|---|---|---|---|
| Birmingham–Amritsar | Connecting | Fare, Book-By, warning (3) | **Moved from Strong, RIS-001 (6 August 2026).** Genuinely broad category count (3, including two substantive ones) — but no `connectingAlternative` block exists for this connecting route, so RIS-001's visible-content gate fails: nothing on the page actually explains how the connection works. | 3, fresh (0d) | Y |
| Heathrow–Jeddah | Direct (airline-verified) | Airline-verif, fare, Book-By (3) | **Moved from Strong, RIS-001 (6 August 2026).** Broad category count and substantive depth, but its fare observation has never had a matching Economy `Deal` — no visible price a customer can actually see. Pre-dates Batch A; flagged as a follow-up in the Batch A audit, now also blocking Strong directly under RIS-001. | 1, fresh, **not customer-visible** | N |
| Manchester–Madinah | Connecting | Connecting-alternative, fare (2) | **Moved from Strong, RIS-001 (6 August 2026).** Exactly the `connectingAlternative` + fare pair RIS-001's diversity gate rules out — no substantive category. | 2, fresh (0d) | Y |
| Manchester–Amritsar | Connecting | Connecting-alternative, fare (2) | **Moved from Strong, RIS-001 (6 August 2026).** Same pattern as Madinah — this document's own former textbook example of the exact combination RIS-001 targets. | 1, fresh (0d) | Y |
| Manchester–Ahmedabad | Connecting | Connecting-alternative, fare (2) | **Moved from Strong, RIS-001 (6 August 2026).** Same pattern as Amritsar. | 1, fresh (0d) | Y |
| Leeds Bradford–Islamabad | Connecting | Warning, fare (2) | **Fare Coverage Expansion Batch B (6 August 2026)** added a fresh fare observation, but this is a connecting route with no `connectingAlternative` block — RIS-001's visible-content gate fails, same shape as Birmingham–Amritsar. | 1, fresh (0d) | Y |
| Manchester–Jeddah | Connecting | Fare (1) | **Fare Coverage Expansion Batch B (6 August 2026)** added a fresh fare observation — its only category, and this is a connecting route with no `connectingAlternative` block. | 1, fresh (0d) | Y |
| Birmingham–Mumbai | Connecting, verified | Fare (1) | Same as Manchester–Jeddah — one category, connecting with no `connectingAlternative` block. | 1, fresh (0d) | Y |
| Birmingham–Madinah | Connecting | Fare (1) | Same shape again. | 1, fresh (0d) | Y |
| Manchester–Dhaka | Connecting, verified | Fare (1) | Same shape again. | 1, fresh (0d) | Y |
| Leeds Bradford–Amritsar | Connecting | Fare (1) | Same shape again. | 1, fresh (0d) | Y |
| Manchester–Doha | Direct, verified | Fare only (1) | **Soft-launch route.** Two dated fare checks (5 and 6 August 2026 — the second a genuine nonstop Qatar Airways result, the first a connecting Pegasus fare), still one category. Batch 1 confirmed no second category is currently addable; see the completion record after §7. | 2, fresh (0d) | Y |
| London Heathrow–Doha | Direct, verified | Fare only (1) | **Fare Coverage Expansion Batch B (6 August 2026)** closed this route's Deal-with-no-observation gap, but a single fare check is still only one category. | 1, fresh (0d) | N |
| Manchester–Karachi | Direct, **unverified** | Warning (1), but unverified directness blocks Strong regardless | Current direct claim not confirmed by a primary source. | 0 | Y |
| Birmingham–Lahore | Direct, **unverified** | Baggage (1), but unverified directness blocks Strong regardless | Current direct claim not confirmed by a primary source. | 0 | Y |
| Birmingham–Islamabad | Direct, **unverified** | Zero | Conflicting secondary sources, no primary source resolves it. | 0 | Y |
| Heathrow–Dhaka | Direct, **unverified** | Zero | Real evidence of current operation (live flight-tracking) but stop pattern unconfirmed. | 0 | N |
| Manchester–Sylhet | Direct, **unverified** | Zero | Genuine, disclosed contradiction between Manchester Airport's own page and Biman's notice. | 0 | Y |
| Heathrow–Sylhet | Direct, **unverified** | Zero | Real evidence (flight-tracking + independent schedule sources) but not primary-confirmed. | 0 | N |
| Glasgow–Dubai | Direct, verified | Zero | No depth category. | 0 | Y |
| Edinburgh–Dubai | Direct, verified | Zero | No depth category. | 0 | Y |
| Newcastle–Dubai | Direct, verified | Zero | No depth category. | 0 | Y |

### Full route index (by slug)

Machine-checkable manifest — every one of the 32 routes, exactly once, with its exact grade. See §6 for gaps on any route below Strong.

| Slug | Grade |
|---|---|
| `birmingham-amritsar` | Useful |
| `birmingham-islamabad` | Useful |
| `birmingham-lahore` | Useful |
| `birmingham-madinah` | Useful |
| `birmingham-mumbai` | Useful |
| `edinburgh-dubai` | Useful |
| `glasgow-dubai` | Useful |
| `leeds-bradford-amritsar` | Useful |
| `leeds-bradford-islamabad` | Useful |
| `london-gatwick-ahmedabad` | Strong |
| `london-gatwick-amritsar` | Strong |
| `london-heathrow-bengaluru` | Strong |
| `london-heathrow-delhi` | Strong |
| `london-heathrow-dhaka` | Useful |
| `london-heathrow-doha` | Useful |
| `london-heathrow-jeddah` | Useful |
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
| `manchester-madinah` | Useful |
| `manchester-mumbai` | Strong |
| `manchester-sylhet` | Useful |
| `newcastle-dubai` | Useful |

### Current route-guide additions — 12 August 2026

The following five routes were added after this 6 August audit as the first Manchester Turkey
route-guide pilot. They are intentionally recorded here so the machine-checkable slug index remains
complete; their intelligence grade is computed by the unchanged scoring function.

| Slug | Grade |
|---|---|
| `manchester-istanbul` | Useful |
| `manchester-dalaman` | Useful |
| `manchester-bodrum` | Useful |
| `manchester-antalya` | Useful |
| `manchester-izmir` | Useful |
| `birmingham-istanbul` | Useful |
| `birmingham-antalya` | Useful |
| `birmingham-dalaman` | Useful |
| `birmingham-bodrum` | Useful |
| `bristol-antalya` | Useful |
| `bristol-dalaman` | Useful |
| `glasgow-antalya` | Useful |
| `glasgow-bodrum` | Useful |
| `glasgow-dalaman` | Useful |
| `leeds-bradford-antalya` | Useful |
| `leeds-bradford-bodrum` | Useful |
| `leeds-bradford-dalaman` | Useful |
| `london-gatwick-antalya` | Useful |
| `london-gatwick-bodrum` | Useful |
| `london-gatwick-dalaman` | Useful |
| `london-gatwick-istanbul` | Useful |
| `london-gatwick-izmir` | Useful |
| `newcastle-dalaman` | Useful |

---

## 3.5. Airport and baggage guidance coverage

Part D of the brief asked this to be recorded explicitly per route, separately from the Strong/Useful/Expanding grade above — it is a genuinely different signal (practical trip-planning content, not route-existence evidence) and deliberately does **not** feed into `computeRouteIntelligenceLevel()` as a required category (baggage guidance is one of the six *scored* categories; airport-specific guidance is tracked only — see below). Computed from `data/traveller-tips.ts`, the only structured source for this content (`TravellerTipScope` can target a `routeSlug`, `destinationSlug`, or `airportSlug`).

- **Airport guidance:** every route's departure airport has a general airport guide page (`/airports/[slug]`, `description`/`whyThisAirport` in `data/airports.ts`) — universal baseline coverage, not a differentiator between routes. But **zero of the 10 traveller tips are scoped to an `airportSlug`** — no route currently has dedicated, route-specific airport guidance (terminal, check-in, transfer-specific advice) beyond that shared baseline. This is a real, previously unrecorded gap, not a data error — nothing here was invented to fill it, and it's why this category is tracked but not required in §2's threshold: a required category that 0/32 routes can currently pass isn't a meaningful bar.
- **Baggage guidance:** 4 of the 11 traveller tips are `category: 'baggage'` (Route Completion Batch 1, August 2026 added a fourth — `manchester-dubai-emirates-baggage-weight`, checked directly against Manchester Airport's own Emirates operator page), scoped to Lahore, Delhi, Mumbai and Manchester–Dubai specifically. Because most of these are destination-scoped while the new one is route-scoped, this reaches **6 of 32 routes**: Manchester–Lahore, Birmingham–Lahore, Heathrow–Delhi, Manchester–Delhi, Manchester–Mumbai, Manchester–Dubai. The other 26 routes have no dedicated baggage guidance. This category *is* one of the six scored in §2, and under RIS-001 it is also the specific "substantive" category behind 5 of the 10 current Strong grades (Heathrow–Delhi, Manchester–Lahore, Manchester–Delhi, Manchester–Mumbai, Manchester–Dubai) — without it, none of those five would clear RIS-001's diversity gate on `connectingAlternative`/fare alone. The other 3 Batch-B-driven Strong grades (Gatwick–Ahmedabad, Heathrow–Bengaluru, Gatwick–Amritsar) reach Strong via a pre-existing warning or airline-verification category instead — see the Batch B addendum.
- **Overlap with §3's grade:** partial now (baggage guidance is a scored category), but still not determinative alone — e.g. Birmingham–Lahore has a baggage tip but stays Useful because its directness is unverified (the prerequisite still gates everything).

This is not a Phase 1 action item beyond the scoring change above — flagged here for the Phase 2+ batches in §7, since airport-specific guidance is the kind of gap a future batch could reasonably close.

---

## 3.6. Country-level aggregation, per airport (recomputed under RIS-001, then again after Batch B)

Every country node in the Atlas is scoped to a single airport's network (the same country can appear multiple times across different airports, aggregated independently each time). Computed live from `aggregateCountryIntelligence()` against the RIS-001 per-route grades above — `buildAtlasAirports()`'s actual output, not hand-derived.

| Airport | Country | Destinations (grade) | Result |
|---|---|---|---|
| Manchester | India | Mumbai (Strong), Delhi (Strong), Amritsar (Useful), Ahmedabad (Useful) | **Mixed** *(was Strong under Batch A's v1 grades — RIS-001 downgraded Amritsar/Ahmedabad)* |
| Manchester | UAE | Dubai (Strong) | **Strong** (single-destination country — see the content-depth caveat on Dubai's own grade in §3 and the RIS-001 addendum before reading this as unqualified) |
| Manchester | Pakistan | Lahore (Strong), Islamabad (Strong), Karachi (Useful) | **Mixed** |
| Manchester | Bangladesh | Dhaka (Useful), Sylhet (Useful) | Useful |
| Manchester | Qatar | Doha (Useful) | Useful |
| Manchester | Saudi Arabia | Jeddah (Useful), Madinah (Useful) | Useful *(was Mixed under Batch A's v1 grades — RIS-001 downgraded Madinah)* |
| Birmingham | India | Mumbai (Useful), Amritsar (Useful) | Useful *(was Mixed under Batch A's v1 grades — RIS-001 downgraded Amritsar)* |
| Birmingham | Pakistan | Lahore (Useful), Islamabad (Useful) | Useful |
| Birmingham | Saudi Arabia | Madinah (Useful) | Useful *(this is `birmingham-madinah`, a separate route record from `manchester-madinah` with zero depth categories — unaffected by RIS-001, was never Strong)* |
| Heathrow | India | Bengaluru (Strong), Delhi (Strong), Mumbai (Strong) | **Strong** *(was Mixed — Fare Coverage Expansion Batch B gave Bengaluru its second depth category, so all three of Heathrow's India destinations are now individually Strong)* |
| Heathrow | Qatar | Doha (Useful) | Useful |
| Heathrow | Saudi Arabia | Jeddah (Useful) | Useful *(was Strong — RIS-001 found Jeddah's fare observation has never had a matching Deal card, so it fails the visible-content gate)* |
| Heathrow | Bangladesh | Dhaka (Useful), Sylhet (Useful) | Useful |
| Gatwick | India | Ahmedabad (Strong), Amritsar (Strong) | **Strong** *(was Useful — Fare Coverage Expansion Batch B gave both destinations their second depth category)* |
| Glasgow | UAE | Dubai (Useful) | Useful |
| Edinburgh | UAE | Dubai (Useful) | Useful |
| Newcastle | UAE | Dubai (Useful) | Useful |
| Leeds Bradford | India | Amritsar (Useful) | Useful |
| Leeds Bradford | Pakistan | Islamabad (Useful) | Useful |

**Four country nodes changed under RIS-001, all downgrades, none manually set:**
- **Manchester's India** (the country shown by default context on the homepage Atlas alongside the Manchester origin) — **Strong → Mixed**. This was the specific, named consequence the RIS-001 review set out to fix: the "knows this country well" claim was leaning on Amritsar and Ahmedabad reading as strong as Delhi and Mumbai, when they were not.
- **Manchester's Saudi Arabia** — Mixed → Useful (Madinah no longer strong).
- **Birmingham's India** — Mixed → Useful (Amritsar no longer strong).
- **Heathrow's Saudi Arabia** — Strong → Useful (a **single-destination** country, so this was a direct Strong→Useful move, not via Mixed — Jeddah was the sole destination and is no longer Strong).

No country moved in the upward direction under RIS-001 alone, and no country becomes "Strong" through a single strong route while a sibling in the same group is weaker. The one exception at the time, Manchester's UAE, is a **single-destination** country where "every destination is Strong" is trivially true because there's only one destination, and that destination (Dubai) itself clears RIS-001's stricter bar on its own merits (fare + baggage, baggage being the substantive category) — see the RIS-001 addendum for the honest limitation this still carries.

**Two country nodes then moved upward under Fare Coverage Expansion Batch B** (6 August 2026, after RIS-001) — **Heathrow's India (Mixed → Strong)** and **Gatwick's India (Useful → Strong)** — both because every one of that airport's India destinations became individually Strong once the batch's new fare observations gave each its second depth category. Neither is the single-destination exception described above: Heathrow's India group has three destinations (Bengaluru, Delhi, Mumbai) and Gatwick's has two (Ahmedabad, Amritsar), and the conservative rule genuinely requires — and got — every one of them individually Strong before the country aggregate followed. See the Batch B addendum for the full account.

---

## 4. Six launch-route readiness

Audited to the same standard as every other route — **not upgraded for being launch priorities.**
Recomputed under RIS-001 (6 August 2026) — three of the six were Strong under the previous
(Batch A / v1) grades; two of those three are now Useful.

| Route | Grade | Genuinely meets the strongest standard? | Exact missing work, if any |
|---|---|---|---|
| Manchester–Lahore | **Strong** | Yes. | None for this grade — fare, Book-By and baggage give it genuine breadth and diversity, and its fare is visibly rendered. |
| Manchester–Islamabad | **Strong** | Yes. | None for this grade — fare and Book-By, visibly rendered. |
| **Manchester–Dubai** | **Strong** | **Mechanically yes; not without a caveat.** | Fare + baggage (baggage is the substantive category) clears all three RIS-001 gates. The residual concern from the earlier content-depth review — thin, bare-name airline guidance with no per-airline detail — is real but not something RIS-001's page-template-grounded checks can currently measure; see the RIS-001 addendum for why this is reported honestly rather than forced to fail. |
| **Birmingham–Amritsar** | **Useful** *(was Strong under Batch A)* | **No.** | Fare, Book-By and warning (3 categories, 2 substantive) clear Gates 1 and 2 — but this is a **connecting** route with no `connectingAlternative` block at all, so RIS-001's visible-content gate fails: nothing on the page explains how the connection actually works. A real, sourced hub/stops/journey-time block (matching the depth every other connecting route in this batch already has) would close this. |
| **Manchester–Madinah** | **Useful** *(was Strong under Batch A)* | **No.** | Exactly `connectingAlternative` + a single fare check — the specific combination RIS-001's diversity gate rules out. A genuine third category (baggage, an investigated warning, or per-airline verification) would close this. |
| **Manchester–Doha** | **Useful** | **No.** | Currently has exactly one depth category (fare only, now two dated observations) — never broad enough to clear Gate 1, regardless of RIS-001. Route Completion Batch 1 (August 2026) audited this route specifically and could not honestly add a second: Qatar Airways' own baggage page is not accessible from this environment (confirmed 403), Manchester Airport's own Qatar Airways page explicitly has no baggage figure, a per-airline `airlineVerifications` entry would duplicate the existing route-level claim on this single-carrier route, no genuine warning exists, and Book-By priority is a founder decision. See the Batch 1 completion record after §7 for the full account. |

**Verdict: 3 of the 6 soft-launch routes genuinely meet RIS-001's stricter standard — Manchester–Lahore, Manchester–Islamabad and, with the content-depth caveat above, Manchester–Dubai.** Birmingham–Amritsar and Manchester–Madinah were Strong under Batch A's grades and are honestly Useful under RIS-001 — neither was downgraded to make a point; both simply no longer clear a bar that was tightened for a real, documented reason. **Manchester–Doha remains the one gap that was never close** — every avenue this project's tooling could research on its own is exhausted, and closing it needs either a genuine founder decision (Book-By priority, assigned only if editorially justified) or a human editor with unrestricted browser access confirming a real, route-specific Qatar Airways baggage fact — see "Protecting the Doha decision" after the Batch 1 completion record.

---

## 5. Fare-tracking coverage truth

Unaffected by the route-threshold correction — fare-tracking coverage is a separate computation (`getPublishableObservationsByRoute()`) that never depended on `computeRouteIntelligenceLevel()`. Updated 6 August 2026, most recently after Fare Coverage Expansion Batch B.

- **Exact number of routes with any publishable observation:** 23 of 32 (72%) — up from 13 after Fare Coverage Expansion Batch B added 10 new routes' worth of evidence.
- **Exact number with recent (≤60 day), methodology-compliant observations:** 23 of 32 — every currently-publishable observation happens to also be fresh.
- **Exact number with a customer-visible fare (a real priced `Deal` card, not just an archive entry):** 22 of 32 (69%). The one gap is London Heathrow–Jeddah, which has a publishable observation but no matching flight-only Economy `Deal` — pre-dates Batch B, out of its scope (see the evidence-completeness audit above).
- **Total raw entries in the archive:** 51 (`data/fare-observations.ts` — 41 before this batch, +10 new), of which 23 routes' worth pass `isPubliclyPublishable()` (requires both `departureDate` and `returnDate` — a Truth Reset requirement the original 18 entries predate).
- **Soft-launch coverage:** 6 of 6 soft-launch routes now have at least one publishable fare observation — a separate fact from §4's "meets the Strong bar," since a fare check is only one of the two-or-more categories now required.
- **Did "Fares we're tracking" imply broader coverage than exists?** It did before this phase; already fixed — see §7's implementation note. Wording is live-computed (see below), so it updates automatically with no further code change as new observations are added.
- **Do empty/thin categories look abandoned?** No — this was already handled correctly before this phase. `NoFareFallback` ("We haven't logged a tracked fare for {city} yet") renders wherever a route/destination/airport/cabin has zero observations, with a Trip.com comparison link where one exists. Nothing was found to fix here.
- **Is observation age clear?** Yes — every fare-rendering surface (`DealCard`, `FareHistoryPanel`, `BookByCountdown`) already uses the shared 3-tier freshness model (`lib/freshness-thresholds.ts`: fresh ≤60 days, ageing ≤180 days, stale beyond) with visible de-emphasis and explicit "this is old" copy for stale observations.
- **Is the manual-verification methodology explained clearly?** Yes, on `/deals` itself and in `docs/project-control/FARE_OBSERVATION_ARCHIVE.md` — the hero already linked "Read our standards" before this phase, and that page's own content is accurate and unaffected by this audit.
- **A limitation worth naming (raised in the product-truth review, not fixed here):** `getPublishableObservationsByRoute()` gates on date-completeness and current route status, but not on freshness — a route whose only publishable observation had gone stale (>180 days, per `lib/freshness-thresholds.ts`) would still count toward the "N of 32 routes" figure on `/deals`, since staleness only affects *display* styling elsewhere, not this count. Today this is moot — all 23 publishable observations are fresh — but the wording doesn't self-enforce freshness going forward. Not changed in this PR (it's a pre-existing property of a function used the same way elsewhere, e.g. Book-By's Verified Check callout, not something this phase introduced); flagged for a future hardening pass if it becomes a real gap.
- **A second limitation surfaced by Fare Coverage Expansion Batch A (6 August 2026):** most of the 7 routes added in that batch (Delhi, Mumbai, Ahmedabad, Manchester-Amritsar, Doha, Madinah) had **no matching `Deal` entry in `data/deals.ts`** for a Manchester/Birmingham-departure Economy fare — fixed the same day by the evidence-completeness audit's 7 new Deal entries (see "Part 3 — Customer-visible fare coverage" below). Fare Coverage Expansion Batch B (6 August 2026) closed the equivalent gap for 8 of its own 10 new routes with new Deal entries at collection time, rather than as a follow-up audit — see the Batch B addendum.

**Recommended and implemented wording** (using the real, live-computed count rather than a hand-typed number that could drift):

> "We're currently tracking fares on **23 of our 32 routes** — coverage is being expanded gradually using manually verified observations, not a live price feed."

This is now the opening line of `/deals`'s hero, with the count and `32` both computed live from `routes.length` and `getPublishableObservationsByRoute()` — the same functions this audit itself calls — so the sentence can never silently drift out of sync with reality the way a hand-typed figure could. No code change was needed to reflect Fare Coverage Expansion Batch A's or Batch B's new observations here — the live computation already picked them up (this document's own "13" example simply became "23" as the underlying data changed, exactly as designed).

---

## 6. Exact gaps by route

Only routes with a genuine, specific, actionable gap are listed (Strong routes with no gap are omitted; see §3 for their full record).

| Route | Gap | What would close it |
|---|---|---|
| **Manchester–Doha** | Soft-launch route with exactly one depth category (a fresh fare check). Batch 1 confirmed no second category is currently addable: Qatar Airways' baggage page is inaccessible, a duplicate `airlineVerifications` entry on this single-carrier route wouldn't be genuine depth, and no real warning exists. | A founder Book-By decision, or a human editor checking Qatar Airways' own baggage page directly with unrestricted browser access. |
| Manchester–Dubai *(closed 6 August 2026, and its own DealCard badge inconsistency separately fixed the same day — kept here only as a historical "thin despite looking complete" example, not an open gap)* | Was Strong (fare + baggage) with the rendered `DealCard` showing a "DIRECT FLIGHT" badge directly above this fare's own "connecting via Bahrain" description. **Fixed same day** — `getDealFareDirectnessLabel()` now derives the badge from the specific fare's own directness; see `FARE_OBSERVATION_ARCHIVE.md`'s Manchester–Dubai closed-observation entry for the full account. | Closed — no longer a gap. |
| Heathrow–Bengaluru *(closed 6 August 2026 — Fare Coverage Expansion Batch B, now Strong)* | Was: airline service confirmed by two independent primary sources (one category), no fare observation. | Closed — a fresh, dated fare observation (`obs-lhr-blr-economy-20260806-8w-v1`) gave it a second, genuine category. |
| Gatwick–Ahmedabad / Gatwick–Amritsar *(closed 6 August 2026 — Fare Coverage Expansion Batch B, now Strong)* | Was: each had a genuinely researched, sourced warning (one category) but nothing else. | Closed — a fresh, dated fare observation on each gave both a second category. |
| Leeds Bradford–Islamabad | Now has a fresh fare observation alongside its existing warning (2 categories) — but it's a connecting route with no `connectingAlternative` block, so RIS-001's visible-content gate still blocks Strong. | A real, sourced hub/stops/journey-time block would close this. |
| Manchester–Karachi | Direct claim not confirmed by any primary source; secondary aviation-news reporting only. | A route-specific PIA or airport-schedule primary source (this is the harder, prerequisite-level gap — no depth category can substitute for it). |
| Birmingham–Lahore | Same — no primary source confirms a direct Birmingham–Lahore PIA service. | A route-specific primary source. |
| Birmingham–Islamabad | Conflicting secondary sources; genuinely unresolved. | A route-specific primary source that resolves the conflict either way. |
| Manchester–Sylhet | Direct, disclosed contradiction between Manchester Airport's own page ("not flying to this location") and Biman's official Manchester–Dhaka-via-Sylhet notice. | A Biman-direct or Manchester Airport-direct source that resolves the contradiction. |
| Heathrow–Dhaka / Heathrow–Sylhet | Real, current flight-tracking evidence exists, but the exact stop pattern (nonstop vs. via Sylhet) is unconfirmed by any primary source. | A Biman or Heathrow route-specific source stating the stop pattern directly. |
| 6 one-category Useful routes, all closed to exactly one category by Fare Coverage Expansion Batch B (Heathrow–Doha, Leeds Bradford–Amritsar, Manchester–Dhaka, Manchester–Jeddah, Birmingham–Madinah, Birmingham–Mumbai) | Each now has a fresh, dated fare observation — its only depth category. The four connecting ones among them (Leeds Bradford–Amritsar, Manchester–Dhaka, Manchester–Jeddah, Birmingham–Madinah, Birmingham–Mumbai) would also need a `connectingAlternative` block even with a second category, per RIS-001's visible-content gate. | A second substantive category (Book-By, an investigated warning, baggage guidance, or per-airline verification) — and, for the connecting ones, a genuine `connectingAlternative` block. |
| 3 zero-category Useful routes (Glasgow/Edinburgh/Newcastle–Dubai) — outside Batch B's queue since Priority 1+2 already filled its 10 slots | Verified direct, correctly described, but carry none of the six Strong-qualifying depth categories. | Any two of: a fare observation, a per-airline verification entry, Book-By priority, a newly-investigated warning, or baggage guidance. |

**Routes that appear visually complete but have thin underlying intelligence** (the specific question the brief asked): **Manchester–Dubai is now the clearest example of the inverse problem** — a route that genuinely closed its depth gap (fare + baggage, both real and evidenced) but whose rendered page still shows a real inconsistency (the "DIRECT FLIGHT" badge sitting above a "connecting via Bahrain" fare description) that the grade alone doesn't fix. Meeting the threshold and reading cleanly to a customer are not automatically the same thing — see the Batch 1 completion record's addendum. **Manchester–Doha** is a soft-launch route that looked complete (verified, fresh fare, Trip.com link) but has only one kind of evidence behind it, and Batch 1 confirmed every other avenue this environment can research is currently exhausted for it. Heathrow–Bengaluru was the clearest "confirmed but un-priced" case until Fare Coverage Expansion Batch B closed it (6 August 2026) — now Strong. Heathrow–Doha is the closest remaining example of the same pattern: verified, now has one dated fare check, but no second category yet.

**Routes with stale or weak evidence:** none of the 32 routes currently have a *stale* `verification` record (every `reviewDueDate` is still in the future as of 6 Aug 2026) — but 6 of them have `unverified` status specifically because no primary source was ever found, not because a once-good source went stale (Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad, Heathrow–Dhaka, Manchester–Sylhet, Heathrow–Sylhet — the same 6 Fare Coverage Expansion Batch B deliberately excluded from its queue, since a fare observation against an unverified route can never become publishable). That's a different, harder gap (needs new evidence, not re-verification of old evidence).

---

## 7. Recommended route-completion batches

Based on the actual data above, not a generic template:

- **Batch 1 — close the two soft-launch gaps.** ✅ Run August 2026, wording corrected same month after a product-truth review — see the full completion record immediately after this section. Manchester–Dubai gained one genuine category (baggage guidance) and needs one manual fare check to satisfy the code-level Strong threshold — not the same thing as being content-complete; see the review's findings below. Manchester–Doha could not gain a second category through any avenue this batch could research — its remaining gap needs either a genuinely-justified founder Book-By decision or human browser access this environment doesn't have, and even the latter may only surface Qatar's generic policy, not a route-specific fact.
- **Batch 2 — the other "confirmed but thin" Strong-adjacent routes.** ✅ **Done, in two parts.** Manchester–Amritsar and Manchester–Ahmedabad closed 6 August 2026 via Fare Coverage Expansion Batch A (though RIS-001, the same week, found their evidence too thin to keep Strong — see §3). Heathrow–Bengaluru and both Gatwick routes closed 6 August 2026 via Fare Coverage Expansion Batch B — all three now genuinely Strong. Remaining: Leeds Bradford–Islamabad, which gained a fare observation in Batch B but stays Useful under RIS-001's visible-content gate (connecting route, no `connectingAlternative` block).
- **Batch 3 — the three unresolved Pakistan primary-source gaps.** Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad — all need the same kind of evidence (a route-specific PIA or airport-schedule primary source) before any depth category can even apply, so investigating them together is efficient. Deliberately excluded from Fare Coverage Expansion Batch B's queue, since a fare observation against an unverified route can never become publishable.
- **Batch 4 — the four unresolved Bangladesh primary-source gaps.** Manchester–Sylhet, Heathrow–Dhaka, Heathrow–Sylhet (stop-pattern confirmation), grouped with the Pakistan batch if convenient, or separately given they need Bangladesh-specific sources (Biman, Manchester Airport, Heathrow). Also excluded from Batch B for the same unverified-status reason.
- **Batch 5 — the remaining zero/one-category Useful routes.** ✅ **Mostly done 6 August 2026 via Fare Coverage Expansion Batch B** — Heathrow–Doha, Leeds Bradford–Amritsar, Manchester–Dhaka, Manchester–Jeddah, Birmingham–Madinah and Birmingham–Mumbai all gained a fare observation, their first depth category (though only Heathrow–Doha, being direct, is now one category away from Strong on its own — the four connecting ones among them also need a `connectingAlternative` block first, per RIS-001's visible-content gate). Remaining: the three single-destination Dubai routes (Glasgow/Edinburgh/Newcastle) were outside Batch B's 10-route queue since Priority 1+2 already filled it — still zero-category, still open.

**Suggested order of work, updated after Batch B:** Batch 3 → Batch 4 (the two remaining primary-source gaps, now the largest genuinely open work) alongside a smaller follow-up closing Glasgow/Edinburgh/Newcastle–Dubai's fare gap and adding `connectingAlternative` blocks to the four connecting routes Batch B left at one category. Batches 1, 2 and most of 5 are done.

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

## Addendum (6 August 2026): Fare Coverage Expansion Batch A closes 7 more routes, two move to Strong

Fare Coverage Expansion Batch A (`FARE_OBSERVATION_ARCHIVE.md`) ran in full the same day, after
Manchester–Dubai and Manchester–Lahore: Manchester–Islamabad, Manchester–Delhi, Manchester–Mumbai,
Manchester–Ahmedabad, Manchester–Amritsar, Manchester–Doha, Manchester–Madinah and
Birmingham–Amritsar each received a fresh, dated fare observation with an explicit `fareDirectness`
value. Full detail for each lives in `FARE_OBSERVATION_ARCHIVE.md`'s closed-observation entries and
`docs/project-control/fare-evidence/*-2026-08-06.md`; this addendum records the effect on this
document's own numbers, which is real and needs stating plainly rather than left to silently drift.

**Two mechanical grade changes, both evidence-driven, neither manually overridden:**
- **Manchester–Amritsar** and **Manchester–Ahmedabad** both moved from Useful to Strong. Both were
  this document's own named examples of a `connectingAlternative`-only route (see the Revision note
  at the top) — exactly one depth category, nothing else. A fresh fare observation on each
  (`obs-man-atq-economy-20260806-8w-v1`, `obs-man-amd-economy-20260806-8w-v1`) gave each route a
  genuine second category. The two-category threshold itself was not touched.

**Headline numbers updated throughout this document:** Strong 10→12 (31%→38%), Useful 22→20
(69%→63%), routes with any publishable fare observation 9→13 (28%→41%), category prevalence for
fare evidence 9→13. Every other category's prevalence (airline-verif 4, connecting-alt 5, Book-By 5,
warning 5, baggage 6) is unchanged — this batch only added fare evidence, nothing else.

**Both of the two claims below in this original addendum were found wrong by the 6 August 2026
evidence-completeness audit (see the new addendum after this one) and are struck through rather than
silently deleted, so the correction is traceable:**

- ~~`bhx-atq-economy`'s `DealCard` badge fixed as a side effect... the badge now reads "Connecting"
  instead of no badge at all.~~ **Wrong.** The observation this claim rested on only reviewed the
  outbound leg; corrected to `fareDirectness: 'unknown'`, and the badge reverted to no badge. See the
  audit addendum.
- ~~Manchester–Doha's fresh check found a real nonstop Qatar Airways result — the first observation
  anywhere in the archive with an explicit `fareDirectness: 'direct'`.~~ **Wrong for the same
  reason** — the return leg was never opened; corrected to `'unknown'`. There is currently no
  confirmed-both-ways-direct observation anywhere in the archive.

**A pattern that was true then and remains true now:** of the 8 routes done under the leaner Batch A
process (Islamabad through Birmingham–Amritsar), only Birmingham–Amritsar had an existing `Deal`
entry — Delhi, Mumbai, Ahmedabad, Manchester-Amritsar, Doha and Madinah had **no matching Economy
`Deal` entry at all**, so their real, dated fare evidence had nowhere to render. **This has since
been fixed** — see the audit addendum's Part 3 for the full account of adding 7 new, evidence-backed
Deal entries.

No grade was manually raised or lowered in this addendum. Every number above is a live-computed
consequence of real, reviewed evidence — the same standard applied to Manchester–Dubai's own
promotion, and to the correction that followed it.

---

## Addendum (6 August 2026): Batch A evidence-completeness and customer-visibility audit

A founder-requested final review of the Batch A branch, run before any PR was opened, covering three
questions: was the round-trip evidence genuinely complete for every observation; do the two newly
promoted Strong routes actually read as "JetStash knows this route well" to a visitor; and does the
"13 of 32" fare-tracking count reflect what a customer can actually see.

### Part 1 — Evidence completeness (full detail: `FARE_OBSERVATION_ARCHIVE.md`'s own audit section)

**8 of the 10 Batch A observations had only ever reviewed the outbound leg**, despite `fareDirectness`
originally being recorded as if the round trip had been confirmed. Corrected to `fareDirectness:
'unknown'` on all 8 (Islamabad, Delhi, Mumbai, Ahmedabad, Amritsar, Doha, Madinah,
Birmingham-Amritsar). Only Manchester–Dubai and Manchester–Lahore have genuine, confirmed
round-trip evidence. This does not change any route's Atlas grade (grading only checks that a
publishable fare observation exists, never its directness) or the 41-entry/13-of-32-route totals.

### Part 2 — Content-depth review of the two newly promoted routes

**Manchester–Amritsar and Manchester–Ahmedabad's exact qualifying categories:** `connectingAlternative`
+ fare — the minimum possible combination, two of six, nothing more. Both were this document's own
former textbook examples of a route with exactly one category before Batch A.

**Rendered page review (both routes), against the founder's checklist:**

| | Amritsar | Ahmedabad |
|---|---|---|
| Route overview | ✅ Real, specific intro (names the actual hub pattern and comparable direct alternatives) | ✅ Same |
| Airline guidance | ⚠️ Airlines named (3–4), no per-airline depth or comparison | ⚠️ Same |
| Airport/transfer guidance | ✅ Genuine `connectingAlternative` block — hub airports, typical stops, typical journey time | ✅ Same |
| Baggage guidance | ❌ None | ❌ None |
| Warnings | — None exist (correctly not fabricated) | — Same |
| Booking guidance | ✅ Real peak-period and booking-window copy (Baisakhi/Diwali) | ✅ Real peak-period copy (Navratri/Diwali) |
| Visible fare intelligence | ✅ Now shown (Part 3 fix), with an honest "return leg not confirmed" caveat | ✅ Same |
| Sources/review evidence visibly cited | ❌ No visible source citation for the connecting-route facts (connecting routes don't render a verification block the way direct routes do) | ❌ Same |

**Verdict: these pages are not empty or fabricated — the connecting-route guidance and booking
timing are genuine, specific, and useful.** But they clear "Strong" on the bare minimum two
categories, one of which (fare) is now honestly weaker post-correction, and there is no visible
per-airline depth, no baggage guidance, and no visible source citation for a visitor to check.
**A careful visitor would likely read these pages as genuinely useful, but not as clearly earning
"JetStash knows this route well"** over "useful route guidance available" — the grade currently
reads more confident than the page does.

**Per instruction, neither grade was manually overridden in either direction.** This confirms Route
Intelligence Scoring v2 (flagged in `ROADMAP.md`/`DECISIONS.md`, 6 August 2026, after the original
Dubai promotion) is no longer a theoretical future concern — it is now a live, reproducible gap: a
route can reach the two-category bar entirely through `connectingAlternative` + a single, now
`'unknown'`-directness fare, with zero baggage, warning, or airline-verification depth, and still
show the platform's strongest confidence label.

**Smallest general safeguard proposed (not implemented in this audit, per instruction not to weaken
or hand-tune the truth standard to protect the batch claim):** require a visible content-completeness
floor alongside the existing two-category count — for example, a route qualifies for Strong only if
its two-or-more categories are not *exclusively* `connectingAlternative` + fare (the specific
combination now shown to read thin), or only if at least one of its categories is baggage, warning,
or airline-verification depth rather than the two "cheapest to obtain" categories alone. This is a
proposal for a founder decision, consistent with the existing Route Intelligence Scoring v2 flag —
not something this audit resolves unilaterally.

**India country-level claim ("JetStash knows this country well," Manchester context):** correctly
computed under the existing conservative rule (Strong only if every destination in the country is
Strong) — all 4 of Manchester's India destinations (Delhi, Mumbai, Amritsar, Ahmedabad) are now
individually Strong. But 2 of those 4 (Delhi, Mumbai) reached Strong through 3 genuinely broader
categories each (`connectingAlternative` + baggage + fare), while the other 2 (Amritsar, Ahmedabad)
reached it through the bare 2-category minimum just reviewed above. The country-level aggregation
treats all four identically, so **the country-confidence claim is technically correctly aggregated
but is inflated in practice** — it leans on two borderline routes reading as equally strong as two
genuinely deep ones. This is the same Route Intelligence Scoring v2 gap, compounded at country level.
Not fixed here, for the same reason: fixing it would mean changing the aggregation or threshold
logic, which is exactly the manual-override / truth-standard-weakening this audit was told not to do
to protect the batch.

### Part 3 — Customer-visible fare coverage

**Full table, all 13 routes currently counted in "13 of 32":**

| Route | Publishable observation | Route page shows fare | `/deals` shows fare | Matching Economy Deal | Displayed directness correct | Customer can see it's tracked |
|---|---|---|---|---|---|---|
| Manchester–Lahore | ✅ | ✅ | ✅ | `man-lhe-economy` | ✅ Connecting (genuine full evidence) | ✅ |
| Manchester–Islamabad | ✅ | ✅ | ✅ | `man-isb-economy` *(added this audit)* | ✅ No badge (fails closed, correct) | ✅ |
| Heathrow–Delhi | ✅ | ✅ | ✅ | `lhr-del-economy` | ✅ No badge (fails closed, correct) | ✅ |
| Birmingham–Amritsar | ✅ | ✅ | ✅ | `bhx-atq-economy` | ✅ No badge (corrected from an unsupported "Connecting") | ✅ |
| Manchester–Dubai | ✅ | ✅ | ✅ | `man-dxb-economy` | ✅ Connecting (genuine full evidence) | ✅ |
| Heathrow–Jeddah | ✅ | ❌ | ❌ | **None** — only Business and a bundled Umrah package exist | N/A | ❌ **Invisible** |
| Heathrow–Mumbai | ✅ | ✅ | ✅ | `lhr-bom-economy` | ✅ (pre-existing, unaffected) | ✅ |
| Manchester–Doha | ✅ | ✅ | ✅ | `man-doh-economy` *(added this audit)* | ✅ No badge (two mismatched sources, fails closed correctly) | ✅ |
| Manchester–Delhi | ✅ | ✅ | ✅ | `man-del-economy` *(added this audit)* | ✅ No badge (fails closed, correct) | ✅ |
| Manchester–Mumbai | ✅ | ✅ | ✅ | `man-bom-economy` *(added this audit)* | ✅ No badge (fails closed, correct) | ✅ |
| Manchester–Amritsar | ✅ | ✅ | ✅ | `man-atq-economy` *(added this audit)* | ✅ Connecting (safe route-level fallback — route confirmed connecting, source matches verified operator) | ✅ |
| Manchester–Ahmedabad | ✅ | ✅ | ✅ | `man-amd-economy` *(added this audit)* | ✅ Connecting (same safe fallback) | ✅ |
| Manchester–Madinah | ✅ | ✅ | ✅ | `man-med-economy` *(added this audit)*, alongside the pre-existing bundled Umrah package (unaffected) | ✅ No badge (fails closed, correct) | ✅ |

**Before this audit: 5 of 13 routes had no customer-visible fare card at all** (Islamabad, Delhi,
Mumbai, Ahmedabad, Amritsar, Doha, Madinah — 7 routes, all Batch A) **plus a real, load-bearing
on-page contradiction**: every one of those 7 routes' pages simultaneously rendered `FareHistoryPanel`
(showing the real archived fare) and `NoFareFallback` ("We haven't logged a tracked fare for
{route}... yet") in the same page, because the two components are driven independently — one by raw
observations, the other purely by `Deal` presence. Confirmed live on `/routes/manchester-amritsar`
before the fix.

**Truth model implemented: Option A** — 7 new, evidence-backed `Deal` entries added (Islamabad,
Delhi, Mumbai, Ahmedabad, Amritsar, Doha, Madinah), each verified safe before being added: with every
Batch A observation's `fareDirectness` now `'unknown'` post-Part-1-correction,
`getDealFareDirectnessLabel()` either fails closed to no badge, or falls back to the route's own
status only where every contributing fare source genuinely matches a verified route operator and the
route is not itself claiming direct service — confirmed for all 7 by a dry run against the real
function before any entry was written, and reconfirmed live afterwards. None produces an unsupported
"Direct flight" claim; no Deal was invented without a real observation behind it; every entry
preserves its route's existing, unmodified Trip.com URL.

**Remaining gap, not fixed in this audit (out of Batch A's scope):** Heathrow–Jeddah has a
publishable Economy observation (`obs-lhr-jed-economy-20260728-8w-v1`, pre-dates Batch A entirely —
part of the original "Second recorded batch") but no matching flight-category Economy `Deal` — only
a Business deal and a bundled Umrah package exist for that airport/destination pair, and a bundled
deal never shows a flight-only fare by design. **This route is customer-invisible in the current
"13 of 32" count.** Flagged as a genuine follow-up; not fixed here because it predates and sits
outside Batch A, and this review was scoped to Batch A's own claim.

**Final counts:** 13 of 32 routes remain publishable (unaffected by any of this audit's corrections).
**12 of 13 are now genuinely customer-visible** (up from 5 of 13 before this audit). **1 of 13
(Heathrow–Jeddah) remains archive-only.**

### Part 4 — Scope confirmation

Confirmed clean: `data/routes.ts` (route verification facts), `data/booking-windows.ts` /
`lib/booking-intelligence.ts` (Book-By), `data/route-warnings.ts` (no warning invented), `data/fare-observations.ts`'s
`baggage` field (still `'not stated'` everywhere, never inferred), and `lib/booking-providers.ts`
(Trip.com URLs) all show zero diff from this audit — verified directly via `git diff --stat`, not
asserted. No secondary Turkey/UAE/Qatar route intelligence was promoted from connection evidence —
hub mentions (Istanbul, Doha, Abu Dhabi, Dubai) stay itinerary-level detail on the originating route,
never written into any other route's own facts.

No grade was manually raised or lowered anywhere in this audit. Every correction is either a data
fix (8 `fareDirectness` values, now honestly `'unknown'`) or an additive, verified-safe fix (7 new
Deal entries) — nothing was hidden or hand-tuned to protect the "10/10" or "13 of 32" claims.

---

## Addendum (6 August 2026): Route Intelligence Scoring v2 (RIS-001)

The "smallest general safeguard proposed (not implemented)" at the end of the evidence-completeness
audit above was exactly the gap this addendum closes. RIS-001 was scoped, audited and implemented the
same day, immediately after Batch A was merged and verified in production (`4a5134f`), and before any
further route batch was started — per the explicit founder sequencing: Batch A → RIS-001 → Batch B.

### Why v1 (the two-of-six rule) was not defensible as the final model

Two concrete, real examples proved the two-category count alone was not a reliable proxy for "this
page genuinely feels well researched": Manchester–Amritsar and Manchester–Ahmedabad reached Strong on
`connectingAlternative` + a single, now-`'unknown'`-directness fare — the two cheapest categories to
obtain, with no baggage, warning or per-airline depth behind either page (see Part 2 of the audit
addendum above). A third case, Birmingham–Amritsar, showed the inverse failure mode: it carried three
categories (fare, Book-By, warning) yet had **no `connectingAlternative` block at all** on a route that
is itself connecting — genuinely broad by count, but silent on the one thing a traveller booking a
connecting itinerary most needs explained. Counting categories, without asking *which* categories or
whether the customer-facing page actually renders the resulting content, could not distinguish either
case from a genuinely well-evidenced route like Heathrow–Delhi (airline-verification + fare + Book-By
+ baggage) or Manchester–Lahore (fare + Book-By + baggage).

### The v2 model: three independent, ordered gates

All three gates are evaluated in `computeRouteIntelligenceLevel()` (`lib/atlas-network-data.ts`) in
sequence — a route must pass all three to be graded Strong; failing any one gate yields Useful. No
gate is scored independently as a partial credit; there is no "2.5 out of 3."

**Gate 1 — breadth (unchanged from v1).** `depthCategoryCount(route) >= 2`, counted across the same
six categories §8 below still lists. This is the evidence-existence floor: a route needs more than one
isolated fact.

**Gate 2 — diversity (new).** At least one of the route's qualifying categories must come from the
"substantive" set — airline verification, Book-By priority, an investigated warning, or baggage
guidance — rather than being composed *entirely* of the two cheapest-to-obtain categories
(`connectingAlternative` and a fare observation). This is the direct, generalised implementation of
"do not allow fare + connectingAlternative alone to produce Strong": it doesn't name Amritsar or
Ahmedabad specifically, it rules out that *combination* for any route, present or future.

**Gate 3 — visible-content baseline (new).** Two checks, both grounded in exactly what
`app/routes/[slug]/page.tsx` conditionally renders — not an abstract data-completeness rule:
1. **Visible fare, always required.** At least one `Deal` (`data/deals.ts`) matching the route's
   airport/destination pair must satisfy `hasTrackedFare()` — i.e. `getFareRangeSummary()` returns a
   non-null, customer-visible range or single check. A route with a publishable fare observation that
   never surfaces on the page (no matching `Deal`, or only a bundled-package `Deal`) does not count —
   this is exactly the Heathrow–Jeddah defect the evidence-completeness audit found in Part 3 above,
   now enforced structurally instead of only reported.
2. **Connecting-route transfer guidance, required only where it applies.** For connecting routes only
   (`!route.isDirect`), `route.connectingAlternative` must also exist. Direct routes are never checked
   against this — "a direct route may not need transfer guidance" is honoured literally, not as a
   caveat bolted onto a generic rule.

**What was deliberately not added, and why.** A fourth gate requiring a visible on-page source
citation was considered and rejected as structurally unworkable, not merely difficult: `route.verification`
and `AirlineVerification` sourcing is never rendered as an inline citation anywhere except the rare
2-corridor Route Status ledger panel, and `ConnectingAlternative` has no source field in its type at
all. Requiring visible citation would either duplicate the existing verification prerequisite (for
direct routes) or be permanently unsatisfiable (for connecting routes) — inventing new UI to satisfy a
scoring rule would be filler in service of a score, exactly what this task was told not to do. The
concern is folded into the existing "verified route/service truth" prerequisite instead of made a
separate, uncloseable gate.

**Manchester–Dubai was deliberately not forced to fail.** The brief named Dubai, alongside Amritsar and
Ahmedabad, as a route that "technically satisfies the current model" while still feeling thin (weak
per-airline guidance, per the content-depth review above). Dubai's fare + baggage combination is
structurally the same pattern as Heathrow–Mumbai's airline-verification + fare — a genuine, substantive
second category, not the connectingAlternative-plus-fare pattern Gate 2 targets — so it clears all
three gates on its own merits. Writing a rule specifically shaped to also fail Dubai would have meant
designing the model backward from a predetermined answer for one named route, which the brief itself
warned against ("do not optimise the model to protect current Strong routes" cuts both ways — it also
means not punishing one to prove a point). Dubai's thin-airline-guidance concern is real and unresolved
by RIS-001; it is reported here as an honest limitation rather than silently fixed or silently ignored.

### Full 32-route recomputation

Five routes move Strong → Useful. Zero routes move Useful → Strong (RIS-001 only tightens the bar; a
model that also invented new upgrades in the same pass would be much harder to trust as neutral). Every
other route's grade is unchanged — full detail for all 32 is in §3's audit table and route-index table
above, both already updated to the v2 grades; this section lists only what changed and why.

| Route | v1 (Batch A) grade | v2 (RIS-001) grade | Gate failed | Why |
|---|---|---|---|
| **Manchester–Amritsar** | Strong | **Useful** | Gate 2 (diversity) | `connectingAlternative` + fare only — the exact pattern Gate 2 rules out. |
| **Manchester–Ahmedabad** | Strong | **Useful** | Gate 2 (diversity) | Same pattern as Amritsar. |
| **Manchester–Madinah** | Strong | **Useful** | Gate 2 (diversity) | Same pattern again — `connectingAlternative` + a single fare check, nothing substantive. |
| **Birmingham–Amritsar** | Strong | **Useful** | Gate 3 (visible content — connecting depth) | Three categories (fare, Book-By, warning) clear Gates 1–2, but the route has no `connectingAlternative` block at all despite being a connecting route — nothing on the page explains how the connection works. |
| **Heathrow–Jeddah** | Strong | **Useful** | Gate 3 (visible content — visible fare) | Airline-verification + a publishable fare observation clear Gates 1–2, but the only matching `Deal` entries are a Business fare and a bundled Umrah package — no flight-only Economy `Deal` exists, so the fare never renders as a price anywhere a visitor can see it. Exactly the defect Part 3 of the evidence-completeness audit flagged as a customer-visibility gap; RIS-001 now enforces it as a grading gate rather than leaving it as a reported footnote. |

**Routes confirmed to stay Strong (7 of 32), and why each clears all three gates:**

| Route | Qualifying categories | Substantive category (Gate 2) | Visible fare (Gate 3) |
|---|---|---|---|
| Heathrow–Delhi | Airline-verif, fare, Book-By, baggage (4) | Airline-verif, Book-By, baggage | ✅ `lhr-del-economy` |
| Manchester–Dubai | Fare, baggage (2) | Baggage | ✅ `man-dxb-economy` |
| Manchester–Lahore | Fare, Book-By, baggage (3) | Book-By, baggage | ✅ `man-lhe-economy` |
| Heathrow–Mumbai | Airline-verif, fare (2) | Airline-verif | ✅ `lhr-bom-economy` |
| Manchester–Delhi | ConnectingAlternative, baggage, fare (3) | Baggage | ✅ `man-del-economy` |
| Manchester–Islamabad | Fare, Book-By (2) | Book-By | ✅ `man-isb-economy` |
| Manchester–Mumbai | ConnectingAlternative, baggage, fare (3) | Baggage | ✅ `man-bom-economy` |

### Country-aggregation consequences

`aggregateCountryIntelligence()` itself is unchanged — still conservative (Strong only if every
destination in the group is Strong; Mixed if any is Strong while another isn't; Useful if any is
Useful; otherwise Expanding). Recomputing it against the new route grades produces exactly **four**
real changes, all downgrades, confirmed directly against `buildAtlasAirports()`'s live output rather
than derived by hand:

| Airport → country | v1 aggregate | v2 aggregate | Why |
|---|---|---|---|
| Manchester → India | Strong | **Mixed** | Delhi and Mumbai stay Strong; Amritsar and Ahmedabad are now Useful — no longer uniformly Strong. |
| Manchester → Saudi Arabia | Mixed | **Useful** | Madinah (its only Strong destination) is now Useful; Jeddah was already Useful — nothing in the group is Strong any more. |
| Birmingham → India | Mixed | **Useful** | Amritsar (its only Strong destination) is now Useful; Mumbai was already Useful. |
| Heathrow → Saudi Arabia | Strong | **Useful** | Single-destination country (Jeddah only) — the country aggregate simply follows Jeddah's own downgrade. |

**Birmingham → Saudi Arabia is unchanged** (stays Useful) — `birmingham-madinah` is a separate route
record from `manchester-madinah` with zero depth categories in either model; it was never Strong and
is not affected by Madinah's downgrade on the Manchester side. Every other country/airport combination
— Pakistan, Bangladesh and Qatar at every airport, Manchester's UAE (Dubai, still Strong on its own
merits), and all groupings at Gatwick, Glasgow, Edinburgh, Newcastle and Leeds Bradford — is completely
unaffected.

### Migration risks considered

- **No manual override anywhere.** Every one of the five downgrades and four country-aggregate changes
  is a mechanical consequence of the same `computeRouteIntelligenceLevel()` function running against
  unchanged route/fare/deal data — confirmed by running the real function against all 32 routes and
  diffing its output before and after the code change, not asserted from the model design alone.
- **No route fact, fare value, Book-By rule or Trip.com link was touched** — confirmed via `git diff
  --stat`, scoped to `lib/atlas-network-data.ts` (the scoring function itself) and this document plus
  its associated tests.
- **Customer-facing wording risk:** the Strong/Useful copy on the Atlas widget and route pages already
  describes "JetStash knows this route well" vs. "useful route guidance available" — unchanged text,
  now attached to a stricter, more defensible bar. No wording overstates what the new model checks; if
  anything the risk ran the other way under v1 (wording promising more confidence than three of the
  formerly-Strong routes actually earned).
- **A route silently re-qualifying for Strong later without new evidence is not possible** — all three
  gates are pure functions of `data/routes.ts`, `data/fare-observations.ts`, `data/deals.ts` and
  `data/traveller-tips.ts`/`data/route-warnings.ts`/`lib/booking-intelligence.ts`; nothing about the
  code change introduces a way to flip a grade without a corresponding data change.
- **Test-suite risk:** two pre-existing tests in `tests/batch-a-evidence-audit.test.ts` asserted the
  old (v1) Amritsar/Ahmedabad Strong grade and the old India-country Strong aggregate as their expected
  values — both were written to document the *problem* this task was scoped to fix, so both needed
  rewriting to assert the corrected v2 outcome rather than being left failing or deleted.

### Six soft-launch routes under RIS-001

3 of 6 now genuinely meet the Strong bar (Manchester–Lahore, Manchester–Islamabad, Manchester–Dubai
with its reported caveat) — down from 5 of 6 immediately after Batch A. Birmingham–Amritsar and
Manchester–Madinah move to Useful for the reasons in the recomputation table above. Full detail,
including exact missing work for each non-Strong launch route, is in §4 above (already updated to
these grades).

---

## Addendum (6 August 2026): Fare Coverage Expansion Batch B — 10 routes, 3 mechanical upgrades

Sequenced after RIS-001 was merged and verified in production (`8b1d18d`), per the founder's own
ordering: Batch A → RIS-001 → Batch B. **RIS-001 itself was not touched during this batch** — every
grade change below is `computeRouteIntelligenceLevel()` running unchanged against new, real evidence.

### Queue derivation

Computed live from the real repository data (`routes`, `getPublishableObservationsByRoute()`,
`deals`), not by hand. Of 32 routes, 13 already had a publishable observation. Of the remaining 19,
**6 are `unverified`** (Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad, Heathrow–Dhaka,
Manchester–Sylhet, Heathrow–Sylhet) — a fare observation logged against an unverified route can never
become publishable (`isObservationPublishable()` requires status `'direct'` or `'connecting'`), so
these were excluded before queueing began, rather than have collection effort spent on routes that
could never benefit from it. That left 13 eligible untracked routes, and the stated priority order
(existing Deal with no observation, then highest-value South Asia/Gulf) filled all 10 slots without
needing the lower-priority tiers (remaining Manchester routes, Birmingham, Heathrow/Gatwick, secondary
airports) — every Priority 2 candidate happened to already be one of those categories.

### The 10 routes and their evidence

All 10 use the identical profile: 1 adult, Economy, GBP, return, depart 1 October 2026, return 15
October 2026 (8 weeks out / 14 nights — the same dates as Batch A's third round, checked the same
day). Results-list evidence only (no click-through), except Heathrow–Doha, where "Flight details" was
opened to confirm both flight numbers. Every one of the 10 had its outbound leg explicitly shown as 1
or more stops — none showed a nonstop outbound, so none tested the "direct" branch of this batch's
directness rule. Full detail and the exact search URL for each: `FARE_OBSERVATION_ARCHIVE.md`'s
Batch B section and `docs/project-control/fare-evidence/<route-slug>-2026-08-06.md`.

**Directness rule applied — a deliberate, narrower standard than Batch A's, not a reversal of it.**
Batch A's own convention (established by its evidence-completeness audit) treated every outbound-only
review as `'unknown'`, regardless of what the outbound itself showed — a conservative rule, still
correct for Batch A's own entries. Batch B's brief states a different, more precise rule: "either leg
confirmed connecting → connecting"; "return not reviewed or ambiguous → unknown" applies only when
there is nothing more specific to say. A confirmed-connecting outbound is real, positive evidence the
round trip is not fully nonstop, even without checking the return — so all 10 of Batch B's
observations are honestly recorded `fareDirectness: 'connecting'`, not `'unknown'`. Batch A's existing
`'unknown'` entries remain correct under Batch A's own convention; neither batch retroactively
corrects the other, since both are internally consistent with the evidence each collector actually
had.

| Route | Price | Airline | Routing | Deal added? |
|---|---:|---|---|---|
| London Heathrow–Doha | £490 | Etihad | 1 stop via Abu Dhabi (AUH) | No — existing `lhr-doh-economy` |
| London Gatwick–Ahmedabad | £535 | Air Arabia | 1 stop via Sharjah (SHJ) | No — existing `lgw-amd-economy` |
| London Heathrow–Bengaluru | £489 | Gulf Air | 1 stop via Bahrain (BAH) | Yes — `lhr-blr-economy` |
| Manchester–Jeddah | £432 | Pegasus | 1 stop via Istanbul (SAW) | Yes — `man-jed-economy` |
| Birmingham–Mumbai | £586 | Qatar Airways | 1 stop via Doha (DOH) | Yes — `bhx-bom-economy` |
| Birmingham–Madinah | £532 | Pegasus and Flynas | 1 stop via Istanbul (SAW) | Yes — `bhx-med-economy` |
| Manchester–Dhaka | £653 | Etihad | 1 stop via Abu Dhabi (AUH) | Yes — `man-dac-economy` |
| Leeds Bradford–Amritsar | £800 | KLM and IndiGo | 2 stops via Amsterdam and Mumbai | Yes — `lba-atq-economy` |
| Leeds Bradford–Islamabad | £916 | Aer Lingus and Qatar Airways | 2 stops via Dublin and Doha | Yes — `lba-isb-economy` |
| London Gatwick–Amritsar | £952 | Qatar Airways | 1 stop via Doha (DOH) | Yes — `lgw-atq-economy` |

Every new `Deal`'s `airline` field follows the existing, established convention (the route's own
primary editorial operator — the first entry in that route's `airlineSlugs` — never the specific
cheaper fare's own source airline), the same rule every other `Deal` in `data/deals.ts` already
follows. No screenshot was captured or archived for any of the 10 — every evidence record is
DOM/accessibility-tree data only, stated plainly in each evidence file rather than implying image
files exist that don't.

### Coverage before and after

| | Before Batch B | After Batch B |
|---|---:|---:|
| Publishable observation | 13 of 32 (41%) | 23 of 32 (72%) |
| Customer-visible fare | 12 of 32 (38%) | 22 of 32 (69%) |
| Archive-only (publishable, not visible) | 1 (Heathrow–Jeddah) | 1 (Heathrow–Jeddah, unchanged — pre-dates and is out of scope for this batch) |

### RIS-001 grade changes caused mechanically by this batch's new evidence

Three routes move Useful → Strong. Zero routes move Strong → Useful (this batch only adds evidence,
never removes it). Each upgrade is the SAME shape: the route already had exactly one "substantive"
depth category (a sourced warning, or airline-verification), and Batch B's new fare observation
supplied the second — clearing Gate 1 (breadth), Gate 2 (diversity, since the pre-existing category
was already substantive), and Gate 3 (visible-content, since a real `Deal` now renders the fare, and
all three are direct routes so the connecting-depth check doesn't apply). Confirmed by running the
real `computeRouteIntelligenceLevel()` before and after this batch's data changes, not asserted from
the model alone:

| Route | Pre-existing category | New category | Gates cleared |
|---|---|---|---|
| London Gatwick–Ahmedabad | Warning (sourced, investigated) | Fare (this batch) | 1, 2, 3 — direct route, no connecting-depth check |
| London Heathrow–Bengaluru | Airline-verification (2 independent primary sources) | Fare (this batch) | Same |
| London Gatwick–Amritsar | Warning (sourced, investigated) | Fare (this batch) | Same |

**No manual override anywhere** — every one of the three upgrades, and the 7 routes that stayed
Useful, is a mechanical consequence of the same unchanged function running against real, dated
evidence.

**Two country aggregates moved upward as a direct consequence**, computed live from
`aggregateCountryIntelligence()` against `buildAtlasAirports()`'s real output:

- **Heathrow's India: Mixed → Strong.** Bengaluru joins Delhi and Mumbai (already Strong) — all
  three of Heathrow's India destinations are now individually Strong, so the conservative
  all-strong-required rule promotes the country.
- **Gatwick's India: Useful → Strong.** Ahmedabad and Amritsar — Gatwick's only two India
  destinations — are both now individually Strong.

Neither is the single-destination shortcut Manchester's UAE relies on (see the RIS-001 addendum) —
both groups have multiple destinations, and the conservative rule genuinely required, and got, every
one of them individually Strong first. `aggregateCountryIntelligence()` itself was not touched.

### The 7 routes that stayed Useful, and why

Manchester–Jeddah, Birmingham–Mumbai, Birmingham–Madinah, Manchester–Dhaka and Leeds
Bradford–Amritsar each gained exactly one category (the new fare) — Gate 1 (breadth, ≥2 categories)
is not cleared, so the diversity and visible-content gates are never even reached. Leeds
Bradford–Islamabad now has two categories (its existing warning plus the new fare) but is a
connecting route with no `connectingAlternative` block — Gate 3 blocks it, same shape as
Birmingham–Amritsar's RIS-001 downgrade. London Heathrow–Doha gained its first-ever category (the
existing Deal previously had no publishable observation behind it) — one category is never enough
for Gate 1 regardless of what it is.

### Migration risks considered

- **No route fact, fare value, Book-By rule, warning or Trip.com link was touched** — confirmed via
  `git diff --stat`, scoped to `data/fare-observations.ts` (10 new observations), `data/deals.ts` (8
  new Deal entries), this document, `FARE_OBSERVATION_ARCHIVE.md`, and 10 new evidence-record files.
- **No secondary Turkey/UAE/Qatar route intelligence was added** despite several of this batch's
  cheapest fares connecting via Istanbul, Abu Dhabi, Doha, Bahrain, Sharjah, Amsterdam or Dublin —
  every hub mention stays itinerary-level detail on the originating route's own fare observation,
  never written into any other route's own facts, matching the standing rule from the earlier
  evidence-completeness audit.
- **Every new Deal's directness badge is evidenced, not assumed** — each of the 10 observations
  explicitly recorded `fareDirectness: 'connecting'` from what the source actually showed for that
  specific itinerary, never inferred from the route's own verified operator (several of the cheapest
  fares found — Air Arabia via Sharjah on Gatwick–Ahmedabad, Etihad via Abu Dhabi on Heathrow–Doha —
  are genuinely different airlines and routings than the route's own verified service, the same
  pattern already established and handled correctly for Manchester–Dubai and others).
- **Test-suite risk:** none identified — this batch adds new data and new tests rather than changing
  the meaning of any existing assertion, unlike RIS-001's downgrades, which required rewriting two
  pre-existing tests.

---

## 8. Criteria for upgrading a route

A route moves from **Useful → Strong** only when it clears all three of RIS-001's gates (see the
RIS-001 addendum above for the full model and reasoning):

**Gate 1 — breadth.** At least **two** of the following six categories (having exactly one is not
enough — see the Revision note):
1. A fresh, methodology-compliant, publicly-publishable fare observation (`departureDate` + `returnDate` both set, per `data/fare-observations.ts`'s standard).
2. A `connectingAlternative` block (for a connecting route) — real hub/airline/journey-time detail, not invented.
3. A per-airline `airlineVerifications` entry, sourced the same way route-level verification already is.
4. Inclusion in `BOOK_BY_PRIORITY_ROUTE_SLUGS` (a founder-level product decision, not a data-entry task).
5. A specific, sourced, investigated active warning (`data/route-warnings.ts`) — only when the investigation is real, never added just to hit this bar.
6. Dedicated baggage guidance (`data/traveller-tips.ts`, `category: 'baggage'`, scoped to the route or its destination) — only when the tip is real, route-relevant advice, never added just to hit this bar.

**Gate 2 — diversity.** At least one qualifying category must come from #3–#6 above (airline
verification, Book-By, warning, or baggage) — a route whose only two categories are `connectingAlternative`
(#2) and a fare observation (#1) does not qualify, however many additional routes it might be true for.

**Gate 3 — visible-content baseline.** A matching, customer-visible `Deal` (`hasTrackedFare()`) must
exist for the route — a publishable fare observation with no rendering `Deal` does not count. For
connecting routes specifically, `route.connectingAlternative` must also be present — direct routes are
exempt from this check.

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
## Morocco route-guide completion record — 12 August 2026

The following Morocco route guides were added after the original 32-route audit. They are all
bounded as **Useful** route guidance: current airport or airline evidence supports the route
posture, while exact dates, frequencies, durations and baggage terms remain itinerary-specific.
The four non-London Trip.com handoffs are preserved; London-origin handoffs remain blocked.
Across the expanded 63-route catalogue, publishable fare coverage is **23 of 63** routes;
the historical 32-route figures elsewhere in this document remain preserved as the original audit.

| Route slug | Grade |
|---|---|
| `manchester-marrakech` | Useful |
| `bristol-marrakech` | Useful |
| `london-gatwick-marrakech` | Useful |
| `manchester-agadir` | Useful |
| `birmingham-agadir` | Useful |
| `london-gatwick-agadir` | Useful |
| `london-heathrow-casablanca` | Useful |
| `london-gatwick-tangier` | Useful |

## Europe route-guide completion record — 13 August 2026

Seventeen Europe route guides were added after the Morocco completion record. They are bounded as
**Useful** route guidance and use current airport or airline evidence. Exact dates, operators,
frequencies, durations and baggage terms remain itinerary-specific unless the route entry says
otherwise. The four Gatwick routes retain no unsafe affiliate fallback. Glasgow → Athens remains
unbuilt because Glasgow Airport's current destination listings do not list Athens.

| Route slug | Grade |
|---|---|
| `manchester-barcelona` | Useful |
| `birmingham-barcelona` | Useful |
| `london-gatwick-barcelona` | Useful |
| `bristol-barcelona` | Useful |
| `leeds-bradford-barcelona` | Useful |
| `bristol-faro` | Useful |
| `manchester-faro` | Useful |
| `birmingham-faro` | Useful |
| `leeds-bradford-faro` | Useful |
| `london-gatwick-faro` | Useful |
| `manchester-athens` | Useful |
| `birmingham-athens` | Useful |
| `london-gatwick-athens` | Useful |
| `manchester-rome` | Useful |
| `birmingham-rome` | Useful |
| `london-gatwick-rome` | Useful |
| `bristol-rome` | Useful |

The expanded catalogue then contained **80 route guides**.

---

## Final Route-Guide Completion batch (13 August 2026)

Twelve candidate airport-to-destination pairs were audited against current, authoritative (airport-
or airline-own) evidence only — Trip.com is booking evidence, never route evidence, and was not used
to decide any of the twelve. **First pass: two were built; ten remain evidence-blocked** — not
silently dropped, recorded here so the catalogue stays honestly incomplete rather than quietly padded.
**A second evidence pass (also 13 August 2026, same day) then re-opened the ten** — see below — and
built six more, using search-indexed content for official pages that 403 on direct fetch. Final
outcome: **8 of 12 built, 4 genuinely blocked.**

| Route slug | Grade | Evidence |
|---|---|---|
| `london-heathrow-lahore` | Useful | Heathrow Airport's own media centre press release ("Spring takes off at Heathrow with new routes and greater choice for passengers", mediacentre.heathrow.com/pressrelease/detail/24969): PIA, weekly from 30 March 2026, Terminal 4. |
| `london-gatwick-dubai` | Useful | Gatwick's own destinations page (gatwickairport.com/flights/destinations.html): "Dubai, UAE... 7-8 hours flight time... Serviced by Emirates." |

**Four pairs that stayed evidence-blocked after both passes, and why:**

| Pair | Why blocked |
|---|---|
| Leeds Bradford → Istanbul | Current authoritative evidence did not establish this route. Leeds Bradford Airport's own destinations directory does not list Istanbul (re-confirmed 13 August 2026, both passes: the airport's own destination-specific URL pattern that resolves for its other Turkey routes 404s for Istanbul; its own direct-destinations highlight page excludes Turkey entirely). This is an absence of confirming evidence from the sources reached, not proof that no airline anywhere serves the pair. Not forced, per standing instruction. |
| Glasgow → Athens | Current authoritative evidence did not establish this route. easyJet's own Athens network lists Bristol, Edinburgh, Luton, Gatwick and Manchester, not Glasgow; Jet2's Glasgow programme serves Heraklion and Corfu, not Athens. Re-confirmed via a July-2026-dated source in the second pass. Glasgow Airport's own site remained unreachable in both passes, so this rests on airline-side negative evidence only from the two carriers checked, not a check of every airline — not proof that no airline anywhere flies the pair. Not forced, per standing instruction. |
| Heathrow → Karachi | Current authoritative evidence did not establish this route. Heathrow's own media centre press release (the same one used for Lahore, above) names only Islamabad and Lahore as PIA's returning routes — Karachi is not mentioned in any current, reachable source, including a dedicated second-pass search. This reflects the sources reached, not a check of every airline serving Heathrow. |
| Heathrow → Madinah | Current authoritative evidence did not establish this route. No current Heathrow-Madinah service was found for British Airways (Heathrow-Saudi Arabia service is Jeddah, Riyadh and, newly, Dammam — not Madinah) or Saudia, re-confirmed in the second pass. This reflects the sources reached, not a check of every airline serving Heathrow. |

### Second evidence pass (13 August 2026, same day) — six more built

The first pass stopped too early on several routes: a 403 from **direct** WebFetch was wrongly treated
as an evidence blocker, when the exact same official page is independently indexed and reachable via
search (Google/Bing/DDG's own crawl of the same page — not a different or lesser source). Founder
review independently confirmed several of these pages were genuinely reachable this way. Re-opened all
ten blocked pairs on that basis; six now have sufficient evidence.

| Route slug | Grade | Evidence | Notes |
|---|---|---|---|
| `birmingham-dubai` | Useful | Birmingham Airport's own Dubai destination page (birminghamairport.co.uk/destinations/where-we-fly/dubai/ — confirmed indexed and current via search), corroborated by Birmingham Airport's own historical Emirates launch press releases. | Direct, Emirates, ~7h. Historical "three-times-daily" launch figure (2015) not republished as current frequency. |
| `birmingham-doha` | Useful | Birmingham Airport's own press release, "Qatar Airways Returns to Birmingham Airport" (indexed via search; direct fetch 403s). | Direct, Qatar Airways, launched daily 6 July 2023 — launch evidence, current frequency not independently reconfirmed. |
| `birmingham-jeddah` | Useful | Birmingham Airport's own press release, "Saudia Launches Three-Times-A-Week Jeddah Service from BHX" (indexed via search; direct fetch 403s), with CEO Nick Barton quoted confirming the launch. | Direct, Saudia, launched 2 July 2023, 3x/week (Tue/Thu/Sun), ~6h15m — launch evidence, current frequency not independently reconfirmed. |
| `london-heathrow-dubai` | Useful | Heathrow's own live flight-tracking system indexes multiple current Emirates Heathrow-Dubai flight-detail pages (EK2/EK4/EK6/EK32/EK42 departures, EK3/EK31 arrivals, all Terminal 3) — reached via search-indexed content, since the pages themselves are JS-rendered to direct fetch. | Direct, Emirates, Terminal 3. British Airways separately operates a reduced, currently-disrupted service on this route (Middle East airspace-related capacity cuts since March 2026) — not listed in `airlineSlugs`, since no primary BA source confirming current status was reachable. |
| `birmingham-delhi` | Useful (unverified, genuine conflict preserved) | Birmingham Airport's own 2019 press release describing a direct Boeing 787 Delhi/Amritsar tag-service, **plus** Birmingham Airport's own CURRENT Delhi destination page (Air India, direct, ~7h55) — **set against** Air India's own current route-information page, which states 0 direct flights between Birmingham and Delhi, while Air India's own schedule output separately shows AI114 as Non Stop on some 2026 dates. | **Deliberately not resolved either way** — `verification.status: 'unverified'`, `isDirect: true` per the standing "genuine dispute" rule (matches the Manchester–Sylhet precedent). All claims stated explicitly in the route's own intro/note; none discarded. Founder-supplied evidence (13 August 2026 amendment) added Birmingham Airport's current Delhi destination page to the "direct" side without resolving the conflict. |
| `birmingham-ahmedabad` | Useful (unverified, genuine conflict preserved) | Air India's own current page for this pair is internally self-contradictory: its marketing copy describes flying to Ahmedabad and references a direct-flight duration, while the same page's structured route information and FAQ separately state 0 direct flights between Birmingham and Ahmedabad. | **Deliberately not resolved either way** — `verification.status: 'unverified'`, `isDirect: true`, matching the Birmingham–Delhi and Manchester–Sylhet precedent. Originally built as connecting on the mistaken assumption that Air India's page was a clean, unconflicted confirmation; corrected 13 August 2026 (founder amendment) once the page's internal self-contradiction (marketing copy vs. structured data/FAQ) was identified — no other current authoritative primary source resolves it. No specific hub (Delhi/Mumbai) is asserted — no source reached confirms the exact routing, if any, Air India's own itineraries use, so none is published. |

**FINAL AMEND (13 August 2026, founder review):** `birmingham-ahmedabad` was corrected from a
settled `isDirect: false` connecting claim to `isDirect: true` + `verification.status: 'unverified'`
once the founder identified that Air India's own current page for this pair is internally
self-contradictory (marketing copy vs. structured route information/FAQ), not the clean,
unconflicted confirmation it was first treated as. `birmingham-delhi`'s evidence record was also
extended with Birmingham Airport's own current Delhi destination page (Air India, direct, ~7h55),
without resolving that route's pre-existing conflict either. Elsewhere in this document, absolute
"no airline flies X" conclusions for genuinely evidence-blocked pairs (Leeds Bradford–Istanbul,
Glasgow–Athens, Heathrow–Karachi, Heathrow–Madinah) were reworded to "current authoritative evidence
did not establish the route" — the sources reached did not confirm the route, which is not the same
claim as proving every airline was checked.

**A genuine tooling limitation, not evidence the routes don't exist:** direct WebFetch to
birminghamairport.co.uk (every subdomain: `www`, `airport`, `corporate`) and to emirates.com,
qatarairways.com and saudia.com returned 403 (or a bot-detection interstitial) on every attempt in
both passes — matching this project's existing documented pattern for PIA's own site
(`piac.com.pk`). The second pass worked around this by using search-indexed content (via WebSearch and
DuckDuckGo's HTML search endpoint) for the exact same official pages, per the explicit rule that a 403
on direct fetch is not itself an evidence blocker when the identical official source is reachable
another way.

### Trip.com coverage — two genuinely different metrics, reconciled

An earlier draft of this batch's report stated "Trip.com coverage: 45 of 82", which understated the
real customer-facing coverage and was flagged for reconciliation before being written into this
document. Two distinct, both-valid metrics exist in `lib/booking-providers.ts`, and conflating them
was the error:

- **Route-level exact link** (`TRIPCOM_ROUTE_URLS` / `getTripComRouteUrl()` / `hasTripComRoute()`) —
  **45 of 88** routes have an exact, dashboard-generated Trip.com link keyed to that specific route
  slug. This is what `tests/booking-providers.test.ts`'s `SUPPORTED_ROUTES`/`UNSUPPORTED_ROUTES`
  partition tracks, and what `STATUS.md` has always meant by "45 of N routes carry a genuine,
  dashboard-generated, dateless Trip.com affiliate link."
- **Any working handoff on the route page** (`getTripComFlightHandoffUrl()`, what a visitor actually
  sees on `/routes/[slug]`) — falls back to a second, separate map (`TRIPCOM_DESTINATION_URLS`, 42
  entries, pair-keyed) when no route-level entry exists. The true union across both maps is **63 of
  88** routes with some working Trip.com CTA — the figure a founder independently verifying the real
  coverage would find, and the one this document should have led with.

Both are accurate; neither overwrites the other. This document now states both explicitly rather than
citing only the narrower one under the label "Trip.com coverage." No test or doc value was overwritten
with the lower, incomplete figure — the previously-drafted "45 of 82" was corrected before being
written into version-controlled test assertions.

The catalogue now contains **88 route guides** (80 plus this batch's 8 built pairs across both
evidence passes). Current publishable fare coverage is **59 of 88** after the 13 August 2026 controlled
observation batch. None of the 8 new route guides in this section had a fare observation at the time
of that route-guide audit; the later fare batch is recorded separately in the fare archive.
a fare observation yet. Route-level exact Trip.com coverage remains **45 of 88** (all 8 new routes are
either London-origin, per the standing limitation, or Birmingham pairs Trip.com's tool has no exact
link for); the true any-handoff figure is **63 of 88**.

### Full route index — the 8 new routes

| Slug | Grade |
|---|---|
| `london-heathrow-lahore` | Useful |
| `london-gatwick-dubai` | Useful |
| `birmingham-dubai` | Useful |
| `birmingham-doha` | Useful |
| `birmingham-jeddah` | Useful |
| `london-heathrow-dubai` | Useful |
| `birmingham-delhi` | Useful |
| `birmingham-ahmedabad` | Useful |

## Current fare-coverage amendment — 14 August 2026

The historical audit figures above remain preserved as dated records. The current 88-route catalogue
now has **71 of 88** routes with a display-ready Fare Signal after the 14 August Batch 4 observations
and same-day primary-source re-verification of Manchester–Lahore, Manchester–Islamabad,
Heathrow–Jeddah and Heathrow–Mumbai. The current value is derived from the live fare-observation and
route-evidence gates, not hand-entered.
