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
3. **Wire up the newsletter.** `/app/api/subscribe/route.ts` is written for Brevo (free up to 300 emails/day) but needs `BREVO_API_KEY` and `BREVO_LIST_ID` set as environment variables. Until set, the form fails clearly rather than pretending to succeed.
4. **Wire up the contact form.** `/app/api/contact/route.ts` is written for Resend (resend.com) but needs `RESEND_API_KEY` and `CONTACT_TO_EMAIL` set. Same fail-clearly behaviour until configured.
5. **Get real, current flight prices.** Every price in `/data/deals.ts` is a plausible placeholder with a real `lastChecked` date format — none of it is a live, verified fare. Replace with real researched prices before publishing, and keep the `lastChecked` field honest and current.
6. **Connect an actual affiliate/booking partner.** Every "Check live price" button currently links to a generic Skyscanner search URL with no affiliate tracking ID. Apply to Skyscanner Partners (or your chosen affiliate programmes) and add tracking parameters to every `partnerUrl` in `/data/deals.ts`.

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
