# Fare Watcher verification recheck batch — 25 August 2026

**Collection date:** 25 August 2026 (same day as the controlled weekly batch)
**Profile:** one adult, return Economy, GBP, exact named airport endpoints, 14-night stay, fixed
eight-week horizon 20 October–3 November 2026 — identical profile to the controlled weekly batch
these four records recheck.
**Source:** Google Flights only, manual visible-page checks. No scraping, polling, API harvesting or
retrospective backfill was used.
**Reason for this batch:** the controlled weekly batch (`weekly-controlled-batch-2026-08-25.md`)
produced four Fare Watcher internal candidates the same day (three standout candidates on
Manchester–Islamabad, Manchester–Lahore and Heathrow–Jeddah, plus a notable-drop candidate on
Birmingham–Amritsar). These four records are the independent rechecks performed to verify each
fare against a fresh search — evidence about the current representative fare, not a correction of
the routine entries, which remain unchanged and unedited.

| Route / profile | Recheck fare | Routine fare (same day) | Outbound evidence | Return evidence | Ticketing / baggage |
|---|---:|---:|---|---|---|
| MAN→ISB / `manchester-islamabad-economy-1adult-23kg-v1` | £480 | £460 | MAN–RUH–ISB, Riyadh Air, 1 stop, 13h45m, 2h50m Riyadh layover | ISB–RUH–MAN, Riyadh Air, 1 stop, 14h25m, 2h10m Riyadh layover | No self-transfer notice; baggage not stated, "Optional charges and bag fees may apply" |
| MAN→LHE / `manchester-lahore-economy-1adult-23kg-v1` | £547 | £538 | MAN–BGY–SHJ–LHE, Ryanair/Air Arabia/Fly Jinnah, 2 stops, 20h45m (4h20m Bergamo, 5h10m Sharjah) | LHE–KHI–SAW–CRL–MAN, return carriers not confirmed in this check, 3 stops, 31h55m (10h25m Karachi, 2h55m Istanbul, 5h35m Brussels) | Self-transfer; "This price does not include overhead bin access." |
| LHR→JED / `london-heathrow-jeddah-economy-1adult-23kg-v1` | £361 | £361 | LHR–IST–JED, Turkish Airlines/flyadeal, 1 stop, 13h10m, 5h35m Istanbul layover | JED–BUD–MXP–BIO–LHR, Wizz Air/Vueling, 3 stops, 25h30m (9h35m Budapest, 3h50m Milan, 1h05m Bilbao) | Self-transfer; "This price does not include overhead bin access." |
| BHX→ATQ / `birmingham-amritsar-economy-1adult-23kg-v1` | £591 | £589 | BHX–DUB–FRA–DEL–ATQ, Ryanair/Lufthansa/Air India, 3 stops, 23h40m (2h50m Dublin, 5h45m Frankfurt, 1h15m Delhi) | ATQ–DEL–SHJ–BGY–BHX, IndiGo/Air Arabia/Ryanair, 3 stops, 26h15m (4h20m Delhi, 1h00m Sharjah, 6h35m Bergamo) | Self-transfer; "This price does not include overhead bin access." |

Both outbound and return legs were opened for every route. The stored `sourceUrl` on each new
`FareObservation` record uses the same search parameters (route, exact dates, GBP) as the
same-route routine entry — a genuinely identical query for the same criteria, not a fabricated
link.

## Method and safety checks

- All four rechecks use the same locked profile as the batch they recheck: one adult, return
  Economy, GBP, 20 October–3 November 2026.
- `observationReason: 'emergency-recheck'` on every record. `fareDirectness` is `connecting` for
  all four — each selected result showed at least one confirmed stop, matching the routine batch.
- No existing observation was edited or deleted. No route truth, affiliate destination/parameter,
  Fare Signal logic, Book-By logic, Journey Choice contract, Fare Watcher logic, or self-transfer
  logic changed.
- Manchester–Lahore's return-leg operating carriers were not confirmed during this specific check
  (the outbound carriers were) — recorded honestly as "not confirmed in this check" rather than
  reusing the routine batch's return carriers, which were for a different itinerary routing (via
  Cairo/Riyadh, not this recheck's Karachi/Istanbul/Brussels routing).
- `isPubliclyPublishable()` is true for all four new records — each carries both travel dates and a
  currency.
- Following the merged same-day representative-priority fix (PR #182), each of these four records —
  not the cheaper same-day routine record it rechecks — is now confirmed (via the live selector, not
  inferred) to be its route's actual representative Fare Signal and Book-By evidence.
