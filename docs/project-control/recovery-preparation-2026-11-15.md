# JetStash recovery preparation, 15 November 2026

This record captures the tested recovery patch. On 15 November the founder approved committing and pushing this branch and opening its PR. A Production merge remains separately gated. This does not establish traffic, customers, bookings or income.

Branch: `codex/revenue-recovery-2026-11-15`. Base: `b4188dd4427fdba7728b42e6d7b8753707e24c85`, the merged PR #377.

## Requested weaknesses and actual changes

| Weakness | Prepared change | What remains unresolved |
| --- | --- | --- |
| No proven income | Independent Air India/CJ adapter in the existing route booking slot, exact URL preservation, current account/terms and exact airport gates, disclosure and consent-aware click measurement | Public CJ flight records are empty. A joined advertiser is not a usable link or a sale. Current account access, generated URL and landing verification are required before activation. |
| Small audience | Correct the reporting that could present September search data and October conclusions as current acquisition evidence | No current traffic uplift is demonstrated. The connected GSC service requires a paid plan; no subscription was bought. No paid promotion, bulk page expansion or agency follow-up was started. |
| Ongoing maintenance | Generate the review queue and commercial gaps from the current inventory, including overdue sources and sources due within 14 days | A report cannot read an airline source on an editor's behalf. No source check, service date or fare was refreshed by this patch. The existing weekly reminder remains the operational notification. |
| Manual Arrive By flight times | Remove unconfirmed sample times. Offer optional .ics import, explicit event choice, local-clock previews and an apply step. Reset flight times/import when either airport changes | Calendar import is not live flight lookup or schedule validation. Floating, ambiguous, cancelled, recurring, incomplete and oversized files are refused. Connections require an event spanning first departure to final landing and traveller confirmation. |
| Limited arrival coverage | Prepare Delhi as the next single road-only arrival beta with Indian same-country destination restrictions | Uses the existing 30 September capability evidence, not a new probe. The 29 December review deadline remains. Other generic airports remain internal. Beta labels and existing paid-call protections stay. |
| Paused promotion | Keep Trip.com flight and hotel pause separate from the new CJ adapter | The pending Trip.com account/agreement questions are unresolved. No agreement was accepted and nothing was unpaused. |

## Validation

* Full Vitest suite: 5,871 passed across 306 files. Google/routing paths are stubbed; no paid call or tracked affiliate navigation was made.
* Strict TypeScript, separate lint and Next.js Production build passed. The Production-shaped build uses `NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED=true`.
* The 15 November audit was generated with the pause ON: 89 routes, 25 publishable Fare Signals, 64 without a publishable fare, zero monetised flight handoffs, 53 route reviews overdue and two due within 14 days.
* The normal `tsx` CLI encountered a local IPC permission error. Running the same script through `node --import tsx scripts/generate-portfolio-audit.ts 2026-11-15` succeeded. No permission escalation was used.
* Local HTTP verification passed: all 89 route pages returned 200 with one H1, zero Trip.com flight links and no activated CJ flight CTA. The Arrive By server render offered Delhi, started the flight times blank and placed airport selection before calendar import. This is server-render verification, not a browser interaction test.
* Browser QA is pending. The local Production server starts, but the separate cloud browser cannot reach its localhost and returns `ERR_CONNECTION_REFUSED`. This is an environment boundary, not a verified browser pass. A Vercel Preview is needed to check calendar selection/application, airport changes and mobile layout in the real browser.
* Secure CJ sign-in timed out. A fresh navigation to the CJ account returned the email sign-in page, so signed-in access is not established. No advertiser changes, agreement acceptance or flight-link activation was performed.

## Concrete next steps

1. The founder approved pushing this branch and opening its PR on 15 November. Run required CI and inspect its Vercel Preview before proposing the Production merge.
2. Use secure CJ sign-in to inspect the existing Air India relationship, current UK website promotion terms and Get Code options. Add only the exact generated URL and evidence for a verified airport pair. If those tools cannot provide the necessary handoff, leave the CTA absent.
3. Follow the repository's separate approval rule before a tracked landing test, merge or deployment. Do not accept new terms, purchase a service or send an agency follow-up as part of this work.
4. Obtain fresh first-party acquisition and transaction evidence. Continue the existing measured acquisition work only when the pages have a usable commercial path. A forecast or a test click must not be counted towards the founder's income goal.

## Review focus

Review calendar time-zone handling and first/final flight interpretation, the new Delhi release's date/country gates, CJ record validity and expiry, the unchanged Trip.com pause, and the distinction between historical search evidence and live demand. Existing source, price, privacy, API budget and rate-limit protections continue to apply.
