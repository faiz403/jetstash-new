# JetStash Current Status

**Latest release reconciliation:** 6 November 2026, through PR #368. The older dated programme/count snapshots below are historical.

**Production branch:** `main`

**Confirmed Production baseline:** `9d91f2e0c02c184060325504b9cfcebe989d5917` (PR #363). Vercel Production
`dpl_H6mhwiDdQqhfQ957gpxu4iDgzrm1` was Ready at 02:52:26 UTC on 5 November; the custom domain was confirmed serving it.
PR #362 is also merged and deployed, not outstanding. PR #364 (archive-aware fare-card wording) merged as
`6410aa6e119722b4d5f1c4b6ebb301a61ef0d0b3` at 14:12:29 UTC on 5 November; the CEO decision of 5 November records its Production
verification as successful (this session did not capture the deployment id or Ready time).
PR #353 (homepage console and phone consent panel) merged as `305542cfe57e3390aca89ac1ab58d9ad488329ef` at 00:09:17 UTC on
6 November after an independent Codex review of head `ede0d439c2381900ad9438fdad7331f4c2c4cfff` (PASS WITH NOTES, no P1/P2). The Vercel
Deployments list showed the Production deployment of `305542c` Ready (55s build) minutes later; its deployment id was not captured. A
live read-only smoke at 00:11 UTC returned 200 and zero Trip.com mentions on 13 pages and showed the new homepage copy; the consent panel
measured 117px (320x568, 320x720, 375x667), 100px (390x844), 135px (768x1024) and 113px (1440x900) with no overflow or overlap, and Reject
stored both choices denied with zero tag or Google requests. The merge changed no `data/` or `lib/` file, so the 25 Fare Signals are
unchanged.
PR #365 (route-page accessibility and signup fixes, "PR A") merged as `f0ab8dfba47e4f5aa46f24f1a2e87ae9397e6ae0` at 01:39:31 UTC on
6 November after an independent Codex review (`c6e858c` FAIL on one real P2 plus three P3s, all fixed; head `8b6c9fd4bcb4aafef273e18d8623a49ea20adc24`
PASS WITH NOTES, no P1/P2). The Vercel Deployments list showed the Production deployment of `f0ab8df` Ready (1m 8s build) within about a
minute; its deployment id was not captured. Live read-only verification from 01:40 UTC: on Manchester-Doha, Manchester-Islamabad,
London-Dubai, Manchester-Delhi and /travel-club at 320, 390 and 1440px the route-fact labels measure 8.48:1 and values and the WhatsApp
button 18.69:1 (were 2.45:1 and 1.08:1), every form field is at least 44px tall (Route Watch email was 18px, Travel Club 21px) and
controls are 16px on phones, with no overflow; all 89 route pages return 200 with one h1, the old dark-hero fact classes and the
collapsed email classes are gone from every one of them, 25 pages still show "Fare spotted" (the 25 Fare Signals are unchanged; the merge
changed no `data/` or `lib/` file), and Tab order through Route Watch is airport, destination, purpose, email, submit with a 2px focus
outline on each stop. Reject still stores both choices denied with zero tag or Google requests. The only Trip.com text on any route page
is one prose sentence on London-Gatwick-Tangier (existing editorial copy: "Trip.com does not currently provide an airport-specific
dateless handoff for Gatwick"), not a link; there are no Trip.com links (route-page PR C removes that sentence). No Google routing call was
made.
PR #366 (route-page "PR B": Travel Ready Check below fare history) merged as `96426c2d9b76d45ee6368d2c53b7d361d61b4f9c` at 02:12:01 UTC on
6 November after an independent Codex review (`ce46a57` PASS WITH NOTES, no P1/P2, two P3s fixed in head `3aff2db68413a2419edcc7ff83a247dc10709edb`;
delta check PASS). The Vercel Deployments list showed the Production deployment of `96426c2` Ready (1m 8s build); its deployment id was not
captured. Live read-only verification from 02:13 UTC: the Travel Ready Check appears on exactly 72 of the 89 route pages and is absent from
the other 17 (every Barcelona, Faro, Athens and Rome pair); on all 72 the pointer line precedes Route Watch, `id="travel-ready"` follows it,
the check heading appears once and there is exactly one Route Watch form; no in-page anchor lacks a target; the fare history heading sits
about 1,250px higher on a 390px phone (Manchester-Doha 3,285 to 1,998px; Manchester-Islamabad 6,472 to 5,240px) and about 800px higher at
1440px; Tab reaches the pointer, Enter lands on the section and the next Tab enters the check; after running the check Book-By's badge
changes and its link back works by keyboard; a client-side move from Islamabad to Lahore carries no signal over; 25 pages still show "Fare
spotted"; there are no Trip.com links; consent, the homepage, the journey form and the PR A fixes are intact; no Google routing call was
made. At 320x568 the first check field after the pointer sits flush with the bottom edge (later stops are fully visible). No deployment is
authorised by a documentation update.
PR #367 (route-page "PR C": fare clarity and traveller next steps) merged as `2669374818d324cb7d1339d93afb3956d2487943` at 14:18:18 UTC on
6 November, on explicit CEO approval, at exact head `ca6d9c0938dc7be269e6b2acf26baab7ce26b15d` (Codex `8ab9adb` PASS WITH NOTES, `61e0033` PASS WITH
NOTES with two documentation P3s fixed, delta `ca6d9c0` PASS with no defects; GitHub checks green). The Vercel Deployments list showed the
Production deployment of `2669374` Ready (1m 12s build) within about two minutes; its deployment id and exact Ready time were not captured.
Live read-only verification afterwards: all 89 route pages returned 200 and were text-identical to a local build of the same tree with the
Trip.com pause on; 25 pages show "Fare spotted" with prices, airlines and dates unchanged; 34 "Direct service" badges; 15 "· connecting"
price qualifiers with the approved explanation; 16 flight-time replacements with verified durations preserved; zero Trip.com text or links;
the nine introductions are clean; Manchester-Delhi and Manchester-Mumbai show the approved hero, "Find connecting alternatives", the Google
Flights button and its disclaimers, and the link is `https://www.google.com/travel/flights` with `target="_blank"` and
`rel="nofollow noopener noreferrer"` (never opened); the button is reachable by keyboard with a 3px focus outline at 320, 390 and 1440px, there
is no horizontal scroll, text fields are 16px, consent is unchanged, and there were zero Google routing requests and zero external requests.
The undated "Usually 1 stop" and "12 to 15h total" pattern appears only in the lower "Connecting alternatives" section of those two pages, not in
the hero. No Google routing call was made.
PR #368 (route-page "PR D": first-screen action and duplication) merged as `69a0924cedcdc0db67eb7bafcfab21ff33cbd29f` at 15:22:31 UTC on
6 November, on explicit CEO approval, at exact head `48476765e36428ef624040774c3e5f8fea15db8a` (Codex `98baa3e` PASS WITH NOTES with five P3s fixed, delta
`4847676` PASS with no defects; GitHub checks green; Vercel Preview `4847676` Ready). The Vercel Deployments list showed the Production
deployment of `69a0924` building about a minute after the merge; its deployment id and exact Ready time were not captured. Live read-only
verification from about 15:25 UTC: all 89 route pages returned 200 and were text-identical to a local build of the same tree with the
Trip.com pause on (the tree whose fare evidence had already been compared with the previous Production: prices, checked dates, travel dates,
airline and cabin text and coverage notes identical); 25 pages show "Fare spotted"; 15 "· connecting" qualifiers; 34 "Direct service"
badges; zero Trip.com text or links; on the 15 connecting-fare pages every page keeps the qualifier, the Route service explanation, the
checked date and the price, and none carries a separate pill under the price. The primary action is fully visible on 12 of 15 pages at
390x844 (median bottom edge 799px; maximum 873px), none at 320x568 or 320x720 (median 975px; reached by scrolling), and all 15 at 1440x900
(721px). At 320, 390 and 1440px: Tab reaches the Google link with a 3px outline (`rel="nofollow noopener noreferrer"`, never opened), no
horizontal scroll, Reject stores both choices denied, the Travel Ready section and form, Route Watch (email field 44px, 16px on phones) and
the fare-history anchor are present, and there were zero Google routing requests and zero external requests. A separate branch
(`fix/homepage-consent-and-clarity-2026-11`, "keep consent choices clear of mobile actions") appeared in the Vercel Deployments list as a
Preview; it was not touched or reviewed here.

**Current founder direction — 5 November:** execute the Website Improvement Programme through small, tested PRs, beginning
with archive-aware fare-card wording, then homepage PR #353 (merged 6 November), then the route-page programme below. Stop before every Production merge for approval.
This is a specific exception to the older engineering freeze, not permission for arbitrary features, fabricated evidence or growth claims.
Keep Trip.com paused, the monthly Google counter unchanged and all 28 reserved calls held. JetStash stays on Vercel; do not reopen
Netlify work. Commercial plan suitability remains a separate decision; no subscription or settings change is authorised.

The 14 September programme reconciliation used `2f1ede5` (PR #272). Its closure and older route/fare counts are retained below
as dated history, not today's authoritative inventory. Recompute current coverage at an explicit evaluation date before using it.

**Launch readiness:** ready for controlled public organic use. Google Ads Basic Consent Mode and
conversion tracking are live; missing instrumentation is no longer the paid-growth blocker.
Serious paid/commercial promotion still requires meaningful conversion evidence, the open
founder/professional legal decisions in `LAUNCH_CHECKLIST.md` B2, and distributed/WAF-backed form
rate limiting rather than the current process-local limiter.

**Production site:** `https://jetstash.co.uk`

## Arrive By service-ended wording — 6 November 2026 (prepared for review; not merged, not deployed)

- CEO-approved narrow trust correction. `lib/arrive-by/route-support.ts` now gives a service-ended route that carries evidenced
  connecting-alternative data (`presentation.canShowConnectingAlternative`, true for Manchester-Delhi and Manchester-Mumbai) the approved
  warning: "The former direct service has ended. Connecting alternatives may be available, but JetStash has not checked live flight
  availability. Check current flights, stops and journey times for your dates before booking." It replaces the canonical summary's "See below
  for the current connecting journey and how to check today's price". A service-ended route without that evidence keeps the canonical
  fail-closed summary ("Check current options directly with airlines before booking"); verification-pending, unspecified and every other
  status are untouched.
- Only the warning string changed: canonical statuses, `presentation.summary`, `statusHeadline`, route evidence, the Stage 1 calculations and
  the public planner are unchanged. Exposure: none today (see the corrected trust-review note in the PR D section: the Stage 1 engine's only
  renderer is an unused founder component and `/founder/arrive-by` 404s in production), so this removes a latent contradiction rather than
  a live one. Tests: `tests/arrive-by-service-ended-wording-2026-11.test.ts`.
- Not an approved release; merge still requires CEO approval.

## Route-page first-screen action and duplication — 6 November 2026 (PR #368 "PR D" merged `69a0924`; Production live-verified)

- CEO-approved after the 6 November reassessment; presentation only. No price, airline, observed date, fare classification, route status,
  verification, Trip.com or data change; the Trip.com pause stays on. Not a redesign: no new card, element or feature.
- **What changed.**
  1. The separate "Connecting fare, not nonstop" pill under the first-screen price is gone (15 pages). The "· connecting" qualifier on the price
     line, the routing line and the "Route service" explanation already said it. The explanation sentence is unchanged and still sits under
     the routing line, ahead of the search button.
  2. The fare section's card further down keeps its pill, travel dates, checked date and fare note, but no longer repeats the explanation
     sentence when the first-screen card states it (`DealCard` prop `connectingExplanationShownAbove`, set only by the route page and only
     when the first-screen fare is a connecting fare on a direct route; every other caller is unchanged).
  3. Airline, cabin and checked date read as one line on a phone ("Saudia · Economy · Checked 3 November 2026"; two stacked lines before);
     from sm up the layout is as before.
  4. A "not verified" or "varies" flight-time sentence is no longer a hero line (16 pages: 6 direct and 10 connecting); it stays as the "Flight
     time" row in the route facts. A verified duration still shows in the hero.
  5. A service-ended hero (Manchester-Delhi, Manchester-Mumbai) no longer shows a badge repeating its own "Direct service ended" status
     line, and the ended-service fare card leads with "JetStash has not checked live availability for connecting flights." instead of
     restating the ending a third time. The CEO-approved hero heading and supporting text, the Google Flights button and its note are unchanged.
- **Measured** (live Production = `main` `2669374` against the local PR D build with the Trip.com pause on; exact tables in the PR): on a 390x844
  phone the primary search action on the 15 connecting-fare pages moved from fully visible on 0 pages to 12 (median bottom edge 858px to
  799px; Manchester-Islamabad 896px to 789px); the other three are 13-29px below the fold. At 320x568 and 320x720 it is still below the
  fold on those pages (median 1014px to 975px) and is reached by scrolling; the price is now visible on a first visit at 320x568. At 1440px
  every action stays visible and moves up (Islamabad's now clears the consent banner). No page's action moved down. Repeated statements
  across the 89 pages: the explanation sentence 21 to 15 occurrences (once per qualifying page), the pill 21 to 6 (the fare section card's
  own pill on the pages that have one), the direct-route "Typical flight time not verified" sentence 12 to 6 (the Flight time row). The first-screen fare card is 59px shorter on a 390px phone on each qualifying page (Manchester-Istanbul's
  sections were compared one by one: the card is the only one that changed); Manchester-Islamabad is 173px shorter overall. The consent banner is unchanged (117px at 320, 100px at
  390, 113px at 1440) and still covers the action on a first visit at phone widths: reducing it was deliberately not attempted.
- **Trust review (CEO request): outdated canonical service-ended wording.** Checked in source and on Production:
  - Homepage evidence: not affected today. `lib/homepage-evidence.ts` reads `statusHeadline`, but its only candidate is
    `manchester-islamabad` (a direct route), so the ended wording cannot reach it; no live non-route page carries "connecting flights
    available" or "former direct service ended" (68 non-route sitemap pages and the homepage scanned). Caveat: the evidence-fare branch has
    no status gate of its own (only the Route Watch helper has one), so widening the candidate list to a service-ended route would surface the
    canonical ended headline there; that list is pilot-controlled.
  - Manchester-Mumbai journey brief: not public (`/founder/journey-brief/manchester-mumbai` 404s in production).
  - **Arrive By: a wording contradiction in the Stage 1 engine, not customer-visible.** Manchester-Delhi and Manchester-Mumbai are in the
    Stage 1 engine's supported set (`lib/arrive-by/route-support.ts`), and for a service-ended route its route warning was the canonical
    `presentation.summary`: "There's no current nonstop service on Manchester to Delhi — the previously-verified direct service has ended. See
    below for the current connecting journey and how to check today's price." There is no "below", and "the current connecting journey" asserts
    an availability that has not been checked live. Correction to the first report of this finding (which implied a public surface): the only
    component that renders that warning (`components/founder/arrive-by-preview.tsx`) is not imported anywhere, `/founder/arrive-by` 404s in
    production, and the public planner uses a different engine that never offers an ended route (`getPublicJourneyRoutePairs`). It is a
    dormant defect, fixed in the follow-up PR "Arrive By service-ended wording" below.
  - The canonical `statusHeadline` ("Former direct service ended · connecting flights available") now has no public consumer for an ended route.
- Known limits: at 320 the action still needs a scroll on the connecting-fare pages; Manchester-Istanbul, Birmingham-Dalaman and
  Birmingham-Athens sit 13-29px below the 844px fold at 390; the first-visit consent banner covers the action on phones; page length is unchanged
  in kind (PR E is a separate proposal).
- Merged on explicit CEO approval; verification results are in the baseline paragraph above.

## Route-page fare clarity and traveller next steps — 6 November 2026 (PR #367 "PR C" merged `2669374`; Production live-verified)

- CEO-approved after the 6 November route-page audit; presentation and prose only. No price, route status, fare classification, verification,
  fare history or Trip.com change: a before/after comparison of all 89 live route pages against a local build with the Trip.com pause on
  found every price identical, 25 pages showing "Fare spotted" in both, no Trip.com text, 43 pages byte-identical in text and 46 changed
  only as listed here.
- **A. Service versus fare.** A verified direct route's badge now reads "Direct service" (34 pages; `getRouteHeroBadgeLabel`, every other
  status keeps its canonical label). On the 15 pages where a verified direct route shows a connecting fare, the price line carries
  "· connecting" (for example "£906 return · connecting"; "connecting", not "with a stop", because an itinerary may have several stops), the
  "Connecting fare, not nonstop" pill is unchanged, and the explanation reads "Nonstop services are listed for this route, but this tracked
  fare is for a connecting journey. It is not a nonstop fare." (the lower fare cards use the same sentence). The airline in the callout still
  comes from the route record.
- **B. Ended-service next step.** Manchester-Delhi and Manchester-Mumbai (service ended, evidenced connecting alternatives) no longer end
  on "No current fare tracked." They show "Find connecting alternatives", "The former nonstop service on this route has ended. JetStash has
  not checked live availability for connecting flights." and a "Search connecting flights on Google Flights" button with the note "Opens
  Google Flights. JetStash does not earn commission from this link. It does not fill in your search: enter your airports and travel dates
  there. The former nonstop service has ended, so results may show connecting itineraries." The link is the plain Google Flights URL (no query string, routing API, tracking or affiliate
  parameter) and is used only on a service-ended route that carries evidenced connecting-alternative data and has no monetised handoff,
  which is every such route while the Trip.com pause is on. If Trip.com resumes, a verified handoff keeps its own label and takes precedence.
  No stop count, journey time, airline or itinerary is promised in that card.
- **B2. Ended-service hero (CEO ruling of 6 November, same PR).** The hero on those two pages reads "Direct service ended" with "The former
  nonstop service has ended. Connecting alternatives may be available. Check current flights, stops and total journey times for your dates
  before booking." The earlier "connecting flights available" claim and the undated "Usually 1 stop · 12 to 15h total" line are gone from the
  hero. Other wording on those pages that conflicted was corrected too: the "More route information" summary now points at the route-status
  evidence instead of "the current connecting journey", and the lower section is "Connecting alternatives" ("may be available, but JetStash has
  not checked them live", with its labelled general pattern kept) instead of "You can still fly this route with a connection". The canonical
  `service-ended` status, its evidence, the `connectingAlternative` data and the canonical `presentation.statusHeadline` and `summary` are
  unchanged: only this page's wording differs (`lib/route-first-screen-copy.ts`).
- **C. Flight-time wording.** One helper (`lib/route-first-screen-copy.ts`) feeds the hero line and the "Flight time" row. Verified durations
  are unchanged. Status-first values without a duration figure (16 pages) are replaced: direct, "Typical flight time not verified. Check the
  airline's current schedule." (6 pages); connecting, "Journey time varies by itinerary and connection." (8); unverified, "Journey time not
  yet confirmed." (2). The record's own `flightTime` string is never edited.
- **D. Obsolete Trip.com sentence.** Removed from the public `intro` of nine routes (Gatwick-Istanbul, Antalya, Dalaman, Bodrum, Izmir,
  Marrakech, Agadir, Tangier and Heathrow-Casablanca). Only the booking-handoff sentence was removed; internal `note` fields, status, fare and
  verification records are unchanged.
- Known limits, not changed here: the canonical service-ended `statusHeadline` ("Former direct service ended · connecting flights available") and
  `summary` ("…See below for the current connecting journey…") still exist for the surfaces that read them (Arrive By's route warning, the
  Manchester-Mumbai journey brief and the homepage evidence source); they no longer reach the two route pages but deserve the same wording
  decision. The 320x568 ended-route button needs a scroll (it is fully visible at 390px). Some lower "Other UK airports" cards still print raw
  `flightTime` strings without the flight-time label. Three SEO-pilot pages change text: see the pilot log.
- Merged on explicit CEO approval; verification results are in the baseline paragraph above. The CEO accepted the labelled general
  connecting pattern still shown on Delhi and Mumbai as an overview, with its continued accuracy to be checked in a future evidence review.
  A 6 November independent reassessment of the live pages (internal judgement, not user-tested; no conversion evidence) put the route pages
  at about 7.2/10 against the 6.4/10 audit baseline. Its remaining findings (page length and repetition, first-screen action position,
  duplicated fare statements, touch-target size, consent crowding at 320x568, JavaScript weight) drive PR D and the proposed PR E below.

## Route-page Travel Ready Check below fare history — 6 November 2026 (PR #366 "PR B" merged `96426c2`; Production live-verified)

- The 6 November audit measured the Travel Ready Check (a five-field form, about 1,350px tall on a phone) sitting between the first-screen
  fare card and the fare history, which pushed the fare evidence 3,200-6,500px down a 390px-wide page. It now renders in its own section
  (`id="travel-ready"`) after the fare section (fare history, deals and Route Watch). Every function, field, warning and scope note of the
  check is unchanged (`components/travel-ready/travel-ready-check.tsx` is not modified).
- One pointer line stays where the form used to be, so it remains discoverable: "Travelling on set dates? Passport validity and visa
  guidance for your documents is in the Travel Ready Check, below the fare history." It links to `#travel-ready`. Book-By's existing "see
  below before you book" note now links to the section when the note comes from the Travel Ready Check; route-warning notes keep the old
  wording. Existing anchors `#fare-history` and `#route-watch` are unchanged. Routes whose country the check does not cover show neither the
  check nor the pointer, as before.
- Book-By's verdict badge still folds in the visitor's Travel Ready result on the five priority routes: `RouteReadinessPanel` was replaced
  by a small context in `components/route/route-readiness-panel.tsx` (`RouteReadinessProvider`, `BookByPanel`, `TravelReadySlot`) because the
  two panels are no longer adjacent. Nothing leaves the visitor's browser, as before.
- Moving the section improves information order; it does not by itself shorten the page. The Travel Ready Check's own copy and all
  fare, route, Route Status, verification, Trip.com, analytics and data records are unchanged; the only wording changes are the new pointer
  sentence and the Book-By note's link wording described above. The three SEO-pilot pages (Manchester-Islamabad, Manchester-Dubai, Birmingham-Delhi) are affected: see
  the pilot log.
- Merged on explicit CEO approval; verification results are in the baseline paragraph above. PR C (direct versus connecting fare clarity,
  ended-service search, flight duration wording) followed as PR #367 and is merged.

## Route-page accessibility and signup fixes — 6 November 2026 (PR #365 "PR A" merged `f0ab8df`; Production live-verified)

- A read-only mobile audit of live `/routes/[slug]` (320/390/1440px; 89 pages classified, 11 measured, 6 viewed; average about 6.4/10)
  found two defects, fixed here without any copy, fare, route, Route Status, verification or Trip.com change:
  1. The "Flight time / Frequency / Airlines" facts and the WhatsApp share button used dark-hero colours on the light "More route
     information" section: labels measured 2.45:1 and values and button text 1.08:1. They now use `text-ink-500` (8.5:1), `text-ink-900`
     (18.7:1) and the existing `variant="light"` share button.
  2. The Route Watch and Travel Club email fields collapsed to 18px and 21px tall below 640px (`flex-1` inside a `flex-col`). They are
     now full width on phones and 44-48px tall, with `sm:flex-1` for the row layout. Inputs and selects in Route Watch, Travel Club and the
     Travel Ready Check are 16px on phones (14px from sm up, except the Travel Club email input, which stays 16px at every width, as
     before) so iOS Safari does not zoom on focus (not tested on a device). The light WhatsApp share button no longer turns its text
     green on hover (measured about 3.87:1 against its tinted hover background); it keeps the dark ink text.
- Also corrects the homepage test assertion Codex flagged on PR #353 (P3: the `<PageHero[^>]*description=` regex stopped at the first `>`).
- Merged on explicit CEO approval; verification results are in the baseline paragraph above. Remaining P3 recorded for a later PR: the
  WhatsApp hover-contrast guard test (`tests/route-page-accessibility-signup-2026-11.test.ts`) does not reject `hover:text-white` or
  opacity-suffixed hover utilities.
- Approved next, as separate PRs after review and Production verification: PR B (move Travel Ready Check below fare history, no change to
  its functions or warnings) and PR C (make a direct service versus a connecting fare unmistakable on the first screen; a clearly labelled
  Google Flights search on ended-service Manchester-Delhi and Manchester-Mumbai without implying the direct service operates; separate
  flight duration from service status). Trip.com stays paused.
- Not an approved release; merge still requires CEO approval.

## Homepage first-visit usability — 5 November 2026 (PR #353 merged 6 November 2026; Production live-verified)

- PR #353 (ivory journey console) now includes current `main` (through PR #364) with no conflicts. The CEO approved improving the existing
  design, not rebuilding it.
- Measured on the branch before this change, the first-visit consent panel covered the homepage submit button at 320x720 and 375x667
  (and the whole console at 320x568). On a phone the first-visit panel is now about 100-117px instead of 159-176px (same two optional
  permissions, same Privacy Policy link, equal Reject all / Accept all; a 44px Settings control opens the individual choices; the panel
  scrolls inside itself above 85% of the viewport). From sm up the panel is unchanged. The page end still scrolls clear of it.
- On a phone the journey console now sits above the description (visual order only; document order and desktop are unchanged), so the
  submit button is fully visible above the panel at 320x720, 375x667 and 390x844. Form labels are 12px, not 11px.
- The hero photograph shows through on the far side from lg up (a left-to-right overlay on the homepage only; every other hero keeps the
  even veil). Measured text contrast over the real rendered pixels stays at 6.9:1 or better. Hero text now names its audience (eyebrow
  from sm up; a line below the console on phones). The closing action reads "Check my journey" to match the console. Spacing above Route
  Watch is tighter.
- No fare, route, Route Status, Trip.com, Arrive By, analytics or consent-logic code or data changed. Homepage text changed, so this is a
  homepage SEO-pilot event, logged in `SEO_INDEXING_PILOT_2026-10-21.md`.
- Merged as `305542cfe57e3390aca89ac1ab58d9ad488329ef` at 00:09:17 UTC on 6 November 2026 on explicit CEO approval, after the Codex
  review of head `ede0d439c2381900ad9438fdad7331f4c2c4cfff` (PASS WITH NOTES; one P3 test-assertion note, corrected in the route-page PR A).
  Production deployment Ready; see the baseline paragraph above for the live checks. Remaining weaknesses recorded at merge: the
  320x568 submit still needs a scroll; the mobile Route Atlas and the three competing desktop first-screen elements were not reworked.

## Archive-aware fare-card wording — 5 November 2026 (PR #364 merged; Production verification reported successful)

- The two lead route-card templates now distinguish recorded history with no eligible fare (**"No current fare to show"**) from
  genuinely never-observed routes (**"No fare logged yet"**). Only a server-derived history-presence boolean reaches the airport grid.
- Browser verification found the same contradiction in lower DealCards. Their cabin-scoped no-range copy now checks archive presence,
  not publication eligibility. Package wording, range calculations, price selection, route status and booking destinations are unchanged.
- Explicit 5 November replay: 128 lead-card and 84 lower-card corrections, 50 public pages affected. All 25 Fare Signals, selected
  observations, prices and historical ranges are unchanged; Fare Watcher / Route Watch / Standout remain 0 / 0 / 0.
- Local gate: 5,657 tests, TypeScript, lint, production build and diff check pass. Thirty browser renders (Production comparison plus
  local 1440/390/320px checks) found no horizontal overflow, failed images or Trip.com links. No Google/API submissions or counter probes.
- This is a presentation-truth fix, not a freshness/eligibility policy change. Merged as PR #364
  (`6410aa6e119722b4d5f1c4b6ebb301a61ef0d0b3`, 14:12:29 UTC on 5 November 2026).

## Dependency security maintenance — 5 November 2026 (PR #363 merged and verified in Production)

- **Release:** merged `9d91f2e0c02c184060325504b9cfcebe989d5917` at 02:51:12 UTC; exact-SHA Production Ready 02:52:26 UTC.
  Ten read-only page checks returned 200; sampled displayed prices matched the pre-release crawl; optimized images and homepage-to-route
  navigation worked; no Trip.com links appeared in that sample. No rollback was indicated. No Google API or counter probe was performed.

- Founder-approved response to the independent audit: Next.js `15.5.24` → `15.5.29`, within the existing major/minor line;
  locked sharp `0.35.4` → `0.35.5`, source-map-js `1.2.1` → `1.2.2`, and patched compatible development-only Vite/brace-expansion dependencies.
- Next.js still declares PostCSS `8.4.31`, so a Next-scoped override uses the already installed compatible PostCSS `8.5.28`.
  This removes the vulnerable nested copy without overriding other consumers or changing the application CSS pipeline.
- Lockfile audit: critical/high affected package nodes `1 / 5` → `0 / 0`. Nine moderate development-tool nodes remain disclosed;
  this is not a claim that every advisory has been eliminated or that Production exploitation was demonstrated.
- Exposure review found repository-controlled local images, no remote image hosts or upload feature, SVG optimization not enabled,
  and no Server Actions. No exploit or live routing request was attempted. These conditions narrow exposure, not permission to leave
  affected versions installed.
- No fare records, selectors, route evidence, affiliate configuration, UI, Arrive By logic, monthly Google counter or held calls changed.
  Trip.com remains paused. Hosting research and fare-card copy corrections are separate; neither is implemented by this patch.

## Arrive By visitor rate limiter repair — 4 November 2026 (PR #362 merged and in Production)

- **Release:** merged `a4313be050a05f8eae6aad45e223e7ac9b4f0c9a` at 00:12:48 UTC on 5 November; exact-SHA deployment
  `dpl_E442hD51AxAshsFrBQeSSbujzNqS` Ready at 00:14:07 UTC. It is an ancestor of the verified #363 Production release.

- **Defect (found live on 4 November 2026):** the per-visitor limiter shared the monthly Google budget's counter, which runs INCRBY
  then EXPIRE on every request. Refused requests therefore re-armed the 60 second expiry, so a visitor who kept retrying was locked
  out until they stopped for a full minute.
- **Fix:** a separate fixed-window counter used only by the visitor limiter (`lib/arrive-by-shared/visitor-window-store.ts`): one
  atomic Redis script per request, expiry set only when the window opens (or if a counter somehow has none). Same published numbers
  (five calculations per 60 seconds, 30 interactions), same hashed keys under a new prefix, same fail-closed behaviour.
- **Untouched:** `lib/arrive-by-journey/call-budget.ts` and the 2,000-call monthly Google counter, the ten-call journey ceiling, and
  all five endpoints' call order. A test pins that the monthly counter file is unchanged in behaviour.
- **Validation boundary:** the implementation's offline fixed-window regression evidence is retained. The release is complete by
  founder acceptance; this documentation reconciliation did not rerun a live Upstash check, read counters or consume Google calls.
  Shared-IP risk (a household or mobile carrier sharing one address shares one allowance) remains unchanged.

## Trip.com affiliate pause switch — 4 November 2026 (PR #360 merged; pause ACTIVE and verified live)

- **Live record (UTC, 4 November 2026):** #360 merged as `f5d04206a5d1341065d1dd0e8afcc76f4fb718ef` at 15:32:22; Production
  deployment 15:34:02 (the activation time); verified at 15:47:20 by a cache-disabled crawl of all 157 sitemap pages: Trip.com
  links 258 → 0 (flights 229 → 0, hotels 29 → 0), pages with the affiliate ID 90 → 0, no affiliate ID in any of 46 browser
  bundles, no redirects. The founder emailed `affiliation@trip.com` on 4 November 2026 asking for written clarification and stating
  the pause. **The agreement is neither accepted, terminated nor resolved by this.** Keep the pause until the contractual position
  is clarified. The affiliate-disclosure page no longer names Trip.com as a current partner while the pause is on, and the privacy policy's
  "Other websites you link to" section no longer says "booking partners such as Trip.com" (follow-up PR).

- **Why:** Trip.com's updated Online Cooperation Agreement (deemed accepted by continued participation, clause 15.2; SEO restricted
  without written approval, clause 3.2.5; link parameters, clause 3.2.3) raises questions JetStash has asked in writing and not had
  answered. On 4 November 2026 the founder decided to be able to pause affiliate handoffs while seeking written clarification.
- **What:** one switch, `NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED`, read by `lib/tripcom-affiliate-pause.ts`. When it is exactly `true`,
  every Trip.com flight and hotel lookup (seven functions in `lib/booking-providers.ts` and `lib/hotel-booking-links.ts`) returns null
  and the existing fail-closed behaviour applies: no Trip.com button, and route pages show the Google Flights search, which says
  JetStash earns no commission from it. **Off by default: merging this changes nothing on Production.** It is turned on by setting the
  variable in Vercel and redeploying, and off by removing it and redeploying.
- **Evidence (build scan of 475 rendered files):** an unpaused build has the affiliate ID in 179 files and Trip.com links in 90; a
  paused build has 0 and 0, and its browser bundles contain no affiliate data. Tests cover every route, airport pair and hotel.
- **Not done / remains:** the URL tables stay in the code as dormant data. Plain-text mentions of Trip.com remain in the affiliate
  disclosure, the privacy policy and hotel-evidence provenance text. Pausing does not reverse any acceptance the agreement may imply,
  and nothing here records the agreement as terminated, accepted or resolved. The monthly Google-call guard and the Arrive By rate
  limiter are untouched.

## Priority route review — 3 November 2026 (prepared for PR; not merged or deployed)

Fresh primary evidence renews Manchester–Lahore, Manchester–Islamabad and Heathrow–Jeddah through
3 December 2026 (30-day RECENT / CHANGING cadence; fails closed from 4 December). Manchester Airport's
26 October announcement confirms Lahore weekly on Wednesday and Islamabad four times weekly on
Monday/Tuesday/Thursday/Saturday. Heathrow's live SV120 record confirms Saudia departed for Jeddah
today. Unreconfirmed numeric Islamabad/Jeddah durations are removed; Lahore's approximate 8h is
supported by its current airport guide. Existing fare and route-status ledgers are unchanged.
Evidence and limitations: [priority route review](route-evidence/priority-route-review-2026-11-03.md).
The earlier expiry projections below remain historical snapshots before this review.

## Arrive By public launch — 3 November 2026 (PR for review; not merged, not deployed)

CEO directive "Arrive By must ship", on `feat/arrive-by-public-launch-2026-11` from `d961001`. Arrive By has been live as a
hidden beta since PR #293; this makes it a public feature without changing a calculation, guard or budget.
- **Includes PR #342** (replayed onto current main): the Doha-only public beta (evidence review 29 December 2026, fails closed
  after it), route-page "Plan with Arrive By" only while the route presents as Direct or Connecting, generated coverage copy, and
  "Arrive By" in the desktop and mobile navigation. #342 itself is superseded by this PR.
- **Findable:** `/arrive-by` is indexable and self-canonical, listed once in the sitemap, and linked from the footer. The in-page
  "Beta" label and the no-guarantee, no-flight-tracking wording stay.
- **Google Maps attribution:** Arrive By shows Google place names, addresses and journey times without a map, which Google's
  attribution rules do not allow without attribution. The text "Google Maps" now sits inside every bordered panel that shows Google
  content in the four public views:
  - **Planner:** the result card, the place-choice box, and the ready-by and missed-service panels.
  - **Manchester:** the answer card, the missed-service card, and the driving, itinerary and place-check panels.
  - **Road and Pakistan:** the result card and the place-check boxes.
  - **Implementation:** `components/arrive-by-google-attribution.tsx`, with colour token `google-attribution` (#5E5E5E, one of the colours Google permits).
  - **Tests:** each panel is rendered or isolated separately.
- **Honest counting:** a pause that only asks the traveller to confirm or choose a place is now `needs_confirmation:*`, not a
  `cannot_confirm` failure. The old counter could not tell the two apart, so October's 13 of 18 `ARRIVAL_DESTINATION_UNCONFIRMED`
  outcomes may be largely this normal step; from launch the counters separate them.
- **Coverage today:** the planner accepts 15 UK departure airports and arrivals at Islamabad, Karachi, Lahore, Doha and Manchester.
  Route pages offering it: 10 on 3 November, 8 on 5 November and 6 on 17 November. They follow route reviews: Heathrow–Doha and
  Heathrow–Lahore lapse 4 November, Manchester–Lahore 12 November, Manchester–Islamabad 16 November.
- **Not changed:** calculations, the 10-call, 2,000-a-month and 5-per-minute guards, airports beyond Doha, analytics vendors, the
  privacy notice (PR #296 already covers the full journey).

## Fare evidence expiry — 3 November 2026 (DONE: tests-only PR #355 and fare recovery PR #356 merged and live)

- **PR #355:** merge commit `036b013b8ac0c6cec45f0e5e718c0e335dca74cd`, merged 12:35:09 UTC on 3 November 2026.
- **PR #356:** merge commit `d9610012704ba3526b2b04a4d75f8a9197834339`, merged 12:38:55 UTC; Production deployment succeeded
  12:40:13 UTC; post-merge quality check passed.
- **Verified on jetstash.co.uk:**
  - 25 routes have a current fare (`/tracked-fares` lists 25 priced route guides), dated 3 November;
  - the homepage example shows Manchester–Islamabad's £906;
  - Glasgow, Edinburgh, Newcastle and Sylhet say "JetStash has checked fares … before", and no checked page says "haven't logged".

On 3 November 2026 (UTC date), routes with a current Fare Signal fell from **62 of 89 to 1 of 89**. Every published
fare except Birmingham–Islamabad's (£1,098, departing 11 December) departs on 17 November 2026, and the 15-day departure guard
(`lib/freshness-thresholds.ts`, 14 days plus a 1-day margin, 17 October 2026) correctly stopped promoting them on the same day.
No deploy caused it; pages switch as they regenerate (six-hour ISR), and the PR #354 deploy at 00:06 UTC rebuilt them all. The
13 October and 20 October sweeps were collected but never ingested, so nothing replaced them.
- **Live effect (checked after the PR #354 deploy):** the only current price left is Birmingham–Islamabad's £1,098 (its route
  page, `/tracked-fares`, the Birmingham airport page and the Islamabad destination page). The homepage and `/deals` show no
  price; every other route says "no current fare" above its dated fare history; the homepage example card shows Manchester →
  Islamabad's service check without a fare. `/tracked-fares` now links to 1 route guide. The Glasgow, Edinburgh and Newcastle
  airport pages say "We haven't logged a tracked fare … yet", which is false: fares were logged; none is current.
- **CI:** 22 tests read today's date while asserting that specific routes have a current fare, so the quality check on `main`
  (`4a51ac2`) failed from 3 November and would have failed every PR.
- **Tests-only repair (branch `test/deterministic-fare-evaluation-date-2026-11`):** those suites now evaluate the data on
  2 November 2026 (`tests/fare-evidence-clock.ts`), the last day the 17 November evidence was eligible.
  `tests/fare-departure-expiry-2026-11.test.ts` keeps the guard honest: it checks that the rule is still 14 + 1 days and that the
  17 November evidence stops on 3 November. It also checks that, on 3 Nov, 10 Nov and 1 Dec, no Fare Signal, deal-card range or
  homepage example promotes a fare departing within 15 days. Disabling the guard makes 10 of its 14 tests fail. No production
  code, fare logic or observation changed.
- **Fare recovery (branch `data/fare-recovery-sweep-2026-11-03`, based on the tests-only branch):**
  - **Sweep:** 42 routes searched on 3 November for 29 December 2026 to 12 January 2027: the 15 commercial-priority routes, then
    the 27 whose route status stays publishable into December. 24 clean round trips were appended, each with both legs read and every
    booking option checked. 11 routes were held (no airline offer, a single-agent outlier more than 10% below the next offer, or not a
    useful example) and 7 gave no usable result.
  - **Rules and evidence:** `fare-evidence/weekly-sweep-2026-11-03.md`. The window is peak season, so each record has its own
    `…-christmas-new-year-2026-v1` profile and Fare Watcher never measures it against autumn fares.
  - **Coverage:** 25 routes have a current fare on 3 November, 22 on 17 November, 14 on 3 December and 8 on 14 December. All 24 leave
    the site on 15 December (the 29 December departure's guard date) unless later sweeps are published.
  - **Route reviews lapse sooner on many routes:** MAN–ISB's fare shows only until 16 November, MAN–LHE's until 12 November and
    LHR–JED's until 4 November.
- **No-fare wording:** airport, destination and region-hub pages whose routes have logged checks now say "JetStash has checked fares
  for {place} before, but there isn't a current one we can safely show." So do route guides without a curated Deal, which had shown
  "We haven't logged a tracked fare … yet" directly below their own "Earlier checks are in the fare history below" (found on the
  Birmingham–Jeddah Preview). This replaces the false "haven't logged" line, which also appeared on the Sylhet destination page. A
  test that pinned the false Sylhet wording was corrected.
- **Safeguard:** `FARE_COLLECTION_CHECKLIST.md` "Publish or decline within the week". A sweep must be published or explicitly declined
  within 7 days, and the live set's expiry and lapsing route reviews are checked before a sweep is closed.
- **Still open:**
  - an automated early warning before coverage drops (next PR);
  - route re-verification for lapsing priority routes (separate CEO decision);
  - the 47 unswept routes, whose route reviews have lapsed or lapse within days.
  - PR #353 stays on hold until coverage is restored and verified.

## Consent panel clearance — 2 November 2026 (DONE, live via PR #354)

Merge commit `4a51ac28e226b98f2ce448e753c237f5d71f6a3a`, merged 00:04:51 GMT on 3 November 2026. The Production deployment
succeeded at 00:06:11 UTC. Verified on jetstash.co.uk at 320, 375, 390 and 1440: 0 px of a focused control hidden, no footer item
stuck, the reserved space clears after Reject all, Accept all and Cookie settings Close, and no optional script or stored choice
before consent. The CEO accepted the 14 px first-screen overlap at 375x812 and kept the wording unchanged (3 November 2026).

On `fix/consent-banner-mobile-footprint-2026-11` from `2394a18` (CEO priority, ahead of homepage PR #353). Measured on Production
on first visits: at 320x568, pressing Tab to "Flying from" left the focused control fully underneath the fixed consent panel (WCAG
2.2 2.4.11), the submit button was 17 px hidden at 320 and 14 px at 375x812, and at every size the last footer items could never
scroll clear of the panel. Touch visitors could already scroll the journey finder clear and use it without choosing.
- **Fix:** while the panel is on screen it publishes its height as `--consent-banner-h`; `globals.css` uses it for
  `scroll-padding-bottom` and the body's bottom padding. After the fix: 0 px hidden on focus at 320, 375, 390 and 1440, no footer
  item stuck under the panel, and the variable is removed after Reject all, Accept all or closing Cookie settings.
- **Unchanged:** panel wording, layout, Reject all / Accept all styling, consent storage and script gating.
- **Still open:** on the first screen at 375x812 the panel still covers the bottom 14 px of the submit button. Clearing it needs
  shorter first-layer wording (a privacy-wording decision) or smaller tap targets (rejected).
- **SEO pilot event:** layout only, logged in `SEO_INDEXING_PILOT_2026-10-21.md`.

## Atlas service-ended card wording — 24 October 2026 (PR for review; not merged, not deployed)

On `fix/mumbai-card-wording-2026-10-24` from `287fb42`, the one approved exception to the homepage text freeze (CEO ruling,
24 Oct): the Manchester–Mumbai (and, identically, Manchester–Delhi) Atlas card showed internal verification terminology.
- **Source:** `lib/atlas-network-data.ts` printed the Route Status ledger event's `explanation` (the audit narrative: booking-engine
  searches, "Sold Out", OAG/GDS filings, codeshare detail, what is not inferred) twice per card, as the "Route intelligence" detail
  and again inside the Active service notice. About 1,300 px tall at 390 px.
- **Fix:** the card now states the same facts in plain English from structured fields only: verdict "Direct service ended — check
  current options directly with the airline.", "Direct service ended 31 August 2026", "IndiGo's direct service has ended, effective
  31 August 2026.", "Checked against IndiGo, AeroRoutes and Manchester Airport, most recently on 2 September 2026." and "Connecting
  journeys may still be available. Check the airline, the stops and the total journey time before you book." The ledger records
  and the route page's own evidence panel are untouched; the withdrawal-announced branch is unchanged.
- **SEO pilot event:** visible homepage text change (Atlas card, Mumbai and Delhi only), logged in `SEO_INDEXING_PILOT_2026-10-21.md`.

## Atlas answer-card visibility fix — 23 October 2026 (DONE, live via PR #349)

Merged as `287fb42f759cdad5b7a66e555e2d07ce2399cd0f` at 00:37:16 BST on 24 October 2026 (23:37:16 UTC on 23 October); Production
verified in touch emulation. The founder's real-phone acceptance check passed (24 Oct).

Original entry:

On `fix/atlas-answer-visibility-2026-10-23` from `8765251`, after the founder's real-phone test of PR #348 found that tapping a
destination did not visibly show its route card.
- **Reproduced (live Production, touch emulation at 320 px):** the mobile answer card sits above the map and starts hidden.
  Tapping a destination dot on the map (the visitor is scrolled down at the map) revealed the card above the viewport
  (`top -1684, bottom 39`) while the page stayed on the map, so the card looked missing. At 390 px scroll anchoring happened
  to keep it in view; iOS Safari has no scroll anchoring, so real iPhones behave like the 320 px case.
- **Fix:** after a deliberate selection (press, tap, or Enter/Space on a chip or map control; never hover or plain focus) and
  below lg, the card is scrolled into view: map taps align it just under the sticky header (`scroll-mt-24`), chip taps
  scroll the minimum needed. A country tap now shows "Tap a destination in {country} to see its route." while the card is
  hidden. lg+ never scrolls and never hides the card. Map panning, selection handlers and analytics are unchanged.
- **Verified in touch emulation** at 320, 390 and 768 px: seven country/destination chip switches, two map-dot taps in a row,
  keyboard Enter on a chip, no scroll on map hover at 1440 and 600 px, no sideways drift. Not tested on a real iPhone.
- **Noticed, not changed:** the Manchester–Mumbai answer card is about 1,300–1,700 px tall on a phone because its route
  verdict detail carries a long internal verification paragraph; it is a content question, not part of this fix.
- **SEO pilot event:** one new mobile/tablet sentence in the homepage HTML; logged in `SEO_INDEXING_PILOT_2026-10-21.md`.

## Homepage correction sprint — 23 October 2026 (DONE, live via PR #348)

Merged as `8765251324fca1858104ebeb3d0ff6fc750e9626` at 14:53:49 BST on 23 October 2026 (13:53:49 UTC); Production verified in
touch emulation. Real-phone check failed on answer-card visibility (see the fix above).

On `fix/homepage-correction-2026-10-23` from `29e9d81`, from the founder-approved full homepage review.
- **Mobile Route Atlas fixed at its cause.** Since 11 Sep (commit `1c0c4c2`) the mobile chip rows were direct grid children
  with no width constraint, so the single grid column grew to 1262 px inside the overflow-hidden section: the map strip had
  nothing to scroll, the map and answer card were clipped, and tapping a chip drifted the section sideways. The grid column
  is now `minmax(0,1fr)` with `min-w-0` on its items (desktop two-column template unchanged), and selecting a country,
  destination or airport pans the map strip to centre the selection when a chip is tapped (`lib/atlas-map-pan.ts`; reduced
  motion jumps instead; map hover never pans). The country and destination chips now also show at tablet widths
  (640–1023 px), where the fitted map's touch targets are only a few pixels wide; desktop (1024 px and up) is unchanged.
  Verified in touch emulation at 320, 375, 390, 430, 640, 768, 820 and 1023 px; a real-phone acceptance check is left to
  the founder.
- **Route Watch invitation:** the homepage button linked to Manchester–Mumbai (direct service ended). It now names a current
  route chosen by `getHomepageWatchRoute` (today "Watch Manchester → Islamabad", linking to its existing `#route-watch`
  form) or, if none qualifies, says "Choose a route to watch" and links to `/routes`. No new Route Watch feature.
- **Closing band:** "One clear Journey Brief" (a founder-only prototype) replaced with "Route status, fares and travel
  requirements, each checked and dated."
- **Intentionally unchanged:** hero, evidence card, desktop Atlas and its animations, fares, Trip.com links, email and privacy
  systems, analytics events, SEO pilot settings, PR #342. Deferred by the CEO: hero photography, grid polish.
- **SEO pilot event** logged in `SEO_INDEXING_PILOT_2026-10-21.md`.

## Stage 2: first-screen and fare experience — 23 October 2026 (DONE, live via PR #347)

Merged as `29e9d81078c708d3e5fa1bfc77f13d6820e0029e` at 02:13:43 BST on 23 October 2026; Production verified.

On `feat/stage2-first-screen-2026-10-23` from `3badd5e`, from the founder-approved Stage 2 design benchmark (items 1–3).
- **Homepage:** the journey form no longer silently selects Manchester → Agadir (both selects start on "Choose airport" /
  "Choose destination", an incomplete submit asks for the missing choice instead of navigating). A compact evidence card
  (`lib/homepage-evidence.ts`, `components/homepage-v2/homepage-evidence-card.tsx`) shows one example check for
  Manchester → Islamabad: the last tracked fare with airline, checked date, travel dates, routing and the "Connecting fare,
  not nonstop" cue, labelled "a dated observation, not today's price". It is shown only while the fare is current, fresh,
  checked within 30 days and still departs with the 15-day promotion margin (to 2 Nov 2026); then it falls back to the
  verified route finding with its verification date (3–16 Nov); then it disappears (the route's verification lapses 17 Nov).
  It links only to a page the homepage already linked to, so the SEO pilot's link set is unchanged.
- **/deals:** the hero is two sentences and a "How we track fares" link; the coverage/curation detail moved to one note above
  the cards. Stats are unchanged. The first card sits about 180 px (desktop) and 235 px (mobile) higher.
- **Deal cards:** the price is followed by one "Fare checked with {airline} · {date}" line, then the connecting-fare cue and
  route explanation, travel dates and the (quieter) fare-details note. Nothing was removed; the "One check, {date}" line
  that repeated the date was dropped.
- **Where the card change shows:** the shared deal card is also embedded on route, destination, airport and hub pages,
  where only the order and a few words of the fare line change (logged as an SEO pilot event).
- **Intentionally unchanged:** fares, observations, booking URLs and Trip.com parameters, route verification, email and
  contact routes, Brevo/Resend, analytics events, SEO pilot settings, PR #342, the route-page fare card.
- **SEO pilot event** logged in `SEO_INDEXING_PILOT_2026-10-21.md`.

## First-impression improvement sprint 1 — 22 October 2026 (DONE, live via PR #346)

Merged as `3badd5edb6ee26e2fd7668542df45e374a1c6eeb` at 00:18:37 BST on 23 October 2026 (23:18:37 UTC on 22 October);
Production verified on that commit.

On `fix/cx-sprint1-2026-10-22` from `53dc903`, from the founder-approved 22 October first-impression review.
- **India hub contradiction:** `/india` said Air India "currently runs direct services from Birmingham and Gatwick to
  Amritsar" while Gatwick–Amritsar showed verification pending. The Amritsar note (and a new Pakistan direct-routes
  note) are now derived from canonical route verification (`lib/hub-service-notes.ts`), so they cannot disagree with the
  route cards. The hand-written Ahmedabad conflict sentence was removed.
- **Fare type beside the price:** where the route's verified service is nonstop but the featured fare connects, route
  pages and deal cards show "Connecting fare, not nonstop" under the price and say plainly "Nonstop flights are listed
  for this route, but this tracked fare is a connecting journey, so its price is not a nonstop price". The explanation
  now sits ahead of the lower self-transfer offer and the booking button. The "Airline: verification pending · Route:
  Direct" jargon is gone from the connecting-fare note; no-fare cards deliberately keep that airline-versus-route label
  (earlier approved rule TR-010) and it is flagged as a clarity follow-up. Fares, affiliate links and Trip.com
  parameters are unchanged.
- **Internal wording removed** from every route record, plus a regression test over routes, destinations, airport
  notes, traveller tips and guides (banned: "this session", "evidence check", "primary evidence", "destination
  evidence", dangling "see note", "service shape").
- **Keyboard focus and hover contrast:** the single brass focus ring (about 2.7:1 on white) is now two-tone (ink on light
  surfaces, light brass inside dark sections), including the quote-form radios and the Arrive By light-surface controls
  that had their own brass outline; ink buttons hover to `brass-700` (sand text 5.9:1) instead of `brass-600` (3.9:1).
  Design docs updated. Brass outlines on dark-surface controls are unchanged.
- **Unsupported generalisations replaced** with neutral copy: "Most trips here are family visits", the Pakistan "same
  depth of coverage" line and its "often a lower fare" / "cheaper for Karachi" notes, Gulf "peak price" / "Ramadan rarely
  affects flight pricing" notes, Umrah Ramadan price and 3–4-month claims (page and guide), India "generally lower-pressure
  time to book". The Pakistan hub visa note now mirrors the canonical Travel Ready rule (visa needed unless a valid NICOP,
  SNICOP or POC; expired cards are treated differently) and drops the "within 7 days" processing claim.
- **Contact addresses (read-only, not changed):** see the PR description for the decision the founder needs to make.
- **SEO pilot events** are logged in `SEO_INDEXING_PILOT_2026-10-21.md`.

## Phase 2: Birmingham–Amritsar re-verification and Manchester–Dhaka clarity — 22 October 2026 (DONE, live via PR #345)

Merged as `53dc903` and Production verified on 22 October 2026.

Backlog recovery sprint, Phase 2, on `fix/phase2-bhx-atq-man-dac-2026-10-22` from `24503ab`.
- **Birmingham–Amritsar re-verified (due 30 Oct).** Air India's own route-page schedule for
  22–28 October 2026 shows nonstop AI118 BHX→ATQ at 10h 35m and AI117 back at 12h 35m on the
  winter schedule from 25 October, and 11h 40m back before it; Birmingham Airport's current
  Amritsar page names Air India as the direct airline. Founder review noted an independent
  timetable listing AI118 nonstop on Friday 23 October at about 10h 10m (pre-winter, matching
  Air India's own 30 September record), so public copy reads "Nonstop: about 10h 35m out and
  12h 35m back on Air India's winter schedule from 25 October 2026 (about 10h 10m and 11h 40m
  before then)" and states no weekly count or weekday pattern. RECENT / CHANGING, verified
  22 October, review due 21 November 2026. Evidence and SHA-256 kept outside the repo in
  `C:\Users\faiz2\jetstash-route-reverification-2026-10-22\bhx-atq\`.
- **SEO pilot:** the Birmingham–Delhi fare-card line below is founder-approved (option (a)) and
  logged as a known event in `SEO_INDEXING_PILOT_2026-10-21.md`.
- **Amritsar destination page:** said the direct service was from London Gatwick (verification
  lapsed 17 Oct) and that Birmingham meant a connecting journey. Now names Birmingham with Air
  India on selected days.
- **Manchester–Dhaka:** the flight-time value now answers the label first ("Not confirmed; one stop
  via Sylhet…"). When a tracked fare records no structured connection airports, routes with
  evidenced `routeServiceConnections` now compare the fare's recorded airline with the route's
  verified airlines (`components/route/fare-signal.tsx`). Airline text cannot prove a different
  service, so the line is hedged: "This tracked fare is on Emirates and flydubai and may be a
  different connecting journey from this route's own service. Check the airlines and stops before
  booking." Silent for the route's own airline, empty or abbreviated names. **This also adds the
  same line to Birmingham–Delhi (SEO pilot page, Lufthansa fare).**
- Two existing tests updated to the new Birmingham–Amritsar wording; one pinned to the review date
  instead of the live clock. New `tests/phase2-bhx-atq-man-dac-2026-10-22.test.ts`.

## Route trust corrections — 22 October 2026 (DONE, live via PR #344)

Merged as `24503ab` and Production verified on 22 October 2026 (Vercel Production Ready; live
Manchester–Rome, Heathrow–Dhaka and Manchester–Dhaka pages checked).

Backlog recovery sprint, Phase 1, on `fix/route-trust-corrections-2026-10-22` from `e4c3e84`.
- **Contradictory hero status:** London Heathrow–Dhaka and Manchester–Rome (`unspecified`) showed a
  "Service confirmed" badge above "Current service is not yet independently confirmed". The hero
  sentence is now `presentation.statusHeadline`, authored beside `statusLabel` in `data/routes.ts`,
  so badge and sentence cannot disagree. `unspecified` now reads "Service confirmed · stop pattern
  and schedule not established". A service-ended route only promises connecting flights when its
  record carries `connectingAlternative` (both live service-ended routes do; no visible change).
- **Manchester–Dhaka:** verification expired 2 October 2026, but the page still cited Biman's
  "current official notice" and an "every Tuesday and Saturday" schedule. Wording now dates both
  claims to the 18 August 2026 check and says the current schedule is not re-confirmed. Verification
  dates are unchanged; no new evidence was claimed.
- Regression tests: `tests/route-trust-corrections-2026-10-22.test.ts`; one Bangladesh test updated
  to the dated wording.

## Manchester–Doha truth correction and Heathrow–Doha evidence gap — 21 October 2026 (local only)

Founder-approved route-data correction on `data/man-doh-truth-correction-2026-10-21`, from `56f90da`.
- **Manchester–Doha:** Manchester Airport's own Qatar Airways page states "Qatar Airways flies direct to Doha".
  Qatar Airways' own route page now says only that it "operates flights" and gives no duration or
  frequency. The unsupported "Under 7h" flight time, "regular"/"high frequency" wording, the comparison
  with South Asia routes and the route-specific school-holiday premium and peak-demand periods are removed;
  direct service is kept. STABLE, 90 days, review due 19 January 2027.
- **Heathrow–Doha (unresolved, record unchanged):** Qatar Airways' London page no longer states direct
  service or the "just under seven hours" its 4 October record cites, and no Heathrow or Qatar timetable
  source was found. Per the cadence policy it is not re-dated: it lapses after 3 November 2026 and the
  route page falls back to Verification pending until fresh official evidence is found.
- **Evidence:** kept outside the repository in `C:\Users\faiz2\jetstash-route-reverification-2026-10-21\doha\`.
- **Unchanged:** fares, affiliate links, other route records and Arrive By's airport release configuration.

## SEO indexing pilot — 21 October 2026 (PR for review; not merged, not deployed)

Founder-approved 28-day experiment on `seo/indexing-pilot-2026-10-21`, based on `eaa4f48` (main after PR #340). It is the narrow exception recorded in DECISIONS.md; SEO otherwise stays in maintenance mode.
- **Why:** Google has indexed only 27 of 89 route pages, and 99 URLs show "Discovered – currently not indexed" with no crawl. There is no technical blocker. The homepage exposed one server-rendered route link.
- **Change:**
  - Gated, server-rendered route-guide links on the homepage and three pilot pages.
  - "Quick answers" on Manchester–Islamabad, Manchester–Dubai and Birmingham–Delhi. They state only what each route's cited source supports, and each set is bound to its verification check.
  - The first Codex review on 21 Oct returned FAIL with no P0/P1; its P2/P3 findings are fixed. The Codex re-review returned PASS; its two P3 wording points are also fixed.
  - Manchester–Dubai's answers now render, because the 21 Oct check they are bound to landed in PR #340.
- **Unchanged:** fares, affiliate links, route verification, titles (including the Lahore/Mumbai experiment) and the sitemap.
- **Measurement:** the 28-day window starts only at an approved Production deployment.
- **Risk:** Manchester–Islamabad's review falls due on 16 Nov, inside the window. Its winter operating-day check is due on or after 27 Oct.
- **Details:** baseline, targets, checkpoints and that risk are in [the pilot record](SEO_INDEXING_PILOT_2026-10-21.md).

## Manchester–Dubai re-verification — 21 October 2026 (DONE, live via PR #340)

Founder-approved route-data correction, merged as PR #340 (`eaa4f48`) and verified in Production on 21 October 2026. It is separate from the SEO indexing pilot, and that pilot's Manchester–Dubai Quick answers depend on it.
- **Source check:** Emirates' own route page, fetched 21 October 2026, still states 21 flights per week. It lists three A380 nonstops a day each way, at 7h05m–7h50m to Dubai and 7h45m–8h10m back.
- **Correction:** the outdated "8h direct" flight time becomes "About 7–8h direct to Dubai; up to 8h 10m back".
- **Review cadence:** STABLE, 90 days, so the next review is due 19 January 2027.
- **Unchanged:** no fare, affiliate link or other route is changed.
- **Evidence:** kept outside the repository in `C:\Users\faiz2\jetstash-route-reverification-2026-10-21\`.

## Fare-range travel-period correction — 20 October 2026 (local only, awaiting independent review)

Founder-approved implementation on `codex/fare-range-travel-window`, based on `e744cff`.
Deal-card ranges now use one exact departure/return pair, selected from the newest eligible
check after the existing clean-ticket preference. Cards name that travel period separately
from check dates and qualify differences in baggage and fare conditions. No observation
was ingested or edited; the proposed Manchester–Dubai Emirates fare remains outside this task.
The fixed-date comparison covers all 89 routes and three cabins: 17 summaries narrow to one
period, including six curated flight cards; all 201 previously hidden summaries remain hidden.
Publication eligibility, Fare Signals, route verification and affiliate behaviour are unchanged.
See [the review record](FARE_RANGE_TRAVEL_PERIOD_REVIEW_2026-10-20.md) for the complete impact,
validation evidence and independent-review instructions. This is not a Production release.

## Gatwick→Istanbul airport-integrity correction — 19 October 2026 (local branch, not merged)

- **Branch:** founder-approved local fix on `fix/lgw-ist-airport-integrity` from `f829244`.
- **Exclusion:** the £162 Pegasus Sabiha Gökçen observation (`obs-lgw-ist-economy-20260818-8w-v1`) is now methodology-excluded; it stays in the archive unchanged.
- **Automatic check:** `lib/fare-airport-pair.ts` reads airport codes only from allowlisted Google Flights and KAYAK URLs. Any contradicting airport, on either leg, blocks an observation on every route. Gatwick→Istanbul additionally needs the selected outbound and return flights to use LGW and IST; search-only, one-way, city-level or malformed evidence fails closed. Ingestion applies the same rule. It is not system-wide: most archived URLs carry no readable airports, and the Manchester–Mumbai Journey Brief fallback and Fare Watcher internal leads do not run it.
- **Public effect:** none. Gatwick→Istanbul stays verification-pending with no published fare, and no other route's page changes. See ROUTE_COVERAGE_AUDIT.md's 19 October airport-integrity addendum.

## B1 Batch 2 route-record corrections — 19 October 2026 (local branch, not merged)

B1 Batch 2 re-checked the 22 expired routes: 15 pass, 1 fails and 6 are inconclusive, based on current October 2026 operation. The official SunExpress winter 2026/27 timetable was used to separate winter from summer-only service.
- **Branch:** founder-approved local corrections on `fix/b1-batch2-route-corrections`.
- **Birmingham→Ahmedabad:** the direct model is removed; the route stays fail-closed.
- **SunExpress Turkey wording:** dated seasonal wording. Manchester→Antalya has Thursday/Sunday winter service. Dalaman and Izmir are summer-only. Bodrum no longer names SunExpress as a current operator.
- **Operator lists:** corrected, and new operators are not displayed as verified.
- **Sylhet:** outdated "not served" wording is replaced.
- **Kept unresolved:** the Gatwick→Ahmedabad conflict, Gatwick→Amritsar's reported 25 October cancellation, and the Gatwick→Istanbul IST/SAW identity question.
- **No record re-dated and no fare published:** re-dating would republish fares whose return legs are unverified, so all 22 routes stay pending until fare verification. See ROUTE_COVERAGE_AUDIT.md's 19 October 2026 Batch 2 addendum.

## B1 route-claim corrections — 19 October 2026 (merged in PR #335, live in Production)

B1 route re-verification of the 15 routes with overdue route reviews found two failures and six
inconclusive results (evidence kept outside the repository in
`C:\Users\faiz2\jetstash-fare-sweep-2026-10-20\`). Founder-approved corrections from branch
`fix/b1-batch1-route-claim-corrections`, merged in PR #335 and verified in Production at
`eba18bff6be4960c61b5982ed23f5cb7a205cae7`: Manchester→Jeddah moved to verification-pending
(possible Saudia nonstop not airline-confirmed; unsourced Doha/10h/daily claims removed);
IndiGo removed from Manchester→Amritsar; the unsourced Manchester→Ahmedabad "majority of bookings"
statistic removed; unsupported operators, hubs, durations and frequencies hedged on the Madinah,
Amritsar and Ahmedabad routes; the structured Istanbul routing removed from Birmingham→Lahore and
Birmingham→Islamabad. Only Birmingham→Mumbai and Birmingham→Delhi were re-dated. No fare was
verified. Codex review follow-ups: Leeds Bradford→Islamabad's unsourced "cheaper and faster via
Manchester" claim replaced with neutral compare-the-whole-journey advice, and the homepage atlas and
destination-page route labels now share one verification-evidence rule (verified only while the
route-level record is current; lapsed records say "last confirmed <date>"; pending and ended
direct services never read as verified or operating). See ROUTE_COVERAGE_AUDIT.md's 19 October
2026 addendum.

## Rolling weekly fare-sweep window — 19 October 2026 (local branch, not merged)

- **Finding:** the 6 and 13 October sweeps searched every one of the 89 routes for 17 November–1
  December 2026, because both reused one saved set of Google Flights URLs with frozen dates.
- **Fix (collection tooling only):**
  - `lib/fare-sweep-dates.ts` computes the FARE-METHOD-001 window: sweep + 56 days, then 14 nights.
  - `scripts/fare-sweep/sweep-routes.json` holds the 89-route configuration in the repository.
  - `scripts/fare-sweep/generate-sweep-urls.mjs` produces dated URLs, plus a Christmas/New Year
    peak-season flag taken from `data/peak-period-dates.ts`.
  - Procedure: `FARE_COLLECTION_CHECKLIST.md` §2.
- **Next sweep:** 20 October 2026 sweeps 15–29 December 2026, which is peak season.
- **Unchanged:** fare observations, route verification, public copy, affiliate links and site
  behaviour.
- **Separate:** this does not fix the 3 November MAN→ISB fare expiry. Fresh fares must still be
  collected, validated and ingested before then.

## MAN→ISB re-verification and promoted-fare guards — 17 October 2026 (local branch, not merged)

Manchester→Islamabad's route verification lapsed on 12 October and the route correctly failed
closed (no fares, schedule or Book-By; title "Verification in Progress"). Restoring it alone would
have brought back misleading prices: a £480 headline checked 25 August for a 20 October departure,
and a £428 deal-card minimum that was an unwarned three-stop self-transfer. Founder-approved
correction on branch `fix/man-isb-reverify-fare-guards`:

- MAN→ISB re-verified 17 October against Manchester Airport's own PIA operator page (review due
  16 November, 30-day RECENT/CHANGING); duration softened to "About 7½ hours direct"; the
  unsupported "fewer weekly frequencies than Lahore" Book-By line removed.
- Site-wide: no fare departing within 14 UK days is promoted (headline, secondary, Standout,
  Book-By, deal-card ranges), with a one-day safety margin for UTC/UK midnight and ISR caching.
- Site-wide: a self-transfer check no longer sets a clean deal-card minimum, and the note beside a
  price describes that same check. On 17 October this changed 70 ranges across 66 of 89 routes;
  43 of the previous minimums were unwarned self-transfers and 33 departed inside the guard.

MAN→ISB now headlines £521 Etihad (6 October check, 17 November–1 December) with £449 as the
labelled self-transfer secondary. Its newest checks depart 17 November, so they last qualify on
2 November (UTC render date) and the headline correctly disappears from 3 November unless newer
fare evidence (`FARE-001`) is added first. The £682 Gulf Air
December check stays held. See `JETSTASH_PRINCIPLES.md` §14.4.

## Arrive By: live limited beta and feature freeze, 3 October 2026

**Arrive By full-journey V1 is LIVE in Production as a limited beta.** This supersedes the older
Stage 1/Stage 2 "private, founder-only preview" entry further below, which is kept as dated history.

- **Surfaces:** public landing page and planner at `/arrive-by` (deliberately `noindex, follow`, absent
  from `app/sitemap.ts`, and not in the main nav, mobile nav or footer); a "Try Arrive By" entry point on
  the homepage; "Plan with Arrive By" on the supported route pages (Manchester to Islamabad, Lahore and
  Karachi). Legacy `/arrive-by/manchester` and `/arrive-by/pakistan` redirect to the unified shell.
- **Engines:** Manchester (MAN) is `TRANSIT_FIRST` (first-important-service logic, missed-service
  scenario, conditional driving rescue). Islamabad, Lahore and Karachi (ISB / LHE / KHI) are
  `ROAD_PICKUP_FIRST`. Unsupported airports fail closed; no global transit is invented.
- **Guards:** at most 10 billable Google calls per journey, a 2,000-call monthly budget (alerts at 50% and
  80%, hard stop at 100%), a shared 5-per-60-seconds limiter, durable Upstash/Redis backing, fail closed if
  durable storage is unavailable.
- **PR record:** #293 launched the production implementation; #290 was an obsolete prototype and is closed
  as superseded by #293; #294 added anonymous aggregate beta outcome counters (Production-only, fixed metric
  and reason names, about three months' retention, no journey data); #295 added the standalone landing page
  and discoverability; #296 updated the Arrive By privacy wording and the advance Google notice.
- **Not claimed:** no external-user validation yet (evidence so far is engineering plus synthetic
  validation); no live flight tracking, PNR lookup, airline integration, terminal or queue prediction, and
  no guarantee wording.
- **FROZEN for feature work.** No further Arrive By engineering unless real beta evidence identifies a defect
  or a clearly validated opportunity. Open verification: the #294 Production counter read in the Upstash
  console, which needs a founder login.

## Astra programme closure and current operating state — 14 September 2026

**The full Astra founder-review programme (#1–#20) is CLOSED.** Every workstream from
Consequential Information/Truth Reset through the final CEO/Business Model/Moat/Future/Kill List
review has been audited and classified. **Do not describe any Astra workstream as still open, and do
not reopen one merely because execution of its own recommendations continues** — founder actions
like distribution outreach and Trip.com dashboard reconciliation are execution of an already-closed
review, not evidence of unfinished audit work. No further Astra-numbered review is scheduled.

**Company mode: CONTINUE / VALIDATION MODE.** JetStash is not in investment mode, feature-expansion
mode, or broad product-building mode. The final CEO review found the product technically and
editorially sound but commercially unproven — £0 confirmed revenue, 0 confirmed bookings, 0
confirmed commission — and concluded the correct next step is testing distribution, not building
further product.

**BUILD FREEZE ACTIVE.** Product/engineering work resumes only for one of these five triggers:

1. A P0/P1 safety or truth issue.
2. A real, measurable funnel blocker (not a hypothetical or aesthetic one).
3. The same specific need independently requested by multiple relevant travellers (not one person's
   opinion).
4. A confirmed booking that creates reconciliation/follow-up work.
5. An approved partner integration worth implementing (e.g. KAYAK, if and when its pending
   application is confirmed).

There is no "good idea" exemption. Everything not covered by one of the five triggers goes on the
parked list below, not into a new PR.

**The 90-day company goal is exactly one thing:** a genuine, non-seeded booking, reconciled to
commission. It is not pageviews, impressions, more routes, more features, first £100, or more
testers — see `DECISIONS.md` if a future session is tempted to substitute an easier-to-move metric
for this one.

**Active commercial focus: MAN→ISB only**, JetStash's core vertical entry point — the one route with
a fully evidenced, live funnel (direct PIA service, £870 Fare Signal, Book-By, Travel Ready,
Trip.com CTA, acquisition attribution, no live Journey Choice). Active commercial investment
(fresh fare checks, feature tuning) concentrates here; the wider ~88-route public portfolio stays
live for discovery/SEO but is **not** free to maintain — verifying and refreshing it still carries a
real founder-time cost, so effort beyond routine `COV-001`/`FARE-001` cadence goes to MAN→ISB first
unless new evidence justifies another route specifically.

**Parked / no active investment** (component/infrastructure preserved, not deleted, no PR against
these without a freeze-breaking trigger):
- Journey Choice — Round 1 closed/historical (`JOURNEY-CHOICE-ROUND1-001`); public pilot is OFF;
  infrastructure (frozen-observation-ID derivation) preserved. Person B's single Level-3 handoff is
  real and occurred through that live comparison, but is one non-generalisable data point — do not
  reopen automatically because the component still exists.
- Journey Brief — founder-only MAN→BOM pilot, technically ready for a controlled first-10 user gate,
  but parked: first-booking validation outranks running that gate right now.
- Umrah — stays publicly live; no active expansion investment.
- Business Class — stays publicly live/passive; no active investment; retains option value.
- Route Atlas expansion, broad fare-history expansion beyond MAN→ISB, route expansion, a
  newsletter/content programme, and new features generally.

**Micro-seed personal testing: CLOSED/EXHAUSTED.** Round 2 closed after Person E (Level 4) and
Person F (Level 4) — no additional Level-3 handoff, no safety defect, and the founder has no further
genuinely relevant personal contacts. Do not recruit random/irrelevant testers to continue this
channel.

**Distribution state (Astra #16, corrected):** qualified traffic is the primary bottleneck. Google
Ads stays HOLD (0.5% flight commission makes paid economics unproven and likely unattractive without
higher conversion or a higher-margin line). Generic Reddit promotion in its previous form is not to
be repeated. SEO stays in maintenance mode, not active investment. The most promising untested
channel is the "Pakistani Community Manchester" Facebook group — gated on the founder personally
verifying its rules/culture first, with a reactive, genuinely-useful answer to an existing
traveller's question preferred over a standalone promotional post; a standalone post only if the
group's own norms clearly support it. No mass posting, no random outreach.

**Measurement state:** PR #272 (acquisition attribution) is live — same-session channel
classification (`organic_search`/`google_ads`/`facebook`/`reddit`/`other_referral`/`direct`/
`unknown`) paired with the existing Trip.com handoff events. This measures channel → route visit →
high-intent action → partner handoff. It does **not** measure booking or commission — Trip.com
partner-dashboard reconciliation remains an external dependency; the last session found the
authenticated dashboard unavailable, which must not be read as zero clicks or new negative evidence.

**Parked commit `723216f46b508b00b41d11ef272d5a6a1892a54d`** (per-route `trip_sub1` attribution) stays
parked until actual Trip.com partner-reporting evidence changes — do not merge or modify it on
audit/documentation grounds alone.

**Do not touch — good enough, protect founder time:** MAN→ISB's live product state, the design
system, the mobile/accessibility work closed in Astra #17, the SEO architecture, the consent/privacy
architecture, the analytics/event system, the route-truth model, the fare-observation model, the
Journey Choice infrastructure, and the parked `723216f` commit.

**Next founder actions (execution, not further audit):** (1) obtain Trip.com partner-dashboard
access and check whether reporting has advanced past 12 September 2026; (2) when ready, verify the
Facebook group's rules and make one bounded, reactive-preferred contribution. Neither of these is a
Claude/Codex engineering task.

## Current operating snapshot — 27 August 2026

The following counts were derived from code at the release baseline above, using 27 August 2026 as
the freshness/status date. They are current operating truth, not copied forward from an older
project-control snapshot.

| Measure | Current state | Canonical derivation |
|---|---:|---|
| Public routes | 88 | `data/routes.ts` |
| Destinations | 27 | `data/destinations.ts` |
| Total append-only fare observations | 226 | `data/fare-observations.ts` |
| Methodology-complete observations | 202 | `isPubliclyPublishable()` — complete dates/currency and not methodology-excluded |
| Public-safe observations at the current route-evidence state | 195 | `getPublishableObservationsByRoute()` across all 88 routes |
| Routes with at least one public-safe observation | 83 | Distinct route slugs among those 195 observations |
| Current display-ready Fare Signals | 83 of 88 | `getFareSignalForRoute(...).state === 'current'` |
| Curated `Deal` records | 50 | `data/deals.ts`; a separate presentation catalogue, not fare coverage |
| Safe Trip.com flight handoffs | 63 of 88 | 45 route-level links + 18 exact airport-pair fallbacks |
| Fail-closed flight handoffs | 25 of 88 | No safe exact partner handoff; never a generic `LON` substitute |
| Hotel Intelligence destinations | 10 | Public allowlist in `lib/holiday-intelligence.ts` |
| Exact-property hotel handoffs | 29 | 29 public hotel examples, all mapped to a dashboard-generated property URL |
| Route Intelligence | 11 Strong / 77 Useful / 0 Expanding | `computeRouteIntelligenceLevel()` across the 88 routes |

The five routes without a current Fare Signal are the same five routes whose current route evidence
remains unresolved: Birmingham–Ahmedabad, Gatwick–Ahmedabad, Heathrow–Dhaka, Heathrow–Sylhet and
Manchester–Sylhet. Their archive records are preserved; public presentation remains fail-closed.

### Programme state

- **Journey Choice:** one-route Manchester–Islamabad public pilot, with impression/evidence/CTA
  measurement and a dated Trip.com handoff. Expansion remains frozen pending meaningful real
  traffic; no second route is approved.
- **Journey Brief Phase 1:** a founder-only Manchester–Mumbai pilot
  (`/founder/journey-brief/manchester-mumbai`, PR #233), gated behind `FOUNDER_DASHBOARD_ENABLED`
  and not publicly reachable in production (confirmed 404 without the flag). A founder-run
  5-person comprehension test found one launch-blocking usability defect — the result view
  rendered correctly but the browser never adjusted scroll position across the layout collapse, so
  users only saw the Mumbai hero image — fixed and merged (PR #235). No further Journey Brief work
  is scheduled; expansion to another route or public exposure both await a founder decision.
- **Route verification (`COV-001`):** Rolling Reverification Batches 1–6 closed 4 September 2026
  (PRs #217, #218, #221, #222, #224, #227, plus supporting integrity fixes #223, #225, #226) —
  49 routes due for review within 30 days, 26 healthy, 0 overdue at close. The standing rule this
  work locked in: a source being reachable today does not by itself prove today's operational
  truth — genuine continuity requires either a live/real-time source or two temporally distinct
  observations of the same fact, not one static document re-opened. No Batch 7 is scheduled.
- **Fare Watcher / Standout Fare:** No Standout Fare is currently live anywhere on JetStash (checked 7 October 2026).
  Phase 1 shipped with one founder-approved Standout Fare on Manchester–Islamabad (25 August). That approval
  resolved from 25 to 31 August and retired automatically on 1 September, when a newer routine observation
  became the current detection; this is expected Fare Watcher / Standout lifecycle behaviour (not a defect;
  `STANDOUT-ISB-001`), and the approval record is intact but dormant. A second approval (london-gatwick-dalaman
  £58, 29 September) was failed closed and revoked on 7 October because its booking offer was never recorded
  (`STANDOUT-DLM-001`, PR #316). The engine and approval gate are unchanged; further routes, new UI and
  threshold changes remain frozen pending real traffic evidence. Whether an approval should survive later
  observations is an open product-contract question (`STANDOUT-LIFE-001`).
- **Quote Request:** PR #187 is live. It is a research/decision-support enquiry: JetStash researches
  options and trade-offs, but does not take booking payment or make bookings. Broader Quote Request
  redesign is closed unless customer evidence exposes a new problem.
- **Search Console discovery:** the founder-confirmed follow-up is closed; sitemap discovery reached
  the current submitted inventory and there is no active indexing firefight. Live search performance
  remains external evidence and must not be inferred from repository state.
- **Affiliate/commercial:** Trip.com is the sole active flight partner. Unsupported exact-airport
  pairs fail closed; the Heathrow/Gatwick gap is an external/provider limitation, not permission to
  use a generic London handoff. No second provider is active.
- **Legal/operator:** implemented consent, Privacy Policy, commercial disclosures and Quote Request
  role clarity are separate from the unresolved B2 decisions. Draft Terms, public postal-address
  position, final retention periods and professional review are not complete.
- **Manchester–Mumbai / Manchester–Delhi:** the service-truth verification scheduled for 31
  August / 1 September 2026 is complete. Both routes' former direct service is confirmed
  **ended** (`data/route-status-events.ts`, `service-ended`) — no resumption, operator or
  frequency claim is made beyond that. This status has been propagated to public route and
  destination presentation (PR #206, PR #212).

### Launch-level audit state — 3 September 2026

Four launch-level read-only audits closed this week, each with **0 P0 / 0 P1** found:

- **Tier-1 Commercial Readiness** — the 10 locked Tier-1 routes checked for trust/UX/commercial
  blockers; one genuine P1 fixed (PR #214, deal-card route/fare reconciliation).
- **Internal Surface Safety** — confirmed the Founder Dashboard and all founder-only routes are
  unreachable, unindexed and absent from the sitemap in production.
- **Production Performance + Reliability** — no customer-facing performance/reliability defect
  proven. Broader traffic is technically ready; real-user field Core Web Vitals data is still
  maturing (traffic volume is not yet enough for CrUX to report), which is evidence still growing,
  not a defect.
- **Remaining Launch Risk Audit** — confirmed no unstarted, buildable launch blocker remains; every
  item in this document's own delivery queue is already closed, waiting, frozen, or ongoing
  maintenance.

**Current first-revenue bottleneck: NOT YET PROVEN.** The immediate unknown is whether qualified
organic traffic converts through JetStash into partner activity and eventually a booking. Trip.com's
0.5% flight commission and the 25 London-origin handoff gaps are scaling constraints on what
JetStash can become as a business, not proven blockers of the first booking.

**Active experiments:**
- MAN→ISB organic acquisition
- MAN→LHE observation
- Reddit distribution experiment

**Waiting on external commercial evidence:**
- Trip.com's reply on LHR/LGW handoff support, attribution confirmation and commercial terms

**Hold / gated:**
- **Hotel attribution: HOLD, waiting for attribution proof.** No Madinah or Antalya observation,
  no hotel promotion, no hotel expansion, no new test click and no hotel URL or product change
  until an authenticated Trip.com report proves the existing Algarve hotel click row exposes the
  property's unique Ad ID / `trip_sub3`. That check is the only permitted next hotel action.

**Ongoing maintenance:** the weekly fare-observation cadence (`FARE-001`) and route-verification
cadence (`COV-001`) continue as before, unaffected by the above.

**Background, independent of the above:** a public-copy dash-separator cleanup
(`data/routes.ts`'s manchester-lahore frequency field) is running in a separate session as of this
entry; do not duplicate it here.

**Next evidence gates** (project decision checkpoints, not automations):
- **6 September 2026** — MAN→ISB Day 3: read Search Console, Vercel and Trip.com for the signal.
- **Around 9 September 2026** — Trip.com follow-up, only if there has still been no reply by then.
- **10 September 2026** — MAN→ISB Day 7 decision, and a MAN→LHE indexation recheck.

Cooperation Agreement: review around 22 October 2026, ahead of its 5 November 2026 deadline.

No new major Claude/Codex workstream is currently justified. The correct current job is observing
these gates, not building — see `LAUNCH_CHECKLIST.md`'s current-state note for the same conclusion.

**Note (14 September 2026):** the three dated gates above (6/9/10 September) have passed and fed
into the Astra programme's conclusions, superseded by "Astra programme closure and current operating
state — 14 September 2026" above — the build freeze and its five triggers are now the standing rule,
not these specific dates. This paragraph's underlying conclusion (observe, don't build) still holds
and is now the permanent state, not a temporary one awaiting the next gate.

### How to read the historical record below

The remainder of this file preserves dated implementation and audit records. Phrases such as
"current" inside a dated 16 or 21 August entry describe that snapshot, not the 27 August operating
state above. Current-looking PR labels that became false after merge have been corrected, while the
underlying delivery history remains intact.

## Current truth

- **Route page simplification Phase 1 — fare reconciliation + unified fail-closed copy (PR #181,
  merged 25 August 2026):** implements only §20 of the
  Route Page Decision-First & Density master audit, which is the audit's own Phase 1 and nothing
  else. Two changes. (1) The audit's single P0: on `manchester-islamabad` the page currently
  renders £460 for travel 20 October–3 November (Fare Signal, the 25 August controlled batch's
  Riyadh Air check) and £601/£621/£626 for travel 6–20 October (Journey Choice) — different trips —
  ~4,500px apart with no cross-reference. One derived sentence now names the two travel-date
  windows at the point of contrast (`lib/fare-window-reconciliation.ts`, rendered by `page.tsx`
  above Journey Choice, never inside it). The exact fare/window pair is never hardcoded — the
  module derives whichever two windows the two blocks currently hold, so this description's own
  figures will move again the next time a fare-coverage batch logs a new manchester-islamabad
  check. Fails closed: null when either window is missing and null when the two windows match, so
  it renders on no other route today. (2) The two divergent fail-closed sentences
  for one state — Fare Signal's "Exact partner booking link is not currently verified for this
  route." and Book-By's "Direct flight comparison is not available for this airport yet." — are now
  one shared `NO_VERIFIED_PARTNER_LINK_NOTE` constant carrying Fare Signal's wording verbatim; both
  render identically on `london-heathrow-jeddah`, ~1,024px apart. No fare data, no Trip.com URL, no
  affiliate ID, no analytics event and no CTA is added or removed; Journey Choice's derivation,
  evidence drawer, dated handoff and measurement instrumentation are untouched; Travel Ready is not
  touched at all. Audit Phases 2–7 (warning-zone promotion, duplicate-CTA removal, Fare History
  progressive disclosure, Travel Ready compression, Journey Choice promotion, the Heathrow–Jeddah
  commercial path) all remain **not started** and deliberately out of that PR. Known follow-up: the
  older "Direct flight comparison…" wording still exists on four other surfaces (`deal-card.tsx`,
  `no-fare-fallback.tsx`, `travel-ready-check.tsx`, `tracked-fares-explorer.tsx`), each with its own
  regression tests — unifying those is a separate, later change.
- **Commercial trust safe-fix (founder-authorised Category A remediation):** customer-facing
  compensated CTAs now use one adjacent, explicit affiliate/advertising disclosure; Contact and
  Quote Request show the existing Privacy Policy beside their forms; stale hotel-scope copy,
  unsupported generic Business-cabin benefit claims, package-price framing and DealCard's ambiguous
  airline-vs-route verification label are corrected. No Terms, operator identity, address, retention,
  Google Ads, consent, quote-fulfilment, Journey Choice product, route-tier or indexing change is
  included. Category B remains dependent on founder/legal facts rather than repository inference.
- Route Status V1 is shipped and live.
- COV-001 verification-gap audit (21 August 2026): Manchester–Karachi, Birmingham–Lahore,
  Birmingham–Islamabad and Birmingham–Delhi were reclassified from disputed-direct to
  verified-connecting on fresh primary-source evidence (PIA's own live booking engine for the three
  PIA routes; Air India's own current page for Birmingham–Delhi, reconciled with Birmingham
  Airport's 2019 tag-service announcement). See `ROUTE_VERIFICATION_CADENCE_POLICY.md` Batch 3 for
  the full evidence record. No fare was unlocked by this change; Birmingham–Ahmedabad,
  Gatwick–Ahmedabad, Heathrow–Dhaka, Heathrow–Sylhet and Manchester–Sylhet remain unverified,
  deliberately untouched.
- **Birmingham–Islamabad booking-window copy fix (PR #160, merged 21 August 2026):** the COV-001
  reclassification above exposed a real customer-facing inconsistency PR #159 itself didn't touch —
  `data/booking-windows.ts`'s `bhx-isb-eid-recommended` guidance still said "Its direct service is
  not yet independently verified," directly contradicting the corrected CONNECTING Route Status
  copy on the same page. Fixed to a connecting-not-nonstop sentence that doesn't hardcode Istanbul
  as a permanent route fact (the route-level note is allowed to; this shorter sentence stays
  generic, matching the same guardrail already applied to Manchester–Karachi). One file, one
  sentence, verified live on production.
- **Participant 1 defect follow-up (PR #161, merged 21 August 2026):** the first user of the new
  5-user PR #155/#156 validation round (see `PR155_156_VALIDATION_FOLLOWUP.md`'s outcome section)
  exposed two objective defects, both fixed at root, not patched:
  1. **Homepage journey-submit hydration race.** The "Check my journey" form has no `action`/
     `method` attribute, so a submit reaching the browser before hydration attached React's
     `onSubmit` fell through to a native GET reload of the homepage itself — indistinguishable from
     "did nothing." Fixed with a standard hydration-safety guard: the submit button ships
     `disabled=""` in the raw server-rendered HTML (proven via a pre-hydration `curl`, not asserted)
     and only enables after mount.
  2. **Ambiguous cabin-scoped no-fare fallback.** `DealCard`'s "No fare checks logged yet" read as
     contradicting a fare shown elsewhere on the same page (it's cabin-scoped; the route-level Fare
     Signal panel is cabin-agnostic). A founder review correctly judged an initial ordering-only fix
     insufficient — a scope check found the same latent ambiguity on 6 routes, not just
     Manchester–Islamabad. Fixed at the source: the fallback now names the cabin (e.g. "No Business
     class fare checks logged yet"), derived from the card's own already-trusted `deal.cabin`.
  See `tests/dealcard-order-and-hydration-fix.test.ts` for the regression coverage.
- **PR #155/#156 real-user validation round: COMPLETE (21 August 2026)** — see
  `PR155_156_VALIDATION_FOLLOWUP.md`'s outcome section for the full per-user record and evidence-
  based conclusion. Summary: PR #155 materially improved comprehension of route service vs. observed
  fare journey (validated independently by Users 1, 2 and 3, without coaching); PR #156 improved
  scanability but Users 1 and 2 exposed the two objective defects fixed in PR #161; User 3 confirmed
  both fixes post-#161; Users 4 and 5 broadened validation across multiple routes, CTA states and the
  hotel/destination layer without exposing another repeated defect. No further route-page redesign
  is currently justified from this round — reopen only on new, repeated user evidence.
- **Trip.com dated round-trip handoff — commercial attribution NOT YET CONFIRMED.** What is proved
  so far, and only this: a controlled production click through Ad ID `D19082296`
  (Manchester–Islamabad) was completed 21 August 2026, through the real referral flow, and the
  current generic production Trip.com handoff successfully reached Trip.com with its affiliate
  parameters (`Allianceid`, `SID`, `trip_sub3=D19082296`) confirmed intact on the landed page. The
  same click also confirmed the generic URL opens a **one-way** search, not round-trip
  (`flighttype=S`) — a second, independent reason (beyond preserving dates) the dated handoff would
  eventually be worth building, separate from the attribution question. **Affiliate attribution
  itself is not yet confirmed, and this entry must not be read as if it were.** Two conditions must
  both be met before it is: (1) Trip.com's Partner dashboard reporting cycle must explicitly include
  21 August (next update 22 August — not yet due), and (2) `D19082296`'s click count must show an
  increment above its known pre-test baseline of **1 click**, attributable to the controlled test —
  only that specific increment closes the generic-link attribution question; a flat or unrelated
  count does not. **Even if generic-link attribution is confirmed, that does not by itself prove
  attribution for the separate, not-yet-built, transformed dated
  `/flights/showfarefirst?...&triptype=rt` handoff** — that format requires its own, separate
  controlled-attribution proof before implementation. **No implementation of the dated handoff until
  attribution evidence supports it** — this is an observation-only entry, no code change.
- The Route Atlas (PR #27, plus mobile/crowding/density follow-ups in PR #28, #29, #30, #34)
  replaced the Manchester-to-Mumbai pull-brief hero as the public homepage. The pull-brief hero and
  its supporting `lib/homepage-flagship.ts`/`lib/flagship-status-copy.ts`/`pull-brief*.tsx` code
  remain in the repository but are no longer reachable from any live route — see `COMPLETED.md`
  `ATLAS-001` and the housekeeping item in `LAUNCH_CHECKLIST.md` for the dead-code cleanup.
- The Journey Check Form (PR #32) gives visitors who already know their route a fast path straight
  to the route guide, alongside the Atlas's browse/discovery experience.
- The homepage "JetStash Difference" section (PR #33) states the differentiation reasoning
  explicitly rather than leaving it implicit in the Atlas alone.
- The UK page-hero visual collection (PR #31) is live across about, airports, business-class,
  contact, deals, family-holidays, guides, quote-request, routes and travel-club — confirmed wired
  through `getHeroBackdrop`/`HeroBackdrop`, not yet individually visually spot-checked.
- The July trust-crack fixes are shipped and live: duplicate metadata titles were removed,
  deal-card durations are route-specific, and destination pages no longer present generic
  airport-specific summaries as route facts.
- The homepage flagship now derives its showcase or advisory presentation from the shared Route
  Status ledger; uncertain or ended service is not presented as a confirmed reveal.
- The premium Guide image collection and visual Guides discovery hub are shipped and live.
- The Birmingham-to-Mumbai connecting guide and verification-pending leakage protection are live.
- Travel Ready Check is built and live.
- Travel Ready Check discoverability is live: relevant
  homepage, footer, sitemap, destination, family-visit and regional document surfaces now link
  contextually without adding main-navigation clutter.
- JetStash is positioned across its platform surfaces as UK travel intelligence for international
  journeys, with specialist route depth stated honestly as South Asia and the Gulf.
- Route Watch and Travel Club use honest, human-reviewed language.
- TravelUp has been removed entirely (founder decision, 4 August 2026 — its generic-search CTA
  reset the traveller's departure airport, e.g. Manchester silently becoming London, judged an
  unacceptable user experience). Trip.com is now JetStash's sole active flight-comparison provider:
  45 of 88 routes carry a genuine, dashboard-generated, dateless Trip.com affiliate link
  (`lib/booking-providers.ts`); a further 18 fall back to a genuine, pair-keyed
  `TRIPCOM_DESTINATION_URLS` handoff, so 63 of 88 routes show some working Trip.com CTA on their
  route page. 25 routes currently have no booking CTA at all, by design, because no safe exact
  handoff has been verified for them (the London-origin routes are the largest known cluster). No
  generic fallback is used. New partner integrations remain disabled until they have
  explicit approval, a real tracking link and direct journey validation.
- The Founder Dashboard is unavailable in production and non-indexable.
- Contact, Quote Request and Newsletter submission flows were freshly re-verified live on 29 July
  2026 (real submissions, real Resend/Brevo delivery confirmation), not merely re-asserted from the
  24 July confirmation. That pass found and fixed one real defect: the newsletter form was showing
  a generic error message regardless of the actual failure reason (PR #35). Treat the 29 July pass
  as the current evidence; do not repeat it wholesale unless a relevant API route, environment
  variable or provider configuration changes.
- The UK airport visual collection is live: all 11 supported airports have consistent, airport-labelled
  1672×941 WebP artwork. These are designed/generated brand visuals, not documentary or licensed
  photography, and are not described as such to customers.
- Destination photography is founder-confirmed complete.
- The editorial fare observation methodology is finalized and shipped
  (`docs/project-control/FARE_OBSERVATION_ARCHIVE.md`, versioned observation profiles, a fixed
  8-week booking horizon, GBP-only policy, `observedVia`/`profileId`/`observationReason` on
  `FareObservation`). Two five-route editorial batches are now logged (28 July and 4 August 2026),
  plus a 5 August 2026 Trip.com-sourced pair closing the soft-launch pack's two flagged evidence
  gaps: Manchester–Doha's first observation (£411) and a fresh Manchester–Madinah flight-only
  observation (£473, alongside its untouched 9 June 2026 package-price entry). The archive remains
  an active series and must grow through fresh dated checks.
- Evidence-safety correction (5 August 2026): an independent audit found unsupported certainty in
  Book-By Countdown and related route copy ("expect a sharp jump," "fares hold reasonably steady,"
  "fares typically rise sharply," "the most consistently quoted fastest option," two absolute
  "no risk" claims). Fixed as a strings-only pass — Book-By is now explicitly framed sitewide as
  conservative planning guidance, not fare prediction; no countdown maths, fare-observation display,
  route verification/warning surface or Trip.com link was touched. See
  `JETSTASH_PRINCIPLES.md` §14.5 for the full correction and what remains for a follow-up sweep
  (non-QA routes carrying the same softer claim family), and `tests/book-by-evidence-safety.test.ts`
  for the regression coverage.
- Route Coverage Truth Phase 1 (6 August 2026, threshold corrected same day after a product-truth
  review — see below): an independent audit found the live Route Atlas
  (`components/founder/atlas-feel-test.tsx`, embedded on the homepage via `JourneyDeskHome`) let
  one verified destination make an entire country read "strong," with no honest middle state
  between "verified" and "not yet researched." Fixed: every Atlas route now shows one of three
  honestly-derived, non-blank statuses ("JetStash knows this route well" / "Useful route guidance
  available" / "Intelligence still being expanded"), computed from real fields
  (`computeRouteIntelligenceLevel()` in `lib/atlas-network-data.ts`) rather than a manual
  override; country aggregation is now conservative (one strong destination can no longer carry a
  whole country); an active withdrawal/service-change notice is a separate, additive signal that
  never demotes a route's tier. A second, same-day product-truth review then challenged the
  "Strong" threshold itself: the first version required only one depth signal, which let 7 of 16
  "Strong" routes qualify on a single shallow signal. Corrected to require **at least two of six**
  independent depth categories — the real distribution is **9 Strong / 23 Useful** (not 16/16).
  Five country nodes that had read "Strong" (most visibly Manchester's India, the default-context
  country on the homepage) are now honestly "Mixed" or "Useful" under the corrected bar; two
  soft-launch routes (Manchester–Dubai, Manchester–Doha) don't meet it, not five-of-six/one-gap as
  first reported. A full, evidence-based 32-route completeness audit, including this revision and
  the two soft-launch gaps this phase surfaced but did not fix, lives in
  `docs/project-control/ROUTE_COVERAGE_AUDIT.md`. `/deals`'s hero now states the real,
  live-computed fare-tracking scope (8 of 32 routes) instead of implying broader coverage. See
  `JETSTASH_PRINCIPLES.md` §15 for the standing architecture and `tests/atlas-route-status.test.ts`
  for the regression coverage, which keeps the audit document and the live code from drifting
  apart. This phase deliberately did not complete any route's missing intelligence, add a fare
  observation, or touch Arrive By, Book By's own logic, Trip.com links or affiliate behaviour —
  see the audit's "Recommended route-completion batches" for what a Phase 2 would involve.
- Manchester–Dubai's fare-observation gap closed, with a process fix (PR #74, merged 6 August 2026
  as `95f2127`): the founder-action fare check flagged by Route Coverage Truth Phase 1 above was
  performed via Trip.com, reviewed twice, and recorded (`obs-man-dxb-economy-20260806-8w-v1`, £480
  return, Gulf Air, connecting via Bahrain, checked 6 August 2026) — Manchester–Dubai's Atlas grade
  is now mechanically `'strong'` (baggage + fare), not a manual override. Reviewing the rendered
  page found a real defect this closure exposed: the `DealCard` badge asserted the route's
  route-level direct service ("DIRECT FLIGHT") directly above this fare's own connecting
  itinerary — a genuine contradiction, not a cosmetic one. Fixed in the same PR, before merge:
  `FareObservation` gained a `fareDirectness: 'direct' | 'connecting' | 'unknown'` field recorded
  from evidence at collection time, never inferred from route status; `getDealFareDirectnessLabel()`
  (`data/deals.ts`) is now the one gate every `DealCard` badge goes through, falling back to the
  route-level label only when safe and failing closed (no badge) otherwise. Auditing every `Deal`
  entry for the same latent defect found three further affected cards (Manchester–Lahore,
  Heathrow–Delhi, Birmingham–Amritsar Economy), all now correctly showing no badge instead of an
  unconfirmed claim. Full detail, the evidence-methodology verdict (a persisted image file is not
  required by the archive's own binding rules) and the Atlas-promotion reassessment (grade left
  exactly as computed, page now internally consistent, broader content-depth concern flagged
  separately) live in `ROUTE_COVERAGE_AUDIT.md`'s addendum and `FARE_OBSERVATION_ARCHIVE.md`. Two
  process improvements came out of this the same day: `docs/project-control/FARE_COLLECTION_CHECKLIST.md`
  (a step-by-step template for every future observation) and a "Route Intelligence Scoring v2"
  review flagged in `ROADMAP.md`/`DECISIONS.md` (evidence-category count alone doesn't measure
  page depth or traveller usefulness — no implementation planned, founder decision required first).
  A **Fare Coverage Expansion — Batch A** (10 routes: Manchester–Lahore, –Islamabad, –Delhi,
  –Mumbai, Birmingham–Amritsar, Manchester–Madinah, –Doha, Heathrow–Delhi, –Mumbai,
  Birmingham–Lahore) is approved as the next phase, sequenced deliberately in small batches rather
  than all 32 at once — logged in `FARE_OBSERVATION_ARCHIVE.md`, **planned, not started** as of
  this entry.
- Product-integrity fix (5 August 2026): `data/deals.ts`'s `hasTrackedFare` now gates on
  `isBundledProductDeal` — a package/Umrah-category deal (bundled flight+hotel) no longer counts a
  flight-only fare observation as evidence for its own price. Found while adding the Madinah
  observation above: `umrah-package-jed` and `umrah-package-extended` were both showing a flight-only
  fare under an "Umrah package" badge. Both deals, and the `/deals` page's Umrah filter tab, now
  correctly show no tracked fare until the archive can log an actual package-price observation.
- Arrive By Stage 1 (deterministic backward-planning engine, `lib/arrive-by/`, six routes) is
  complete and, as of this entry, Stage 2 is also complete: a private, founder-only preview at
  `/founder/arrive-by` (`app/founder/arrive-by/page.tsx`, `components/founder/arrive-by-preview.tsx`),
  gated identically to `/founder` and the Journey Brief preview (404s in production unless
  `FOUNDER_DASHBOARD_ENABLED=true`, `robots: noindex`, absent from `app/sitemap.ts`, no analytics, no
  network calls). **This is a private product-evaluation tool — it does not indicate public launch
  readiness.** Stage 3 (a public, customer-facing interface) is explicitly not started; see
  `docs/product/ARRIVE_BY_MVP.md` §17 for what that would require. §16 also documents a Stage 1
  defect discovered while building Stage 2 (`indicativeUkDepartureWindow.earliest`/`.latest` named
  backwards relative to real chronological order) — this has since been **fixed directly in the
  Stage 1 engine** (`lib/arrive-by/engine.ts`); the engine now guarantees `earliest <= latest` for
  every result, the Stage 2 display-side workaround has been removed, and regression tests cover
  all six routes.
  *(Superseded 3 October 2026: Arrive By full-journey V1 is now a live limited beta; see "Arrive By: live limited
  beta and feature freeze, 3 October 2026".)*
- The Visual Identity System v2 documentation refactor is shipped (`docs/visual-identity.md`,
  `VISUAL_REVIEW_CHECKLIST.md`): Visual Principles, Editorial Photography, Interactive Visual
  Systems and an Asset Catalogue with Lifecycle status per entry. This is the documentation
  structure only — its audit now records the completed airport visual collection and the remaining
  Placeholder entries are now limited to unrelated vertical and hub heroes; all 11 supported
  airports have consistent generated/WebP artwork.
- Permanent project-control records are linked from `CLAUDE.md` and `README.md`.
- `CLAUDE.md`, `README.md` and `JETSTASH_PRINCIPLES.md` reflect Next.js `15.5.21`, the current
  Vitest suite, Route Status ownership, homepage architecture and automatic Vercel deployment.
- **Hotel Intelligence (PR #136, merged 15 August 2026) covers exactly 10 destinations — Antalya,
  Dubai, Madinah, Dalaman, Istanbul, Marrakech, Bodrum, Agadir, Barcelona, Faro — via one shared
  architecture (`lib/holiday-intelligence.ts`, `components/destination/holiday-intelligence.tsx`).**
  29 property evidence records exist across those destinations (`data/hotel-evidence.ts`: 3
  Antalya; `data/hotel-evidence-expansion.ts`: 26 across the other 9), and all 29 map to a real,
  dashboard-generated, dateless Trip.com hotel affiliate link (`lib/hotel-booking-links.ts`) —
  zero missing, duplicate or orphaned mappings, verified by direct reconciliation of the evidence
  files against the URL map. **Hotel Intelligence expansion is frozen at these 10 destinations**;
  adding an 11th requires a new, explicit founder decision backed by customer evidence, not more
  engineering capacity alone.
- **Historical Fare Signal / fare-observation snapshot — 21 August 2026 (Big Review Clean-up
  Batch 1)** (see the dated table below) — do not use "fare coverage" to mean more than one of
  these without saying which. **Correction to this table's prior 16 August figures**: the archive
  has grown substantially through ordinary editorial fare-collection work in the five days since
  (119→206 total records) — that growth is healthy, not a problem (see the freshness audit note
  below), but the 16 August counts themselves were stale and are replaced here, not edited in place
  (see `DECISIONS.md`'s new 21 August entry for the same correction recorded as a decision-log
  entry, following that document's own "add, don't rewrite" convention). 206 total `FareObservation`
  archive records exist (append-only, never overwritten); 181 of those are publicly publishable (25
  are not — legacy records predating the `departureDate`/`returnDate`/`currency` completeness
  requirement, plus the 5 COV-001 methodology-excluded records below, per `isPubliclyPublishable()`
  in `data/fare-observations.ts`); 83 routes have at least one publishable observation; **78 of 88
  routes currently render a display-ready Fare Signal** once route-verification status is also
  applied.

  | Term | Count | Definition |
  |---|---:|---|
  | Total `FareObservation` archive records | 206 | Every observation ever logged, append-only, never overwritten |
  | Publicly publishable observations | 181 | Archive records with complete `departureDate`/`returnDate`/`currency`, minus methodology exclusions (`isPubliclyPublishable()`) |
  | Routes with ≥1 publishable observation | 83 | Distinct `routeSlug`s among the 181 publishable records |
  | Routes with a current display-ready Fare Signal | 78 | The 83 above, filtered by `getFareSignalForRoute(...).state === 'current'` (also requires the observation to be fresh, not just publishable) |
  | Curated `Deal` records | 49 | Separate hand-curated card selection (`data/deals.ts`) — not fare evidence itself; unchanged since 16 August |

  **Freshness is healthy, not a gap** — a dedicated freshness audit (21 August 2026, before COV-001)
  found no systemic staleness problem across the archive; do not treat this recount as evidence of a
  freshness issue. The real, still-open coverage gaps are narrower and specific, not a general
  freshness problem:
  - **`leeds-bradford-bodrum`** — a verified direct route with **zero fare observations ever
    logged** (a `FARE-001` coverage gap, not a verification one — see
    `ROUTE_VERIFICATION_CADENCE_POLICY.md`'s Batch 3 note).
  - **The 4 COV-001 routes** (Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad,
    Birmingham–Delhi) each have a real, logged, date-complete fare observation that is deliberately
    held out of public view via `methodologyExcludedObservationIds`, pending a separate founder
    decision on whether to unlock them now that the routes are verified — see
    `ROUTE_VERIFICATION_CADENCE_POLICY.md`'s Batch 3 correction above for the exact observation IDs.
  - **5 routes remain verification-blocked**, not fare-blocked: Birmingham–Ahmedabad,
    Gatwick–Ahmedabad, Heathrow–Dhaka, Heathrow–Sylhet, Manchester–Sylhet — a fare cannot honestly
    render on an unverified route regardless of whether one is logged.

- **Historical curated `Deal` snapshot — 21 August 2026:** the count was 49 (`data/deals.ts`) — a
  separate, smaller, hand-curated set of
  airport→destination+cabin combinations chosen for card display; distinct from, and much smaller
  than, the routes that had fare evidence in that dated snapshot. Never conflate the two: a route can have a
  real Fare Signal with no curated Deal card, and vice versa is architecturally impossible (every
  `Deal` derives its price display from `getFareRangeSummary()`, never a stored price).
- **Google Ads Basic Consent Mode + conversion tracking (PR #135, merged 15 August 2026)** is live:
  the consent gate genuinely blocks the ads tag from loading until acceptance and supports
  withdrawal (`lib/consent.ts`); tracked conversion events exist for flights, hotels and baggage
  (`lib/google-ads-conversions.ts`). **Pilot #1** (July 2026) generated 42 clicks from £30.85 spend
  but had no conversion tracking in place, so it produced no usable read on demand. **Pilot #2**
  (started 16 August 2026, two campaigns: Manchester→Mumbai, Manchester→Antalya) has conversion
  tracking wired from day one and is currently live. Its click/impression/spend numbers are
  intentionally **not** recorded here — they change within the same day and would go stale
  immediately; check Google Ads and Vercel Analytics directly for current Pilot #2 numbers, and do
  not make a campaign decision from an early sample (this document's own standing rule, restated
  from `FIRST_100_VISITORS_WORKSHEET.md`).
- **Search Console opportunity fixes, PRs #152–#154 (merged 20 August 2026)** — three page-1,
  low/zero-click pages fixed from a real Search Console audit, not assumption:
  - `PR #152` restored "Flights" to every peak-period route title (30 routes) after the audit found
    these sitting at 0% CTR despite real impressions (290 for Heathrow–Jeddah alone) — the title had
    read as editorial content, not a bookable-route result. Recovered the character budget (an en
    dash connector, "Windows" dropped from the trailing phrase) rather than exceeding the ~65-char
    guideline a prior attempt had hit; all 30 current peak-period titles land at ≤65 chars.
  - `PR #153` rewrote `/guides/visa-processing-booking-date`'s meta description to state concrete
    e-Visa processing times (4–7 days) and the booking buffer (2–3 weeks) instead of generic copy,
    matching what Google was already displaying verbatim from JetStash's own snippet.
  - `PR #154` rewrote `/guides/direct-vs-gulf-connecting-fares`'s title, meta description **and H1**
    (the H1 change was a deliberate scope extension, founder-approved, since the weak H1 was part of
    the same CTR problem) after the audit found it on page 1 with zero clicks.
- **Route Page Journey Clarity System (PR #155, merged 20 August 2026)** — two independent
  first-time users found the same P1 problem: a route's own verified service (e.g. PIA direct on
  Manchester–Islamabad) and the tracked fare shown directly below it (e.g. a connecting Etihad
  itinerary) were each individually accurate but not visually distinguished. A real-data audit
  proved this systemic, not a one-off: 56 of 88 routes (64%) carry a verified-direct route with a
  connecting tracked fare. Fixed with a "Route service" callout inside Fare Signal
  (`components/route/fare-signal.tsx`) naming the route's real airline and directness whenever it
  differs from the tracked fare's own directness — reuses 100% existing evidence (no new data,
  no route/fare changes), fires only on a genuine mismatch so an already-matching route gets zero
  extra density. See `tests/fare-signal-route-vs-fare-clarity.test.ts`.
- **Route Page Scanability fix (PR #156, merged 21 August 2026)** — a read-only audit measured, on
  live production, that the route-page hero's own Trip.com CTA duplicated Fare Signal's identical
  CTA one section below (same link, same caveat, ~200–850px apart) while sitting at or past the
  mobile fold. Removed the hero's duplicate CTA, its caption, its itinerary/baggage caveat, and the
  continuation cue that only existed to bridge to it; Fare Signal (unconditionally the very next
  section) is now the one place a route's Trip.com action lives, with WhatsApp Share kept in a
  clean standalone hero position. Measured before/after on Manchester–Islamabad: Fare Signal moved
  up 169px at 375/390px mobile, 153px at 1440px desktop, where its price/routing/Route Service
  callout now render fully within the first screen. A no-fare-but-valid-CTA edge case
  (`birmingham-lahore` and 6 similar routes) was caught during implementation and fixed rather than
  silently regressed — see `tests/route-hero-scanability.test.ts`'s full 88-route safety check
  (63 routes keep a working CTA, 25 show the exact fail-closed sentence, never neither/both).

## Operating queue and recent delivery record

This section preserves the fuller programme narratives. The status shown in each heading is
authoritative; completed entries remain here as delivery context and are also summarised in
`COMPLETED.md`.

### LAUNCH-001 — Seven-day controlled organic launch (ACTIVE — founder-operated)

**Product freeze in effect.** The founder's own decision, 30 July 2026: the immediate goal is no
longer "finish the website" — it's the first genuine users, the first useful feedback, and the
first £1 of revenue, from a small, trusted soft launch rather than a wide public push. No
redesigns, new features, or speculative housekeeping for the duration unless a real user hits a
real, reproducible problem. See `SOFT_LAUNCH_PACK_2026-07-30.md` for full detail; its own Change
log documents two corrections since the original draft (TravelUp → Trip.com's booking-CTA impact,
then a full evidence-based re-selection). **Final six routes, approved 4 August 2026:**
Manchester–Lahore, Manchester–Islamabad, Manchester–Dubai, Birmingham–Amritsar, Manchester–Madinah,
Manchester–Doha — chosen from all 23 Trip.com-supported routes on valid CTA, fare evidence, no
active withdrawal warning, guidance completeness, first-visitor strength and audience relevance
(restores all four of the founder's original categories: Pakistan, Gulf, India, Umrah).
Manchester–Delhi/Manchester–Mumbai are excluded from this selection specifically because both carry
an active IndiGo withdrawal-announced notice (`data/route-status-events.ts`, effective 31 August
2026). Tracked-link convention, per-audience message drafts, FAQ, feedback template and the
seven-day plan are all in the pack itself. Draft only as of this entry — nothing sent yet; sending
is the founder's own action, not something done from this repository.

### DEST-001 — First destination expansion: Heathrow → Bengaluru (DONE)

An explicit founder decision, 30 July 2026, and an explicit exception to the LAUNCH-001 product
freeze — not a violation of it (real evidence-led feature work the founder specifically
commissioned, not speculative housekeeping). Adds Bengaluru as a destination and London
Heathrow–Bengaluru as its first route, integrated through every existing shared system (route
guide template, destination directory, Route Atlas, Journey Check, Travel Ready Check, sitemap) —
no new system built. Direct service now verified via two independent airline sources: British
Airways' own 12 Nov 2025 press release ("the airline operates a daily service on its 777-200
fleet") and Virgin Atlantic's own route page ("We fly to Bengaluru daily", 10h). Air India remains
excluded — its official pages give contradictory information about a direct service, and its own
site was again unreachable this session; see `ROUTE_COVERAGE.md`. **The Bengaluru hero image
blocker is now resolved**: the founder's approved photograph is live at
`public/images/destinations/bengaluru.webp` (2560×1440 WebP, converted from the supplied source via
a minimal centre crop, no stretching or creative alteration — see `docs/visual-identity.md`'s Asset
Catalogue). No fare observation logged; none could be honestly recorded without a real, dated
check. See PR for full detail.

### BD-001 — Bangladesh workstream: Dhaka and Sylhet (DONE)

An explicit founder decision, 30 July 2026, and an explicit exception to the LAUNCH-001 product
freeze, on the same basis as DEST-001. Adds Dhaka and Sylhet as destinations, integrated through
every existing shared system, with a new `bangladesh` region group (`RegionGroup`, `regionGroups`
in `lib/site-config.ts`) since neither city fits the existing Pakistan/India groupings — no new
hub page, matching how Mediterranean and North Africa are handled today.

Route evidence uncovered a genuinely volatile service history rather than a stable one, and a
founder-directed amendment round (30 July 2026) corrected and re-checked it against fresh primary
and current sources rather than the original secondary-news leads. Of the four candidate routes
investigated (Heathrow–Dhaka, Heathrow–Sylhet, Manchester–Dhaka, Manchester–Sylhet):

- **Manchester–Dhaka**: **Connecting** (one stop via Sylhet, not nonstop). Biman Bangladesh
  Airlines' current official notice states: “BIMAN BANGLADESH AIRLINES WILL RESUME
  DHAKA-MANCHESTER-DHAKA (VIA SYLHET) FLIGHTS FROM 01 JULY 2026 (EVERY TUESDAY & SATURDAY).”
  That is the primary evidence for the via-Sylhet route pattern and Tuesday/Saturday schedule.
  It does not establish aircraft, terminal or transfer arrangements, so JetStash does not claim
  any of them.
- **Manchester–Sylhet**: remains **Verification Pending** — a genuine, currently unresolved,
  directly-checked contradiction: Manchester Airport's own Sylhet destination page states "We're
  not flying to this location at the moment", while Biman's official Manchester–Dhaka notice says
  the service operates via Sylhet every Tuesday and Saturday.
- **Heathrow–Dhaka**: remains **Verification Pending**, rechecked — Heathrow's own live
  flight-tracking pages now confirm named, currently operating flights BG201/BG202, real evidence
  beyond the previous airline-directory-only finding. Whether this specific service
  is nonstop or (like Manchester) makes a scheduled Sylhet stop is unconfirmed by any primary
  source, so no nonstop claim is made.
- **Heathrow–Sylhet**: **added** as **Verification Pending** (correcting the original "zero
  evidence" rejection, which was inaccurate) — Heathrow's own flight-tracking pages confirm the
  same current BG201/BG202 service, and multiple independent flight-schedule sources describe a
  Sylhet stop on it; held pending rather than
  confirmed, since no primary source has resolved the stop directly.

Bangladesh entry-readiness rules added to Travel Ready Check: British-passport visa requirement,
passport validity, and a new **NVR (No Visa Required) document-exemption** — a genuinely different
mechanism from Pakistan's NICOP or India's OCI card (an endorsement applied for in advance through
the Bangladesh High Commission, London, not a document already held), sourced to
`bhclondon.org.uk/no-visa-required` and GOV.UK's Bangladesh entry-requirements page. Approved
photography for both Dhaka and Sylhet has been converted, registered and deployed (2560×1440 WebP,
`public/images/destinations/{dhaka,sylhet}.webp`) — neither destination remains a release blocker
on imagery; see `docs/visual-identity.md`'s Asset Catalogue for the final entries. No fare
observation logged for any route; none could be honestly recorded without a real, dated check.
Following the 4 August 2026 Trip.com migration: `manchester-dhaka` and `manchester-sylhet` both
have a genuine, route-specific Trip.com link; `london-heathrow-dhaka` and `london-heathrow-sylhet`
have no booking CTA at all (Trip.com has no Heathrow-specific dateless link — see AFF-001 below).
See PR for full detail.

### HERO-002 — Homepage opening hero above the Route Atlas (DONE)

**Done** — see `COMPLETED.md`. Customer-visible pre-launch priority, raised from a real mobile
review on a Samsung Galaxy Z Fold 7: the homepage previously opened directly with the Route Atlas,
asking a new visitor to understand the map before JetStash had explained what it is, why it
exists, how it differs from a comparison or affiliate site, and what to do next. Shipped a compact
premium hero (approved copy, reusing `PageHero` and the existing `heroes/routes.webp` asset) plus a
short "why JetStash is different" proof strip, both above the Atlas, which remains unchanged and
un-redesigned as the homepage's
signature feature immediately below.

### HERO-003 — Homepage hero integration: the journey finder moves into the hero (DONE)

**Founder-approved explicit exception to the LAUNCH-001 product freeze, 2 September 2026** — not a
violation of it and not a broadening of it: the founder explicitly prioritised improving the
homepage's first impression and "wow factor" ahead of wider launch, scoped to exactly this one
change. This exception is limited to the homepage hero integration described below; it does not
lift, suspend or otherwise alter the LAUNCH-001 freeze, which remains ACTIVE for everything else.

Builds on HERO-002 rather than replacing it: the compact `PageHero` hero, its approved copy and the
existing `heroes/routes.webp` backdrop are unchanged. What changed is where the actual "Flying from
/ Going to" journey finder (`JourneyCheckForm`) lives — moved from a separate standalone section
beneath the hero into the hero itself, inside a glass console card on the photographic backdrop, so
a visitor can use the finder within the first screen rather than clicking a CTA and scrolling to a
duplicate section further down. The standalone section (and its now-redundant "Check a journey"
button, which used to scroll down to it) is removed entirely — `JourneyCheckForm`'s own selection
logic, analytics events and routing are unchanged, only relocated. The "81 of 88 tracked fares"
stat is retained but de-emphasised (still live-computed, never hardcoded); it no longer leads the
hero.

Verified before commit: 2950/2950 tests, TypeScript clean, lint clean, production build clean, no
new dependency, homepage bundle size unchanged, journey finder confirmed working end-to-end (both
locally and on the PR's Vercel Preview). See PR for full detail.

### HERO-004 — Mobile consent-banner overlap on the homepage hero console (DONE)

**A genuine functional/mobile UX defect fix already permitted under the LAUNCH-001 freeze's own
stated exception ("unless a real user hits a real, reproducible problem") — not another founder
exception like HERO-003.** HERO-003 moved the real journey finder into the hero's first screen;
that first screen is exactly where the site-wide fixed-bottom cookie consent banner
(`components/ui/cookie-consent-banner.tsx`) already sat on mobile, at up to ~292px tall on a
genuine first visit before any consent choice is made. Measured precisely via DOM bounding-rect
overlap (not assumed): on a real first visit at 390×844, the banner fully covered both selectors
and the "Check my journey" button; at 412×915 it covered the "Going to" selector and the button.
This pre-dates HERO-003 and is not caused by it — HERO-003 just moved a primary control into the
zone the banner already occupied.

Fix, confined to exactly two files:
- **The banner** (`components/ui/cookie-consent-banner.tsx`): shorter, factually-equivalent public
  copy (still discloses the measurement is optional, still names partner link clicks specifically
  — never anything implying confirmed bookings — still names Vercel Analytics and Speed Insights
  running separately, still links to the Privacy Policy and the footer's Cookie settings control);
  tighter mobile-only layout; both Accept and Decline kept at an explicit, height-guaranteed 44px
  tap target (`h-11`, flex-centred, not estimated from padding). No wording change past what's
  needed for length and JetStash's standing no-dash public-copy rule (no em/en dash, no hyphenated
  word pairing) — "partner-link" became "partner link", the opening em dash removed.
- **The homepage hero** (`components/homepage-v2/homepage-opening-hero.tsx`): a small mobile-only
  spacing recovery — the console's own top padding, the label-to-form gap, and (the largest single
  piece) a negative top margin that exploits ordinary CSS margin collapsing against `PageHero`'s
  shared `mt-7` wrapper, recovering headroom from that gap without editing `PageHero` itself (still
  used unchanged by 13 other pages) or `JourneyCheckForm`'s own internal spacing (left untouched).

**Safe-area consideration, deliberately not coupled in:** the app's viewport metadata does not set
`viewportFit: 'cover'`, so `env(safe-area-inset-bottom)` genuinely evaluates to 0 on every real
device under the current configuration — plain fixed padding is the correct choice for the
production layout as it actually exists today, not an approximation of it. An earlier draft of
this fix coupled the banner's bottom padding and the hero's pull-up margin to
`env(safe-area-inset-bottom)` as forward-looking insurance; removed on founder review (2 Sep 2026)
because it was a latent bug of its own — the hero's margin is a static CSS rule with no way to know
whether the banner is even visible, so a safe-area-dependent version would have stayed pulled up by
the same amount after the visitor dismissed the banner via Accept or Decline. If `viewport-fit=cover`
is ever adopted, that should trigger its own site-wide safe-area review, not a homepage-specific
coupling landed years earlier for a configuration the site didn't use yet.

Verified before commit: 2951/2951 tests, TypeScript clean, lint clean, production build clean, no
new dependency; 390×844 (17.6px CTA clearance) and 412×915 (88.6px) both clear; desktop confirmed
pixel-identical via computed styles. See PR for full detail.

### FARE-001 — Maintain the editorial fare observation archive (ACTIVE)

The methodology is finalized and the archive is now established rather than at its starting point:
226 append-only records exist at the 27 August 2026 baseline, and 83 of 88 routes render a current
Fare Signal. This remains an ongoing editorial cadence, not a completed one-off collection project.
A human may record a fare observed on Google Flights, Trip.com or an airline booking page, provided
the source, check date, outbound date, return date, cabin, currency and baggage treatment are
captured, against a fixed 8-week booking horizon. Google Flights is an observation source only:
service facts still require primary airline, airport or official sources. Historic incomplete
entries remain private; a past price cannot be reconstructed honestly after the fact.

### AFF-001 — Improve affiliate coverage (ACTIVE / WAITING ON PROVIDER)

**Superseded 4 August 2026.** TravelUp has been removed entirely (its generic-search CTA reset the
traveller's departure airport — an unacceptable user experience). Trip.com is now JetStash's sole
active provider: 45 of 88 routes carry a genuine, dashboard-generated, dateless Trip.com affiliate
link (`lib/booking-providers.ts`), each the exact unedited output of Trip.com's own Affiliate Link
dashboard tool; a further 18 fall back to a genuine `TRIPCOM_DESTINATION_URLS` handoff, for 63 of 88
routes with some working CTA. 25 routes currently have no booking CTA at all — Trip.com's tools
cannot produce a safe exact airport-specific dateless link for the London-origin cluster (only a
generic "London" (LON) option, which is deliberately not used per JetStash's fail-closed rule: an
exact airport-specific link, or no CTA at all. Expedia and other potential partners must remain unenabled
until JetStash has approval, a genuine tracking link and a scoped validation of the customer
journey.

### COV-001 — Build verified route coverage deliberately (ACTIVE)

Route coverage now has a durable operating queue in `ROUTE_COVERAGE.md`. The 28 July pass resolved
the qualifying direct-service records for Heathrow–Delhi, Manchester–Dubai, Heathrow–Doha,
Manchester–Doha, Glasgow–Dubai, Edinburgh–Dubai, Newcastle–Dubai, Gatwick–Ahmedabad and
Gatwick–Amritsar, and corrected Birmingham–Amritsar to connecting using current Air India
evidence. **Corrected 21 August 2026 (Big Review Clean-up Batch 1):** this paragraph previously said
Manchester–Karachi, Birmingham–Lahore and Birmingham–Islamabad "remain explicitly unresolved PIA
disputes" — stale since the 21 August COV-001 verification-gap audit (PR #159) reclassified all
three, plus Birmingham–Delhi, from disputed-direct to verified-connecting on fresh primary-source
evidence. See "Current truth" above and `ROUTE_VERIFICATION_CADENCE_POLICY.md`'s Batch 3 for the
full evidence record. The genuinely still-unresolved routes are Birmingham–Ahmedabad,
Gatwick–Ahmedabad, Heathrow–Dhaka, Heathrow–Sylhet and Manchester–Sylhet (5, not 3) — deliberately
untouched by that pass; see `ROUTE_COVERAGE.md`'s "Explicitly unresolved direct-service disputes"
for each one's specific open reason. Each cycle must add independently sourced service evidence or a
date-complete fare observation; never fill a route simply to remove a pending state.

Historical delivery record: the first evidence-bounded Turkey route-guide pilot shipped across Manchester–Istanbul,
Manchester–Dalaman, Manchester–Bodrum, Manchester–Antalya and Manchester–Izmir. Antalya publishes seasonal direct-service
context with varying published timings; Izmir publishes SunExpress's seasonal programme and Manchester
Airport's planning figure without a fixed weekly frequency. All five preserve their exact Trip.com
handoffs and publish no fares or unsupported booking claims.

Historical delivery record: the Birmingham Turkey route-guide batch shipped across Birmingham–Istanbul,
Birmingham–Antalya, Birmingham–Dalaman and Birmingham–Bodrum. Birmingham Airport evidence supports
direct service for all four; Istanbul preserves the IST/SAW arrival distinction, Dalaman keeps its
approximate timing qualified, and Bodrum remains explicitly seasonal. All four preserve their exact
Trip.com handoffs and publish no fares, baggage claims or fixed frequency promises.

Historical delivery record: the Morocco route-guide batch shipped across Manchester–Marrakech,
Bristol–Marrakech, Gatwick–Marrakech, Manchester–Agadir, Birmingham–Agadir, Gatwick–Agadir,
Heathrow–Casablanca and Gatwick–Tangier. Current airport and airline evidence supports bounded
direct-service guidance for all eight; it does not support fixed fares, baggage claims or universal
frequency/duration promises. The four existing non-London Trip.com handoffs are preserved inside
their route guides; the four London-origin handoffs remain intentionally blocked with no LON fallback.

**Self-transfer prominence fix (25 August 2026, founder-approved narrow customer-trust fix):**
Fare Signal now shows a "Self-transfer itinerary" label, alongside the fare's routing information,
whenever the representative observation's own `priceNote` explicitly records self-transfer or
separate-ticket wording (`lib/fare-self-transfer.ts` — a single conservative evidence predicate,
never inferring from stop/airline count, airport changes or price alone, and never labelling a
negated mention such as "no self-transfer notice"). Confirmed live on the six 25 August batch fares
that carry this evidence (Manchester–Lahore, Manchester–Dubai, Heathrow–Jeddah, Heathrow–Doha,
Birmingham–Amritsar, Gatwick–Amritsar); Manchester–Islamabad's £460 Riyadh Air fare correctly does
not receive the label, since its own `priceNote` records no such evidence. Presentation only — no
fare data, Fare Watcher maths, route truth, Journey Choice or Book-By logic changed, and no
structured field was added to `FareObservation`.

**Same-day verification-recheck representative priority (25 August 2026, founder-approved, PR #182,
merged):** logic-only fix, no data appended. A deferred four-observation append (£480
MAN-ISB / £547 MAN-LHE / £361 LHR-JED / £591 BHX-ATQ, all `emergency-recheck`, all sharing their
route's routine observation's exact `observedDate`) exposed a real evidence-ordering defect: the
representative-observation tie-break (`lib/fare-signal.ts`) broke a same-day tie on price alone, so
every one of those routes would have kept displaying its cheaper, already-superseded routine fare
instead of the later verification. Fixed with one shared comparator
(`compareByRepresentativePriority`) used by both `selectLatestObservation` and
`selectCurrentEconomyObservation` (and therefore Book-By's representative selection too, which
already delegates to the same function): on a same-day tie, `observationReason: 'emergency-recheck'`
now outranks a non-recheck observation — evidence recency, not a price preference, proven both
directions (a recheck that came back higher AND one that came back lower both win). Historical
safety audit of the two existing emergency-recheck records (Birmingham–Amritsar and
Heathrow–Jeddah, both 19 August 2026) found **zero public-facing change** — neither has a same-day
sibling observation, so the new tie-break tier was never reached for either. Does not weaken the
verification-recheck comparison-integrity fix (PR #179): `isIndependentComparisonObservation()` is
untouched, so an emergency-recheck still never enters Smart Fare/Journey Choice comparison
membership or independently increases Fare Watcher baseline depth — proven via a before/after diff
of `generateFareWatcherCandidates()`'s actual output, not assumed. At this point in the delivery
sequence the real four-observation append was still deferred; it subsequently shipped in PR #183.
The PR #182 validation used a synthetic four-fare simulation only, with nothing then written to
`data/fare-observations.ts`.

**Fare Watcher verification recheck append (25 August 2026, founder-approved, PR #183, merged):**
the deferred four-observation append is done — data-only, no logic changed. Four
`emergency-recheck` records added for manchester-islamabad (£480), manchester-lahore (£547),
london-heathrow-jeddah (£361, reproduced exactly) and birmingham-amritsar (£591), each re-verifying
its route's same-day routine observation from the controlled weekly batch. Archive count 222 → 226.
Confirmed via the live selector, not array order: all four routes' representative Fare Signal and
Book-By evidence now correctly resolve to the recheck (not the cheaper same-day routine record it
re-verifies), self-transfer labelling is unaffected (present on three, absent on
manchester-islamabad, driven entirely by each record's own `priceNote`), Journey Choice stays
exactly £601/£621/£626 and "£25 more saves 14h 15m of journey time" (the £480 recheck's 20 Oct–3 Nov
window still doesn't match the pilot's 6–20 Oct contract), and Fare Watcher's baseline counts for
all four routes are unchanged from before the append — no candidate moved past
`lifecycle: 'detected'` / `founderVerificationRequired: true`. Seven pre-existing tests that
hardcoded the old routine-fare values (`book-by-cabin-safety`, `fare-self-transfer`,
`fare-signal-cabin-safety`, `fare-signal`, `journey-choice`, `route-and-fare-integrity`,
`route-hero-scanability`, `seo-domination-batch-1b`) were updated to the new correct values — same
pattern PR #178 itself used when it last changed representative fares.

**Fare Watcher verified-candidate price integrity (25 August 2026, founder-approved, PR #184,
merged):** logic/tests-only fix, no fare data changed. The prior fix above corrected Fare
Signal/Book-By's *public* representative-fare selection but left a separate, undiscovered gap in
`lib/fare-watcher.ts`'s own internal candidate evaluation: `generateFareWatcherCandidates()` still
promoted the original routine detection as "the candidate," so all four 25 August rechecks
(MAN-ISB, MAN-LHE, LHR-JED, BHX-ATQ) kept being evaluated at their stale routine price — MAN-ISB
still read £460 internally even though its verified evidence is £480. Fixed by adding
`isMatchingVerificationRecheck()`/`findLatestVerificationRecheck()` (exact route/cabin/profileId/
departureDate/returnDate/currency match, deliberately NOT requiring the same airline/routing/stops/
price — verification exists to discover the currently available lowest fare for that exact
profile) and excluding `emergency-recheck` observations from ever entering
`latestCurrentObservationsByIdentity()`'s own detection map, so a recheck can never mint a second
candidate. `generateFareWatcherCandidates()` now evaluates each detection's matching recheck (when
one exists) through the unchanged `qualifyFareWatcherObservation()` — its pre-existing same-day
`'same-snapshot'` exclusion already correctly keeps the original detection out of the recheck's own
baseline with no new logic needed — while `toCandidate()` anchors `id`/`checkedDate` to the
original detection so candidate identity and lifecycle never drift just because verification
evidence moved. A new `verifiedObservation` field on `FareWatcherCandidate` carries the full
evaluated observation (fare, routing, baggage, priceNote) for a future publication surface to draw
from, since none exists yet — `route-watch-fare-trigger.ts` is confirmed to read only
`.qualification` and is unaffected. Verified against the real archive, not hardcoded:
manchester-islamabad now correctly reads £480 (£141/22.7% below its £621 median, still
`standout-candidate`), manchester-lahore £547 (£73/11.8% below £620, still `standout-candidate`),
london-heathrow-jeddah £361 (still `standout-candidate`), birmingham-amritsar £591 (still
`notable-drop`) — all four still qualify. Twelve new tests cover both price-movement directions
(rises-still-qualifies, rises-stops-qualifying, falls-further, same-price, unrelated recheck by
date/profile, multiple-rechecks-latest-wins, no-recheck-unchanged, orphan-recheck-never-a-
candidate). Two pre-existing tests that had hardcoded the stale-detection bug's own values
(`fare-watcher-candidate-supersession`'s real-archive regression, `weekly-fare-observation-
20260825`) were updated to the corrected values — same test-maintenance pattern as PR #178/#183.
Full Vitest (134 files / 2,733 tests), `tsc --noEmit`, `next lint` and `next build` all pass.

*Update 7 October 2026: this approval retired automatically on 1 September 2026 when a newer routine observation became the current detection (expected lifecycle behaviour, `STANDOUT-ISB-001`); no Standout Fare is currently live. The text below is the dated record of the 25 August launch.*

**First Public Standout Fare Pilot (25 Aug 2026, founder-approved, PR #185, MERGED — LIVE on
production at `14bfdb9`):**
manchester-islamabad only — JetStash's first customer-facing Fare Watcher surface. Deliberately
does NOT add a new route-page section: `components/route/fare-signal.tsx`'s existing "Fare
spotted" eyebrow becomes "Standout Fare" plus two short evidence lines ("£141 below JetStash's
comparable tracked median of £621." and a verbatim baggage caveat) only when the fare Fare Signal
is already showing IS the exact founder-approved verified evidence — added footprint measured at
~94px mobile (390×844) / ~55px desktop (1440×900), against a ~689px/458px Fare Signal section and
an ~13,450px/8,476px page, with Journey Choice's position, the first CTA's position and the
existing Trip.com handoff/disclosure all unchanged. New small auditable founder-approval ledger
(`data/standout-fare-approvals.ts`, one record) plus its pure derivation
(`lib/standout-fare.ts`'s `getApprovedStandoutFare()`) — never a CMS. Fail-closed on four
independent conditions checked in order: an unrevoked approval exists; Fare Watcher currently
produces a candidate anchored to the approval's exact detection observation; that candidate isn't
expired under Fare Watcher's OWN existing `isFareWatcherCandidateExpired` rule (no new expiry
window invented); the candidate's current `verifiedObservation.id` still exactly matches the
approval's `approvedVerifiedObservationId` — a later recheck at ANY price, even one that would
still qualify, mints a new observation id and makes the Standout state disappear until a human
re-approves, so founder approval of £480 is never silently carried forward onto unreviewed
evidence. Reuses the existing `tripcom_click` event with a conditional `source` value
(`fare-signal-standout` vs `fare-signal`) rather than adding a new analytics surface. MAN-LHE
(£547), LHR-JED (£361) and BHX-ATQ (£591) confirmed to remain ordinary Fare Signals — no generic
public listing page, no incidental approval via shared route logic. Journey Choice's frozen
£601/£621/£626 pilot and its window-reconciliation sentence are unaffected (read from, never
modified); the Trip.com affiliate URL/IDs for manchester-islamabad are unchanged. 19 new tests in
`tests/standout-fare.test.ts` cover all 17 founder-required cases (exact-evidence rendering, median/
diff derivation, baggage safety, all three other candidates staying unpublished, four independent
fail-closed scenarios, Journey Choice/reconciliation/affiliate-ID non-regression, no banned-word or
baggage-included claim) plus two defense-in-depth cases. Three pre-existing tests
(`fare-signal.test.ts`, `fare-signal-route-vs-fare-clarity.test.ts`, `booking-providers.test.ts`)
had asserted the narrower pre-pilot invariant "this component never mentions baggage as a fact at
all" / a literal `source: 'fare-signal'` — updated to the still-binding rule (no fabricated
figure, no inclusion/£0 claim) now that one evidence-safe baggage line legitimately exists. Full
Vitest (135 files / 2,752 tests), `tsc --noEmit`, `next lint` and `next build` all pass. Verified
live on `jetstash.co.uk` post-merge (not preview): manchester-islamabad renders exactly £480 /
Riyadh Air / Economy / checked 25 August 2026 / connecting via RUH / 20 Oct–3 Nov / "£141 below
JetStash's comparable tracked median of £621." / the baggage caveat / the unchanged Trip.com CTA,
disclosure and fresh-search note; Journey Choice still shows £601/£621/£626 and "£25 more saves
14h 15m", with the reconciliation sentence distinguishing the two travel windows; manchester-lahore,
london-heathrow-jeddah and birmingham-amritsar confirmed to still render only "Fare spotted"; the
Google Ads conversion path (`lib/google-ads-conversions.ts`) confirmed to key only off the `event`
string, never the new conditional `source` property, so `fireGoogleAdsConversion` is unaffected by
this pilot.

*Update 7 October 2026: the pilot Standout Fare is no longer live (retired automatically 1 September; see the Fare Watcher / Standout Fare status bullet above). The freeze below is unchanged.*

**FARE WATCHER PHASE 1 — CUSTOMER-FACING PILOT LIVE. WAIT FOR REAL TRAFFIC (25 Aug 2026, founder
decision).** The full lifecycle the founder wanted before touching the public product is now real,
not theoretical: detected → independently rechecked → verified evidence → founder approval →
public Standout Fare → fail-closed approval contract. Deliberate freeze on further Fare Watcher
work until this pilot has collected real traffic — see "Do not reopen without new evidence" below
for the explicit scope. The open commercial question is simple: do travellers notice the Standout
Fare and click through (MAN→ISB route visit → Standout Fare exposure → Fare Signal Trip.com click
with `source: fare-signal-standout` → Trip.com attributed click → booking/commission)? A known
measurement blind spot exists in the middle of that funnel (the current Vercel plan previously
blocked reading custom-event detail) — deliberately not being built around tonight; JetStash's
active development attention moves to whatever can materially improve traffic or commercial
coverage instead.

## NEXT

### FUNNEL-001 — Weekly Commercial Funnel reconciliation (methodology built, 10 Sept 2026)

`docs/project-control/commercial-funnel/` now exists: a manually-populated weekly reconciliation
(README + reusable template + `lib/commercial-funnel.ts`'s fail-closed rate engine, tested) for the
VISITORS → USEFUL INTERACTION → PARTNER CTA CLICK → VALIDATED BOOKING → COMMISSION → FOUNDER EFFORT
loop referenced above (line ~855) and in "Current first-revenue bottleneck: NOT YET PROVEN." No new
analytics infrastructure — every figure is a manual dashboard read, tagged ATTRIBUTED /
UNALLOCATED / NOT OBSERVABLE, never a fabricated proxy or a cross-scope rate. First week
(2026-09-03 to 2026-09-09) is populated but structural only — this session had no dashboard access,
so every cell is `NOT OBSERVABLE`; the schema is proven, not yet the commercial answer. Next actual
step is running a week with real Vercel/Trip.com dashboard access, not more tooling.

### FARE-001 — Begin building the editorial fare observation archive

Follow FARE_OBSERVATION_ARCHIVE.md: check the priority queue on a fixed editorial cadence and
append fresh observations. Every new observation must carry departure date, return date, cabin,
source, observation method, currency, baggage treatment and observed date. Never backfill a price
for a day that was not actually checked, and never create a fare merely to fill an empty state.

## QUEUED

- `CONV-001` — use real analytics to test homepage conversion hierarchy; no redesign based only on
  opinion. See `LAUNCH_CHECKLIST.md` item F — this is also the paid-advertising analytics blocker.
- `ARR-001` — Arrive By full-journey V1 is LIVE as a limited beta and FROZEN for feature work (see "Arrive By:
  live limited beta and feature freeze, 3 October 2026"). Reopen only on real beta evidence.
- The full `LAUNCH_CHECKLIST.md` queue (items A–J) — organic-launch hardening, paid-advertising
  readiness and post-launch housekeeping, in the order agreed with the founder on 29 July 2026.

## Do not reopen without new evidence

- The July 2026 operational form/email audit (superseded by the 29 July re-verification above,
  itself not to be repeated wholesale without a relevant change).
- Verification-pending route leakage.
- Birmingham-to-Mumbai route creation.
- Direct-route WhatsApp punctuation.
- Route Status V1 foundation, presentation and date formatting.
- The Route Atlas homepage integration (PR #27–#30, #34) — confirmed complete, interactive and
  live; do not treat as a prototype or as uncertain.
- July trust-crack fixes from the live-site audit.
- Ledger-driven homepage flagship showcase/advisory presentation.
- Founder Dashboard production protection.
- Airport visual collection.
- Destination photography.
- The page-hero visual collection (PR #31).
- Contact, Quote Request and Newsletter delivery (re-verified live 29 July 2026).
- The editorial fare observation methodology (do not redesign the schema or profile rules —
  reopen only if the methodology itself proves unworkable in practice, not to skip it).
- The Visual Identity System v2 documentation structure (do not restructure again without new
  evidence the four-part split isn't working — populating the Placeholder/Planned assets it
  already tracks is not a reason to reopen it).
- **Fare Watcher / Standout Fare (25 Aug 2026 founder freeze)** — do not build a second Standout
  Fare, a Standout Fare listing page, homepage promotion, new Fare Watcher UI, threshold changes,
  further Journey Choice work, or additional analytics beyond the existing `tripcom_click` `source`
  distinction, until the live manchester-islamabad pilot has collected real traffic and the founder
  reopens this with that evidence. The engine itself (`lib/fare-watcher.ts`, `lib/standout-fare.ts`)
  is correct and complete for this phase — the open question is customer behaviour, not more
  internal engineering.

## Known risks

- The editorial fare archive is at its starting point; it must grow through real dated checks, not
  retrospective estimates or automated scraping — see `LAUNCH_CHECKLIST.md` item G.
- Trip.com is a single booking-partner dependency. 25 of 88 routes have no
  booking CTA at all, by design — see AFF-001 above. Do not add a partner or route link without
  dashboard verification and direct validation; never guess or hand-edit a Trip.com URL.
- Travel Ready rules and Route Status evidence require scheduled re-verification as source facts
  change.
- Homepage conversion quality cannot be claimed from visual review alone; it requires real funnel
  data — see `LAUNCH_CHECKLIST.md` item F.
- **Corrected 16 August 2026** — the previous claim here ("no CSP/X-Frame-Options/... headers are
  set") is stale and was wrong even before this correction relative to the code: `next.config.js`
  sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy:
  strict-origin-when-cross-origin` on every route. What remains genuinely open: the
  Content-Security-Policy is still `Content-Security-Policy-Report-Only` (`CSP_REPORT_ONLY` in
  `next.config.js`), never promoted to enforced — deliberately, per its own header comment
  ("observe real violations before enforcing"), but that comment predates Google Ads. **The current
  CSP value (`script-src 'self'`, `connect-src 'self'`) would break Google Ads' gtag script
  (loaded in `app/layout.tsx`) if enforced as-is** — any future move to enforce it must first add
  the correct Google Ads domains to the allowlist, verified against live tracking, not just flipped
  on. `npm audit` still reports the same 3 high-severity transitive advisories (PostCSS, sharp, via
  `next`), re-checked 16 August 2026 — see `LAUNCH_CHECKLIST.md` items A and D. Do not run `npm
  audit fix --force`; it downgrades Next.js.
- No Terms & Conditions page exists — see `LAUNCH_CHECKLIST.md` item B.
- `fix/trust-cracks-july` and `fix/verification-pending-leakage` are confirmed-safe-to-delete local
  branches (verified 29 July 2026: no content in either is missing from `main`) — see
  `LAUNCH_CHECKLIST.md` item I.
- **Pre-existing hydration warning in the Atlas's `<style>` block** (found during Route Coverage
  Truth Phase 1 visual QA, 6 August 2026; not fixed as part of that phase — unrelated to the Atlas
  status work, and out of scope to touch in that PR). **Component/file:**
  `components/founder/atlas-feel-test.tsx`, the `<style>{`...`}</style>` block (~line 983) that
  inlines the Atlas's breathing/pulse keyframe animations as a template-string text child.
  **Exact warning:** `Warning: Text content did not match. Server: "%s" Client: "%s"` followed by
  `Error: Text content does not match server-rendered HTML` /
  `https://nextjs.org/docs/messages/react-hydration-error`. **Reproduces in production, not just
  dev** — confirmed via a local `next build` + `next start`: the same mismatch surfaces as minified
  React errors #418/#423/#425 in the browser console. **Root cause:** the CSS comment inside the
  template string contains an apostrophe and quote marks (`"the selected country's own..."`,
  `"...same "alive" feeling..."`); React's server renderer HTML-escapes a plain-text child of
  `<style>` (`'` → `&#x27;`, `"` → `&quot;`) as if it were ordinary text content, but browsers parse
  `<style>` content as raw CDATA and never decode those entities — so the live DOM keeps the
  escaped entities while client-side hydration expects the raw characters, and React logs a
  mismatch and replaces the node. **Proposed fix:** render the block as
  `<style dangerouslySetInnerHTML={{ __html: cssString }} />` instead of
  `<style>{cssString}</style>` — `dangerouslySetInnerHTML` sets `innerHTML` directly on both server
  and client, bypassing React's text-escaping entirely, which is the standard fix for this exact
  class of bug. **Required regression test:** assert the `<style>` tag uses
  `dangerouslySetInnerHTML` (not a JSX text-child expression) so this can't silently regress, plus
  a live check (via a rendered snapshot or the existing Atlas test suite) that no hydration warning
  fires on initial homepage load. Not yet scheduled to a specific work item — pick up alongside the
  next Atlas-touching PR rather than as a standalone one-line change, since it touches the same
  file Route Coverage Truth Phase 2 batches will likely revisit.
