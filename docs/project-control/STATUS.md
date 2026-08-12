# JetStash Current Status

**Last reconciled:** 29 July 2026

**Production branch:** `main`

**Application release baseline:** `8b1de036a51e3ec41f03a832ed89327f99428052`

**Launch readiness:** see `LAUNCH_READINESS_AUDIT_2026-07-29.md` and `LAUNCH_CHECKLIST.md` — ready
for public organic launch after a short hardening pass; paid advertising remains blocked until
analytics/conversion events are verified in the real dashboard.

**Production site:** `https://jetstash.co.uk`

## Current truth

- Route Status V1 is shipped and live.
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
  28 of 37 routes carry a genuine, dashboard-generated, dateless Trip.com affiliate link
  (`lib/booking-providers.ts`); the 9 London-origin routes (Heathrow/Gatwick) have no booking CTA at
  all, by design, since Trip.com's own tools cannot produce an airport-specific dateless link for
  them and no generic fallback is used. New partner integrations remain disabled until they have
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
active provider: 28 of 37 routes carry a genuine, dashboard-generated, dateless Trip.com affiliate
link (`lib/booking-providers.ts`), each the exact unedited output of Trip.com's own Affiliate Link
dashboard tool. The 9 London-origin routes (all Heathrow/Gatwick) have no booking CTA — Trip.com's
tools cannot produce an airport-specific dateless link for Heathrow or Gatwick, only a generic
"London" (LON) option, which is deliberately not used per JetStash's fail-closed rule: an exact
airport-specific link, or no CTA at all. Expedia and other potential partners must remain unenabled
until JetStash has approval, a genuine tracking link and a scoped validation of the customer
journey.

### COV-001 — Build verified route coverage deliberately

Route coverage now has a durable operating queue in `ROUTE_COVERAGE.md`. The 28 July pass resolved
the qualifying direct-service records for Heathrow–Delhi, Manchester–Dubai, Heathrow–Doha,
Manchester–Doha, Glasgow–Dubai, Edinburgh–Dubai, Newcastle–Dubai, Gatwick–Ahmedabad and
Gatwick–Amritsar, and corrected Birmingham–Amritsar to connecting using current Air India
evidence. Manchester–Karachi, Birmingham–Lahore and Birmingham–Islamabad remain explicitly
unresolved PIA disputes because no current route-specific primary source supports either outcome.
Each cycle must add independently sourced service evidence or a date-complete fare observation;
never fill a route simply to remove a pending state.

The first evidence-bounded Turkey route-guide pilot is prepared for founder review across Manchester–Istanbul,
Manchester–Dalaman, Manchester–Bodrum, Manchester–Antalya and Manchester–Izmir. Antalya publishes seasonal direct-service
context with varying published timings; Izmir publishes SunExpress's seasonal programme and Manchester
Airport's planning figure without a fixed weekly frequency. All five preserve their exact Trip.com
handoffs and publish no fares or unsupported booking claims.

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

## Known risks

- The editorial fare archive is at its starting point; it must grow through real dated checks, not
  retrospective estimates or automated scraping — see `LAUNCH_CHECKLIST.md` item G.
- Trip.com is a single booking-partner dependency. 9 of 37 routes (all London-origin) have no
  booking CTA at all, by design — see AFF-001 above. Do not add a partner or route link without
  dashboard verification and direct validation; never guess or hand-edit a Trip.com URL.
- Travel Ready rules and Route Status evidence require scheduled re-verification as source facts
  change.
- Homepage conversion quality cannot be claimed from visual review alone; it requires real funnel
  data — see `LAUNCH_CHECKLIST.md` item F.
- No CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy headers are set, and `npm audit`
  reports 3 high-severity transitive advisories (PostCSS, sharp, via `next`) — see
  `LAUNCH_CHECKLIST.md` items A and D. Do not run `npm audit fix --force`; it downgrades Next.js.
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
