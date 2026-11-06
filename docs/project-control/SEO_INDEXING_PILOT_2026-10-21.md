# SEO indexing pilot: baseline, targets and measurement plan

- **Approved:** by the founder on 21 October 2026. This is a narrow exception to SEO maintenance mode; see DECISIONS.md.
- **Status:** LIVE. Merged as PR #341 (`56f90da`); Production deployment 21 October 2026 12:48 UTC, which is Day 0. Checkpoints: Day 7 on 28 October, Day 14 on 4 November, Day 28 on 18 November 2026.
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
- **Stage 2 first-screen sprint (PR #347; merge commit `29e9d81078c708d3e5fa1bfc77f13d6820e0029e`, merged 02:13:43 BST on
  23 October 2026):** **the homepage's visible text changes** (a neutral journey form instead of the Manchester →
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

- **Homepage correction sprint (PR #348; merge commit `8765251324fca1858104ebeb3d0ff6fc750e9626`, merged 14:53:49 BST on
  23 October 2026):** **the homepage's visible text and link set change slightly.** The Route Watch invitation now reads "Watch
  Manchester → Islamabad" and links to `/routes/manchester-islamabad#route-watch` (the same page the homepage already links
  to), replacing "Watch a route" which linked to `/routes/manchester-mumbai#route-watch` (a service-ended route, not a pilot
  page); that is the only link target removed (Manchester–Mumbai) and none is added. The closing band sentence changes from
  "One clear Journey Brief, checked and dated." to "Route status, fares and travel requirements, each checked and dated."
  The mobile Route Atlas layout is repaired and its country/destination chips also show on tablet widths (the same chip
  text that phones already had; no new copy). Title, canonical, robots and every pilot-page link are
  unchanged; the pilot pages and link targets are byte-identical to Production in visible text.

- **Atlas answer-card visibility fix (founder-approved 23 October 2026; dated by its Production release, merge commit and time
  to be added then):** the homepage HTML gains one sentence inside the mobile/tablet Atlas chip controls, "Tap a destination in
  {country} to see its route." (shown only while the route card is hidden; hidden from 1024 px up). No link, title, canonical,
  robots or pilot-page change.

- **Atlas service-ended card wording (the one approved exception to the homepage text freeze, CEO ruling 24 October 2026; dated by its
  Production release, merge commit and time to be added then):** the Manchester–Mumbai and Manchester–Delhi cards in the homepage
  Route Atlas no longer print the ledger's internal verification narrative. Before: the "Route intelligence" detail and the Active
  service notice each carried "Post-effective-date verification (2 September 2026): IndiGo's own live booking engine shows zero
  IndiGo-operated (6E-operated) nonstop flight … Corroborated by AeroRoutes' report … none is inferred …" (about 1,300 px on a phone).
  After: "Checked against IndiGo, AeroRoutes and Manchester Airport, most recently on 2 September 2026." and "Connecting journeys may
  still be available. Check the airline, the stops and the total journey time before you book."; verdict, flight-time line and notice
  label unchanged. No link, title, canonical, robots or pilot-page change. Homepage text is otherwise frozen to the 18 November
  checkpoint. The PR #349 merge commit is `287fb42f759cdad5b7a66e555e2d07ce2399cd0f` (00:37:16 BST on 24 October 2026).

- **Consent panel clearance (PR #354; merge commit `4a51ac28e226b98f2ce448e753c237f5d71f6a3a`, merged 00:04:51 GMT on
  3 November 2026, Production deployment 00:06:11 UTC):** layout only, on every page. While the first-visit consent panel is on
  screen, the page reserves its height at the bottom and keyboard focus stops above it instead of underneath it. Nothing is
  rendered differently in the server HTML: no visible text, link, title, canonical, robots or pilot-page change.

- **Fare evidence expiry (no deploy; from the 3 November 2026 UTC date, as pages regenerate):** **every pilot page and link
  target lost its fare card.** Every published fare except Birmingham–Islamabad's (11 December departure) departs on 17 November
  2026, and the 15-day departure guard withdrew them on 3 November, not on 17 November as the PR #347 entry above assumed. Routes with a current fare fell from 62 to 1 of 89. Pilot pages
  `manchester-islamabad`, `manchester-dubai` and `birmingham-delhi` and all five link targets now say "no current fare", and
  the homepage example-check card now shows only Manchester → Islamabad's service check, with no fare (same link). **`/tracked-fares` now links to 1 route guide instead of every target**, so the
  internal links this pilot relied on there are gone until fares return. Titles, canonical URLs, robots, Quick answers and the
  pilot's own link blocks are unchanged. Read the 4 November (Day 14) checkpoint with this in mind. Fare recovery will be logged
  here as its own event.

- **Date-deterministic fare tests (PR #355; merge commit `036b013b8ac0c6cec45f0e5e718c0e335dca74cd`, merged 12:35:09 UTC on
  3 November 2026):** no production code changes. The deploy it triggers renders the same pages as the build before it.

- **Fare recovery (PR #356; merge commit `d9610012704ba3526b2b04a4d75f8a9197834339`, merged 12:38:55 UTC on 3 November 2026,
  Production deployment 12:40:13 UTC; verified live: 25 routes with a current fare):** **fare
  cards return** on pilot pages `manchester-islamabad` (until 16 November, when its route review lapses), `manchester-dubai` and
  `birmingham-delhi` (until 14 December). They also return on link targets `london-heathrow-bengaluru` (until 27 November),
  `birmingham-dubai` and `birmingham-doha` (until 2 December) and `birmingham-mumbai` (until 14 December). `birmingham-jeddah` stays
  without a fare (held). The homepage example card shows Manchester → Islamabad's fare again until 16 November.
  - **Links:** `/tracked-fares` again links to every route with a current fare (25 on release day).
  - **Other changes:** airport, destination and hub pages, and route guides without a curated Deal, that have logged checks but no
    current fare change one sentence from "We haven't logged a tracked fare … yet" to "JetStash has checked fares for … before, but
    there isn't a current one we can safely show." No pilot page is affected; link target `birmingham-jeddah` is.
  - **Unchanged:** titles, canonical URLs, robots, Quick answers and the pilot's link blocks.

- **Arrive By public launch (PR #357; merge commit `4bcc5eae`, merged 14:07:02 UTC on 4 November 2026, Production deployment
  14:08:24 UTC):** **every page, pilot pages included, gains an "Arrive By" link** in the header (desktop and mobile) and in the footer,
  and `/arrive-by` becomes indexable and joins the sitemap (one more URL). The page's title changes from "Arrive By (Beta)" to
  "Arrive By: when to leave for your flight and onward journey".
  - **Pilot pages:** `manchester-islamabad` keeps its "Plan with Arrive By" panel while its route presents as Direct (its review
    lapses on 16 November). `manchester-dubai` and `birmingham-delhi` get no panel (Dubai and Delhi are not released).
  - **Link targets:** `birmingham-doha` gains a Doha panel (Doha's first public release); `manchester-doha` and, until its review
    lapses on 4 November, `london-heathrow-doha` do too. Neither is a pilot page.
  - **Unchanged:** route-page titles, canonical URLs, robots, Quick answers and the pilot's link blocks.

- **Priority route re-verification (PR #358; merge commit `51fd65389b5fa4f8dabbda55811e3f2891d083ff`, merged 13:47:45 UTC on
  4 November 2026, Production deployment 13:49:02 UTC; verified live):** Manchester–Lahore, Manchester–Islamabad and London
  Heathrow–Jeddah reviews renewed to 3 December 2026. Heathrow–Doha and Heathrow–Lahore stay in their
  fail-closed "Verification in Progress" state, with titles to match. **`manchester-islamabad` is a pilot page and its review
  now runs to 3 December, not 16 November as the PR #357 entry above assumed.** Titles, canonical URLs, robots and the pilot's
  link blocks are unchanged.

- **Trip.com affiliate pause (PR #360; merge commit `f5d04206a5d1341065d1dd0e8afcc76f4fb718ef`, merged 15:32:22 UTC on
  4 November 2026, Production deployment 15:34:02 UTC; verified live at 15:47:20 UTC against all 157 sitemap pages):**
  **every Trip.com flight and hotel link was removed from every page** (258 links on 90 pages before; 0 after). Pages that had one
  now show no flight button or, on route guides, a Google Flights link that earns JetStash nothing. No title, canonical URL, robots,
  Quick answer, sitemap entry or internal link changed. The pilot pages carry no Trip.com link either. The pause is a build-time switch and reverses by removing the Vercel
  variable and redeploying. Expect no ranking effect; read any day-14 movement without attributing it to this change.

- **Affiliate disclosure and privacy wording while the Trip.com pause is active (PR #361; merge commit
  `18ca514e9ca04a2bdcd62fd1947aaf29dd622216`, merged 21:11:18 UTC on 4 November 2026, Production deployment active 21:12:20 UTC;
  verified live at 21:13:03 UTC against all 157 sitemap pages, 0 fetch failures, 0 Trip.com links):** `/affiliate-disclosure`
  no longer names Trip.com as the current flight-booking partner while the pause is on, and `/privacy-policy` now says the site
  links to "flight-search and booking websites". Only those two pages' wording changed. No title, canonical URL, robots, sitemap
  entry or internal link changed anywhere in the crawl. Expect no ranking effect.

- **Arrive By visitor-window repair (PR #362; merge `a4313be050a05f8eae6aad45e223e7ac9b4f0c9a`, merged 00:12:48 UTC on
  5 November 2026; exact-SHA Production Ready 00:14:07 UTC):** server-side visitor limiting only. No route/fare data, titles,
  canonical URLs, robots, sitemap, pilot copy or internal links changed. It is complete, not an outstanding release.

- **Dependency security patch (PR #363; merge `9d91f2e0c02c184060325504b9cfcebe989d5917`, merged 02:51:12 UTC on
  5 November 2026; exact-SHA Production Ready 02:52:26 UTC and custom-domain deployment confirmed):** Next.js 15.5.29 and
  compatible security dependency fixes. No application copy, route/fare records, metadata, sitemap or internal links changed.
  The ten-page release smoke matched sampled displayed prices and retained the Trip.com pause. No ranking effect is established.

- **Archive-aware airport/destination fare-card copy (PR #364; merge `6410aa6e119722b4d5f1c4b6ebb301a61ef0d0b3`, merged 14:12:29 UTC
  on 5 November 2026; Production verification recorded as successful in the CEO decision of 5 November, deployment id and Ready time
  not captured here):** cards with recorded history
  but no eligible representative fare change "No fare logged yet" to "No current fare to show". Never-observed cards retain the old
  wording. The same history-presence distinction now applies to cabin-scoped DealCard absence copy; package wording and all range
  calculations remain unchanged. The audit's 128 instances on 34 pages cover the two lead card templates only. Final 5 November replay:
  those 128 plus 84 lower-card corrections across 50 pages total. Fare selection, titles, canonical URLs, robots, sitemap, Quick answers and internal-link destinations
  are unchanged.

- **Homepage first-visit usability (PR #353; merge `305542cfe57e3390aca89ac1ab58d9ad488329ef`, merged 00:09:17 UTC on 6 November 2026,
  Production deployment Ready minutes later, deployment id not captured; live smoke at 00:11 UTC confirmed the new copy):** homepage text changes: the eyebrow gains
  "to Pakistan, India or the Gulf" from sm up, phones gain a "For UK travellers flying to Pakistan, India and the Gulf." line below the
  console, and the closing button reads "Check my journey" (was "Check my trip"). The `<h1>`, `<title>`, meta description, canonical,
  robots, sitemap, route/fare records and internal links are unchanged. Treat as a homepage-text event for the pilot.

- **Route-page accessibility and signup fixes (PR #365 "PR A"; merge `f0ab8dfba47e4f5aa46f24f1a2e87ae9397e6ae0`, merged 01:39:31 UTC on
  6 November 2026, Production deployment Ready within about a minute, deployment id not captured; live verification from 01:40 UTC):** colour, size and layout classes
  only (route facts and the WhatsApp share button contrast; Route Watch and Travel Club email field height; 16px phone controls). No
  visible copy, heading, `<title>`, meta description, canonical, robots, sitemap, route/fare record or internal link changes, so no
  pilot-page text event.

- **Route-page Travel Ready Check below fare history (PR #366 "PR B"; merge `96426c2d9b76d45ee6368d2c53b7d361d61b4f9c`, merged 02:12:01 UTC on
  6 November 2026, Production deployment Ready within about a minute, deployment id not captured; live verification from 02:13 UTC):** a layout and order change on
  every route page that carries the Travel Ready Check, including **all three pilot pages** (manchester-islamabad, manchester-dubai,
  birmingham-delhi). The check's text is unchanged but now follows the fare history instead of preceding it, and one new visible
  sentence is added where it used to be ("Travelling on set dates? Passport validity and visa guidance for your documents is in the Travel
  Ready Check, below the fare history."). Headings, `<title>`, meta description, canonical, robots, sitemap, Quick answers, route/fare
  records and internal link targets are unchanged. Treat as a content-order event for the three pilot pages.

- **Route-page fare clarity and traveller next steps (PR C; prepared for review, not Production-deployed):** visible text changes on 46 of
  the 89 route pages, including **all three pilot pages**. manchester-islamabad: the badge "Direct" becomes "Direct service", the price line
  gains "· connecting", the route-service callout sentence is reworded, and the hero flight-time line "Typical flight time: Direct; check
  PIA for the scheduled duration" becomes "Typical flight time not verified. Check the airline's current schedule." (also in the Flight time
  row). manchester-dubai: the badge, price qualifier and callout sentence change. birmingham-delhi: the hero flight-time line "Connecting
  via Amritsar — journey time depends on the connection" becomes "Journey time varies by itinerary and connection." (also in the Flight time
  row). Elsewhere: "Direct service" badge on 34 direct pages, "· connecting" on 15, 16 flight-time lines replaced, Manchester-Delhi and
  Manchester-Mumbai gain a Google Flights search card and a reworded hero ("Direct service ended", "Connecting alternatives may be available…", no
  undated stop or duration figures; not pilot pages), and the obsolete Trip.com handoff sentence leaves nine route introductions
  (visible on London-Gatwick-Tangier today). Headings, `<title>`, meta description, canonical, robots, sitemap, Quick answers, prices, route
  and fare records and internal link targets are unchanged. Treat as a content-wording event for the three pilot pages; record the actual
  merge/deployment here only after separate approval and release.

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
