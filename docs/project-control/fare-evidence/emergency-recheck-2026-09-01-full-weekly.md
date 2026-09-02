# Fare Watcher verification recheck batch — three new standout candidates from the Tuesday full weekly refresh (1 September 2026)

**Collection date:** 1 September 2026 (same day as the Tuesday full weekly refresh's remaining-73-route batch)
**Profile:** one adult, return Economy, GBP, exact named airport endpoints, 14-night stay, fixed
eight-week horizon 27 October–10 November 2026 — identical profile to the routine observation each
of these three records rechecks.
**Source:** Google Flights only, manual visible-page checks. No scraping, polling, API harvesting or
retrospective backfill was used.

**Reason for this batch:** the Tuesday full weekly refresh's remaining-73-route batch produced three
new Fare Watcher internal standout candidates the same day (london-heathrow-delhi £403,
manchester-doha £257, manchester-madinah £313), in addition to the four already rechecked from the
7-route controlled weekly batch earlier that day. `FARE_WATCHER_DESIGN.md`'s candidate-flow step 4
("a founder/editor rechecks the source manually and approves, edits or rejects the candidate") and
the established 25 August/1 September precedent (PR #182/#183/#184, and this file's own
`weekly-controlled-batch-2026-08-25.md` / `emergency-recheck-2026-08-25.md`) both tie the recheck
trigger to a routine observation qualifying past Fare Watcher's meaningful-drop threshold — not to
membership in a particular batch. These three records are the independent, same-day rechecks that
policy requires.

| Route / profile | Recheck fare | Routine fare (same day) | Outbound evidence | Return evidence | Ticketing / baggage |
|---|---:|---:|---|---|---|
| LHR→DEL / `london-heathrow-delhi-economy-1adult-23kg-v1` | £433 | £403 | LHR–MCT–DEL, Oman Air WY104/WY241, 1 stop, 19h5m (9h Muscat long layover) | DEL–MCT–LHR, Oman Air WY242/WY103, 1 stop, 25h35m (14h10m Muscat long layover) | No self-transfer notice, single carrier; 1 free carry-on, 1st checked bag fee-based |
| MAN→DOH / `manchester-doha-economy-1adult-23kg-v1` | £257 | £257 | MAN–BGY–TIA–SAW–DOH, Ryanair FR3218/FR8349/Pegasus PC286/PC614, 3 stops, 24h55m | DOH–SAW–CRL–MAN, Pegasus PC615/PC921/Ryanair FR614, 2 stops, 17h40m | Self-transfer; carry-on/1st checked bag fee-based |
| MAN→MED / `manchester-madinah-economy-1adult-23kg-v1` | £309 | £313 | MAN–CRL–SAW–RUH–MED, Ryanair FR3222/Pegasus PC924/PC690/flyadeal F3223, 3 stops, 21h25m | MED–RUH–SAW–MAN, Flynas XY98/Pegasus PC691/PC1179, 2 stops, 15h20m | Self-transfer; carry-on/1st checked bag fee-based |

Both outbound and return legs were opened for every route, and every combination was clicked through
to its final itinerary/booking-options page rather than trusting the Cheapest-tab tile price — the
standing "always click through, never assume" rule. This caught a genuine discrepancy on
london-heathrow-delhi: the Cheapest-tab tile showed £407, but Google's own itinerary page displayed
"the price you saw on the previous page has changed" and confirmed £433 as the itinerary's actual
lowest total price. £433 vs the routine check's £403 is a **rise**, not a drop, and no longer clears
Fare Watcher's meaningful-drop threshold against the route's comparable median — Fare Watcher's
verified-candidate evaluation (which always evaluates through the matching recheck when one exists)
correctly drops london-heathrow-delhi from the standout-candidate queue. manchester-doha reproduced
its routine fare exactly (£257, unchanged, no price-change warning on click-through).
manchester-madinah came back slightly lower (£313 → £309) and remains a standout candidate.

## Method and safety checks

- All three rechecks use the same locked profile as the routine check they recheck: one adult,
  return Economy, GBP, 27 October–10 November 2026.
- `observationReason: 'emergency-recheck'` on every record, dated the same day (`2026-09-01`) as the
  routine batch, matching the existing same-day tie-break/recheck convention.
- No existing observation was edited or deleted. No route truth, affiliate destination/parameter,
  Fare Signal logic, Book-By logic, Journey Choice contract, Fare Watcher logic, or self-transfer
  logic changed.
- `isPubliclyPublishable()` is true for all three new records — each carries both travel dates and a
  currency.
- Post-recheck Fare Watcher/Route Watch evaluation: **six** current standout candidates, not seven —
  manchester-islamabad, manchester-lahore, birmingham-amritsar, london-heathrow-doha (from the
  controlled 7-route batch's own rechecks), plus manchester-doha and manchester-madinah from this
  batch. london-heathrow-delhi's own recheck disqualified it. No Standout Fare was approved for any
  candidate — `data/standout-fare-approvals.ts` is untouched.
