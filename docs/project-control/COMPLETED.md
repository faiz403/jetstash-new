# JetStash Completed Work Ledger

This file is append-only. A task listed here is `DONE` and should not be proposed again unless new
evidence shows a regression, changed requirement or stale external fact.

## July 2026

| ID | Completed work | Evidence | Production state |
|---|---|---|---|
| `TRUTH-001` | Rebuilt the public homepage around “Before you book, get a second opinion.” | Repository verified: commits through `61c616b` | Live |
| `SEC-001` | Upgraded Next.js to the reviewed patched `15.5.21` maintenance release. | Repository verified: `c81a6bc`, merged through PR #2 | Live |
| `TRUTH-002` | Prevented verification-pending route facts leaking across public route, deal, airport, destination and metadata surfaces. | Repository verified: `8b080f6`, merged through PR #2 | Live |
| `ROUTE-001` | Added the Birmingham-to-Mumbai connecting-route guide using primary-source evidence and no invented fares, airlines or frequencies. | Repository verified: `608db7c`, merged through PR #2 | Live |
| `TRUTH-003` | Kept destination guidance and airport notes off route pages; aligned fare-empty states and Route Watch language with the data and actual manual workflow. | Repository verified: `6f6f98e` and `5e09453`, merged through PR #2 | Live |
| `SHARE-001` | Removed duplicated “direct” wording and nested parentheses from direct-route WhatsApp share text. | Repository verified: `3d3adbb`, merged through PR #3 | Live |
| `STATUS-001` | Added the append-only, evidence-backed Route Status V1 ledger and fail-closed derivation. | Repository verified: `2bd97c2`, merged through PR #4 | Live |
| `STATUS-002` | Shipped Route Status presentation across the homepage and route surfaces, ISR coverage, evidence validation and airline suppression. | Repository verified: `c48f387`, merged through PR #4 | Live |
| `STATUS-003` | Standardised customer-facing Route Status dates in UK long-form and added regression coverage. | Repository verified: `7eee01d`, merged through PR #4 | Live |
| `VIS-001A` | Added the dark Manchester-to-Mumbai homepage journey visual and pull interaction. | Repository verified: `63a1515`, merged through PR #5 at `498f980` | Live |
| `VIS-002` | Added the consistent, dark editorial Guide image collection across all nine guide pages. | Repository verified: `c825dd9` and `5fb2d5d`, merged through PR #10 at `0c3bffe` | Live |
| `READY-001` | Built and shipped Travel Ready Check with official-source rules, freshness dates and honest unsupported-combination behaviour. | Repository and production verified; see `JETSTASH_PRINCIPLES.md` §14.3 | Live |
| `WATCH-001` | Connected Travel Club and Route Watch to Brevo, created the required attributes and live-tested signup storage. | Repository verified in `README.md`; production test recorded there | Live |
| `LEADS-001` | Connected quote-request and contact routes to the real inbox workflow. | Repository verified in `README.md` | Live |
| `OPS-001` | Completed the production operational verification of the customer submission flows. | Founder confirmed on 24 July 2026. Durable per-flow evidence was not added to this ledger. | Treat as complete; re-test only after a relevant change |
| `FOUNDER-001` | Protected the Founder Dashboard from production access and indexing. | Production verified: `/founder` returned HTTP 404; source gating and robots rules reviewed | Live |
| `PHOTO-001` | Completed destination photography using the JetStash Signature Collection direction. | Founder confirmed | Live |
| `PC-001` | Added permanent project-control status, completed, roadmap and decision records and made them mandatory reading for future agents. | Repository and production verified: PR #6, merge `4dae272` | Live |
| `DOC-001` | Reconciled the three core documents with Next.js `15.5.21`, the current Vitest suite, Route Status ownership, homepage ISR architecture and the automatic Vercel workflow. | Repository verified; 439/439 tests passed across 16 files on 24 July 2026 | Live |
| `TRC-001` | Improved Travel Ready Check discoverability through contextual links in document and visa surfaces, the homepage, footer and sitemap, without main-navigation clutter. | Repository verified: `db12797`, `fa7734b`, `072c041`; 457/457 tests passed and Vercel Preview succeeded | Live |
| `BRAND-001` | Repositioned JetStash as UK travel intelligence for international journeys, while retaining South Asia and Gulf route depth as explicit specialist coverage. | Repository verified: `05f47d6`; 475/475 tests passed, Vercel Preview and production smoke tests succeeded | Live: merged through PR #12 at `24fc761` |
| `GUIDE-001` | Made the Guides hub visually discoverable with a compact editorial hero and image-led guide cards, preserving the international positioning copy. | Repository verified: `ccd12ca`, `feb579d`, `d021a95`; 480/480 tests passed, Vercel Preview and production smoke tests succeeded | Live: merged through PR #13 at `68d4cd2` |
| `TRUTH-004` | Closed the July live-site trust cracks: removed duplicated SEO titles, stopped deal cards borrowing airport-specific durations from generic destination data, and replaced destination schedule claims with neutral airport-specific guidance. | Repository verified: PR #20, merge `53504e0`; 531/531 tests passed, production build and live smoke checks succeeded | Live |
| `STATUS-004` | Made the homepage flagship choose a cinematic showcase or immediate advisory state from the shared Route Status ledger, with editorial route selection kept separate from operational facts. | Repository verified: PR #20, merge `53504e0`; 531/531 tests passed, Vercel Production deployment Ready | Live |
| `FARE-METHOD-001` | Finalized the editorial fare observation methodology: versioned per-route observation profiles, a fixed 8-week booking horizon (grounded in existing routes' own stated booking-window guidance, not invented), GBP-only policy, and required `observedVia`/`profileId`/`observationReason` fields on new `FareObservation` records. The first five editorial observations are now logged under the active `FARE-001` archive; the series remains ongoing. | Repository verified: PR #22, merge `0d87436`; methodology and first batch verified locally on 28 July 2026 | Live |
| `DOC-002` | Restructured `docs/visual-identity.md` from a photography-only guide into a four-part visual design system (Visual Principles, Editorial Photography, Interactive Visual Systems, Asset Catalogue) with Lifecycle status per entry, a Design Decisions appendix, a documentation audit, and a new `VISUAL_REVIEW_CHECKLIST.md`. Documentation structure only — the audit it introduced found 10 of 15 hero briefs and 10 of 11 UK airports still unphotographed (`VIS-001`, unaffected, still active). | Repository verified: PR #23, merge `943a00b`; 531/531 tests passed, typecheck/lint/build clean | Live |
| `VIS-001` | Completed the UK airport visual collection: added the remaining 10 airport-specific 1672×941 WebP files (Birmingham, Birmingham-East-Midlands, Bristol, Edinburgh, Glasgow, Leeds Bradford, Liverpool, Gatwick, Heathrow, plus manifest regeneration), closing the gap `DOC-002`'s audit identified. All 11 supported UK airports now have consistent, distinct generated artwork. | Repository verified: PR #25, merge `e234273` | Live |
| `ARR-SPEC-001` | Completed the evidence-gated `ARRIVE_BY_SPEC.md` specification for the future Arrive By flagship. Specification only — implementation remains deferred pending trustworthy schedule and ground-transport data (`ARR-001`, still deferred). | Repository verified: PR #26, merge `2a70241` | Live (spec only) |
| `ATLAS-001` | Replaced the Manchester-to-Mumbai pull-brief homepage hero with the Route Atlas: an interactive, real-geography network map across UK airports and destinations, drawing on two separate evidence layers (`data/routes.ts` Route Status and the new `data/network-evidence.ts`), wired into the public homepage via `journey-desk-home.tsx`. The pull-brief hero and its supporting code (`lib/homepage-flagship.ts`, `lib/flagship-status-copy.ts`, `pull-brief*.tsx`) remain in the repository with zero live imports — dead code pending cleanup, not a rollback risk. | Repository verified: PR #27, merge `f1387b4`; `homepage-atlas-integration.test.ts` added | Live |
| `ATLAS-002` | Mobile Atlas hardening: fixed mobile map visibility (PR #28), then resolved Gulf/Iberia country-halo crowding on the live production map across two follow-up merges (PR #29, #30). | Repository verified: PR #28 merge `136f670`, PR #29 merge `3b2490a`, PR #30 merge `25115b3` | Live |
| `HERO-001` | Added the UK page-hero visual collection: 10 new WebP hero images (about, airports, business-class, contact, deals, family-holidays, guides, quote-request, routes, travel-club), wired through the existing `getHeroBackdrop`/`HeroBackdrop` resolver — confirmed live via manifest and call-site grep during the 29 July 2026 launch-readiness reconciliation; not yet individually visually spot-checked page by page. | Repository verified: PR #31, merge `f004148` | Live (wiring confirmed; full visual spot-check outstanding) |
| `JCF-001` | Added the Journey Check Form: a fast path on the homepage for a visitor who already knows their route, standing alongside the Atlas's browse/discovery experience — every combination resolves to a real route or destination page, never a dead end. | Repository verified: PR #32, merge `7919090`; `homepage-journey-check-form.test.ts` added | Live |
| `DIFF-001` | Added the "JetStash Difference" homepage section, stating the platform's differentiation reasoning explicitly rather than leaving it implicit in the Atlas alone. | Repository verified: PR #33, merge `5523f0f`; `homepage-why-jetstash.test.ts` added | Live |
| `ATLAS-003` | Improved mobile Atlas chip density with confidence/status-colour dots on both country and destination chip rows, and removed the redundant "Already know your journey?" heading from the Journey Check Form so it flows directly from the parent section's heading. | Repository verified: PR #34, merge `3c0e67e` | Live |
| `NEWS-001` | Fixed the newsletter signup form to surface the real API error message instead of a hardcoded generic message on failure — found during the 29 July 2026 fresh operational re-verification of Contact, Quote Request and Newsletter delivery (not merely re-asserted from the 24 July confirmation). | Repository verified: PR #35, merge `8b1de03` | Live |
| `HERO-002` | Added a compact opening hero above the Route Atlas — eyebrow, headline, body, two CTAs, a three-point "why JetStash is different" proof strip and a commercial-model line — raised from a real mobile review on a Samsung Galaxy Z Fold 7. Reuses the shared `PageHero` component and the existing `heroes/routes.webp` asset; no new image, no Atlas redesign. A same-day follow-up (PR #43's amendment) fixed a CTA anchor-scroll overshoot (both targets were landing ~192px below the header instead of a small gap — the new hero's `scroll-mt-24` had stacked on top of an existing global `scroll-padding-top`) and a short-viewport (320×720) content-cutoff, verified with real Playwright/Chromium screenshots and interaction tests both locally and against production. | Repository verified: PR #43, merge `a961e73`; follow-up amendment in the same PR | Live |

## August 2026

| ID | Completed work | Evidence | Production state |
|---|---|---|---|
| `FARE-BATCH-A-001` | Fare Coverage Expansion Batch A: 10 new dated, evidence-backed fare observations across priority routes, plus a founder-requested evidence-completeness and customer-visibility audit that corrected 8 observations' `fareDirectness` to `'unknown'` (only the outbound leg had actually been reviewed) and added 7 new `Deal` entries so the new evidence actually renders as a price. | `docs/project-control/BATCH_A_COMPLETION_REVIEW.md`, `FARE_OBSERVATION_ARCHIVE.md`, PR #76, merge `4a5134f` | Live |
| `RIS-001` | Route Intelligence Scoring v2: added two further, independent gates (category diversity; a visible-content baseline) to `computeRouteIntelligenceLevel()`'s unchanged 2-of-6 breadth requirement, closing the exact loophole Batch A's audit found (a route reaching "Strong" on `connectingAlternative` + a single fare check alone). 5 routes moved Strong→Useful, 4 country aggregates followed; zero manual overrides. | `ROUTE_COVERAGE_AUDIT.md`'s "Route Intelligence Scoring v2 (RIS-001)" addendum, PR #77, merge `8b1d18d` | Live |
| `FARE-BATCH-B-001` | Fare Coverage Expansion Batch B: 10 new dated, evidence-backed fare observations for previously-untracked routes (queue derived live from the real data, excluding 6 `unverified` routes that could never become publishable), plus 8 new `Deal` entries. Publishable coverage moved 13→23 of 32; customer-visible coverage moved 12→22. Mechanically upgraded 3 routes and 2 country aggregates under the unchanged RIS-001 model. | `docs/project-control/FARE_COVERAGE_BATCH_B.md`, `FARE_OBSERVATION_ARCHIVE.md`, `ROUTE_COVERAGE_AUDIT.md`'s Batch B addendum | PR pending review, not yet merged |

## Launch readiness

| ID | Completed work | Evidence | Production state |
|---|---|---|---|
| `AUDIT-001` | Completed a full pre-launch readiness audit — 18 scored categories, complete findings register, minimum launch plan split by organic vs. paid readiness, ordered fix queue, and a verification appendix distinguishing verified-live evidence from explicitly unverified/access-gated items. Founder-reviewed and accepted 29 July 2026; verdict READY FOR PUBLIC ORGANIC LAUNCH, not yet ready for paid advertising. | `docs/project-control/LAUNCH_READINESS_AUDIT_2026-07-29.md`, `LAUNCH_CHECKLIST.md` | Draft reviewed; queue not yet executed |

## Earlier foundations retained

- Custom Next.js platform replaced the GoDaddy Airo site.
- Signature Collection replaced generic stock photography.
- Journey Brief evolved from the original travel-guide concept.
- Travel Ready Check evolved from the original document-checker concept.
- The Manchester route experience evolved from the original simple airport-list concept.

## Re-verification rule

Completion does not make changing external facts permanently true. The following must be rechecked
when due even though the underlying feature is complete:

- airline schedules and service-status evidence;
- passport and visa rules;
- fare observations;
- affiliate destinations and deep links; and
- external provider credentials or attributes after an account/configuration change.
