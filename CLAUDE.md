# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Check project status before proposing work

Read `docs/project-control/STATUS.md`, `COMPLETED.md`, `ROADMAP.md` and `DECISIONS.md` before
starting or proposing a task. These files are the current authority for what is done, what comes
next and which ideas have been accepted or rejected. Do not repeat a task recorded as `DONE`
without new evidence of a regression or changed requirement. Update the tracker in the same PR
when meaningful work changes project status.

## What this is

JetStash is a Next.js `15.5.21` App Router travel-intelligence and lead-generation site for UK
travellers flying to Pakistan, India, the Gulf and Umrah, with supporting family-holiday and
business-class journeys. There is no database or CMS: editorial and travel facts live in typed
TypeScript modules under `/data`. Public content pages are pre-rendered; status-sensitive surfaces
use six-hour ISR so dated Route Status evidence can change without a code deployment.

## Keep JETSTASH_PRINCIPLES.md current

`JETSTASH_PRINCIPLES.md` (repo root) is the long-form handbook: architecture, content model,
design system, affiliate strategy, content-integrity rules, deployment process, and the reasoning
behind past decisions. Before any significant architectural change, check whether it needs
updating. If the change alters a long-term business decision, a coding standard, the affiliate
strategy, a design principle, or an architectural rule, update the relevant section of the handbook
**in the same PR** as the code change — not as a follow-up. Do **not** touch it for temporary
experiments, one-off content edits, or ordinary bug fixes; it documents standing decisions, not
day-to-day changes.

## Commands

```bash
npm install
npm run dev      # localhost:3000
npx tsc --noEmit # strict TypeScript check
npm run lint     # separate: next build does not run ESLint
npm test -- --run
npm run build    # production build and prerender/ISR verification
npm run start
```

The Vitest suite currently contains **439 tests across 16 files** (verified 24 July 2026). The
number will grow, so always run the suite rather than relying on this snapshot. For significant
application or data changes, the full quality gate is strict TypeScript, lint, Vitest and a
production build. `next.config.js` sets `eslint: { ignoreDuringBuilds: true }`, so a successful
build does not prove lint passed.

## Architecture

**Content model (`/data`)** — typed, cross-referenced data modules are the single source of truth.
The core customer-facing modules include:
- `data/airports.ts` — UK departure airports (`Airport`), keyed by `slug`.
- `data/destinations.ts` — destinations grouped by `RegionGroup` (`pakistan`, `india`, `gulf`, `mediterranean`, `north-africa`). Umrah destinations (Jeddah, Madinah) use `region: 'gulf'` — the `/umrah` hub page filters `regionGroups.umrah.destinationSlugs` (in `lib/site-config.ts`) rather than relying on a distinct region value. Each `Destination` optionally carries `familyVisitContent` for destinations where visiting relatives is a primary travel pattern.
- `data/deals.ts` — curation only (`Deal`): which airport→destination+cabin combos are worth featuring as a card, plus display metadata (city/country, airline, category tag). Deliberately carries no price field — see below.
- `data/fare-observations.ts` — the append-only fare history log (`FareObservation`) that's the *only* source of truth for prices shown on deal cards. `DealCard` derives an honest observed range (or a single logged check) from this via `getFareRangeSummary(routeSlug, cabin)`; when nothing has been logged yet for a route+cabin, the card falls back to non-perishable route facts instead of a price. Never overwrite an entry when a fare changes — append a new one with a later `observedDate` so the trend stays visible.
- `data/routes.ts` — specific airport→destination route guides (`Route`) and the pure
  `getRouteStatus()` derivation. Time-bound service facts come only from the append-only
  `data/route-status-events.ts` ledger, never from a field on `Route`.
- `lib/route-status-copy.ts` — evidence validation, `getRouteStatusCopy()` and the canonical
  `getEffectiveRoutePresentation()` adapter used by public surfaces.
- `Route.connectingAlternative` — separate editorial fallback guidance; it is never inferred from
  a Route Status event.

Use exported lookup helpers (e.g. `getRoutesByDestination`, `getDealsByRegionGroup`,
`getAirportBySlug`) instead of filtering raw arrays inline.

**Public homepage** (`app/page.tsx` + `components/homepage-v2/`) — the pre-booking second opinion,
not a flight-search homepage. `JourneyDeskHome` owns the composition. Its featured
Manchester→Mumbai proof uses the pull interaction and three-stage photography
(Manchester → journey composite → Mumbai), while `lib/flagship-status-copy.ts` maps the same
validated Route Status view model into homepage copy. Do not derive a second status narrative
inside a component.

**Book-By Countdown** (`lib/booking-intelligence.ts`) — the hero feature: festival-anchored booking guidance ("book by 14 February") for five priority routes only (`BOOK_BY_PRIORITY_ROUTE_SLUGS` in that file). It's the *only* place that computes a booking state or book-by date — every surface (`components/route/book-by-countdown.tsx`, `booking-moment-strip.tsx`, `next-travel-moment-ribbon.tsx`, the route-map's brass indicator) calls into it rather than deriving dates itself. Dates come from `data/peak-period-dates.ts` (verified, precision-tagged — Islamic dates are astronomical estimates and every render keeps that visible) and `data/booking-windows.ts` (restructured from each route's own stated prose). Never a live-price claim or a predicted price — see JETSTASH_PRINCIPLES.md §14 for the full standing rules and §14.1 for the architecture.

**Travel Ready Check** (`lib/travel-ready-check.ts` + `data/travel-ready-rules.ts`) — answers "can I actually travel on these dates with the documents I have?", the connected-but-different question to Book-By's "when should I book?". `data/travel-ready-rules.ts` is the *only* place a visa or passport fact lives — no visa/passport logic exists anywhere else in the codebase; `lib/visa-links.ts`'s per-country official link stays a separate, simpler pointer. Every rule carries an official source (GOV.UK or the destination's own visa portal, never a blog), a `lastVerifiedDate`, and a `reviewDueDate` — once that passes, `isRuleStale()` makes the affected check degrade to "official confirmation required" automatically rather than silently going stale. V1 covers 7 countries (Pakistan, India, Saudi Arabia, UAE, Qatar, Turkey, Morocco), British passport holders plus NICOP/POC and OCI document holders — every other combination returns an honest `not-enough-information`, never a guess. It plugs into the Travel Intelligence Engine (`lib/travel-intelligence-engine.ts`) via `computeReadiness()`'s optional 3rd parameter rather than existing as a separate tool — see JETSTASH_PRINCIPLES.md §14.2 for the engine and §14.3 for this module.

**Fare freshness** (`lib/freshness-thresholds.ts`) — the single place every "how old is too old" number lives (`OBSERVATION_FRESH_DAYS`, `OBSERVATION_STALE_DAYS`, `SERVICE_END_WATCH_DAYS`, `RULE_REVIEW_WATCH_DAYS`) plus `getFareFreshnessState()`'s 3-tier `'fresh' | 'ageing' | 'stale'` model. Every fare-rendering component (`deal-card.tsx`, `fare-history-panel.tsx`, `book-by-countdown.tsx`) imports thresholds from here rather than defining its own — never hardcode a day-count elsewhere. See JETSTASH_PRINCIPLES.md §14.4 for the full reasoning, including why automated fare collection isn't currently safe and what the weekly Vercel Cron (`app/api/cron/fare-check-reminder/route.ts`) does instead.

**Analytics** (`lib/analytics.ts`) — the one `track()` wrapper every event goes through, backed by `@vercel/analytics`/`@vercel/speed-insights` (mounted in `app/layout.tsx`). Never call the vendor SDK directly from a component; never send anything that identifies a person or a document. Event catalog is in JETSTASH_PRINCIPLES.md §14.4.

**Routing (`/app`)** — App Router with pre-rendering and targeted six-hour ISR:
- Region hub pages (`app/pakistan`, `app/india`, `app/gulf`, `app/umrah`, plus `app/family-holidays`, `app/business-class`) are thin pages that pass region-specific copy/data into the shared `RegionHubPage` template (`components/sections/region-hub-page.tsx`).
- `app/destinations/[slug]`, `app/routes/[slug]`, `app/airports/[slug]` are dynamic pages using `generateStaticParams` against the corresponding `/data` array.
- The homepage, route index/detail pages, destination detail pages, airport detail pages and
  status-sensitive commercial/region hubs export `revalidate = 21600`. Do not describe the whole
  site as immutable static output.
- `app/api/subscribe`, `app/api/route-watch` (Brevo), `app/api/contact` and
  `app/api/quote-request` (Resend) are the customer-submission server routes. All four **fail
  clearly with a 503** if their env vars are not set, rather than silently succeeding. The weekly
  `app/api/cron/fare-check-reminder` route is separate operational server logic configured in
  `vercel.json`. Do not change fail-clear behaviour without discussing it. Option lists validated
  by the form routes live in shared `lib/*-options.ts` modules (`quote-request-options`,
  `route-watch-options`, `travel-club-options`) or come from `/data` helpers—never re-declare a
  literal list inside an API route. The Brevo routes' attribute names come from
  `lib/brevo-attributes.json`/`lib/brevo-attributes.ts`; run `npm run brevo:setup` after adding an
  attribute because Brevo silently drops unrecognised attributes.

**Design system** — all brand colours (`ink`, `brass`, `terracotta`, `sand`), type and spacing are defined once in `tailwind.config.js` and `app/globals.css`. Never hardcode hex values or magic spacing numbers elsewhere (the only exceptions: WhatsApp's brand green in `whatsapp-share-button.tsx`, and `app/**/opengraph-image.tsx` files, which mirror the palette because ImageResponse can't read Tailwind); if the palette needs to change, that's the only file to touch. Fonts: Fraunces (display/serif, `font-display`) + Public Sans (body, `font-sans`) via `next/font/google`, wired up in `app/layout.tsx` — Fraunces deliberately ships no italic face (nothing uses it; don't re-add without a callsite).

**Interaction language** — one hover/press vocabulary site-wide: solid conversion CTAs (form submits, partner links) hover to brass (`hover:bg-brass-400` + `hover:shadow-brass-glow` on brass buttons, `hover:bg-brass-600` on ink buttons) and compress on press (`active:scale-[0.985]`); dark navigational buttons hover `bg-ink-700`; destination panels inside `group` cards zoom `group-hover:scale-[1.03]` over 500ms. Every dark hero opens with the same arrival moment: `relative overflow-hidden`, the brass radial-gradient overlay, and `stagger-in stagger-N animate-fade-up` on badge → h1 → intro. Match these on any new surface rather than inventing variants.

**Images** — one central brand-image system (`docs/visual-identity.md` is the art-direction source of truth). Real photography lives in `public/images/{heroes,destinations,airports,guides}/` named by slug/key; `scripts/generate-image-manifest.mjs` (prebuild/predev) scans it into `lib/image-manifest.json`, and `lib/brand-images.ts` resolves lookups against that manifest. Render only through `<DestinationVisual />` (cards/panels) and `<HeroBackdrop />` (dark heroes) — both fall back automatically to the generated `<DestinationMark />` panel / brass radial gradient when no file exists, so adding or removing an image is a file-drop plus deploy, never a code change. Zero external image requests either way.

**Path alias** — `@/*` maps to the repo root (see `tsconfig.json`).

## Content integrity constraints

This codebase treats fabricated content as a bug class, not a style preference — several conventions exist specifically to prevent it:

- **No invented stats or urgency.** Every claim must be traceable to an editable data file or explicitly marked as a placeholder/example (see README "No fabricated content").
- **Route claims must be verified against real airline schedules**, not assumed from a brief — see README "Verified route and airport claims" for two routes (Leeds Bradford–Islamabad; Manchester–Jeddah/Birmingham–Madinah) that were deliberately modelled as connecting rather than direct after conflicting source data. Apply the same standard to any new entry in `data/routes.ts` or `data/airports.ts`.
- **Deal cards never show a hardcoded price.** `Deal` (`data/deals.ts`) is curation metadata only — which airport→destination+cabin combos to feature — with no price field. `DealCard` derives what to show from `data/fare-observations.ts` (`getFareRangeSummary`) at render time: an honest observed range or single logged check when observations exist, or non-perishable route facts (flight time, direct/connecting, booking-window link) when none do. Never add a price field back onto `Deal` or hardcode a `£` figure in a component — log a new entry in `data/fare-observations.ts` instead (append-only, never overwrite).
- **Deliberately unbuilt features** (Hotels, Car Hire, Airport Lounges, Airport Parking) are a considered scope decision, not an oversight — see README "Deliberate scope decisions" before adding placeholder content for these verticals.
- **Travel Club / fare alerts** (`app/travel-club/page.tsx`, `components/sections/newsletter-section.tsx`) promise manual, human-curated email segments (by `TRAVEL_INTEREST` and `NEAREST_AIRPORT` Brevo attributes) — not automated price tracking, which doesn't exist. Don't let UI copy imply otherwise. See README "Running Travel Club" for the full operational model, and `docs/travel-club-email-sequence.md` for the actual email copy.

## Production readiness

JetStash is already deployed. Read `docs/project-control/STATUS.md` and `ROADMAP.md` for unfinished
work; do not reconstruct a launch checklist from old phase reports. Before any production merge,
verify the exact branch and commit, run the quality gates appropriate to the change, confirm the
Vercel Preview, then remember that merging to `main` automatically starts a Vercel Production
deployment. Monitor that deployment for the exact merge commit.
