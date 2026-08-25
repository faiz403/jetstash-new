# JetStash Current Status

**Last reconciled:** 21 August 2026 (Big Review Clean-up Batch 1)

**Production branch:** `main`

**Application release baseline:** `65db09cf39cd8d09e51b458d86a8947351c5edff` (PR #161 merge —
Participant 1 defect follow-up; PR #160 — Birmingham–Islamabad stale booking-window copy fix; PR
#159 — COV-001 4-route reclassification; PR #156 — Route Page Scanability fix; PR #155 — Route Page
Journey Clarity System). **Known gap in this ledger:** PRs #137–#151 (18–19 August 2026:
route-verification batches, weekly fare refresh, standout-candidate verification, fare-note jargon
fix, route-verification review visibility) shipped and are live in production, but are not
individually reconciled into this document — the 21 August reconciliation passes have covered
#152–#161 (this pass closes #159–#161; a prior 21 August pass closed #152–#156; #157 was itself a
reconciliation PR; #158 created the validation procedure this pass now records the outcome of). Do
not assume everything between PR #136 and #152 is undocumented-because-unimportant; it is
undocumented-because-not-yet-reconciled. A future pass should close that specific gap rather than
re-deriving it from git history each time.

**Launch readiness:** see `LAUNCH_READINESS_AUDIT_2026-07-29.md` and `LAUNCH_CHECKLIST.md` — ready
for public organic launch after a short hardening pass; paid advertising remains blocked until
analytics/conversion events are verified in the real dashboard.

**Production site:** `https://jetstash.co.uk`

## Current truth

- **Route page simplification Phase 1 — fare reconciliation + unified fail-closed copy (OPEN PR,
  NOT MERGED, refreshed 25 August 2026 onto the post-#180 baseline):** implements only §20 of the
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
- **Fare Signal / fare-observation terminology, recounted 21 August 2026 (Big Review Clean-up
  Batch 1)** (see the canonical table below) — do not use "fare coverage" to mean more than one of
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

- **Curated `Deal` count is 49** (`data/deals.ts`) — a separate, smaller, hand-curated set of
  airport→destination+cabin combinations chosen for card display; distinct from, and much smaller
  than, the 81 routes that actually have fare evidence. Never conflate the two: a route can have a
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

## ACTIVE

### LAUNCH-001 — Seven-day controlled organic launch

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

### DEST-001 — First destination expansion: Heathrow → Bengaluru

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

### BD-001 — Bangladesh workstream: Dhaka and Sylhet

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

### HERO-002 — Homepage opening hero above the Route Atlas

**Done** — see `COMPLETED.md`. Customer-visible pre-launch priority, raised from a real mobile
review on a Samsung Galaxy Z Fold 7: the homepage previously opened directly with the Route Atlas,
asking a new visitor to understand the map before JetStash had explained what it is, why it
exists, how it differs from a comparison or affiliate site, and what to do next. Shipped a compact
premium hero (approved copy, reusing `PageHero` and the existing `heroes/routes.webp` asset) plus a
short "why JetStash is different" proof strip, both above the Atlas, which remains unchanged and
un-redesigned as the homepage's
signature feature immediately below.

### FARE-001 — Begin building the editorial fare observation archive

The methodology is finalized (see "Current truth" above); the first two five-observation batches
are logged, plus the 5 August 2026 Trip.com-sourced Doha/Madinah pair. A human may record a fare observed on Google Flights, Trip.com or an airline booking page, provided
the source, check date, outbound date, return date, cabin, currency and baggage treatment are
captured, against a fixed 8-week booking horizon. Google Flights is an observation source only:
service facts still require primary airline, airport or official sources. Historic incomplete
entries remain private; a past price cannot be reconstructed honestly after the fact.

### AFF-001 — Improve affiliate coverage

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

### COV-001 — Build verified route coverage deliberately

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

The first evidence-bounded Turkey route-guide pilot is prepared for founder review across Manchester–Istanbul,
Manchester–Dalaman, Manchester–Bodrum, Manchester–Antalya and Manchester–Izmir. Antalya publishes seasonal direct-service
context with varying published timings; Izmir publishes SunExpress's seasonal programme and Manchester
Airport's planning figure without a fixed weekly frequency. All five preserve their exact Trip.com
handoffs and publish no fares or unsupported booking claims.

The Birmingham Turkey route-guide batch is prepared for founder review across Birmingham–Istanbul,
Birmingham–Antalya, Birmingham–Dalaman and Birmingham–Bodrum. Birmingham Airport evidence supports
direct service for all four; Istanbul preserves the IST/SAW arrival distinction, Dalaman keeps its
approximate timing qualified, and Bodrum remains explicitly seasonal. All four preserve their exact
Trip.com handoffs and publish no fares, baggage claims or fixed frequency promises.

The Morocco route-guide batch is prepared for founder review across Manchester–Marrakech,
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

**Same-day verification-recheck representative priority (25 August 2026, founder-approved, OPEN
PR, NOT MERGED):** logic-only fix, no data appended. A deferred four-observation append (£480
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
of `generateFareWatcherCandidates()`'s actual output, not assumed. The real four-observation append
remains deferred pending this PR's review and merge; a synthetic four-fare simulation (test-only,
nothing written to `data/fare-observations.ts`) proves it will resolve correctly once merged.

**Fare Watcher verification recheck append (25 August 2026, founder-approved, OPEN PR, NOT
MERGED):** the deferred four-observation append is done — data-only, no logic changed. Four
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

**Fare Watcher verified-candidate price integrity (25 August 2026, founder-approved, OPEN PR, NOT
MERGED):** logic/tests-only fix, no fare data changed. The prior fix above corrected Fare
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

### FARE-001 — Begin building the editorial fare observation archive

Follow FARE_OBSERVATION_ARCHIVE.md: check the priority queue on a fixed editorial cadence and
append fresh observations. Every new observation must carry departure date, return date, cabin,
source, observation method, currency, baggage treatment and observed date. Never backfill a price
for a day that was not actually checked, and never create a fare merely to fill an empty state.

## QUEUED

- `CONV-001` — use real analytics to test homepage conversion hierarchy; no redesign based only on
  opinion. See `LAUNCH_CHECKLIST.md` item F — this is also the paid-advertising analytics blocker.
- `ARR-001` — specification complete in `ARRIVE_BY_SPEC.md`; implementation remains deferred until
  schedule and ground-transport sources can support honest estimates.
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
