# First 100 Visitors — Weekly Measurement Worksheet

**Recorded:** 8 August 2026, alongside `FIRST_10_USER_TEST.md` as the first-users measurement pack.
**Status:** no full weekly cycle has been filled in yet under the weekly template below. Two
route-scoped, non-weekly evidence-gate readings have been backfilled (10 September 2026, both
manchester-islamabad Journey Choice checkpoints: Day 3 and Day 7) — see "Evidence-gate readings" —
to stop genuine observations from existing only in chat history where a future session (or
`docs/project-control/commercial-funnel/`) can't find them. This document still defines the weekly
fields and the rules for reading them.

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

## Evidence-gate readings (non-weekly, route-scoped)

Some readings are a single-route, single-date checkpoint tied to a specific project decision gate
(see `STATUS.md`'s "Next evidence gates"), not a calendar week of site-wide activity. Force-fitting
one of these into the weekly template's "Week of [date] – [date]" framing would misrepresent both
its scope (one route, not the whole site) and its window (a single evidence-gate date, not a
7-day period) — so they get their own dated entries here instead, using the same field names as the
weekly template where they apply.

**Provenance note:** both entries below are backfilled on 10 September 2026 from this session's own
records of the checks actually performed on 6 September and 10 September 2026 respectively — neither
is a fresh dashboard read taken today, and no dashboard was re-opened to produce either entry. Where
a figure states a range or a qualitative read (e.g. "ramping"), that imprecision is preserved from
the original check rather than rounded into false precision.

### MAN→ISB Day 3 evidence gate — 6 September 2026

**Scope:** Manchester–Islamabad (`manchester-islamabad`) only — the sole Journey Choice pilot route.
Not a site-wide reading.

**Trigger:** the founder-set "6 September 2026 — MAN→ISB Day 3: read Search Console, Vercel and
Trip.com for the signal" evidence gate (`STATUS.md`, "Next evidence gates").

- Vercel visitors: **15** — manchester-islamabad route-page visitors, per the Vercel Web Analytics
  dashboard read at this checkpoint
- Vercel page views: not recorded separately from the visitor count above
- Top pages (in order): not recorded (route scope was already known — manchester-islamabad)
- Device split: not recorded
- **Journey Choice / custom-event telemetry: NOT OBSERVABLE** — the actual limitation at this
  checkpoint was that Vercel's Hobby-plan custom-event data (e.g. `journey_choice_impression`,
  `tripcom_click`) does not render on the dashboard, not that Vercel itself went unread. The 15
  route-page visitors above is a real pageview-level figure; it says nothing about whether any of
  those 15 went on to a Journey Choice interaction or a Trip.com click — that stage stays
  NOT OBSERVABLE, not zero, and is never combined with the 15 to produce a rate (see
  `docs/project-control/commercial-funnel/README.md`'s fail-closed rules: this is exactly the same
  "don't manufacture a rate from an unobserved stage" principle, applied here by hand rather than by
  `computeRate()`).

- Search Console clicks: not recorded as a discrete count — 0% CTR was the read (see CTR row), which
  implies clicks did not exceed a negligible number at the impression volume below, but no exact
  click count was noted at the time
- Search Console impressions: **ramping toward roughly 80–84 per day** — recorded as a trend read at
  the time of the check, not a single exact daily count; do not treat "80–84" as a precise total for
  6 September specifically
- Search Console CTR: **0%** at the time of the check
- Search Console average position: **roughly 45–49**
- Top queries: not recorded at the time
- Top landing pages: not recorded at the time (route scope was already known — manchester-islamabad)

- Trip.com outbound clicks / dashboard activity: not observed — the Trip.com affiliate dashboard was
  inaccessible during this specific check
- Commissions / bookings: not observed, same reason

- Contact enquiries: not checked as part of this gate
- Quote requests: not checked as part of this gate
- Newsletter signups: not checked as part of this gate
- Route Watch signups: not checked as part of this gate

- Repeated route views / return behaviour observed: not checked as part of this gate
- Founder observations and support burden this week: not recorded

**Founder ruling recorded at the time:** HOLD until the 10 September Day 7 checkpoint — a weak
upstream (search-impression) signal is not read as a verdict on Journey Choice itself, since no
site-visitor or CTA-click figure was available to complete the picture. Vercel Pro was declined as a
way to unblock the missing rows above.

**Notes:** This reading answers "was there any search-visibility signal by Day 3, and were people
actually reaching the route page" (weak on the first count: real impression ramp, but zero measured
click-through and a poor average position; yes on the second: 15 real route-page visitors) — it does
not answer "are those visitors taking a commercial action," since the Journey Choice/custom-event
row that would show that, and the Trip.com row, were both unavailable at the time. Treat those two
gaps as exactly the kind of missing evidence `docs/project-control/commercial-funnel/README.md` now
has a standing rule for reusing once they *are* recorded — this entry is what "recorded" looks like
for the rows that were.

### MAN→ISB Day 7 evidence gate — 10 September 2026

**Scope:** Manchester–Islamabad (`manchester-islamabad`) only — the sole Journey Choice pilot route.
Not a site-wide reading. Kept as its own dated entry, not blended with the 6 September Day 3
reading above — the two checkpoints used different source windows (see below), and force-averaging
or otherwise combining them across those different windows would misrepresent both.

**Trigger:** the founder-set "10 September 2026 — MAN→ISB Day 7 decision" evidence gate (`STATUS.md`,
"Next evidence gates").

**Provenance note:** backfilled the same day as the checkpoint itself, from this session's own
record of the check — not a fresh dashboard read taken to write this document, and no dashboard was
re-opened to produce this entry.

**Google Search Console — window 1–7 September 2026:**
- Search Console clicks: **0**
- Search Console impressions: **266**
- Search Console CTR: **0%**
- Search Console average position: **43.9**

**Google Search Console — separate, later window 8–9 September 2026:**
- Search Console impressions: **17**
- Search Console clicks: **0**
- Search Console average position: **8.8**
- **Explicitly a small sample** — recorded at the time as too small to read as a real
  signal, and specifically **not attributed to the Reddit distribution experiment** despite the
  apparent position improvement; correlation was not asserted as causation.

**Google Search Console — separate three-month route-page context (not part of either funnel
window above):**
- Search Console clicks: **2**
- Search Console impressions: **475**
- Search Console average position: **43.8**
- Kept explicitly as background context, not folded into the 1–7 September or 8–9 September funnel
  readings — a 3-month total and a 7-day or 2-day window are not comparable figures and must not be
  presented as if they were the same kind of number.

**Vercel Web Analytics — window "last 7 days" at the time of the Day 7 readout (exact absolute
start/end dates were not recorded at the time; preserved here as the dashboard-relative window
actually used, not converted into invented calendar dates):**
- Vercel visitors: **10** — manchester-islamabad route-page visitors
- Geography: **100% UK**
- Device split: **60% desktop / 40% mobile**
- **Journey Choice / custom-event telemetry: NOT OBSERVABLE** — same Hobby-plan limitation as the
  Day 3 reading; the 10 route-page visitors above says nothing about whether any of them reached a
  Journey Choice interaction. Not zero, not observed.

**Trip.com — window 2–9 September 2026:**
- Trip.com outbound clicks: **0**
- Unique visitors: **0**
- Bookings: **0**
- Commission: **$0**

**Notes:** Two Search Console windows (1–7 Sept and 8–9 Sept) and one Vercel "last 7 days" window
are recorded here, and none of them share an identical date range with each other or with the
Trip.com 2–9 September window — this is preserved deliberately rather than normalised into one
tidy period, per the correction that produced this entry. No conversion rate is calculated across
any pair of these figures: a Search Console impression is acquisition/search evidence, not a site
visitor, and the Vercel visitor count and the Trip.com click/booking counts come from windows that
don't line up closely enough, and lack the Journey Choice interaction step in between, to support a
rate that would mean anything. The founder's own reading of this data belongs in `STATUS.md` or a
future commercial-funnel weekly report, not invented here from these raw figures.

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
