# JetStash Launch Blockers Register

Single source of truth for unresolved product-trust/launch issues. See `docs/TRUTH_RESET_PHASE_1.md`
for the audit this register was created under. Audit started 2026-07-12, 20:05 Europe/London.

**Severity levels:**
- **P0 Critical** — security, privacy, legal, factual accuracy, data integrity, broken transactions, or publicly exposed internal systems.
- **P1 Major** — material trust failures, broken key journeys, serious mobile problems, accessibility barriers, misleading content, market-positioning problems, major conversion failures.
- **P2 Improvement** — polish/optimisation that doesn't prevent a responsible launch.

A blocker is only fully closed once its correction is **deployed to production and confirmed working
on jetstash.co.uk** — not when code is written or a local build passes.

**Production deployment update (2026-07-13):** commit `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`
("fix: complete JetStash Truth Reset phase 1") was pushed to `main` and deployed to
`jetstash.co.uk` (Vercel deployment `dpl_9XCT9pnrjDSuBUpHhhD3qiryYvfm`, status Ready). Live
verification was performed against production between ~13:00–14:00 Europe/London (BST) on
2026-07-13 — see `docs/TRUTH_RESET_PHASE_1.md`'s "Production deployment and live verification"
section for the full URL-by-URL evidence table. Per the founder's explicit instruction, **a blocker
is not closed merely because deployment succeeded** — each blocker below is updated individually
with what was actually confirmed live, and several remain open or only partially verified.

## Status summary (every blocker, split by state — updated after production deployment and live verification, 2026-07-13)

**Open (genuinely unresolved — no code fix exists, and none is possible without new evidence or new product work):**
- **TR-017** (P1): Birmingham–Mumbai is a confirmed real connecting corridor with no `Route` record in JetStash's data — a product-coverage gap, not something a data correction can close. Requires a future product-phase addition. Not affected by this deployment.
- Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad directness remain genuinely unresolved — no qualifying primary source found across three rounds of searching (see TR-006/TR-007). **Production-confirmed** to correctly display "VERIFICATION PENDING" (not Direct, not Connecting, no unsupported frequency) rather than guessing — this closes the *display-safety* mechanism (see TR-015) but does not resolve the underlying directness question, which remains open pending a real primary-source check.
- BA–Jeddah's specific secondary termination claim (24 Apr 2026) is not explicitly disproven — only unsupported by every primary source reached this session (see TR-010). BA itself is now verified direct and production-confirmed; this residual item is about the specific termination-date claim, not BA's current operation.
- Saudia's status on Heathrow–Jeddah is unverified (see TR-010) — a genuine, disclosed gap, not resolved this pass. **Production-confirmed** that Saudia is correctly excluded from the verified-airline presentation rather than riding on BA's evidence.
- TR-014 (data freshness / fare-collection automation ceiling) — unchanged, disclosed limitation, not a defect. No production check applies; this is a standing business/data dependency, not something a deployment resolves.
- Full route-verification backlog (every route beyond the 9 investigated across this Truth Reset) — unchanged; a future verification pass is still required.
- Reminder-email behaviour (TR-011's fix) — the corrected email copy is deployed, but **an actual production email send has not been observed this session** (no send-history is accessible from this environment); genuinely unverified in production, not claimed otherwise.

**Production-verified this deployment (confirmed working on `jetstash.co.uk`, 2026-07-13, ~13:00–14:00 Europe/London):**
TR-001, TR-003, TR-004, TR-005, TR-006 (display-safety only, see Open above), TR-007 (display-safety only, see Open above), TR-008, TR-010 (BA side), TR-012, TR-015. See `docs/TRUTH_RESET_PHASE_1.md`'s production verification section for the exact URL-by-URL evidence.

**Deployed but not individually re-tested live in production this pass (implemented, passing all local quality gates, covered by the automated suite, but not separately clicked through the production UI):**
TR-002 (fare-observation completeness gate — confirmed indirectly via `/deals` showing 0 tracked fares and `/routes/manchester-lahore` showing "No fare checks logged yet," but the specific gating logic on a partial-date observation was not individually re-tested live), TR-009 (the specific `lhr-khi-*`/`lhr-isb-economy`/`lhr-business-lhe` deal cards were not individually opened against production — only confirmed indirectly via `/deals`'s aggregate 0-tracked count and TR-015's mechanism being confirmed elsewhere), TR-016 (4 of its underlying 11 Travel Ready journeys — Pakistan+NICOP, India-no-OCI, expired passport, unsupported destination — not individually re-tested live this pass; the other 7 were, and TR-016's own specific UAE/Qatar fix is among those 7 confirmed).

**Closed, no code changed (investigated, found not to be a real defect):**
TR-013 (the specific cross-origin data-leakage mechanism alleged does not exist in this codebase's architecture — see the dedicated TR-013 section below). Not a deployment-dependent item.

**Exact blocker count:** 17 blockers filed in total (TR-001 through TR-017, no TR-015 gap — every number 001–017 is in use). Of these: **1 open P1 product-coverage gap** (TR-017), **1 open, disclosed underlying-fact gap despite a production-verified display-safety fix** (TR-006/TR-007's directness question), **1 open residual claim within an otherwise production-verified blocker** (TR-010's Saudia status + BA's specific termination-date claim), **1 unchanged pre-existing limitation** (TR-014), **11 production-verified**, **2 deployed but not individually live-retested this pass** (TR-002, partially TR-016), **1 closed with no code change** (TR-013). Do not read "production-verified" as "launch ready" — see the report's completion status.

---

### TR-001 — Book-By Countdown displays a past date as an active "book by" deadline
- **Date discovered:** 2026-07-12
- **Severity:** P0 (factual accuracy)
- **Affected:** `/routes/manchester-lahore` (and any other priority route currently in `surge`/`late`/`inside-period` state)
- **Evidence:** See TRUTH_RESET_PHASE_1.md lead #1 — full date-math trace confirming `bookByDate = 2026-06-22`, 20 days before the audit date, displayed as "Book by 22 June 2026" without past-tense framing.
- **Impact:** A visitor reads "Book by 22 June 2026" as a still-actionable instruction; the state badge (BOOK SOON) is correct, the date label is stale.
- **Resolution required:** Reframe the date label to past tense once state is `surge`/`late`/`inside-period` (e.g. "the sharp-rise window began 22 June 2026" instead of "Book by 22 June 2026"). Add fixed-clock tests for every state boundary.
- **Round 2 strengthening (founder correction, Section 7):** the label-selection logic was extracted into pure functions (`getBookByDateLabel`/`getBookByTopLabel` in `lib/booking-intelligence.ts`) and given a dedicated, exhaustive regression test — including a 60-day sweep proving a past `bookByDate` can never render "Book by" on any day after it passes.
- **Status:** Fix implemented and tested locally — full test suite passing (see quality-gate results below).
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** `https://jetstash.co.uk/routes/manchester-lahore`, checked 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. Observed: "Sharp rise began 22 June 2026" — no "Book by" wording on a passed date. No regression found. **Not closing this blocker on the strength of one route** — the fix is a generic pure-function fix covering all 5 priority routes' state machines, but only manchester-lahore's `surge` state was directly observed live this pass; the other 4 routes were confirmed via their own route-specific checks (badges/frequency), not specifically re-verified for the past-tense date label. Status upgraded to **production-verified for the checked route**, not blanket-closed.

### TR-002 — "Verified Check" fare label has no travel dates
- **Severity:** P0 (factual accuracy / fare integrity)
- **Affected:** Every route with a logged fare observation (all 18 current observations, sitewide — none have a return date field, most lack `departureDate`).
- **Evidence:** Lead #2; `FareObservation` schema has no return-date field at all.
- **Impact:** A price is shown as "verified" without the travel dates needed to understand what it actually applies to.
- **Resolution required:** Add required-for-publication date fields; hide any observation lacking them from public "Verified Check"/tracked-fare display rather than deleting it.
- **Business impact flagged for founder approval:** enforcing this fully would remove the "Verified Check" callout and most/all Deal-card prices sitewide until fares are re-logged with complete dates, since none of the 18 existing observations currently qualify. This is a deliberate, disclosed scarcity outcome, not a bug.
- **Founder decision:** **Approved.** Every fare observation without complete outbound and return travel dates stays hidden from the public product. Do not weaken this requirement or restore example prices merely to avoid a sparse-looking site.
- **Status:** Founder-approved and implemented locally as a completeness gate.
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** `https://jetstash.co.uk/deals`, checked 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. Observed: "All deals 0" tracked fares shown site-wide (consistent with none of the 18 existing observations having complete dates). No regression found. **Not individually re-tested** by attempting to log a new incomplete observation and confirming it stays hidden — confirmed indirectly via the aggregate 0-tracked count, not a direct positive/negative test of the gate itself in production.

### TR-003 — Fare history mixes Economy and Business as one "N fares tracked" history
- **Severity:** P1 (misleading content)
- **Affected:** `/routes/manchester-lahore` and any other route with observations in more than one cabin.
- **Evidence:** Lead #3.
- **Resolution required:** Count/group "fares tracked" per comparable cabin, not per route.
- **Status:** Fix implemented and tested locally (full test suite passing).
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** `https://jetstash.co.uk/routes/manchester-lahore`, checked 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. Observed: Economy and Business fare cards render as two separate entries, each independently "No fare checks logged yet" — not combined into one shared history/count. No regression found.

### TR-004 — Deals page total/category counts include cards with no checked fare
- **Severity:** P1 (misleading content / conversion-adjacent)
- **Affected:** `/deals` (all category filters), any component reusing `deals.length`.
- **Evidence:** Lead #4 — 36 total deal entries vs 18 real fare observations.
- **Resolution required:** Count only deals with a genuine matching fare observation as "tracked fares"; render/count route-search cards (no observation) separately.
- **Status:** Fix implemented and tested locally (full test suite passing).
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** `https://jetstash.co.uk/deals`, checked 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. Observed: "No tracked fares logged in this category yet — showing 34 route search cards instead." Search cards explicitly labelled and not counted as tracked. No regression found.

### TR-005 — Public "V1" wording in Travel Ready Check
- **Severity:** P1 (premium-brand/clarity)
- **Affected:** `components/travel-ready/travel-ready-check.tsx` coverage note, rendered on every route page with the check embedded and on `/travel-ready-check`.
- **Evidence:** Lead #5.
- **Resolution required:** Remove "V1" from customer-facing copy; internal docs may keep it.
- **Status:** Fix implemented locally.
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** `https://jetstash.co.uk/about` and `/travel-ready-check`, checked 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. Observed: no "V1" wording found on either page. No regression found.

### TR-006 — Manchester–Karachi displayed as direct PIA, several times weekly
- **Severity:** P0 (factual accuracy — route/schedule claim)
- **Affected:** `/routes/manchester-karachi`, its deal card, its fare observation, `data/route-warnings.ts`'s existing caution entry.
- **Evidence:** Lead #13 — multiple independent current sources describe PIA's Manchester direct destinations as Lahore and Islamabad only.
- **Resolution required:** Downgrade to `isDirect: false` / unverified-connecting until a primary airline source confirms otherwise; correct frequency claim; keep the existing fare observation (append-only) but the route framing must not claim direct service.
- **Status:** Fix implemented locally (as "unverified" display, not flipped to "connecting" — see TR-015/TR-012's tri-state model).
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** `https://jetstash.co.uk/routes/manchester-karachi`, checked 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. Observed: "VERIFICATION PENDING" badge, no Direct or Connecting claim, no unsupported frequency wording. No regression found. **This closes the display-safety mechanism, not the underlying directness question** — see the Status Summary's Open section: Manchester–Karachi's actual directness remains genuinely unresolved, no primary source found.

### TR-007 — Birmingham–Lahore displayed as direct PIA alternative
- **Severity:** P0 (factual accuracy)
- **Affected:** `/routes/birmingham-lahore`, and its appearance as a "worth comparing" card on `/routes/manchester-lahore`.
- **Evidence:** Lead #8.
- **Resolution required:** Downgrade to unverified/connecting pending a direct airline-source check.
- **Status:** Fix implemented locally (as "unverified" display — see TR-015/TR-012's tri-state model).
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** `https://jetstash.co.uk/routes/birmingham-lahore`, checked 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. Observed: "VERIFICATION PENDING" badge, no Direct or Connecting claim. No regression found. **This closes the display-safety mechanism, not the underlying directness question** — see the Status Summary's Open section.

### TR-008 — Manchester–Lahore frequency overstated
- **Severity:** P1 (factual accuracy, less severe than TR-006/007 since the route itself is genuinely direct)
- **Affected:** `/routes/manchester-lahore`.
- **Evidence:** Lead #7 — real service launched 2 Jul 2026, weekly (PK709/PK710), not "several times weekly." (Original evidence was secondary; superseded below.)
- **Round 2 update (founder-directed primary-source correction):** Manchester Airport's own media centre confirms direct status, PIA as operator, and a 3 July 2026 start date. No official source states a frequency, so none is published — the route now reads "current frequency not confirmed by an official schedule" rather than asserting "weekly."
- **Resolution required:** ~~Correct `frequency` field to reflect weekly service~~ — superseded: frequency field now states directness/operator/start-date only, no frequency claim.
- **Status:** Fix implemented and re-verified locally with a genuine primary source.
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** `https://jetstash.co.uk/routes/manchester-lahore`, checked 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. Observed: "DIRECT ROUTE" badge, corrected intro/frequency text with no unsupported frequency claim. No regression found.

### TR-009 — Heathrow–Karachi/Islamabad/Lahore deal cards name British Airways with no route backing
- **Severity:** P0 (factual accuracy)
- **Affected:** `data/deals.ts` entries `lhr-khi-economy`, `lhr-khi-business`, `lhr-isb-economy`, `lhr-business-lhe`.
- **Evidence:** Lead #15; no `Route` entry exists for any of these airport-destination pairs, and no current evidence supports direct BA service to Karachi.
- **Resolution required:** Hide or clearly relabel these deals as unverified/no confirmed route; do not delete the historical record.
- **Status:** Fix implemented locally.
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** Not individually re-tested live this pass — these specific deal cards (`lhr-khi-economy`, `lhr-khi-business`, `lhr-isb-economy`, `lhr-business-lhe`) were not opened directly against production. Confirmed only indirectly: `/deals` overall shows 0 tracked fares and the display-safety mechanism these cards rely on (TR-015) was confirmed live on other pages. **Do not treat this as production-verified** — it is deployed and passing local tests, but the specific card-level fix has not been directly observed live.

### TR-010 — British Airways / Jeddah route status — corrected three times, now genuinely primary-sourced and per-airline
- **Severity:** P0 (factual accuracy) → resolved for BA, one disclosed residual gap for Saudia
- **Affected:** `data/routes.ts`'s `london-heathrow-jeddah` — `airlineSlugs` and (new) `airlineVerifications`.
- **Original evidence (superseded):** Lead #16 — BA's Jeddah route reported permanently withdrawn, terminated 24 April 2026 (Head for Points, corroborated by 3+ independent aviation-news sources — all secondary).
- **Round 1 correction:** Removed British Airways from `airlineSlugs`, trusting the secondary termination claim as if confirmed.
- **Round 1.5 correction (founder rejected secondary sourcing):** Restored British Airways, marked the whole route `unverified`, after finding BA's own Aug 2025 press release (Jeddah "transitioning to five flights per week") and BA's own Mar 2026 press release (Middle East cuts list that excludes Jeddah) — neither corroborates the termination claim.
- **Round 2 correction:** Fetched BA's own live, current destination/booking page directly — "Direct Flights to Jeddah Deals (JED) 2026 | Book now with BA." Marked the whole route (both airlines) **verified** on the strength of this one BA-specific source — which, on reflection, was itself the exact mistake this Truth Reset exists to catch: one airline's evidence covering another.
- **Round 3 correction (founder correction, Section 4 — per-airline verification):** split the claim. **British Airways is independently verified** (its own live destination page, confirmed above). **Saudia has no independent source and is now recorded as unverified** — the earlier "long-standing, not in dispute" assumption about Saudia was never actually re-checked this session and is corrected here rather than carried forward. The route still displays "Direct" because at least one airline (BA) has current verified evidence, per the founder's explicit rule.
- **Status:** BA's claim: fix implemented and locally re-verified with a genuine primary source. Saudia: genuinely open, not resolved this pass — see Status Summary. Residual uncertainty on BA (disclosed, not resolved): the specific secondary termination date (24 Apr 2026) has not been explicitly disproven, only unsupported by every primary source actually reachable this session.
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** `https://jetstash.co.uk/routes/london-heathrow-jeddah`, checked 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. Observed: "DIRECT ROUTE" badge (BA-supported); Saudia explicitly and separately described as unverified, not presented as jointly verified with BA; no unsupported current frequency. No regression found. **Saudia's status itself remains open** — production correctly displays the gap rather than resolving it.

### TR-017 — Birmingham–Mumbai is a confirmed connecting corridor missing from JetStash's data
- **Date discovered:** 2026-07-13 (founder-directed correction, Section 1)
- **Severity:** P1 (a real, useful India corridor with no coverage at all — not a factual-accuracy defect, since nothing published about it is wrong; it's simply absent)
- **Affected:** No current page/route/deal — this is a coverage gap, not a bug in an existing surface.
- **Evidence:** Birmingham Airport's own Mumbai destination page (fetched directly): *"There are currently no direct flights to Mumbai, so you'll need to connect through a major hub including, but not limited to, Amsterdam, Delhi, Dubai, Istanbul or Paris."* Confirms the corridor is real (Birmingham Airport actively lists Mumbai as a bookable, connecting destination with named airlines) but no `Route` record for `birmingham`→`mumbai` exists anywhere in `data/routes.ts`, and `data/destinations.ts`'s `mumbai.ukAirports` does not list `birmingham`.
- **Resolution required:** Add a `birmingham-mumbai` route in a future product phase, modelled as connecting (never direct), with its own airline/frequency evidence gathered at that time. **Not created this pass** — per the founder's explicit instruction, this correction pass corrects existing claims; it does not add new product surface.
- **Status:** Open. Filed for the next phase, not fixed this pass. **Unaffected by this deployment** — no code exists for this blocker, so there is nothing to verify in production. Remains explicitly out of scope per the founder's deployment-approval instruction ("This approval does not authorise... work on TR 017").

### TR-011 — Reminder email: subject/body contradiction and dead /founder link
- **Severity:** P1 (trust — internal-facing but represents the same honesty standard)
- **Affected:** `app/api/cron/fare-check-reminder/route.ts`.
- **Evidence:** Leads #10, #11.
- **Resolution required:** Make subject and body describe the same action state (missing-departure-date vs genuinely-stale are different problems); stop linking to `/founder` (which correctly 404s in production by design — do not make it public) and instead include sufficient detail directly in the email body.
- **Status:** Fix implemented locally and deployed. **Genuinely unverified in production** — an actual email send has not been observed this session (no send-history is accessible from this environment, and the cron is scheduled weekly, not triggered on demand). This remains open per the founder's explicit instruction to keep open "any reminder-email behaviour that cannot be genuinely verified in production." Only the dead `/founder` link's *target* was independently confirmed safe (row 19 in the production URL table — `/founder` correctly 404s), which is necessary but not sufficient to confirm the fix.
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.

### TR-012 — Route verification model doesn't exist
- **Severity:** P1 (systemic — root cause behind TR-006/007/008/009/010)
- **Affected:** `data/routes.ts`'s `Route` type; `app/routes/[slug]/page.tsx`'s direct/connecting badge.
- **Evidence:** Confirmed via code inventory — no `verificationStatus`/`source`/`verifiedDate`/`reviewDate` field exists anywhere on `Route`; a route can claim `isDirect: true` forever with no expiry or re-check mechanism.
- **Resolution required:** Add a verification-status data model; a route must not render a "Direct" badge without a current, unexpired verification record.
- **Status:** Fix implemented locally (data model + validation).
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** Confirmed live across all 7 route pages checked in production (rows 1–7 of the URL table in `docs/TRUTH_RESET_PHASE_1.md`): verified routes show current evidence-backed "Direct" badges, unverified routes show "Verification pending," none show an unsupported claim. No regression found.

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
- **Status:** Fix implemented and verified locally (dev server) and deployed.
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** `https://jetstash.co.uk/travel-ready-check`, UAE and Qatar journeys, checked 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. Observed: both show "READY TO CONTINUE" — the exact defect this blocker describes does not reproduce in production. No regression found. The other 9 of the 11 required Travel Ready journeys were also checked (invalid-date-range, invalid-departure-date, Pakistan-no-NICOP, India-OCI, non-British confirmed live; Pakistan+NICOP, India-no-OCI, expired passport, unsupported destination not individually re-tested live this pass — covered by the automated suite only, see Status Summary).

### TR-015 — Systemic effect of the direct-badge verification gate: ~17 routes now show "Verification pending"
- **Severity:** P1 (large, visible, but deliberate and correct per Section 1's explicit requirement)
- **Affected:** Every route with `isDirect: true` and no `verification` record — i.e. every route not individually investigated this session (9 were: manchester-lahore, manchester-islamabad, manchester-karachi, birmingham-lahore, birmingham-islamabad, london-heathrow-jeddah, manchester-mumbai, manchester-delhi, london-heathrow-mumbai).
- **Evidence:** `getDisplayDirectness()` in `data/routes.ts` treats a missing `verification` record the same as an unverified one — by design, not a bug. Confirmed locally (dev server): London Heathrow–Delhi, Birmingham–Amritsar, Manchester–Dubai, London Heathrow–Doha and others now show "Verification pending" instead of "Direct" everywhere that badge renders (route pages, homepage, /routes index, region hubs, airport pages, deal cards).
- **Why this wasn't softened:** The brief is explicit — "A route must never display a direct badge unless a current source supports it... Add automated validation that prevents an unverified... route from being presented publicly as direct." A narrower interim design (only demoting the specific routes this session investigated, leaving everything else showing "Direct" by default) was considered and rejected: it would leave the exact same "unsupported confidence" risk in place for every other route, undermining the point of the exercise. This is the intended, disclosed consequence of implementing that requirement honestly, not an oversight.
- **Resolution required:** A real verification pass (primary-source schedule/booking-system check) for each of the remaining routes still showing "Verification pending" — this session closed the gap on 5 more (Manchester–Lahore, Manchester–Islamabad, Heathrow–Jeddah/BA, Heathrow–Mumbai's 3 airlines, Manchester–Mumbai/Delhi were already verified last round), leaving the rest of the site's routes for a future pass, using the same process applied to the routes checked so far.
- **Founder decision:** **Approved.** Keep "Verification pending" on every route lacking current qualifying evidence. Do not restore unsupported "Direct" badges merely to make the site look complete.
- **Status:** Founder-approved and implemented as designed. The mechanism itself is now production-verified; the underlying verification backlog it exposes is not resolved by this deployment and remains open (see Status Summary).
- **Commit:** `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`.
- **Production verification:** Confirmed live at `https://jetstash.co.uk/routes/manchester-karachi`, `/routes/birmingham-lahore`, `/routes/birmingham-islamabad` (all show "VERIFICATION PENDING"), 2026-07-13 ~13:00 Europe/London (BST), commit `da04b1b`. No regression found. **This does not close TR-015's own "Resolution required" line** — a real verification pass for the remaining unreviewed routes site-wide is still outstanding; this deployment only confirms the suppression mechanism itself works correctly in production.

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

---

## Production deployment record (2026-07-13, founder-approved)

- **Commit:** `fix: complete JetStash Truth Reset phase 1` — SHA `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`. Pushed to `origin/main` (`3a82074..da04b1b`).
- **Deployment:** Vercel project `jetstash-new`, deployment `dpl_9XCT9pnrjDSuBUpHhhD3qiryYvfm`, status Ready.
- **Live verification:** 2026-07-13, ~13:00–14:00 Europe/London (BST), against `https://jetstash.co.uk`. Full URL-by-URL evidence table in `docs/TRUTH_RESET_PHASE_1.md`'s "Production deployment and live verification" section. No discrepancies or regressions found in anything checked.
- **Per-blocker status:** updated individually above — not blanket-closed. 11 blockers production-verified, 2 deployed-but-not-individually-live-retested, 1 unaffected (TR-017, explicitly out of scope), several genuinely open regardless of this deployment (TR-006/007's underlying directness, TR-010's Saudia gap and BA's termination-date claim, TR-011's actual email-send behaviour, TR-014's data-freshness ceiling, the wider route-verification backlog).
- **Git status at time of this record:** working tree clean except this in-progress documentation update (`docs/LAUNCH_BLOCKERS.md`, `docs/TRUTH_RESET_PHASE_1.md`) and the pre-existing untracked `public/concepts/`. HEAD at `da04b1b`, matching `origin/main`.
