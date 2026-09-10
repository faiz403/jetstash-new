# Weekly Commercial Funnel

**Commercial question this answers:** are real visitors getting enough value from JetStash to take
a commercial action (a Trip.com click), and are those actions producing attributable
bookings/commission at a founder effort the business can sustain? See `docs/project-control/STATUS.md`'s
"Current first-revenue bottleneck: NOT YET PROVEN" — this is the recurring reconciliation that
answers it week by week, rather than re-litigating the question from scratch each time.

This is a project-control artifact: a manually-populated weekly record plus a small deterministic
calculation engine (`lib/commercial-funnel.ts`). It is **not** a new analytics platform, a public
page, a dashboard or an API — see "What this deliberately is not" below.

## The funnel

```
VISITORS → USEFUL INTERACTION → PARTNER CTA CLICK → VALIDATED BOOKING → COMMISSION
                                                                              ↓
                                                                    FOUNDER REVIEW EFFORT
```

## Stage definitions

| Stage | Definition | Where the number comes from |
|---|---|---|
| **Visitors** | Route-page visitors where available (per-route pageviews), else account-wide site visitors | Vercel Web Analytics dashboard (manual read — see "Evidence sources" below; no API access exists on the current plan) |
| **Useful interactions** | A genuinely high-intent, observable interaction distinct from a bare pageview — currently only `journey_choice_impression` / `journey_choice_evidence_opened` (Manchester-Islamabad's Journey Choice pilot only, see `lib/analytics.ts`). **Every other route has no defined "useful interaction" event and must be recorded `NOT OBSERVABLE`, not estimated.** Do not invent a proxy (e.g. scroll depth, time-on-page) just to fill this column — see the funnel brief's own instruction. |
| **Partner CTA clicks** | `tripcom_click` events (`lib/analytics.ts`) — fired from `deal-card`, `fare-signal`, `no-fare-fallback`, `tracked-fares-card`, `journey-brief` and `journey-choice-verdict` call sites, each carrying `route`, `origin`, `destination`, `source`. Route-attributable **at the event level** (the `route` property exists), but only actually route-scoped in a weekly report if the dashboard used to read it can filter/group by that custom property — confirm this each time rather than assuming; if it can't, record the total as `UNALLOCATED` (account-wide), never split arbitrarily across routes. |
| **Validated bookings** | Confirmed Trip.com partner bookings/orders only — never a click count, never an inferred booking. Source: Trip.com's own affiliate dashboard reporting. |
| **Commission** | Settled and pending, currency preserved (GBP). Source: Trip.com's own affiliate dashboard reporting. Never estimate from a typical commission rate — see "Attribution gaps" below on why even a real commission figure can't currently be joined to a route. |
| **Founder effort** | Minutes/hours spent that week collecting, checking or maintaining the route/scope in question — manually entered, no instrumentation exists or is being added for this. |

## Evidence-quality labels

Every stage in a weekly report is tagged with one of four labels — this is what stops the funnel
from quietly turning a real gap into a fabricated number:

- **ATTRIBUTED** — genuinely tied to this exact route, from a real source (an event property, a
  dashboard filter actually confirmed to work, a partner report row that names the route).
- **PARTIALLY ATTRIBUTED** — some but not all of a figure can be tied to this route (e.g. most but
  not all CTA clicks in a period carried a usable `route` value).
- **UNALLOCATED** — real, observed activity that cannot currently be joined to a specific route
  (the most common case today: Trip.com's own booking/commission reporting, which has no
  route-level breakdown until `trip_sub1` attribution is confirmed — see "Attribution gaps"
  below). Still a real number, recorded honestly as account-wide rather than split by guesswork.
- **NOT OBSERVABLE** — no source exists, or this pass had no access to the source that would carry
  it (e.g. no authorised session access to a dashboard this week). Never filled with a proxy,
  estimate, or last week's number carried forward silently.

## Fail-closed calculation rules

`lib/commercial-funnel.ts`'s `computeRate()` is the one place a rate is computed, and it refuses to
produce a number — returning `'N/A'`, not `0` or a guess — whenever:

- either value is `NOT OBSERVABLE` (a `null`, never a fabricated zero)
- the denominator is genuinely `0` (avoids a divide-by-zero artefact)
- the two values don't share the same scope — a route figure can never be divided by an
  account-wide figure, and two different routes' figures can never be divided by each other

This is the concrete enforcement of the funnel brief's own example: **route visitors ÷ account-wide
Trip.com clicks must never become a route conversion rate.** `tests/commercial-funnel.test.ts`
locks this in, including the exact mismatched-scope case.

An `UNALLOCATED` ÷ `UNALLOCATED` pair *is* a valid calculation, as long as both are account-wide —
two real account-wide numbers can be divided by each other; what they can never do is pretend to be
a specific route's rate.

## Rates computed (where evidence allows)

`computeWeeklyFunnelRates()` computes, for a single route-or-scope row:

- visitor → useful interaction rate
- useful interaction → CTA rate
- visitor → CTA rate
- CTA → validated booking rate
- visitor → validated booking rate
- commission per visitor
- commission per CTA click
- commission per founder hour

Every one of these is `N/A` rather than a number whenever its inputs don't clear the fail-closed
rules above.

## Attribution gaps (as of 10 September 2026)

- **CTA clicks carry a `route` property, but bookings/commission currently don't.** Trip.com's own
  affiliate reporting has no route-level breakdown today — JetStash's `route` tag never reaches
  Trip.com's system. The parked branch `revenue/tripcom-route-attribution-2026-09-08` (commit
  `723216f`) would populate Trip.com's own `trip_sub1` sub-tracking field to close this gap, but it
  stays **parked and undeployed** pending Trip.com's confirmation that doing so is safe and won't
  affect commission attribution (5 questions sent in the 10 September outreach — see
  `docs/project-control/STATUS.md`). **Do not deploy or copy that approach while building or
  running this funnel.** Until Trip.com replies, commission and validated bookings are recorded
  `UNALLOCATED` at account-wide scope, never split across routes by assumption.
- **Vercel Web Analytics has no CLI/API access on the current (Hobby) plan.** Every visitor/CTA
  figure in a weekly report is a manual read of the Vercel dashboard by whoever populates that
  week — there is no automated pull. If a given week's report has no dashboard access, the honest
  entry is `NOT OBSERVABLE`, not a number carried over from a previous week.
- **`journey_choice_impression`/`journey_choice_evidence_opened`** are the only "useful
  interaction" events that exist anywhere on the site today, and only for the
  Manchester-Islamabad Journey Choice pilot. Every other route's "useful interaction" cell is
  structurally `NOT OBSERVABLE` — this is not a data-collection failure to fix, it's an accurate
  description of what currently exists. Do not add a new interaction event to fill this column;
  that would be new analytics instrumentation, exactly what this task was scoped not to add.

## What this deliberately is not

Per the founder brief this was built from:

- No new analytics platform — no PostHog, GA4, Mixpanel, tracking pixel, or third-party script.
- No new database, new Vercel plan, or new SaaS relationship.
- No public page, no dashboard UI, no new API route. `lib/commercial-funnel.ts` is not imported by
  any `app/` page or `components/` file — confirmed via full-repo grep before this file was
  written, and worth re-confirming if this module is ever touched again.
- No automated data pull. Every weekly report is manually populated from whatever dashboards the
  founder (or whoever is running the reconciliation that week) actually has access to.

## How to run a week

1. Copy `WEEKLY_TEMPLATE.md` to a new file named for the week's date range
   (`YYYY-MM-DD-to-YYYY-MM-DD.md`).
2. Fill in every cell you can genuinely observe this week, tagging each with its evidence-quality
   label. Leave the rest `NOT OBSERVABLE` — never guess, never carry a stale number forward
   silently.
3. If you want the computed rates, transcribe the week's figures into a `WeeklyFunnelRow` (see
   `lib/commercial-funnel.ts`'s exported type) and call `computeWeeklyFunnelRates()` — via a quick
   Vitest run, a Node REPL, or a one-off script; there is no CLI wrapper by design, since this
   should stay a deliberate, occasional reconciliation rather than something that runs itself.
4. Update `docs/project-control/STATUS.md` if the week's evidence changes the first-revenue
   bottleneck's status — this file itself is not the place project-wide conclusions live.
