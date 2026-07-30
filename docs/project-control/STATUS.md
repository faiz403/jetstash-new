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
- TravelUp's CJ tracking link and directly verified destination deep links are live. New partner
  integrations remain disabled until they have explicit approval, a real tracking link and direct
  journey validation.
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
  `FareObservation`). The first five editorial observations were logged on 28 July 2026; the
  archive remains an active series and must grow through fresh dated checks.
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
real, reproducible problem. See `SOFT_LAUNCH_PACK_2026-07-30.md` for the six selected routes
(Manchester–Lahore, Manchester–Islamabad, Heathrow–Delhi, Heathrow–Mumbai, Manchester–Dubai,
Heathrow–Jeddah — each chosen for having both logged fare evidence and a verified TravelUp deep
link today), tracked-link convention, per-audience message drafts, FAQ, feedback template and the
seven-day plan. Draft only as of this entry — nothing sent yet; sending is the founder's own
action, not something done from this repository.

### DEST-001 — First destination expansion: Heathrow → Bengaluru

An explicit founder decision, 30 July 2026, and an explicit exception to the LAUNCH-001 product
freeze — not a violation of it (real evidence-led feature work the founder specifically
commissioned, not speculative housekeeping). Adds Bengaluru as a destination and London
Heathrow–Bengaluru as its first route, integrated through every existing shared system (route
guide template, destination directory, Route Atlas, Journey Check, Travel Ready Check, sitemap) —
no new system built. Direct service verified via Virgin Atlantic's own route page only; British
Airways and Air India could not be independently verified this session (their own sites were
unreachable to this session's tooling — see `ROUTE_COVERAGE.md`) and are not named. No approved
Bengaluru hero image exists yet — see `docs/visual-identity.md`'s Asset Catalogue and the PR for
the exact release-blocker statement. No fare observation logged; none could be honestly recorded
without a real, dated check. See PR for full detail.

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

The methodology is finalized (see "Current truth" above) and the first five-observation batch is
logged. A human may record a fare observed on Google Flights, TravelUp or an airline booking page, provided
the source, check date, outbound date, return date, cabin, currency and baggage treatment are
captured, against a fixed 8-week booking horizon. Google Flights is an observation source only:
service facts still require primary airline, airport or official sources. Historic incomplete
entries remain private; a past price cannot be reconstructed honestly after the fact.

### AFF-001 — Improve affiliate coverage

The current partner state is reconciled: TravelUp is the only live provider, with a real CJ
tracking link and directly verified destination deep links. Expedia and other potential partners
must remain unenabled until JetStash has approval, a genuine tracking link and a scoped validation
of the customer journey.

### COV-001 — Build verified route coverage deliberately

Route coverage now has a durable operating queue in `ROUTE_COVERAGE.md`. The 28 July pass resolved
the qualifying direct-service records for Heathrow–Delhi, Manchester–Dubai, Heathrow–Doha,
Manchester–Doha, Glasgow–Dubai, Edinburgh–Dubai, Newcastle–Dubai, Gatwick–Ahmedabad and
Gatwick–Amritsar, and corrected Birmingham–Amritsar to connecting using current Air India
evidence. Manchester–Karachi, Birmingham–Lahore and Birmingham–Islamabad remain explicitly
unresolved PIA disputes because no current route-specific primary source supports either outcome.
Each cycle must add independently sourced service evidence or a date-complete fare observation;
never fill a route simply to remove a pending state.

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
- TravelUp is a single booking-partner dependency. Recheck verified destination pages periodically;
  do not add a partner or deep link without approval and direct validation. The Madinah route has
  fare data but no verified deep link yet — see `LAUNCH_CHECKLIST.md` item C.
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
