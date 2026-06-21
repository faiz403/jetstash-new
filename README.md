# JetStash 2.0

A Next.js 14 (App Router) rebuild of JetStash — the UK's travel hub for Pakistan, India, the Gulf, Umrah travel, family holidays and business class, alongside Mediterranean and North African routes.

## Stack

- **Next.js 14** (App Router, static generation for destination/airport pages)
- **TypeScript**
- **Tailwind CSS** with a custom brand token system (`tailwind.config.js`)
- **Fraunces** (display serif) + **Public Sans** (body) via `next/font/google`
- No database — content lives in typed data files under `/data`

## Local setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel

1. Push this project to a GitHub repository.
2. In Vercel, "Add New Project" → import the repo. Vercel detects Next.js automatically — no config needed.
3. Add environment variables (see below) in **Project Settings → Environment Variables** before your first production deploy that needs them.
4. Connect your domain (`jetstash.co.uk`) under **Project Settings → Domains**.

## Required before launch — read this

This codebase was written without the ability to run `npm install` or a real build in the environment it was produced in (no network access to the npm registry). Before treating this as launch-ready:

1. **Run a real build and fix whatever the compiler finds.** `npm install && npm run build` locally or let Vercel's first deploy do it. I've hand-checked the code carefully for type errors, but a real compiler pass is the only way to be certain.
2. **Replace placeholder images with real photography.** See `/lib/images.ts` — it currently renders clean on-brand placeholder blocks instead of real images, because the only "free, no API key" image service that used to support this (`source.unsplash.com`) was shut down by Unsplash in 2023. Either get a free Unsplash API key and resolve real photo URLs, license stock photography, or commission your own.
3. **Wire up the newsletter.** `/app/api/subscribe/route.ts` is written for Brevo (free up to 300 emails/day) but needs `BREVO_API_KEY` and `BREVO_LIST_ID` set as environment variables. The form also now captures a nearest-airport preference — create a custom Brevo contact attribute called `NEAREST_AIRPORT` (Contacts → Settings → Contact Attributes → Add attribute, type "Text") before this will save correctly, otherwise Brevo silently drops the field. Until the environment variables are set, the form fails clearly rather than pretending to succeed.
4. **Wire up the contact form.** `/app/api/contact/route.ts` is written for Resend (resend.com) but needs `RESEND_API_KEY` and `CONTACT_TO_EMAIL` set. Same fail-clearly behaviour until configured.
5. **Get real, current flight prices.** Every price in `/data/deals.ts` is a plausible placeholder with a real `lastChecked` date format — none of it is a live, verified fare. Replace with real researched prices before publishing, and keep the `lastChecked` field honest and current.
6. **Connect an actual affiliate/booking partner.** Every "Check live price" button currently links to a generic Skyscanner search URL with no affiliate tracking ID. Apply to Skyscanner Partners (or your chosen affiliate programmes) and add tracking parameters to every `partnerUrl` in `/data/deals.ts`.
7. **Refresh the hardcoded dates in business class `partnerUrl`s periodically.** The 10 business class fares in `/data/deals.ts` use Skyscanner URLs with a fixed example date (`260920/261004`) so the `cabinclass=business` parameter is actually honoured — Skyscanner's flexible/dateless search silently falls back to economy regardless of that parameter. Update these dates every few months so they stay roughly "a few months out," and verify Skyscanner's URL format hasn't changed.

## Environment variables

| Variable | Used by | Required for |
|---|---|---|
| `BREVO_API_KEY` | `/app/api/subscribe/route.ts` | Newsletter signups to actually save |
| `BREVO_LIST_ID` | `/app/api/subscribe/route.ts` | Newsletter signups to actually save |
| `RESEND_API_KEY` | `/app/api/contact/route.ts` | Contact form to actually send |
| `CONTACT_TO_EMAIL` | `/app/api/contact/route.ts` | Where contact form messages are delivered |

## Project structure

```
app/                  Routes (Next.js App Router)
  page.tsx            Homepage
  pakistan/ india/ gulf/ umrah/     Region hub pages
  family-holidays/ business-class/ travel-club/
  deals/              All fares, with client-side filtering
  destinations/[slug] Dynamic destination pages (generateStaticParams)
  airports/[slug]     Dynamic airport pages (generateStaticParams)
  api/subscribe/      Newsletter API route
  api/contact/        Contact form API route
  sitemap.ts          Dynamic sitemap.xml
  robots.ts           robots.txt

components/
  ui/                 Button, Badge, DealCard, HubCard — shared primitives
  layout/             Header, Footer
  sections/           RouteMapHero, NewsletterSection, RegionHubPage template

data/
  airports.ts         UK departure airports
  destinations.ts     All destinations across every region
  deals.ts             Every fare shown across the site

lib/
  site-config.ts      Nav structure, region groupings, site metadata
  images.ts           Placeholder image helper (read the warning in this file)
  utils.ts            Tailwind className merge helper
```

## Design system

Colours, type and spacing are defined once in `tailwind.config.js` and `app/globals.css` — no inline hex values or magic numbers elsewhere in the codebase. If you need to adjust the brand palette, that's the only file to touch.

- **ink** — near-black navy, used for dark sections and body text
- **brass** — warm gold accent, primary CTA colour
- **terracotta** — secondary accent, used for eyebrows and category labels
- **sand** — warm off-white background

## No fabricated content

Every statistic, price, and claim in this codebase is either factual, clearly marked as indicative with a checked date, or a placeholder explicitly called out as such (see the warnings in `/lib/images.ts` and this README). There is no "50,000+ travellers," no invented urgency, and no claim that can't be traced to a real, editable data file.

## Deliberate scope decisions — what's not built, and why

A wishlist of "critical additions" was evaluated against this codebase as part of a full ownership-level audit. Several were deliberately **not** built. This isn't an oversight — building them now would have been the wrong call, and it's worth recording the reasoning so it isn't re-litigated by accident later.

**Built this pass:** fare alerts now genuinely capture a nearest-airport preference (see `components/sections/newsletter-section.tsx` and `app/api/subscribe/route.ts`), route comparison sections on route pages where real alternative-airport data exists, and the visiting-family content architecture was kept as the core differentiator rather than diluted with new verticals.

**Deliberately deferred — Hotels, Car Hire, Airport Lounges, Airport Parking.** Each of these needs either a live inventory/booking integration or genuine local-market knowledge this codebase doesn't yet have. Shipping them now with placeholder content would repeat the exact mistake that kills early-stage travel sites: going wide and shallow instead of finishing the core network first. Revisit once the 16 core routes are live, indexed, and converting — not before.

**Worth adding once traffic exists — eSIMs, Travel Insurance.** Both are low-build-cost affiliate plays (a single resource page each, not a full vertical) and can be added quickly once there's an audience to serve them to. Don't build ahead of demand.

## Running Travel Club — what the "fare alerts" promise actually requires

Travel Club (`app/travel-club/page.tsx`, `components/sections/newsletter-section.tsx`) deliberately does **not** claim automated live price tracking, because no such backend exists. What it promises instead is two manual things, both genuinely deliverable but requiring you to actually do them:

1. **Fare alerts**: when you update `data/deals.ts` with a fare meaningfully better than what's been shown before, segment your email list by the `TRAVEL_INTEREST` and `NEAREST_AIRPORT` contact attributes (captured at signup) and send a short, honest email to the relevant segment only — not your whole list.
2. **New route alerts**: when you add a new entry to `data/routes.ts`, do the same — email the segment tagged with that region.

If you don't intend to do this manually on an ongoing basis, soften the Travel Club page's copy further rather than leaving a promise unfulfilled — an unfulfilled "we'll tell you" is worse for trust than not promising it at all.

Actual email templates for the welcome, first-value, and re-engagement emails — written to be sent manually,
with guidance on when to send each — live in `docs/travel-club-email-sequence.md`.

**No double opt-in is currently configured.** The `POST /v3/contacts` call in `app/api/subscribe/route.ts` adds a contact directly — it does not trigger a confirmation email by itself. If you want double opt-in (recommended for deliverability and GDPR consent records), set it up in Brevo directly: either build the sign-up form in Brevo's own form builder with "Double confirmation" enabled, or create a Brevo Automation workflow that watches for "contact added to list" and sends a confirmation email with a opt-in link. The application code cannot configure this from outside Brevo's dashboard — don't add UI copy implying a confirmation email exists until one actually does.

## Verified route and airport claims

Every route added in this audit pass was checked against real airline schedule data before being written into `data/routes.ts` — not assumed from the brief. Two corrections worth flagging explicitly:

- **Leeds Bradford → Islamabad is not currently a stable direct service.** Conflicting reports exist (a 2025 PIA announcement, a collapsed start-up airline under CAA investigation, and multiple current sources confirming no direct service exists today). This route is modelled as **connecting**, not direct, and the instability is described honestly in the route's own copy rather than asserted as settled fact.
- **Manchester → Jeddah and Birmingham → Madinah are connecting routes**, not direct — both require a change at Doha, Istanbul, or Jeddah depending on carrier. Written accordingly.

If you update `data/routes.ts` or `data/airports.ts` in future, verify new route claims the same way — a named UK city pair existing in a press release is not the same as a stable, bookable, ongoing service.

## Time-bound direct services — `directServiceEndDate` and `connectingAlternative`

Some direct routes have a publicly announced withdrawal date — for example, IndiGo's Manchester–Delhi and Manchester–Mumbai services, both launched in 2025 and both scheduled to end 1 September 2026. A plain `isDirect: true/false` boolean can't represent this honestly: the route is genuinely direct *today*, but writing a page as if that's permanent would go stale the moment the withdrawal happens.

The `Route` interface in `data/routes.ts` has two fields for this:

- **`directServiceEndDate`** (ISO date) + **`directServiceEndNote`** (plain-language explanation) — set only when a currently-direct service has an announced end date. The route page (`app/routes/[slug]/page.tsx`) renders a visible notice when this is set.
- **`connectingAlternative`** — populated for any route where a realistic 1-stop (or 2-stop) alternative matters, whether the route is currently direct (as a "what happens after the direct service ends" fallback) or already connecting-only (as the main "how this route works" content). The route page renders this as a dedicated section, with the heading and framing copy changing based on whether `isDirect` is currently true or false.

**When the withdrawal date passes:** update the route entry — flip `isDirect` to `false`, remove `directServiceEndDate`/`directServiceEndNote`, and rewrite `intro`/`frequency`/`airlines` to describe the connecting-only reality, using `connectingAlternative`'s data as the basis. Don't leave a route marked direct with a past end date — that's the exact stale-claim pattern this whole system exists to avoid.
