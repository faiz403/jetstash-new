# SEO indexing pilot: baseline, targets and measurement plan

- **Approved:** by the founder on 21 October 2026. This is a narrow exception to SEO maintenance mode; see DECISIONS.md.
- **Status:** on branch `seo/indexing-pilot-2026-10-21`, based on `eaa4f48` (main after PR #340). Opened as a PR for review; not merged, not deployed.
- **Measurement start:** the 28-day window starts on the day an approved Production deployment goes live, not when local work began.

## Why

The 21 October 2026 read-only diagnosis found no technical blocker:
- all 156 sitemap URLs return 200;
- no `noindex`;
- every page has a self-referencing canonical;
- `robots.txt` allows crawling.

Google had simply never crawled most route pages:
- **Route pages indexed:** 27 of 89.
- **99 URLs "Discovered – currently not indexed",** every one "Last crawled: N/A".
- **A priority-crawl request failed to trigger a crawl.** `manchester-ahmedabad` was accepted into the priority crawl queue on 5 October and was still uncrawled on 21 October.
- **Already-indexed pages are still recrawled.** `manchester-islamabad` was last crawled on 17 October.

The homepage gave crawlers one server-rendered route link, because the Atlas and the journey finder navigate client-side.

Full evidence, kept outside the repository: `C:\Users\faiz2\jetstash-seo-audit-2026-10-21\`.

## What the pilot changes

1. **Internal links** (`lib/seo-indexing-pilot.ts`, `components/route/seo-route-links.tsx`).
   - **Where:** server-rendered route-guide links on the homepage (`WhyJetStash`) and the three pilot pages.
   - **Not `/tracked-fares`:** a build comparison showed it already links every target through its fare listings, so adding links there would gain nothing.
   - **Gate:** a target is linked only while `getEffectiveRoutePresentation()` reads Direct or Connecting **and** its route-level verification is current.
   - **Why the second check is needed:** a connecting route keeps its shape after its review lapses.
   - **Effect:** targets drop out automatically when their review lapses.
   - **Targets** (verification current on 21 Oct):
     - manchester-islamabad
     - manchester-dubai
     - birmingham-delhi
     - london-heathrow-bengaluru
     - birmingham-mumbai
     - birmingham-dubai
     - birmingham-doha
     - birmingham-jeddah
   - **Not targeted:** no not-yet-indexed Pakistan route qualified on 21 Oct; every one has a lapsed route review.
2. **Quick answers** (`components/route/route-quick-answers.tsx`).
   - **Pages:** exactly three, `manchester-islamabad`, `manchester-dubai` and `birmingham-delhi`.
   - **Questions answered:** is it direct, journey time, frequency, airport codes, and what "self-transfer / separate tickets" means on that route.
   - **Source-bound wording** (revised after the 21 Oct Codex review). Each page's answers live in `lib/seo-indexing-pilot.ts`.
     - They state only what that route's cited primary source supports, and a question is omitted when the source does not answer it.
     - The footer names what the source covers.
     - Each answer set is bound to the exact `verification.verifiedDate` it was written against, and to the Route Status it assumes.
   - **Not added:** no fares, no new facts, no FAQ schema.
   - **Fail-closed:** the block is withdrawn when any of these happens:
     - the route's verification lapses;
     - its status changes;
     - the route record is re-verified with a check these answers were not written for.
   - **What withdrawal means:** a lapse, or a change to a status that is not Direct or Connecting, removes both the Quick answers and the pilot's route links to that route. Any other change to the status the answers were written for (for example Direct to Connecting), or a re-dated record, removes only the Quick answers, because the route is still current and stays eligible for the links. Either way, the route page itself and its existing status presentation stay exactly as before.
   - **Per-page sources:**
     - **`manchester-islamabad`:** Manchester Airport's PIA page supports the operator and the nonstop service only. The answers claim no operating days or duration, and say the typical days shown elsewhere come from flight tracking.
     - **`manchester-dubai`:** Emirates' route page, checked 21 Oct 2026 (21 flights a week, three A380 flights a day each way, 7h05m–7h50m outbound, 7h45m–8h10m return).
       - **Release dependency (met):** the block renders only against that 21 Oct check, which the separate Manchester–Dubai route-data correction recorded (PR #340, live 21 Oct 2026). Against the older 18 Aug check it stays withheld, so the outdated "8h" figure is never promoted.
     - **`birmingham-delhi`:** Air India's own page (no direct flights; AI118 via Amritsar).
       - **Why chosen:** it was not indexed and its verification runs to 3 Dec 2026.
       - **What the answers add:** they explain why Birmingham Airport calls the same one-flight-number service "direct".
   - **Self-transfer answer:** specific to each route, e.g. the Amritsar stop is part of one AI118 flight number, not a self-transfer.

**Unchanged:**
- titles and meta descriptions, including the Manchester–Lahore / Manchester–Mumbai title experiment, which is held until its 1–2 Nov readout;
- fares, fare observations and Fare Signals;
- affiliate links;
- route verification data and logic;
- the sitemap.

## Baseline (observed 21 October 2026; Search Console Page indexing data dated 12 October 2026)

| Measure | Baseline |
|---|---|
| Route pages indexed | **27 of 89** |
| All URLs indexed / not indexed | 57 / 105 (99 Discovered – not indexed, last crawl N/A) |
| Site, last 28 days | 6 clicks, 2.08k impressions, CTR 0.3%, average position 24.3 |
| `/routes/manchester-islamabad`, 28 days | 0 clicks, 55 impressions, position 8.0 |
| `/routes/manchester-dubai`, 28 days | 0 clicks, 202 impressions, position 55.4 |
| `/routes/birmingham-delhi` | not indexed; URL Inspection not run on 21 Oct (in the 12 Oct Discovered list) |

## Targets (measurement targets, not forecasts)

| Level | Indexed route pages |
|---|---|
| Minimum early signal | 32 |
| 28-day ambition | 37–42 |
| 90-day stretch | 60+, subject to evidence and further founder approval |

**Page targets:**
- `manchester-islamabad`: at least 3 clicks in 28 days.
- `manchester-dubai`: average position better than 45.
- `birmingham-delhi`: crawled and indexed.

**Visibility target:** indexing is not traffic, so impressions and clicks are reported alongside the index count at every checkpoint.

**Attribution caution:** any change in indexed pages or traffic is observational. Google's own crawl scheduling and seasonality also move these numbers, so the pilot can be credited only where the pilot URLs themselves change.

## Checkpoints (day 0 = the date the approved Production deployment goes live)

Every checkpoint records these items:
- the actual calendar date of the checkpoint;
- the Production commit;
- the "Last update" date Search Console shows for each report used, which is the evidence's freshness;
- the number of currently eligible link targets (`getSeoRouteLinks`), and which pilot pages currently show Quick answers;
- any route re-verification or data change since the last checkpoint.

| Day | Read-only checks | Decision |
|---|---|---|
| 0 | Indexed route list and count. URL Inspection "Last crawl" for the 3 pilot pages and every eligible link target. Crawl stats: total crawl requests for the 14 days before deployment, which is the crawl baseline. Clicks, impressions and position (28 days) for the 3 pilot pages and the site | — |
| 7 | "Last crawl" for every pilot and target URL. Crawl stats requests and fetch errors. Live status/canonical/noindex check of the changed pages. Clicks, impressions and position since day 0 | Report any blocker the same day. No new changes |
| 14 | As day 7, plus the Page indexing report if Google has refreshed it | **Wave 2 gate (both measured against day 0).** PASS if either of these holds: (a) at least 3 of the not-yet-indexed targets and pilot pages show a "Last crawl" date after day 0; or (b) total crawl requests for days 1–14 are at least 1.5× the 14-day pre-deployment baseline. Otherwise: no new pages; diagnose and report |
| 28 | Indexed route count against 32 / 37–42. New crawls. Clicks, impressions and position for the 3 pilot pages and the site, against the day-0 baseline | Founder decides whether to scale, adjust or return to maintenance |

**Escalate immediately,** without waiting for a checkpoint, on any of these:
- a 5xx, `noindex` or canonical regression;
- Crawl stats fetch errors;
- pilot pages moving to "Crawled – currently not indexed".

## Known risk inside the window

`manchester-islamabad` has a route review due **16 November 2026**.
- Unless it is re-verified first, the page falls back to Verification pending, and its Quick answers and links are withdrawn by design.
- Removal happens at the next successful ISR regeneration after the review date. That is normally within the six-hour revalidation interval; it is not instant.
- **Manchester–Dubai:** re-checked against Emirates on 21 October 2026 and recorded by PR #340; its review is now due 19 January 2027, after the window.
- **Manchester–Islamabad:** a winter operating-day check is approved for on or after 27 October 2026, using official sources only. Re-dating that record withdraws this pilot's Islamabad answers until their wording is reviewed against the new check, which is intended.

## Known events inside the window

- **21 October 2026 (Day 0), PR #343:** Manchester–Doha accuracy correction (not a pilot page or
  link target); changed the Manchester–Doha line on the homepage, `/routes` and `/gulf`.
- **22 October 2026, PR #344:** route-hero status sentence fix (Heathrow–Dhaka, Manchester–Rome) and
  Manchester–Dhaka dated wording. No pilot page changed.
- **PR #345 (founder-approved option (a), 22 October 2026; dated by its Production release):**
  **Birmingham–Delhi, a pilot page,** gains one fare-card line, "This tracked fare is on Lufthansa
  and may be a different connecting journey from this route's own service. Check the airlines and
  stops before booking." Quick answers, links, title, canonical and indexing directives are
  unchanged. Account for it when reading Birmingham–Delhi movement. The same PR re-verifies
  Birmingham–Amritsar and updates the Amritsar card on `/india`.
- **First-impression sprint 1 (PR #346; merge commit `3badd5edb6ee26e2fd7668542df45e374a1c6eeb`, merged
  00:18:37 BST on 23 October 2026 = 23:18:37 UTC on 22 October):** customer-visible text changed on these pilot pages and
  link targets, found by diffing the visible text of Production against the release build.
  The homepage is unchanged. Titles, canonical URLs, indexing directives, Quick answers, link
  blocks, fares and affiliate links are unchanged everywhere.
  - **Pilot pages:** `manchester-islamabad` and `manchester-dubai` gain a "Connecting fare, not nonstop"
    cue under the price and a plainer route-versus-fare explanation (and the lower self-transfer
    offer now follows it); `manchester-islamabad` and `birmingham-delhi` lose the dangling "see note"
    from route detail lines.
  - **Link targets:** `london-heathrow-bengaluru`, `birmingham-dubai`, `birmingham-doha` and
    `birmingham-jeddah` gain the same fare cue; `birmingham-jeddah` also loses internal wording from
    its Saudia duration line. `birmingham-mumbai` is unchanged.
  - **Also changed:** `/routes` (sibling card detail lines) and the India, Pakistan, Gulf and Umrah hubs.
- **Stage 2 first-screen sprint (founder-approved 23 October 2026; dated by its Production release, merge commit and
  time to be added then):** **the homepage's visible text changes** (a neutral journey form instead of the Manchester →
  Agadir default, and one example-check card for Manchester → Islamabad). The homepage link set is unchanged: the card's
  only link goes to `manchester-islamabad`, which the homepage already linked to (verified: the homepage's internal
  link set, title, canonical and robots tag are identical to Production). `/deals` loses most of its hero paragraph.
  The shared deal card now puts the airline and checked date directly under the price ("Fare checked with X · latest
  6 October 2026"), so the sibling fare cards embedded on route, destination, airport and hub pages change by a few
  words, including pilot pages `manchester-islamabad` and `manchester-dubai` and link targets `london-heathrow-bengaluru`
  and `birmingham-mumbai`; the fares, links and Quick answers on those pages are unchanged. No title, canonical, indexing
  directive, Quick answers, link block, fare or affiliate link changes.
  Account for it when reading homepage-driven movement on Manchester–Islamabad. The card disappears on its own from
  17 November 2026 if nothing is re-verified by then.

## Wave 2 (not approved; only after a positive day-14 signal)

**Ready now** (verification current, no pending status on 21 Oct):
- london-heathrow-bengaluru
- birmingham-dubai
- birmingham-doha
- birmingham-jeddah
- birmingham-mumbai

**After re-verification** (reviews lapsed or lapsing):
- manchester-karachi
- birmingham-islamabad
- london-heathrow-lahore (due 3 Nov)
- manchester-dhaka
- manchester-amritsar
- manchester-ahmedabad
- edinburgh-dubai (due 16 Nov)
- london-heathrow-doha (due 3 Nov)

Verification-pending routes are a separate workstream and must not be promoted for SEO.
