# Weekly Commercial Funnel — [WEEK START] to [WEEK END]

Copy this file to `YYYY-MM-DD-to-YYYY-MM-DD.md` and fill in what you can genuinely observe. See
`README.md` for stage definitions, evidence-quality labels and the fail-closed calculation rules.
Leave any cell you cannot genuinely observe as `NOT OBSERVABLE` — never a guess, an estimate, or
last week's number carried forward silently.

## Scope

One row per route you have real evidence for, plus one `ACCOUNT-WIDE` row for anything that can't
be allocated to a specific route. Delete unused route rows rather than leaving them blank.

## Funnel table

| Stage | Route/scope | Value | Evidence quality | Source | Notes |
|---|---|---:|---|---|---|
| Visitors | [route-slug or ACCOUNT-WIDE] | | ATTRIBUTED / UNALLOCATED / NOT OBSERVABLE | Vercel Web Analytics | |
| Useful interactions | | | | | Only `journey_choice_impression`/`journey_choice_evidence_opened` currently exist, Manchester-Islamabad only — every other route is structurally `NOT OBSERVABLE` here |
| Partner CTA clicks | | | | Vercel Web Analytics (`tripcom_click`) | Confirm the dashboard can actually filter/group by the `route` property before marking ATTRIBUTED — if it can't, use `UNALLOCATED` |
| Validated bookings | | | | Trip.com affiliate dashboard | |
| Commission — settled | | £ | | Trip.com affiliate dashboard | |
| Commission — pending | | £ | | Trip.com affiliate dashboard | |
| Founder effort | | minutes | | Manually logged | Time spent collecting/checking/maintaining this route/scope this week |

## Computed rates (where evidence allows)

Transcribe the week's figures into a `WeeklyFunnelRow` (see `lib/commercial-funnel.ts`) and run
`computeWeeklyFunnelRates()`. Paste the result here — every value is either a real number/percentage
or the literal string `N/A`, never a fabricated figure:

| Rate | Value |
|---|---|
| Visitor → useful interaction | |
| Useful interaction → CTA | |
| Visitor → CTA | |
| CTA → validated booking | |
| Visitor → validated booking | |
| Commission per visitor | |
| Commission per CTA click | |
| Commission per founder hour | |

## Attribution notes this week

Anything that changed about what's observable this week — new dashboard access, a Trip.com reply
that changes attribution, a route that gained/lost a "useful interaction" event, etc. Leave blank
if nothing changed from `README.md`'s standing attribution-gaps section.

## Founder review

One or two sentences: does this week's evidence change anything about the first-revenue bottleneck
question? If yes, note whether `docs/project-control/STATUS.md` needs updating — this file is the
weekly record, not the place project-wide conclusions get made.
