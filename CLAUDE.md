# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

JetStash — a Next.js 14 (App Router) marketing/content site for a UK travel hub covering Pakistan, India, the Gulf, Umrah, family holidays and business class, plus Mediterranean/North African routes. There is no database or CMS: all content (destinations, routes, airports, example fares) lives in typed TypeScript data files under `/data`. Pages are statically generated from that data.

## Commands

```bash
npm install
npm run dev      # localhost:3000
npm run build    # production build — this is the real correctness check, since ESLint is disabled during builds
npm run start
npm run lint
```

There is no test suite. TypeScript's `strict: true` plus `npm run build` is the primary correctness signal — always run a build after non-trivial changes to data files or page components. Note `next.config.js` sets `eslint: { ignoreDuringBuilds: true }`, so `next build` will not catch lint issues; run `npm run lint` separately if relevant.

## Architecture

**Content model (`/data`)** — four typed arrays are the single source of truth, cross-referenced by slug rather than nested objects:
- `data/airports.ts` — UK departure airports (`Airport`), keyed by `slug`.
- `data/destinations.ts` — destinations grouped by `RegionGroup` (`pakistan`, `india`, `gulf`, `mediterranean`, `north-africa`). Umrah destinations (Jeddah, Madinah) use `region: 'gulf'` — the `/umrah` hub page filters `regionGroups.umrah.destinationSlugs` (in `lib/site-config.ts`) rather than relying on a distinct region value. Each `Destination` optionally carries `familyVisitContent` for destinations where visiting relatives is a primary travel pattern.
- `data/deals.ts` — example/indicative fares (`Deal`), linked to an airport slug and destination slug. Every price is explicitly non-live placeholder data — see the file's header comment.
- `data/routes.ts` — specific airport→destination route guides (`Route`), with fields modelling *time-bound* direct service (`directServiceEndDate`/`directServiceEndNote`) and connecting alternatives (`connectingAlternative`) so a route can be described honestly as service changes over time (see README's "Time-bound direct services" section for the exact update procedure when a withdrawal date passes).

Each data file exports lookup helpers (e.g. `getRoutesByDestination`, `getDealsByRegionGroup`, `getAirportBySlug`) — use these instead of filtering the raw arrays inline.

**Routing (`/app`)** — App Router with static generation:
- Region hub pages (`app/pakistan`, `app/india`, `app/gulf`, `app/umrah`, plus `app/family-holidays`, `app/business-class`) are thin pages that pass region-specific copy/data into the shared `RegionHubPage` template (`components/sections/region-hub-page.tsx`).
- `app/destinations/[slug]`, `app/routes/[slug]`, `app/airports/[slug]` are dynamic pages using `generateStaticParams` against the corresponding `/data` array.
- `app/api/subscribe` and `app/api/contact` are the only server logic — newsletter (Brevo) and contact form (Resend) integrations that **fail clearly with a 503** if their env vars aren't set, rather than silently succeeding. Don't change that fail-clear behavior without discussing it.

**Design system** — all brand colours (`ink`, `brass`, `terracotta`, `sand`), type and spacing are defined once in `tailwind.config.js` and `app/globals.css`. Never hardcode hex values or magic spacing numbers elsewhere; if the palette needs to change, that's the only file to touch. Fonts: Fraunces (display/serif, `font-display`) + Public Sans (body, `font-sans`) via `next/font/google`, wired up in `app/layout.tsx`.

**Images** — there is currently no real photography pipeline. All destination imagery is rendered locally by `components/ui/destination-mark.tsx` (`<DestinationMark />`), an on-brand generated panel with a deterministic per-city route-arc motif — zero external image requests. `lib/images.ts` documents the migration path to real photography; `placeholderUrl()` there is deprecated and unused.

**Path alias** — `@/*` maps to the repo root (see `tsconfig.json`).

## Content integrity constraints

This codebase treats fabricated content as a bug class, not a style preference — several conventions exist specifically to prevent it:

- **No invented stats or urgency.** Every claim must be traceable to an editable data file or explicitly marked as a placeholder/example (see README "No fabricated content").
- **Route claims must be verified against real airline schedules**, not assumed from a brief — see README "Verified route and airport claims" for two routes (Leeds Bradford–Islamabad; Manchester–Jeddah/Birmingham–Madinah) that were deliberately modelled as connecting rather than direct after conflicting source data. Apply the same standard to any new entry in `data/routes.ts` or `data/airports.ts`.
- **`Deal.lastChecked`** must stay honest and current — it's rendered as "Example fare checked `<date>`," never as a live/verified price claim.
- **Deliberately unbuilt features** (Hotels, Car Hire, Airport Lounges, Airport Parking) are a considered scope decision, not an oversight — see README "Deliberate scope decisions" before adding placeholder content for these verticals.
- **Travel Club / fare alerts** (`app/travel-club/page.tsx`, `components/sections/newsletter-section.tsx`) promise manual, human-curated email segments (by `TRAVEL_INTEREST` and `NEAREST_AIRPORT` Brevo attributes) — not automated price tracking, which doesn't exist. Don't let UI copy imply otherwise. See README "Running Travel Club" for the full operational model, and `docs/travel-club-email-sequence.md` for the actual email copy.

## Required before production launch

The README's "Required before launch — read this" section lists concrete unfinished items (real build verification, real photography, Brevo/Resend env vars, real fare data, affiliate tracking IDs, periodic business-class URL date refresh). Check there before assuming any of these are done.
