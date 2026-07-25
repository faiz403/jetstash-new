# JetStash Current Status

**Last reconciled:** 25 July 2026

**Production branch:** `main`

**Application release baseline:** `50e6c6d40b92d8c3f201814a12340160351d70bd`

**Production site:** `https://jetstash.co.uk`

## Current truth

- Route Status V1 is shipped and live.
- The Manchester-to-Mumbai homepage visual is shipped and live.
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
- Operational submission flows were founder-confirmed as already tested; do not repeat the entire
  audit unless a relevant API route, environment variable or provider configuration changes.
- Destination photography is founder-confirmed complete.
- Permanent project-control records are linked from `CLAUDE.md` and `README.md`.
- `CLAUDE.md`, `README.md` and `JETSTASH_PRINCIPLES.md` reflect Next.js `15.5.21`, the current
  Vitest suite, Route Status ownership, homepage architecture and automatic Vercel deployment.

## ACTIVE

### FARE-001 — Begin building the editorial fare observation archive

The archive is now being built editorially. A human may record a fare observed on Google Flights,
TravelUp or an airline booking page, provided the source, check date, outbound date, return date,
cabin, currency and baggage treatment are captured. Google Flights is an observation source only:
service facts still require primary airline, airport or official sources. Historic incomplete
entries remain private; a past price cannot be reconstructed honestly after the fact.

### AFF-001 — Improve affiliate coverage

The current partner state is reconciled: TravelUp is the only live provider, with a real CJ
tracking link and directly verified destination deep links. Expedia and other potential partners
must remain unenabled until JetStash has approval, a genuine tracking link and a scoped validation
of the customer journey.

### COV-001 — Build verified route coverage deliberately

Route coverage now has a durable operating queue in `ROUTE_COVERAGE.md`. It starts from the five
existing Book By priority routes and known trust risks, rather than inventing a demand ranking
without analytics. Each cycle must add independently sourced service evidence or a date-complete
fare observation; never fill a route simply to remove a pending state.

## NEXT

### FARE-001 — Begin building the editorial fare observation archive

Follow FARE_OBSERVATION_ARCHIVE.md: check the priority queue on a fixed editorial cadence and
append fresh observations. Every new observation must carry departure date, return date, cabin,
source, observation method, currency, baggage treatment and observed date. Never backfill a price
for a day that was not actually checked, and never create a fare merely to fill an empty state.

## QUEUED

- `VIS-001` — complete real, licensed premium photography for supported UK airports.
- `CONV-001` — use real analytics to test homepage conversion hierarchy; no redesign based only on
  opinion.
- `ARR-001` — research and specify Arrive By for urgent, deadline-critical travel without making
  unsupported schedule or arrival promises.

## Do not reopen without new evidence

- The July 2026 operational form/email audit.
- Verification-pending route leakage.
- Birmingham-to-Mumbai route creation.
- Direct-route WhatsApp punctuation.
- Route Status V1 foundation, presentation and date formatting.
- The Manchester-to-Mumbai homepage visual.
- July trust-crack fixes from the live-site audit.
- Ledger-driven homepage flagship showcase/advisory presentation.
- Founder Dashboard production protection.
- Destination photography.

## Known risks

- The editorial fare archive is at its starting point; it must grow through real dated checks, not
  retrospective estimates or automated scraping.
- TravelUp is a single booking-partner dependency. Recheck verified destination pages periodically;
  do not add a partner or deep link without approval and direct validation.
- Travel Ready rules and Route Status evidence require scheduled re-verification as source facts
  change.
- Homepage conversion quality cannot be claimed from visual review alone; it requires real funnel
  data.
