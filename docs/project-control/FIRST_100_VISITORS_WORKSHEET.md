# First 100 Visitors — Weekly Measurement Worksheet

**Recorded:** 8 August 2026, alongside `FIRST_10_USER_TEST.md` as the first-users measurement pack.
**Status:** template only — no week has been filled in yet. This document defines the weekly
fields and the rules for reading them; it deliberately contains zero populated figures.

## Why this exists

`LAUNCH_CHECKLIST.md` item F1 confirmed (8 August 2026) that Vercel Analytics' code-side
instrumentation is complete, but custom events don't render on the **Vercel Hobby plan** — a plan
limitation, not a broken-tracking finding. The decision recorded there was to stay on Hobby for now
and use what's already measurable without paying for more. This worksheet is that "what's already
measurable" list, turned into a repeatable weekly habit — so the first ~100 visitors get read
consistently, from real sources, instead of each week starting from a blank slate.

## Operating rules — read these before filling in any week

- **Vercel custom events are unavailable on the Hobby plan.** Do not leave a custom-event field
  blank and read that as "nothing happened" — it is a plan limitation, not evidence of zero
  interaction. Every field below only ever draws from data that is actually visible today.
- **Do not treat missing custom-event counts as zero interactions.** Someone using the Route Atlas,
  completing Travel Ready Check, or clicking through to Trip.com without the outcome being visible
  in the dashboard is not the same as nobody doing those things.
- **Do not upgrade the Vercel plan (or any other analytics tooling) until missing data is actually
  blocking a real decision.** Upgrading purely to unlock more numbers, out of curiosity or
  discomfort with the gap, is exactly the premature move `LAUNCH_CHECKLIST.md` F1 already decided
  against. Revisit that decision only when a specific, named decision cannot be made without the
  missing data.
- **Traffic is currently too small for conversion-rate claims.** Do not compute or state a
  percentage-based conversion rate from small weekly counts (a handful of visitors) — a rate
  computed from single-digit or low-double-digit denominators is not a real signal, and presenting
  it as one is a fabricated-precision problem, not a fabricated-content one, but no more honest for
  it. Report raw counts, not rates, until volume is genuinely large enough.
- **Exclude obvious founder/testing traffic where it can be identified** — a known IP, a session
  that hits every page in seconds while other tabs are open for development, a visit right after a
  deploy that matches known manual verification. Note in the worksheet when a week's raw numbers
  have had obvious self-traffic excluded, and roughly how much, rather than silently adjusting the
  figure.
- **No paid-advertising decision before a credible funnel and a stop-loss rule exist.** This
  worksheet measures organic behaviour only. `LAUNCH_CHECKLIST.md` section F–G already gates paid
  spend on real analytics confirmation (F1) and genuine fare coverage (G1) — this worksheet doesn't
  change or relax that gate on its own.

## What to check each week, and where

| Area | Source | What to record |
|---|---|---|
| Visitors and page views | Vercel Analytics dashboard | Total visitors, total page views for the week |
| Top pages | Vercel Analytics dashboard | The pages that received the most visits, in order |
| Device split | Vercel Analytics dashboard | Rough desktop vs. mobile vs. tablet split, if shown |
| Search Console — clicks, impressions, CTR, average position | Google Search Console | The four headline figures, for the week or the closest available date range |
| Top queries | Google Search Console | Which search terms actually brought people in |
| Top landing pages | Google Search Console | Which pages people actually landed on from search |
| Trip.com outbound activity | Trip.com affiliate dashboard | Outbound click count if visible; any dashboard activity if click-level detail isn't broken out |
| Commissions / bookings | Trip.com affiliate dashboard | Any commission or booking record that appears — record only if genuinely present, never estimated |
| Contact enquiries | `/contact` form submissions (Resend) | How many came in this week |
| Quote requests | `/quote-request` form submissions (Resend) | How many came in this week |
| Newsletter signups | Brevo | How many new subscribers this week |
| Route Watch signups | Brevo (`WATCH_ROUTE` attribute) | How many new Route Watch signups this week |
| Repeated route views / return behaviour | Vercel Analytics top-pages/referrer view, where visible | Any visible sign of the same route or the same general visitor pattern recurring — note only what's actually visible, not inferred |
| Founder observations and support burden | Direct experience | Any direct question, confusion, or complaint that reached the founder this week, and roughly how much time it took to handle |

## Weekly template (copy this block for each new week)

Duplicate the block below for each week and fill in only what's genuinely available — leave a row
blank with a short reason (e.g. "not visible in Search Console yet", "no bookings this week") rather
than inventing a plausible-looking number.

```
### Week of [date] – [date]

**Self-traffic excluded:** [yes/no — and roughly how much, if known]

- Vercel visitors: 
- Vercel page views: 
- Top pages (in order): 
- Device split: 

- Search Console clicks: 
- Search Console impressions: 
- Search Console CTR: 
- Search Console average position: 
- Top queries: 
- Top landing pages: 

- Trip.com outbound clicks / dashboard activity: 
- Commissions / bookings: 

- Contact enquiries: 
- Quote requests: 
- Newsletter signups: 
- Route Watch signups: 

- Repeated route views / return behaviour observed: 
- Founder observations and support burden this week: 

**Notes:** 
```

## Reading the worksheet over time — what this is for, and what it isn't

- The point of filling this in weekly is to notice **direction and pattern**, not to produce a
  polished report. A route that keeps appearing in top pages and top queries together is worth
  noting even before it's provably significant.
- This worksheet does not, on its own, justify a redesign, a paid-spend decision, or a plan
  upgrade. It is the raw material for those decisions later, once there's enough of it — see the
  operating rules above.
- Combine this with `FIRST_10_USER_TEST.md` findings, not instead of them — a low-traffic week's
  numbers and a handful of real user sessions tell you different things, and both matter more
  together than either does alone.
