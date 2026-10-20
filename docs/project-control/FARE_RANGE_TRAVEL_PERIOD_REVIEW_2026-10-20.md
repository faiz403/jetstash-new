# Fare-range travel-period correction: independent review record

Local implementation only. Branch: `codex/fare-range-travel-window`.
Founder-approved Production source baseline: `e744cffe53371127bdc2f04d1bb00fb4ce632849`.
All calculations below use **20 October 2026**, not the date the reviewer runs the script.
No commit, PR, preview, merge or deployment has been made.

## Problem and implementation

`getFareRangeSummary` previously combined every qualifying route/cabin observation, even when
the outbound or return dates differed. For Birmingham–Islamabad this combined November's
£634/£667 checks with December's £1,098 check into £634–£1,098. That route has no curated
flight card; it is a real archive reproduction of the helper defect.

The correction leaves publication and departure-margin filters in place. It rejects incomplete,
non-ISO, impossible and non-positive travel-date pairs, then preserves the global preference
for observations not flagged as self-transfer. Within that pool the anchor is the newest
check. Same-day anchors prefer lower price, then departure date, return date and ID ascending.
Only checks matching both anchor travel dates contribute to the summary. The input/archive
array is not sorted or modified. Summary checks are ordered by check date, then ID.

The selected date pair is returned explicitly. Price extrema, sources, counts, check dates,
directness and minimum-specific notes/consequences all describe that selected pool. The existing
minimum-price tie rule still takes the most recent check, with ID ordering making same-day
ties deterministic. Older trips remain available to the unchanged history and Fare Signal paths.

Cards show `Travel <departure>–<return>` separately from check dates. Multiple-check cards label
their note `Details of the minimum shown` and state that baggage and fare conditions may differ.
Matching dates do not imply matching baggage, airline, itinerary or fare conditions. No new
claim about clean tickets or both-leg directness is inferred. The existing aggregate refuses a
directness badge if any selected check has unknown, missing or conflicting directness.

## Complete summary impact

There are 89 routes × 3 cabins = **267** comparisons. **201** summaries were null and remain
null; **66** remain non-null. Exactly **17 Economy** summaries change existing fields.
All other summaries preserve their existing values and gain only the explicit travel dates.
Premium Economy and Business do not change their existing summary values at this date.

Every selected period below is **17 November–1 December 2026**, except Birmingham–Islamabad,
which selects **11–25 December 2026**. “Card” identifies a curated flight card at this baseline;
the other eleven changes affect the helper output but have no corresponding flight card.

| Route slug | Previous range; checks | Selected range; checks | Card |
|---|---|---|---|
| birmingham-dalaman | £183–£276; 3 | £248–£276; 2 | No |
| birmingham-bodrum | £183–£248; 4 | £185–£248; 3 | No |
| glasgow-dalaman | £203–£236; 3 | £209–£236; 2 | No |
| bristol-antalya | £190–£264; 3 | £202–£264; 2 | No |
| bristol-dalaman | £229–£311; 3 | £275–£311; 2 | No |
| london-gatwick-antalya | £88–£119; 3 | £111–£119; 2 | No |
| manchester-marrakech | £62–£77; 4 | £62–£75; 3 | No |
| bristol-marrakech | £81–£106; 3 | £81–£82; 2 | No |
| london-heathrow-delhi | £454–£490; 3 | £455–£490; 2 | Yes |
| birmingham-islamabad | £634–£1,098; 3 | £1,098; 1 | No |
| leeds-bradford-amritsar | £1,106–£1,565; 4 | £1,268–£1,565; 3 | Yes |
| leeds-bradford-islamabad | £618–£827; 4 | £618–£827; 3 | Yes |
| london-heathrow-mumbai | £424–£437; 4 | £424–£437; 3 | Yes |
| london-heathrow-bengaluru | £401–£435; 4 | £402–£435; 3 | Yes |
| london-heathrow-dhaka | £529–£665; 4 | £529–£665; 3 | No |
| manchester-barcelona | £66–£130; 3 | £128–£130; 2 | Yes |
| birmingham-barcelona | £71–£137; 3 | £121–£137; 2 | No |

The six curated cards also narrow their attribution and minimum-specific details:

| Card | Selected sources | Minimum checked | Other existing-field changes |
|---|---|---|---|
| lhr-del-economy | Gulf Air | 22 September | Minimum note changes from the removed Air India trip |
| lba-atq-economy | KLM and IndiGo | 29 September | Minimum note changes from the removed mixed-airline trip |
| lba-isb-economy | Aer Lingus, Etihad Airways; AccesRail, Qatar Airways; Aer Lingus and Etihad | 6 October | Removes the older source label; minimum note unchanged |
| lhr-bom-economy | Gulf Air; Oman Air | 29 September | Removes Etihad/Akasa attribution; minimum note unchanged |
| lhr-blr-economy | Gulf Air | 6 October | Minimum note changes to the £402 check |
| man-bcn-flight | Vueling | 22 September | Minimum note changes from the removed £66 trip |

Check-count/earliest-check copy narrows to the selected period. The five connecting badges above
remain connecting; Barcelona remains unclassified. The helper's downstream tracked-fare counts
and Business clarity panels retain their baseline values at this evaluation date.

## Other intentional card changes

All **24** currently priced cards show the selected travel dates. Every one selects
17 November–1 December 2026. Multiple-check cards additionally receive the minimum-note label
and baggage/conditions qualification. Prices are kept on one line and the longer note starts
below the price, preventing the note from squeezing a range onto separate lines.

The complete priced-card inventory is:

`man-lhe-economy`, `lhr-del-economy`, `bhx-atq-economy`, `man-dxb-economy`,
`lhr-doh-economy`, `lgw-tng-flight`, `man-bcn-flight`, `lhr-bom-economy`,
`man-khi-economy`, `man-ath-economy`, `man-fco-economy`, `man-isb-economy`,
`man-del-economy`, `man-bom-economy`, `man-amd-economy`, `man-atq-economy`,
`man-doh-economy`, `man-med-economy`, `lhr-blr-economy`, `bhx-bom-economy`,
`bhx-med-economy`, `man-dac-economy`, `lba-atq-economy`, `lba-isb-economy`.

The 26 route-search cards on `/deals` remain unpriced. Bundled products stay unpriced.
Manchester–Dubai preserves **£380–£444 from two checks**, attributed to Pegasus and SWISS.
The proposed Emirates £969.93 December fare was not ingested or published.

## Safeguards and regression coverage

`scripts/verify-fare-range-travel-period.ts` loads the original observation module directly from
the pinned Git commit without switching branches. Across all 267 pairs it checks publication
eligibility against that original module and ensures no hidden summary becomes visible. Across
all 89 routes it checks Fare Signal equality. Observation history is deeply equal to the original.
It also verifies that route records/status events, deal curation, route presentation, affiliate
providers, airport-pair safeguards, departure thresholds, Fare Signal code and re-verification
records have no diff from baseline.

The new regression file has 28 cases covering real November/December data, Manchester–Dubai,
different return dates, same-month/cross-year travel, deterministic ties, impossible/malformed/
missing dates, causal availability, departure margins, pending/expired routes, airport exclusion,
global clean preference, self-transfer-only cabins, mixed directness, baggage qualifications,
summary attribution and rendered card wording. Historical tests that asserted cross-period
pooling now assert the selected trip. Pure mixed/unknown-directness tests remain in place.

## Production and visual comparison

Read-only GET captures cover all **89 Production route pages** plus `/deals`, `/india`, `/gulf`,
`/pakistan`, `/business-class`, `/umrah` and `/family-holidays`: **96 pages, all HTTP 200**.
No forms, flight searches, affiliate links or paid APIs were exercised.

The final local build is compared with that captured Production content. All card counts and
affiliate destinations match. Outside deal cards, rendered text matches after two narrowly
defined normalizations: `Checked N days ago` and the two `/deals` `as of` render timestamps.
Nine cached route pages had one-day age differences; `/deals` had an older render time.
There are no remaining unexpected non-card text differences. This is a rendered-text and link
comparison, not a claim of byte-identical HTML or a fresh deployment-ID attestation.

Browser inspection covers the rendered Manchester–Dubai price/date/conditions card and the
six affected route cards. Single-December Birmingham–Islamabad card wording is tested with a
synthetic Deal fixture; no production Deal was added for that route.

## Reproduction and final checks

Run the offline source comparison with existing project dependencies:

```powershell
node --import tsx scripts/verify-fare-range-travel-period.ts
```

It writes `node_modules/.cache/fare-range-review/final-comparison.json`, including all 267 cells,
every changed summary and all 24 priced cards. It creates and removes a temporary baseline module
under `.next/cache`; it does not modify source history or Git refs.

`scripts/check-fare-range-pages.mjs` can recheck localhost on port 3107 against the saved Production
HTML in the same ignored review-cache directory. Those HTML captures are local review artifacts,
not committed fixtures; a fresh reviewer needs an equivalent read-only Production capture to rerun
that page comparison. The offline source comparison and tests do not depend on the HTML captures.

Final checks on 20 October 2026:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed, no ESLint warnings/errors |
| `npm test -- --run` | Passed: 5,358 tests across 269 files, including 28 new regression cases |
| `npm run build` | Passed: 169 generated pages, including all 89 route pages |
| Offline pinned-source comparison | Passed: 267 pairs; 201 hidden remain hidden; 17 intended summary changes |
| Captured Production/local page comparison | Passed: 96 pages; no unexpected non-card, affiliate or card-count changes |
| `git diff --check` | Passed |

Existing Next lint deprecation, Vite config-loader and edge-runtime prerender notices do not fail
these checks. No new dependency or configuration changes were needed.

## Critical self-review and remaining limits

- Grouping follows eligibility and the global clean-ticket preference. A newer self-transfer-only
  period cannot displace an older eligible clean period. This is deliberate preservation of policy.
- Date validation is range-specific. It does not silently change the shared publication predicate
  or Fare Signal, and it never backfills missing evidence.
- All metadata comes from the selected pool. Unknown/conflicting directness within that pool still
  suppresses a badge; baggage notes explicitly describe the minimum, not every check in a range.
- Existing historical range assertions changed because the correction also applies to historical
  evaluations. Source observations and their historical availability did not change.
- The new comparison tools are local review utilities. Source verification uses the exact pinned
  commit; HTML comparison uses dated Production captures and explicit cache-age normalization.
  Neither proves a future deployment or future-date eligibility without rerunning appropriate checks.
- No implementation blocker remains. Independent review is still required before any separately
  authorized release; no release approval is implied by this record.
