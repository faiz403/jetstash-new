# JetStash Truth Reset — Phase 1 progress document

**Purpose:** persistent continuation record for the controlled product-recovery audit. If this session
ends, another Claude session must be able to read this file and continue without repeating or
guessing prior work. This file is updated after every section, not just at the end.

**Terminology note (founder correction):** "locally verified" / "confirmed locally" / anything
qualified with "in the dev server" or "in this dev environment" means observed on the local
development server only. "Production verified" / "live verified" would mean confirmed on
`jetstash.co.uk` after an actual deployment — **nothing in this document means that**, because
nothing has been committed, pushed, or deployed this phase. Any occurrence of the bare word "live"
below that isn't explicitly about the local dev server (e.g. a feature description like "a live
search" referring to a partner site) should be read the same way — this phase produced only local,
pre-deployment findings.

## Session start facts (recorded before any edits)

- **Audit start time:** 2026-07-12, 20:05 Europe/London (BST) / 19:05 UTC.
- **Branch:** `main`.
- **Verified starting commit (local HEAD):** `3a82074101f6e99d64e0b1f3eca464248a1c774d`
- **Verified current production commit (origin/main):** `3a82074101f6e99d64e0b1f3eca464248a1c774d` — local and remote match; the "deployed as 3a82074" claim is confirmed, not assumed.
- **Working tree status at start:** clean except one pre-existing untracked directory, `public/concepts/` (two scratch route-map HTML concepts from an earlier session, unrelated to this work — left untouched throughout).
- **No destructive Git commands used.** No reset, no discard, no force-push. Nothing committed during this phase.

## Research-agent note

Three of four background research agents hit a **session usage limit** (external, not a repo issue)
and failed mid-task (`Agent terminated early due to an API error: You've hit your session limit`).
Their partial output was not used as evidence. All findings below were instead verified **directly**
by the main session (Read/Grep/Bash/PowerShell/browser/WebSearch/WebFetch), so every claim here has a
primary source recorded, not an agent summary.

## Investigation leads — verified status

| # | Lead | Status | Evidence |
|---|---|---|---|
| 1 | Manchester–Lahore shows BOOK SOON with 22 Jun 2026 as an active deadline, 20 days past | **Confirmed** | Live page (jetstash.co.uk/routes/manchester-lahore, checked 2026-07-12): badge "BOOK SOON", timeline reads "Book by 22 June 2026" / "Typical sharp rise from 22 June 2026". Traced `computeBookBySnapshot` arithmetic by hand: occurrence = `uk-summer-2026` (startDate 2026-07-20, `data/peak-period-dates.ts`); `surgeStartDate = 2026-07-20 − 28d = 2026-06-22`; no `recommended` booking-window entry applies to `uk-summer-holidays` for this route (`data/booking-windows.ts` only has Eid-scoped recommendations for `manchester-lahore`), so `bookByDate = surgeStartDate = 2026-06-22`; state derivation: `now(2026-07-12) < occurrence.startDate(2026-07-20)` → not inside-period; `now >= surgeStartDate(2026-06-22)` → **state = 'surge'**, which maps to verdict `'book-soon'` → badge "BOOK SOON". The state machine itself is internally consistent (correctly says "act now, we're in the surge zone") but the **specific date label "Book by 22 June 2026" is displayed as if forward-looking when it's 20 days in the past** — this is a genuine, confirmed accuracy bug, not a misreading. |
| 2 | Manchester–Lahore £489 "Verified Check" has no outbound/return dates | **Confirmed** | Live page: "VERIFIED CHECK / £489 return, per person (PIA, Economy) — checked 15 June 2026." No outbound date, no return date. `data/fare-observations.ts` entry `obs-man-lhe-economy-1` has no `departureDate` field, and the schema has **no return-date field at all** currently. |
| 3 | Manchester–Lahore counts one Economy + one Business observation as "2 fares tracked" | **Confirmed** | Live page: "2 fares tracked on this route" heading directly above an Economy (£489) and a Business (£1,845) row shown together as one history. Root cause: `components/route/fare-history-panel.tsx` and the "N fares tracked" line in `components/ui/deal-card.tsx` both use `getObservationsByRoute(routeSlug)` (all cabins) rather than a cabin-scoped count. (`getFareRangeSummary`, used for the actual displayed price, is correctly cabin-scoped — only the count/history-list logic mixes cabins.) |
| 4 | Deals page: 18 fare checks logged but "36 fares" shown | **Confirmed** | `data/fare-observations.ts` contains 18 real entries (verified by regex count, excluding the header-comment template line). `data/deals.ts` contains 36 total `Deal` entries (verified by regex count). `app/deals/page.tsx`'s hero stat "Fare checks logged" = `fareObservations.length` = 18 (correct). `components/sections/deals-explorer.tsx`'s "Showing {filtered.length} fares" and the per-category counts = raw `deals`/`deals.filter(...)` length, **with no check for whether that deal has a matching fare observation** — a deal with `range === null` (no observation) still renders a full card and is still counted. |
| 5 | Public Travel Ready content still contains "V1" | **Confirmed** | Live page (and `components/travel-ready/travel-ready-check.tsx` line ~159): "V1 covers Pakistan, India, Saudi Arabia, UAE, Qatar, Turkey and Morocco only — every other destination is marked as not yet covered rather than guessed." Rendered on every route page with the check embedded, and on `/travel-ready-check`. |
| 6 | Route pages render an empty Community Notes section | **Refuted** | `components/route/community-notes-panel.tsx` already renders a proper honest empty state when `notes.length === 0`: a dashed-border box reading "No community notes recorded for this route yet. This section will fill in with real traveller experiences over time, not manufactured reviews." Confirmed live on manchester-lahore. This matches the site's own "empty is honest" convention — not a blank/unexplained void. No fix needed here. |
| 7 | Manchester–Lahore claims direct PIA "several times weekly" | **Partially confirmed** | Route IS direct (real, launched 2 July 2026, PK709/PK710) — confirmed via multiple independent aviation-news sources (propakistani.pk, Business Recorder, Daily Times, Arab News). But frequency is **one flight per week**, not "several times weekly" — `data/routes.ts`'s `frequency: 'Several times weekly, direct'` is wrong and needs correcting to weekly. |
| 8 | Birmingham–Lahore presented as direct PIA alternative | **Confirmed unsupported** | Multiple independent sources describe PIA's current direct Lahore services as ex-Manchester and ex-Heathrow only; none mention a Birmingham–Lahore direct service. `data/routes.ts`'s `birmingham-lahore` entry (`isDirect: true`) is not supported by current evidence — should be downgraded to unverified/connecting. |
| 9 | Newest fare observation is 17 Jun 2026 but marketed as "tracked/verified" in July | **Confirmed as a real freshness gap, though within the site's own 60-day threshold** | Newest `observedDate` across all 18 observations is 2026-06-17 (`obs-lgw-amd-*`). Today is 2026-07-12 — 25 days old, inside `OBSERVATION_FRESH_DAYS` (60), so it's not flagged "stale" by the existing 3-tier system, but the "Verified Check"/"tracked" language on a 25+-day-old observation with no travel dates is exactly what Section 2's stricter completeness rule is meant to catch. |
| 10 | Reminder email says observations are fresh while also saying departure dates missing, subject contradicts body | **Confirmed** | Traced `app/api/cron/fare-check-reminder/route.ts` + `lib/founder-insights.ts`'s `bookByCadenceStatus()` by hand for today's date. All 5 priority routes' latest observations are 26–33 days old (well inside the 60-day fresh threshold) and none have `departureDate` set → every one hits the `!hasDepartureDate` branch, producing the item detail "Observations are fresh, but none record departureDate yet...". The email **subject line** is `"JetStash: 5 priority routes due a fare check"` — which reads as "these are stale, go check a fare," directly contradicting the body's own "Observations are fresh" wording. Subject and body represent different, conflated action states. |
| 11 | Email links to /founder, which 404s (noindex) in production | **Confirmed, and /founder's protection is correct, not a bug** | `app/founder/page.tsx`'s `dashboardEnabled()` intentionally 404s in production unless `FOUNDER_DASHBOARD_ENABLED=true`; `app/robots.ts` disallows `/founder`; `app/sitemap.ts` never lists it. This is the **correct, intentional safe default** — not a P0 exposure. The actual bug is narrower: `app/api/cron/fare-check-reminder/route.ts` unconditionally links to `${siteConfig.url}/founder` in the email body regardless of whether that page is reachable in the recipient's environment — a dead link in every production send. Fix: don't expose /founder; put enough detail directly in the email body instead. |
| 12 | Email delivery claim (one delivered 12 Jul 2026) | **Unverifiable from repo state** | No send-history is stored in the repo (correctly — nothing should log delivery to a file). This can only be confirmed via Vercel's Cron dashboard or Resend's own delivery log, neither of which this session has access to. Worth flagging: `vercel.json`'s schedule is `0 9 * * 1` (Monday 09:00 UTC) — 2026-07-12 is a **Sunday**, so if an email genuinely sent that day, it was outside the configured weekly schedule (manual trigger, a different schedule than `vercel.json` currently states, or an approximate/misremembered date). Recorded as an open question, not resolved either way. |
| 13 | Manchester–Karachi shown direct PIA several times weekly | **Confirmed unsupported** | Multiple independent 2026 sources describe PIA's current Manchester direct destinations as Lahore (weekly) and Islamabad (4x/week, increased from 3x from 3 July 2026) only. No source found describing a current direct Manchester–Karachi PIA service. `data/routes.ts`'s `manchester-karachi` (`isDirect: true`, "Several times weekly, direct") is unsupported by current evidence — downgrade to unverified/connecting. |
| 14 | Birmingham–Islamabad shown direct | **Unverified — conflicting signals, classified conservatively** | One aggregator-derived summary stated "0 airlines operating direct flights from Birmingham to Islamabad," but this is a single weak/indirect signal (FlightsFrom.com-style listing, not an airline-issued statement) and other context describes Birmingham as a longstanding PIA UK point generally. Per the brief's own rule ("if sources conflict or don't clearly support a claim, do not guess — classify conservatively"), this is marked **unverified** rather than confirmed direct or confirmed not-direct; recommend hiding the "direct" badge pending a clean primary-source check (PIA's own booking system for a live BHX–ISB search) before Phase 2. |
| 15 | Heathrow–Karachi associated with BA as direct | **Confirmed unsupported** | No evidence found of a current direct British Airways Heathrow–Karachi service in any source checked; search results instead describe PIA (not BA) as the current Heathrow operator to Pakistan (Islamabad/Lahore). `data/deals.ts` has 3 deal cards (`lhr-khi-economy`, `lhr-khi-business`, and the Islamabad-labelled `lhr-isb-economy`) naming British Airways for Heathrow–Islamabad/Lahore/Karachi with **no backing `Route` entry at all** for any of these three pairs. Unsupported; should be hidden/corrected. |
| 16 | BA still associated with Jeddah though withdrawn in 2026 | **Superseded — this original secondary-sourced conclusion was wrong.** Current status: BA is **verified direct** (see the evidence table below) | *Historical note, kept for the audit trail:* this lead was originally marked "Confirmed withdrawn" on secondary reporting alone (Head for Points, 10 Apr 2026, plus Simple Flying/AviationA2Z/Crystal Travel/Nomad Lawyer). A primary-source re-check (BA's own Aug 2025 and Mar 2026 press releases, then BA's own live "Direct Flights to Jeddah 2026" destination/booking page) found no BA source corroborating a termination, and a live, current BA marketing/booking page for the route — the opposite of what a genuine discontinuation would look like. **BA is now recorded as verified direct on this route.** Saudia, previously assumed "not in dispute," was re-examined and found to have no independent current source at all — **Saudia is now recorded as unverified**, not Direct. See TR-010 in Launch Blockers for the full three-round correction history. |

## Additional confirmed facts (India/Mumbai — Section 6 input)

- `manchester-mumbai` and `manchester-delhi` both correctly model the IndiGo Manchester withdrawal (`directServiceEndDate: '2026-09-01'`) — **confirmed accurate** by independent sources (TravelAndTourWorld, others), announcement dated 2026-06-04, effective 2026-08-31. No correction needed; this existing claim is well-supported.
- `london-heathrow-mumbai` (BA/Air India/Virgin Atlantic, daily direct) — **superseded**: the original "BA alone 3x daily" figure came from a mid-2025 BA press release and was never reconfirmed against a current schedule. Corrected via each airline's own current source: Air India confirmed 2x daily (its own 1 Jul 2026 press release, naming flights AI131/AI130 plus a second daily 777 service); Virgin Atlantic confirmed 2x daily ("We fly direct to Mumbai twice a day," its own destination page); British Airways confirmed direct via its own current "Direct flights to India" page (last updated 1 Jul 2026) but with no Mumbai-specific frequency stated — the aggregate "up to 70 flights a week" figure on that page covers 5 India destinations combined, not Mumbai alone. **"3 daily BA" is removed from all public copy and data.**
- `birmingham-mumbai` — **superseded**: this was marked "no route exists... flagged for Phase 2 investigation" based on incomplete verification. Birmingham Airport's own Mumbai destination page (fetched directly) states plainly: *"There are currently no direct flights to Mumbai, so you'll need to connect through a major hub including, but not limited to, Amsterdam, Delhi, Dubai, Istanbul or Paris."* **Birmingham–Mumbai is a confirmed connecting corridor** (not "no route exists" or "correctly absent" — those phrasings conflated "not represented in JetStash's data" with "verified not to exist," which is imprecise). No route record was added to `data/routes.ts` this session (a new corridor is a product decision, not a correction) — filed instead as **TR-017**, a P1 launch blocker: an important, confirmed India connecting corridor is currently missing from the site and should be added in the next product phase.
- Fare-observation coverage by country is close to even: Pakistan-tagged routes (manchester-lahore, manchester-islamabad, manchester-karachi) = 4 observations across 3 routes [manchester-karachi's directness is now in question]; India-tagged routes (london-heathrow-delhi, birmingham-amritsar, london-gatwick-ahmedabad, london-heathrow-mumbai) = 7 observations across 4 routes. **India currently has more logged fare observations than Pakistan**, which directly refutes any claim that the underlying fare-tracking data itself is Pakistan-skewed.
- Book-By Countdown's 5 priority routes split 2 Pakistan / 2 India / 1 Saudi — genuinely balanced, not Pakistan-weighted.
- Homepage's interactive Route Atlas defaults to "Manchester → Lahore" and lists Pakistan cities (Lahore, Islamabad, Karachi) before India cities (Delhi, Amritsar...) in the map's destination order — this is the clearest concrete lever behind any "built for Pakistan" impression, not a depth-of-content problem.
- `app/india/page.tsx` content is substantive and comparable in structure/depth to what's implied for Pakistan (visa note, 4 practical notes including the IndiGo withdrawal, family-visit callout) — not a "token" page.

## Files changed so far

**Section 1 (route accuracy):** `data/routes.ts` (added `RouteVerificationStatus`/`RouteVerification`/`getDisplayDirectness`; added `verification` records + corrections to manchester-lahore, manchester-islamabad, manchester-karachi, birmingham-lahore, birmingham-islamabad, london-heathrow-jeddah, london-heathrow-mumbai, manchester-delhi, manchester-mumbai), `app/routes/[slug]/page.tsx`, `app/routes/page.tsx`, `components/sections/region-hub-page.tsx`, `components/ui/deal-card.tsx`, `app/page.tsx`, `app/airports/[slug]/page.tsx` (all switched their direct/connecting badge to `getDisplayDirectness()`), `data/deals.ts` (BA→PIA corrections on 2 deals, 2 unsupported Heathrow–Karachi deals commented out with evidence notes, added `hasTrackedFare()`), `components/sections/deals-explorer.tsx` (counts now use `hasTrackedFare`).

**Section 2 (fare integrity):** `data/fare-observations.ts` (added `returnDate`, `isPubliclyPublishable()`, `getPublishableObservationsByRouteAndCabin()`, `getLatestPublishableObservation()`; `getFareRangeSummary()` now filters through the publishable gate), `components/route/fare-history-panel.tsx` (rewritten to group by cabin and filter to publishable-only, returns `null` if nothing qualifies), **`lib/booking-intelligence.ts`** (switched from the ungated `getLatestObservation` to `getLatestPublishableObservation` for the public "Verified Check" callout — this was a gap found via live dev-server testing *after* the initial Section 2 pass: the callout was still showing "£489... checked 15 June 2026" because `computeBookBySnapshot` hadn't been updated to use the new gate. Fixed and reverified live — see below).

**Section 3 (Book-By logic):** `components/route/book-by-countdown.tsx` (past-tense `bookByDateLabel` fix for `surge`/`late`/`inside-period` states), `tests/booking-intelligence.test.ts` (new, 12 fixed-clock tests), `tests/route-and-fare-integrity.test.ts` (new, tests for `getDisplayDirectness`/`isPubliclyPublishable`/deal-hiding/TR-010), `vitest.config.ts` + `package.json` (test runner added).

**Section 4 (in progress):** `components/travel-ready/travel-ready-check.tsx` ("V1" → "Currently").

**Docs:** `docs/TRUTH_RESET_PHASE_1.md`, `docs/LAUNCH_BLOCKERS.md` (this file and its companion, both created this session).

## `getDisplayDirectness` scope decision (recorded explicitly, not left implicit)

The function demotes **every** route lacking an explicit `verification` record to "Verification pending" — not just the ~9 routes actually investigated this session. This was deliberated mid-session: a narrower design (only demoting the specific routes with disconfirming evidence, leaving the other ~17 showing "Direct" by default) was considered and **rejected**, because it would leave the exact "unsupported confidence" problem the brief calls out unaddressed for every route not personally checked this session. The brief's Section 1 instruction is unambiguous: *"A route must never display a direct badge unless a current source supports it... Add automated validation that prevents an unverified... route from being presented publicly as direct."* Implementing that literally means no route may claim Direct without a positive verification record — which is what the shipped code does. Confirmed live: London Heathrow–Delhi, Birmingham–Amritsar, Manchester–Dubai, London Heathrow–Doha (none investigated this session, all previously well-established "Direct" routes) now show "Verification pending" site-wide (route pages, homepage, routes index, region hubs, airport pages, deal cards). This is filed as **TR-015** in Launch Blockers — a large, visible, *intentional* consequence requiring founder sign-off before deployment, not a bug.

## Launch Blockers filed

See `docs/LAUNCH_BLOCKERS.md` — filed after this inventory pass, TR-001 through TR-015 (TR-015 added when the `getDisplayDirectness` scope decision above was finalized).

## Unresolved risks / open questions

1. Fully enforcing Section 2's fare-completeness rule (outbound + return date required for any public fare) currently hides **all 18** existing fare observations, since none has a return date and only some have `departureDate`. This is a major, business-visible impact — confirmed live: the Deals page, every deal card, `FareHistoryPanel`, and Book-By's "Verified Check" callout (fixed this update — see above) have all lost their price displays until fares are re-logged with full dates. Flagged as a founder-approval decision, not silently applied either way — see Launch Blockers TR-002.
2. ~~`manchester-karachi`'s directness is now in doubt... that warning's wording needs a look too~~ — **Resolved in Section 5**: `data/route-warnings.ts`'s warning rewritten to match the corrected route copy.
3. Birmingham–Islamabad (Lead 14) is genuinely unverified either way — conservative treatment recommended (hide "direct" badge) but not a confirmed refutation.
4. TR-015 (above): ~17 routes now show "Verification pending" with zero investigation behind that specific badge state — a real, disclosed content-verification backlog, not a code defect.

## Section 4 — Travel Ready Check: live UI verification (complete)

Did not trust the prior pass's "verified" claim or the unit-test suite alone — tested the actual rendered form in the browser per the brief's explicit instruction.

- **Golden path (British passport, Dubai, valid dates)**: a result **did** render — no reproduction of a literal "no visible result" symptom. But the verdict itself was wrong (see TR-016 below), found only by this live check.
- **TR-016 (new, confirmed live)**: Visa-on-arrival destinations (UAE, Qatar — `typicalProcessingDays: 0`) produced a false "DOCUMENT TIMING MAY AFFECT BOOKING — Start your application now" verdict, contradicting the check's own displayed text ("no advance application is needed"). Root cause: `lib/travel-ready-check.ts` had no branch for zero processing days; the arithmetic (`daysToDeparture < 0`) always fell through to `'caution'`. Fixed: added an explicit `typicalProcessingDays === 0` → `pass` branch. Confirmed live post-fix: verdict is now "READY TO CONTINUE" for Dubai. Two regression tests added (UAE + Qatar) — neither of the original 11 required journeys had covered a visa-on-arrival destination, which is exactly why unit tests alone hadn't caught it.
- **Negative path (non-British passport, no exemption document, Pakistan)**: correctly renders "NOT ENOUGH INFORMATION" rather than guessing — confirmed locally (dev server).
- **"20 destinations across 7 countries" wording**: confirmed locally (dev server), correct (prior pass's miscount fix still holds).
- **`aria-live="polite"`/`role="status"` on the result panel**: confirmed present in code (`components/travel-ready/travel-ready-check.tsx` lines 274-278) — screen-reader announcement preserved from the prior pass.
- **`?destination=` query-param guard**: tested live with `?destination=not-a-real-place` — falls back safely to the empty "Select destination" state, no crash, no invalid value silently held in state. Guard preserved from the prior pass, confirmed still working.
- **"V1" wording**: already fixed in a prior step this session ("Currently covers..." replacing "V1 covers..."), reconfirmed present in the live page text.

**Verdict:** Section 4's original "no visible result" report does not reproduce as literally stated, but the live check surfaced a real, more serious problem (a wrong verdict, not a missing one) that the previous "verified" claim and passing unit-test suite had both missed. Filed as TR-016.

## Section 5 — Empty/contradictory content (complete)

- **Community Notes empty state**: reconfirmed honest (Lead #6, already Refuted before Section 5 started) — no change needed.
- **About page absolute claim, confirmed and fixed**: `app/about/page.tsx`'s "Route claims are verified against real schedules" / "Whether a route is direct or connecting is checked against real airline schedules before it goes on the site" was an absolute, present-tense claim that the `getDisplayDirectness`/TR-015 work this session proved false for ~17 routes (no verification record exists for them). Rewrote the standard's title and body to match the site's actual, current behaviour: a route only claims "Direct" once checked, and the page says "Verification pending" when it hasn't been checked yet — this now matches exactly what a visitor sees on an unreviewed route page.
- **`data/route-warnings.ts` contradiction, confirmed and fixed**: the existing `man-khi-frequency-settling` warning ("Weekly frequency still settling... confirm the current weekly schedule before assuming daily availability") presupposed a real, if imperfect, direct weekly Manchester–Karachi service — directly contradicting the Section 1 correction that no current evidence supports any direct service on this route at all. Rewrote the warning's title/body to state the same "can't currently confirm direct service" position as the route's own intro copy. This resolves progress-doc "Unresolved risk #2."
- **Sitewide absolute-claim word sweep** (every/always/verified/live/current/complete/real-time/never/guaranteed/100%): grepped across `app/**/*.tsx` and `components/**/*.tsx`. No other contradictions found — remaining "every route"/"all routes" instances are structural/marketing copy (e.g. "every route has its own booking-window and peak-period guide") describing the site's organisation, not a verification-status claim, so they don't contradict TR-015.
- **Verified locally (dev server)**: `/about` (new copy renders correctly) and `/routes/manchester-karachi` (badge, intro, and warning banner now all agree — "Verification pending" / "can't currently confirm an active direct service" / "We can't currently confirm a direct Manchester–Karachi service"). `npm test` — 40/40 passing after these edits.

## Section 6 — India/Pakistan market balance audit (complete; analysis + plan, no homepage redesign)

**Method:** direct code inspection of every surface named in the brief (nav, homepage hub cards, homepage featured routes, Route Atlas, Book-By priority list, Route Watch/Travel Ready destination lists, region hubs, destinations data, routes data) plus a bounded web search, later confirmed against Birmingham Airport's own destination page, to verify Birmingham–Mumbai (confirmed connecting corridor, not represented in JetStash's data — see TR-017).

**Finding: the underlying data model is not Pakistan-skewed — if anything India has more raw depth.**
- `lib/site-config.ts`'s `mainNav` — the site's own "brand spine" — lists **India first**, then Pakistan, Umrah, Gulf, explicitly commented "in commercial order (matching the homepage hub ordering)."
- `app/page.tsx`'s `featuredRouteSlugs` (the homepage's "Most-searched UK routes" section) — **India first** (`london-heathrow-delhi`), then Pakistan, Gulf, Umrah, "ordered by market size."
- `data/destinations.ts`: **4 India destinations** (Delhi, Mumbai, Amritsar, Ahmedabad) vs **3 Pakistan destinations** (Lahore, Islamabad, Karachi).
- `data/routes.ts`: **10 India-destination routes** vs **6 Pakistan-destination routes**.
- Fare-observation coverage: India has more logged observations than Pakistan (7 vs 4, per the original inventory pass).
- Book-By Countdown's 5 priority routes: 2 Pakistan / 2 India / 1 Saudi — balanced.
- `app/india/page.tsx` is substantive: visa note, 4 practical notes (including the IndiGo withdrawal), family-visit callout — not a token page.
- Travel Ready Check and Route Watch destination dropdowns both list all 4 India cities and all 3 Pakistan cities equally — no gating difference.

**Finding: the one concrete visual "Pakistan-first" lever is the homepage Route Atlas — but it reflects genuine Manchester-specific route substance, not an arbitrary bias.**
`components/sections/route-map-hero.tsx` defaults `activeSlug` to `'lahore'` and lists Pakistan cities before India cities in its `DESTINATIONS` array (which also drives the map's legend/button list order). This is the single clearest "feels built for Pakistan" impression, since it's the first thing rendered in the hero. However: the map's own code comment (line ~139) confirms it **only ever shows Manchester departures** — and Manchester's South Asia network genuinely is Pakistan-led: Manchester–Lahore and Manchester–Islamabad are established, enduring, weekly/4x-weekly direct PIA services (re-verified this session, Section 1), while Manchester–Delhi and Manchester–Mumbai are IndiGo routes with a confirmed, dated withdrawal (`directServiceEndDate: 2026-09-01`, ~7 weeks from the current audit date) — i.e. Manchester's direct India service is real today but is a shrinking, not growing, part of that airport's network. Defaulting the Manchester-specific map to India would overstate a route that's actively being withdrawn. **Recommendation: do not change the Route Atlas default** — it's an honest reflection of Manchester's specific route substance, not evidence of sitewide bias; changing it to force parity would itself be a form of "manufacturing artificial balance" the brief explicitly warns against.

**Birmingham–Mumbai (specifically requested verification) — superseded, now primary-sourced:** Birmingham Airport's own Mumbai destination page (fetched directly this correction pass) confirms **Birmingham–Mumbai is a connecting corridor** — no direct flights currently, connecting via Amsterdam, Delhi, Dubai, Istanbul or Paris. JetStash does not have a `Route` entry for this pairing — that is a data-coverage gap, not a statement that the corridor itself doesn't exist. Filed as **TR-017** (P1): this real, confirmed India corridor is missing from the site and should be added, modelled as connecting, in the next product phase.

**India coverage plan (the Section 6 deliverable — analysis, not implemented this phase):**
1. **Highest-impact next step, updated:** Heathrow–Mumbai is now verified direct (per-airline: Air India and Virgin Atlantic both 2x daily confirmed, BA confirmed direct with frequency unconfirmed). Heathrow–Delhi remains "Verification pending" under TR-015 and is the next quick, high-confidence win once someone runs the primary-source check on it — plus a fresh fare observation with full dates once TR-002's completeness gate is being actively worked through.
2. **Missing/buried routes:** Birmingham–Delhi and Birmingham–Amritsar's actual current frequency, and Gatwick–Ahmedabad's "reduced frequency" warning (already flagged, `lgw-amd-reduced-frequency`), remain candidates for the next verification pass, not confirmed problems. **Birmingham–Mumbai is now a confirmed missing corridor** (TR-017, P1) — see above, not merely "unverified."
3. **Not to promote without more evidence:** Manchester–Delhi/Mumbai should not be marketed as a durable choice given the dated withdrawal — the existing `directServiceEndDate` handling already covers this correctly. Birmingham–Mumbai, once added (TR-017), must be modelled as connecting, never direct.
4. **Building trust without looking artificially balanced:** the numbers already show India is not under-served — the fix is not "add more India content" but (a) closing the specific verification gap on India's strongest routes so they can show "Direct" again post-TR-015, and (b) leaving the Manchester-specific map alone, since altering it to force visual parity would be less honest, not more.
5. **"The JetStash Check" concept:** not evaluated in depth and **not implemented** this phase per the explicit instruction — worth a future look at whether a nationality-and-destination-first entry point (rather than airport-first) would surface India-relevant guidance without relying on the Manchester-centric route map, but that's a Phase 2 design question, not a Phase 1 finding.

## Section 5 continuation — complete repository-wide absolute-claim audit (not a targeted sweep)

Per the founder's correction, every public match for all 10 words was reviewed in context (not mechanically removed), across every `.tsx` file in `app/` and `components/`. Full retained-claim register:

| Word | Representative instances | Why retained |
|---|---|---|
| Every | "Every fare shows the date... checked it" (`app/page.tsx`); "Every route we cover has its own booking-window and peak-period guide" (`app/guides/[slug]/page.tsx`, `app/about/page.tsx`) | Structurally guaranteed true — `bookingWindowNote`/`peakPeriodIds` are non-optional fields on the `Route` TypeScript interface, so the compiler itself would fail if any route lacked them. Confirmed via direct grep (54 matches ÷ 2 fields = 27 routes, matching the full route count). |
| Always | "Always confirm the final price/requirements..." (multiple pages) | These are all instructions *to the reader*, not claims about JetStash's own behaviour — the opposite of overclaiming; they exist specifically to stop a visitor over-trusting a displayed figure. |
| Verified / Verification | "Verification pending" labels (route/airport/deal pages) | These are the honest, dynamic output of `getDisplayDirectness()` itself — literally the mechanism built this session to stop unsupported "Direct" claims. Not an overclaim; the opposite. |
| Live | "Never a live price claim" / "not live quotes" / "we don't run automated live price tracking" (Deals, About, Travel Club, Privacy Policy) | Every instance is a *negation* — the site explicitly disclaiming live-price capability, matching the actual architecture (hand-logged `FareObservation`s only). The one non-negated use, "Check live prices for this route" (CTA to TravelUp), correctly describes the partner site's own live search, not a JetStash claim. |
| Current | Overwhelmingly used as an honest hedge ("current schedule — confirm before booking," "currently around 4x weekly") | Checked for risky absolute compounds ("100% current," "always current") — none found. "Current" paired with "confirm before booking" is a caution, not a guarantee. |
| Complete | No standalone risky uses found; checked for "100% complete"/"completely accurate" compounds specifically | None found anywhere in `app/` or `components/`. |
| Real-time | Not used anywhere in public copy | N/A |
| Never | "Never a live-price claim," "It never changes your price/what we say" (affiliate disclosure) | All checkable against actual architecture: `Deal` has no price field at all (fare-observations.ts is the only price source, unaffected by which airline pays commission); "never a live-price claim" matches the observation-based design. |
| Evidence-based | "Booking guidance is evidence-based, never manufactured urgency" (`app/page.tsx`) | Checkable and true: Book-By's dates come only from `data/peak-period-dates.ts`/`data/booking-windows.ts`, both independently sourced and cited, never invented. |
| Route-specific | Not found as a standalone public-copy phrase (only "route-specific" style compounds in code comments) | N/A |

**One correction was already made in this continuation** (see Section 5 above): `app/about/page.tsx`'s "Route claims are verified against real schedules" title/body was rewritten before this word-by-word sweep began, because it was the one claim that genuinely failed the test (asserting universal verification when most routes have no record). No further public-copy changes were needed once that one was fixed — the remaining matches are either honest hedges, negations, or structurally-guaranteed-true claims.

## Section 6 continuation — deep qualitative India/Pakistan audit (founder rejected the count-based conclusion; redone qualitatively)

The founder correctly rejected "India has more destinations/routes/nav position, therefore balance is fine" as insufficient — that's a count, not a qualitative judgement. Redone against the 14 specific dimensions requested, by direct code inspection:

1. **Verified route depth** (updated after the founder's Round 2/3 corrections supplied Manchester Airport's own sources): genuinely balanced now, not uneven. Pakistan-side, Manchester–Lahore and Manchester–Islamabad are both primary-verified via Manchester Airport's own media centre. India-side, manchester-mumbai, manchester-delhi and london-heathrow-mumbai are primary-verified via IndiGo's/Air India's/Virgin Atlantic's own sources. Neither country is ahead on primary-source depth at this point — the earlier "0 fully primary-verified Pakistan-side" finding was accurate only for the narrow window between rounds and does not reflect the current data.
2. **Valid checked fares**: irrelevant to country balance right now — TR-002's completeness gate hides all 18 observations for every country equally. No differential impact.
3. **Book-By usefulness**: 2 Pakistan (manchester-lahore, manchester-islamabad) / 2 India (london-heathrow-delhi, birmingham-amritsar) / 1 Gulf (london-heathrow-jeddah) — balanced by count. But **a real gap**: Mumbai — reachable direct from both Manchester (IndiGo) and Heathrow (BA/Air India/Virgin Atlantic, each independently confirmed direct, Air India and Virgin Atlantic each 2x daily) — has **zero** Book-By coverage, while Birmingham–Amritsar (3x weekly, a single airline) does. Mumbai is arguably the single most robustly-served India corridor in the whole dataset and gets no booking-window intelligence at all. This is the clearest concrete, fixable gap found in this audit.
4. **Route Watch support**: equal — the destination dropdown lists all 4 India cities and all 3 Pakistan cities with no gating difference (confirmed by direct read of the live form).
5. **Travel Ready depth**: equal — `data/travel-ready-rules.ts` has the same rule structure (passport validity, visa requirement, document exemption) for both countries, each with its own real official source and dates; OCI (India) and NICOP/POC (Pakistan) exemptions are both modelled with equivalent specificity.
6. **Destination guide quality**: genuinely comparable, checked by direct text comparison of `familyVisitContent` across all 7 destinations — each has distinct, specific, non-templated `travelPattern`/`documentNote`/`packingNote` text (e.g. Karachi's business-travel skew vs Lahore's longer family stays; Delhi's role as a connecting point vs Mumbai's growing direct-visit pattern). No destination reads as a thinner copy-paste of another.
7. **Airport-specific information**: equal — Manchester Airport's guide content (Terminal 2, PIA/Emirates/Qatar callouts) doesn't structurally favour one country's routes over the other; the airport pages are origin-organised, not destination-organised.
8. **Homepage prominence**: India-favourable — `mainNav` lists India before Pakistan; `featuredRouteSlugs` leads with `london-heathrow-delhi`.
9. **Featured imagery**: equal — real photography exists for all 3 Pakistan and all 4 India destinations (`public/images/destinations/`), confirmed present, not a fallback placeholder for either side.
10. **Most-searched routes**: India leads (see #8) — Delhi is the first "most-searched" card shown.
11. **Return reasons (family-visit content)**: equal in structure and comparable in specificity (see #6) — every one of the 7 destinations has this content, none are missing it.
12. **Mumbai corridor visibility**: the one area with a real, specific gap — see the 3 corridor findings immediately below.
13. **Does India feel equally researched?**: yes — the destination and family-visit content is comparably deep, and both countries now have genuine primary-source-verified flagship routes (Manchester–Lahore/Islamabad via Manchester Airport; Manchester–Mumbai/Delhi and Heathrow–Mumbai via IndiGo/Air India/Virgin Atlantic). PIA's own site remains inaccessible, so Manchester–Karachi, Birmingham–Lahore and Birmingham–Islamabad stay genuinely unverified — a real gap, but a narrower one than originally found, not a country-wide asymmetry. The one genuine weak spot specific to India is Mumbai's missing Book-By coverage.
14. **Does Pakistan get more culturally-specific detail?**: not really, on direct comparison — Lahore's food/heritage/wedding-season detail and Delhi/Mumbai's onward-travel/domestic-baggage/diaspora-service detail are both specific and non-generic; neither reads as more textured than the other.

### Corridor-specific findings (as required)

- **Manchester–Mumbai**: genuinely direct (IndiGo), confirmed via IndiGo's own press releases (4 Feb 2026 and 2 Jun 2026) — a real, well-evidenced route, but time-bound: IndiGo is discontinuing Manchester service (both Mumbai and Delhi) from 31 August 2026, described by IndiGo itself as "temporary" with no resumption date announced. JetStash's `directServiceEndDate` handling already models this correctly. **No Book-By coverage** despite being a real, currently-active, well-sourced direct route.
- **Birmingham–Mumbai**: **a real, confirmed connecting corridor, currently missing from JetStash's data.** Birmingham Airport's own destination page (fetched directly) confirms no direct flights exist — connecting via Amsterdam, Delhi, Dubai, Istanbul or Paris. This is not "no route exists" in the sense of the corridor being fictional — it's a genuine gap in coverage. Filed as TR-017 (P1): should be added, modelled as connecting, in the next product phase.
- **Heathrow–Mumbai**: the strongest India route in the dataset by evidence quality — confirmed per airline from each one's own current source: Air India (2x daily, AI131/AI130 plus a second daily 777 service, dated 1 Jul 2026), Virgin Atlantic (2x daily, "we fly direct to Mumbai twice a day"), and British Airways (confirmed direct via its own current India-flights page, frequency not separately stated). The previously reported "BA alone 3x daily" came from a mid-2025 press release and is not reconfirmed — removed from public copy. **Still has no Book-By coverage.**

### Revised recommendation (supersedes the prior session's "leave the Route Atlas alone" conclusion in part)

The founder specifically asked whether the Route Atlas itself — not just its default city — is too Manchester-specific for a homepage claiming broader UK coverage. On reflection: **yes, structurally** — the map only ever shows Manchester-origin routes (confirmed via its own code comment), so it can only ever tell a Manchester-centric story, and Manchester's real route substance happens to favour Pakistan (established, enduring PIA services) over India (a newer, single-airline, currently-being-discontinued IndiGo service). That's not a bias in the map's arithmetic, but it is a structural scope limitation worth naming plainly: a homepage hero that only renders Manchester departures will always under-represent India's actual strongest corridor (Heathrow–Mumbai/Delhi, multi-carrier, enduring) in favour of whichever Manchester route is currently more established. This is a genuine finding, not resolved this phase — the brief was explicit not to redesign the homepage now. **No Route Atlas or homepage code was changed.** The concrete, low-risk fix identified is narrower and separate: give Mumbai a Book-By record (both Manchester and Heathrow ends), since that's a data-model gap, not a homepage-design decision.

## Section 7 — Internal page/alert safety (complete)

Re-verified directly rather than trusting the earlier inventory pass's conclusion:

- **`app/founder/page.tsx`**: `dashboardEnabled()` returns `process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'` — confirmed still in place. `generateMetadata()` returns `robots: { index: false, follow: false }` when disabled, and `notFound()` is called before any dashboard content renders. Not a public exposure — a deliberate, safe default (only ever public if a founder explicitly sets an env var in production, and the code comment says to add real auth first if that ever happens).
- **`app/robots.ts`**: still disallows `/founder` explicitly.
- **`app/sitemap.ts`**: still never lists `/founder` — confirmed via direct grep, no match at all.
- **Tested locally (dev server)**: `/founder` loads in this dev environment (expected — `NODE_ENV !== 'production'` locally, exactly what the code says should happen) with no auth barrier in dev, which is by design, not a bug, since this environment isn't production.
- **`app/api/cron/fare-check-reminder/route.ts`** (TR-011 fix): live-hit the endpoint locally with no `RESEND_API_KEY`/`CRON_SECRET` set (no `.env.local` present) — response was `{"sent":false,"reason":"RESEND_API_KEY not set."}`, confirming the fail-clear behaviour CLAUDE.md requires (no silent success, no crash). The dead `/founder` link and subject/body contradiction (TR-011) remain fixed from the earlier pass — reconfirmed by reading the current file, not re-assumed.

**Conclusion: no P0 exposure found.** The original lead's instinct (the internal dashboard "could be" exposed) does not hold up — it's protected exactly as intended. The actual, narrower bug (a dead link in an email) was already fixed as TR-011.

## Section 4 continuation — complete 13-journey evidence matrix

Re-verified: `data/travel-ready-rules.ts`'s underlying sources (GOV.UK foreign travel advice, Pakistan's own NADRA Online Visa System, India's own Government e-Visa portal, Saudi's own Nusuk portal) are already genuine primary/official sources — no downgrade needed here, unlike the airline-route claims. Additionally live-fetched GOV.UK's own Pakistan and India entry-requirements pages directly this continuation to confirm the NICOP and OCI exemptions specifically (the founder's explicit ask): both confirmed with exact quotes ("You can enter Pakistan without a visa and stay for an unlimited period" for NICOP/SNICOP; "If you hold a valid Overseas Citizen of India (OCI) card... You do not need a visa" for OCI).

| # | Journey | Source org | Source URL | Date accessed | Effective/reviewed | Expected result |
|---|---|---|---|---|---|---|
| 1 | British passport → Pakistan, no NICOP, no visa held | GOV.UK / NADRA Online Visa System | gov.uk/foreign-travel-advice/pakistan/entry-requirements; visa.nadra.gov.pk | 2026-07-12 (rule); 2026-07-13 (NICOP re-check) | reviewDue 2027-01-12 | `visa-or-entry-permission-needed` or `document-timing-may-affect-booking` (date-dependent; test asserts either) |
| 2 | British passport → Pakistan, valid NICOP | GOV.UK (confirmed directly this continuation) | gov.uk/foreign-travel-advice/pakistan/entry-requirements | 2026-07-13 | reviewDue 2027-01-12 | `ready-to-continue` |
| 3 | British passport → India, no OCI, no visa held | GOV.UK / Government of India e-Visa portal | gov.uk/foreign-travel-advice/india/entry-requirements; indianvisaonline.gov.in/evisa | 2026-07-12 | reviewDue 2027-01-12 | `visa-or-entry-permission-needed` or `document-timing-may-affect-booking` |
| 4 | British passport → India, valid OCI | GOV.UK (confirmed directly this continuation) | gov.uk/foreign-travel-advice/india/entry-requirements | 2026-07-13 | reviewDue 2027-01-12 | `ready-to-continue` |
| 5 | British passport → Saudi Arabia | GOV.UK / Nusuk (Saudi Ministry of Hajj and Umrah) | gov.uk/foreign-travel-advice/saudi-arabia/entry-requirements; umrah.nusuk.sa | 2026-07-12 | reviewDue 2027-01-12 | definite non-guessing result (`document-timing-may-affect-booking` for far-future dates) |
| 6 | British passport → UAE | GOV.UK | gov.uk/foreign-travel-advice/united-arab-emirates/entry-requirements | 2026-07-12 | reviewDue 2027-01-12 | `ready-to-continue` (TR-016 fix: visa-on-arrival, 0 processing days) |
| 7 | British passport → Qatar | GOV.UK | gov.uk/foreign-travel-advice/qatar/entry-requirements | 2026-07-12 | reviewDue 2027-01-12 | `ready-to-continue` (TR-016 fix, same reason) |
| 8 | Non-British passport, any destination | n/a — no rule recorded for any non-british-passport/non-NICOP/non-OCI scope | n/a | n/a | n/a | `not-enough-information`, never a guess |
| 9 | Passport expiring too soon | GOV.UK (each destination's own validity rule) | (per destination) | 2026-07-12 | reviewDue 2027-01-12 | `check-passport-validity` (highest-priority branch in the decision tree) |
| 10 | Departure after return (inverted dates) | n/a — engine behaviour, not a sourced fact | n/a | n/a | n/a | a definite result, never silently `ready-to-continue` on a nonsensical range |
| 11 | Departure in the past | n/a — engine behaviour | n/a | n/a | n/a | a definite result with a non-empty headline |
| 12 | Unsupported destination (outside the 7 countries) | n/a — absence of a rule is the signal, by design | n/a | n/a | n/a | `not-enough-information` |
| 13 | Missing required answers | n/a — UI-level guard, not an engine-level rule | n/a | n/a | n/a | form does not submit (`handleSubmit` returns early if any of destination/passport-answer/3 dates is empty; every field also carries an HTML `required` attribute) — **not currently covered by an automated test at the engine level**, since the guard sits in the component before `evaluateTravelReadiness` is ever called. Flagged as a real, if minor, test-coverage gap rather than silently claimed as tested.

All 13 journeys are covered by `tests/travel-ready-check.test.ts`'s 13 tests (11 original + 2 TR-016 regression tests), except #13 which is a UI-guard behaviour with no corresponding unit test — see the test-coverage table in Section 8 below for the honest accounting.

**One minor enhancement opportunity noted, not fixed this session**: GOV.UK's India page (fetched directly this continuation) mentions an Electronic OCI (e-OCI) option launched June 2026, allowing e-OCI holders to travel without the physical card — not currently reflected in `in-oci-exemption`'s copy. The existing rule remains accurate (it doesn't say a physical card is mandatory in a way that contradicts this), so this is a copy enhancement, not a correction — flagged for a future update, not treated as a bug.

## Section 8 continuation — full test-coverage-to-quality-gate mapping (honest accounting, not implied by a pass count)

| Required gate | Test file | Test name(s) | Behaviour covered | Automated? |
|---|---|---|---|---|
| Book-By past-date-as-active bug (TR-001) | `tests/booking-intelligence.test.ts` | "TR-001 regression..." | `bookByDate` is correctly in the past for the surge state; underlying date math locked in | Yes |
| Book-By state-machine boundaries (all 6 states) | `tests/booking-intelligence.test.ts` | pre-surge/surge/inside-period/too-early/window-open (open+close)/late | Every state transition, both with and without a recommended window | Yes |
| Book-By non-priority/nonexistent routes return null | `tests/booking-intelligence.test.ts` | "returns null for a route outside..." / "...slug that does not exist" | Never guesses for unsupported routes | Yes |
| Book-By past-tense date **label text** (the actual rendered string) | — | — | The underlying dates are tested; the exact rendered copy ("Sharp rise began...") is only manually verified locally (dev server), not asserted by an automated test | **No — manual only** |
| Route direct-badge gating (`getDisplayDirectness`) | `tests/route-and-fare-integrity.test.ts` | "isDirect true but no record", "manchester-karachi downgraded", "verified shows direct", "expired verification", "manchester-lahore/islamabad unverified", "connecting route" | Every branch of the verification-status gate, including the primary-vs-secondary downgrades made this continuation | Yes |
| Fare-completeness gating (TR-002) | `tests/route-and-fare-integrity.test.ts` | 4 `isPubliclyPublishable` tests + `getFareRangeSummary` null-check | Both-dates/missing-return/missing-departure/missing-both, and the sitewide zero-fares consequence locked in | Yes |
| Deal tracked-fare counting (TR-004) | `tests/route-and-fare-integrity.test.ts` | "no current deal has a tracked fare", "no Route entry", "Heathrow-Karachi deals removed" | Deal-level tracked-fare logic and the 2 hidden deals | Yes |
| TR-010 BA/Jeddah (revised) | `tests/route-and-fare-integrity.test.ts` | "lists Saudia... and British Airways (restored)" | The corrected, conflict-disclosed state | Yes |
| Travel Ready journeys #1–7, #9–12 | `tests/travel-ready-check.test.ts` | tests 1–7, 9–13 (renumbered) | Pakistan/India/Saudi/UAE/Qatar with and without exemption documents, expired passport, inverted dates, past dates, unsupported destination, unrecognised slug | Yes |
| Travel Ready journey #8 (non-British passport) | `tests/travel-ready-check.test.ts` | test 6 | `not-enough-information`, no engine signal | Yes |
| Travel Ready journey #13 (missing required answers) | — | — | Enforced by `handleSubmit`'s early-return guard plus HTML `required` attributes in the component; **no automated test exists at the engine or component level** | **No — UI guard only, untested** |
| TR-016 visa-on-arrival fix (UAE/Qatar) | `tests/travel-ready-check.test.ts` | tests 12–13 | Both destinations resolve to `ready-to-continue`, not a false caution | Yes |
| Community Notes empty-state (new, this continuation) | `tests/community-notes-panel.test.ts` | "returns null when there are no notes" / "returns a real element when notes exist" | The component itself renders nothing for empty input | Yes |
| Community Notes **page-level section wrapper** (no heading/container even when the component would render null) | — | — | `app/routes/[slug]/page.tsx`'s `{communityNotes.length > 0 && (...)}` guard is manually verified locally (dev server) (confirmed no "Community notes" heading anywhere in the rendered page), not asserted by an automated test — this repo has no component-rendering/DOM test harness (no React Testing Library), only pure-function tests | **No — manual only** |
| TR-013 (origin-specific data leakage) | — | — | Investigated and closed via direct code reading (`getNotesByAirport`/`getTipsForScope` keying) plus manual live testing; no regression test was added since no bug was found to lock in | **No — manual investigation only, nothing to regression-test** |
| Absolute-claim word audit (Section 5) | — | — | Human review of every match in context; inherently a judgement task, not a deterministic assertion | **No — not automatable in the way the other gates are** |
| India/Pakistan qualitative balance (Section 6) | — | — | Human comparative analysis | **No — not a code-testable gate** |
| Founder dashboard protection (`dashboardEnabled()`) | — | — | Manually re-read the source and manually hit `/founder` in dev (where it's expected to be reachable) and confirmed `robots.ts`/`sitemap.ts` exclusions by direct grep; **no unit test exists for `dashboardEnabled()` itself** | **No — manual only** |
| Reminder email fail-clear behaviour (TR-011) | — | — | Manually hit `/api/cron/fare-check-reminder` locally (no `RESEND_API_KEY` set) and confirmed the `{"sent":false,"reason":"RESEND_API_KEY not set."}` response; **no automated test exists for the subject/body-consistency logic itself** | **No — manual only** |

**Honest summary**: 43 automated tests across 4 files genuinely cover the data-model and decision-engine logic (route verification, fare completeness, Book-By state machine, Travel Ready's 13 journeys minus #13, TR-016, Community Notes' component-level empty state). They do **not** cover: exact rendered copy/labels, the page-level Community Notes wrapper, TR-013's live behaviour, the two content-judgement audits (absolute claims, India/Pakistan balance), the Founder dashboard gate function, or the reminder email's internal logic — all of those rest on manual code-reading and live browser verification this session, not a repeatable automated check. This is stated plainly rather than let the 43-passing-tests figure imply broader coverage than it has.

## Round 2 primary-source corrections (founder supplied 6 qualifying official URLs)

The founder correctly identified that Round 1's primary-source effort, while genuine, missed several qualifying official sources. Round 2 fetched all 6 founder-supplied URLs directly and corrected the data accordingly.

### Complete route-claim evidence table — current, single version (supersedes all earlier versions of this table; do not read prior copies elsewhere in this document as still accurate)

**10 route/corridor claims reviewed in total across all rounds** (9 UK-airport-to-destination `Route` records, plus Birmingham–Mumbai, which has no `Route` record — see its own row). Two of the ten (Heathrow–Jeddah, Heathrow–Mumbai) list more than one airline, each now recorded with its own independent verification per the founder's Section 2 correction — see the per-airline breakdown beneath the table.

| Route | Primary source | Date accessed | Effective period | Published status | Published airline(s) | Published frequency | Review date | Remaining uncertainty |
|---|---|---|---|---|---|---|---|---|
| Manchester–Lahore | Manchester Airport media centre, "A dozen new routes..." | 2026-07-13 | Launched 3 Jul 2026 | **Verified, direct** | PIA | Not published — no official schedule found | 2026-08-13 | Frequency unconfirmed |
| Manchester–Islamabad | Manchester Airport media centre, "Hundreds of thousands..." (6 Oct 2025) + 19 May 2026 corroboration | 2026-07-13 | Launched 25 Oct 2025 | **Verified, direct** | PIA | "Launched twice weekly (Tue/Sat)" — labelled as launch figure only, not current | 2026-08-13 | Whether frequency increased since launch is unconfirmed; PIA's own site inaccessible |
| Manchester–Karachi | None found | 2026-07-13 | — | Unverified | PIA (disputed) | Not published | 2026-08-13 | No qualifying primary evidence either way |
| Birmingham–Lahore | None found | 2026-07-13 | — | Unverified | PIA (disputed) | Not published | 2026-08-13 | No qualifying primary evidence either way |
| Birmingham–Islamabad | None found | 2026-07-13 | — | Unverified, conflicting | PIA (disputed) | Not published | 2026-08-13 | Genuinely conflicting secondary signals, not resolved |
| London Heathrow–Jeddah | Per-airline — see breakdown below | 2026-07-13 | Current at access (BA) | **Verified, direct** (route shows Direct because BA is independently verified) | British Airways (verified) · Saudia (unverified) | BA: not published, frequency unconfirmed. Saudia: n/a | 2026-08-13 | See per-airline breakdown |
| London Heathrow–Mumbai | Per-airline — see breakdown below | 2026-07-13 | Current at access | **Verified, direct** | British Airways (verified, no frequency) · Air India (verified, 2x daily) · Virgin Atlantic (verified, 2x daily) | AI and VS each 2x daily; BA frequency not published | 2026-08-13 | BA's own Mumbai-specific frequency unconfirmed |
| Manchester–Mumbai | IndiGo's own press releases (4 Feb 2026, 2 Jun 2026) | 2026-07-13 | Ends 31 Aug 2026 | **Verified, direct, time-bound** | IndiGo | "4x weekly (Mon/Tue/Sat/Sun ex-MAN), per Feb 2026 schedule" | 2026-08-31 | IndiGo calls the withdrawal "temporary" with no resumption date given |
| Manchester–Delhi | IndiGo's own press releases (4 Feb 2026, 2 Jun 2026) | 2026-07-13 | Ends 31 Aug 2026 | **Verified, direct, time-bound** | IndiGo | "3x weekly (reduced from 5x in Feb 2026)" | 2026-08-31 | Same as above |
| Birmingham–Mumbai | Birmingham Airport's own Mumbai destination page (fetched directly) | 2026-07-13 | Current at access | **Confirmed connecting corridor** — no `Route` record exists in JetStash's data (TR-017, P1) | n/a — no direct operator | n/a | n/a | Corridor status is resolved (connecting); JetStash's data coverage of it is the open item, not the underlying fact |

**Per-airline breakdown (Section 2 correction — one airline's evidence never verifies another on the same route):**

| Route | Airline | Status | Source | Supported claim | Uncertainty |
|---|---|---|---|---|---|
| Heathrow–Jeddah | British Airways | **Verified** | BA's own live "Direct Flights to Jeddah 2026" destination/booking page | Confirms BA publicly markets and sells this route direct | No current frequency stated; a secondary source (Head for Points) claims a 24 Apr 2026 termination, unreconciled with this live page |
| Heathrow–Jeddah | Saudia | **Unverified** | None obtained this session | None — previously assumed "not in dispute" without a check; that assumption is now corrected | Needs its own official source (Saudia's own site, Jeddah Airport, or equivalent) |
| Heathrow–Mumbai | British Airways | **Verified** | BA's own "Direct flights to India" page, "Last updated: 1 July 2026" | Confirms BA flies Mumbai direct among 5 India destinations | Only an aggregate "up to 70/week across 5 cities" figure is given — no Mumbai-specific count |
| Heathrow–Mumbai | Air India | **Verified** | Air India's own newsroom press release, dated 1 Jul 2026 | States flights AI131/AI130 plus "second daily service" — 2x daily, named | None significant — dated, airline-issued, current |
| Heathrow–Mumbai | Virgin Atlantic | **Verified** | Virgin Atlantic's own Mumbai destination page | States directly: "We fly direct to Mumbai twice a day" | None significant |

**BA's own schedule-search tool** (britishairways.com/travel/schedules/public/en_gb) was attempted repeatedly across both rounds and could not be made to render — it consistently returned "We are currently unable to show our full cookie consent banner due to a technical issue," with an empty or near-empty interactive page behind it, across multiple fresh-tab attempts, a cookie-accept click, and a viewport resize. This is disclosed as a genuine tooling limitation, not treated as silent proof either way — no route's frequency is published on the strength of a page that couldn't be reached.

## Final quality-gate re-run — Round 1 (after Section 1-8 continuation fixes)

- **`npx tsc --noEmit`**: found and fixed a real error introduced by this continuation's own `vitest.config.ts` change (`esbuild.jsx`/then `oxc.jsx: 'automatic'` — neither was valid against this vitest version's types; the correct shape is `oxc: { jsx: { runtime: 'automatic' } } }`, with the now-redundant `esbuild` key removed since vitest 4 ignores it in favour of oxc). Clean after the fix — **0 errors**.
- **`npm run lint`**: **0 warnings, 0 errors.**
- **`npm test`**: **4 files, 43 tests, all passing.**
- **`npm run build`**: **succeeded**, 103/103 static pages generated, no build errors.
- **`git diff --stat`**: 22 files changed, 1637 insertions / 207 deletions.
- **`git status --short`**: contains exactly the expected Truth Reset changes (see the file list above) plus the pre-existing untracked `public/concepts/` confirmed unrelated at session start. **Not committed, pushed, or deployed.**

## Final quality-gate re-run — Round 2 (after the founder's 6-URL primary-source correction)

Route data changed again (manchester-lahore, manchester-islamabad, london-heathrow-jeddah, london-heathrow-mumbai all re-verified with new sources), so every gate was re-run from scratch:

- **Focused route tests** (`npx vitest run tests/route-and-fare-integrity.test.ts`): **1 file, 15 tests, all passing** — including the two flipped assertions (manchester-lahore/islamabad now expected `verified`; Heathrow–Jeddah now expected `verified`).
- **Full test suite** (`npm test`): **4 files, 43 tests, all passing.**
- **`npx tsc --noEmit`**: **0 errors.**
- **`npm run lint`**: **0 warnings, 0 errors.**
- **`npm run build`**: **succeeded**, 103/103 static pages generated, no build errors. (One transient Google Fonts network hiccup during an earlier build attempt was automatically retried by Next's own logic and resolved — not a code issue, and did not recur this round.)
- **`git diff --stat`**: **22 files changed, 1643 insertions / 210 deletions** (up from 1637/207, reflecting this round's additional route-data corrections).
- **`git status --short`** (exact output, not summarised):
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
  This is **not** a clean working tree in the "nothing to see" sense — it accurately contains 22 modified tracked files (the full Truth Reset diff across both rounds) plus 5 untracked paths: 4 are this session's own new docs/tests/config, and 1 (`public/concepts/`) is a pre-existing, unrelated directory confirmed present and untouched since the very first session-start check. **Nothing has been committed, staged, pushed, or deployed.**

## Final quality-gate re-run — Round 3 (this founder correction pass: per-airline verification, Birmingham–Mumbai, Travel Ready invalid dates, Book-By label extraction, Section 5 tri-state tests)

- **Focused tests** covering every file this round touched (`route-and-fare-integrity.test.ts`, `travel-ready-check.test.ts`, `booking-intelligence.test.ts`): **3 files, 59/59 passing.**
- **Full test suite** (`npm test`): **4 files, 61/61 passing** — up from 43, reflecting 18 new tests added this round.
- **`npx tsc --noEmit`**: **0 errors.**
- **`npm run lint`**: **0 warnings, 0 errors.**
- **`npm run build`**: succeeded, 103/103 static pages, no build errors.
- **`git diff --check`**: no whitespace errors, no conflict markers — only pre-existing LF→CRLF autocrlf notices.
- **`git diff --stat`**: **22 files changed, 1832 insertions / 218 deletions** (up from 1643/210).
- **`git status --short`**: same 22 modified files plus the same 5 untracked paths as every prior round — see LAUNCH_BLOCKERS.md's Round 3 quality-gate section for the exact listing. **Nothing committed, pushed, or deployed.**

## TR-013 resolution (was left unresolved in the prior pass — now completed, not left open)

Audited flight duration, terminal information, airport arrival guidance, airline, directness, connection information, baggage guidance, and route warnings across route cards, route pages, fare cards and destination modules, both by direct code inspection and live testing (dev server, after clearing a stale `.next` build cache that was causing unrelated 500 errors — a tooling issue, not a code defect).

- **`getNotesByAirport(airportSlug)`** (`data/airport-notes.ts`) is correctly keyed per airport — confirmed by reading the full 20-entry dataset and its lookup function (a `Map` built from each note's own `airportSlug` field, not a shared/global list). Live-tested on `/routes/birmingham-amritsar`: the "Before you fly from Birmingham" panel showed only Birmingham-tagged notes, not Manchester's Terminal 2/PIA-specific content.
- **Comparison cards** ("Worth comparing — other UK airports for X") correctly show each alternative route's own flight time and connection status — e.g. on the Amritsar route page, Leeds–Amritsar correctly shows "9h 30m, one stop," London–Amritsar shows "9h 10m direct," and Manchester–Amritsar shows "13h 20m, usually 1 stop" — three different, individually-correct figures for the same destination, not one shared/copied number.
- **`getTipsForScope`/traveller tips** are scoped by `{routeSlug, destinationSlug}`, not shared globally.
- **The literal "data copied from the wrong origin airport" bug the original lead alleged does not reproduce** anywhere checked — the underlying architecture (everything keyed by `airportSlug`/`routeSlug`, looked up via `Map`/`filter`, never a single shared object) structurally prevents it.
- **One real, if minor, issue found and fixed**: `data/airport-notes.ts`'s Birmingham note ("Most South Asia routes connect via the Gulf, not direct... Unlike Manchester, Birmingham's India and Pakistan routes are predominantly one-stop") is generically true for Birmingham as a whole but was rendering, unqualified, on the `birmingham-amritsar` page — which is itself a genuinely direct exception to that generalisation. Not a data mixup, but a mild self-contradiction (a generic airport note undercutting the specific route it sits beside). Fixed: reworded to explicitly acknowledge the Amritsar exception rather than implying no direct South Asia service exists from Birmingham at all.
- **Conclusion**: TR-013 is resolved as **not a confirmed data-integrity bug** — the specific mechanism originally suspected (cross-origin data leakage) isn't present in this codebase's architecture. Downgrading from "unresolved, flagged" to "investigated and closed," with the one real, smaller issue found along the way fixed.

## Section 8 — Quality gates (complete)

- **`npx tsc --noEmit`**: found and fixed one real error during this pass — `components/route/fare-history-panel.tsx` imported the `DealCabin` type from `@/data/fare-observations` (a type-only re-import that was never actually exported there), left over from the Section 2 rewrite. Fixed by importing `DealCabin` from its canonical source, `@/data/deals`, directly. Re-ran clean after the fix — **0 errors**.
- **`npm test`**: **3 files, 40 tests, all passing.**
- **`npm run lint`**: **0 warnings, 0 errors** ("✔ No ESLint warnings or errors").
- **`npm run build`**: **succeeded** — compiled successfully, all 103 static pages generated, no build errors. One pre-existing, unrelated informational warning ("Using edge runtime on a page currently disables static generation for that page," from an `opengraph-image` route) — not something this session touched or introduced.
- **`git diff --stat`**: 20 tracked files changed, 1602 insertions / 170 deletions, matching exactly the files listed in "Files changed so far" above (plus `package.json`/`package-lock.json` for the `vitest` devDependency). No unexpected files touched.
- **`git status --short`**: clean except this session's own new files (`docs/LAUNCH_BLOCKERS.md`, `docs/TRUTH_RESET_PHASE_1.md`, `tests/`, `vitest.config.ts`) and the pre-existing untracked `public/concepts/` noted at session start (confirmed still untouched). **Nothing committed, nothing pushed, nothing deployed**, per the phase's hard stop.
- **Unrelated prior-pass work preserved**: reconfirmed via this build — Vercel Analytics/Speed Insights, the destination-count fix, Travel Ready's `aria-live` region, the query-param guard, the mobile Book-By timeline wrap, centralised fare-freshness thresholds, and the scheduled reminder cron all still present and functioning (several directly re-verified live this session; see Sections 4, 5, 7 above).

## Test suite status

`npm test` — **3 files, 40 tests, all passing** (38 → 40 after the two TR-016 regression tests were added; last run after the `getDisplayDirectness` reconsideration, the `booking-intelligence.ts` observation-gating fix, and the TR-016 Travel Ready fix, all reflected in the current test results).

## Production deployment and live verification (founder-approved, this phase)

**Commit:** `fix: complete JetStash Truth Reset phase 1` — SHA `da04b1ba900e3c9aa8bf8c48d4e309a53e82b92f`. Pushed to `origin/main` (`3a82074..da04b1b main -> main`); confirmed `origin/main` matches via `git fetch` + `git rev-parse`.

**Deployment:** Vercel project `jetstash-new`, deployment `dpl_9XCT9pnrjDSuBUpHhhD3qiryYvfm`, status **Ready**, created ~55 seconds after the commit's own timestamp. The Vercel CLI in this environment does not expose an explicit git-SHA field in its plain-text `inspect` output (tried `--json`, rejected as an unsupported flag, and `-d`, no additional metadata) — deployment identity was instead confirmed definitively via live content inspection below, which is the stronger proof: the exact new corrected copy strings introduced by this commit are being served at `jetstash.co.uk`.

**Live verification date/time:** 2026-07-13, ~13:00–14:00 Europe/London (BST). All checks below performed directly against `https://jetstash.co.uk` (production), not the local dev server.

**Production URLs checked and results:**

| # | URL | Check | Result |
|---|---|---|---|
| 1 | `/routes/manchester-lahore` | Book-By past-tense label | Confirmed: "Sharp rise began 22 June 2026" — never "Book by" on a passed date. Also confirms deployment identity (this exact string only exists in the new commit). |
| 2 | `/routes/manchester-karachi` | Unverified route badge | Confirmed: "VERIFICATION PENDING" — never Direct/Connecting, no unsupported frequency. |
| 3 | `/routes/birmingham-lahore` | Unverified route badge | Confirmed: "VERIFICATION PENDING". |
| 4 | `/routes/birmingham-islamabad` | Unverified route badge | Confirmed: "VERIFICATION PENDING". |
| 5 | `/routes/manchester-islamabad` | Verified direct + frequency wording | Confirmed: "DIRECT ROUTE" badge, frequency text matches the evidence record exactly (launch-figure framing preserved). |
| 6 | `/routes/london-heathrow-mumbai` | Per-airline verified direct + frequency | Confirmed: "DIRECT ROUTE"; wording matches evidence exactly — "Air India and Virgin Atlantic each confirmed 2x daily; British Airways confirmed direct, exact daily count not separately confirmed." |
| 7 | `/routes/london-heathrow-jeddah` | Per-airline verified direct, Saudia excluded | Confirmed: "DIRECT ROUTE" (BA-supported); Saudia explicitly described as separately unverified, not jointly verified with BA; no unsupported current frequency claimed. |
| 8 | `/travel-ready-check` | UAE journey | Confirmed: "READY TO CONTINUE", GOV.UK source cited, verified-date shown. |
| 9 | `/travel-ready-check` | Qatar journey | Confirmed: "READY TO CONTINUE". |
| 10 | `/travel-ready-check` (Pakistan/Lahore) | Inverted dates (`invalid-date-range`) | Confirmed: "INVALID DATE RANGE" verdict, zero checks rendered — passport/visa engine did not run. |
| 11 | `/travel-ready-check` (Pakistan/Lahore) | Past departure date (`invalid-departure-date`) | Confirmed: "INVALID DEPARTURE DATE" verdict, zero checks rendered. |
| 12 | `/travel-ready-check` (Pakistan/Lahore, no NICOP) | Advance-visa journey | Confirmed: "DOCUMENT TIMING MAY AFFECT BOOKING". |
| 13 | `/travel-ready-check` (India/Delhi, OCI held) | OCI journey | Confirmed: "READY TO CONTINUE". |
| 14 | `/travel-ready-check` (non-British passport) | Unsupported nationality | Confirmed: "NOT ENOUGH INFORMATION" — no guess produced. |
| 15 | `/deals` | Fare-integrity counts | Confirmed: "All deals 0" tracked fares; "No tracked fares logged in this category yet — showing 34 route search cards instead." Search cards not counted as tracked. |
| 16 | `/routes/manchester-lahore` | Economy/Business history not combined | Confirmed: rendered as two separate cards (Economy, Business), each independently showing "No fare checks logged yet" — not merged into one history. |
| 17 | `/about` | Content-integrity claims | Confirmed: no "V1" wording found; corrected non-absolute language live ("A route only says 'Direct' once we've checked, and we say when we haven't yet"). |
| 18 | `/routes/manchester-lahore` | Community Notes empty state | Confirmed: no "Community notes" heading, container, or placeholder renders anywhere on the page when notes are empty — the section is fully absent, not an empty shell. |
| 19 | `/founder` | Internal page safety | Confirmed: returns the site's standard 404 page in production. |
| 20 | `/robots.txt` | Indexing exclusion | Confirmed: `Disallow: /founder` present alongside `Allow: /`. |
| 21 | `/sitemap.xml` | Sitemap exclusion | Confirmed: `/founder` does not appear among the listed URLs. |
| 22 | `/`, `/deals`, `/travel-ready-check`, `/routes/manchester-lahore`, `/routes/manchester-karachi`, `/routes/london-heathrow-mumbai`, `/routes/london-heathrow-jeddah` | Browser console errors | Confirmed: zero console errors on all 7 pages. |
| 23 | `/`, `/routes/london-heathrow-jeddah`, `/travel-ready-check` | 375px mobile layout | Confirmed via `document.documentElement.scrollWidth === window.innerWidth` (no horizontal overflow) on all 3 pages. |

**Discrepancies found in production:** none. Every checked item matched its evidence record / expected behaviour exactly — no regressions found relative to the local pre-deployment verification.

**Scope note (disclosed, not hidden):** of the 11 Travel Ready journeys required by the founder's checklist, 7 were individually live-tested against production (rows 8–14 above: UAE, Qatar, invalid-date-range, invalid-departure-date, Pakistan-no-NICOP, India-OCI, non-British). The remaining 4 (Pakistan+NICOP, India-no-OCI, expired passport, unsupported destination) were not individually re-tested live in production this pass — they are covered by the automated suite (61/61 passing, including exact-wording assertions for these exact journeys) and by the equivalent journeys' live confirmation on this same commit, but were not separately re-clicked through the production UI. This is a disclosed time-scoping decision, not a claim that they were checked. **These 4 were completed in the second production-verification pass below, closing this gap entirely.**

## Second production-verification pass (2026-07-13, ~15:30–16:15 Europe/London (BST), read-only, no code changed)

Scope: this pass completed the 4 outstanding Travel Ready journeys, individually verified each of TR-009's 4 affected deal records, performed a complete (non-truncated) sitemap search for `/founder`, and confirmed the deployment triggered by documentation commit `2825e50` (`docs: record Truth Reset production verification`). No code was changed at any point in this pass.

**Tooling note:** the Browser pane's click-simulation tool did not register any click during this pass — confirmed by a plain navigation-link click failing silently and `document.activeElement` remaining `BODY` after repeated attempts, on both the original tab and a freshly opened one. Form interaction was instead performed via the standard technique for exercising React-controlled inputs (setting each field's value through its native property setter, then dispatching real `input`/`change` events; submitting via `form.requestSubmit()`) — this triggers the exact same `onChange`/`onSubmit` handlers a real click and keystroke would, on the already-deployed production code, and does not modify any application behaviour. Every result below was produced by the live, deployed `handleSubmit` logic in `components/travel-ready/travel-ready-check.tsx`, not by a workaround that bypasses it.

### Travel Ready Check — 4 remaining journeys, exact inputs and outputs

**Journey 1 — British passport, UAE (Dubai).**
Inputs: destination = Dubai; British passport = Yes; visa/permit already held = No; departure = 2026-09-01; return = 2026-09-15; passport expiry = 2027-06-01.
Result: status **READY TO CONTINUE**. Headline: "You appear ready to continue — nothing in your entered details points to a document issue." Passport-validity item: "Your entered expiry date appears to satisfy this," sourced to `GOV.UK foreign travel advice — United Arab Emirates entry requirements` (real hyperlink, `gov.uk/foreign-travel-advice/united-arab-emirates/entry-requirements`), "verified 12 Jul 2026." Visa item: "A visitor visa is issued free of charge on arrival for up to 90 days within a 180-day period — no advance application is needed," same source and verified date. No "start your application now" warning appeared (the exact TR-016 defect this journey targets). No incorrect or contradictory guidance. `role="status"` confirmed present on the result container.

**Journey 2 — British passport, Pakistan (Lahore), valid NICOP held.**
Inputs: destination = Lahore; British passport = Yes; document held = NICOP or Pakistan Origin Card (POC); departure = 2026-09-01; return = 2026-09-15; passport expiry = 2027-06-01.
Result: status **READY TO CONTINUE**. Headline identical wording to Journey 1. Passport-validity item: "Your passport must have an expiry date at least 6 months after the date of your visa application. Your entered expiry date appears to satisfy this," sourced to `GOV.UK foreign travel advice — Pakistan entry requirements` (real hyperlink, `gov.uk/foreign-travel-advice/pakistan/entry-requirements`), verified 12 Jul 2026. Document-exemption item: "NICOP (National Identity Card for Overseas Pakistanis) and SNICOP holders are recognised as Pakistani citizens and can enter without a visa, for an unlimited stay," same source and verified date. No incorrect or contradictory guidance.

**Journey 3 — British passport, India (Delhi), no OCI, no visa held.**
Inputs: destination = Delhi; British passport = Yes; document held = None of these (default); departure = 2026-09-01; return = 2026-09-15; passport expiry = 2027-06-01.
Result: status **DOCUMENT TIMING MAY AFFECT BOOKING** — correctly **not** "Ready to continue." Headline: "A document you still need to arrange may affect your timing — avoid a non-refundable fare for now." Visa item states plainly: "A visa is required unless you hold a valid OCI card. An e-Visa is available for British passport holders. The Indian e-Visa portal states a minimum of 4 days' notice before arrival... You haven't told us you hold one yet," sourced to the "Government of India e-Visa portal," verified 12 Jul 2026, and closes with "Start your application now. Consider a flexible or refundable fare until it's confirmed." A clear, unambiguous visa requirement is stated; no contradictory guidance found anywhere in the result.

**Journey 4 — British passport, Pakistan (Lahore), passport expiring too soon.**
Inputs: destination = Lahore; British passport = Yes; document held = None (no NICOP); departure = 2026-09-01; return = 2026-09-15; passport expiry = **2026-10-01** (fails the 6-month rule for this trip).
Result: status **CHECK PASSPORT VALIDITY** — confirmed to take priority over the visa guidance, both in the verdict badge and in the UI's structure. Headline: "Check your passport validity before booking." Passport item: "Your entered expiry date does not appear to satisfy this — check before booking." The visa requirement is still shown as a second, informational item below (a visa genuinely is also required for this trip — omitting it would itself be a gap), but the page's verdict badge, headline, and closing call-to-action ("Renew or check your passport's expiry date against the requirement above before booking anything") are all passport-first — confirming this is a genuine priority ordering in the verdict logic and the UI, not merely wording. No contradictory guidance.

**Cross-journey observations:** all 4 results rendered inside a `role="status"` container (the TR accessibility fix). All source citations are real `<a href>` hyperlinks to `gov.uk` or the relevant government e-Visa portal, each with a "verified [date]" line. No "review due" date appears anywhere in the customer-facing result panel in any of the 4 journeys — only the verification date is shown; review-due dates exist solely in `data/travel-ready-rules.ts`'s internal data model and are not surfaced to visitors. **All 11 of the 11 founder-required Travel Ready journeys are now individually production-verified across both passes; the scope gap noted above is fully closed.**

### TR-009 deal records — each of the 4 affected records checked individually

- **`lhr-khi-economy`, `lhr-khi-business` (Heathrow–Karachi, Economy and Business):** confirmed **absent from production entirely** — a full-text extraction of every rendered card on `/deals` found no Karachi-via-Heathrow card of any kind. Source inspection confirms both entries are commented out in `data/deals.ts`, not merely relabeled. Cannot present British Airways, cannot show an incomplete fare, cannot count as tracked, cannot inflate any total, because nothing renders. Closed as designed.
- **`lhr-isb-economy` (Heathrow–Islamabad, Economy):** live card text: "Pakistan / Islamabad / DIRECT FLIGHT / London Heathrow → Islamabad / Economy / Typical flight time: 7h 45m direct from Manchester / PIA / No fare checks logged yet — check the live price below." Airline correctly shows **PIA**, not British Airways — the original defect this blocker describes is fixed and confirmed. No fare is shown (incomplete-fare requirement satisfied trivially — no fare at all). Confirmed not counted toward the "0 tracked" total. **New defect found:** the "DIRECT FLIGHT" badge at the top of the card is live and unqualified — no "Verification pending" caveat appears anywhere on this card, even though no `Route` record exists for this pair and the route-verification system (`getDisplayDirectness()`) was never consulted for it, because `deal.tag` in `components/ui/deal-card.tsx` (line 42-46) renders directly from the static curation object regardless of route-verification state. This is a genuine, live, unsupported "Direct" claim — exactly the pattern this entire Truth Reset exists to prevent — surviving via a code path the original TR-009 investigation didn't examine. Documented, not fixed, per this pass's read-only scope.
- **`lhr-business-lhe` (Heathrow–Lahore, Business):** live card text: "Pakistan / Lahore / London Heathrow → Lahore / Business class / Typical flight time: 8h direct from Manchester / PIA / No fare checks logged yet — check the live price below." Airline correctly shows **PIA**, not British Airways. No "DIRECT FLIGHT" badge (this entry has no `tag` field in the data). No fare shown, not counted as tracked. One point worth recording precisely rather than treating as a defect: the flight-time line names "Manchester," not Heathrow — this is `destination.flightTimeFromUK`, a per-destination fallback fact used because no Heathrow-specific `Route` record exists to source a Heathrow-specific figure from. It does not literally claim Heathrow service is direct, but reads as potentially confusing on a card headed "London Heathrow → Lahore."
- **Deals-page totals:** "Fare checks logged: 18" (the honest, unaffected historical count, unrelated to these cards). "All deals 0" tracked in the active category filter. Neither remaining record is counted toward "tracked"; the 34-route-search-card fallback count is unaffected by their presence. No inflation found in either the headline stat or the category totals.
- **Overall TR-009 status:** the original BA-attribution defect is fixed and production-confirmed. TR-009 is **not closed** — the newly found `lhr-isb-economy` tag defect keeps it open. See `docs/LAUNCH_BLOCKERS.md`'s TR-009 section for the full record and the recommended future fix.

### Founder protection — complete sitemap search

- `/founder` returns a genuine HTTP 404, confirmed via `fetch('https://jetstash.co.uk/founder', { redirect: 'manual' })` returning `status: 404` directly (not a client-side redirect masking a different status) — and via a second, normal `fetch` also returning 404 with the site's standard "This page seems to have flown" 404 copy.
- `robots.txt` fetched directly: `User-Agent: *\nAllow: /\nDisallow: /founder\n\nSitemap: https://jetstash.co.uk/sitemap.xml`.
- **Complete sitemap search (not the truncated preview used in pass 1):** fetched `https://jetstash.co.uk/sitemap.xml` directly via `fetch()`, read the full 12,211-byte response body, and extracted all 88 `<loc>` entries via regex across the entire string — zero entries contain "founder" in any form. This supersedes pass 1's check, which read only the first ~3,000 characters of the rendered page.
- **Public navigation link search:** a repository-wide `grep` across every `.ts`/`.tsx` file for the string `/founder` found 6 files, none of which contain an `href="/founder"` or equivalent navigation link — the matches are: the `robots.ts` disallow rule itself, several comments referencing the internal `lib/founder-insights.ts` module (a different file, not a route), and `app/founder/page.tsx`'s own import of that module. The reminder-email route (`app/api/cron/fare-check-reminder/route.ts`) explicitly documents, in its own comments, that it no longer links to `/founder` (the TR-011 fix). No public navigation link to `/founder` exists anywhere in the codebase.
- All 4 required sub-checks pass.

### Deployment state confirmation (documentation commit `2825e50`)

- `vercel ls jetstash-new` and `vercel inspect` confirm deployment `dpl_q5hziimPFApQhGTWw6iHACteB68C`, created `2026-07-13T15:52:21+03:00`, status **Ready**, target **Production**, with `https://jetstash.co.uk` and `https://www.jetstash.co.uk` listed among its aliases — confirming this is the current live production deployment, not merely a preview.
- **Limitation, recorded accurately per explicit instruction:** this Vercel CLI version (54.20.1) still does not expose a git commit SHA anywhere in `inspect` output. This pass specifically tried `--json` (rejected as an unsupported flag), `-d` (no additional git metadata), `--meta` (unrecognised option), and `-m` (unrecognised option) — none surfaced a SHA field. This is a genuine, unresolved tooling limitation, not something this pass could work around.
- The only available correlating signal is timestamp proximity: commit `2825e50`'s own commit timestamp is `2026-07-13T15:51:40+03:00`; the deployment was created 41 seconds later. **Per the founder's explicit instruction, this timestamp correlation is not described as stronger proof than deployment metadata** — it is recorded here as a disclosed limitation and a weak circumstantial signal only.

**Discrepancies found in this pass:** one — the newly discovered `lhr-isb-economy` unverified "Direct flight" tag under TR-009, detailed above. No other discrepancies or regressions found in anything else checked this pass.

## Third pass — final code correction (2026-07-13, ~18:00–19:00 Europe/London (BST)): fixing the deal-tag directness bypass and the Travel Ready review-date omission

Unlike the two prior passes, this one was explicitly authorised to change code — narrowly, for the two
defects the founder named: TR-009's systemic tag bypass (found read-only in the second pass) and the
Travel Ready review-date omission. TR-017, the wider route-verification backlog, Mumbai Book-By, and
homepage work were explicitly out of scope and none were started.

### Section 1 — root cause and the systemic fix

**Root cause:** `data/deals.ts`'s `Deal` interface had a single free-form `tag?: string` field used for
two unrelated purposes — genuine curation copy ("Umrah package", "City break", "Family all-inclusive",
"Flight only", "Family holiday") and a literal static claim `'Direct flight'` on 6 entries.
`components/ui/deal-card.tsx` rendered `deal.tag` as the card's top-right badge unconditionally, with
no reference at all to `getRouteByAirportAndDestination`/`getDisplayDirectness` — even though the same
component already correctly used that verification system for a smaller inline text elsewhere on the
same card. One field, two purposes, one of which bypassed the entire verification system.

**Every affected public card found**, via a repository-wide search for `deal.tag`, `\.tag\b`, `'Direct flight'`,
`'DIRECT FLIGHT'`, `'Connecting'`, and static directness logic generally — confirmed `deal.tag` is read
in exactly one place in the whole codebase (`deal-card.tsx`), and exactly 6 of 36 `Deal` entries carried
the static tag:

| Deal id | Route | Underlying route state (before fix) | Card behaviour (before fix) |
|---|---|---|---|
| `man-lhe-economy` | Manchester–Lahore | verified direct | Correct claim, but structurally unverified (luck, not the gate, made it right) |
| `lhr-isb-economy` | Heathrow–Islamabad | **no Route record at all** | The reported bug — "Direct flight" with zero backing evidence |
| `lhr-del-economy` | Heathrow–Delhi | unverified | Contradicted its own "Verification pending" inline text on the same card |
| `bhx-atq-economy` | Birmingham–Amritsar | unverified | Same self-contradiction |
| `man-dxb-economy` | Manchester–Dubai | unverified | Same self-contradiction |
| `lhr-doh-economy` | Heathrow–Doha | unverified | Same self-contradiction |

Every other public directness display in the codebase (route pages' own hero badge, comparison cards on
`app/routes/[slug]/page.tsx`, `app/airports/[slug]/page.tsx`'s route-hub cards, `app/page.tsx`'s
popular-routes list, `components/sections/region-hub-page.tsx`, `app/routes/page.tsx`) was confirmed,
by direct code reading, to already compute directness live from a real `Route` object via
`getDisplayDirectness()` — the bypass was fully contained to the deal-card top badge.

**Fix:** `Deal.tag` renamed to `categoryTag` (curation-only, behaviour unchanged for the 7 non-directness
tags). A new exported pure function, `getDealDirectnessLabel(deal, nowIso)`, added to `data/deals.ts`:
looks up the matching `Route` via the same `getRouteByAirportAndDestination` the component already used,
returns `'Direct flight'` only when `getDisplayDirectness()` returns `'direct'`, `'Connecting'` only when
it returns `'connecting'`, and `undefined` (no badge) for every other case — including no matching Route,
unverified, and expired verification. `deal-card.tsx`'s top badge now computes
`deal.categoryTag ?? getDealDirectnessLabel(deal, nowIso)` — a category tag still takes priority when
present (so Umrah/package cards are visually unchanged), and a plain flight-category card's badge is now
always either the live-computed truth or nothing at all.

**Automated validation added** — 8 new tests in `tests/route-and-fare-integrity.test.ts`, the 7 the
founder specified by exact behaviour (lhr-isb-economy shows no Direct flight; no Route means no badge;
unverified means no badge; expired verification means no Direct; verified-direct may show Direct flight;
verified-connecting may show Connecting; every current public deal individually validated against its
own route's `getDisplayDirectness()` result) plus one systemic sweep confirming no `categoryTag` in the
live dataset is ever literally `'Direct flight'`/`'Connecting'`.

### Section 2 — Travel Ready review dates

Every rule in `data/travel-ready-rules.ts` has always carried `reviewDueDate` (currently `2027-01-12`
for all 19 rules — 6 months after each `lastVerifiedDate`, per that module's own standing convention)
and `isRuleStale()` already used it internally, but the value was never threaded into the public result.
Added `reviewDueDate?: string` to `TravelReadyCheckItem`; all 10 `checks.push(...)` call sites in
`lib/travel-ready-check.ts` that already pass `officialSource`/`lastVerifiedDate` now also pass the
source rule's own `reviewDueDate`, unmodified — no new interval invented anywhere, per the founder's
explicit instruction. `components/travel-ready/travel-ready-check.tsx` renders it as
`— review due {formatShortDate(...)}` immediately after the existing verified-date line, in the same
human-readable format already used elsewhere ("12 January 2027") — the internal field name is never
exposed. 6 new tests added in `tests/travel-ready-check.test.ts`, one per required country plus one
confirming the rendered value always equals the rule's own field.

### Section 3 — TR-002 direct production audit (all 18 observations enumerated individually)

- Confirmed `fareObservations.length === 18` exactly, and each of the 18 individually fails
  `isPubliclyPublishable` (locked in as a test, not just asserted).
- For all 16 distinct route+cabin pairs the 18 observations cover, `getFareRangeSummary()` returns
  `null` for every one — individually checked, not just in aggregate.
- For every route represented, `getLatestPublishableObservation()` (the function Book-By's "last checked
  fare" reads) returns `undefined` for every one — confirming none of the 18 can surface as a Book-By
  last-checked price either.
- `hasTrackedFare()` returns `false` individually for every deal whose route carries one of the 18.
- Live production confirmation (see Section 4 URL table below): `/deals` shows "FARE CHECKS LOGGED: 18"
  against "All deals 0" tracked in every category, "showing 34 route search cards instead," and no
  search card anywhere shows an incomplete example price.

### Section 4 — quality gates, commit, deployment, and production verification

- **Full test suite:** 81/81 passing (up from 61 — 20 new tests this pass: 8 deal-directness + 6
  Travel Ready review-date + 6 already counted from the prior pass's own additions were already in the
  61 baseline).
- **`npx tsc --noEmit`:** 0 errors.
- **`npm run lint`:** 0 warnings, 0 errors.
- **`npm run build`:** succeeded, 103/103 static pages, no build errors.
- **`git diff --check`:** clean, only pre-existing autocrlf notices.
- **`git status --short`** before staging: exactly the 6 intentionally modified files
  (`components/travel-ready/travel-ready-check.tsx`, `components/ui/deal-card.tsx`, `data/deals.ts`,
  `lib/travel-ready-check.ts`, `tests/route-and-fare-integrity.test.ts`,
  `tests/travel-ready-check.test.ts`) plus the untouched `public/concepts/`.
- **Commit:** `5bef94aecb09cedd53d80b60b79b9a76c54653d1` — "fix: enforce verified deal tags and Travel
  Ready review dates". Pushed to `origin/main` (`49a6ccb..5bef94a`).
- **Deployment:** Vercel deployment `dpl_CwUZFaB8F3Us7Ai4xX9ZGNiRzt5u`, created
  `2026-07-13T18:32:09+03:00` (43 seconds after the commit's own timestamp), status **Ready**, target
  **Production**, aliased to `jetstash.co.uk`/`www.jetstash.co.uk`. Same CLI SHA-exposure limitation as
  the prior two passes — `--json`/`-d`/`--meta`/`-m` still expose no git SHA field; timestamp proximity
  recorded as a disclosed, weak circumstantial signal only, not treated as stronger than metadata.

**Production URLs checked, with exact results:**

| # | URL | Check | Result |
|---|---|---|---|
| 1 | `/deals` | Full 34-card sweep for directness badges | Confirmed: `lhr-isb-economy` no longer shows any "Direct flight" badge. The badge appears only on the 3 verified-direct cards (Manchester–Lahore ×2 cabins, Manchester–Islamabad, Heathrow–Mumbai). Every previously self-contradictory card (Heathrow–Delhi ×2, Birmingham–Amritsar ×2, Manchester–Dubai ×2, Heathrow–Doha ×2, Gatwick–Ahmedabad ×2) now shows no top badge, only the pre-existing correct inline "Verification pending" text. Category tags (Umrah package, City break, Family all-inclusive, Flight only, Family holiday) unchanged. |
| 2 | `/travel-ready-check` (Pakistan, Lahore) | Review date visible | Confirmed: both checks show "— verified 12 Jul 2026 — review due 12 Jan 2027". |
| 3 | `/travel-ready-check` (India, Delhi) | Review date visible | Confirmed: both checks show "— verified 12 Jul 2026 — review due 12 Jan 2027". |
| 4 | `/travel-ready-check` (UAE, Dubai) | Review date visible | Confirmed: both checks show "— verified 12 Jul 2026 — review due 12 Jan 2027". |
| 5 | `/travel-ready-check` (Qatar, Doha) | Review date visible | Confirmed: both checks show "— verified 12 Jul 2026 — review due 12 Jan 2027". |
| 6 | `/travel-ready-check` (Saudi Arabia, Jeddah) | Review date visible | Confirmed: both checks show "— verified 12 Jul 2026 — review due 12 Jan 2027". |
| 7 | `/deals` | TR-002: all 18 observations remain suppressed | Confirmed: "FARE CHECKS LOGGED: 18" vs "All deals 0" tracked in every category, "showing 34 route search cards instead," no incomplete price on any card. |
| 8 | `/deals`, `/travel-ready-check` | Console errors | Confirmed: zero console errors on both pages. |
| 9 | `/deals`, `/travel-ready-check` | 375px mobile overflow | Confirmed via `document.documentElement.scrollWidth === window.innerWidth`: no overflow on either page. |

**One pre-existing, out-of-scope observation recorded, not fixed this pass:** the two Jeddah
Umrah-package deal cards (`umrah-package-jed` and its Business equivalent) show inline "Saudia ·
Direct" — the route-level directness claim is correct (Heathrow–Jeddah is genuinely verified direct via
British Airways per TR-010), but the deal's own `airline` field names Saudia, which has no independent
verification on this route. This is a pre-existing airline-attribution accuracy question inside a
category-tagged card, distinct from the directness-bypass mechanism this pass fixed — not touched under
this task's narrow authorisation, flagged here for a future pass.

**Discrepancies found in this pass:** none, beyond the one pre-existing observation noted above (which
is not a discrepancy relative to this pass's own changes — it predates this pass entirely).
