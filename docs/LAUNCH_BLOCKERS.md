# JetStash Launch Blockers Register

Single source of truth for unresolved product-trust/launch issues. See `docs/TRUTH_RESET_PHASE_1.md`
for the audit this register was created under. Audit started 2026-07-12, 20:05 Europe/London.

**Severity levels:**
- **P0 Critical** — security, privacy, legal, factual accuracy, data integrity, broken transactions, or publicly exposed internal systems.
- **P1 Major** — material trust failures, broken key journeys, serious mobile problems, accessibility barriers, misleading content, market-positioning problems, major conversion failures.
- **P2 Improvement** — polish/optimisation that doesn't prevent a responsible launch.

A blocker is only fully closed once its correction is **deployed to production and confirmed working
on jetstash.co.uk** — not when code is written or a local build passes. Items fixed locally during
this phase stay marked **awaiting production verification** until the founder approves deployment
and it's re-checked there. Nothing in this register is production-verified — every check performed
this phase was against the local dev server only, since nothing has been committed, pushed, or
deployed.

## Status summary (every blocker, split by state — current as of this correction pass)

**Open (genuinely unresolved — no code fix available this pass):**
- **TR-017** (new, P1): Birmingham–Mumbai is a confirmed real connecting corridor with no `Route` record in JetStash's data — a product-coverage gap, not something a data correction can close. Requires a future product-phase addition.
- Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad directness remain genuinely unresolved — no qualifying primary source found across three rounds of searching (see TR-006/TR-007 and the route-claim evidence table).
- BA–Jeddah's specific secondary termination claim (24 Apr 2026) is not explicitly disproven — only unsupported by every primary source reached this session (see TR-010). BA itself is now verified direct; this residual item is about the specific termination date claim, not BA's current operation.
- Saudia's status on Heathrow–Jeddah is unverified (see TR-010) — a genuine, disclosed gap, not resolved this pass.

**Locally corrected (implemented, tested, and passing every local quality gate — not yet production-verified):**
TR-001, TR-002 (founder-approved), TR-003, TR-004, TR-005, TR-006, TR-007, TR-008 (corrected twice), TR-009, TR-010 (corrected three times — BA now verified, Saudia's gap disclosed as Open above), TR-011, TR-012, TR-014 (unchanged, disclosed limitation, not a defect), TR-015 (founder-approved), TR-016.

**Awaiting production verification (identical set to "locally corrected" — nothing in this phase has been deployed):**
TR-001 through TR-012, TR-015, TR-016 — all implemented and passing locally (typecheck, lint, full test suite, production build all clean as of the most recent local run), none deployed.

**Closed, no code changed (investigated, found not to be a real defect):**
TR-013 (the specific cross-origin data-leakage mechanism alleged does not exist in this codebase's architecture — see the dedicated TR-013 section below).

**Exact blocker count:** 17 blockers filed in total (TR-001 through TR-017, no TR-015 gap — every number 001–017 is in use). Of these: **1 open P1** (TR-017), **2 disclosed residual gaps within an otherwise-corrected blocker** (TR-010's Saudia status and its termination-date claim — not separately numbered), **14 locally corrected and awaiting production verification**, **1 closed with no code change** (TR-013), **1 unchanged pre-existing limitation** (TR-014, counted within the 14 "locally corrected" for tracking purposes even though nothing changed this session, since its status text was already accurate and needed no correction).

---

### TR-001 — Book-By Countdown displays a past date as an active "book by" deadline
- **Date discovered:** 2026-07-12
- **Severity:** P0 (factual accuracy)
- **Affected:** `/routes/manchester-lahore` (and any other priority route currently in `surge`/`late`/`inside-period` state)
- **Evidence:** See TRUTH_RESET_PHASE_1.md lead #1 — full date-math trace confirming `bookByDate = 2026-06-22`, 20 days before the audit date, displayed as "Book by 22 June 2026" without past-tense framing.
- **Impact:** A visitor reads "Book by 22 June 2026" as a still-actionable instruction; the state badge (BOOK SOON) is correct, the date label is stale.
- **Resolution required:** Reframe the date label to past tense once state is `surge`/`late`/`inside-period` (e.g. "the sharp-rise window began 22 June 2026" instead of "Book by 22 June 2026"). Add fixed-clock tests for every state boundary.
- **Round 2 strengthening (founder correction, Section 7):** the label-selection logic was extracted into pure functions (`getBookByDateLabel`/`getBookByTopLabel` in `lib/booking-intelligence.ts`) and given a dedicated, exhaustive regression test — including a 60-day sweep proving a past `bookByDate` can never render "Book by" on any day after it passes.
- **Status:** Fix implemented and tested locally — full test suite passing (see quality-gate results below) — awaiting production deployment and verification before closure.
- **Commit:** none yet (not committed pending founder approval).

### TR-002 — "Verified Check" fare label has no travel dates
- **Severity:** P0 (factual accuracy / fare integrity)
- **Affected:** Every route with a logged fare observation (all 18 current observations, sitewide — none have a return date field, most lack `departureDate`).
- **Evidence:** Lead #2; `FareObservation` schema has no return-date field at all.
- **Impact:** A price is shown as "verified" without the travel dates needed to understand what it actually applies to.
- **Resolution required:** Add required-for-publication date fields; hide any observation lacking them from public "Verified Check"/tracked-fare display rather than deleting it.
- **Business impact flagged for founder approval:** enforcing this fully would remove the "Verified Check" callout and most/all Deal-card prices sitewide until fares are re-logged with complete dates, since none of the 18 existing observations currently qualify. This is a deliberate, disclosed scarcity outcome, not a bug.
- **Founder decision:** **Approved.** Every fare observation without complete outbound and return travel dates stays hidden from the public product. Do not weaken this requirement or restore example prices merely to avoid a sparse-looking site.
- **Status:** Founder-approved and implemented locally as a completeness gate — awaiting production verification.

### TR-003 — Fare history mixes Economy and Business as one "N fares tracked" history
- **Severity:** P1 (misleading content)
- **Affected:** `/routes/manchester-lahore` and any other route with observations in more than one cabin.
- **Evidence:** Lead #3.
- **Resolution required:** Count/group "fares tracked" per comparable cabin, not per route.
- **Status:** Fix implemented and tested locally (full test suite passing) — awaiting production verification.

### TR-004 — Deals page total/category counts include cards with no checked fare
- **Severity:** P1 (misleading content / conversion-adjacent)
- **Affected:** `/deals` (all category filters), any component reusing `deals.length`.
- **Evidence:** Lead #4 — 36 total deal entries vs 18 real fare observations.
- **Resolution required:** Count only deals with a genuine matching fare observation as "tracked fares"; render/count route-search cards (no observation) separately.
- **Status:** Fix implemented and tested locally (full test suite passing) — awaiting production verification.

### TR-005 — Public "V1" wording in Travel Ready Check
- **Severity:** P1 (premium-brand/clarity)
- **Affected:** `components/travel-ready/travel-ready-check.tsx` coverage note, rendered on every route page with the check embedded and on `/travel-ready-check`.
- **Evidence:** Lead #5.
- **Resolution required:** Remove "V1" from customer-facing copy; internal docs may keep it.
- **Status:** Fix implemented locally — awaiting production verification.

### TR-006 — Manchester–Karachi displayed as direct PIA, several times weekly
- **Severity:** P0 (factual accuracy — route/schedule claim)
- **Affected:** `/routes/manchester-karachi`, its deal card, its fare observation, `data/route-warnings.ts`'s existing caution entry.
- **Evidence:** Lead #13 — multiple independent current sources describe PIA's Manchester direct destinations as Lahore and Islamabad only.
- **Resolution required:** Downgrade to `isDirect: false` / unverified-connecting until a primary airline source confirms otherwise; correct frequency claim; keep the existing fare observation (append-only) but the route framing must not claim direct service.
- **Status:** Fix implemented locally — awaiting production verification.

### TR-007 — Birmingham–Lahore displayed as direct PIA alternative
- **Severity:** P0 (factual accuracy)
- **Affected:** `/routes/birmingham-lahore`, and its appearance as a "worth comparing" card on `/routes/manchester-lahore`.
- **Evidence:** Lead #8.
- **Resolution required:** Downgrade to unverified/connecting pending a direct airline-source check.
- **Status:** Fix implemented locally — awaiting production verification.

### TR-008 — Manchester–Lahore frequency overstated
- **Severity:** P1 (factual accuracy, less severe than TR-006/007 since the route itself is genuinely direct)
- **Affected:** `/routes/manchester-lahore`.
- **Evidence:** Lead #7 — real service launched 2 Jul 2026, weekly (PK709/PK710), not "several times weekly." (Original evidence was secondary; superseded below.)
- **Round 2 update (founder-directed primary-source correction):** Manchester Airport's own media centre confirms direct status, PIA as operator, and a 3 July 2026 start date. No official source states a frequency, so none is published — the route now reads "current frequency not confirmed by an official schedule" rather than asserting "weekly."
- **Resolution required:** ~~Correct `frequency` field to reflect weekly service~~ — superseded: frequency field now states directness/operator/start-date only, no frequency claim.
- **Status:** Fix implemented and re-verified locally with a genuine primary source — awaiting production verification.

### TR-009 — Heathrow–Karachi/Islamabad/Lahore deal cards name British Airways with no route backing
- **Severity:** P0 (factual accuracy)
- **Affected:** `data/deals.ts` entries `lhr-khi-economy`, `lhr-khi-business`, `lhr-isb-economy`, `lhr-business-lhe`.
- **Evidence:** Lead #15; no `Route` entry exists for any of these airport-destination pairs, and no current evidence supports direct BA service to Karachi.
- **Resolution required:** Hide or clearly relabel these deals as unverified/no confirmed route; do not delete the historical record.
- **Status:** Fix implemented locally — awaiting production verification.

### TR-010 — British Airways / Jeddah route status — corrected three times, now genuinely primary-sourced and per-airline
- **Severity:** P0 (factual accuracy) → resolved for BA, one disclosed residual gap for Saudia
- **Affected:** `data/routes.ts`'s `london-heathrow-jeddah` — `airlineSlugs` and (new) `airlineVerifications`.
- **Original evidence (superseded):** Lead #16 — BA's Jeddah route reported permanently withdrawn, terminated 24 April 2026 (Head for Points, corroborated by 3+ independent aviation-news sources — all secondary).
- **Round 1 correction:** Removed British Airways from `airlineSlugs`, trusting the secondary termination claim as if confirmed.
- **Round 1.5 correction (founder rejected secondary sourcing):** Restored British Airways, marked the whole route `unverified`, after finding BA's own Aug 2025 press release (Jeddah "transitioning to five flights per week") and BA's own Mar 2026 press release (Middle East cuts list that excludes Jeddah) — neither corroborates the termination claim.
- **Round 2 correction:** Fetched BA's own live, current destination/booking page directly — "Direct Flights to Jeddah Deals (JED) 2026 | Book now with BA." Marked the whole route (both airlines) **verified** on the strength of this one BA-specific source — which, on reflection, was itself the exact mistake this Truth Reset exists to catch: one airline's evidence covering another.
- **Round 3 correction (founder correction, Section 4 — per-airline verification):** split the claim. **British Airways is independently verified** (its own live destination page, confirmed above). **Saudia has no independent source and is now recorded as unverified** — the earlier "long-standing, not in dispute" assumption about Saudia was never actually re-checked this session and is corrected here rather than carried forward. The route still displays "Direct" because at least one airline (BA) has current verified evidence, per the founder's explicit rule.
- **Status:** BA's claim: fix implemented and locally re-verified with a genuine primary source — awaiting production verification. Saudia: genuinely open, not resolved this pass — see Status Summary. Residual uncertainty on BA (disclosed, not resolved): the specific secondary termination date (24 Apr 2026) has not been explicitly disproven, only unsupported by every primary source actually reachable this session.

### TR-017 — Birmingham–Mumbai is a confirmed connecting corridor missing from JetStash's data
- **Date discovered:** 2026-07-13 (founder-directed correction, Section 1)
- **Severity:** P1 (a real, useful India corridor with no coverage at all — not a factual-accuracy defect, since nothing published about it is wrong; it's simply absent)
- **Affected:** No current page/route/deal — this is a coverage gap, not a bug in an existing surface.
- **Evidence:** Birmingham Airport's own Mumbai destination page (fetched directly): *"There are currently no direct flights to Mumbai, so you'll need to connect through a major hub including, but not limited to, Amsterdam, Delhi, Dubai, Istanbul or Paris."* Confirms the corridor is real (Birmingham Airport actively lists Mumbai as a bookable, connecting destination with named airlines) but no `Route` record for `birmingham`→`mumbai` exists anywhere in `data/routes.ts`, and `data/destinations.ts`'s `mumbai.ukAirports` does not list `birmingham`.
- **Resolution required:** Add a `birmingham-mumbai` route in a future product phase, modelled as connecting (never direct), with its own airline/frequency evidence gathered at that time. **Not created this pass** — per the founder's explicit instruction, this correction pass corrects existing claims; it does not add new product surface.
- **Status:** Open. Filed for the next phase, not fixed this pass.

### TR-011 — Reminder email: subject/body contradiction and dead /founder link
- **Severity:** P1 (trust — internal-facing but represents the same honesty standard)
- **Affected:** `app/api/cron/fare-check-reminder/route.ts`.
- **Evidence:** Leads #10, #11.
- **Resolution required:** Make subject and body describe the same action state (missing-departure-date vs genuinely-stale are different problems); stop linking to `/founder` (which correctly 404s in production by design — do not make it public) and instead include sufficient detail directly in the email body.
- **Status:** Fix implemented locally — awaiting production verification (cannot verify an actual email send this session).

### TR-012 — Route verification model doesn't exist
- **Severity:** P1 (systemic — root cause behind TR-006/007/008/009/010)
- **Affected:** `data/routes.ts`'s `Route` type; `app/routes/[slug]/page.tsx`'s direct/connecting badge.
- **Evidence:** Confirmed via code inventory — no `verificationStatus`/`source`/`verifiedDate`/`reviewDate` field exists anywhere on `Route`; a route can claim `isDirect: true` forever with no expiry or re-check mechanism.
- **Resolution required:** Add a verification-status data model; a route must not render a "Direct" badge without a current, unexpired verification record.
- **Status:** Fix implemented locally (data model + validation) — awaiting production verification.

### TR-013 — Deals page origin-specific data errors — investigated and closed (not a confirmed bug)
- **Severity:** P2 → resolved, not escalated
- **Affected:** Checked route cards, route pages, comparison cards, traveller tips and airport-advice panels across multiple airports.
- **Evidence:** `getNotesByAirport()`/`getTipsForScope()` are both correctly keyed by `airportSlug`/`routeSlug` via `Map`/`filter` lookups, never a shared object — confirmed by reading the full data files and live-testing `/routes/birmingham-amritsar` (Birmingham-specific airport advice rendered, not Manchester's). Comparison cards for the same destination correctly show different flight times/connection status per origin airport (Leeds 9h30/1-stop, London 9h10/direct, Manchester 13h20/1-stop, all for Amritsar).
- **One minor issue found and fixed along the way**: `data/airport-notes.ts`'s Birmingham note generically said routes are "predominantly one-stop... not direct," which read oddly next to the genuinely-direct Birmingham–Amritsar route it was shown beside. Reworded to acknowledge the exception explicitly.
- **Status:** Closed. The specific mechanism originally suspected (cross-origin data leakage) does not exist in this codebase's architecture.

### TR-014 — Data freshness / fare-collection automation ceiling (carried over from the previous quality pass)
- **Severity:** P2
- **Status:** Unchanged this session; still an honest, disclosed limitation (no approved live fare-data provider exists).

### TR-016 — Travel Ready Check gave a false "start your application now" warning for visa-on-arrival destinations
- **Date discovered:** 2026-07-12 (live browser testing of the actual form, not just unit tests — Section 4's explicit instruction)
- **Severity:** P1 (misleading content, adds artificial friction/anxiety to a genuinely simple case)
- **Affected:** `lib/travel-ready-check.ts`; live-tested and confirmed on UAE (Dubai), also affects Qatar (Doha) — both destinations have `typicalProcessingDays: 0` in `data/travel-ready-rules.ts` (visa issued free and automatically on arrival, no advance application of any kind).
- **Evidence:** Live test at `/travel-ready-check`: British passport, Dubai, no exemption document held, future dates → verdict was "DOCUMENT TIMING MAY AFFECT BOOKING" / "Start your application now. Consider a flexible or refundable fare until it's confirmed," despite the check's own displayed text one line above reading "A visitor visa is issued free of charge on arrival... no advance application is needed." Root cause: `tight = daysToDeparture < visaRule.typicalProcessingDays * 2` evaluates to `daysToDeparture < 0`, which is false for any future date, so the branch always fell through to `'caution'` regardless of how far ahead the traveller checked — the code had no branch at all for "zero processing days" meaning "nothing to arrange."
- **Why unit tests didn't catch it:** none of the original 11 required Travel Ready journeys (`tests/travel-ready-check.test.ts`) exercised a visa-on-arrival destination — only Pakistan/India (advance-visa) and Saudi Arabia were covered. This is exactly why Section 4 required a live UI check, not just trusting the passing unit-test suite.
- **Resolution:** Added an explicit `typicalProcessingDays === 0` branch in `lib/travel-ready-check.ts` that returns `'pass'` (verdict `ready-to-continue`) instead of falling into the advance-application caution logic. Two regression tests added (`tests/travel-ready-check.test.ts` #12–13, UAE and Qatar) and confirmed passing; refixed behaviour reverified locally in the browser, dev server only (now shows "READY TO CONTINUE").
- **Status:** Fix implemented and verified locally (dev server) — awaiting production verification.

### TR-015 — Systemic effect of the direct-badge verification gate: ~17 routes now show "Verification pending"
- **Severity:** P1 (large, visible, but deliberate and correct per Section 1's explicit requirement)
- **Affected:** Every route with `isDirect: true` and no `verification` record — i.e. every route not individually investigated this session (9 were: manchester-lahore, manchester-islamabad, manchester-karachi, birmingham-lahore, birmingham-islamabad, london-heathrow-jeddah, manchester-mumbai, manchester-delhi, london-heathrow-mumbai).
- **Evidence:** `getDisplayDirectness()` in `data/routes.ts` treats a missing `verification` record the same as an unverified one — by design, not a bug. Confirmed locally (dev server): London Heathrow–Delhi, Birmingham–Amritsar, Manchester–Dubai, London Heathrow–Doha and others now show "Verification pending" instead of "Direct" everywhere that badge renders (route pages, homepage, /routes index, region hubs, airport pages, deal cards).
- **Why this wasn't softened:** The brief is explicit — "A route must never display a direct badge unless a current source supports it... Add automated validation that prevents an unverified... route from being presented publicly as direct." A narrower interim design (only demoting the specific routes this session investigated, leaving everything else showing "Direct" by default) was considered and rejected: it would leave the exact same "unsupported confidence" risk in place for every other route, undermining the point of the exercise. This is the intended, disclosed consequence of implementing that requirement honestly, not an oversight.
- **Resolution required:** A real verification pass (primary-source schedule/booking-system check) for each of the remaining routes still showing "Verification pending" — this session closed the gap on 5 more (Manchester–Lahore, Manchester–Islamabad, Heathrow–Jeddah/BA, Heathrow–Mumbai's 3 airlines, Manchester–Mumbai/Delhi were already verified last round), leaving the rest of the site's routes for a future pass, using the same process applied to the routes checked so far.
- **Founder decision:** **Approved.** Keep "Verification pending" on every route lacking current qualifying evidence. Do not restore unsupported "Direct" badges merely to make the site look complete.
- **Status:** Founder-approved and implemented as designed — awaiting a follow-up verification pass for the remaining unreviewed routes, and awaiting production verification for the mechanism itself.

---

## Preserved from prior work (confirmed still present, not touched destructively)

Vercel Analytics/custom events, the 20-destinations/7-countries derived count, homepage urgency-wording
fix, Travel Ready `aria-live` result announcement, the unsupported-destination query-param guard, the
mobile Book-By timeline wrap fix, centralised fare-freshness thresholds, ISR on route/home pages, the
scheduled priority-route reminder email (content corrected per TR-011, mechanism preserved), and the
homepage/route-page copy improvements from the previous pass — all confirmed still in place via direct
code inspection at the start of this audit, not assumed from the prior report's claims.

---

## Final local quality-gate results — Round 3 (this founder correction pass)

All checks below were run against the local dev server and local toolchain only — **none of this is
production verification**, since nothing has been committed, pushed, or deployed.

- **Focused tests** (`npx vitest run` on `route-and-fare-integrity.test.ts` + `travel-ready-check.test.ts` + `booking-intelligence.test.ts` — every file touched by this correction pass): 3 files, **59/59 passing**.
- **Full test suite** (`npm test`): 4 files, **61/61 tests passing** (up from 43 — 18 new tests: per-airline verification, Section 5's "neither Direct nor Connecting", Travel Ready's 2 invalid-date verdicts plus wording assertions, and 7 new Book-By label regression tests including a 60-day exhaustive sweep).
- **`npx tsc --noEmit`**: clean, 0 errors.
- **`npm run lint`**: clean, 0 warnings/errors.
- **`npm run build`**: succeeded, 103/103 static pages generated, no build errors.
- **`git diff --check`**: no whitespace errors, no conflict markers — only the pre-existing LF→CRLF autocrlf notices on the same 17 files as every prior round.
- **`git diff --stat`**: **22 files changed, 1832 insertions / 218 deletions.**
- **`git status --short`** (exact):
  ```
   M app/about/page.tsx
   M app/airports/[slug]/page.tsx
   M app/api/cron/fare-check-reminder/route.ts
   M app/page.tsx
   M app/routes/[slug]/page.tsx
   M app/routes/page.tsx
   M components/route/book-by-countdown.tsx
   M components/route/community-notes-panel.tsx
   M components/route/fare-history-panel.tsx
   M components/sections/deals-explorer.tsx
   M components/sections/region-hub-page.tsx
   M components/travel-ready/travel-ready-check.tsx
   M components/ui/deal-card.tsx
   M data/airport-notes.ts
   M data/deals.ts
   M data/fare-observations.ts
   M data/route-warnings.ts
   M data/routes.ts
   M lib/booking-intelligence.ts
   M lib/travel-ready-check.ts
   M package-lock.json
   M package.json
  ?? docs/LAUNCH_BLOCKERS.md
  ?? docs/TRUTH_RESET_PHASE_1.md
  ?? public/concepts/
  ?? tests/
  ?? vitest.config.ts
  ```
  Not clean — 22 intentionally modified tracked files (the full Truth Reset diff across three correction rounds) plus 5 untracked paths: 4 are this session's own docs/tests/config, 1 (`public/concepts/`) is pre-existing and unrelated, confirmed untouched since the very first session-start check.
- **Nothing committed, pushed, or deployed this phase.**
